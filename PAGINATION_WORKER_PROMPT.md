# 🚀 MASTER WORKER PROMPT: Admin Users Pagination (10 Users Per Page)
## Feature: ระบบแบ่งหน้า (Pagination) แสดงผล 10 ผู้ใช้ต่อหน้า ใน Admin Users Portal

---

## 📌 บทบาทและบริบทของงาน (Role & Context)
คุณคือ **Senior Frontend Developer (Angular 22)** ประจำโปรเจกต์ **Performante Lab**
หน้าที่ของคุณคือ พัฒนาระบบ **Pagination (แบ่งหน้า)** สำหรับหน้า **Admin Users (`/admin/users`)** โดยกำหนดให้แสดงผล **10 บัญชีผู้ใช้ต่อหน้า (Page Size = 10)** พร้อมปุ่มสลับหน้า (Previous / Next / เลขหน้า), ตัวบอกสถานะจำนวนรายการ และรองรับการ Reset กลับมาหน้า 1 อัตโนมัติเมื่อมีการค้นหาหรือเปลี่ยนตัวกรอง (Search & Filter)

---

## 🎯 ข้อกำหนดและพฤติกรรมของระบบ (Functional & UX Requirements)

1. **ขนาดหน้า (Page Size)**: 
   - แสดงผลคงที่ **10 รายการต่อหน้า**
2. **การคำนวณและตัดข้อมูล (Data Slicing)**:
   - อิงข้อมูลจากรายการที่ผ่านการกรองแล้ว (`filteredUsers()`)
   - `totalPages = Math.ceil(filteredUsers().length / 10) || 1`
   - `paginatedUsers = filteredUsers().slice((currentPage - 1) * 10, currentPage * 10)`
3. **การควบคุมการเปลี่ยนหน้า (Navigation Controls)**:
   - **ปุ่ม Previous (`<`)**: เลื่อนไปหน้าก่อนหน้า (ถูก `disabled` เมื่ออยู่ที่หน้า 1)
   - **ปุ่มหมายเลขหน้า (Page Numbers)**: แสดงปุ่มหมายเลข [ 1, 2, 3 ... ] โดยหน้าปัจจุบันจะถูกเน้นด้วยสีแดงหลักของระบบ (`bg-[#ce281a] text-white font-bold`)
   - **ปุ่ม Next (`>`)**: เลื่อนไปหน้าถัดไป (ถูก `disabled` เมื่ออยู่ที่หน้าสุดท้าย)
4. **Auto-Reset เมื่อค้นหาหรือกรองข้อมูล**:
   - เมื่อผู้ใช้พิมพ์คำค้นหาในช่องค้นหา (`usersSearch`) หรือเปลี่ยน Filter (Role / Status) ต้อง **รีเซ็ต `currentPage` กลับมาที่หน้า 1 ทันที**
5. **ข้อความสรุปจำนวน (Counter Info)**:
   - แสดงข้อความระบุช่วงรายการ เช่น *"แสดง 1 - 10 จากทั้งหมด 24 บัญชี"* (หรือ *"แสดง 0 จาก 0"* หากไม่พบข้อมูล)
6. **การจัดการเมื่อไม่มีข้อมูล หรือมีข้อมูลไม่เกิน 1 หน้า**:
   - ซ่อนแถบ Pagination หาก `totalUsers === 0`
   - หากมีหน้าเดียว (1 หน้า) ให้ปุ่ม Previous และ Next เป็น `disabled`

---

## 📂 ไฟล์ที่ต้องแก้ไข (Files to Update)

### ─── 1. `src/app/features/admin/users/admin-users.ts` ───
**หน้าที่**: จัดการ Signal สถานะหน้าปัจจุบันและ Computed Data สำหรับ Pagination

**สิ่งที่ต้องเพิ่ม/ปรับปรุง**:
- นำเข้า `computed` และ `effect` (ถ้าจำเป็น) จาก `@angular/core`
- สร้าง Signal และ Computed ต่อไปนี้:
  ```typescript
  readonly pageSize = 10;
  readonly currentPage = signal(1);

  // คำนวณจำนวนผู้ใช้และจำนวนหน้าทั้งหมด
  readonly totalUsers = computed(() => this.admin.filteredUsers().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalUsers() / this.pageSize)));

  // ตัดข้อมูล 10 คนสำหรับหน้าปัจจุบัน
  readonly pagedUsers = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.admin.filteredUsers().slice(start, start + this.pageSize);
  });

  // ช่วงรายการที่กำลังแสดง (สำหรับข้อความแสดง 1 - 10 จาก...)
  readonly displayRange = computed(() => {
    const total = this.totalUsers();
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(page * this.pageSize, total);
    return { start, end, total };
  });

  // Array หมายเลขหน้าสำหรับ Loop แสดงปุ่ม
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });
  ```
- เพิ่มฟังก์ชันเปลี่ยนหน้า:
  ```typescript
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }
  ```
- **Reset หน้าเมื่อ Filter เปลี่ยน**:
  - ใน `setRoleFilter()`: เพิ่ม `this.currentPage.set(1);`
  - ใน `setStatusFilter()`: เพิ่ม `this.currentPage.set(1);`
  - เพิ่มเมธอดสำหรับ Search Change หรือผูก `onSearchChange(query: string)` เพื่อ `this.admin.usersSearch.set(query); this.currentPage.set(1);`

---

### ─── 2. `src/app/features/admin/users/admin-users.html` ───
**หน้าที่**: แสดงผลรายการที่ตัดแบ่งหน้าแล้ว และเพิ่มแถบควบคุม Pagination ด้านล่าง

**สิ่งที่ต้องปรับปรุง**:
1. **เปลี่ยน Loop การแสดงการ์ด User**:
   - เปลี่ยนจาก:
     ```html
     @for (user of admin.filteredUsers(); track user.id)
     ```
   - เป็น:
     ```html
     @for (user of pagedUsers(); track user.id)
     ```

2. **เชื่อมต่อ Search input ให้รีเซ็ตหน้า**:
   - จาก:
     ```html
     (ngModelChange)="admin.usersSearch.set($event)"
     ```
   - เป็น:
     ```html
     (ngModelChange)="onSearchChange($event)"
     ```
     หรือ `admin.usersSearch.set($event); currentPage.set(1);`

3. **เพิ่ม Pagination Controls Component ด้านล่างสุดของการ์ด**:
   ```html
   <!-- Pagination Controls (แสดงเมื่อมีข้อมูล) -->
   @if (!admin.loading() && totalUsers() > 0) {
     <div class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs text-stone-400">
       <!-- Left: Summary Info -->
       <div>
         แสดง <span class="font-bold text-white">{{ displayRange().start }}</span> - 
         <span class="font-bold text-white">{{ displayRange().end }}</span> จากทั้งหมด 
         <span class="font-bold text-white">{{ displayRange().total }}</span> บัญชี
       </div>

       <!-- Right: Page Controls -->
       <div class="flex items-center gap-1.5">
         <!-- Previous Button -->
         <button
           type="button"
           (click)="prevPage()"
           [disabled]="currentPage() === 1"
           class="h-8 px-2.5 rounded-lg border border-white/10 bg-[#181818] text-white hover:border-white/25 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
           title="หน้าก่อนหน้า"
         >
           <app-icon name="back" class="!size-3" />
           <span class="hidden sm:inline">ก่อนหน้า</span>
         </button>

         <!-- Page Numbers -->
         <div class="flex items-center gap-1">
           @for (p of pageNumbers(); track p) {
             <button
               type="button"
               (click)="goToPage(p)"
               class="size-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
               [class]="currentPage() === p 
                 ? 'bg-[#ce281a] text-white shadow-md shadow-[#ce281a]/30 font-bold' 
                 : 'bg-[#181818] border border-white/10 text-stone-300 hover:border-white/25'"
             >
               {{ p }}
             </button>
           }
         </div>

         <!-- Next Button -->
         <button
           type="button"
           (click)="nextPage()"
           [disabled]="currentPage() === totalPages()"
           class="h-8 px-2.5 rounded-lg border border-white/10 bg-[#181818] text-white hover:border-white/25 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
           title="หน้าถัดไป"
         >
           <span class="hidden sm:inline">ถัดไป</span>
           <app-icon name="arrow" class="!size-3" />
         </button>
       </div>
     </div>
   }
   ```

---

### ─── 3. `src/app/features/admin/admin.spec.ts` ───
**หน้าที่**: เพิ่ม Unit Tests สำหรับความถูกต้องของฟังก์ชัน Pagination

**Test Cases ที่ต้องครอบคลุม**:
1. เมื่อ Mock ข้อมูลผู้ใช้ 25 คน:
   - ตรวจสอบ `totalPages()` ต้องเท่ากับ 3
   - ในหน้าแรก `pagedUsers().length` ต้องเท่ากับ 10
2. เมื่อเรียก `nextPage()`:
   - ค่า `currentPage()` ต้องกลายเป็น 2
   - `displayRange()` ต้องระบุ start: 11, end: 20, total: 25
3. เมื่ออยู่ที่หน้าแรก:
   - ปุ่ม Previous ต้อง disabled
4. เมื่ออยู่ที่หน้าสุดท้าย (หน้า 3):
   - ปุ่ม Next ต้อง disabled
5. เมื่อเปลี่ยน Filter หรือ Search:
   - ค่า `currentPage()` ต้องถูกรีเซ็ตกลับมาที่ 1 เสมอ

---

## 🧪 4. Testing & Verification Checklist
1. รันคำสั่งทดสอบใน `Performante_Lab_Frontend`:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   ```
   *(ต้องผ่านครบทั้ง 14 test suites รวม 79+ tests)*
2. ตรวจสอบการ Build:
   ```bash
   npm run build
   ```
   *(ต้องไม่มี Type Error หรือ Template Compilation Error)*
3. เปิดทดสอบบนเบราว์เซอร์:
   - ตรวจสอบว่าหน้า Users แสดง 10 รายการต่อหน้า
   - กดปุ่มหมายเลขหน้า หรือปุ่ม ถัดไป/ก่อนหน้า แล้วรายการผู้ใช้สลับหน้าได้ลื่นไหล
   - ค้นหาชื่อแล้วหมายเลขหน้ารีเซ็ตกลับมาที่หน้า 1 อัตโนมัติ

---

## 📋 Definition of Done
- [ ] แสดงผลครั้งละ 10 คนต่อหน้าอย่างถูกต้อง
- [ ] มีปุ่ม Prev, Next และเลขหน้าแสดงผลสวยงามตามดีไซน์ Dark theme ของ Performante Lab
- [ ] เมื่อค้นหาหรือกรองข้อมูล หน้าจะถูกรีเซ็ตมาที่หน้า 1 เสมอ
- [ ] โค้ดทั้งหมดผ่าน Unit Test 100% และไม่มีข้อผิดพลาดในการ Build

