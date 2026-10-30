# Role & Task
คุณคือ **Senior Frontend Developer (Angular 22)**
หน้าที่ของคุณคือ อัปเดตหน้า **Admin Users Management (`/admin/users`)** ใน `Performante_Lab_Frontend` เพื่อแสดง **Email จริงจาก Database** และปรับปรุง **UI/Logic การควบคุมสิทธิ์ของปุ่ม (Role & Status Actions)** ตามข้อกำหนดด้านล่างนี้

---

## 📋 รายละเอียดงานที่ต้องแก้ไข

### 1. ดึงและแสดง Email จริงจาก Database (`AdminService`)
- ใน `src/app/features/admin/services/admin.service.ts`:
  - ปรับปรุงฟังก์ชัน `fetchUsers()` ให้เรียก API ไปที่ Backend `GET ${apiBaseUrl}/api/admin/users` (หรือดึงผ่าน Supabase View/RPC ที่แนบ email มาด้วย)
  - นำค่า `email` จริงที่ได้รับ มาเซ็ตลงใน Signal `users` แทนที่ข้อมูล Mock
  - กรณี Backend ยังไม่ตอบกลับ ให้มี Fallback โชว์สถานะหรือ Graceful handling ไม่ให้หน้าจอพัง

---

### 2. ปรับปรุงความสามารถและ Logic การแสดงผลตาม Role

#### กฎของ SuperAdmin:
1. **เปลี่ยน Role**: สามารถคลิกเปลี่ยน Role ของ User คนใดก็ได้ (แสดงปุ่ม/Dropdown เลือก `User`, `Admin`, `SuperAdmin`)
2. **Suspend / Active**: สามารถกดปุ่ม Suspend หรือ Active บัญชีที่เป็น **`User`** และ **`Admin`** ได้
3. **ข้อยกเว้น**: ไม่สามารถกดปุ่ม Suspend บัญชีที่เป็น **`SuperAdmin`** ด้วยกันได้ (ซ่อนปุ่มหรือ Disable)

#### กฎของ Admin:
1. **เปลี่ยน Role**: **ทำไม่ได้เด็ดขาด** (แสดง Badge Role เป็นแบบ Read-only ไม่แสดงปุ่มเปลี่ยน Role)
2. **Suspend / Active**: สามารถกดปุ่ม Suspend หรือ Active ได้**เฉพาะบัญชีที่มี Role เป็น `User` เท่านั้น**
3. **ข้อยกเว้น**: สำหรับบัญชีที่มี Role เป็น **`Admin`** หรือ **`SuperAdmin`** ให้ **Disable ปุ่ม หรือ ซ่อนปุ่ม Action** พร้อมแสดง Tooltip หรือข้อความกำกับว่า *"เฉพาะ SuperAdmin เท่านั้นที่จัดการ Admin ได้"*

---

### 3. การอัปเดตไฟล์โค้ด (Files to Update)

#### A. `src/app/features/admin/services/admin.service.ts`:
- อัปเดตฟังก์ชัน `canSuspendUser(target: AdminUserItem): boolean`:
  ```typescript
  canSuspendUser(target: AdminUserItem): boolean {
    if (target.role === 'SuperAdmin') return false;
    if (this.auth.isSuperAdmin()) return true; // SuperAdmin จัดการได้ทั้ง Admin และ User
    if (this.auth.isAdmin()) return target.role === 'User'; // Admin จัดการได้เฉพาะ User
    return false;
  }
  ```
- ใน `toggleUserStatus(id: string)`:
  - เพิ่มการตรวจสอบสิทธิ์ `canSuspendUser`: หากผู้ใช้ปัจจุบันเป็น `Admin` แล้วพยายามสั่งระงับ `Admin` อื่น ให้ Return `{ ok: false, message: 'Admin สามารถจัดการได้เฉพาะบัญชี User เท่านั้น' }`
  - ยิง API `PATCH /api/admin/users/:id/status` ไปยัง Backend พร้อมทำ Optimistic Update และ Rollback หากเกิด Error

#### B. `src/app/features/admin/users/admin-users.html`:
- แสดงฟิลด์ `user.email` จริงในแถวข้อมูล
- ในส่วนของปุ่ม Suspend / Active:
  - ตรวจสอบผ่าน `@if (adminService.canSuspendUser(user))`
  - หาก `canSuspendUser(user) === false`: ให้แสดงเป็นข้อความสถานะปกติ หรือปุ่ม Disabled สีเทาจาง (Opacity ต่ำ) เพื่อป้องกันไม่ให้ Admin กดระงับ Admin คนอื่น
- ในส่วนของ Role Badge:
  - หาก `auth.isSuperAdmin()`: แสดงปุ่มแก้ไข Role (Dropdown / Button)
  - หากไม่ใช่ SuperAdmin: แสดงเฉพาะ Badge นิ่งๆ (Read-only)

#### C. `src/app/features/admin/users/admin-users.ts`:
- เชื่อมต่อฟังก์ชันตรวจสอบสิทธิ์และแสดง Toast ข้อความแจ้งเตือนกรณีถูกปฏิเสธสิทธิ์

---

## 🧪 4. Testing & Verification Checklist
1. รันคำสั่ง `npm test` ในโฟลเดอร์ Frontend
2. อัปเดต Mock Data ใน `admin.service.spec.ts` และ `admin.spec.ts` ให้ครอบคลุมเงื่อนไข:
   - ทดสอบว่าเมื่อ Actor เป็น `Admin` จะไม่สามารถเรียก `toggleUserStatus` กับผู้ใช้ที่เป็น `Admin` ได้
   - ทดสอบว่าเมื่อ Actor เป็น `SuperAdmin` จะสามารถเรียก `toggleUserStatus` กับผู้ใช้ที่เป็น `Admin` ได้
3. ตรวจสอบว่าทุก Test Files ผ่านทั้งหมด (Pass 100%)
4. รัน `npm run build` เพื่อยืนยันว่าไม่มี Type หรือ Template Error
