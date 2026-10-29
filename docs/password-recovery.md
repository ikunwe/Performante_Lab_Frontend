# ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่

Frontend ใช้ Supabase Auth โดยตรง ไม่ต้องเพิ่ม Secret key หรือ API ใน Backend สำหรับการส่งอีเมลกู้คืน

## ตั้งค่า Supabase

1. Authentication → URL Configuration → Redirect URLs เพิ่ม origin/พอร์ตที่เปิดเว็บจริง:

```text
http://localhost:4200/reset-password
http://localhost:4201/reset-password
http://127.0.0.1:4200/reset-password
http://127.0.0.1:4201/reset-password
```

Production เพิ่ม `https://YOUR_DOMAIN/reset-password` และตั้ง Site URL ให้เป็นเว็บจริง

2. Authentication → Sign In / Providers → Email เปิดใช้งาน Email และตั้ง password policy ขั้นต่ำ 8 ตัวอักษรให้ตรงกับหน้าเว็บ
3. Authentication → Email Templates → Reset Password ใช้ลิงก์เริ่มต้น `{{ .ConfirmationURL }}` ได้ ลิงก์นี้จะให้ Supabase ตรวจคำขอแล้วส่ง code กลับมายัง `/reset-password` ตาม redirectTo
4. ตั้ง SMTP สำหรับส่งอีเมลจริงใน Supabase ก่อนใช้งานกับผู้ใช้ทั่วไป ระบบอีเมลเริ่มต้นมีข้อจำกัดผู้รับและ rate limit ตรวจค่าใน Dashboard ของโปรเจกต์ หาก SMTP ยังไม่พร้อมใช้ Google Login → Profile เพื่อตั้งรหัสผ่านแทนได้

## Flow

`/login` → Forgot password? → `/forgot-password` → กรอกอีเมล → Supabase ส่งลิงก์ → ผู้ใช้เปิดลิงก์ → `/reset-password` → ตรวจ recovery code → ตั้งรหัสใหม่ 8–128 ตัวพร้อมยืนยัน → แสดงผลสำเร็จและไปหน้า Profile

- ต้องใช้อีเมลบัญชี ไม่รับ username ในหน้าขอลิงก์ เพื่อไม่เปิด API ค้นหาอีเมลจาก username
- ตอบข้อความกลางว่า “หากอีเมลนี้มีบัญชี…” ตามพฤติกรรม Supabase โดยไม่เปิดเผยการมีอยู่ของบัญชี
- ระหว่างส่ง/บันทึกมี loading และป้องกันกดซ้ำ หลังส่งสำเร็จรอ 60 วินาทีก่อนส่งซ้ำ (นโยบาย rate limit ของ Supabase อาจนานกว่านี้)
- PKCE แบบเริ่มต้นต้องเปิดลิงก์ใน browser/origin เดียวกับที่ขอ ลิงก์เก่าหรือเริ่มหลายคำขออาจใช้ไม่ได้ ให้ใช้ลิงก์ล่าสุด
- ต้องตรวจ `PASSWORD_RECOVERY` จาก Supabase สำหรับ code flow ไม่ใช้ Google callback/การมี session ปกติแทนการยืนยัน recovery
- ลบ code/token_hash/error ออกจาก URL ทันทีที่หน้ารับค่า ไม่ส่ง credential ลง log หรือ query ของลิงก์ถัดไป
- รองรับ reload หลังยืนยันแล้วใน tab เดิม โดยเก็บเฉพาะ user ID ของ recovery ใน sessionStorage และตรวจ user กับ Supabase อีกครั้ง ไม่เก็บ code/token hash/รหัสผ่านเพิ่ม
- ตั้งรหัสสำเร็จจะล้างฟอร์มและสถานะ recovery ผู้ใช้ยังอยู่ใน session ที่ Supabase ยืนยันแล้ว และไปที่ Profile ได้ จากนั้น Login ครั้งถัดไปใช้รหัสใหม่

## ตัวเลือกเปิดลิงก์ต่าง browser

โค้ดรองรับ `token_hash` recovery ด้วย หากต้องการใช้ ให้แก้ลิงก์ใน Reset Password email template เป็น:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">ตั้งรหัสผ่านใหม่</a>
```

ตัวเลือกนี้หน้าเว็บเรียก `verifyOtp({ token_hash, type: 'recovery' })` แทน PKCE code ไม่ต้องแก้ Google email template และห้ามเปลี่ยนเป็นส่ง access_token/refresh_token ในลิงก์เอง

## ตรวจด้วยบัญชีจริง

กด Forgot password กรอกอีเมลของคุณ ตรวจ inbox/spam เปิดลิงก์ล่าสุด ตั้งรหัสใหม่เอง แล้ว logout และทดลอง Login ด้วยรหัสใหม่ ลิงก์ที่ใช้แล้วต้องนำไปขอลิงก์ใหม่ได้ ระบบยังไม่ได้ส่งอีเมลหรือเปลี่ยนรหัสผ่านบัญชีจริงอัตโนมัติระหว่างพัฒนา

ถ้าส่งไม่ได้ ตรวจ SMTP/ข้อจำกัดผู้รับ/Rate limits; ถ้ากลับไป localhost:3000 หรือหน้าอื่น ตรวจ Site URL, Redirect URLs และ Email Template; ถ้า PKCE verifier หายให้เริ่มใหม่ใน browser เดิม หรือใช้ token_hash template ด้านบน

อ้างอิง: [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
