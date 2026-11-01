# User and Admin Requests

เปิดจากเมนูโปรไฟล์ → Requests (`/requests`, ต้องเข้าสู่ระบบ)
รองรับแบรนด์รถ รุ่นรถ BodyKit รอบคัน และพาร์ทแยก พร้อม Title,
บริบทรถ รายละเอียด สำนักแต่ง ลิงก์อ้างอิง และภาพ PNG/JPG/WebP
สูงสุด 5 รูป รูปละไม่เกิน 10 MB

## Flow

1. User กรอกข้อมูลและแนบรูป → ตรวจสอบคำขอ → ส่งคำขอให้ผู้ดูแล
2. Frontend ส่ง multipart/form-data ไป Backend พร้อม access token
3. Backend ตรวจบัญชี Active, ข้อมูล, จำนวน/ขนาดภาพ และ signature ของไฟล์
4. เก็บรูปใน private bucket `request-attachments` และข้อมูลใน `part_requests`
   โดย owner จาก token และ status เริ่มต้น Pending เสมอ
5. User ดูคำขอของตัวเองและสถานะในคำขอของฉัน กดรีเฟรชเพื่ออัปเดต
6. Admin → Requests เห็นคำขอจริงทุกประเภท พร้อมภาพและรายละเอียด
   Accept/Reject บันทึกผ่าน Backend แล้ว User เห็นสถานะใหม่เมื่อรีเฟรช

Accept เป็นการปรับสถานะคำขอ ไม่ได้เพิ่มไฟล์เข้า Catalog อัตโนมัติ
ฉบับร่างและฟอร์มที่ยังกรอกไม่ครบเก็บอัตโนมัติใน IndexedDB ของเบราว์เซอร์
รวมไฟล์ภาพจริง แยกตาม Supabase project และบัญชี ไม่ส่งขึ้น backend จนกดส่งคำขอ
รีเฟรช/ออกจากหน้าแล้วกลับมาจะกู้คืนข้อมูล พร้อมสร้าง preview URL ใหม่
ภาพเดียวกันไม่ถูกเขียนซ้ำทุกครั้งที่พิมพ์ข้อความ สามารถลบฉบับร่างได้
เมื่อส่งสำเร็จจะนำฉบับร่างที่ส่งออกจากข้อมูลในเครื่อง

รอข้อความ “บันทึกฉบับร่างแล้ว” เพื่อยืนยันว่า transaction เสร็จแล้ว
มีการ flush ขณะออกจากหน้าและแจ้ง error หาก quota เต็มหรือ IndexedDB ใช้ไม่ได้
ข้อมูลนี้อยู่ใน browser profile เดิมเท่านั้น ไม่ซิงก์ข้ามเครื่อง และหายได้หากล้าง site data

## API

- `POST /api/requests`: multipart field `data` (JSON) และ `images` (1–5 files)
- `GET /api/requests?offset=0`: เฉพาะคำขอของเจ้าของ token
- `GET /api/admin/requests?offset=0`: Admin/SuperAdmin ที่ Active เท่านั้น
- `PATCH /api/admin/requests/:id/status`: JSON `{status: "Accepted" | "Rejected"}`

List ครั้งละ 100 รายการ พร้อม nextOffset; Frontend โหลดครบทุกหน้า
response ใช้ no-store ไม่มี mock fallback เมื่อฐานข้อมูลขัดข้อง
ภาพใช้ signed URLs อายุ 1 ชั่วโมง กดรีเฟรชรายการเพื่อขอ URL ใหม่

POST มีขีดจำกัด 10 ครั้งต่อบัญชีใน 10 นาที (รวม retry/คำขอที่ไม่ผ่าน validation)
ใช้ memory limiter ต่อ backend process ควรใช้ shared store หาก deploy หลาย process
รหัสคำขอและ content hash ใช้กันรายการซ้ำหลัง timeout โดย retry เนื้อหาเดิมได้
ไฟล์ตั้งชื่อตาม hash ในโฟลเดอร์ owner/request; การส่งผิดพลาดหลังอัปโหลดอาจเหลือ
ไฟล์ private ให้ retry ใช้ซ้ำ ไม่ลบไฟล์ระหว่าง retry เพื่อไม่กระทบคำขอที่สำเร็จพร้อมกัน

## Setup

รัน Backend `supabase/migrations/202611010001_request_attachments.sql` หนึ่งครั้ง
จากนั้น restart Backend ใช้ SUPABASE_SECRET_KEY ฝั่ง server เดิม ไม่ต้องเพิ่ม key ใน Frontend
migration เพิ่ม metadata/image paths/hash และ private bucket ไม่ลบคำขอเดิม
การเขียน part_requests โดย browser โดยตรงถูกปิด ใช้ Backend สำหรับทั้ง User และ Admin

Backend `scripts/smoke-requests-live.js` เป็น integration test แบบเลือกเรียกเอง
สร้างบัญชี/คำขอ/รูปชั่วคราว ตรวจส่งจริงและ Admin review แล้วล้างเฉพาะข้อมูลทดสอบ
ไม่อยู่ใน npm test ปกติ
