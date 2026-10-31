import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../shared/ui/icon/icon';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AdminBrandItem,
  AdminCarModelItem,
  AdminPartDataItem,
  AdminService,
  RealBrandItem,
  RealCarModelItem,
  RealPartItem,
} from '../services/admin.service';
import { CatalogStorageHelper } from '../../../core/storage/catalog-storage';

@Component({
  selector: 'app-admin-edit-data',
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './admin-edit-data.html',
})
export class AdminEditData implements OnInit {
  readonly auth = inject(AuthService);
  readonly admin = inject(AdminService);

  // 3-Level View Navigation State
  readonly level = signal<'brands' | 'models' | 'parts'>('brands');
  readonly selectedBrand = signal<RealBrandItem | null>(null);
  readonly selectedCar = signal<RealCarModelItem | null>(null);

  // Level 3 Architecture: Tabs & 2-Step Tuning Selection
  readonly partTab = signal<'bodykit' | 'parts'>('bodykit');
  readonly selectedCategory = signal<string>('Wheels');
  readonly availableCategories = signal<string[]>([
    'Wheels',
    'Spoilers',
    'Exhaust',
    'Brakes',
    'Suspension',
  ]);

  // Selected Tuning Brand: null = Step 1 (Brand Selection), string = Step 2 (Part Items)
  readonly selectedTuningBrand = signal<string | null>(null);

  // Search & Filter
  readonly brandSearchQuery = signal('');

  // คำนวณรายชื่อแบรนด์ที่กรองตามคำค้นหา
  readonly filteredBrands = computed(() => {
    const q = this.brandSearchQuery().trim().toLowerCase();
    if (!q) return this.admin.catalogBrands();
    return this.admin.catalogBrands().filter(
      (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
    );
  });

  // Track failed image loads to replace with neutral placeholders
  readonly failedBrandLogos = signal<Set<string>>(new Set());
  readonly failedCarImages = signal<Set<string>>(new Set());

  onBrandLogoError(brandId: string): void {
    this.failedBrandLogos.update((set) => {
      const next = new Set(set);
      next.add(brandId);
      return next;
    });
  }

  onCarImageError(carId: string): void {
    this.failedCarImages.update((set) => {
      const next = new Set(set);
      next.add(carId);
      return next;
    });
  }

  // Modals visibility
  readonly brandModalOpen = signal(false);
  readonly editBrandModalOpen = signal(false);
  readonly carModalOpen = signal(false);
  readonly editCarModalOpen = signal(false);
  readonly partModalOpen = signal(false);
  readonly tuningBrandModalOpen = signal(false);
  readonly categoryModalOpen = signal(false);

  // File state & preview for modals
  readonly selectedBrandFile = signal<File | null>(null);
  readonly brandFilePreview = signal<string | null>(null);

  readonly editBrandFile = signal<File | null>(null);
  readonly editBrandFilePreview = signal<string | null>(null);

  readonly selectedCarFile = signal<File | null>(null);
  readonly carFilePreview = signal<string | null>(null);

  readonly editCarFile = signal<File | null>(null);
  readonly editCarFilePreview = signal<string | null>(null);

  readonly selectedPartFile = signal<File | null>(null);
  readonly partFilePreview = signal<string | null>(null);

  readonly selectedTuningBrandFile = signal<File | null>(null);
  readonly tuningBrandFilePreview = signal<string | null>(null);
  readonly tuningBrandLogos = signal<Map<string, string>>(new Map());
  readonly workshopBrands = signal<{
    bodykit: { name: string; logoUrl: string }[];
    parts: { name: string; logoUrl: string }[];
  }>({ bodykit: [], parts: [] });

  // Uploading state
  readonly isUploading = signal(false);
  readonly uploadProgressText = signal('');

  // Form states: New Brand / Edit Brand
  readonly newBrandName = signal('');
  readonly editingBrandName = signal('');

  // Form states: New Car / Edit Car
  readonly newCarName = signal('');
  readonly editingCarName = signal('');

  // Form states: Tuning Brand & Custom Category
  readonly newTuningBrandName = signal('');
  readonly newCustomCategoryName = signal('');

  // Form states: New Part
  readonly newPartCategory = signal('BodyKit');
  readonly newPartManufacturer = signal('');
  readonly newPartName = signal('');
  readonly newPartPrice = signal<number | null>(null);

  // Toast feedback
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  private isBodyKitCategory(cat: string): boolean {
    const c = (cat || '').toLowerCase().replace(/[\s_-]+/g, '');
    return c === 'bodykit' || c === 'fullbodykits' || c === 'bodykits';
  }

  // Active Category label for backward compatibility
  readonly activeCategory = computed(() => {
    return this.partTab() === 'bodykit' ? 'Body Kit' : this.selectedCategory();
  });

  // Filtered lists for Level 2 (models)
  readonly filteredCarsForBrand = computed(() => {
    const brand = this.selectedBrand();
    if (!brand) return [];
    return this.admin.catalogModels().filter((c) => {
      const bId = c.brand_id || c.brandId;
      return (
        bId === brand.id ||
        bId === brand.name ||
        (brand.name && bId?.toLowerCase() === brand.name.toLowerCase())
      );
    });
  });

  // Level 3 Step 1: Distinct Tuning Brands for current car & tab/category
  readonly tuningBrandsForCurrentContext = computed(() => {
    const car = this.selectedCar();
    if (!car) return [];
    const isBodyKit = this.partTab() === 'bodykit';

    const fromWorkshops = this.workshopBrands()[isBodyKit ? 'bodykit' : 'parts'].map((w) => w.name);

    const relevantParts = this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      if (!isMatchCar) return false;
      return isBodyKit ? this.isBodyKitCategory(p.category) : !this.isBodyKitCategory(p.category);
    });

    const fromParts = relevantParts.map((p) => (p.manufacturer || 'Custom').trim()).filter(Boolean);
    return Array.from(new Set([...fromWorkshops, ...fromParts]));
  });

  // Level 3 Step 2: Part Items for the selected tuning brand
  readonly partsForSelectedTuningBrand = computed(() => {
    const car = this.selectedCar();
    const brandName = this.selectedTuningBrand();
    if (!car || !brandName) return [];
    const isBodyKit = this.partTab() === 'bodykit';

    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      const isMatchBrand = (p.manufacturer || 'Custom').toLowerCase() === brandName.toLowerCase();
      const isMatchCategory = isBodyKit
        ? this.isBodyKitCategory(p.category)
        : !this.isBodyKitCategory(p.category);
      return isMatchCar && isMatchBrand && isMatchCategory;
    });
  });

  // Backward compatibility for filteredPartsForCar
  readonly filteredPartsForCar = computed(() => {
    const car = this.selectedCar();
    if (!car) return [];
    const isBodyKit = this.partTab() === 'bodykit';
    const cat = this.selectedCategory().toLowerCase();

    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      if (!isMatchCar) return false;
      return isBodyKit
        ? this.isBodyKitCategory(p.category)
        : !this.isBodyKitCategory(p.category) && p.category.toLowerCase() === cat;
    });
  });

  // Grid slot placeholders
  readonly brandPlaceholders = computed(() => {
    const filled = 1 + this.filteredBrands().length;
    const remaining = Math.max(0, 18 - filled);
    return Array.from({ length: remaining });
  });

  readonly modelPlaceholders = computed(() => {
    const filled = 2 + this.filteredCarsForBrand().length;
    const remaining = Math.max(0, 18 - filled);
    return Array.from({ length: remaining });
  });

  readonly tuningBrandPlaceholders = computed(() => {
    const filled = 1 + this.tuningBrandsForCurrentContext().length;
    const remaining = Math.max(0, 12 - filled);
    return Array.from({ length: remaining });
  });

  readonly partPlaceholders = computed(() => {
    const filled = 1 + this.partsForSelectedTuningBrand().length;
    const remaining = Math.max(0, 12 - filled);
    return Array.from({ length: remaining });
  });

  async ngOnInit(): Promise<void> {
    await this.admin.fetchCatalogBrands();
  }

  // Navigation Methods
  async selectBrand(brand: RealBrandItem): Promise<void> {
    this.selectedBrand.set(brand);
    this.selectedCar.set(null);
    this.selectedTuningBrand.set(null);
    this.level.set('models');
    await this.admin.fetchCatalogModels(brand.name || brand.id);
  }

  backToBrands(): void {
    this.selectedBrand.set(null);
    this.selectedCar.set(null);
    this.selectedTuningBrand.set(null);
    this.level.set('brands');
  }

  async selectCar(car: RealCarModelItem): Promise<void> {
    this.selectedCar.set(car);
    this.selectedTuningBrand.set(null);
    this.partTab.set('bodykit');
    this.level.set('parts');
    const brandName = this.selectedBrand()?.name || '';
    if (brandName) {
      const res = await this.admin.fetchCatalogTuning(brandName, car.name);
      this.workshopBrands.set(res.workshops);
      this.tuningBrandLogos.update((map) => {
        const next = new Map(map);
        for (const w of res.workshops.bodykit) {
          if (w.logoUrl) next.set(w.name.toLowerCase(), w.logoUrl);
        }
        for (const w of res.workshops.parts) {
          if (w.logoUrl) next.set(w.name.toLowerCase(), w.logoUrl);
        }
        return next;
      });
    } else {
      await this.admin.fetchCatalogParts(car.id);
    }
  }

  backToModels(): void {
    this.selectedCar.set(null);
    this.selectedTuningBrand.set(null);
    this.level.set('models');
  }

  // Tab & Category Controls
  setPartTab(tab: 'bodykit' | 'parts'): void {
    this.partTab.set(tab);
    this.selectedTuningBrand.set(null);
  }

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.selectedTuningBrand.set(null);
  }

  selectTuningBrand(brand: string): void {
    this.selectedTuningBrand.set(brand);
  }

  backToTuningBrands(): void {
    this.selectedTuningBrand.set(null);
  }

  // Custom Category Modal Handlers
  openCategoryModal(): void {
    this.newCustomCategoryName.set('');
    this.categoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
  }

  addCustomCategory(): void {
    const cat = this.newCustomCategoryName().trim();
    if (!cat) {
      this.showToast('กรุณาระบุชื่อหมวดหมู่ใหม่', 'error');
      return;
    }
    if (!this.availableCategories().some((c) => c.toLowerCase() === cat.toLowerCase())) {
      this.availableCategories.update((list) => [...list, cat]);
    }
    this.selectedCategory.set(cat);
    this.selectedTuningBrand.set(null);
    this.closeCategoryModal();
    this.showToast(`เพิ่มหมวดหมู่ "${cat}" สำเร็จ`, 'success');
  }

  // Tuning Brand Modal Handlers
  openTuningBrandModal(): void {
    this.newTuningBrandName.set('');
    this.selectedTuningBrandFile.set(null);
    this.tuningBrandFilePreview.set(null);
    this.tuningBrandModalOpen.set(true);
  }

  closeTuningBrandModal(): void {
    this.tuningBrandModalOpen.set(false);
  }

  onTuningBrandFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.selectedTuningBrandFile.set(file);
        this.tuningBrandFilePreview.set(preview);
      });
    }
  }

  async addTuningBrand(): Promise<void> {
    const name = this.newTuningBrandName().trim();
    if (!name) {
      this.showToast('กรุณาระบุชื่อแบรนด์ของแต่ง', 'error');
      return;
    }
    const file = this.selectedTuningBrandFile();
    if (!file) {
      this.showToast('กรุณาอัปโหลดรูปภาพโลโก้แบรนด์ของแต่ง', 'error');
      return;
    }

    let logoUrl = this.tuningBrandFilePreview() || '';
    const car = this.selectedCar();
    const carBrand = this.selectedBrand();

    if (file && car && carBrand) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดโลโก้สำนักแต่ง...');
      try {
        const client = await this.admin.getClient();
        if (client) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const path = CatalogStorageHelper.getTuningBrandLogoPath(
            carBrand.name,
            car.name,
            this.partTab(),
            name,
            ext,
          );
          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            logoUrl = res.url;
          }
        }
      } catch (err) {
        console.warn('[AdminEditData] Upload tuning brand logo warning:', err);
      } finally {
        this.isUploading.set(false);
      }
    }

    if (logoUrl) {
      this.tuningBrandLogos.update((map) => {
        const next = new Map(map);
        next.set(name.toLowerCase(), logoUrl);
        return next;
      });
    }

    this.workshopBrands.update((wb) => {
      const tabKey = this.partTab();
      const existing = wb[tabKey] || [];
      if (!existing.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
        return {
          ...wb,
          [tabKey]: [...existing, { name, logoUrl }].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
      return wb;
    });

    this.selectedTuningBrand.set(name);
    this.closeTuningBrandModal();
    this.showToast(`เลือกแบรนด์ "${name}" แล้ว - กดปุ่ม (+) เพื่อเพิ่มชิ้นส่วนได้ทันที`, 'success');
  }

  // Edit Brand Modal Handlers
  openEditBrandModal(brand: RealBrandItem): void {
    this.editingBrandName.set(brand.name);
    this.editBrandFile.set(null);
    this.editBrandFilePreview.set(null);
    this.editBrandModalOpen.set(true);
  }

  closeEditBrandModal(): void {
    this.editBrandModalOpen.set(false);
  }

  onEditBrandFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editBrandFile.set(file);
        this.editBrandFilePreview.set(preview);
      });
    }
  }

  async saveEditBrand(): Promise<void> {
    const brand = this.selectedBrand();
    const newName = this.editingBrandName().trim();
    if (!brand) return;
    if (!newName) {
      this.showToast('กรุณากรอกชื่อแบรนด์', 'error');
      return;
    }

    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลแบรนด์...');

    try {
      const client = await this.admin.getClient();
      let logoUrl = brand.logo_url;

      const file = this.editBrandFile();
      if (file && client) {
        const ext = CatalogStorageHelper.getFileExtension(file);
        const path = CatalogStorageHelper.getBrandLogoPath(newName, ext);
        const res = await CatalogStorageHelper.uploadFile(client, path, file);
        if (res.ok && res.url) {
          logoUrl = res.url;
        } else {
          throw new Error(res.error || 'Upload failed');
        }
      }

      if (client) {
        try {
          await client
            .from('car_brand_reference')
            .update({
              name: newName,
              details: {
                ...(brand as any).details,
                name: newName,
                logoReferenceUrl: logoUrl,
              },
            })
            .eq('id', brand.id);
        } catch (dbErr) {
          console.warn('[AdminEditData] Supabase update car_brand_reference warning:', dbErr);
        }
      }

      const updated: RealBrandItem = {
        ...brand,
        name: newName,
        logo_url: logoUrl,
        logoUrl: logoUrl,
      };
      this.selectedBrand.set(updated);
      this.admin.catalogBrands.update((list) =>
        list.map((b) => (b.id === brand.id ? updated : b)),
      );

      this.failedBrandLogos.update((set) => {
        const next = new Set(set);
        next.delete(brand.id);
        return next;
      });

      await this.admin.fetchCatalogBrands();
      this.closeEditBrandModal();
      this.showToast(`แก้ไขข้อมูลแบรนด์ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (err: any) {
      this.showToast(`แก้ไขล้มเหลว: ${err?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }

  // Edit Car Model Modal Handlers
  openEditCarModal(car: RealCarModelItem | null): void {
    if (!car) return;
    this.editingCarName.set(car.name);
    this.editCarFile.set(null);
    this.editCarFilePreview.set(null);
    this.editCarModalOpen.set(true);
  }

  closeEditCarModal(): void {
    this.editCarModalOpen.set(false);
  }

  onEditCarFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editCarFile.set(file);
        this.editCarFilePreview.set(preview);
      });
    }
  }

  async saveEditCar(): Promise<void> {
    const brand = this.selectedBrand();
    const car = this.selectedCar();
    const newName = this.editingCarName().trim();
    if (!brand || !car) return;
    if (!newName) {
      this.showToast('กรุณากรอกชื่อรุ่นรถ', 'error');
      return;
    }

    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลรุ่นรถ...');

    try {
      const client = await this.admin.getClient();
      let imageUrl = car.image_url;

      const file = this.editCarFile();
      if (file && client) {
        const ext = CatalogStorageHelper.getFileExtension(file);
        const path = CatalogStorageHelper.getCarPicturePath(brand.name, newName, ext);
        const res = await CatalogStorageHelper.uploadFile(client, path, file);
        if (res.ok && res.url) {
          imageUrl = res.url;
        } else {
          throw new Error(res.error || 'Upload failed');
        }
      }

      if (client) {
        try {
          const { data: brandData } = await client
            .from('car_brand_reference')
            .select('id, name, details')
            .eq('id', brand.id)
            .single();

          if (brandData?.details?.modelCatalog?.models) {
            const models = brandData.details.modelCatalog.models.map((m: any) =>
              m.id === car.id || m.name === car.name ? { ...m, name: newName, imageUrl } : m,
            );
            brandData.details.modelCatalog.models = models;
            await client
              .from('car_brand_reference')
              .update({ details: brandData.details })
              .eq('id', brand.id);
          }
        } catch (dbErr) {
          console.warn('[AdminEditData] car_brand_reference model update warning:', dbErr);
        }
      }

      const updatedCar: RealCarModelItem = {
        ...car,
        name: newName,
        image_url: imageUrl,
        image: imageUrl,
      };

      this.selectedCar.set(updatedCar);
      this.admin.catalogModels.update((list) =>
        list.map((c) => (c.id === car.id ? updatedCar : c)),
      );

      this.failedCarImages.update((set) => {
        const next = new Set(set);
        next.delete(car.id);
        return next;
      });

      await this.admin.fetchCatalogModels(brand.name || brand.id);
      this.closeEditCarModal();
      this.showToast(`แก้ไขรุ่นรถ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (err: any) {
      this.showToast(`แก้ไขล้มเหลว: ${err?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }

  // File Handlers & Validation
  onBrandFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.selectedBrandFile.set(file);
        this.brandFilePreview.set(preview);
      });
    }
  }

  onCarFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.selectedCarFile.set(file);
        this.carFilePreview.set(preview);
      });
    }
  }

  onPartFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.selectedPartFile.set(file);
        this.partFilePreview.set(preview);
      });
    }
  }

  validateAndPreview(file: File, onSuccess: (previewUrl: string) => void): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพ .jpg, .png หรือ .webp เท่านั้น', 'error');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('ขนาดไฟล์ต้องไม่เกิน 10 MB', 'error');
      return false;
    }
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) onSuccess(result);
      };
      reader.readAsDataURL(file);
    } catch {
      onSuccess('');
    }
    return true;
  }

  // Brand Modal Handlers (Streamlined)
  openBrandModal(): void {
    this.newBrandName.set('');
    this.selectedBrandFile.set(null);
    this.brandFilePreview.set(null);
    this.brandModalOpen.set(true);
  }

  closeBrandModal(): void {
    this.brandModalOpen.set(false);
  }

  async saveBrand(): Promise<void> {
    const name = this.newBrandName().trim();
    if (!name) {
      this.showToast('กรุณากรอกชื่อแบรนด์', 'error');
      return;
    }

    const file = this.selectedBrandFile();
    if (!file) {
      this.showToast('กรุณาอัปโหลดรูปภาพโลโก้แบรนด์', 'error');
      return;
    }

    let logoUrl = this.brandFilePreview() || '';

    if (file) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดโลโก้ขึ้น Supabase Storage...');
      try {
        const client = await this.admin.getClient();
        if (client) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const path = CatalogStorageHelper.getBrandLogoPath(name, ext);
          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            logoUrl = res.url;
          } else {
            throw new Error(res.error || 'Upload failed');
          }
        }
      } catch (err: any) {
        this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
        this.isUploading.set(false);
        return;
      } finally {
        this.isUploading.set(false);
      }
    }

    const res = await this.admin.insertBrand({
      name,
      logo_url: logoUrl,
      is_custom_bg: false,
    });
    if (res.ok) {
      await this.admin.fetchCatalogBrands();
      this.closeBrandModal();
      this.showToast(`เพิ่มแบรนด์ "${name}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึก Brand ล้มเหลว', 'error');
    }
  }

  readonly submitAddBrand = (): Promise<void> => this.saveBrand();

  // Car Modal Handlers (Streamlined)
  openCarModal(): void {
    this.newCarName.set('');
    this.selectedCarFile.set(null);
    this.carFilePreview.set(null);
    this.carModalOpen.set(true);
  }

  closeCarModal(): void {
    this.carModalOpen.set(false);
  }

  async saveCar(): Promise<void> {
    const brand = this.selectedBrand();
    if (!brand) return;

    const name = this.newCarName().trim();
    if (!name) {
      this.showToast('กรุณากรอกชื่อรุ่นรถ', 'error');
      return;
    }

    const file = this.selectedCarFile();
    if (!file) {
      this.showToast('กรุณาอัปโหลดรูปภาพรถต้นแบบ', 'error');
      return;
    }

    let imageUrl = this.carFilePreview() || '';

    if (file) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดรูปรถต้นแบบ...');
      try {
        const client = await this.admin.getClient();
        if (client) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const path = CatalogStorageHelper.getCarPicturePath(brand.name, name, ext);
          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            imageUrl = res.url;
          } else {
            throw new Error(res.error || 'Upload failed');
          }
        }
      } catch (err: any) {
        this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
        this.isUploading.set(false);
        return;
      } finally {
        this.isUploading.set(false);
      }
    }

    const res = await this.admin.insertCarModel({
      brand_id: brand.name || brand.id,
      name,
      image_url: imageUrl,
      body_type: 'Coupe',
    });
    if (res.ok) {
      await this.admin.fetchCatalogModels(brand.name || brand.id);
      this.closeCarModal();
      this.showToast(`เพิ่มรุ่นรถ "${name}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกรุ่นรถล้มเหลว', 'error');
    }
  }

  readonly submitAddCar = (): Promise<void> => this.saveCar();

  // Part Modal Handlers (2-Step Tuning Integration)
  openPartModal(): void {
    const currentCat = this.partTab() === 'bodykit' ? 'BodyKit' : this.selectedCategory();
    this.newPartCategory.set(currentCat);
    this.newPartManufacturer.set(this.selectedTuningBrand() || 'Custom');
    this.newPartName.set('');
    this.newPartPrice.set(null);
    this.selectedPartFile.set(null);
    this.partFilePreview.set(null);
    this.partModalOpen.set(true);
  }

  closePartModal(): void {
    this.partModalOpen.set(false);
  }

  async savePart(): Promise<void> {
    const brand = this.selectedBrand();
    const car = this.selectedCar();
    if (!car) return;

    const name = this.newPartName().trim();
    if (!name) {
      this.showToast('กรุณากรอกชื่อชุดแต่ง/พาร์ต', 'error');
      return;
    }

    const isBodyKit = this.partTab() === 'bodykit';
    const tuningBrand = this.selectedTuningBrand() || this.newPartManufacturer().trim() || 'Custom';
    const category = isBodyKit ? 'BodyKit' : this.selectedCategory();
    const file = this.selectedPartFile();
    if (!file) {
      this.showToast('กรุณาอัปโหลดรูปภาพชิ้นส่วน', 'error');
      return;
    }

    let imageUrl = this.partFilePreview() || '';

    if (file) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดรูปพาร์ตแต่ง...');
      try {
        const client = await this.admin.getClient();
        if (client) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const brandName = brand?.name || 'Universal';
          const path = isBodyKit
            ? CatalogStorageHelper.getBodyKitPath(brandName, car.name, tuningBrand, name, ext)
            : CatalogStorageHelper.getPartPath(brandName, car.name, tuningBrand, name, ext);

          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            imageUrl = res.url;
          } else {
            throw new Error(res.error || 'Upload failed');
          }
        }
      } catch (err: any) {
        this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
        this.isUploading.set(false);
        return;
      } finally {
        this.isUploading.set(false);
      }
    }

    const price = this.newPartPrice() ?? 0;
    const res = await this.admin.insertCarPart({
      car_model_id: car.id,
      category,
      name,
      manufacturer: tuningBrand,
      image_url: imageUrl,
      price,
    });
    if (res.ok) {
      if (brand && car) {
        const tRes = await this.admin.fetchCatalogTuning(brand.name, car.name);
        this.workshopBrands.set(tRes.workshops);
      }
      this.closePartModal();
      this.showToast(`เพิ่มชิ้นส่วน "${name}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกพาร์ตล้มเหลว', 'error');
    }
  }

  readonly submitAddPart = (): Promise<void> => this.savePart();

  private showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3500);
  }
}
