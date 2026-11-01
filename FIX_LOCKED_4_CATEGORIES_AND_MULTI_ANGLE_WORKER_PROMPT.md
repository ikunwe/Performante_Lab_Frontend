# 🚀 MASTER WORKER PROMPT (FINAL V4): Complete Admin Edit Data Fixes & Multi-Angle Catalog Asset Integration

> ⚠️ **CRITICAL DIRECTIVES FOR WORKER / AGENT**:  
> เอกสารฉบับนี้รวบรวมการแก้ปัญหาทั้งหมดในหน้า **Portal Admin (`/admin/edit-data`)** ทั้ง 4 จุดสำคัญตามรายการแจ้งเตือน:
> 1. **การดึงข้อมูลจาก Storage Bucket (`catalog`) & Database (`car_parts`)**: แก้ปัญหาโครงสร้างโฟลเดอร์พาร์ตหลายระดับ `{brand}/{model}/Part/{Category}/{PartBrand}/{PartName}` ให้แสดงผลชิ้นส่วนครบถ้วน (เช่น Ferrari 458-Italia / Spoilers / Akrapovic)
> 2. **การเปลี่ยนชื่อและการลบแบรนด์ของแต่ง (Edit/Delete Tuning Brand)**: เพิ่ม Modal `editTuningBrandModalOpen` และปุ่มถังขยะบน Card 1 เพื่อให้สามารถเปลี่ยนชื่อหรือลบแบรนด์ได้จริง
> 3. **แก้ปัญหาชื่อหมวดหมู่ (เช่น Spoilers) ปะปนมาเป็นชื่อแบรนด์**: แยกหมวดหมู่ออกจากแบรนด์อย่างเด็ดขาด และกรองชื่อหมวดไม่ให้หลุดมาเป็นการ์ดแบรนด์
> 4. **การสร้างแบรนด์ของแต่งไม่ต้องใช้รูปโลโก้ (No Logo on Brand Creation)**: ลบช่องอัปโหลดรูปภาพโลโก้ออกจาก Modal `tuningBrandModalOpen` ทั้งหมด ให้กรอกเฉพาะชื่อแบรนด์แบบ Text-only

---

## 📸 ภาพอ้างอิงสถานะที่ถูกต้อง (Reference Architecture)

1. **Body Kit (ทำสำเร็จแล้วตามรูปภาพ Sano-Design)**:
   - การ์ดแรก (Card 1): กรอบสีเขียว `border-emerald-500/60`, ข้อความชื่อแบรนด์สีขาวตัวหนา, ด้านล่างเขียน `คลิกเพื่อแก้ไขชื่อ`, **ไม่มีรูปโลโก้ใดๆ ทั้งสิ้น (Text-only)**, คลิกแล้วเปิด Modal แก้ไขชื่อแบรนด์
   - การ์ดสอง (Card 2): ปุ่ม `(+) เพิ่มชิ้นส่วน`
   - การ์ดสามเป็นต้นไป (Card 3+): แสดงรูปชิ้นส่วน + ชื่อชิ้นส่วน + ราคา, **คลิกที่การ์ดเพื่อเปิด Modal แก้ไขข้อมูลชิ้นส่วน (In-place Edit)** + ปุ่มถังขยะสำหรับลบชิ้นส่วน

2. **Part (ชิ้นส่วนแต่ง) — โฟลว์ 3 สเต็ปมาตรฐาน**:
   - **Step 1 (Category)**: ล็อคให้มีเพียง 4 หมวดหมู่เท่านั้น (`Front Bumper`, `Rear Bumper`, `Wheels`, `Spoilers`) — **ไม่มีปุ่มเพิ่มหรือลบหมวดหมู่เด็ดขาด**
   - **Step 2 (Brand)**: เลือกว่าจะดูแบรนด์ใดในหมวดนั้น — การ์ด 1: `(+) เพิ่มแบรนด์`, การ์ด 2+: รายชื่อแบรนด์ (Text-only Typography ไม่มีรูปโลโก้) + ปุ่มลบแบรนด์ (มี Modal ยืนยัน)
   - **Step 3 (Parts)**: รายการชิ้นส่วนจริงในหมวดและแบรนด์นั้น — การ์ด 1: แบรนด์ที่เลือก (ขอบเขียว Text-only คลิกแก้ชื่อแบรนด์ได้), การ์ด 2: `(+) เพิ่มชิ้นส่วน`, การ์ด 3+: ชิ้นส่วนจริง (คลิกเพื่อแก้ไขรูป/ชื่อ/ราคาได้)

---

## 📐 Multi-Angle Asset Requirements (ข้อกำหนดมุมมองภาพที่ต้องอัปโหลด)

> 🚨 **CRITICAL WARNING (ป้องกันข้อผิดพลาดในรูปที่ 2)**:  
> ใน Modal เพิ่มชิ้นส่วน (`partModalOpen`) และ Modal แก้ไขชิ้นส่วน (`editPartModalOpen`) **ต้องแสดง Dropzones อัปโหลดแยกตามมุมมองของแต่ละหมวดหมู่เสมอ ห้ามแสดงกล่องอัปโหลดรูปเดี่ยว (Single File Dropzone) เด็ดขาด!**  
> ในโค้ด Template ต้องผูกกับ `getRequiredAngles(newPartCategory())` และ `getRequiredAngles(editingPart()?.category)`

เมื่อผู้ใช้กด **(+) เพิ่มชิ้นส่วน** หรือกด **คลิกแก้ไขชิ้นส่วน** ระบบจะต้องแสดงช่องอัปโหลดรูปภาพแยกตามมุมมองของแต่ละหมวดหมู่อย่างเคร่งครัด ดังนี้:

| หมวดหมู่ (Category) | จำนวนมุม | มุมมองที่ต้องอัปโหลด (Angle Keys & Names) |
| :--- | :---: | :--- |
| **Front Bumper** | **2 มุม** | 1. `45_front` (45 องศาหน้า)<br>2. `front` (หน้าตรง) |
| **Rear Bumper** | **2 มุม** | 1. `45_Back` (45 องศาหลัง)<br>2. `Back` (หลังตรง) |
| **Wheels** | **2 มุม** | 1. `45_front` (45 องศาหน้า)<br>2. `45_Back` (45 องศาหลัง) |
| **Spoilers** | **3 มุม** | 1. `45_front` (45 องศาหน้า)<br>2. `45_Back` (45 องศาหลัง)<br>3. `Back` (หลังตรง) |
| **FullBodyKits** (ในแท็บ Body Kit) | **4 มุม** | 1. `45_front` (45 องศาหน้า)<br>2. `front` (หน้าตรง)<br>3. `45_Back` (45 องศาหลัง)<br>4. `Back` (หลังตรง) |

### โครงสร้างการจัดเก็บไฟล์ใน Supabase Storage (`catalog` bucket):
```text
catalog/
└── brands/
    └── {brand_slug}/
        └── {car_model_slug}/
            ├── bodykits/
            │   └── {tuning_brand}/
            │       └── {kit_slug}/
            │           ├── 45_front.png
            │           ├── front.png
            │           ├── 45_Back.png
            │           └── Back.png
            └── parts/
                ├── front_bumper/
                │   └── {tuning_brand}/
                │       └── {part_slug}/
                │           ├── 45_front.png
                │           └── front.png
                ├── rear_bumper/
                │   └── {tuning_brand}/
                │       └── {part_slug}/
                │           ├── 45_Back.png
                │           └── Back.png
                ├── wheels/
                │   └── {tuning_brand}/
                │       └── {part_slug}/
                │           ├── 45_front.png
                │           └── 45_Back.png
                └── spoilers/
                    └── {tuning_brand}/
                        └── {part_slug}/
                            ├── 45_front.png
                            ├── 45_Back.png
                            └── Back.png
```

---

## 🛠️ รายละเอียดการเขียนโค้ดทั้ง 3 ไฟล์หลัก

### 1. `src/app/features/admin/edit-data/admin-edit-data.html`

#### A. แท็บ Body Kit (`partTab() === 'bodykit'`):
- **Step 1 (เมื่อ `selectedTuningBrand() === null`)**:
  - การ์ด 1: `(+) เพิ่มแบรนด์` (Text Typography + ไอคอนบวก)
  - การ์ด 2+: รายชื่อแบรนด์สำนักแต่ง (Typography สีขาวตัวหนา ไม่มีรูปโลโก้เด็ดขาด + ปุ่มลบแบรนด์พร้อมยืนยัน)
- **Step 2 (เมื่อ `selectedTuningBrand() !== null`)**:
  - Breadcrumb ด้านบน: `แบรนด์ของแต่ง: {selectedTuningBrand()}` + ปุ่ม `ย้อนกลับไปเลือกแบรนด์`
  - การ์ด 1: แบรนด์ที่เลือก — กรอบสีเขียว `border-2 border-emerald-500/60`, แสดงชื่อแบรนด์, ข้อความ `คลิกเพื่อแก้ไขชื่อ`, **ไม่มีรูปโลโก้**, คลิกแล้วเปิด `openEditTuningBrandModal(selectedTuningBrand()!)`
  - การ์ด 2: ปุ่ม `(+) เพิ่มชิ้นส่วน`
  - การ์ด 3+: รายการชุดแต่ง — คลิกการ์ดแล้วเปิด `openEditPartModal(part)` เพื่อแก้ไขชื่อ/ราคา/รูปภาพ + ปุ่มถังขยะลบชิ้นส่วน

#### B. แท็บ Part (`partTab() === 'parts'`):
- **Step 1: เลือกหมวดหมู่ (`partStep() === 'category'`)**:
  - แสดง Grid 4 หมวดมาตรฐาน: `Front Bumper`, `Rear Bumper`, `Wheels`, `Spoilers`
  - **ล็อคตายตัว 4 หมวด — ห้ามมีปุ่มเพิ่ม/ลบหมวดหมู่**
  - คลิกที่การ์ดหมวดหมู่ $\rightarrow$ เรียก `selectCategory(cat)`
- **Step 2: เลือกแบรนด์ (`partStep() === 'brand'`)**:
  - Breadcrumb: `หมวดหมู่: {selectedCategory()}` + ปุ่ม `ย้อนกลับไปเลือกหมวดหมู่`
  - การ์ด 1: `(+) เพิ่มแบรนด์` (เฉพาะชื่อแบรนด์ ไม่มีให้อัปโหลดโลโก้)
  - การ์ด 2+: แบรนด์ในหมวดนี้ (Typography ตัวหนา ไม่มีรูปโลโก้ + ปุ่มลบแบรนด์)
  - คลิกที่การ์ดแบรนด์ $\rightarrow$ เรียก `selectPartBrand(brandName)`
- **Step 3: รายการชิ้นส่วน (`partStep() === 'items'`)**:
  - Breadcrumb: `หมวด: {selectedCategory()} > แบรนด์: {selectedTuningBrand()}` + ปุ่ม `ย้อนกลับไปเลือกแบรนด์`
  - การ์ด 1: แบรนด์ที่เลือก — กรอบเขียว `border-2 border-emerald-500/60`, ข้อความชื่อแบรนด์, `คลิกเพื่อแก้ไขชื่อ`, ไม่มีรูปโลโก้, คลิกเปิด `openEditTuningBrandModal(...)`
  - การ์ด 2: `(+) เพิ่มชิ้นส่วน`
  - การ์ด 3+: รายการชิ้นส่วน Part จริง — แสดงรูป + ชื่อ + ราคา, คลิกการ์ดเปิด `openEditPartModal(part)` + ปุ่มลบชิ้นส่วน

#### C. Modals สำหรับ Multi-Angle Upload และ Edit Part:
- **`partModalOpen` (Modal เพิ่มชิ้นส่วน)**:
  - แสดง Dropzones อัปโหลดรูปตามมุมที่จำเป็นของหมวดนั้นๆ ผ่าน `getRequiredAngles()`:
    ```html
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      @for (ang of getRequiredAngles(); track ang.key) {
        <div class="border border-white/10 rounded-xl p-3 bg-white/[.02]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-white">{{ ang.label }}</span>
            <span class="text-[10px] text-stone-400">({{ ang.key }})</span>
          </div>
          <div class="relative border border-dashed border-white/20 hover:border-white/40 rounded-lg p-3 text-center cursor-pointer transition-colors">
            <input
              type="file"
              accept="image/*"
              class="absolute inset-0 opacity-0 cursor-pointer"
              (change)="onPartAngleFileChange(ang.key, $event)"
            />
            @if (newPartAngleFiles()[ang.key]) {
              <div class="text-xs text-emerald-400 font-semibold truncate">
                {{ newPartAngleFiles()[ang.key]?.name }}
              </div>
            } @else {
              <div class="text-[11px] text-stone-400">
                คลิกเพื่อเลือกไฟล์ (หรือลากมาวาง)
              </div>
            }
          </div>
        </div>
      }
    </div>
    ```
- **`editPartModalOpen` (Modal แก้ไขชิ้นส่วน In-place)**:
  - ช่องกรอกชื่อชิ้นส่วน `editingPartName`
  - ช่องกรอกราคา `editingPartPrice`
  - Dropzones สำหรับเปลี่ยนรูปแต่ละมุม (หากไม่เลือกไฟล์ใหม่ ให้คงรูปเดิมไว้)
  - ปุ่ม "บันทึกการแก้ไข" เรียก `saveEditPart()`

---

### 2. `src/app/features/admin/edit-data/admin-edit-data.ts`

- **Signals และ State ของ Part 3-Step Flow**:
  ```typescript
  readonly partStep = signal<'category' | 'brand' | 'items'>('category');
  readonly availableCategories = signal<string[]>([
    'Front Bumper',
    'Rear Bumper',
    'Wheels',
    'Spoilers',
  ]);
  ```
- **Helper คำนวณจำนวนแบรนด์ในแต่ละหมวด**:
  ```typescript
  tuningBrandsForPartCategory(category: string): string[] {
    const car = this.selectedCar();
    if (!car) return [];
    const cat = category.toLowerCase();
    const fromWorkshops = this.workshopBrands().parts.map((w) => w.name);
    const relevantParts = this.admin.catalogParts().filter((p) => {
      const isMatchCar =
        (p.car_model_id || p.carId) === car.id || (p.car_model_id || p.carId) === car.name;
      if (!isMatchCar) return false;
      return !this.isBodyKitCategory(p.category) && p.category.toLowerCase() === cat;
    });
    const fromParts = relevantParts.map((p) => (p.manufacturer || 'Custom').trim()).filter(Boolean);
    return Array.from(new Set([...fromWorkshops, ...fromParts]));
  }
  ```
- **ฟังก์ชันคืนค่ามุมมองที่จำเป็นตามหมวดหมู่ (`getRequiredAngles`)**:
  ```typescript
  getRequiredAngles(category?: string): { key: string; label: string }[] {
    const isBodyKit = this.partTab() === 'bodykit';
    if (isBodyKit) {
      return [
        { key: '45_front', label: '45 องศาหน้า' },
        { key: 'front', label: 'หน้าตรง' },
        { key: '45_Back', label: '45 องศาหลัง' },
        { key: 'Back', label: 'หลังตรง' },
      ];
    }

    const cat = (category || this.selectedCategory() || this.newPartCategory()).toLowerCase().replace(/[\s_-]+/g, '');
    switch (cat) {
      case 'frontbumper':
        return [
          { key: '45_front', label: '45 องศาหน้า' },
          { key: 'front', label: 'หน้าตรง' },
        ];
      case 'rearbumper':
        return [
          { key: '45_Back', label: '45 องศาหลัง' },
          { key: 'Back', label: 'หลังตรง' },
        ];
      case 'wheels':
        return [
          { key: '45_front', label: '45 องศาหน้า' },
          { key: '45_Back', label: '45 องศาหลัง' },
        ];
      case 'spoilers':
        return [
          { key: '45_front', label: '45 องศาหน้า' },
          { key: '45_Back', label: '45 องศาหลัง' },
          { key: 'Back', label: 'หลังตรง' },
        ];
      default:
        return [
          { key: '45_front', label: '45 องศาหน้า' },
          { key: 'front', label: 'หน้าตรง' },
        ];
    }
  }
  ```
- **ฟังก์ชันแก้ไข Part In-place**:
  ```typescript
  readonly editingPart = signal<PartItem | null>(null);
  readonly editingPartName = signal('');
  readonly editingPartPrice = signal<number | null>(null);
  readonly editPartAngleFiles = signal<Record<string, File>>({});

  openEditPartModal(part: PartItem): void {
    this.editingPart.set(part);
    this.editingPartName.set(part.name);
    this.editingPartPrice.set(part.price ?? null);
    this.editPartAngleFiles.set({});
    this.editPartModalOpen.set(true);
  }

  async saveEditPart(): Promise<void> {
    const part = this.editingPart();
    const name = this.editingPartName().trim();
    if (!part || !name) return this.showToast('กรุณาระบุชื่อชิ้นส่วน', 'error');

    this.isSubmitting.set(true);
    try {
      let imageUrl = part.image || part.image_url;
      // หากมีการอัปโหลดรูปมุมมองใหม่ ให้อัปโหลดเข้า Storage
      const files = this.editPartAngleFiles();
      const primaryAngle = Object.keys(files)[0];
      if (primaryAngle && files[primaryAngle]) {
        imageUrl = await this.admin.uploadPartAngleFile(files[primaryAngle], part, primaryAngle);
      }

      await this.admin.updateCarPart({
        id: part.id,
        name,
        price: this.editingPartPrice() ?? 0,
        image_url: imageUrl,
      });

      this.showToast('แก้ไขข้อมูลชิ้นส่วนเรียบร้อย', 'success');
      this.closeEditPartModal();
    } catch (err: any) {
      this.showToast('เกิดข้อผิดพลาดในการแก้ไขชิ้นส่วน', 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }
  ```

---

### 3. `src/app/features/admin/services/admin.service.ts`

- เพิ่มเมธอดสำหรับอัปเดตข้อมูลชิ้นส่วน:
  ```typescript
  async updateCarPart(payload: { id: string; name: string; price?: number; image_url?: string }): Promise<void> {
    const existing = this.catalogParts().find((p) => p.id === payload.id);
    if (!existing) return;

    const updated = {
      ...existing,
      name: payload.name,
      price: payload.price !== undefined ? payload.price : existing.price,
      image_url: payload.image_url || existing.image_url,
      image: payload.image_url || existing.image,
    };

    // อัปเดตข้อมูลใน Catalog Storage และ Local Signal Store
    await this.catalogStorage.updatePart(updated);
    this.catalogParts.update((list) => list.map((p) => (p.id === payload.id ? updated : p)));
  }
  ```

---

## 🧪 การตรวจสอบและการรันเทสต์ (Verification Checklist)

เมื่อดำเนินการเขียนโค้ดตามคู่มือนี้แล้ว ให้รันคำสั่งตรวจสอบ:
```bash
npx tsc --noEmit
npm test -- --watch=false
```
**เกณฑ์ความสำเร็จ (Pass Criteria):**
- [x] TypeScript ไม่มีข้อผิดพลาด (0 errors)
- [x] Test Files ทั้งหมด 22 ไฟล์ 167 เทสต์ ผ่าน 100%
- [x] หน้า Body Kit ยังคงแสดงผลแบบ Sano-Design (ไม่มีรูปโลโก้, การ์ดแรกแก้ไขชื่อได้, การ์ด 2 เป็น (+) เพิ่มชิ้นส่วน, ชิ้นส่วนคลิกแก้ไขได้)
- [x] หน้า Part ล็อค 4 หมวดหมู่มาตรฐาน ไม่มีปุ่มเพิ่ม/ลบหมวดหมู่
- [x] Modal เพิ่มและแก้ไขชิ้นส่วนแสดงช่องอัปโหลด Multi-Angle ครบถ้วนตาม Requirement ของแต่ละหมวด
