# 🛠️ WORKER PROMPT: Admin Edit Data with Supabase Storage `catalog` Bucket

> **เป้าหมาย**: ปรับหน้า **Admin Edit Data** ของ `Performante_Lab_Frontend` ให้ดึงและจัดการข้อมูลแคตตาล็อกทั้งหมด (แบรนด์, รุ่นรถ, สำนักแต่ง, ชุดแต่ง BodyKit และชิ้นส่วนพาร์ต) โดยอ่านและเขียนตรงกับ **Supabase Storage Bucket `catalog`** ตามโครงสร้างมาตรฐานใน [`STORAGE_CATALOG_TREE.md`](../../STORAGE_CATALOG_TREE.md) โดยไม่มีการใช้ Mockup Data

---

## 📌 0. สถานะ Storage Bucket ปัจจุบัน (System Prepared Status)
1. **ขนาด Bucket และ Mime Types**:
   - `file_size_limit` ได้รับการปรับเพิ่มเป็น **50 MB** (`52428800` bytes) เรียบร้อยแล้ว
   - `allowed_mime_types`: รองรับ `image/jpeg`, `image/png`, `image/webp`, และ `image/svg+xml`
2. **ข้อมูลเริ่มต้นใน Bucket (`catalog`)**:
   - ได้ทำการ Seed โฟลเดอร์และไฟล์จริงตาม `STORAGE_CATALOG_TREE.md` ครบถ้วนแล้ว:
     - `Ferrari/` (มีรุ่น `488-Pista`, `458-Italia`, BodyKit และ Part)
     - `Toyota/` (มีรุ่น `GT86`, BodyKit และ Part)
     - `Lamborghini/` (มีรุ่น `Revuelto`, BodyKit และ Part)
     - `Honda/` (มีรุ่น `Civic-Type-R`, BodyKit และ Part)

---

## 🌳 1. กฎโครงสร้าง Storage Path (อ้างอิง `STORAGE_CATALOG_TREE.md`)

```text
catalog/
├── {Brand}/                                     # 1. โฟลเดอร์แบรนด์รถ
│   ├── logo.png (หรือ .svg/.jpg)                 # โลโก้แบรนด์
│   │
│   └── {Model}/                                 # 2. โฟลเดอร์รุ่นรถ
│       ├── CarPicture.jpg (หรือ .png)            # รูปรถ
│       │
│       ├── BodyKit/                             # 3.1 ชุดแต่งรอบคัน
│       │   └── {BodyKitBrand}/                  # สำนักแต่ง (เช่น Sano-Design, Novitec)
│       │       ├── logo.png                     # โลโก้สำนักแต่ง
│       │       ├── {BodyKitType1}.png           # ชิ้นงานชุดแต่ง 1
│       │       └── {BodyKitType2}.png           # ชิ้นงานชุดแต่ง 2
│       │
│       └── Part/                                # 3.2 ชิ้นส่วนพาร์ต
│           └── {PartBrand}/                     # ยี่ห้อของแต่ง (เช่น Brembo, Tomei)
│               ├── logo.png                     # โลโก้ยี่ห้อพาร์ต
│               ├── {PartType1}.png              # ชิ้นงานพาร์ต 1
│               └── {PartType2}.png              # ชิ้นงานพาร์ต 2
```

---

## 🎯 2. รายละเอียดงานที่ Worker ต้องแก้ไขใน Frontend

### A. แก้ไข `CatalogStorageHelper` ([`catalog-storage.ts`](src/app/core/storage/catalog-storage.ts))
1. **เพิ่ม Method ดึงรายการจาก Storage**:
   - `listBrands(client)`: เรียก `client.storage.from('catalog').list('', { limit: 100 })` เพื่อดึงชื่อโฟลเดอร์แบรนด์ทั้งหมด (กรองไฟล์ที่ไม่มีโฟลเดอร์ออก)
   - `listModels(client, brand)`: เรียก `client.storage.from('catalog').list(brand, { limit: 100 })` (กรองไฟล์ `logo.*` ออก เหลือเฉพาะโฟลเดอร์รุ่นรถ)
   - `listWorkshops(client, brand, model, type: 'BodyKit' | 'Part')`: ดึงโฟลเดอร์สำนักแต่ง/ยี่ห้อพาร์ต
   - `listItems(client, brand, model, type: 'BodyKit' | 'Part', workshop)`: ดึงรูปชิ้นส่วน (กรอง `logo.*` ออก)
2. **ตรวจหานามสกุลรูปภาพอัตโนมัติ**:
   - สำหรับโลโก้แบรนด์: รองรับทั้ง `logo.png`, `logo.svg`, `logo.jpg`, `logo.webp` โดยดึง Public URL ได้ถูกต้อง
   - สำหรับรูปรถ: รองรับ `CarPicture.jpg`, `CarPicture.png`, `CarPicture.webp`

---

### B. แก้ไข `AdminService` ([`admin.service.ts`](src/app/features/admin/services/admin.service.ts))
1. **`fetchCatalogBrands()`**:
   - ดึงโฟลเดอร์ Root จาก Storage Bucket `catalog`
   - แปลงเป็น `RealBrandItem[]`:
     - `id`: ชื่อโฟลเดอร์แบรนด์ (เช่น `Ferrari`, `Toyota`)
     - `name`: ชื่อแบรนด์ (แสดงตามชื่อโฟลเดอร์)
     - `logo_url` / `logoUrl`: Public URL ของ `catalog/{brand}/logo.png` (หรือ `.svg`)
2. **`fetchCatalogModels(brandName: string)`**:
   - ดึงโฟลเดอร์ใน `catalog/{brandName}`
   - กรองเอาเฉพาะโฟลเดอร์รุ่นรถ (ตัดไฟล์ `logo.*` ออก)
   - แปลงเป็น `RealCarModelItem[]`:
     - `name`: ชื่อโฟลเดอร์รุ่น (เช่น `488-Pista`, `GT86`)
     - `image_url` / `image`: Public URL ของ `catalog/{brandName}/{modelName}/CarPicture.jpg`
3. **`fetchCatalogTuning(brandName, modelName)`**:
   - ดึงรายการสำนักแต่งและชิ้นส่วนของทั้ง `BodyKit/` และ `Part/`
   - รวบรวมข้อมูลสำนักแต่งพร้อมโลโก้ `logo.png` และรายการสินค้าตามชิ้นส่วน
4. **การเพิ่ม/แก้ไขข้อมูล (Add / Edit)**:
   - **เพิ่มแบรนด์ใหม่**: รับรูปโลโก้ที่ Admin อัปโหลด บังคับอัปโหลดขึ้น `catalog/{Brand}/logo.{ext}`
   - **เพิ่มรุ่นรถใหม่**: รับรูปรถที่ Admin อัปโหลด บังคับอัปโหลดขึ้น `catalog/{Brand}/{Model}/CarPicture.{ext}`
   - **เพิ่มสำนักแต่ง/ยี่ห้อพาร์ต**: รับโลโก้ บังคับอัปโหลดขึ้น `catalog/{Brand}/{Model}/{BodyKit|Part}/{Workshop}/logo.{ext}`
   - **เพิ่มชิ้นส่วน/ชุดแต่ง**: รับรูป บังคับอัปโหลดขึ้น `catalog/{Brand}/{Model}/{BodyKit|Part}/{Workshop}/{TypeName}.{ext}`
   - **แก้ไขแบรนด์/รุ่นรถ**: หากมีการอัปโหลดรูปใหม่ ให้อัปโหลดทับ (`upsert: true`) ถ้าไม่มีให้คงรูปเดิม

---

### C. แก้ไข `AdminEditDataComponent` ([`admin-edit-data.ts`](src/app/features/admin/edit-data/admin-edit-data.ts) & [`admin-edit-data.html`](src/app/features/admin/edit-data/admin-edit-data.html))
1. **Level 1 (หน้าเลือก Brand)**:
   - แสดงช่อง Search Brand ค้นหาแบบเรียลไทม์
   - ป๊อปอัปเพิ่มแบรนด์: มีเฉพาะช่องกรอกชื่อแบรนด์ และช่องอัปโหลดรูปโลโก้ (ตัดช่อง Link และ Checkbox ออก)
   - เมื่อเพิ่มแบรนด์สำเร็จ เรียก `fetchCatalogBrands()` โหลดข้อมูลสดจาก Storage ทันที
2. **Level 2 (หน้าเลือก รุ่นรถ)**:
   - คลิกที่ Brand Card ด้านบน จะเปิด Modal แก้ไขแบรนด์ (เปลี่ยนชื่อ / อัปโหลดโลโก้ใหม่)
   - ป๊อปอัปเพิ่มรุ่นรถ: มีเฉพาะช่องกรอกชื่อรุ่น และช่องอัปโหลดรูปรถ (ตัดช่อง Link และ Body Type ออก)
   - เมื่อเพิ่มรุ่นสำเร็จ เรียก `fetchCatalogModels(brand)` ทันที
3. **Level 3 (หน้าเลือก ของแต่งรถ)**:
   - แบนเนอร์รูปรถด้านบน เมื่อคลิกจะเปิด Modal แก้ไขชื่อรุ่นรถและรูปรถ
   - แถบแท็บแยกชัดเจน: **ชุดแต่งรอบคัน (BodyKit)** และ **ชิ้นส่วนอะไหล่ (Part)**
   - แต่ละหมวดหมู่:
     - แสดงรายชื่อสำนักแต่ง/ยี่ห้อของแต่งก่อน พร้อมโลโก้ของสำนักนั้น
     - มีปุ่ม **"+ เพิ่มแบรนด์ของแต่ง"** (มีช่องใส่ชื่อแบรนด์ + บังคับอัปโหลดรูปโลโก้)
     - เมื่อเลือกสำนักแต่งแล้ว จะแสดงรายการชิ้นส่วนพาร์ตทั้งหมดของสำนักนั้น พร้อมปุ่ม **"+ เพิ่มชิ้นส่วน"**

---

## 🧪 3. การตรวจสอบความถูกต้อง (Verification Checklist)
1. **ทดสอบ Unit Tests**:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   ```
   - เทสต์ทุกไฟล์ต้องผ่าน 100% (Green)
2. **ไม่มี Mockup Data**:
   - ข้อมูลแบรนด์, รุ่นรถ, สำนักแต่ง และพาร์ตทั้งหมดต้องมาจาก Supabase Storage `catalog` เท่านั้น
3. **ไม่มี Ferrari Hardcoded Fallback**:
   - ห้ามมี fallback `(error)="$any($event.target).src = 'assets/brands/ferrari.png'"` หรือ fallback รถ Ferrari สีแดงสำหรับรถทุกคันอีกต่อไป

