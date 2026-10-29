# เปิดใช้งาน Profile / Username / Password

โค้ดหน้า `/profile` และ Login พร้อมแล้ว แต่ต้องติดตั้งฐานข้อมูลใน Supabase ก่อน ใช้โปรเจกต์ `performante_lab` เดียวกับ Google Login

## 1. ติดตั้ง SQL

เปิด Supabase → SQL Editor → New query แล้วรันไฟล์ Backend ตามลำดับ:

1. `supabase/migrations/202610290001_profiles.sql`
2. `supabase/migrations/202610290003_google_name_username.sql` (แทน default จากอีเมลในไฟล์ 002)

หากเคยรันไฟล์ 001 หรือ 002 แล้ว ให้รันเฉพาะ 003 ได้เลย Username เริ่มต้นใช้ชื่อที่ Google ส่งกลับมา เช่น `สมชาย Jaidee` โดยคงภาษาไทย เว้นวรรค และตัวพิมพ์เดิม สูงสุด 64 ตัวอักษร ถ้าชื่อซ้ำเติม `_2`, `_3` เปลี่ยน @/อักขระควบคุมเป็น _ และใช้ Driver เมื่อไม่มีชื่อ Username ที่บันทึกไว้แล้วจะไม่ถูกทับเพื่อรักษาชื่อที่ผู้ใช้แก้เอง

SQL นี้เพิ่ม:

- ตาราง `public.profiles`: เก็บ username ไม่ซ้ำแบบไม่แยกตัวพิมพ์ใหญ่เล็ก แต่รักษาตัวพิมพ์ในการแสดงผล เชื่อมกับ `auth.users.id`
- RLS: ผู้ใช้ดูได้เฉพาะโปรไฟล์ตัวเอง ไม่มี public API สำหรับค้นหาอีเมลจาก username
- `set_my_username`: ตรวจรูปแบบและบันทึกเฉพาะ username ของผู้ใช้ที่กำลัง Login
- `get_my_account`: คืน username และ `hasPassword` ของตัวเอง โดยตรวจรหัสผ่านจาก `auth.users` ภายในฟังก์ชัน ไม่ส่ง password/hash ออกมา

ไม่เก็บรหัสผ่านหรือ flag รหัสผ่านในตาราง profiles หรือ user_metadata รหัสผ่านยังอยู่กับ Supabase Auth

## 2. เปิด Password Login

Supabase → Authentication → Sign In / Providers → Email เปิดการใช้งาน Email/Password (Google provider เปิดไว้ตามเดิม)

Authentication → Password security ตั้งความยาวขั้นต่ำให้สอดคล้องกับเว็บ คือ 8 ตัวอักษร ถ้าตั้งนโยบายเข้มกว่านี้ ผู้ใช้ต้องตั้งรหัสผ่านให้ผ่านนโยบายของ Supabase ด้วย

บัญชี Google ที่ Login อยู่ตั้งรหัสผ่านเพิ่มบนบัญชีเดิมได้ หาก Supabase ขอให้ยืนยันตัวตนใหม่ ให้เข้าสู่ระบบ Google ใหม่ก่อนตั้งรหัสผ่าน ไม่ต้องสมัครบัญชีซ้ำ

## 3. คีย์สำหรับ Username Login

การ Login ด้วย Google, การตั้งรหัสผ่าน และการบันทึก username ของตัวเองใช้ Publishable key + session เดิมได้

แต่ Supabase Login ด้วยรหัสผ่านรองรับ email/phone ไม่รองรับ username โดยตรง จึงเพิ่ม Backend `POST /api/auth/login` สำหรับค้นหา username แบบส่วนตัว และตรวจรหัสผ่านกับ Supabase โดยไม่เปิดเผยอีเมลออกสู่เว็บ

สำหรับ endpoint นี้ เพิ่มค่าใน **Backend `.env` เท่านั้น**:

```dotenv
SUPABASE_SECRET_KEY=sb_secret_YOUR_BACKEND_KEY
```

คัดลอกจาก Supabase → Project Settings → API Keys → Secret keys หรือใช้ legacy service_role ในตัวแปรเดียวกันได้ ห้ามใส่ Secret key ใน Frontend `.env` หรือ public config

เมื่อยังไม่ใส่คีย์นี้ การตั้งค่า Profile และ Login แบบ email/password ยังใช้ได้ แต่ Login แบบ username/password จะบอกว่า Backend ยังไม่เปิดใช้งาน ให้เลือก Google หรือ email ไปก่อน

Restart Backend หลังแก้ `.env` หน้า Profile จะไม่แสดง flag ว่า Username Login เปิด/ปิดในระบบ deployment นี้ เพราะสถานะสีฟ้าบอกเพียงว่าบัญชีมี username และ password แล้ว

## 4. ทดสอบด้วยบัญชีของคุณ

1. Google Login → เมนูรูปโปรไฟล์ → Profile
2. ตรวจรูป ชื่อ อีเมล ช่องทางเชื่อมต่อ และวันที่เข้าร่วม
3. Username เริ่มต้นมาจากชื่อ Google สามารถเปลี่ยนเป็นชื่ออื่นได้ 1–64 ตัวอักษร รองรับภาษาไทยและเว้นวรรค ห้ามใช้ @/อักขระควบคุม ถ้าซ้ำต้องบอกให้เลือกชื่อใหม่
4. ตั้งรหัสผ่าน 8–128 ตัวอักษรและยืนยันให้ตรงกัน ผู้ใช้เป็นคนกรอก/บันทึกรหัสผ่านเอง
5. ไป Discover: มุม avatar เป็นสีฟ้าพร้อมติ๊กถูกเมื่อตั้ง username และ password ครบ; ถ้ายังไม่ครบเป็นสีเหลืองพร้อมเครื่องหมายตกใจ
6. Reload: สถานะต้องคงเดิม เพราะอ่านจากฐานข้อมูลจริง ถ้าโหลดไม่ได้ต้องแสดงว่าไม่สามารถตรวจสอบได้ ไม่แกล้งแสดงว่าตั้งค่าแล้ว
7. ออกจากระบบ → เข้าด้วย username/password หรือ email/password → ต้องเข้าบัญชีเดิม Google Login ยังใช้ได้

หน้า Profile แสดงสถานะแต่ละส่วนในหน้าเอง และ badge บน avatar มุมขวาบนยังแสดงทุกหน้า รวมถึงหน้า Profile

Backend มี rate limit 10 ครั้ง/15 นาทีต่อ IP สำหรับ username login และไม่แสดงว่า username นั้นมีอยู่จริงหรือไม่เมื่อ Login ผิด การ deploy หลัง proxy ต้องตั้ง Express trust proxy ให้ตรงกับ topology ที่ใช้ และถ้ารันหลาย process ต้องใช้ rate-limit store ร่วมกันก่อนเปิดสาธารณะ

Tests อัตโนมัติ mock การตอบจาก Supabase; ยังไม่ยืนยัน SQL migration หรือบัญชี Google จริงจนกว่าจะติดตั้ง SQL และตั้งค่า cloud แล้ว

อ้างอิง: [Supabase updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [Password authentication](https://supabase.com/docs/guides/auth/passwords), [User data/RLS](https://supabase.com/docs/guides/auth/managing-user-data)
