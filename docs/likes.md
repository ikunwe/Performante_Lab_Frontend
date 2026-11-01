# Likes and Liked

User กด Like/Unlike บนการ์ด Discover หรือ Liked ได้เมื่อเข้าสู่ระบบ
เมนูโปรไฟล์ → Liked (`/liked`) ใช้การ์ดเดียวกับ Discover พร้อมค้นหา ตัวกรอง
See Details และใช้เป็นต้นแบบ; Build ของตัวเองยังลบได้ตามสิทธิ์เดิม
ผู้ไม่เข้าสู่ระบบจะถูกพาไป Login ก่อนกด Like

## Storage and permissions

ตาราง `public.build_likes` เก็บคู่ user_id/build_id เป็น primary key
หนึ่งบัญชี Like Build เดิมได้ครั้งเดียว และ Like ของแต่ละบัญชีแยกกัน
ไม่เก็บ Like จริงใน localStorage/IndexedDB และไม่แก้สถานะ Build เดิม
PUT ตรวจว่ารถเป็นสาธารณะและยังไม่ลบก่อนเขียน DELETE ลบเฉพาะของเจ้าของ token
Liked คืนเฉพาะ Build สาธารณะที่ไม่ถูกลบ แม้มี Like เก่าของ Build ส่วนตัวเหลืออยู่
เมื่อ hard-delete Build/account แถว Like ที่เกี่ยวข้องถูก cascade ลบ
RLS ให้ browser อ่านเฉพาะแถว Like ของตัวเอง การเขียนผ่าน backend เท่านั้น

การเปลี่ยน Like ใน UI แสดงผลทันทีระหว่างส่งค่าไป backend หากผิดพลาดจะคืนสถานะเดิมเฉพาะ Build ที่บันทึกไม่สำเร็จ
การ์ด Discover และ Liked แสดงยอดรวมข้างไอคอน Like จาก builds.likes
ตาราง build_likes เป็นแหล่งข้อมูลการกดจริง และ trigger ปรับยอด aggregate อัตโนมัติ
UI เพิ่ม/ลดยอดทันที และใช้ยอดที่ server ตอบกลับปรับให้ตรงหลังยืนยัน
หากบันทึกไม่สำเร็จจะคืนทั้งสีปุ่มและตัวเลขเดิม

## API

- GET `/api/likes/builds?offset=0`: Active user เห็น Build สาธารณะที่ตัวเอง Like
- PUT `/api/likes/:buildId`: Like แบบ idempotent (กดซ้ำ/retry ไม่เพิ่มแถว)
- DELETE `/api/likes/:buildId`: Unlike แบบ idempotent

กำหนด user_id จาก verified access token เสมอ ไม่รับ owner จาก client
response ใช้ no-store และไม่ส่ง user_id/email ของเจ้าของ Build
รายการแบ่งครั้งละ 100 และ Frontend โหลดต่อด้วย nextOffset
ตัวแปลงการ์ดร่วมกับ Discover อยู่ Backend src/services/showcase-builds.js

Frontend cache ใน memory 5 นาทีแยกตามบัญชี ไม่ขอซ้ำทุกครั้งที่เปลี่ยนเมนู
Like/Unlike อัปเดต snapshot ทันทีหลัง server ตอบ และบันทึก/ลบ/เปลี่ยนสถานะ
Build จะ invalidate รายการเช่นเดียวกับ Discover กดรีเฟรชเพื่อโหลดใหม่ได้
ออกจากระบบ/เปลี่ยนบัญชีจะล้างรายการเก่าและไม่ใช้ response ที่มาช้าของบัญชีก่อน

## Setup

รัน Backend `supabase/migrations/202611010002_build_likes.sql` ตามด้วย
`supabase/migrations/202611010003_build_like_counts.sql` แล้ว restart Backend
migration หลังคำนวณยอดเดิมใหม่จาก Like จริง โดยไม่ลบข้อมูล Build/Like
trigger เพิ่ม/ลดยอดแบบ atomic และ guard ป้องกันการส่งยอดปลอมผ่านการแก้ Build
การลบบัญชีจะลบ Like ตาม FK และปรับยอดของ Build ที่เหลือด้วย
ไม่ต้องเพิ่มคีย์ใน Frontend ใช้ Backend Supabase Secret key เดิม
`node scripts/smoke-likes-live.js` ทดสอบฐานข้อมูลจริงด้วยบัญชี/Build ชั่วคราว
แล้วล้างข้อมูลทดสอบทั้งหมด ไม่อยู่ใน npm test ปกติ
