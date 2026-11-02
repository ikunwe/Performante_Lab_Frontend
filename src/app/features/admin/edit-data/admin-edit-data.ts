import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingSkeleton } from '../../../shared/ui/loading-skeleton/loading-skeleton';
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
import { PartMaskUpload } from './part-mask-upload';
import { hasAutomaticPartClips } from '../../../core/catalog/part-clip-regions';
import { CatalogStorageHelper, StorageWorkshopItem } from '../../../core/storage/catalog-storage';

export interface DeleteTarget {
  type: 'brand' | 'car' | 'category' | 'tuningBrand' | 'part';
  id?: string;
  name: string;
  brandCount?: number;
  partCount?: number;
  category?: string;
  storagePath?: string;
  tab?: 'bodykit' | 'parts';
}

@Component({
  selector: 'app-admin-edit-data',
  imports: [CommonModule, FormsModule, Icon, LoadingSkeleton, PartMaskUpload],
  templateUrl: './admin-edit-data.html',
})
export class AdminEditData implements OnInit {
  readonly hasAutomaticPartClips = hasAutomaticPartClips;
  readonly auth = inject(AuthService);
  readonly admin = inject(AdminService);

  // 3-Level View Navigation State
  readonly level = signal<'brands' | 'models' | 'parts'>('brands');
  readonly selectedBrand = signal<RealBrandItem | null>(null);
  readonly selectedCar = signal<RealCarModelItem | null>(null);

  // Level 3 Architecture: Tabs & 3-Step Selection Flow
  readonly partTab = signal<'bodykit' | 'parts'>('bodykit');
  readonly partStep = signal<'category' | 'brand' | 'parts'>('category');

  readonly selectedCategory = signal<string>('Front Bumper');
  readonly availableCategories = signal<string[]>([
    'Front Bumper',
    'Rear Bumper',
    'Wheels',
    'Spoilers',
  ]);

  // Selected Tuning Brand: null = Step 1 (Brand Selection), string = Step 2 (Part Items)
  readonly selectedTuningBrand = signal<string | null>(null);

  // Search & Filter
  readonly brandSearchQuery = signal('');

  // คำนวณรายชื่อแบรนด์ที่กรองตามคำค้นหา
  readonly filteredBrands = computed(() => {
    const q = this.brandSearchQuery().trim().toLowerCase();
    if (!q) return this.admin.catalogBrands();
    return this.admin
      .catalogBrands()
      .filter((b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q));
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

  handleCarImageError(carId: string, event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src && !img.dataset['triedJpg'] && img.src.includes('.png')) {
      img.dataset['triedJpg'] = 'true';
      img.src = img.src.replace(/\.png(\?.*)?$/i, '.jpg$1');
      return;
    }
    this.onCarImageError(carId);
  }

  // Modals visibility
  readonly brandModalOpen = signal(false);
  readonly editBrandModalOpen = signal(false);
  readonly carModalOpen = signal(false);
  readonly editCarModalOpen = signal(false);
  readonly partModalOpen = signal(false);
  readonly editPartModalOpen = signal(false);
  readonly editingPart = signal<RealPartItem | null>(null);
  readonly editingPartName = signal('');
  readonly editingPartPrice = signal<number | null>(null);
  readonly editPartFile = signal<File | null>(null);
  readonly editPartFilePreview = signal<string | null>(null);
  readonly editPartAngleFiles = signal<Map<string, File>>(new Map());
  readonly editPartAnglePreviews = signal<Map<string, string>>(new Map());
  readonly existingPartAngleUrls = signal<Map<string, string>>(new Map());
  readonly tuningBrandModalOpen = signal(false);
  readonly editTuningBrandModalOpen = signal(false);
  readonly categoryModalOpen = signal(false);
  readonly confirmDeleteModalOpen = signal(false);

  // File state & preview for modals
  readonly selectedBrandFile = signal<File | null>(null);
  readonly brandFilePreview = signal<string | null>(null);

  readonly editBrandFile = signal<File | null>(null);
  readonly editBrandFilePreview = signal<string | null>(null);

  readonly selectedCarFile = signal<File | null>(null);
  readonly carFilePreview = signal<string | null>(null);

  readonly editCarFile = signal<File | null>(null);
  readonly editCarFilePreview = signal<string | null>(null);

  // Multi-angle Car Model files (4 angles: 45_front, front, 45_Back, Back)
  readonly carAngleFiles = signal<Map<string, File>>(new Map());
  readonly carAnglePreviews = signal<Map<string, string>>(new Map());

  readonly editCarAngleFiles = signal<Map<string, File>>(new Map());
  readonly editCarAnglePreviews = signal<Map<string, string>>(new Map());
  readonly existingCarAngleUrls = signal<Map<string, string>>(new Map());

  readonly carRequiredAngles = [
    { key: '45_front', label: '45 องศาหน้า' },
    { key: 'front', label: 'หน้าตรง' },
    { key: '45_Back', label: '45 องศาหลัง' },
    { key: 'Back', label: 'หลังตรง' },
  ];

  readonly selectedPartFile = signal<File | null>(null);
  readonly partFilePreview = signal<string | null>(null);

  // Multi-angle Part & BodyKit files
  readonly partAngleFiles = signal<Map<string, File>>(new Map());
  readonly partAnglePreviews = signal<Map<string, string>>(new Map());

  readonly selectedTuningBrandFile = signal<File | null>(null);
  readonly tuningBrandFilePreview = signal<string | null>(null);

  readonly editTuningBrandFile = signal<File | null>(null);
  readonly editTuningBrandFilePreview = signal<string | null>(null);

  readonly tuningBrandLogos = signal<Map<string, string>>(new Map());
  readonly workshopBrands = signal<{
    bodykit: StorageWorkshopItem[];
    parts: StorageWorkshopItem[];
  }>({ bodykit: [], parts: [] });

  // Uploading & Deleting state
  readonly isUploading = signal(false);
  readonly uploadProgressText = signal('');
  readonly isDeleting = signal(false);
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  // Form states: New Brand / Edit Brand
  readonly newBrandName = signal('');
  readonly editingBrandName = signal('');

  // Form states: New Car / Edit Car
  readonly newCarName = signal('');
  readonly editingCarName = signal('');

  // Form states: Tuning Brand & Edit Tuning Brand
  readonly newTuningBrandName = signal('');
  readonly editingTuningBrandName = signal('');
  readonly originalTuningBrandName = signal('');

  // Form states: Custom Category
  readonly newCustomCategoryName = signal('');

  // Form states: New Part
  readonly newPartCategory = signal('BodyKit');
  readonly newPartManufacturer = signal('');
  readonly newPartName = signal('');
  readonly newPartPrice = signal<number | null>(null);

  // Toast feedback
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  isBodyKitCategory(cat: string): boolean {
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

  // Level 3 BodyKit: Distinct Tuning Brands for current car
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

  // Level 3 Part: Distinct Tuning Brands for a specific part category
  tuningBrandsForPartCategory(category: string): string[] {
    const car = this.selectedCar();
    if (!car) return [];
    const cat = category.toLowerCase().replace(/[\s_-]+/g, '');

    const fromWorkshops = this.workshopBrands()
      .parts.filter((w) => !w.category || w.category.toLowerCase().replace(/[\s_-]+/g, '') === cat)
      .map((w) => w.name);
    const relevantParts = this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      if (!isMatchCar) return false;
      const pCat = (p.category || '').toLowerCase().replace(/[\s_-]+/g, '');
      return !this.isBodyKitCategory(p.category) && pCat === cat;
    });

    const fromParts = relevantParts.map((p) => (p.manufacturer || 'Custom').trim()).filter(Boolean);
    const combined = Array.from(new Set([...fromWorkshops, ...fromParts]));

    // กรองชื่อหมวดหมู่ออก เพื่อป้องกันไม่ให้หมวดอย่าง Spoilers, Front Bumper หลุดมาเป็นชื่อแบรนด์
    const invalidBrandNames = new Set([
      'frontbumper',
      'rearbumper',
      'wheels',
      'spoilers',
      'front-bumper',
      'rear-bumper',
      'bodykit',
      'fullbodykits',
    ]);
    return combined.filter((b) => !invalidBrandNames.has(b.toLowerCase().replace(/[\s_-]+/g, '')));
  }

  // Level 3 Part Step 2: Distinct Tuning Brands for current car & selected part category
  readonly tuningBrandsForCurrentPartCategory = computed(() => {
    return this.tuningBrandsForPartCategory(this.selectedCategory());
  });

  // Level 3 Step 2 / Step 3: Part Items for the selected tuning brand in BodyKit tab
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

  // Level 3 Part Step 3: Real Part Items for current car, category, and tuning brand
  readonly partsForSelectedPartBrandAndCategory = computed(() => {
    const car = this.selectedCar();
    const brandName = this.selectedTuningBrand();
    const cat = this.selectedCategory()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    if (!car || !brandName) return [];

    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      const isMatchBrand = (p.manufacturer || 'Custom').toLowerCase() === brandName.toLowerCase();
      const pCat = (p.category || '').toLowerCase().replace(/[\s_-]+/g, '');
      const isMatchCategory = !this.isBodyKitCategory(p.category) && pCat === cat;
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

  async ngOnInit(): Promise<void> {
    await this.admin.fetchCatalogBrands();
  }

  // Navigation Methods
  async selectBrand(brand: RealBrandItem): Promise<void> {
    this.selectedBrand.set(brand);
    this.selectedCar.set(null);
    this.selectedTuningBrand.set(null);
    this.level.set('models');
    await this.admin.fetchCatalogModels(this.brandFolder(brand) || brand.id);
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
    this.partStep.set('category');
    this.level.set('parts');
    const brandName = this.brandFolder(this.selectedBrand());
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
    this.partStep.set('category');
  }

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.selectedTuningBrand.set(null);
    this.partStep.set('brand');
  }

  selectPartCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.selectedTuningBrand.set(null);
    this.partStep.set('brand');
  }

  backToPartCategories(): void {
    this.selectedTuningBrand.set(null);
    this.partStep.set('category');
  }

  selectPartTuningBrand(brand: string): void {
    this.selectedTuningBrand.set(brand);
    this.partStep.set('parts');
  }

  backToPartBrands(): void {
    this.selectedTuningBrand.set(null);
    this.partStep.set('brand');
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

    this.workshopBrands.update((wb) => {
      const tabKey = this.partTab();
      const existing = wb[tabKey] || [];
      if (!existing.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
        return {
          ...wb,
          [tabKey]: [...existing, { name, logoUrl: '' }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        };
      }
      return wb;
    });

    this.selectedTuningBrand.set(name);
    if (this.partTab() === 'parts') {
      this.partStep.set('parts');
    }
    this.closeTuningBrandModal();
    this.showToast(`เพิ่มแบรนด์ "${name}" เรียบร้อยแล้ว`, 'success');
  }

  // Edit Tuning Brand Modal Handlers
  openEditTuningBrandModal(brandName: string): void {
    this.editingTuningBrandName.set(this.tuningBrandLabel(brandName));
    this.originalTuningBrandName.set(brandName);
    this.editTuningBrandFile.set(null);
    this.editTuningBrandFilePreview.set(null);
    this.editTuningBrandModalOpen.set(true);
  }

  closeEditTuningBrandModal(): void {
    this.editTuningBrandModalOpen.set(false);
  }

  onEditTuningBrandFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editTuningBrandFile.set(file);
        this.editTuningBrandFilePreview.set(preview);
      });
    }
  }

  private workshopFor(name: string): StorageWorkshopItem | undefined {
    const normalized = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '');
    const current = normalized(this.selectedCategory());
    return this.workshopBrands()[this.partTab()].find(
      (w) => w.name === name && (!w.category || normalized(w.category) === current),
    );
  }
  tuningBrandLabel(name: string | null | undefined): string {
    return name ? this.workshopFor(name)?.displayName || name : '';
  }
  async saveEditTuningBrand(): Promise<void> {
    if (this.isUploading()) return;
    const oldName = this.originalTuningBrandName().trim(),
      newName = this.editingTuningBrandName().trim();
    const brand = this.selectedBrand(),
      car = this.selectedCar(),
      tab = this.partTab();
    if (!oldName || !newName || !brand || !car) {
      this.showToast('กรุณาระบุชื่อแบรนด์และรุ่นรถ', 'error');
      return;
    }
    if (
      this.workshopBrands()[tab].some(
        (w) =>
          w.name !== oldName &&
          (w.displayName || w.name).toLowerCase() === newName.toLowerCase() &&
          (!w.category || w.category === this.selectedCategory()),
      )
    ) {
      this.showToast('มีชื่อแบรนด์นี้แล้วในหมวดนี้', 'error');
      return;
    }
    const workshop = this.workshopFor(oldName);
    const safe = (name: string) => CatalogStorageHelper.sanitize(name);
    const category = this.selectedCategory();
    const folder =
      workshop?.storagePath ||
      `${safe(this.brandFolder(brand))}/${safe(car.name)}/${tab === 'bodykit' ? 'BodyKit' : 'Part/' + safe(category)}/${safe(oldName)}`;
    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลแบรนด์...');
    try {
      const client = await this.admin.getClient();
      if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
      const result = await CatalogStorageHelper.saveWorkshopProfile(
        client,
        folder,
        newName,
        this.editTuningBrandFile(),
      );
      if (!result.ok) throw new Error(result.error || 'บันทึกแบรนด์ไม่สำเร็จ');
      const profile = await CatalogStorageHelper.readWorkshopProfile(client, folder);
      const updated: StorageWorkshopItem = {
        name: oldName,
        storagePath: folder,
        category: tab === 'parts' ? category : undefined,
        ...profile,
        displayName: newName,
      };
      this.workshopBrands.update((wb) => ({
        ...wb,
        [tab]: workshop
          ? wb[tab].map((w) => (w === workshop ? updated : w))
          : [...wb[tab], updated],
      }));
      // Physical manufacturer keys and all part paths remain unchanged.
      this.closeEditTuningBrandModal();
      this.showToast(`แก้ไขข้อมูลแบรนด์ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (error: any) {
      this.showToast(`แก้ไขล้มเหลว: ${error?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }

  // Delete Confirmation Safeguard Handlers
  confirmDeleteBrand(brand: RealBrandItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.deleteTarget.set({
      type: 'brand',
      id: brand.id,
      name: brand.name,
    });
    this.confirmDeleteModalOpen.set(true);
  }

  confirmDeleteCar(car: RealCarModelItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.deleteTarget.set({
      type: 'car',
      id: car.id,
      name: car.name,
    });
    this.confirmDeleteModalOpen.set(true);
  }

  confirmDeleteCategory(category: string, event?: Event): void {
    if (event) event.stopPropagation();
    const brandCount = this.getBrandsCountForCategory(category);
    const partCount = this.getPartsCountForCategory(category);
    this.deleteTarget.set({
      type: 'category',
      name: category,
      brandCount,
      partCount,
      category,
    });
    this.confirmDeleteModalOpen.set(true);
  }

  confirmDeleteTuningBrand(brandName: string, event?: Event): void {
    if (event) event.stopPropagation();
    const isBodyKit = this.partTab() === 'bodykit';
    const partCount = isBodyKit
      ? this.getPartsCountForBodyKitBrand(brandName)
      : this.getPartsCountForBrandAndCategory(brandName, this.selectedCategory());

    this.deleteTarget.set({
      type: 'tuningBrand',
      name: brandName,
      partCount,
      tab: this.partTab(),
      category: isBodyKit ? 'BodyKit' : this.selectedCategory(),
    });
    this.confirmDeleteModalOpen.set(true);
  }

  confirmDeletePart(part: RealPartItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.deleteTarget.set({
      type: 'part',
      id: part.id,
      name: part.name,
      storagePath: part.image_url || part.image,
    });
    this.confirmDeleteModalOpen.set(true);
  }

  closeConfirmDeleteModal(): void {
    if (this.isDeleting()) return;
    this.confirmDeleteModalOpen.set(false);
    this.deleteTarget.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    const car = this.selectedCar();
    const brand = this.selectedBrand();
    if (!target) return;

    this.isDeleting.set(true);

    try {
      if (target.type === 'brand') {
        const res = await this.admin.deleteCarBrand(target.id || '', target.name);
        if (res.ok) {
          if (this.selectedBrand()?.name.toLowerCase() === target.name.toLowerCase()) {
            this.selectedBrand.set(null);
            this.level.set('brands');
          }
          this.closeEditBrandModal();
          this.showToast(`ลบแบรนด์ "${target.name}" เรียบร้อยแล้ว`, 'success');
        } else {
          this.showToast(res.error || 'ลบแบรนด์ล้มเหลว', 'error');
        }
      } else if (target.type === 'car') {
        const brandName = this.brandFolder(brand);
        const res = await this.admin.deleteCarModel(target.id || '', brandName, target.name);
        if (res.ok) {
          if (this.selectedCar()?.name.toLowerCase() === target.name.toLowerCase()) {
            this.selectedCar.set(null);
            this.level.set('models');
          }
          this.closeEditCarModal();
          this.showToast(`ลบรุ่นรถ "${target.name}" เรียบร้อยแล้ว`, 'success');
        } else {
          this.showToast(res.error || 'ลบรุ่นรถล้มเหลว', 'error');
        }
      } else if (target.type === 'category') {
        const carName = car?.name || '';
        const res = await this.admin.deletePartCategory(target.name, carName);
        if (res.ok) {
          this.availableCategories.update((cats) =>
            cats.filter((c) => c.toLowerCase() !== target.name.toLowerCase()),
          );
          if (this.selectedCategory().toLowerCase() === target.name.toLowerCase()) {
            const nextCat = this.availableCategories()[0] || 'Wheels';
            this.selectedCategory.set(nextCat);
          }
          this.showToast(`ลบหมวดหมู่ "${target.name}" เรียบร้อยแล้ว`, 'success');
        } else {
          this.showToast(res.error || 'ลบหมวดหมู่ล้มเหลว', 'error');
        }
      } else if (target.type === 'tuningBrand') {
        const carName = car?.name || '';
        const brandName = this.brandFolder(brand);
        const tab = target.tab || this.partTab();
        const res = await this.admin.deleteTuningBrand(
          brandName,
          carName,
          tab,
          target.name,
          target.category,
        );
        if (res.ok) {
          this.workshopBrands.update((wb) => ({
            ...wb,
            [tab]: wb[tab].filter((w) => w.name.toLowerCase() !== target.name.toLowerCase()),
          }));
          if (this.selectedTuningBrand()?.toLowerCase() === target.name.toLowerCase()) {
            this.selectedTuningBrand.set(null);
          }
          this.showToast(`ลบแบรนด์ "${target.name}" เรียบร้อยแล้ว`, 'success');
        } else {
          this.showToast(res.error || 'ลบแบรนด์ล้มเหลว', 'error');
        }
      } else if (target.type === 'part' && target.id) {
        const carName = car?.name || '';
        const res = await this.admin.deletePartItem(
          target.id,
          target.storagePath,
          target.name,
          carName,
        );
        if (res.ok) {
          this.showToast(`ลบชิ้นส่วน "${target.name}" เรียบร้อยแล้ว`, 'success');
        } else {
          this.showToast(res.error || 'ลบชิ้นส่วนล้มเหลว', 'error');
        }
      }
    } catch (err: any) {
      this.showToast(`เกิดข้อผิดพลาดในการลบ: ${err?.message || 'Delete error'}`, 'error');
    } finally {
      this.isDeleting.set(false);
      this.confirmDeleteModalOpen.set(false);
      this.deleteTarget.set(null);
    }
  }

  // Category counts & Icon helpers
  getBrandsCountForCategory(category: string): number {
    const car = this.selectedCar();
    if (!car) return 0;
    const cat = category.toLowerCase();
    const brands = new Set<string>();
    for (const p of this.admin.catalogParts()) {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      if (isMatchCar && !this.isBodyKitCategory(p.category) && p.category.toLowerCase() === cat) {
        if (p.manufacturer) brands.add(p.manufacturer.trim());
      }
    }
    return brands.size;
  }

  getPartsCountForCategory(category: string): number {
    const car = this.selectedCar();
    if (!car) return 0;
    const cat = category.toLowerCase();
    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      return isMatchCar && !this.isBodyKitCategory(p.category) && p.category.toLowerCase() === cat;
    }).length;
  }

  getPartsCountForBrandAndCategory(brandName: string, category: string): number {
    const car = this.selectedCar();
    if (!car) return 0;
    const cat = category.toLowerCase();
    const bName = brandName.toLowerCase();
    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      const isMatchBrand = (p.manufacturer || 'Custom').toLowerCase() === bName;
      return (
        isMatchCar &&
        isMatchBrand &&
        !this.isBodyKitCategory(p.category) &&
        p.category.toLowerCase() === cat
      );
    }).length;
  }

  getPartsCountForBodyKitBrand(brandName: string): number {
    const car = this.selectedCar();
    if (!car) return 0;
    const bName = brandName.toLowerCase();
    return this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      const isMatchBrand = (p.manufacturer || 'Custom').toLowerCase() === bName;
      return isMatchCar && isMatchBrand && this.isBodyKitCategory(p.category);
    }).length;
  }

  getCategoryIcon(category: string): string {
    const c = category.toLowerCase().replace(/[\s_-]+/g, '');
    if (c === 'frontbumper') return 'front';
    if (c === 'rearbumper') return 'rear';
    if (c === 'wheels') return 'wheel';
    if (c === 'spoilers') return 'car';
    return 'parts';
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

  brandFolder(brand: RealBrandItem | null | undefined): string {
    return brand?.storagePath || brand?.name || '';
  }
  async saveEditBrand(): Promise<void> {
    if (this.isUploading()) return;
    const brand = this.selectedBrand(),
      newName = this.editingBrandName().trim();
    if (!brand) return;
    if (!newName) {
      this.showToast('กรุณากรอกชื่อแบรนด์', 'error');
      return;
    }
    if (
      this.admin
        .catalogBrands()
        .some((b) => b.id !== brand.id && b.name.toLowerCase() === newName.toLowerCase())
    ) {
      this.showToast('มีชื่อแบรนด์นี้แล้ว', 'error');
      return;
    }
    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลแบรนด์...');
    try {
      const client = await this.admin.getClient();
      if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
      const folder = this.brandFolder(brand);
      const result = await CatalogStorageHelper.saveBrandProfile(
        client,
        folder,
        newName,
        this.editBrandFile(),
      );
      if (!result.ok || !result.url) throw new Error(result.error || 'บันทึกแบรนด์ไม่สำเร็จ');
      const logoUrl = result.url + '?v=' + Date.now();
      const updated = { ...brand, storagePath: folder, name: newName, logo_url: logoUrl, logoUrl };
      this.selectedBrand.set(updated);
      this.admin.catalogBrands.update((rows) => rows.map((b) => (b.id === brand.id ? updated : b)));
      this.failedBrandLogos.update((set) => {
        const next = new Set(set);
        next.delete(brand.id);
        return next;
      });
      await this.admin.fetchCatalogBrands();
      this.closeEditBrandModal();
      this.showToast(`แก้ไขข้อมูลแบรนด์ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (error: any) {
      this.showToast(`แก้ไขล้มเหลว: ${error?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }

  // Edit Car Model Modal Handlers
  async openEditCarModal(car: RealCarModelItem | null): Promise<void> {
    if (!car) return;
    this.editingCarName.set(car.name);
    this.editCarFile.set(null);
    this.editCarFilePreview.set(null);
    this.editCarAngleFiles.set(new Map());
    this.editCarAnglePreviews.set(new Map());
    this.existingCarAngleUrls.set(new Map());
    this.editCarModalOpen.set(true);

    try {
      const client = await this.admin.getClient();
      const brand = this.selectedBrand();
      const brandName = this.brandFolder(brand) || car.brand_id || car.brandId || '';
      if (client && brandName && car.name) {
        const safeBrand = CatalogStorageHelper.sanitize(brandName);
        const safeCar = CatalogStorageHelper.sanitize(car.name);
        const folder = `${safeBrand}/${safeCar}`;
        const { data: files } = await client.storage.from('catalog').list(folder, { limit: 50 });
        if (files) {
          const map = new Map<string, string>();
          const now = Date.now();
          for (const angle of this.carRequiredAngles) {
            const regex = new RegExp(`^${angle.key}\\.(png|jpe?g|webp)$`, 'i');
            const match = files.find((f) => regex.test(f.name));
            if (match) {
              const url = CatalogStorageHelper.getPublicUrl(client, `${folder}/${match.name}`);
              map.set(angle.key, `${url}?t=${now}`);
            }
          }
          this.existingCarAngleUrls.set(map);
        }
      }
    } catch (err) {
      console.warn('[AdminEditData] openEditCarModal fetch angles warning:', err);
    }
  }

  closeEditCarModal(): void {
    this.editCarAngleFiles.set(new Map());
    this.editCarAnglePreviews.set(new Map());
    this.existingCarAngleUrls.set(new Map());
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

      const angleFiles = this.editCarAngleFiles();
      const singleFile = this.editCarFile();

      if (angleFiles.size > 0 && client) {
        for (const [angleKey, file] of angleFiles.entries()) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const folderPath = `${this.brandFolder(brand)}/${newName}`;
          await CatalogStorageHelper.removeSiblingFiles(client, folderPath, angleKey, ext);
          const path = CatalogStorageHelper.getCarAnglePath(
            this.brandFolder(brand),
            newName,
            angleKey,
            ext,
          );
          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            if (angleKey === '45_front' || !imageUrl) {
              imageUrl = res.url;
            }
          }
        }
      } else if (singleFile && client) {
        const ext = CatalogStorageHelper.getFileExtension(singleFile);
        const folderPath = `${this.brandFolder(brand)}/${newName}`;
        await CatalogStorageHelper.removeSiblingFiles(client, folderPath, '45_front', ext);
        const path = CatalogStorageHelper.getCarAnglePath(
          this.brandFolder(brand),
          newName,
          '45_front',
          ext,
        );
        const res = await CatalogStorageHelper.uploadFile(client, path, singleFile);
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

      await this.admin.fetchCatalogModels(this.brandFolder(brand) || brand.id);
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

  onCarAngleFileChange(angleKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.carAngleFiles.update((map) => {
          const next = new Map(map);
          next.set(angleKey, file);
          return next;
        });
        this.carAnglePreviews.update((map) => {
          const next = new Map(map);
          next.set(angleKey, preview);
          return next;
        });
      });
    }
  }

  onEditCarAngleFileChange(angleKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editCarAngleFiles.update((map) => {
          const next = new Map(map);
          next.set(angleKey, file);
          return next;
        });
        this.editCarAnglePreviews.update((map) => {
          const next = new Map(map);
          next.set(angleKey, preview);
          return next;
        });
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
          await CatalogStorageHelper.removeSiblingFiles(client, name, 'logo', ext);
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

  // Car Modal Handlers (Streamlined Multi-Angle)
  openCarModal(): void {
    this.newCarName.set('');
    this.selectedCarFile.set(null);
    this.carFilePreview.set(null);
    this.carAngleFiles.set(new Map());
    this.carAnglePreviews.set(new Map());
    this.carModalOpen.set(true);
  }

  closeCarModal(): void {
    this.carAngleFiles.set(new Map());
    this.carAnglePreviews.set(new Map());
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

    const angleFiles = this.carAngleFiles();
    const singleFile = this.selectedCarFile();

    // Fallback: รองรับ single file (เช่น จาก test เดิม) โดยกระจายให้ครบ 4 มุม
    if (angleFiles.size === 0 && singleFile) {
      for (const req of this.carRequiredAngles) {
        angleFiles.set(req.key, singleFile);
      }
    }

    if (angleFiles.size === 0 && !singleFile) {
      this.showToast('กรุณาอัปโหลดรูปภาพรถต้นแบบให้ครบ 4 มุมมอง', 'error');
      return;
    }

    for (const req of this.carRequiredAngles) {
      if (!angleFiles.has(req.key)) {
        this.showToast(`กรุณาอัปโหลดรูปภาพมุม "${req.label}" ให้ครบถ้วน`, 'error');
        return;
      }
    }

    let primaryImageUrl = '';
    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปโหลดรูปภาพรถทั้ง 4 มุมมอง...');

    try {
      const client = await this.admin.getClient();
      if (client) {
        for (const req of this.carRequiredAngles) {
          const file = angleFiles.get(req.key)!;
          const ext = CatalogStorageHelper.getFileExtension(file);
          const folderPath = `${this.brandFolder(brand)}/${name}`;
          await CatalogStorageHelper.removeSiblingFiles(client, folderPath, req.key, ext);
          const path = CatalogStorageHelper.getCarAnglePath(
            this.brandFolder(brand),
            name,
            req.key,
            ext,
          );
          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            if (req.key === '45_front' || !primaryImageUrl) {
              primaryImageUrl = res.url;
            }
          } else {
            throw new Error(res.error || `Upload angle ${req.key} failed`);
          }
        }
      }
    } catch (err: any) {
      this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
      this.isUploading.set(false);
      return;
    } finally {
      this.isUploading.set(false);
    }

    const modelId = `${CatalogStorageHelper.sanitize(this.brandFolder(brand))}-${CatalogStorageHelper.sanitize(name)}`;
    const newCarModelItem: RealCarModelItem = {
      id: modelId,
      brand_id: this.brandFolder(brand) || brand.id,
      brandId: this.brandFolder(brand) || brand.id,
      name,
      slug: CatalogStorageHelper.sanitize(name).toLowerCase(),
      image_url: primaryImageUrl || this.carFilePreview() || '',
      image: primaryImageUrl || this.carFilePreview() || '',
      body_type: 'Coupe',
      bodyType: 'Coupe',
    };

    // Optimistic Update ทันทีเพื่อให้แสดงผลการ์ดรถรุ่นใหม่บน Frontend ทันที
    this.admin.catalogModels.update((list) => {
      if (!list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return [...list, newCarModelItem];
      }
      return list;
    });

    const res = await this.admin.insertCarModel({
      brand_id: this.brandFolder(brand) || brand.id,
      name,
      image_url: primaryImageUrl || this.carFilePreview() || '',
      body_type: 'Coupe',
    });
    if (res.ok) {
      this.admin.fetchCatalogModels(this.brandFolder(brand) || brand.id);
      this.closeCarModal();
      this.showToast(`เพิ่มรุ่นรถ "${name}" พร้อม 4 มุมมอง สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกรุ่นรถล้มเหลว', 'error');
    }
  }

  getExistingPartAngleUrl(part: RealPartItem | null, angleKey: string): string {
    const fetched = this.existingPartAngleUrls().get(angleKey);
    if (fetched) return fetched;

    if (!part) return '';
    const baseImg = part.image || part.image_url || '';
    if (!baseImg) return '';

    const angleRegex = /\/(45_front|front|45_Back|Back)\.([a-zA-Z0-9]+)(\?.*)?$/i;
    if (angleRegex.test(baseImg)) {
      return baseImg.replace(angleRegex, `/${angleKey}.$2$3`);
    }

    return baseImg;
  }

  getExistingCarAngleUrl(car: RealCarModelItem | null, angleKey: string): string {
    const fetched = this.existingCarAngleUrls().get(angleKey);
    if (fetched) return fetched;

    if (!car) return '';
    const baseImg = car.image || car.image_url || '';
    if (!baseImg) return '';

    const brand = this.selectedBrand();
    const brandName = this.brandFolder(brand) || car.brand_id || car.brandId || '';
    const carName = car.name;

    const angleRegex = /\/(45_front|front|45_Back|Back|CarPicture)\.([a-zA-Z0-9]+)(\?.*)?$/i;
    const match = baseImg.match(angleRegex);
    const ext = match ? match[2] : 'png';

    const marker = '/catalog/';
    const idx = baseImg.indexOf(marker);
    if (idx !== -1 && brandName && carName) {
      const rootUrl = baseImg.substring(0, idx + marker.length);
      const safeBrand = CatalogStorageHelper.sanitize(brandName);
      const safeCar = CatalogStorageHelper.sanitize(carName);
      return `${rootUrl}${safeBrand}/${safeCar}/${angleKey}.${ext}`;
    }

    if (match) {
      return baseImg.replace(angleRegex, `/${angleKey}.$2`);
    }

    return baseImg;
  }

  readonly submitAddCar = (): Promise<void> => this.saveCar();

  getRequiredAngles(catParam?: string): { key: string; label: string }[] {
    const rawCat =
      catParam ||
      (this.partTab() === 'bodykit'
        ? 'bodykit'
        : this.newPartCategory() || this.selectedCategory());
    const cat = (rawCat || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (
      cat === 'bodykit' ||
      cat === 'fullbodykits' ||
      cat === 'bodykits' ||
      cat === 'fullbodykit'
    ) {
      return [
        { key: '45_front', label: '45 องศาหน้า' },
        { key: 'front', label: 'หน้าตรง' },
        { key: '45_Back', label: '45 องศาหลัง' },
        { key: 'Back', label: 'หลังตรง' },
      ];
    }
    const c = cat;
    if (c === 'frontbumper' || c === 'front' || c === 'frontbumpers') {
      return [
        { key: '45_front', label: '45 องศาหน้า' },
        { key: 'front', label: 'หน้าตรง' },
      ];
    }
    if (c === 'rearbumper' || c === 'rear' || c === 'rearbumpers') {
      return [
        { key: '45_Back', label: '45 องศาหลัง' },
        { key: 'Back', label: 'หลังตรง' },
      ];
    }
    if (c === 'wheels' || c === 'wheel') {
      return [
        { key: '45_front', label: '45 องศาหน้า' },
        { key: '45_Back', label: '45 องศาหลัง' },
      ];
    }
    if (c === 'spoilers' || c === 'spoiler') {
      return [
        { key: '45_front', label: '45 องศาหน้า' },
        { key: '45_Back', label: '45 องศาหลัง' },
        { key: 'Back', label: 'หลังตรง' },
      ];
    }
    return [
      { key: '45_front', label: '45 องศาหน้า' },
      { key: 'front', label: 'หน้าตรง' },
    ];
  }

  onPartAngleFileChange(angleKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.partAngleFiles.update((map) => {
          const next = new Map(map);
          next.set(angleKey, file);
          return next;
        });
        this.partAnglePreviews.update((map) => {
          const next = new Map(map);
          next.set(angleKey, preview);
          return next;
        });
      });
    }
  }

  // Part Modal Handlers (Multi-Angle Integration)
  openPartModal(): void {
    const currentCat = this.partTab() === 'bodykit' ? 'FullBodyKits' : this.selectedCategory();
    this.newPartCategory.set(currentCat);
    this.newPartManufacturer.set(this.selectedTuningBrand() || 'Custom');
    this.newPartName.set('');
    this.newPartPrice.set(null);
    this.selectedPartFile.set(null);
    this.partFilePreview.set(null);
    this.partAngleFiles.set(new Map());
    this.partAnglePreviews.set(new Map());
    this.partModalOpen.set(true);
  }

  closePartModal(): void {
    this.partAngleFiles.set(new Map());
    this.partAnglePreviews.set(new Map());
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
    const category = isBodyKit ? 'FullBodyKits' : this.selectedCategory();

    const requiredAngles = this.getRequiredAngles();
    const angleFiles = this.partAngleFiles();

    // Support single file fallback (e.g. from tests or simplified upload)
    if (angleFiles.size === 0 && this.selectedPartFile()) {
      for (const req of requiredAngles) {
        angleFiles.set(req.key, this.selectedPartFile()!);
      }
    }

    if (angleFiles.size === 0 && !this.selectedPartFile()) {
      this.showToast('กรุณาอัปโหลดรูปภาพชิ้นส่วน', 'error');
      return;
    }

    for (const req of requiredAngles) {
      if (!angleFiles.has(req.key)) {
        this.showToast(`กรุณาอัปโหลดรูปภาพมุม "${req.label}" ให้ครบถ้วน`, 'error');
        return;
      }
    }

    let primaryImageUrl = '';
    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปโหลดรูปภาพแต่ละมุมมอง...');

    try {
      const client = await this.admin.getClient();
      const brandName = this.brandFolder(brand) || 'Universal';

      for (const req of requiredAngles) {
        const file = angleFiles.get(req.key)!;
        const ext = CatalogStorageHelper.getFileExtension(file);

        const folderPath = isBodyKit
          ? `${brandName}/${car.name}/BodyKit/${tuningBrand}/${name}`
          : `${brandName}/${car.name}/Part/${category}/${tuningBrand}/${name}`;

        if (client) {
          await CatalogStorageHelper.removeSiblingFiles(client, folderPath, req.key, ext);
          const path = isBodyKit
            ? CatalogStorageHelper.getBodyKitAnglePath(
                brandName,
                car.name,
                tuningBrand,
                name,
                req.key,
                ext,
              )
            : CatalogStorageHelper.getPartAnglePath(
                brandName,
                car.name,
                category,
                tuningBrand,
                name,
                req.key,
                ext,
              );

          const res = await CatalogStorageHelper.uploadFile(client, path, file);
          if (res.ok && res.url) {
            if (!primaryImageUrl) primaryImageUrl = res.url;
          } else {
            throw new Error(res.error || `Upload angle ${req.key} failed`);
          }
        }
      }
    } catch (err: any) {
      this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
      this.isUploading.set(false);
      return;
    } finally {
      this.isUploading.set(false);
    }

    const price = this.newPartPrice() ?? 0;
    const res = await this.admin.insertCarPart({
      car_model_id: car.id,
      category,
      name,
      manufacturer: tuningBrand,
      image_url: primaryImageUrl,
      price,
    });
    if (res.ok) {
      // Ensure tuning brand exists in workshopBrands list immediately
      this.workshopBrands.update((wb) => {
        const tabKey = isBodyKit ? 'bodykit' : 'parts';
        const existing = wb[tabKey];
        if (!existing.some((w) => w.name.toLowerCase() === tuningBrand.toLowerCase())) {
          return {
            ...wb,
            [tabKey]: [...existing, { name: tuningBrand, logoUrl: '' }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          };
        }
        return wb;
      });

      // Ensure newly created part is reactive and card appears immediately without page reload
      if (res.data) {
        this.admin.catalogParts.update((parts) => {
          if (!parts.some((p) => p.id === res.data!.id)) {
            return [...parts, res.data!];
          }
          return parts;
        });
      }

      // Background sync
      if (brand && car) {
        this.admin.fetchCatalogTuning(this.brandFolder(brand), car.name).then((tRes) => {
          this.workshopBrands.set(tRes.workshops);
        });
      }
      this.closePartModal();
      this.showToast(`เพิ่มชิ้นส่วน "${name}" พร้อมมุมมองครบถ้วน สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกพาร์ตล้มเหลว', 'error');
    }
  }

  readonly submitAddPart = (): Promise<void> => this.savePart();

  // Edit Part Modal Handlers
  readonly existingPartMasks = signal(new Map<string, string>());
  readonly existingPartLayers = signal(new Map<string, string>());
  readonly maskDefaultViews = signal(new Map<string, string>());
  setPartLayer(angle: string, url: string): void {
    this.existingPartLayers.update((current) => {
      const next = new Map(current);
      next.set(angle, url);
      return next;
    });
  }
  setPartMask(angle: string, url: string): void {
    this.existingPartMasks.update((current) => {
      const next = new Map(current);
      if (url) next.set(angle, url);
      else next.delete(angle);
      return next;
    });
  }
  async openEditPartModal(part: RealPartItem): Promise<void> {
    this.editingPart.set(part);
    this.editingPartName.set(part.name);
    this.editingPartPrice.set(part.price ?? null);
    this.editPartFile.set(null);
    this.editPartFilePreview.set(part.image || part.image_url || null);
    this.editPartAngleFiles.set(new Map());
    this.editPartAnglePreviews.set(new Map());
    this.existingPartAngleUrls.set(new Map());
    this.existingPartMasks.set(new Map());
    this.existingPartLayers.set(new Map());
    this.maskDefaultViews.set(new Map());
    this.editPartModalOpen.set(true);

    try {
      const client = await this.admin.getClient();
      const brand = this.selectedBrand();
      const car = this.selectedCar();
      const brandName = this.brandFolder(brand) || 'Universal';
      const carName = car?.name || 'Universal';
      const isBodyKit = this.isBodyKitCategory(part.category);
      const tuningBrand = part.manufacturer || this.selectedTuningBrand() || 'Custom';
      const category = part.category;

      const folder = isBodyKit
        ? `${CatalogStorageHelper.sanitize(brandName)}/${CatalogStorageHelper.sanitize(carName)}/BodyKit/${CatalogStorageHelper.sanitize(tuningBrand)}/${CatalogStorageHelper.sanitize(part.name)}`
        : `${CatalogStorageHelper.sanitize(brandName)}/${CatalogStorageHelper.sanitize(carName)}/Part/${CatalogStorageHelper.sanitize(category)}/${CatalogStorageHelper.sanitize(tuningBrand)}/${CatalogStorageHelper.sanitize(part.name)}`;

      if (client) {
        const defaultFolder = `${CatalogStorageHelper.sanitize(brandName)}/${CatalogStorageHelper.sanitize(carName)}`;
        const [{ data: files }, { data: defaults }] = await Promise.all([
          client.storage.from('catalog').list(folder, { limit: 50 }),
          client.storage.from('catalog').list(defaultFolder, { limit: 50 }),
        ]);
        if (this.editingPart()?.id !== part.id) return;
        if (defaults) {
          const views = new Map<string, string>();
          for (const angle of this.getRequiredAngles(category)) {
            const match = defaults.find((f) =>
              new RegExp('^' + angle.key + '\\.(png|jpe?g|webp)$', 'i').test(f.name),
            );
            if (match)
              views.set(
                angle.key,
                CatalogStorageHelper.getPublicUrl(client, `${defaultFolder}/${match.name}`) +
                  '?t=' +
                  Date.now(),
              );
          }
          this.maskDefaultViews.set(views);
        }
        if (files) {
          const map = new Map<string, string>();
          const now = Date.now();
          const requiredAngles = this.getRequiredAngles(category);
          for (const angle of requiredAngles) {
            const regex = new RegExp(`^${angle.key}\\.(png|jpe?g|webp)$`, 'i');
            const layer = files.find(
              (f) => f.name.toLowerCase() === (angle.key + '.layer.png').toLowerCase(),
            );
            if (layer)
              this.setPartLayer(
                angle.key,
                CatalogStorageHelper.getPublicUrl(client, `${folder}/${layer.name}`) + '?t=' + now,
              );
            const mask = files.find(
              (f) => f.name.toLowerCase() === (angle.key + '.mask.png').toLowerCase(),
            );
            if (mask)
              this.setPartMask(
                angle.key,
                CatalogStorageHelper.getPublicUrl(client, `${folder}/${mask.name}`) + '?t=' + now,
              );
            const match = files.find((f) => regex.test(f.name));
            if (match) {
              const url = CatalogStorageHelper.getPublicUrl(client, `${folder}/${match.name}`);
              map.set(angle.key, `${url}?t=${now}`);
            }
          }
          this.existingPartAngleUrls.set(map);
        }
      }
    } catch (err) {
      console.warn('[AdminEditData] openEditPartModal fetch angles warning:', err);
    }
  }

  closeEditPartModal(): void {
    this.editPartModalOpen.set(false);
    this.editingPart.set(null);
    this.editPartFile.set(null);
    this.editPartFilePreview.set(null);
    this.editPartAngleFiles.set(new Map());
    this.editPartAnglePreviews.set(new Map());
    this.existingPartAngleUrls.set(new Map());
    this.existingPartMasks.set(new Map());
    this.existingPartLayers.set(new Map());
    this.maskDefaultViews.set(new Map());
  }

  onEditPartFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editPartFile.set(file);
        this.editPartFilePreview.set(preview);
      });
    }
  }

  onEditPartAngleFileChange(angleKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndPreview(file, (preview) => {
        this.editPartAngleFiles.update((map) => {
          const next = new Map(map);
          next.set(angleKey, file);
          return next;
        });
        this.editPartAnglePreviews.update((map) => {
          const next = new Map(map);
          next.set(angleKey, preview);
          return next;
        });
      });
    }
  }

  async saveEditPart(): Promise<void> {
    const part = this.editingPart();
    const brand = this.selectedBrand();
    const car = this.selectedCar();
    if (!part) return;

    const newName = this.editingPartName().trim();
    if (!newName) {
      this.showToast('กรุณากรอกชื่อชิ้นส่วน', 'error');
      return;
    }

    const brandName = this.brandFolder(brand) || 'Universal';
    const carName = car?.name || 'Universal';
    const isBodyKit = this.isBodyKitCategory(part.category);
    const tuningBrand = part.manufacturer || this.selectedTuningBrand() || 'Custom';
    const category = part.category;

    let imageUrl = part.image || part.image_url || '';
    const angleFiles = this.editPartAngleFiles();
    const singleFile = this.editPartFile();

    if (angleFiles.size > 0 || singleFile) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดรูปภาพใหม่...');
      try {
        const client = await this.admin.getClient();

        if (angleFiles.size > 0) {
          for (const [angleKey, file] of angleFiles.entries()) {
            const ext = CatalogStorageHelper.getFileExtension(file);
            const folderPath = isBodyKit
              ? `${brandName}/${carName}/BodyKit/${tuningBrand}/${newName}`
              : `${brandName}/${carName}/Part/${category}/${tuningBrand}/${newName}`;

            if (client) {
              await CatalogStorageHelper.removeSiblingFiles(client, folderPath, angleKey, ext);
              const path = isBodyKit
                ? CatalogStorageHelper.getBodyKitAnglePath(
                    brandName,
                    carName,
                    tuningBrand,
                    newName,
                    angleKey,
                    ext,
                  )
                : CatalogStorageHelper.getPartAnglePath(
                    brandName,
                    carName,
                    category,
                    tuningBrand,
                    newName,
                    angleKey,
                    ext,
                  );

              const res = await CatalogStorageHelper.uploadFile(client, path, file);
              if (res.ok && res.url) {
                imageUrl = res.url;
              } else {
                throw new Error(res.error || `Upload angle ${angleKey} failed`);
              }
            }
          }
        } else if (singleFile && client) {
          const ext = CatalogStorageHelper.getFileExtension(singleFile);
          const folderPath = isBodyKit
            ? `${brandName}/${carName}/BodyKit/${tuningBrand}/${newName}`
            : `${brandName}/${carName}/Part/${category}/${tuningBrand}/${newName}`;

          await CatalogStorageHelper.removeSiblingFiles(client, folderPath, '45_front', ext);
          const path = isBodyKit
            ? CatalogStorageHelper.getBodyKitPath(brandName, carName, tuningBrand, newName, ext)
            : CatalogStorageHelper.getPartPath(brandName, carName, tuningBrand, newName, ext);
          const res = await CatalogStorageHelper.uploadFile(client, path, singleFile);
          if (res.ok && res.url) {
            imageUrl = res.url;
          } else {
            throw new Error(res.error || 'Upload failed');
          }
        }

        // กรณีเปลี่ยนชื่อชิ้นส่วน ให้ลบโฟลเดอร์ของชื่อเดิมออกเพื่อไม่ให้ตกค้าง
        if (newName !== part.name && client) {
          const oldFolderPath = isBodyKit
            ? `${brandName}/${carName}/BodyKit/${tuningBrand}/${part.name}`
            : `${brandName}/${carName}/Part/${category}/${tuningBrand}/${part.name}`;
          await CatalogStorageHelper.deleteFolderRecursively(client, oldFolderPath);
        }
      } catch (err: any) {
        this.showToast(`อัปโหลดล้มเหลว: ${err?.message || 'Upload failed'}`, 'error');
        this.isUploading.set(false);
        return;
      } finally {
        this.isUploading.set(false);
      }
    }

    const price = this.editingPartPrice() ?? part.price ?? 0;
    const res = await this.admin.updateCarPart({
      id: part.id,
      name: newName,
      price,
      image_url: imageUrl,
    });

    if (res.ok) {
      this.closeEditPartModal();
      this.showToast(`แก้ไขชิ้นส่วน "${newName}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกการแก้ไขล้มเหลว', 'error');
    }
  }

  private showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3500);
  }
}
