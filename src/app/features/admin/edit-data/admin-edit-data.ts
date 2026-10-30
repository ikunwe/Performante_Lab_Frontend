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
  readonly activeCategory = signal<string>('Full Body Kits');

  // Modals visibility
  readonly brandModalOpen = signal(false);
  readonly carModalOpen = signal(false);
  readonly partModalOpen = signal(false);

  // File state & preview for modals
  readonly selectedBrandFile = signal<File | null>(null);
  readonly brandFilePreview = signal<string | null>(null);

  readonly selectedCarFile = signal<File | null>(null);
  readonly carFilePreview = signal<string | null>(null);

  readonly selectedPartFile = signal<File | null>(null);
  readonly partFilePreview = signal<string | null>(null);

  // Uploading state
  readonly isUploading = signal(false);
  readonly uploadProgressText = signal('');

  // Form states: New Brand
  readonly newBrandName = signal('');
  readonly newBrandLogo = signal('');
  readonly newBrandCustomBg = signal(false);

  // Form states: New Car
  readonly newCarName = signal('');
  readonly newCarImage = signal('');
  readonly newCarBodyType = signal('Coupe');

  // Form states: New Part
  readonly newPartCategory = signal('Full Body Kits');
  readonly newPartManufacturer = signal('');
  readonly newPartName = signal('');
  readonly newPartImage = signal('');
  readonly newPartPrice = signal<number | null>(null);

  // Toast feedback
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  // Filtered lists for the active level
  readonly filteredCarsForBrand = computed(() => {
    const brand = this.selectedBrand();
    if (!brand) return [];
    return this.admin.catalogModels().filter((c) => (c.brand_id || c.brandId) === brand.id);
  });

  readonly filteredPartsForCar = computed(() => {
    const car = this.selectedCar();
    if (!car) return [];
    const cat = this.activeCategory();
    return this.admin.catalogParts().filter(
      (p) => (p.car_model_id || p.carId) === car.id && (cat === 'All' || p.category === cat),
    );
  });

  // Placeholder cards to pad grid to minimum slots (visual fidelity to Admin Edit Data screenshots)
  readonly brandPlaceholders = computed(() => {
    const filled = 1 + this.admin.catalogBrands().length;
    const remaining = Math.max(0, 18 - filled);
    return Array.from({ length: remaining });
  });

  readonly modelPlaceholders = computed(() => {
    const filled = 2 + this.filteredCarsForBrand().length;
    const remaining = Math.max(0, 18 - filled);
    return Array.from({ length: remaining });
  });

  readonly partPlaceholders = computed(() => {
    const filled = 1 + this.filteredPartsForCar().length;
    const remaining = Math.max(0, 18 - filled);
    return Array.from({ length: remaining });
  });

  async ngOnInit(): Promise<void> {
    await this.admin.fetchCatalogBrands();
  }

  // Navigation Methods
  async selectBrand(brand: RealBrandItem): Promise<void> {
    this.selectedBrand.set(brand);
    this.selectedCar.set(null);
    this.level.set('models');
    await this.admin.fetchCatalogModels(brand.id);
  }

  backToBrands(): void {
    this.selectedBrand.set(null);
    this.selectedCar.set(null);
    this.level.set('brands');
  }

  async selectCar(car: RealCarModelItem): Promise<void> {
    this.selectedCar.set(car);
    this.level.set('parts');
    await this.admin.fetchCatalogParts(car.id);
  }

  backToModels(): void {
    this.selectedCar.set(null);
    this.level.set('models');
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

  // Brand Modal Handlers
  openBrandModal(): void {
    this.newBrandName.set('');
    this.newBrandLogo.set('');
    this.newBrandCustomBg.set(false);
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
    let logoUrl = this.newBrandLogo().trim() || this.brandFilePreview() || 'assets/brands/ferrari.png';

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

    const isCustomBg = this.newBrandCustomBg();
    const res = await this.admin.insertBrand({
      name,
      logo_url: logoUrl,
      is_custom_bg: isCustomBg,
    });
    if (res.ok) {
      this.closeBrandModal();
      this.showToast(`เพิ่มแบรนด์ "${name}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึก Brand ล้มเหลว', 'error');
    }
  }

  readonly submitAddBrand = (): Promise<void> => this.saveBrand();

  // Car Modal Handlers
  openCarModal(): void {
    this.newCarName.set('');
    this.newCarImage.set('');
    this.newCarBodyType.set('Coupe');
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
    let imageUrl = this.newCarImage().trim() || this.carFilePreview() || 'assets/car_pic.png';

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
      brand_id: brand.id,
      name,
      image_url: imageUrl,
      body_type: this.newCarBodyType(),
    });
    if (res.ok) {
      this.closeCarModal();
      this.showToast(`เพิ่มรุ่นรถ "${name}" สำเร็จ`, 'success');
    } else {
      this.showToast(res.error || 'บันทึกรุ่นรถล้มเหลว', 'error');
    }
  }

  readonly submitAddCar = (): Promise<void> => this.saveCar();

  // Part Modal Handlers
  openPartModal(): void {
    this.newPartCategory.set(this.activeCategory());
    this.newPartManufacturer.set('');
    this.newPartName.set('');
    this.newPartImage.set('');
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

    const manufacturer = this.newPartManufacturer().trim() || 'Custom';
    const category = this.newPartCategory() || this.activeCategory() || 'Full Body Kits';
    const file = this.selectedPartFile();
    let imageUrl = this.newPartImage().trim() || this.partFilePreview() || 'assets/car_pic.png';

    if (file) {
      this.isUploading.set(true);
      this.uploadProgressText.set('กำลังอัปโหลดรูปพาร์ตแต่ง...');
      try {
        const client = await this.admin.getClient();
        if (client) {
          const ext = CatalogStorageHelper.getFileExtension(file);
          const isBodyKit =
            category.toLowerCase().includes('body kit') ||
            category.toLowerCase().includes('bodykit');
          const brandName = brand?.name || 'Universal';
          const path = isBodyKit
            ? CatalogStorageHelper.getBodyKitPath(brandName, car.name, manufacturer, name, ext)
            : CatalogStorageHelper.getPartPath(brandName, car.name, manufacturer, name, ext);

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
      manufacturer,
      image_url: imageUrl,
      price,
    });
    if (res.ok) {
      this.closePartModal();
      this.showToast(`เพิ่มชุดแต่ง "${name}" สำเร็จ`, 'success');
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
