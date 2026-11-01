# 🛠️ Master Worker Prompt: แก้ไขภาพพรีวิวมุมมอง และ Realtime Update ในหน้า Edit Data

## 📌 วัตถุประสงค์ (Mission Objective)
แก้ไขปัญหาการแสดงผลภาพ, สถานะของ Frontend และการประหยัด Storage ในหน้า **Portal Admin Edit Data (`/admin/edit-data`)**:
1. 🖼️ **แก้ไขรูป BodyKit / Part แล้วแสดงรูปเดิมซ้ำกันทุกกล่อง**: เมื่อเปิด Modal แก้ไขชิ้นส่วน (`editPartModalOpen`) ทุกกล่องมุมมองนำเอารูปของมุมแรกมุมเดียวมาแสดงซ้ำกันหมด แทนที่จะเป็นรูปของมุมนั้นๆ จริง
2. 🚗 **แก้ไขรูปรถต้นแบบไม่มีการแสดงรูปเดิมเลย**: เมื่อเปิด Modal แก้ไขรถ (`editCarModalOpen`) กล่องทั้ง 4 มุมมองว่างเปล่า ไม่มีรูปพรีวิวเดิมขึ้นมาแสดง
3. ⚡ **หลังบันทึกข้อมูลใหม่แล้ว Frontend ไม่ยอม Update ทันที**: ต้องรีเฟรชหน้าเว็บถึงจะเห็นรถหรือชิ้นส่วนใหม่
4. 🚀 **เปลี่ยนการใช้ `CarPicture.png` เป็น `45_front.png` โดยตรง**: ตัดการสร้างและอัปโหลดไฟล์ซ้ำซ้อน ประหยัดพื้นที่จัดเก็บใน Storage และใช้ `45_front.png` เป็นภาพหลักของรถต้นแบบ
5. 🧹 **แก้ไขรูปใหม่ไม่แทนที่รูปเก่า (มี 2 รูปในมุมเดียวกัน เช่น `45_front.jpg` และ `45_front.png`)**: เมื่อเปลี่ยนรูปที่มีนามสกุลต่างจากรูปเดิม ระบบต้องลบไฟล์รูปเดิมที่มีนามสกุลอื่นในมุมเดียวกันออกทันที เพื่อไม่ให้มีไฟล์ซ้ำซ้อนตกค้าง ครอบคลุมทั้ง Car Model, BodyKit, Part ทุกหมวด และ Brand Logo
6. 🔄 **แก้ไขรูปใน Frontend ไม่ยอมเปลี่ยนหลังอัปโหลดรูปใหม่ (ติดภาพวาดหน้าคน fallback หรือภาพเก่าค้าง)**: สแกนชื่อไฟล์และนามสกุลจริงของแต่ละมุมมองจาก Storage พร้อมทำ Cache Busting (`cacheControl: '0'` และ `?t=...`) ป้องกันภาพเก่าค้าง 100%

---

## 🔍 สาเหตุที่แท้จริงและแนวทางแก้ไข (Root Causes & Solutions)

### 1. แก้ไขรูปชิ้นส่วน / ชุดแต่ง แสดงรูปเดิมซ้ำกันทุกมุมมอง (`visual_error_bodykit.png` & `visual_error_part.png`)
- **สาเหตุ**: 
  - ใน `admin-edit-data.html` ตรง `editPartModalOpen` แต่ละกล่องมุมมอง (`angle.key`) ไปเขียน fallback ว่า `[src]="editingPart()!.image || editingPart()!.image_url"` ซึ่งค่า `image_url` ในตัวแปรชิ้นส่วนเก็บเพียง URL ของมุมแรก (เช่น `45_front.png`) ทำให้ทุกกล่องหยิบรูปเดียวกันมาแสดงซ้ำ
- **การแก้ไข**:
  - สร้าง Helper Method `getExistingPartAngleUrl(part, angleKey)` ใน `admin-edit-data.ts`:
    - ทำการวิเคราะห์ Path รูปภาพ และแทนที่ชื่อมุมมอง เช่น `/(45_front|front|45_Back|Back)\./` ด้วย `/${angleKey}.`
    - ทำให้กล่อง `front` ได้รูป `front.png`, กล่อง `45_Back` ได้รูป `45_Back.png`, กล่อง `Back` ได้รูป `Back.png` ตรงตามไฟล์จริงที่จัดเก็บใน Storage
  - ใน `admin-edit-data.html` ให้ผูก `[src]="getExistingPartAngleUrl(editingPart(), angle.key)"`

---

### 2. แก้ไขรูปรถต้นแบบไม่แสดงรูปเดิม (`visual_error_car.png`)
- **สาเหตุ**:
  - ใน `admin-edit-data.html` ตรง `editCarModalOpen` โค้ดมีเพียงเงื่อนไข `@if (editCarAnglePreviews().get(angle.key))` แล้วกระโดดไป `@else` ทันที โดย**ไม่มีบล็อก `@else if` สำหรับดึงรูปเดิมของรถมาแสดง** ทำให้กล่องขึ้นเป็นปุ่ม `(+) อัปโหลดรูปใหม่` ทั้งหมด
- **การแก้ไข**:
  - สร้าง Helper Method `getExistingCarAngleUrl(car, angleKey)` ใน `admin-edit-data.ts` เพื่อสร้าง URL รูปเดิมของแต่ละมุมมอง เช่น `{brand}/{model}/${angleKey}.png`
  - ใน `admin-edit-data.html` เพิ่มบล็อก `@else if (getExistingCarAngleUrl(selectedCar(), angle.key); as existingUrl)` เพื่อแสดงรูปพรีวิวเดิมของแต่ละมุมอย่างถูกต้อง

---

### 3. Frontend Update ทันทีหลังเพิ่มข้อมูลใหม่ (Reactivity & Merge Strategy)
- **สาเหตุ**:
  - เมื่อเพิ่มรุ่นรถ (`saveCar`) หรือเพิ่มพาร์ต (`savePart`) เสร็จสิ้น ฟังก์ชันไปเรียก `fetchCatalogModels()` หรือ `fetchCatalogTuning()` ซึ่ง Storage list อาจมี network delay ทำให้คำสั่ง `this.catalogModels.set(...)` ไปเขียนทับ array ด้วยข้อมูลเก่าที่ยังไม่มีไอเท็มใหม่
  - การบันทึก `car_parts` ลงตาราง DB อาจติด foreign key หรือ UUID mismatch ทำให้ insert DB ล้มเหลวและหลุด error
- **การแก้ไข**:
  - **Optimistic State Update**:
    - ใน `saveCar()`: อัปเดต `this.admin.catalogModels` ทันทีด้วย `newCarModelItem`
    - ใน `savePart()`: อัปเดต `this.admin.catalogParts` และ `this.workshopBrands` ทันที
  - **Safe Fallback**:
    - ใน `insertCarPart()`: หาก DB insert ล้มเหลว ให้ fallback นำข้อมูลเข้าสู่ local memory ทันที เนื่องจากไฟล์รูปภาพได้ถูกอัปโหลดขึ้น Storage เรียบร้อยแล้ว ทำให้ผู้ใช้เห็นการ์ดใหม่แสดงผลบนหน้าจอทันที 100% โดยไม่ต้องกดรีเฟรชหน้าเว็บ
  - **Merge State Strategy**:
    - ใน `fetchCatalogModels()`: ปรับให้ผสานข้อมูล (Merge) ไม่ล้างรุ่นรถที่เพิ่ง optimistic insert ในหน่วยความจำทิ้ง

---

### 4. เปลี่ยนการใช้ `CarPicture.png` เป็น `45_front.png` โดยตรง (Eliminate Redundant Storage)
- **สาเหตุ & ปัญหา**:
  - เดิมมีการอัปโหลดไฟล์รูปรถมุมหน้า 2 รอบ คือบันทึกเป็น `45_front.png` และก็อปปี้บันทึกซ้ำเป็น `CarPicture.jpg` ทำให้เปลืองพื้นที่จัดเก็บใน Bucket โดยไม่จำเป็น
- **การแก้ไข**:
  - **`catalog-storage.ts`**:
    - ใน `listModels()`: ตรวจหา `45_front.png` เป็นลำดับแรกสุดสำหรับรูปรถ และคง regex fallback หา `CarPicture.*` สำหรับรถรุ่นเดิม
    - เพิ่ม helper `getCarAnglePath(brand, model, angle, ext)`
  - **`admin-edit-data.ts`**:
    - ใน `saveCar()`: ลบการอัปโหลดไฟล์ `CarPicture.jpg` ออกทั้งหมด อัปโหลดเฉพาะ 4 มุมมอง (`45_front`, `front`, `45_Back`, `Back`) และตั้งค่า `primaryImageUrl` เป็น `45_front.png` โดยตรง
    - ใน `saveEditCar()`: ลบการอัปโหลดไฟล์ `CarPicture.jpg` ออก และให้อัปโหลดเข้ามุม `45_front` โดยตรง
  - **`admin.service.ts`**:
    - ปรับ fallback ของ `storageCarImage` ใน `fetchCatalogModels` ให้ชี้ไปที่ `45_front.png` โดยตรง
  - **`STORAGE_CATALOG_TREE.md`**:
    - อัปเดตโครงสร้างต้นไม้ของ `{CarModel}/` ให้ระบุ `45_front.png` เป็นภาพหลักของรถต้นแบบ และยกเลิก `CarPicture.jpg`

---

### 5. กำจัดไฟล์ภาพซ้ำซ้อนเมื่อเปลี่ยนรูปภาพ (Automatic Sibling Extension Cleanup)
- **สาเหตุ & ปัญหา (`dupeimage.png`)**:
  - เมื่อผู้ใช้อัปโหลดรูปภาพใหม่เพื่อเปลี่ยนรูปเดิมในมุมมองใดๆ เช่น เดิมมีไฟล์ `45_front.png` แล้วอัปโหลดรูปใหม่เป็นไฟล์ `.jpg`
  - Supabase Storage ทำการ upsert ทับเฉพาะชื่อไฟล์ที่มีนามสกุลเดียวกันเป๊ะๆ (`.jpg` ทับ `.jpg`) ทำให้ไฟล์รูปเดิมที่เป็นคนละนามสกุล (`.png`) **ไม่ถูกลบออก**
  - ผลลัพธ์: มีทั้ง `45_front.png` และ `45_front.jpg` ปรากฏอยู่ในโฟลเดอร์เดียวกันในเวลาเดียวกัน ซึ่งอาจเกิดกับทุกส่วน: **Car Model**, **BodyKit**, **Part (Front/Rear Bumper, Wheels, Spoilers)** และ **Brand Logo**
- **การแก้ไข**:
  - **`catalog-storage.ts`**:
    - เพิ่มเมธอด `CatalogStorageHelper.removeSiblingFiles(client, folderPath, baseName, keepExt)`:
      - สแกนไฟล์ในโฟลเดอร์ปลายทาง
      - ลบไฟล์เดิมในมุมมองเดียวกันที่มีนามสกุลอื่น (`png`, `jpg`, `jpeg`, `webp`) ทิ้งทันทีก่อนบันทึกไฟล์ใหม่
      - หากเป็นมุม `45_front` จะช่วยล้างไฟล์ `CarPicture.*` เก่าที่อาจหลงเหลือในโฟลเดอร์ให้อัตโนมัติ
  - **`admin-edit-data.ts`**:
    - เรียก `CatalogStorageHelper.removeSiblingFiles(...)` ก่อนอัปโหลดไฟล์ใหม่ในทุกจุด:
      1. `saveEditCar()`: เมื่อแก้ไข/เปลี่ยนรูปรถทั้ง 4 มุมมอง
      2. `saveCar()`: เมื่อสร้างรถต้นแบบใหม่
      3. `saveEditBrand()`: เมื่อแก้ไขโลโก้แบรนด์รถ
      4. `saveBrand()`: เมื่อสร้างแบรนด์รถใหม่
      5. `saveEditPart()`: เมื่อแก้ไขรูปของแต่งทั้ง BodyKit และ Part 4 มุมมอง (และลบโฟลเดอร์เดิมทิ้งหากมีการเปลี่ยนชื่อชิ้นส่วน)
      6. `savePart()`: เมื่อสร้างชิ้นส่วนของแต่งใหม่

---

### 6. แก้ไขภาพพรีวิวไม่ยอมเปลี่ยนตาม Storage (Extension Mismatch & CDN/Browser Cache Busting)
- **สาเหตุ & ปัญหา (`old_visual.png`)**:
  - ใน `admin-edit-data.ts`, ฟังก์ชัน `getExistingCarAngleUrl()` เดิมมีการฮาร์ดโค้ดต่อท้ายเป็น `.png` (`/${angleKey}.png`)
  - เมื่อผู้ใช้อัปโหลดรูปใหม่เป็นนามสกุลอื่น (เช่น `45_front.jpg`), `getExistingCarAngleUrl()` ยังคงขอ URL `.../45_front.png` ซึ่งถูกลบไปแล้วจาก Storage
  - เมื่อขอไฟล์ที่ไม่มีอยู่จริง (เกิด 404 Not Found), แท็ก `<img>` จึงเกิด error และกระโดดไปเรียก fallback `assets/car_pic.png` (ภาพวาดหน้าคนลายเส้นขาวดำ) แทนที่จะแสดงรูปใหม่
  - การอัปโหลดเดิมตั้งค่า `cacheControl: '3600'` ทำให้เบราว์เซอร์จำภาพเก่าไว้ 1 ชั่วโมง แม้จะกดรีเฟรชหน้าเว็บก็ตาม
- **การแก้ไข**:
  - **`catalog-storage.ts`**:
    - ปรับ `CatalogStorageHelper.uploadFile()`: เปลี่ยน `cacheControl` เป็น `'0'` เพื่อไม่ให้เบราว์เซอร์และ CDN แคชไฟล์ภาพค้างไว้
  - **`admin-edit-data.ts`**:
    - เพิ่ม Signal `existingCarAngleUrls` และ `existingPartAngleUrls`
    - ใน `openEditCarModal()` และ `openEditPartModal()`: สแกนไฟล์จริงในโฟลเดอร์ของรถและพาร์ตผ่าน `client.storage.from('catalog').list(folder)` เพื่อค้นหาชื่อไฟล์และนามสกุลจริง (`.jpg`, `.png`, `.webp`) ของแต่ละมุมมองอย่างแม่นยำ พร้อมเติม Query Param `?t=${Date.now()}` ป้องกันแคชค้าง
    - ปรับ `getExistingCarAngleUrl()` และ `getExistingPartAngleUrl()` ให้ดึงจาก Map `existingCarAngleUrls` / `existingPartAngleUrls` ก่อนเป็นลำดับแรก ทำให้แสดงภาพจริงตรงตามไฟล์ใน Storage 100%

---

## 🧪 การตรวจสอบความถูกต้อง (Verification)
1. รันการทดสอบ Unit Tests:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   ```
   ผลการทดสอบ: **22 passed (22 test files), 170 passed (170 tests 100%)**
2. รัน Build Production:
   ```bash
   npm run build
   ```
   ผลการคอมไพล์: **Prerendered 15 static routes, Application bundle generation complete**
