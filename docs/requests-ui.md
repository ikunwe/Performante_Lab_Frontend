# User Requests mockup

เปิดจากเมนูโปรไฟล์ → Requests (`/requests`, ต้องเข้าสู่ระบบ)

รองรับประเภทแบรนด์รถ รุ่นรถ BodyKit รอบคัน และพาร์ทแยก พร้อม Title,
บริบทรถ รายละเอียด ผู้ผลิต ลิงก์อ้างอิง และภาพ PNG/JPG/WebP สูงสุด 5 รูป
รูปละไม่เกิน 10 MB สามารถตรวจสอบและแก้ไขฉบับร่างได้

รอบนี้เป็น UI mockup: ฉบับร่างอยู่ใน memory ของหน้าปัจจุบันเท่านั้น
ออกจากหน้า/รีเฟรชแล้วข้อมูลหาย ยังไม่อัปโหลดภาพ ไม่เขียน `part_requests`
และไม่ส่งคำขอให้ Admin มีข้อความแจ้งสถานะนี้ใน UI

ส่วน Catalog/Discover/My Builds ใช้ข้อมูลผ่าน Backend แล้ว ดู
[Storage catalog](storage-user-catalog.md), [Discover](discover-builds.md)
และ [Builds](cloud-builds.md) หน้า Requests นี้ยังไม่รวมอยู่ในการเชื่อม Backend
