# 🚀 MASTER PROMPT FOR FRONTEND AI WORKER
## Project: Performante Lab — Frontend RBAC & Admin Portal Real Data Integration

---

## 📌 บทบาทและบริบทของงาน (Role & Context)
คุณคือ **Senior Frontend Developer (Angular & Supabase)** ประจำโปรเจกต์ **Performante Lab**
หน้าที่ของคุณคือ อัปเกรดระบบ **Frontend (Angular 22)** ให้เชื่อมต่อกับ **Database Schema และ RBAC จริงของ Supabase** (ตาราง `profiles`, `part_requests`, `builds` และ RPC `get_my_account()`) แทนที่ระบบจำลอง (Mock Data / In-memory signals) เดิม โดยยังคงรักษา UI/UX และ Component Structure เดิมไว้ 100%

### 🏗️ กฎและสถาปัตยกรรมทางเทคนิคที่ต้องยึดถืออย่างเคร่งครัด:
1. **Angular Standard**:
   - Angular 22 Standalone Components
   - ใช้ Signal-based State Management (`signal`, `computed`)
   - รองรับ SSR: ตรวจสอบ Browser Context ด้วย `isPlatformBrowser(inject(PLATFORM_ID))` ก่อนเรียก LocalStorage / Window APIs
2. **Supabase Integration**:
   - ดึง Supabase Client ผ่าน DI `AUTH_CLIENT`:
     ```typescript
     private readonly createClient = inject(AUTH_CLIENT);
     ```
   - ไม่ฮาร์ดโค้ด Service Role Key หรือ Database Password เด็ดขาด (ใช้ Public Publishable Key ผ่าน `auth-config.json`)
3. **RBAC Security Principles**:
   - ห้ามตั้งค่าเริ่มต้น Role เป็น `'SuperAdmin'` (Default ต้องเป็น `'User'`)
   - Role และ Status ต้องอ่านจากผลลัพธ์ของ Supabase RPC `get_my_account()` หรือ Backend `/api/auth/me` เท่านั้น
   - ลบหรือปิดกั้นการที่ผู้ใช้จะเปลี่ยน Role ของตัวเองผ่าน `updateUser({ data: { role } })`
   - เฉพาะผู้ใช้ที่มี Role `'SuperAdmin'` เท่านั้นที่สามารถเปลี่ยน Role ของผู้อื่นได้

---

## 🗄️ โครงสร้างฐานข้อมูล Supabase ที่ระบบ Backend เตรียมไว้ให้

### 1. `public.profiles`
- `id` (uuid, primary key)
- `username` (text, unique)
- `role` (text, check: `'User' | 'Admin' | 'SuperAdmin'`, default: `'User'`)
- `status` (text, check: `'Active' | 'InActive'`, default: `'Active'`)
- `updated_at` (timestamptz)

### 2. `public.part_requests`
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles.id)
- `title` (text)
- `car_model` (text)
- `tag` (text)
- `category` (text)
- `description` (text)
- `status` (text, check: `'Pending' | 'Accepted' | 'Rejected'`, default: `'Pending'`)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 3. `public.builds`
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles.id)
- `title` (text)
- `car_name` (text)
- `tag` (text)
- `image_url` (text)
- `parts` (text[])
- `budget` (numeric)
- `category` (text, check: `'Street' | 'Track' | 'Show'`)
- `likes` (integer)
- `is_public` (boolean)
- `is_deleted` (boolean, soft delete flag)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 4. RPC Functions
- `get_my_account()`: ส่งคืน `{ username: string, hasPassword: boolean, role: UserRole, status: 'Active' | 'InActive' }`

---

## 📂 ลำดับขั้นตอนการทำงาน (Step-by-Step Tasks)

### ─── STEP 1: อัปเดต `AuthService` (`src/app/core/auth/auth.service.ts`) ───
**เป้าหมาย**: ปรับปรุงการรับค่า Role & Status จากฐานข้อมูลจริง และปิดช่องโหว่ความปลอดภัย

1. **อัปเดต Interface `AccountSettings`**:
   ```typescript
   export interface AccountSettings {
     username: string | null;
     hasPassword: boolean;
     role?: UserRole;
     status?: 'Active' | 'InActive';
   }
   ```
2. **แก้ไขค่าเริ่มต้นของ Role**:
   - เปลี่ยนค่าเริ่มต้นของ `currentRole` จาก `'SuperAdmin'` เป็น `'User'`
   - ลบการ override `currentRole` จาก LocalStorage เพื่อป้องกันการปลอมแปลง Role
3. **ปรับปรุง `refreshAccount()`**:
   - เมื่อเรียก `this.client.rpc('get_my_account')` สำเร็จ ให้ดึงค่า `data.role` และ `data.status`:
     ```typescript
     if (data.role && (data.role === 'User' || data.role === 'Admin' || data.role === 'SuperAdmin')) {
       this.currentRole.set(data.role);
     }
     ```
4. **ปรับปรุง `refreshBackendProfile()`**:
   - อัปเดต Model `backendProfile` ให้รองรับ `role` และ `status` จาก `/api/auth/me`
5. **ป้องกันบัญชีที่ถูกระงับ (`InActive`)**:
   - เพิ่ม `computed` signal:
     ```typescript
     readonly isActive = computed(() => this.account()?.status !== 'InActive');
     ```
   - หากตรวจพบว่าบัญชีมีสถานะ `'InActive'` ให้กำหนดข้อความเตือนหรือจำกัดการเข้าใช้งาน

---

### ─── STEP 2: ปรับปรุง Route Guards (`admin.guard.ts` และ `auth.guard.ts`) ───
**เป้าหมาย**: ตรวจสอบทั้งสถานะล็อกอิน, Role และ Status ของบัญชี

1. **ใน `src/app/core/auth/admin.guard.ts`**:
   - ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่ (ถ้าไม่ ส่งไป `/login`)
   - ตรวจสอบว่าบัญชีมีสถานะ `Active` หรือไม่ (ถ้า `InActive` ให้ปฏิเสธและแจ้งเตือน)
   - ตรวจสอบ `auth.isAdmin()` (`'Admin'` หรือ `'SuperAdmin'`) หากไม่ใช่ ให้ redirect ไปที่ `/discover`
2. **ใน `src/app/core/auth/auth.guard.ts`**:
   - เพิ่มการตรวจสอบสถานะ `Active` สำหรับทุก Protected Route

---

### ─── STEP 3: อัปเกรด `AdminService` (`src/app/features/admin/services/admin.service.ts`) ───
**เป้าหมาย**: เปลี่ยนจากการใช้ In-memory Mock Data มาเป็นการดึงและอัปเดตข้อมูลจริงบน Supabase

1. **เชื่อมต่อ Supabase Client**:
   - Inject `AUTH_CLIENT` เข้ามาใน `AdminService`:
     ```typescript
     private readonly createClient = inject(AUTH_CLIENT);
     private client: SupabaseClient | null = null;
     ```
   - สร้างฟังก์ชัน `private async getClient()` เพื่อโหลด client อย่างปลอดภัย (รองรับ SSR)
2. **เพิ่ม Loading & Error Signals**:
   ```typescript
   readonly loading = signal(false);
   readonly error = signal('');
   ```
3. **ฟังก์ชันจัดการ Builds (เชื่อมต่อตาราง `public.builds`)**:
   - `fetchBuilds()`: Query จากตาราง `builds` ที่ `is_deleted = false` พร้อม join ข้อมูลโปรไฟล์ของผู้สร้าง (ถ้ามี) แล้ว map เข้ากับ `AdminBuildItem[]`
   - `deleteBuild(id: string)`: อัปเดตในฐานข้อมูล `is_deleted = true` (Soft Delete) และอัปเดต Signal `this.builds` ใน UI
4. **ฟังก์ชันจัดการ Requests (เชื่อมต่อตาราง `public.part_requests`)**:
   - `fetchRequests()`: Query จาก `part_requests` พร้อม map ข้อมูลเข้ากับ `AdminRequestItem[]`
   - `acceptRequest(id: string)`: อัปเดต `status = 'Accepted'` ในฐานข้อมูล และอัปเดต Signal
   - `rejectRequest(id: string)`: อัปเดต `status = 'Rejected'` ในฐานข้อมูล และอัปเดต Signal
5. **ฟังก์ชันจัดการ Users (เชื่อมต่อตาราง `public.profiles`)**:
   - `fetchUsers()`: Query รายการผู้ใช้จากตาราง `profiles` เรียงลำดับตาม `updated_at` หรือ `id` แล้ว map เข้ากับ `AdminUserItem[]`
   - `toggleUserStatus(id: string)`:
     - ป้องกันไม่ให้ระงับบัญชี `SuperAdmin`
     - สลับสถานะ `'Active'` $\leftrightarrow$ `'InActive'` ในตาราง `profiles`
   - `updateUserRole(id: string, newRole: UserRole)`:
     - ตรวจสอบ `if (!this.auth.isSuperAdmin())` ก่อนเสมอ
     - อัปเดตคอลัมน์ `role = newRole` ในตาราง `profiles`
6. **Graceful Fallback**:
   - หากยังไม่มีข้อมูลในฐานข้อมูล หรือเกิดปัญหาเน็ตเวิร์ก ให้แสดง empty list หรือคง fallback ข้อมูลเริ่มต้นพร้อมข้อความแจ้งเตือน เพื่อไม่ให้ UI พัง

---

### ─── STEP 4: ตรวจสอบและทดสอบระบบ (Verification) ───
1. **การคอมไพล์ (Compile & Build Check)**:
   - รันคำสั่ง `npm run build` ในโฟลเดอร์ `Performante_Lab_Frontend`
   - ต้องผ่าน 100% ไม่มี TypeScript หรือ Template Error
2. **ทดสอบ Flow ใน Browser**:
   - ผู้ใช้ทั่วไป (Role: `User`) เข้า URL `/admin` $\rightarrow$ ถูก Guard ดีดกลับไปที่ `/discover`
   - ผู้ใช้ Admin $\rightarrow$ เข้า `/admin` ได้, ดูรายการ Builds, Requests, Users ได้
   - ปุ่มเปลี่ยน Role ในหน้า Admin Users $\rightarrow$ แสดงเฉพาะเมื่อผู้ใช้ล็อกอินด้วยสิทธิ์ `SuperAdmin` เท่านั้น
   - การระงับผู้ใช้ หรืออนุมัติ Request มีผลกับการอัปเดตฐานข้อมูลจริง

---

## ✅ เกณฑ์การส่งมอบงาน (Acceptance Criteria)
- [ ] ค่าเริ่มต้น `currentRole` ใน `AuthService` ต้องไม่เป็น Hardcoded SuperAdmin
- [ ] `AuthService.refreshAccount()` รับ `role` และ `status` จาก RPC `get_my_account()` ได้ถูกต้อง
- [ ] `AdminGuard` ป้องกันผู้ใช้ทั่วไปและบัญชี InActive ได้อย่างรัดกุม
- [ ] `AdminService` โหลดและอัปเดตข้อมูลจริงกับ Supabase (Builds, Requests, Users)
- [ ] คำสั่ง `npm run build` ผ่านสมบูรณ์โดยไม่มี Error

