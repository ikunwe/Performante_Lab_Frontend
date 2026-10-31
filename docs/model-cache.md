# รุ่นรถและ cache — ชื่อรุ่นอย่างเดียว

ชุดใช้งานปัจจุบัน schemaVersion 2 มี 28 แบรนด์และ 801 ชื่อรุ่น เก็บเฉพาะ id, brandId, name และ sourceUrl ไม่มีปี โฉม รหัสตัวถัง หรือเครื่องยนต์ในรายการที่จัดเก็บ/ส่ง API

Supabase ใช้ public.car_brand_reference.details.modelCatalog แยกตาม brand ID ในตารางเดิมที่เปิด RLS อ่านผ่าน Backend เท่านั้น โดยสำรองข้อมูลเดิมก่อนแทนที่และอ่านกลับตรวจครบทั้ง 28 แบรนด์ ไม่ต้องรัน SQL เพิ่ม

GET /api/catalog/models?brandId=honda อ่านรายการรุ่นของแบรนด์นั้น ส่วน /api/catalog/models/export ดาวน์โหลด snapshot ดัดแปลงภายใต้ ODbL 1.0 พร้อม attribution

Backend cache 1 ชั่วโมงต่อแบรนด์ แชร์ in-flight requests และใช้ snapshot เก่าพร้อม backoff 30 วินาทีเมื่อ refresh ล้มเหลว Frontend ใช้ memory/localStorage 1 ชั่วโมง namespace performante-lab.models.v2-names แยกตาม API + Supabase project + brand ID และล้าง cache v1 ของแบรนด์ที่เปิดดูเพื่อไม่เก็บข้อมูลโฉมเดิมซ้ำ

หน้าเลือก: ยี่ห้อ → รูปและชื่อรุ่น → พาร์ต ไม่มีขั้นเลือกโฉมหรือปี ภาพจาก assets/List_Car ยังคงจับคู่ตามชื่อรุ่น รูปที่มีปีในชื่อใช้เป็นภาพตัวแทนของรุ่นโดยไม่เพิ่มปีเข้าฐานข้อมูล Build เดิมที่บันทึกไว้ยังอ่านได้ ข้อมูลพาร์ตของรถที่นำเข้ายังไม่ได้เพิ่ม

อัปเดตจาก Backend ด้วย npm run data:models:offline เพื่อสร้างชุดชื่อรุ่นจาก snapshots หรือ npm run data:models เพื่อดาวน์โหลด snapshots revision เดิม แล้ว npm run data:models:sync เพื่อนำเข้า Supabase สคริปต์ไม่ดึงโฉมหรือปีกลับมาในชุดใช้งาน

หลังเปลี่ยน schema ให้ restart Backend และรีเฟรช Frontend ข้อมูลทั่วโลกยังเป็นรายการอ้างอิง ไม่ใช่หลักฐานว่าแต่ละรุ่นจำหน่ายในไทยหรือใช้พาร์ตร่วมกันได้
