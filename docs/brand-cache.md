# Brand catalog cache

หน้าเลือกแบรนด์ใช้ `BrandDirectory` ซึ่งอ่าน snapshot ร่วมจาก
`StorageCatalogStore` ผ่าน `GET /api/catalog/storage` ไม่มีการเรียก API แบรนด์แยกแล้ว

- Frontend cache 5 นาทีใน memory/localStorage แยกตาม Supabase project และ Backend URL
- Backend cache 1 นาทีและรวมคำขอที่เข้ามาพร้อมกัน
- ปุ่มรีเฟรชบังคับโหลดใหม่และกดซ้ำไม่ได้ระหว่างรอ
- Admin อัปโหลดผ่าน CatalogStorageHelper แล้วแจ้งให้ cache ฝั่ง User อัปเดต
- ชื่อและโลโก้ได้จากโฟลเดอร์แบรนด์ใน bucket `catalog`

API อ้างอิงเดิมถูกถอดออก แต่ตาราง `car_brand_reference`, ชุดข้อมูลอ้างอิง
และ assets ภาพเดิมยังเก็บไว้ ไม่มีการลบข้อมูลหรือรัน SQL ในการเปลี่ยนแปลงนี้

รายละเอียดโครงสร้างและ cache: [Storage user catalog](storage-user-catalog.md)
