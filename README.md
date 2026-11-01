# Performante Lab Frontend

Frontend สำหรับ Performante Lab พัฒนาด้วย Angular แบบ standalone components

## เริ่มใช้งาน

- ติดตั้ง dependencies: `npm install`
- เปิด development server: `npm start` แล้วเข้า http://localhost:4200
- Build production: `npm run build`
- ทดสอบ: `npm test -- --watch=false`

## โครงสร้าง

```text
assets/                         รูปต้นฉบับ (Angular คัดลอกไป /assets ตอน build)
src/
  app/
    app.ts / app.html           App shell แสดงหน้าผ่าน RouterOutlet
    app.routes.ts               กำหนด URL และโหลดแต่ละหน้า
    app.config.ts               Providers ของแอป
    app.config.server.ts        Providers สำหรับ server rendering
    app.routes.server.ts        กำหนด server rendering ของ routes
    app.spec.ts                 ทดสอบ app shell และเส้นทางหน้า Home
    features/
      home/
        home.ts                 Component ของหน้า Home
        home.html               Header, hero, สถิติ และข้อความ
        home.css                Layout และ responsive ของหน้า Home
    shared/
      ui/
        start-button/
          start-button.ts       ปุ่มใช้ร่วมกัน พร้อม inputs
          start-button.html     เนื้อหาและลูกศร
          start-button.css      สี ขนาด hover และ focus ของปุ่ม
  styles/
    tokens.css                  ตัวแปรฟอนต์และสีพื้นฐาน
    base.css                    Reset และสไตล์พื้นฐานของเอกสาร
  styles.css                    จุดรวม imports ของ global styles
  index.html                    Metadata และ Google Fonts
  main.ts                       Browser entry point
  main.server.ts                Server entry point
  server.ts                     Express SSR server
```

## แนวทางเพิ่มหรือแก้ไข

- แก้หน้าแรกที่ `src/app/features/home/` โดย HTML, CSS และ TypeScript แยกไฟล์กัน
- เพิ่มหน้าใหม่ใน `features/<ชื่อหน้า>/` แล้วลงทะเบียนใน `app.routes.ts`
- Component ที่ใช้ได้หลายหน้าให้เก็บใน `shared/ui/`; ส่วนที่ใช้เฉพาะหน้าให้เก็บใน feature นั้น
- สไตล์ layout อยู่กับหน้าหรือ component ที่ใช้ ส่วนค่ากลาง เช่น ฟอนต์ อยู่ใน `styles/tokens.css`
- เพิ่ม services หรือ models ภายใน feature เมื่อมีการเชื่อม API จริง
- รูปใช้จาก `assets/` โดยอ้าง URL `assets/ชื่อไฟล์`; การคัดลอกกำหนดไว้ใน `angular.json`

## ปุ่มที่ใช้ร่วมกัน

ใช้ component บน native button เพื่อคง keyboard interaction และ semantics:

```html
<button appStartButton variant="light" type="button">GET START</button>
<button appStartButton variant="red" [showArrow]="true" type="button">
  GET START
</button>
```

นำเข้า `StartButton` ใน `imports` ของ component ที่ใช้งาน แล้วผูก `(click)` หรือ routing ตาม flow ที่ต้องการ ปัจจุบันปุ่มยังไม่มีหน้าปลายทาง

## ฟอนต์

ใช้ Krona One สำหรับข้อความเด่น และ Kulim Park สำหรับข้อความทั่วไป พร้อม Noto Sans Thai สำรองอักขระไทย โหลดจาก Google Fonts ใน `index.html` จึงต้องมีอินเทอร์เน็ตเพื่อแสดงฟอนต์เหล่านี้

## React Bits

ใช้ ShinyText แบบปรับเป็น Angular ใน `src/app/shared/react-bits/shiny-text/`
โดยใช้ clipped gradient และ CSS animation สำหรับแสงพาดข้อความ
ปิด animation เมื่อเปิด reduced motion ปุ่มอยู่กับที่ ไม่มี Magnet หรือการติดตามเมาส์
ดูที่มาและใบอนุญาตใน `THIRD_PARTY_NOTICES.md`

### Specular Button

ปุ่ม GET START ทั้งสองใช้ WebGL renderer ของ React Bits SpecularButton
ปรับ lifecycle เป็น Angular ใน shared/ui/start-button โดยไม่มี React runtime
แสงสะท้อนตามขอบจะตอบสนองต่อเมาส์ แต่ปุ่มไม่เปลี่ยนตำแหน่งหรือขนาด
เมื่อเปิด reduced motion จะใช้แสงคงที่ และมี CSS glass rim สำรองเมื่อไม่มี WebGL

## หน้า Login

- URL: /login โหลดหน้าแบบ lazy route; ปุ่ม GET START บนหน้า Home เชื่อมมาที่หน้านี้
- ไฟล์ฟอร์ม: src/app/features/auth/login/
- ส่วนภาพด้านขวา: features/auth/login/components/login-visual/
- ใช้ assets/car_pic_loginpage.jpg บนจอใหญ่ และแสดงฟอร์มเต็มความกว้างบนมือถือ
- ตรวจช่องว่าง ชื่อผู้ใช้/รหัสผ่าน พร้อมแสดง/ซ่อนรหัสผ่าน และข้อความสถานะที่อ่านได้ด้วย screen reader
- ยังไม่มี API สำหรับ sign-in, Google OAuth หรือ password recovery จึงแสดงสถานะว่ายังไม่เปิดใช้งาน ไม่สร้าง session จำลองและไม่เก็บรหัสผ่าน

## แนวทางใช้ Tailwind CSS

ใช้ Tailwind CSS v4 เป็นหลักสำหรับ layout, spacing, sizing และ responsive
โดยเขียน utility classes ใน HTML ของ Home, Login และส่วนประกอบของแต่ละหน้า
ใช้ค่าจาก spacing scale ก่อน และใช้ arbitrary values เมื่อจำเป็น เช่น สัดส่วนคอลัมน์หรือขนาดตาม container

- เพิ่มหรือแก้ layout ที่ class ของ element ใน template
- เก็บ CSS เฉพาะ typography ที่ซับซ้อน, gradients, pseudo-elements, keyframes และเอฟเฟกต์ React Bits
- ไม่ประกาศ property ของ layout ซ้ำทั้งใน CSS และ Tailwind ของ element เดียวกัน
- ปุ่มร่วมใช้ Tailwind ใน host classes และเก็บ WebGL/glass styling ในไฟล์ CSS ของปุ่ม
- คง global reset และ design tokens ใน src/styles/

## หน้าหลัก Discover

เปิด /discover สำหรับ workspace หลังเข้าใช้งาน แยกจาก Landing ที่ /
ใช้ Tailwind สำหรับ layout และ responsive พร้อม sidebar และการ์ด Build ที่ใช้ซ้ำได้

- ค้นหาชื่อ Build ผู้สร้าง และรถ พร้อมกรอง Street / Track / Show และรายการที่บันทึก
- เปิดรายละเอียดหรือสร้างฉบับร่างจากการ์ด
- Catalog แสดงรถตัวอย่างจาก assets และ My Builds แสดงฉบับร่างที่สร้างในหน้านี้
- รายการใน discover.data.ts เป็นข้อมูลสาธิต ภาพไม่จำลองการเปลี่ยนชิ้นส่วนจริง
- bookmark และ compare อยู่ในหน่วยความจำ ส่วน My Builds บันทึกใน localStorage หลังตั้งชื่อตอน Save
- ยังไม่ได้เชื่อม authentication, community builds, catalog หรือ save API

### Temporary Sign In preview

ปุ่ม Sign In พาไป /discover ได้ทันทีโดยไม่ต้องกรอกข้อมูล เพื่อทดสอบ UI
ยังไม่ยืนยันตัวตนหรือสร้าง session ส่วน Google และ password recovery ยังไม่เปิดใช้งาน

## Icons — Font Awesome

ใช้ @fortawesome/angular-fontawesome 5.x สำหรับ Angular 22
ร่วมกับ Font Awesome Free Solid และ Brands โดย import เฉพาะ icon definitions ที่ใช้งาน
เรียกผ่าน shared/ui/icon/icon.ts เช่น:

<app-icon name="search" />
<app-icon name="google" />
<app-icon name="arrow" />

เพิ่มชื่อและ definition ที่ component กลางเมื่อจำเป็น ใช้ Tailwind กำหนดขนาด/สี
ตัว icon เป็น decorative (aria-hidden) ให้ตั้ง accessible label บนปุ่มหรือลิงก์ที่ครอบ
ไม่เพิ่ม inline SVG หรืออักขระลูกศรแทน icon ใน UI ใหม่

## Catalog แบบยี่ห้อ → รุ่นรถ → พาร์ต

- เปิด /catalog โดยตรง หรือเลือก Catalog ใน workspace
- หน้าแรกจัดกลุ่มรุ่นรถตามยี่ห้อ มีค้นหาและกรองยี่ห้อ
- กดการ์ดรถเพื่อดูภาพรถและหมวด Full Body Kits, Front Bumpers, Rear Bumpers, Wheels, Spoilers
- ค้นหาชื่อพาร์ต/finish/หมวด และกรองหมวด พร้อม empty state และ Back to all
- การ์ดพาร์ตเป็นข้อมูลอ่านอย่างเดียว แสดงชื่อ คำอธิบาย Finish และราคาอ้างอิงทันที ไม่มี dialog หรือการเลือกติดตั้งใน Catalog
- แยก UI ใน features/catalog/catalog.html, logic ใน catalog.ts และอ่านข้อมูลร่วมจาก StorageCatalogStore
- โลโก้ รถ และพาร์ทอ่านจาก Supabase ผ่าน /api/catalog/storage พร้อม cache; ไม่มี local catalog fallback
- ไฟล์ assets คงไว้เฉพาะโลโก้เว็บไซต์และภาพ Home/Login ดูรายละเอียดใน docs/local-assets.md


## Compare ของแต่ง

เปิด /compare หรือเลือก Compare ใน workspace
UI อยู่ใน features/compare/ ใช้ Tailwind และ Font Awesome
เลือกแบรนด์จากแถบโลโก้ เลือกรุ่นรถและหมวด แล้วเลือกของแต่งสองฝั่งจากข้อมูล Catalog
- ป้องกันการเลือกพาร์ตเดียวกันซ้ำ และล้างตัวเลือกเมื่อเปลี่ยนแบรนด์ รุ่นรถ หรือหมวด
- แสดงรายละเอียด inline พร้อมไฮไลต์ Finish ที่ต่างกัน สลับฝั่งและล้างรายการได้
- หมวดที่มีเพียงรายการเดียวจะแจ้งว่ายังเปรียบเทียบสองชิ้นไม่ได้
- ราคา สมรรถนะ และข้อมูลการติดตั้งยังไม่มีข้อมูลยืนยัน ไม่แสดงตัวเลขสมมติ
- ใช้แทนหน้าเปรียบเทียบ Build แบบเดิม


## My Builds และ Create Build

- เปิด /my-builds เพื่อดู Build ที่บันทึกไว้ และ /build/new เพื่อเริ่มแต่งรถ
- กด Create Build แล้วเลือกแบรนด์และรุ่นรถได้ทันที ยังไม่ต้องตั้งชื่อ
- เลือกพาร์ตได้หนึ่งชิ้นต่อหมวด กดซ้ำหรือกดถอดเพื่อนำออก
- เปลี่ยนรถขณะเลือกพาร์ตแล้วต้องยืนยันก่อนล้างรายการเดิม
- กด Save หลังแต่งเสร็จจึงเปิดฟอร์มตั้งชื่อ และกลับ My Builds เมื่อบันทึกสำเร็จ
- เปิด Build เดิมเพื่อแก้ไขโดยคง ID และวันสร้างเดิม ลบต้องยืนยันก่อน
- มีการยืนยันเมื่อออกจากงานที่ยังไม่ได้บันทึก
- BuildsStore เก็บข้อมูลแบบ versioned ใน localStorage (performante-lab.builds.v1)
- ข้อมูลอยู่เฉพาะเบราว์เซอร์และ origin นี้ ยังไม่ซิงก์บัญชีหรือเชื่อม backend
- ภาพยังเป็นรถต้นแบบ พาร์ตเป็นข้อมูล Concept ไม่มี Layer, compatibility หรือราคาอ้างอิงจริง
- ไม่สร้างค่าประมาณสมรรถนะและงบรวมเมื่อไม่มีข้อมูล
- แยก UI, state และ persistence ใน features/my-builds/

### Layout และกฎ Full Body Kit

- หมวดของแต่งเรียงต่อกันในคอลัมน์หลัก และสรุปรายการที่เลือกอยู่ด้านขวาแบบ sticky บนจอใหญ่
- ปุ่มลัดเลื่อนไปแต่ละหมวดหรือสรุปรายการได้ โดยไม่เปลี่ยน route และไม่ทำรายการแต่งหาย
- Full Body Kit เป็นชุดสำเร็จ ใช้ร่วมกับพาร์ตแยกทุกหมวดไม่ได้
- หากมีพาร์ตแยกอยู่แล้ว ต้องยืนยันก่อนแทนที่ด้วยชุดเต็ม
- เมื่อเลือกชุดเต็ม พาร์ตแยกถูก disabled และใช้ cursor-not-allowed; ถอดชุดเต็มแล้วเลือกแยกได้อีกครั้ง
- BuildsStore ตรวจซ้ำก่อน Save เพื่อไม่ให้บันทึกชุดเต็มผสมพาร์ตแยก
- Build เก่าที่เคยเลือกผสมยังไม่ถูกเขียนทับอัตโนมัติ เมื่อเปิดแก้ไขจะใช้เฉพาะชุดเต็มและแจ้งให้ตรวจสอบก่อน Save

## Google Login ผ่าน Supabase

ระบบ Login เปลี่ยนจาก UI preview เป็น Supabase OAuth แล้ว ดูขั้นตอน env, Supabase และ Google Cloud Console ที่ [docs/google-login-setup.md](docs/google-login-setup.md) โดยใช้ npm start/npm run build เพื่อสร้าง browser config อัตโนมัติ ปุ่ม Sign In เดิมไม่ข้าม auth แล้ว My Builds/Create Build ต้องเข้าสู่ระบบก่อน ส่วน Builds ยังเก็บ localStorage ตามเบราว์เซอร์เช่นเดิม
