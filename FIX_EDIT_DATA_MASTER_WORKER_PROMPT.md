# 🚀 MASTER WORKER PROMPT: Complete Fix for Admin Edit Data
## Fix List: แก้ไขปัญหาภาพ Mockup, ระบบค้นหา, บังคับอัปโหลดรูปจริง, และเพิ่มระบบ Edit Brand/Car In-place

---

## 📌 บทบาทและบริบทของงาน (Role & Context)
คุณคือ **Senior Frontend Developer (Angular 22)** ประจำโปรเจกต์ **Performante Lab**
หน้าที่ของคุณคือ ปรับปรุงหน้า **Admin Edit Data (`/admin/edit-data`)** ทั้งใน `admin-edit-data.ts`, `admin-edit-data.html` และ `admin.service.ts` เพื่อแก้ไขปัญหาและเพิ่มฟังก์ชันตามรายการในโฟลเดอร์ `fix list` และโครงสร้าง `STORAGE_CATALOG_TREE.md` ดังนี้:

1. **หน้าเลือก Brand รถยนต์ (Level 1)**:
   - เพิ่มช่องสำหรับค้นหาแบรนด์รถ (Search Input)
   - บังคับอัปโหลดรูปโลโก้เมื่อกดเพิ่ม Brand ใหม่ (Mandatory Photo Upload)
   - **แก้ไขปัญหาโลโก้ไม่ตรงกับชื่อแบรนด์ (`fix list/logo_not_match_name.png`)**: ลบ Hardcoded Fallback `assets/brands/ferrari.png` ออกทั้งหมด และแสดง Neutral Brand Initials Monogram เมื่อยังไม่มีรูป
2. **หน้าเลือกรุ่นรถยนต์ (Level 2: Car Name)**:
   - **คลิกการ์ดโลโก้แบรนด์ใบแรก $\rightarrow$ เปิด Modal แก้ไขข้อมูลแบรนด์ (Edit Brand Modal)** (`fix list/brand_edit.png`): สามารถแก้ชื่อ และอัปโหลดรูปโลโก้ใหม่ได้ (หากไม่อัปโหลดรูปใหม่ ให้ใช้รูปเดิม)
   - บังคับอัปโหลดรูปเมื่อกดเพิ่มรุ่นรถใหม่ (Mandatory Photo Upload)
   - **แก้ไขปัญหารูปรถไม่ตรงกับของจริง (`fix list/deny_mockup_data.png`)**: ลบ Fallback `assets/car_pic.png` (รูปรถ Ferrari F8) ออกทั้งหมด หากรถรุ่นใดยังไม่มีรูปจริงใน Storage ให้แสดง Car Silhouette Placeholder ("รออัปโหลดรูปภาพ") แทน
3. **หน้าเลือกของแต่งรถ (Level 3: Tuning & Parts)**:
   - **คลิกการ์ด Banner รถด้านบน $\rightarrow$ เปิด Modal แก้ไขข้อมูลรุ่นรถ (Edit Car Model Modal)** (`fix list/change_car_data.png`): แก้ชื่อรุ่นรถ และอัปโหลดรูปภาพใหม่ได้ (หากไม่อัปโหลดรูปใหม่ ให้ใช้รูปเดิม)
   - **เพิ่มกล่องอัปโหลดรูปโลโก้สำนักแต่ง/ยี่ห้อ Part (`fix list/No_Workshop_photo_upload.png`)**: ใน Modal เพิ่มแบรนด์ของแต่ง ให้มีช่องอัปโหลดรูปโลโก้สำนักแต่งแบบบังคับใส่รูป
4. **ลบ Mockup Data ทั้งหมด**: ใช้ข้อมูลจริงจาก `public.car_brand_reference` และ Supabase Storage `catalog` Bucket

---

## 📂 รายละเอียดงานที่ต้องทำทีละส่วน (Step-by-Step Implementation)

### ─── 1. หน้าเลือก BRAND รถยนต์ (LEVEL 1) ───

#### A. เพิ่มช่องค้นหาแบรนด์ (Search Box):
- ใน `admin-edit-data.ts`:
  ```typescript
  readonly brandSearchQuery = signal('');

  // คำนวณรายชื่อแบรนด์ที่กรองตามคำค้นหา
  readonly filteredBrands = computed(() => {
    const q = this.brandSearchQuery().trim().toLowerCase();
    if (!q) return this.admin.catalogBrands();
    return this.admin.catalogBrands().filter(
      (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
    );
  });
  ```
- ใน `admin-edit-data.html`:
  เพิ่มช่องค้นหาข้างหัวข้อ "Car brand" พร้อมไอคอนแว่นขยาย `search` และปุ่มเคลียร์คำค้นหา
  และเปลี่ยน Loop จาก `@for (brand of admin.catalogBrands())` เป็น `@for (brand of filteredBrands())`

#### B. บังคับใส่รูปภาพเมื่อเพิ่ม Brand ใหม่:
- ใน `admin-edit-data.ts`:
  ```typescript
  async saveBrand(): Promise<void> {
    const name = this.newBrandName().trim();
    const file = this.selectedBrandFile();
    if (!name) return this.showToast('กรุณากรอกชื่อแบรนด์', 'error');
    if (!file) return this.showToast('กรุณาอัปโหลดรูปภาพโลโก้แบรนด์', 'error'); // บังคับใส่รูป
    ...
  }
  ```

#### C. แก้ไขปัญหาโลโก้ไม่ตรงกับชื่อแบรนด์ (`logo_not_match_name.png`):
- **สาเหตุ**: มีโค้ด fallback `assets/brands/ferrari.png` ทำให้แบรนด์ AION, Denza, DEEPAL ฯลฯ แสดงเป็นโลโก้ Ferrari
- **วิธีแก้**:
  1. ใน `admin.service.ts`: ลบ `assets/brands/ferrari.png` ออกจาก `fetchCatalogBrands`
  2. ใน `admin-edit-data.html`: 
     - ลบ `(error)="$any($event.target).src = 'assets/brands/ferrari.png'"`
     - ปรับให้เช็คว่าถ้ามี `brand.logo_url` และโหลดสำเร็จ ให้แสดงรูปภาพ
     - หากไม่มีรูป หรือรูปโหลดไม่ผ่าน ให้แสดง **Neutral Initials Monogram Badge**:
       ```html
       @if (brand.logo_url && !failedBrandLogos().has(brand.id)) {
         <img
           [src]="brand.logo_url"
           [alt]="brand.name"
           class="max-h-24 max-w-[80%] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-md"
           (error)="onBrandLogoError(brand.id)"
         />
       } @else {
         <!-- Neutral Brand Initials Placeholder (ห้ามเอาโลโก้ Ferrari มาใส่เด็ดขาด) -->
         <div class="size-16 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center p-2 group-hover:border-white/25 transition-colors">
           <span class="text-base font-extrabold text-white tracking-wider">
             {{ brand.name.slice(0, 2).toUpperCase() }}
           </span>
           <span class="text-[9px] text-stone-400 truncate max-w-[56px] mt-0.5">
             {{ brand.name }}
           </span>
         </div>
       }
       ```

---

### ─── 2. หน้าเลือกรุ่นรถยนต์ (LEVEL 2: CAR NAME) ───

#### A. คลิกการ์ดโลโก้แบรนด์ใบแรก $\rightarrow$ เปิด Modal แก้ไขข้อมูลแบรนด์ (`brand_edit.png`):
- ใน `admin-edit-data.html`:
  - การ์ดใบแรกที่แสดงโลโก้ของแบรนด์ที่เลือก:
    เปลี่ยนจาก `(click)="backToBrands()"` $\rightarrow$ เป็น `(click)="openEditBrandModal(brand)"`
    พร้อมติด Badge หรือ Tooltip เล็กๆ ระบุว่า "คลิกเพื่อแก้ไขข้อมูลแบรนด์"
- ใน `admin-edit-data.ts`:
  ```typescript
  readonly editBrandModalOpen = signal(false);
  readonly editingBrandName = signal('');
  readonly editBrandFile = signal<File | null>(null);
  readonly editBrandFilePreview = signal<string | null>(null);

  openEditBrandModal(brand: RealBrandItem): void {
    this.editingBrandName.set(brand.name);
    this.editBrandFile.set(null);
    this.editBrandFilePreview.set(null);
    this.editBrandModalOpen.set(true);
  }

  closeEditBrandModal(): void {
    this.editBrandModalOpen.set(false);
  }

  async saveEditBrand(): Promise<void> {
    const brand = this.selectedBrand();
    const newName = this.editingBrandName().trim();
    if (!brand || !newName) return;

    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลแบรนด์...');

    try {
      const client = await this.admin.getClient();
      let logoUrl = brand.logo_url;

      // ถ้ามีการอัปโหลดรูปใหม่ ให้เซฟรูปใหม่เข้า Storage
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

      // อัปเดตข้อมูลลงฐานข้อมูล Supabase
      if (client) {
        const { error } = await client
          .from('car_brand_reference')
          .update({
            name: newName,
            details: {
              ...brand,
              name: newName,
              logoReferenceUrl: logoUrl,
            },
          })
          .eq('id', brand.id);
        if (error) throw error;
      }

      // อัปเดต Signal ท้องถิ่น
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

      this.closeEditBrandModal();
      this.showToast(`แก้ไขข้อมูลแบรนด์ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (err: any) {
      this.showToast(`แก้ไขล้มเหลว: ${err?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }
  ```

#### B. บังคับใส่รูปเมื่อเพิ่มรุ่นรถใหม่:
- ใน `saveCar()`:
  ```typescript
  if (!this.selectedCarFile()) {
    return this.showToast('กรุณาอัปโหลดรูปภาพรถต้นแบบ', 'error');
  }
  ```

#### C. แก้ไขปัญหารูปรถไม่ตรงกับของจริง (`deny_mockup_data.png`):
- **สาเหตุ**: ทุกรุ่นรถที่ไม่มีรูป โดน Fallback ใส่รูป Ferrari F8 (`assets/car_pic.png`)
- **วิธีแก้**:
  1. ลบ Fallback `assets/car_pic.png` ออก
  2. หากรุ่นรถใดยังไม่มีรูปใน Supabase Storage หรือรูปโหลดไม่ติด ให้แสดง **Car Silhouette Placeholder Card**:
     ```html
     @if (car.image_url && !failedCarImages().has(car.id)) {
       <img
         [src]="car.image_url"
         [alt]="car.name"
         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
         (error)="onCarImageError(car.id)"
       />
     } @else {
       <!-- Neutral Placeholder สำหรับรถที่ยังไม่มีรูปจริง (ห้ามเอารูป Ferrari มาใส่) -->
       <div class="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#141414] to-[#1a1a1a] text-stone-500 group-hover:text-stone-300 transition-colors">
         <app-icon name="car" class="!size-10 mb-2 opacity-30 group-hover:opacity-60 transition-opacity text-white" />
         <span class="text-[10px] font-medium tracking-wide">รออัปโหลดรูปจริง</span>
       </div>
     }
     ```

---

### ─── 3. หน้าเลือกของแต่งรถ (LEVEL 3: TUNING & PARTS) ───

#### A. คลิกการ์ด Banner รถ $\rightarrow$ เปิด Modal แก้ไขรุ่นรถ (`change_car_data.png`):
- ใน `admin-edit-data.html`:
  - ให้การ์ด Banner รูปรถด้านขวา สามารถคลิกได้:
    `(click)="openEditCarModal(selectedCar())"`
    พร้อมไอคอนรูปดินสอ หรือข้อความ Hover: *"คลิกเพื่อแก้ไขชื่อรุ่นหรือเปลี่ยนรูปรถ"*
- ใน `admin-edit-data.ts`:
  ```typescript
  readonly editCarModalOpen = signal(false);
  readonly editingCarName = signal('');
  readonly editCarFile = signal<File | null>(null);
  readonly editCarFilePreview = signal<string | null>(null);

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

  async saveEditCar(): Promise<void> {
    const brand = this.selectedBrand();
    const car = this.selectedCar();
    const newName = this.editingCarName().trim();
    if (!brand || !car || !newName) return;

    this.isUploading.set(true);
    this.uploadProgressText.set('กำลังอัปเดตข้อมูลรุ่นรถ...');

    try {
      const client = await this.admin.getClient();
      let imageUrl = car.image_url;

      // ถ้ามีการอัปโหลดรูปใหม่ ให้เซฟรูปใหม่เข้า Storage
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

      // อัปเดตข้อมูลในฐานข้อมูล (car_brand_reference / car_models)
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

      this.closeEditCarModal();
      this.showToast(`แก้ไขรุ่นรถ "${newName}" เรียบร้อยแล้ว`, 'success');
    } catch (err: any) {
      this.showToast(`แก้ไขล้มเหลว: ${err?.message || 'Update failed'}`, 'error');
    } finally {
      this.isUploading.set(false);
    }
  }
  ```

#### B. เพิ่มกล่องอัปโหลดรูปสำนักแต่งแบบบังคับ (`No_Workshop_photo_upload.png`):
- ใน Modal "เพิ่มแบรนด์ของแต่งใหม่" (`tuningBrandModalOpen`):
  - เพิ่ม File Dropzone สำหรับอัปโหลดรูปโลโก้สำนักแต่ง (Logo ของ Tuning Brand)
  - ในฟังก์ชัน `addTuningBrand()`: บังคับตรวจเช็คว่าต้องมีไฟล์รูป หากไม่มีให้แจ้งเตือนและบล็อกการบันทึก:
    ```typescript
    if (!this.selectedTuningBrandFile()) {
      return this.showToast('กรุณาอัปโหลดรูปภาพโลโก้แบรนด์ของแต่ง', 'error');
    }
    ```
  - จัดเก็บรูปเข้า Supabase Storage ตามโครงสร้าง Path:
    - `catalog/{CarBrand}/{CarModel}/BodyKit/{BodyKitBrand}/logo.{ext}`
    - หรือ `catalog/{CarBrand}/{CarModel}/Part/{PartBrand}/logo.{ext}`
  - แสดงรูปโลโก้ของสำนักแต่งบนการ์ดในสเต็ปที่ 1 อย่างสวยงาม

---

## 🧪 4. Testing & Verification Checklist
1. **ทดสอบหน้าเลือก Brand**:
   - พิมพ์ในช่องค้นหา $\rightarrow$ รายการแบรนด์ต้องกรองตามคำค้นหาทันที
   - ตรวจสอบว่าแบรนด์ AION, Denza, DEEPAL, JAECOO, NETA, ORA ไม่ขึ้นโลโก้ Ferrari
   - กดเพิ่ม Brand โดยไม่อัปโหลดรูป $\rightarrow$ ต้องโดนปฏิเสธพร้อมข้อความเตือน
2. **ทดสอบหน้าเลือกรุ่นรถ (Car Name)**:
   - คลิกที่การ์ดโลโก้แบรนด์ใบแรก $\rightarrow$ ต้องเปิด Modal แก้ไขแบรนด์ และทดสอบแก้ชื่อ/เปลี่ยนรูปได้จริง
   - ตรวจสอบว่ารุ่นรถต่างๆ ไม่ขึ้นรูปรถ Ferrari ซ้ำกันทุกรุ่น (รุ่นที่ยังไม่มีรูปต้องขึ้น Placeholder รูปรถเรียบหรู)
   - กดเพิ่มรุ่นรถโดยไม่อัปโหลดรูป $\rightarrow$ ต้องโดนปฏิเสธพร้อมข้อความเตือน
3. **ทดสอบหน้าเลือกของแต่งรถ**:
   - คลิกที่การ์ด Banner รูปรถด้านบน $\rightarrow$ ต้องเปิด Modal แก้ไขชื่อรุ่นรถและเปลี่ยนรูปรถได้จริง
   - กดเพิ่มแบรนด์ของแต่ง $\rightarrow$ ต้องมีกล่องให้อัปโหลดรูปโลโก้สำนักแต่ง และบังคับให้อัปโหลดรูปก่อนบันทึก
4. **คำสั่งตรวจสอบคุณภาพ**:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   npm run build
   ```
   *(ต้องผ่านครบทุก Test Suites และไม่มีข้อผิดพลาดในการ Build)*

---

## 📋 Definition of Done
- [ ] มีช่อง Search Brand ใช้งานได้ลื่นไหล
- [ ] ทุกฟอร์มเพิ่มข้อมูล (Brand, Car, Tuning Brand) บังคับอัปโหลดรูปภาพจริงจากเครื่อง 100%
- [ ] โลโก้แบรนด์ตรงกับของจริงทุกแบรนด์ ไม่มีโลโก้ Ferrari ปรากฏผิดที่
- [ ] รถแต่ละรุ่นไม่มีรูป Ferrari F8 ปรากฏมั่ว แสดงเฉพาะรูปรถจริง หรือ Car Silhouette Placeholder
- [ ] คลิกการ์ดแบรนด์ใน Level 2 สามารถแก้ไขชื่อและรูปแบรนด์ได้จริง
- [ ] คลิกการ์ด Banner รถใน Level 3 สามารถแก้ไขชื่อรุ่นและรูปรถได้จริง
- [ ] กล่องเพิ่มสำนักแต่งมี Dropzone อัปโหลดรูปโลโก้สำนักแต่ง และแสดงผลบนการ์ดได้จริง
- [ ] รัน `npm test` และ `npm run build` ผ่าน 100%

