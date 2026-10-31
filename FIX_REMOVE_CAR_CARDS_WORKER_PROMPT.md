# 🛠️ WORKER PROMPT: Remove Unwanted Car Model Cards from BodyKit and Part Category Grids

> **อ้างอิงภาพข้อผิดพลาด**:
> - [`fix list/bodykit_error.png`](../fix%20list/bodykit_error.png) (การ์ดรูปรถ 458-Italia ที่วงสีแดงในหน้าสำนักแต่ง Body Kit)
> - [`fix list/part_error.png`](../fix%20list/part_error.png) (การ์ดรูปรถ 458-Italia ที่วงสีแดงในหน้าหมวดหมู่ Part Categories)

---

## 📌 ปัญหาที่พบ (Issue Summary)
ในหน้า Admin Edit Data (`/admin/edit-data`) มีการนำเอาการ์ดรูปรถ (`458-Italia` / `selectedCar()`) ไปใส่ไว้เป็น Card 1 ภายใน Grid ของ:
1. **สำนักแต่ง Body Kit (Tuning Brands)** ตามภาพ `bodykit_error.png`
2. **หมวดหมู่ชิ้นส่วน (Part Categories)** ตามภาพ `part_error.png`

ซึ่งด้านบนของทั้งสองหน้ามี **แบนเนอร์แสดงรูปรถขนาดใหญ่ (Wide Car Showcase Banner)** อยู่แล้ว การนำการ์ดรถซ้ำเข้ามาไว้ในการ์ดแรกของ Grid จึงไม่ถูกต้องและไม่เกี่ยวข้องกับสองหน้านี้

---

## 🎯 งานที่ต้องแก้ไข (Action Items)

### 1. ลบ Card 1 (`selectedCar()`) ออกจาก Grid ใน `admin-edit-data.html`
- **ในแท็บ Body Kit**:
  - ลบโค้ดบล็อก `@if (selectedCar(); as car) { ... }` ออกจากการ์ดแรกของ Grid `สำนักแต่ง Body Kit (Tuning Brands)`
  - ให้ Card 1 เริ่มต้นด้วยปุ่ม **`(+) เพิ่มแบรนด์`** ทันที ตามด้วยการ์ดสำนักแต่งจริง
- **ในแท็บ Part**:
  - ลบโค้ดบล็อก `@if (selectedCar(); as car) { ... }` ออกจากการ์ดแรกของ Grid `หมวดหมู่ชิ้นส่วน (Part Categories)`
  - ให้ Card 1 เริ่มต้นด้วยปุ่ม **`(+) เพิ่มหมวดหมู่`** ทันที ตามด้วยการ์ดหมวดหมู่จริง (`Wheels`, `Spoilers`, `Exhaust` ฯลฯ)

### 2. ปรับตัวเลขคำนวณ Placeholder ใน `admin-edit-data.ts`
- ปรับ `tuningBrandPlaceholders`:
  ```typescript
  readonly tuningBrandPlaceholders = computed(() => {
    const filled = 1 + this.tuningBrandsForCurrentContext().length; // ปรับจาก 2 เป็น 1
    const remaining = Math.max(0, 12 - filled);
    return Array.from({ length: remaining });
  });
  ```
- ปรับ `categoryPlaceholders`:
  ```typescript
  readonly categoryPlaceholders = computed(() => {
    const filled = 1 + this.availableCategories().length; // ปรับจาก 2 เป็น 1
    const remaining = Math.max(0, 12 - filled);
    return Array.from({ length: remaining });
  });
  ```

---

## 🧪 การตรวจสอบผลลัพธ์ (Verification)
1. รัน Unit Tests:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   ```
   - ยืนยันว่า 22 Test Files (165 tests) ผ่าน 100%
2. ตรวจสอบ UI:
   - หน้า Body Kit จะไม่มีการ์ดรูปรถ 458-Italia อยู่ใน Grid เริ่มต้นด้วยปุ่ม `(+) เพิ่มแบรนด์`
   - หน้า Part Categories จะไม่มีการ์ดรูปรถ 458-Italia อยู่ใน Grid เริ่มต้นด้วยปุ่ม `(+) เพิ่มหมวดหมู่`

