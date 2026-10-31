# Brand catalog และ cache

หน้า Create Build โหลดแบรนด์ผ่าน `GET /api/catalog/brands?scope=starter` ของ Backend โดย Backend อ่าน `public.car_brand_reference` ใน Supabase ด้วย Secret key ฝั่ง server เท่านั้น ไม่เปิด RLS ของตารางเพื่อให้ browser อ่านเอง

- `scope=starter`: ชุดคัดเลือกใหม่ 28 แบรนด์ ชื่อ/โลโก้/aliases อ่านจากฐานข้อมูลจริง
- `scope=all`: คงไว้เพื่อรองรับ client เดิม แต่ส่งชุดใหม่ 28 แบรนด์เหมือน starter ไม่เปิดรายการเก่าที่อยู่นอกขอบเขต
- API ส่งออกเฉพาะ `id`, `slug`, `name`, `aliases`, `logoUrl` และ metadata ของ cache ไม่มีข้อมูลบัญชี/Secret key

## Cache

1. Backend: เก็บรายการทั้งหมดใน memory 1 ชั่วโมง แบ่งผลตอบตาม scope ภายหลัง การขอหลาย scope/หลายผู้ใช้พร้อมกันแชร์คำขอเดียว ไม่เรียกฐานข้อมูลแยกต่อคน
2. Frontend: memory + localStorage 1 ชั่วโมงตาม `expiresAt` จาก Backend ทำให้เปลี่ยนหน้า/กลับมาเลือก/รีเฟรชแล้วยังใช้ข้อมูลเดิมได้ เปลี่ยน namespace เป็น performante-lab.brands.v2-thailand เพื่อเลิกใช้ cache ชุดเก่า คีย์ cache แยกตาม API URL + Supabase Project URL + scope ไม่เก็บ token หรือคีย์ใด ๆ
3. ไม่ต่ออายุ cache เพียงเพราะอ่านซ้ำ เมื่อหมดอายุจะโหลดใหม่ หาก offline/อัปเดตไม่ได้แต่มีข้อมูลเก่า ให้แสดงข้อมูลเก่าพร้อมแจ้งสถานะ ไม่ทำให้รายการหาย
4. storage ถูกปิดหรือ quota เต็มยังใช้ memory cache ได้ หากข้อมูล cache เสียจะไม่ใช้ข้อมูลนั้นและลอง fetch ใหม่
5. API response มี HTTP cache สูงสุด 5 นาที Frontend ใช้ `no-cache` ตอนขอเพื่อ revalidate และตรวจ TTL ใน payload เอง

ปุ่ม “โหลดรายการใหม่” ข้าม cache ฝั่ง Frontend แต่ Backend ยังใช้ cache 1 ชั่วโมงเพื่อไม่ยิง Supabase ทุกครั้ง หากผู้ดูแลแก้ข้อมูลแล้วต้องการให้มีผลทันที ให้ restart Backend แล้วกดโหลดใหม่ ถ้ารัน Backend หลาย instance แต่ละ instance จะมี memory cache ของตัวเอง; ยังไม่มี Redis หรือ shared cache

Cache นี้ใช้กับรายการแบรนด์ ไม่ใช่การบันทึก Build หรือความเข้ากันได้ของพาร์ต ภาพโลโก้ที่มี URL ใช้ browser image cache ตาม HTTP headers และ lazy loading; รูปที่โหลดไม่ได้/ยังไม่มี URL ใช้ Font Awesome แทน

แผ่นรองโลโก้วิเคราะห์พิกเซลจากภาพที่โหลดแล้วขนาดตัวอย่าง 48×48 โดยไม่นับขอบโปร่งใส เลือกโทนสว่าง/เข้ม/กลางเพื่อให้เห็นทั้งส่วนดำและขาว พร้อมเจือสีจากโลโก้ Cache เฉพาะค่าสี 7 วันใน memory/localStorage แยกตาม URL สูงสุด 600 รูป ไม่ fetch ภาพเพิ่มเพื่อวิเคราะห์ และไม่เปลี่ยนสีภาพต้นฉบับ ถ้า canvas/CORS ใช้ไม่ได้ให้ใช้สีเทากลางเดิม

โลโก้เสริม 9 แบรนด์จาก GitHub เก็บใน `assets/brands/supplemental/` และเลือกตาม brand ID ตอนแสดงผล จึงใช้ได้กับรายการที่อยู่ใน cache เดิมโดยไม่ต้องแก้ SQL หรือโหลดฐานข้อมูลใหม่ แหล่งที่มาและสิทธิ์อยู่ใน `assets/brands/SOURCES.md`

## หน้าจอ

มีค้นหาจากชื่อ/aliases, loading/retry, และป้ายสถานะว่ามีรุ่นรถสาธิตหรือยัง แบรนด์ที่ยังไม่มีรุ่นเลือกดูได้แต่สร้างรถปลอมไม่ได้ Ferrari/Lamborghini ยังใช้ข้อมูลรุ่นและพาร์ตสาธิตเดิมจนกว่าจะเพิ่ม models API

## เปิดใช้งาน

ข้อมูล SQL ที่นำเข้าไว้ใช้ได้เลย ไม่ต้องรัน migration เพิ่ม ตรวจว่า Backend `.env` มี `SUPABASE_URL` และ `SUPABASE_SECRET_KEY` ของโปรเจกต์เดียวกับตาราง แล้ว restart ด้วย `npm run dev` เพื่อโหลด routes ใหม่ ส่วน Frontend ใช้ `API_BASE_URL` จาก `.env` เดิม

ตรวจได้จาก `/api/catalog/brands?scope=starter` และ `/api/catalog/brands?scope=all` ข้อมูลจริงอัปเดตและตรวจอ่านได้ 28 รายการทั้งสอง scope ณ วันที่ 30 ต.ค. 2026 โดยสำรองชุดเดิม 557 แถวใน Backend tmp/ ก่อนแทนที่เฉพาะตาราง car_brand_reference
