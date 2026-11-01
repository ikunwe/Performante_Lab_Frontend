# Model catalog cache

หน้าเลือกรุ่นใช้ `ModelDirectory` กรองรถจาก snapshot ร่วมของ `StorageCatalogStore`
ตามโฟลเดอร์แบรนด์ จึงไม่ต้องเรียก API แยกต่อแบรนด์

แหล่งข้อมูลคือ `GET /api/catalog/storage` ใช้ cache เดียวกับรายการแบรนด์:
Frontend 5 นาที, Backend 1 นาที และรองรับบังคับรีเฟรช
รายชื่อ/ภาพรถมาจาก `{Brand}/{Model}/CarPicture.*` ใน bucket `catalog`

API รายการรุ่นและ export แบบเดิมถูกถอดออกแล้ว ข้อมูลอ้างอิงใน Supabase ยังอยู่
ชุดข้อมูลดัดแปลงพร้อม attribution และใบอนุญาตเก็บไว้ที่ Backend
`data/models/car-models.json` และ `data/models/raw/LICENSE-DATA`
ยังเก็บเพื่อรองรับ Build อ้างอิงเก่าและงานดูแลข้อมูลแบบ manual

assets รถ แบรนด์ พาร์ท และมุมมองเดิมยังเก็บไว้ ไม่มีการนำเข้าหรือลบภาพอัตโนมัติ
รายละเอียดระบบปัจจุบัน: [Storage user catalog](storage-user-catalog.md)
