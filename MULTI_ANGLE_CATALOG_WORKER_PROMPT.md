# 🛠️ WORKER PROMPT: Admin Edit Data — Multi-Angle Part Asset Requirements & Streamlined Brand Display

> **เอกสารอ้างอิงหลัก**:
> - โฟลเดอร์: [`fix list/`](../fix%20list/)
> - ภาพหน้า Part Categories เดิม: [`fix list/old_part_select.png`](../fix%20list/old_part_select.png)
> - แผนผัง Storage Catalog: [`STORAGE_CATALOG_TREE.md`](../../STORAGE_CATALOG_TREE.md)

---

## 📌 สรุปความต้องการจากผู้ใช้ (Requirements Summary)

1. **เอารูปยี่ห้อ BodyKit และ Part ออกทั้งหมด**:
   - ไม่ต้องมีรูปโลโก้สำหรับยี่ห้อสำนักแต่ง (BodyKit Brands) และยี่ห้อพาร์ต (Part Brands)
   - แสดงเฉพาะ **ชื่อยี่ห้อ (Brand Name)** ด้วยตัวอักษร Typography สวยงาม ชัดเจน
   - ใน Modal เพิ่ม/แก้ไขแบรนด์ของแต่ง ให้ตัดช่องอัปโหลดไฟล์รูปโลโก้ออก เหลือเฉพาะช่องกรอกชื่อแบรนด์

2. **ล็อคหน้าเลือก Part ให้มีเฉพาะ 4 หมวดหมู่มาตรฐาน (อ้างอิง `old_part_select.png`)**:
   - ล็อคให้มีเพียง 4 หมวดหมู่นี้เท่านั้น:
     1. **`Front Bumper`** (กันชนหน้า)
     2. **`Rear Bumper`** (กันชนหลัง)
     3. **`Wheels`** (ล้อแม็ก)
     4. **`Spoilers`** (สปอยเลอร์ / วิงหลัง)
   - **ตัดปุ่ม `(+) เพิ่มหมวดหมู่` ออกไปทั้งหมด**
   - **ตัดปุ่มลบหมวดหมู่ออกไปทั้งหมด** (ไม่สามารถเพิ่มหรือลบหมวดหมู่ได้อีก)

3. **ข้อกำหนดการอัปโหลดรูปภาพตามมุมมองของรถ (Multi-Angle Views Requirement)**:
   เมื่อเพิ่มชิ้นส่วนใหม่ในแต่ละหมวด ให้แสดงฟิลด์อัปโหลดรูปตามมุมมองที่จำเป็นสำหรับระบบ 3D/Angle Visualizer:
   - 🔹 **Front Bumper**:
     - `45_front` (45 องศาหน้า)
     - `front` (หน้าตรง)
   - 🔹 **Rear Bumper**:
     - `45_Back` (45 องศาหลัง)
     - `Back` (หลังตรง)
   - 🔹 **Wheels**:
     - `45_front` (45 องศาหน้า)
     - `45_Back` (45 องศาหลัง)
   - 🔹 **Spoilers**:
     - `45_front` (45 องศาหน้า)
     - `45_Back` (45 องศาหลัง)
     - `Back` (หลังตรง)
   - 🔹 **FullBodyKits** (ในแท็บ Body Kit):
     - `45_front` (45 องศาหน้า)
     - `front` (หน้าตรง)
     - `45_Back` (45 องศาหลัง)
     - `Back` (หลังตรง)

4. **อัปเดตโครงสร้าง Storage Tree**:
   - ปรับปรุง [`STORAGE_CATALOG_TREE.md`](../../STORAGE_CATALOG_TREE.md) ให้สะท้อนโครงสร้างโฟลเดอร์และไฟล์ตามมุมมองนี้เรียบร้อยแล้ว

---

## 🌳 โครงสร้าง Path ใน Supabase Storage `catalog` Bucket

```text
catalog/
├── {CarBrand}/                                      # โฟลเดอร์แบรนด์รถ (มี logo.png)
│   ├── logo.png
│   │
│   └── {CarModel}/                                  # โฟลเดอร์รุ่นรถ (มี CarPicture.jpg)
│       ├── CarPicture.jpg
│       │
│       ├── BodyKit/                                 # 1. หมวดชุดแต่งรอบคัน (FullBodyKits)
│       │   └── {BodyKitBrand}/                      # ยี่ห้อสำนักแต่ง (ไม่มี logo.png)
│       │       └── {KitName}/
│       │           ├── 45_front.png
│       │           ├── front.png
│       │           ├── 45_Back.png
│       │           └── Back.png
│       │
│       └── Part/                                    # 2. หมวดชิ้นส่วนแต่ง (ล็อค 4 หมวด)
│           ├── Front-Bumper/
│           │   └── {PartBrand}/
│           │       └── {PartName}/
│           │           ├── 45_front.png
│           │           └── front.png
│           ├── Rear-Bumper/
│           │   └── {PartBrand}/
│           │       └── {PartName}/
│           │           ├── 45_Back.png
│           │           └── Back.png
│           ├── Wheels/
│           │   └── {PartBrand}/
│           │       └── {PartName}/
│           │           ├── 45_front.png
│           │           └── 45_Back.png
│           └── Spoilers/
│               └── {PartBrand}/
│                   └── {PartName}/
│                       ├── 45_front.png
│                       ├── 45_Back.png
│                       └── Back.png
```

---

## 🎯 งานที่ต้องแก้ไขในโค้ด Frontend

### 1. ไฟล์ `src/app/features/admin/edit-data/admin-edit-data.html`
- **การ์ดสำนักแต่ง Body Kit & ยี่ห้อ Part**:
  - ลบแท็ก `<img>` โลโก้ออกทั้งหมด
  - แสดงเฉพาะชื่อแบรนด์ `{{ brandName }}` ตัวหนาตรงกลางการ์ด
- **หน้าเลือก Part Categories (`old_part_select.png`)**:
  - ลบปุ่ม `(+) เพิ่มหมวดหมู่` ออก
  - ลบปุ่มลบถังขยะออกจาก Category Cards
  - แสดงเฉพาะ 4 การ์ด: `Front Bumper`, `Rear Bumper`, `Wheels`, `Spoilers`
- **Modal เพิ่มแบรนด์ของแต่ง (`tuningBrandModalOpen`)**:
  - ตัดช่องอัปโหลดรูปภาพโลโก้ออก เหลือเฉพาะ Input ใส่ชื่อแบรนด์
- **Modal เพิ่ม Part / BodyKit (`partModalOpen`)**:
  - เปลี่ยนจากการอัปโหลดรูปเดียว ให้แสดงกล่องอัปโหลดตามมุมมองที่กำหนดของหมวดหมู่นั้นๆ:
    - ถ้าเป็น **Front Bumper**: แสดงกล่องอัปโหลด 2 มุม (`45 องศาหน้า`, `หน้าตรง`)
    - ถ้าเป็น **Rear Bumper**: แสดงกล่องอัปโหลด 2 มุม (`45 องศาหลัง`, `หลังตรง`)
    - ถ้าเป็น **Wheels**: แสดงกล่องอัปโหลด 2 มุม (`45 องศาหน้า`, `45 องศาหลัง`)
    - ถ้าเป็น **Spoilers**: แสดงกล่องอัปโหลด 3 มุม (`45 องศาหน้า`, `45 องศาหลัง`, `หลังตรง`)
    - ถ้าเป็น **FullBodyKits**: แสดงกล่องอัปโหลดครบ 4 มุม (`45 องศาหน้า`, `หน้าตรง`, `45 องศาหลัง`, `หลังตรง`)

### 2. ไฟล์ `src/app/features/admin/edit-data/admin-edit-data.ts`
- ล็อค `availableCategories`:
  ```typescript
  readonly availableCategories = signal<string[]>([
    'Front Bumper',
    'Rear Bumper',
    'Wheels',
    'Spoilers',
  ]);
  ```
- เพิ่ม Signal จัดเก็บไฟล์รูปภาพแต่ละมุม:
  ```typescript
  readonly partFile45Front = signal<File | null>(null);
  readonly partFileFront = signal<File | null>(null);
  readonly partFile45Back = signal<File | null>(null);
  readonly partFileBack = signal<File | null>(null);
  ```
- ใน `savePart()`:
  - ตรวจสอบไฟล์ตามมุมที่หมวดหมู่นั้นต้องการ
  - ทำการอัปโหลดไฟล์แต่ละมุมเข้า Storage ตาม Path ใน `STORAGE_CATALOG_TREE.md`

### 3. ไฟล์ `src/app/core/storage/catalog-storage.ts`
- เพิ่มฟังก์ชันสร้าง Path สำหรับ Multi-angle Part และ BodyKit:
  ```typescript
  static getPartAnglePath(brand: string, model: string, category: string, partBrand: string, partName: string, angle: string, ext = 'png'): string {
    return `${this.sanitize(brand)}/${this.sanitize(model)}/Part/${this.sanitize(category)}/${this.sanitize(partBrand)}/${this.sanitize(partName)}/${angle}.${ext}`;
  }
  ```

---

## 🧪 การทดสอบและเกณฑ์การตรวจรับ (Verification)
1. รัน Unit Tests:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   ```
   - ทุก Test Files ต้องผ่าน 100%
2. ในหน้าเลือก Part: มีเฉพาะ 4 หมวดหมู่ ไม่มีปุ่มเพิ่มหรือลบหมวดหมู่
3. ในการ์ดแบรนด์ของแต่ง: ไม่มีรูปโลโก้ แสดงเฉพาะชื่อแบรนด์
4. เมื่อกดเพิ่ม Part ในแต่ละหมวดหมู่: ระบบแสดงฟอร์มอัปโหลดมุมมองตรงตามที่ระบุไว้

