# MASTER WORKER PROMPT: Remove Tuning Brand Images and Enforce Text-Only Typography

## 1. Problem Description
ในหน้า **Portal Admin > Edit Data (`/admin/edit-data`)**:
ในส่วนของรายการชิ้นส่วน Body Kit และ Part (เมื่อเลือกแบรนด์ของแต่งเข้ามาแล้ว เช่น Novitec, Mansory):
- **การ์ดแรก (Card 1)** ที่แสดงแบรนด์ที่กำลังเลือกอยู่ (Active Tuning Brand Card ที่มีขอบสีเขียวและจุด pulse) **ยังคงมีกล่องรูปภาพ/โลโก้ (`img` หรือกล่องอักษรย่อ)** อยู่ข้างใน ซึ่งขัดกับ Requirement ที่ต้องการให้แบรนด์ของแต่ง (ทั้ง BodyKit และ Part) **เอาโลโก้ออกทั้งหมด ให้เหลือเพียงข้อความชื่อแบรนด์เท่านั้น (Text-Only / Typography)**

---

## 2. Requirements & Specification

1. **Card 1 ในตาราง BodyKit Items และ Part Items (Active Tuning Brand Card)**:
   - **ลบกล่องรูปภาพและภาพโลโก้ทั้งหมดออก**:
     - ลบ `@if (tuningBrandLogos().get(...); as logoUrl) { ... <img ...> ... }`
     - ลบกล่อง placeholder ตัวอักษรตัวแรก `{{ selectedTuningBrand()!.charAt(0) }}`
   - **แสดงเฉพาะชื่อแบรนด์ (Clean Typography)**:
     - แสดงชื่อแบรนด์ `{{ selectedTuningBrand() }}` ด้วยตัวอักษรตัวหนา กึ่งกลางการ์ด
     - แสดงข้อความบรรทัดย่อย `คลิกเพื่อแก้ไขชื่อ`
     - คงกรอบสีเขียว `border-emerald-500/60`, จุดสถานะ `animate-pulse`, และป้ายลอย hover `แก้ไขแบรนด์` ไว้สำหรับการกดแก้ไขชื่อแบรนด์
2. **Modal เพิ่ม/แก้ไขแบรนด์ของแต่ง**:
   - ไม่มีช่องอัปโหลดรูปภาพโลโก้
   - ไม่บังคับใส่รูปภาพ (Text-only)
3. **Unit Tests Verification**:
   - รันเทสต์ `npm test -- --watch=false` ใน `Performante_Lab_Frontend` ต้องผ่าน 100%

---

## 3. Step-by-Step Implementation Instructions

### Step 3.1: Modify `src/app/features/admin/edit-data/admin-edit-data.html`
ค้นหาตำแหน่งของ Card 1 ทั้งในแท็บ **BodyKit** (ประมาณบรรทัดที่ 500-525) และแท็บ **Parts** (ประมาณบรรทัดที่ 750-780) ที่มี:
```html
<!-- Card 1: Selected Tuning Brand Card (Active Entity - Click to Edit Tuning Brand) -->
<div
  (click)="openEditTuningBrandModal(selectedTuningBrand()!)"
  class="aspect-square rounded-2xl bg-[#141414] border-2 border-emerald-500/60 hover:border-emerald-400 relative flex flex-col items-center justify-center p-4 cursor-pointer transition-all hover:scale-[1.02] group select-none shadow-sm"
  title="คลิกเพื่อแก้ไขชื่อแบรนด์"
>
```
แทนที่เนื้อหาภายในให้เหลือเฉพาะ Typography:
```html
  <span class="text-sm font-bold text-white text-center tracking-wide group-hover:text-emerald-300 transition-colors truncate max-w-full block mb-1">
    {{ selectedTuningBrand() }}
  </span>
  <span class="text-[10px] text-stone-400">คลิกเพื่อแก้ไขชื่อ</span>
  <div class="absolute bottom-2 inset-x-2 flex items-center justify-center text-[9px] text-emerald-300 bg-black/70 backdrop-blur-sm py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
    <span>แก้ไขแบรนด์</span>
  </div>
  <span class="absolute top-2.5 right-2.5 size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" title="Active Tuning Brand"></span>
</div>
```

---

### Step 3.2: Verify `src/app/features/admin/admin.spec.ts`
ตรวจสอบให้แน่ใจว่า Test case `enforces mandatory photo upload for brand, car, tuning brand, and part`:
- บังคับรูปเฉพาะ Car Brand และ Car Model
- Tuning Brand ไม่ต้องใช้รูปภาพ (Text-only) และไม่เปิด error toast รูปภาพ

---

### Step 3.3: Run Verification
รันคำสั่งทดสอบใน `Performante_Lab_Frontend`:
```powershell
npm test -- --watch=false
```
ต้องผ่านครบทั้ง 22 Test Suites (165 tests passed).

