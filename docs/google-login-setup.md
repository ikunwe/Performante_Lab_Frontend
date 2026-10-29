# ตั้งค่า Google Login — Performante Lab

โค้ดพร้อมสำหรับโปรเจกต์ Supabase `performante_lab` ที่สร้างไว้แล้ว ขั้นตอนด้านล่างต้องทำในบัญชี Google Cloud และ Supabase ของคุณ ยังไม่มีการตั้งค่า cloud อัตโนมัติจากโค้ดนี้

## 1. เตรียมค่าจาก Supabase

เปิดโปรเจกต์ `performante_lab` ใน Dashboard แล้วคัดลอก Project URL จาก Connect/Project Settings → Data API และ Publishable key จาก Project Settings → API Keys (ขึ้นต้น `sb_publishable_...`) ถ้าใช้คีย์แบบเก่าใช้ `anon` ได้

ใส่ค่าชุดเดียวกันใน `.env` ของทั้ง Frontend และ Backend:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Frontend เพิ่ม `API_BASE_URL=http://localhost:3000` ส่วน Backend มี `PORT=3000` และ `FRONTEND_ORIGINS` เตรียมไว้แล้ว ไม่ต้องใส่ database password, `service_role`, `sb_secret_...` หรือ Google Client Secret ใน Frontend

ไฟล์ `.env` ถูก ignore ทั้งสอง repo; `.env.example` คือแม่แบบ ไม่มีคีย์จริง

## 2. Google Cloud Console

เปิด [Google Auth Platform](https://console.cloud.google.com/auth/overview) เลือกหรือสร้าง Google Cloud project สำหรับ Performante Lab

1. **Branding / Get started**: ใส่ App name `Performante Lab`, Support email และ Developer contact email ของคุณ
2. **Audience**: ใช้ External สำหรับบัญชี Gmail ทั่วไป ช่วงพัฒนาใช้ Testing และเพิ่มอีเมลที่จะทดลองใน Test users
3. **Data Access**: ใช้เฉพาะ `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`
4. **Clients → Create client → Web application**: ตั้งชื่อ เช่น `Performante Lab Web`
5. **Authorized JavaScript origins**: ใส่ origin ที่เปิดเว็บจริง เช่น `http://localhost:4200` และ `http://localhost:4201` ถ้าใช้ `127.0.0.1` ให้เพิ่ม origin นั้นด้วย ไม่มี path ต่อท้าย
6. **Authorized redirect URIs**: ใส่ `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` โดยคัดลอกค่าจากหน้า Google provider ของ Supabase ให้ตรงทุกตัว
7. กด Create แล้วเก็บ **Client ID** และ **Client Secret** เพื่อนำไปใส่ใน Supabase ขั้นตอนถัดไป

Google จะส่งผลกลับไปที่ Supabase ก่อน ดังนั้น redirect URI ใน Google Console เป็น `/auth/v1/callback` ของ Supabase ส่วน `/auth/callback` บน localhost คือปลายทางจาก Supabase กลับมาที่เว็บเรา

อ้างอิง: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Google OAuth web applications](https://developers.google.com/identity/protocols/oauth2/web-server)

## 3. เปิด Google provider ใน Supabase

ไปที่ **Authentication → Sign In / Providers → Google** เปิด Enable แล้วใส่ Client ID และ Client Secret จาก Google Cloud จากนั้น Save ค่า Secret อยู่ใน Dashboard นี้เท่านั้น ไม่จำเป็นต้องใส่ใน `.env` ของสองแอปนี้

ไปที่ **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:4200` (หรือ `4201` ถ้าใช้พอร์ตนั้นเป็นหลัก)
- **Redirect URLs**: เพิ่มแต่ละ URL ที่ใช้จริง:

```text
http://localhost:4200/auth/callback
http://localhost:4201/auth/callback
http://127.0.0.1:4200/auth/callback
http://127.0.0.1:4201/auth/callback
```

กด Save ใช้ hostname เดิมตั้งแต่เริ่ม Login จนจบ เพราะ PKCE verifier เก็บในเบราว์เซอร์บน origin ที่เริ่ม Login

อ้างอิง: [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)

## 4. เปิดแอป

เปิด terminal ที่ Backend:

```powershell
npm install
npm run dev
```

เปิดอีก terminal ที่ Frontend:

```powershell
npm install
npm start
```

หากใช้พอร์ต 4201 ให้ใช้ `npm start -- --port 4201` หลังแก้ `.env` ให้ restart ทั้งสองฝั่ง Frontend จะสร้าง `public/auth-config.json` อัตโนมัติจากรายการตัวแปรสาธารณะที่อนุญาตเท่านั้น ไม่ได้คัดลอก env ทั้งหมด ไม่ต้องแก้ไฟล์ generated เอง

Production ใช้ `npm run build` เพื่อสร้าง config ก่อน build, เปลี่ยน API_BASE_URL เป็น HTTPS ของ Backend และเพิ่มโดเมนจริงใน CORS, Google origins, Supabase Site URL และ Redirect URLs ให้ครบ

## 5. ทดสอบด้วยบัญชีจริง

1. เปิด `/login` → Sign in with Google → เลือกบัญชี → อนุญาต
2. กลับมา `/discover` หรือหน้าส่วนตัวที่ขอไว้ก่อน Login เห็นชื่อบัญชีและปุ่มออกจากระบบ
3. DevTools → Network → `GET /api/auth/me` ต้องได้ `200`; Backend ตรวจ access token กับ Supabase Auth ก่อนคืนข้อมูลผู้ใช้
4. Reload แล้วยังอยู่ในระบบ; กดออกจากระบบแล้วเข้า `/my-builds` จะกลับไป Login
5. Supabase → Authentication → Users จะเห็นบัญชีที่เข้าสู่ระบบ ไม่ต้องสร้างตาราง `users` เองสำหรับขั้นตอน Login

โค้ดครอบคลุม OAuth PKCE, callback แบบใช้ code ครั้งเดียว, session refresh/restore, logout ของ browser session ปัจจุบัน, guard สำหรับ My Builds/Create Build และ Backend `GET /api/auth/me` ที่รับ `Authorization: Bearer <access_token>` และตรวจผ่าน `getUser(token)`

Auth ของหน้านี้ทำงานในเบราว์เซอร์; SSR/prerender มีเพียงโครง UI ไม่มี session/account data บน server ส่วน Backend ตรวจ token ทุกครั้ง ไม่ใช้ client guard เป็นสิทธิ์ของ API

My Builds ยังเก็บ localStorage ตามเบราว์เซอร์และยังไม่ได้แบ่งตามบัญชีหรือ sync ฐานข้อมูล ส่วน Profile และ Username/Password Login เพิ่มแล้ว ดู [profile-setup.md](profile-setup.md) เพื่อติดตั้ง SQL และคีย์ Backend สำหรับค้นหา username โดยเฉพาะ ส่วน Forgot password ดู [password-recovery.md](password-recovery.md) เพื่อเพิ่ม Redirect URL และตั้งค่าอีเมลกู้คืน

## ปัญหาที่พบบ่อย

- `redirect_uri_mismatch`: เช็ก Google redirect URI ว่าเป็น callback ของ **Supabase** และ project ref ตรงกัน
- Google ปฏิเสธสิทธิ์ระหว่าง Testing: เช็ก Audience/Test users และ Client ID/Secret
- กลับมาหน้าผิดหรือไม่ได้ code: เช็ก Supabase Redirect URLs, Site URL และพอร์ตที่เปิด
- callback หมดอายุ: เริ่ม Login ใหม่ใน browser เดิม ไม่เปิดหลาย flow พร้อมกัน
- Login สำเร็จแต่แจ้ง Backend ไม่พร้อม: เปิด API พอร์ต 3000, เช็ก API_BASE_URL/CORS และคีย์ของ Backend ต้องเป็น Supabase project เดียวกับ Frontend
- API ตอบ `401`: token หาย/หมดอายุ/ผิดโปรเจกต์; `503`: Supabase ยังไม่ตั้งค่าหรือระบบตรวจ token ไม่พร้อม

ตรวจอัตโนมัติด้วย `npm test -- --watch=false` ที่ Frontend และ `npm test` ที่ Backend ส่วน OAuth กับบัญชี Google จริงต้องทดสอบหลังใส่คีย์และตั้งค่า cloud เรียบร้อย
