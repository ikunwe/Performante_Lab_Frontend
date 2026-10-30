# 🚀 MASTER WORKER PROMPT: Admin Edit Data with Real Supabase Storage Image Upload
## Feature: เชื่อมต่อการอัปโหลดไฟล์รูปภาพจริงจากเครื่องเข้าสู่ Supabase Storage (`catalog` Bucket) ในหน้า Admin Edit Data

---

## 📌 บทบาทและบริบทของงาน (Role & Context)
คุณคือ **Senior Frontend Developer (Angular 22 & Supabase)** ประจำโปรเจกต์ **Performante Lab**
หน้าที่ของคุณคือ พัฒนาฟังก์ชัน **อัปโหลดไฟล์รูปภาพจริงจากเครื่องคอมพิวเตอร์ (Local File Upload)** ในหน้า **Admin Edit Data (`/admin/edit-data`)** โดยเมื่อ Admin เพิ่ม Brand, Car Model หรือ Part/BodyKit ระบบจะอัปโหลดรูปภาพเข้าสู่ Supabase Storage Bucket ชื่อ **`catalog`** ตามโครงสร้าง Path ที่กำหนดไว้ใน `STORAGE_CATALOG_TREE.md` และนำ Public URL ที่ได้มาแสดงผลในระบบจริงทันที

---

## 🗺️ แผนผัง Path ของการอัปโหลดเข้า Supabase Storage
ทุกไฟล์ที่อัปโหลดต้องถูกจัดเก็บเข้า Bucket **`catalog`** ตาม Path Pattern ต่อไปนี้:

```text
1. เพิ่ม Brand รถ:
   Path: catalog/{Brand}/logo.{ext}

2. เพิ่มรุ่นรถ (Car Model):
   Path: catalog/{Brand}/{Model}/CarPicture.{ext}

3. เพิ่มชุดแต่ง BodyKit:
   Path: catalog/{Brand}/{Model}/BodyKit/{BodyKitBrand}/{TypeName}.{ext}

4. เพิ่มพาร์ตแต่งอื่นๆ (Part):
   Path: catalog/{Brand}/{Model}/Part/{PartBrand}/{TypeName}.{ext}
```
*(รองรับนามสกุลไฟล์ทั้ง `.jpg`, `.jpeg`, และ `.png`)*

---

## 📂 ลำดับงานและไฟล์ที่ต้องสร้าง/แก้ไข (Step-by-Step Implementation)

### ─── STEP 1: สร้าง STORAGE HELPER UTILITY ───
**ไฟล์**: `src/app/core/storage/catalog-storage.ts`

สร้าง Utility Class สำหรับสร้าง Path และอัปโหลดไฟล์ขึ้น Supabase:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

export class CatalogStorageHelper {
  static readonly BUCKET = 'catalog';

  /**
   * ดึงนามสกุลไฟล์จาก File Object
   */
  static getFileExtension(file: File): string {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext || 'png';
  }

  /**
   * แปลงชื่อให้อยู่ในรูปแบบที่ปลอดภัยสำหรับ URL / S3 Path (คั่นคำด้วยขีดกลาง)
   */
  static sanitize(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '');
  }

  /**
   * 1. Path โลโก้แบรนด์: {brand}/logo.{ext}
   */
  static getBrandLogoPath(brand: string, ext = 'png'): string {
    return `${this.sanitize(brand)}/logo.${ext}`;
  }

  /**
   * 2. Path รูปรถต้นแบบ: {brand}/{model}/CarPicture.{ext}
   */
  static getCarPicturePath(brand: string, model: string, ext = 'jpg'): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/CarPicture.${ext}`;
  }

  /**
   * 3. Path ชุดแต่ง BodyKit: {brand}/{model}/BodyKit/{bodyKitBrand}/{typeName}.{ext}
   */
  static getBodyKitPath(
    brand: string,
    model: string,
    bodyKitBrand: string,
    typeName: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/BodyKit/${this.sanitize(bodyKitBrand)}/${this.sanitize(typeName)}.${ext}`;
  }

  /**
   * 4. Path ชิ้นส่วนพาร์ตแต่ง: {brand}/{model}/Part/{partBrand}/{typeName}.{ext}
   */
  static getPartPath(
    brand: string,
    model: string,
    partBrand: string,
    typeName: string,
    ext = 'png',
  ): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/Part/${this.sanitize(partBrand)}/${this.sanitize(typeName)}.${ext}`;
  }

  /**
   * ฟังก์ชันอัปโหลดไฟล์จริงเข้า Supabase Storage
   */
  static async uploadFile(
    client: SupabaseClient,
    path: string,
    file: File,
    upsert = true,
  ): Promise<{ ok: boolean; url?: string; error?: string }> {
    try {
      const { data, error } = await client.storage
        .from(this.BUCKET)
        .upload(path, file, {
          upsert,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (error) throw error;

      // ขอ Public URL เพื่อนำไปใช้งานต่อ
      const { data: publicData } = client.storage.from(this.BUCKET).getPublicUrl(path);
      return { ok: true, url: publicData.publicUrl };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Upload failed' };
    }
  }
}
```

---

### ─── STEP 2: ปรับปรุง `AdminEditData` COMPONENT (LOGIC & STATE) ───
**ไฟล์**: `src/app/features/admin/edit-data/admin-edit-data.ts`

1. **State สำหรับการเลือกไฟล์และการอัปโหลด**:
   ```typescript
   // File state สำหรับ Modal ต่างๆ
   readonly selectedBrandFile = signal<File | null>(null);
   readonly brandFilePreview = signal<string | null>(null);

   readonly selectedCarFile = signal<File | null>(null);
   readonly carFilePreview = signal<string | null>(null);

   readonly selectedPartFile = signal<File | null>(null);
   readonly partFilePreview = signal<string | null>(null);

   // สถานะกำลังอัปโหลด
   readonly isUploading = signal(false);
   readonly uploadProgressText = signal('');
   ```

2. **ฟังก์ชันจัดการการเลือกไฟล์ (พร้อมสร้าง Image Preview ในเครื่อง)**:
   ```typescript
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

   private validateAndPreview(file: File, onSuccess: (previewUrl: string) => void): void {
     const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
     if (!allowedTypes.includes(file.type)) {
       this.showToast('กรุณาเลือกไฟล์รูปภาพ .jpg, .png หรือ .webp เท่านั้น', 'error');
       return;
     }
     if (file.size > 10 * 1024 * 1024) { // 10MB
       this.showToast('ขนาดไฟล์ต้องไม่เกิน 10 MB', 'error');
       return;
     }
     const reader = new FileReader();
     reader.onload = (e) => onSuccess(e.target?.result as string);
     reader.readAsDataURL(file);
   }
   ```

3. **ฟังก์ชัน Submit พร้อมอัปโหลดเข้า Storage**:
   - **เพิ่ม Brand**:
     ```typescript
     async submitAddBrand(): Promise<void> {
       const name = this.newBrandName().trim();
       const file = this.selectedBrandFile();
       if (!name) return this.showToast('กรุณากรอกชื่อ Brand', 'error');
       if (!file) return this.showToast('กรุณาเลือกไฟล์รูปโลโก้', 'error');

       this.isUploading.set(true);
       this.uploadProgressText.set('กำลังอัปโหลดโลโก้ขึ้น Supabase Storage...');

       try {
         const client = await this.adminService.getClient();
         let logoUrl = this.brandFilePreview() || '';

         if (client) {
           const ext = CatalogStorageHelper.getFileExtension(file);
           const path = CatalogStorageHelper.getBrandLogoPath(name, ext);
           const res = await CatalogStorageHelper.uploadFile(client, path, file);
           if (res.ok && res.url) {
             logoUrl = res.url;
           } else {
             throw new Error(res.error);
           }
         }

         this.adminService.addBrand({ name, logoUrl });
         this.showToast(`เพิ่มแบรนด์ "${name}" สำเร็จ`, 'success');
         this.closeBrandModal();
       } catch (err: any) {
         this.showToast(`อัปโหลดล้มเหลว: ${err.message}`, 'error');
       } finally {
         this.isUploading.set(false);
       }
     }
     ```

   - **เพิ่ม Car Model**:
     ```typescript
     async submitAddCar(): Promise<void> {
       const brand = this.selectedBrand();
       const modelName = this.newCarName().trim();
       const file = this.selectedCarFile();
       if (!brand || !modelName) return;
       if (!file) return this.showToast('กรุณาเลือกไฟล์รูปรถ', 'error');

       this.isUploading.set(true);
       this.uploadProgressText.set('กำลังอัปโหลดรูปรถต้นแบบ...');

       try {
         const client = await this.adminService.getClient();
         let imageUrl = this.carFilePreview() || '';

         if (client) {
           const ext = CatalogStorageHelper.getFileExtension(file);
           const path = CatalogStorageHelper.getCarPicturePath(brand.name, modelName, ext);
           const res = await CatalogStorageHelper.uploadFile(client, path, file);
           if (res.ok && res.url) {
             imageUrl = res.url;
           } else {
             throw new Error(res.error);
           }
         }

         this.adminService.addCarModel({
           brandId: brand.id,
           name: modelName,
           image: imageUrl,
         });
         this.showToast(`เพิ่มรุ่นรถ "${modelName}" สำเร็จ`, 'success');
         this.closeCarModal();
       } catch (err: any) {
         this.showToast(`อัปโหลดล้มเหลว: ${err.message}`, 'error');
       } finally {
         this.isUploading.set(false);
       }
     }
     ```

   - **เพิ่ม Part / BodyKit**:
     ```typescript
     async submitAddPart(): Promise<void> {
       const brand = this.selectedBrand();
       const car = this.selectedCar();
       const partName = this.newPartName().trim();
       const manufacturer = this.newPartManufacturer().trim();
       const category = this.activeCategory();
       const file = this.selectedPartFile();
       if (!brand || !car || !partName || !manufacturer) return;
       if (!file) return this.showToast('กรุณาเลือกไฟล์รูปพาร์ต', 'error');

       this.isUploading.set(true);
       this.uploadProgressText.set('กำลังอัปโหลดรูปพาร์ตแต่ง...');

       try {
         const client = await this.adminService.getClient();
         let imageUrl = this.partFilePreview() || '';

         if (client) {
           const ext = CatalogStorageHelper.getFileExtension(file);
           const isBodyKit = category.toLowerCase().includes('body kit');
           const path = isBodyKit
             ? CatalogStorageHelper.getBodyKitPath(brand.name, car.name, manufacturer, partName, ext)
             : CatalogStorageHelper.getPartPath(brand.name, car.name, manufacturer, partName, ext);

           const res = await CatalogStorageHelper.uploadFile(client, path, file);
           if (res.ok && res.url) {
             imageUrl = res.url;
           } else {
             throw new Error(res.error);
           }
         }

         this.adminService.addPartData({
           carId: car.id,
           category,
           name: partName,
           image: imageUrl,
         });
         this.showToast(`เพิ่มพาร์ต "${partName}" สำเร็จ`, 'success');
         this.closePartModal();
       } catch (err: any) {
         this.showToast(`อัปโหลดล้มเหลว: ${err.message}`, 'error');
       } finally {
         this.isUploading.set(false);
       }
     }
     ```

---

### ─── STEP 3: ออกแบบ FILE DROPZONE UI ใน TEMPLATE ───
**ไฟล์**: `src/app/features/admin/edit-data/admin-edit-data.html`

ในทุก Modal ให้สร้างกล่องอัปโหลดไฟล์ที่สวยงาม ทันสมัย รองรับทั้งการคลิกเลือกไฟล์และการ Drag & Drop:

```html
<!-- Reusable File Upload Dropzone Pattern -->
<div class="space-y-1.5">
  <label class="block text-xs font-semibold text-stone-300">
    อัปโหลดรูปภาพ (JPG, PNG, WebP สูงสุด 10MB)
  </label>

  <div
    class="relative rounded-xl border-2 border-dashed border-white/15 bg-[#121212] p-4 text-center hover:border-[#ce281a]/60 transition-colors cursor-pointer group"
    (click)="fileInput.click()"
  >
    <input
      #fileInput
      type="file"
      accept="image/png, image/jpeg, image/webp"
      class="hidden"
      (change)="onBrandFileChange($event)"
    />

    @if (brandFilePreview()) {
      <!-- Image Preview Area -->
      <div class="flex flex-col items-center gap-2">
        <img
          [src]="brandFilePreview()"
          alt="Preview"
          class="max-h-36 max-w-full rounded-lg object-contain shadow-md"
        />
        <p class="text-[11px] text-stone-400">
          {{ selectedBrandFile()?.name }} (คลิกเพื่อเปลี่ยนรูป)
        </p>
      </div>
    } @else {
      <!-- Empty Placeholder -->
      <div class="flex flex-col items-center justify-center py-4 text-stone-400 group-hover:text-stone-300">
        <app-icon name="plus" class="!size-7 text-stone-500 group-hover:text-[#ce281a] mb-2 transition-colors" />
        <p class="text-xs font-medium">คลิกเพื่อเลือกไฟล์รูปภาพจากเครื่อง</p>
        <p class="text-[10px] text-stone-500 mt-0.5">รองรับไฟล์ .png, .jpg, .webp</p>
      </div>
    }
  </div>
</div>

<!-- Uploading Spinner Overlay บนปุ่ม Submit -->
@if (isUploading()) {
  <div class="flex items-center gap-2 text-xs text-amber-400 justify-center py-1">
    <app-icon name="spinner" class="!size-4 animate-spin text-[#ce281a]" />
    <span>{{ uploadProgressText() }}</span>
  </div>
}
```

---

## 🧪 4. Testing & Verification Checklist
1. **Unit Tests (`catalog-storage.spec.ts`)**:
   - ตรวจสอบฟังก์ชัน `CatalogStorageHelper.getBrandLogoPath('Ferrari', 'png')` ต้องได้ผลลัพธ์ `'Ferrari/logo.png'`
   - ตรวจสอบ `CatalogStorageHelper.getCarPicturePath('Ferrari', '488 Pista', 'jpg')` ต้องได้ผลลัพธ์ `'Ferrari/488-Pista/CarPicture.jpg'`
   - ตรวจสอบ `CatalogStorageHelper.getBodyKitPath('Ferrari', '488 Pista', 'Sano Design', 'Track Aero', 'png')` ต้องได้ผลลัพธ์ `'Ferrari/488-Pista/BodyKit/Sano-Design/Track-Aero.png'`
2. **Component Tests (`admin-edit-data.spec.ts`)**:
   - ทดสอบการเลือกไฟล์และการสร้าง Preview URL
   - ทดสอบการดักจับไฟล์ที่ขนาดเกิน 10MB และประเภทไฟล์ที่ไม่ถูกต้อง
   - ทดสอบการจำลองเรียก `uploadFile()` และบันทึก Public URL ลงในการ์ดแสดงผล
3. **คำสั่งตรวจสอบคุณภาพ**:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   npm run build
   ```

---

## 📋 Definition of Done
- [ ] แอดมินสามารถคลิกเลือกไฟล์รูปจากเครื่องจริงในหน้าต่าง Modal ได้
- [ ] มีพรีวิวรูปภาพที่เลือกแสดงทันทีก่อนกดบันทึก
- [ ] รูปภาพถูกอัปโหลดขึ้น Supabase Storage Bucket `catalog` ตาม Path ในโครงสร้าง Tree อย่างแม่นยำ
- [ ] ได้ Public URL จาก Supabase และนำไปแสดงผลบนการ์ดในหน้าจอทันที
- [ ] มีการแสดงสถานะ Loading Spinner ระหว่างอัปโหลด
- [ ] รัน `npm test` และ `npm run build` ผ่าน 100%

