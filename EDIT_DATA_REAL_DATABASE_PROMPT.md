# 🚀 MASTER WORKER PROMPT: Admin Edit Data Real Database Integration (Supabase + Angular)
## Feature: เปลี่ยนหน้า Admin Edit Data ให้เชื่อมต่อฐานข้อมูลจริง 100% (ยกเลิก Mockup ทั้งหมด)

---

## 📌 บทบาทและบริบทของงาน (Role & Context)
คุณคือ **Senior Full-Stack Developer (Supabase PostgreSQL + Angular 22)** ประจำโปรเจกต์ **Performante Lab**
หน้าที่ของคุณคือ พัฒนาระบบ **Admin Edit Data (`/admin/edit-data`)** ให้เชื่อมต่อและทำงานร่วมกับ **ฐานข้อมูลจริง (Supabase Tables: `car_brands`, `car_models`, `car_parts`)** และ **Supabase Storage (`catalog` Bucket)** แบบ Real-time โดย**ยกเลิกการใช้ข้อมูล Mockup และ LocalStorage ทั้งหมด**

---

## 🎯 วัตถุประสงค์หลัก (Core Objectives)
1. **สร้าง Database Schema & RLS**: สร้างตาราง `car_brands`, `car_models`, `car_parts` พร้อมกำหนดความสัมพันธ์ Foreign Key (Cascade Delete) และตั้งค่า RLS:
   - **Public Read (`select`)**: ให้ทุกคน (Public/Anon/Authenticated) อ่านข้อมูลรถและพาร์ตได้
   - **Admin Only Write (`insert`, `update`, `delete`)**: อนุญาตเฉพาะ `Admin` และ `SuperAdmin` ผ่านฟังก์ชัน `public.is_admin_or_superadmin(auth.uid())`
2. **ดึงข้อมูลจริงจาก Supabase (Real Database Queries)**:
   - Level 1: ดึงรายชื่อแบรนด์ทั้งหมดจากตาราง `car_brands`
   - Level 2: ดึงรุ่นรถเฉพาะแบรนด์ที่เลือกจากตาราง `car_models`
   - Level 3: ดึงพาร์ตเฉพาะรุ่นรถที่เลือกจากตาราง `car_parts`
3. **บันทึกข้อมูลจริงและอัปโหลดรูปจริง**:
   - เมื่อกดปุ่ม `(+)` บันทึก Brand, Car Model หรือ Part:
     - 1) อัปโหลดไฟล์รูปขึ้น Supabase Storage Bucket `catalog` ตาม Tree Path
     - 2) นำ Public URL ที่ได้ มา `INSERT` ลงในตารางที่เกี่ยวข้องบน Supabase
     - 3) อัปเดตรายการในหน้าจอทันที
4. **ลบ Mockup Data ออกจากโค้ด 100%**:
   - กำหนดค่าเริ่มต้นของ Signal ต่างๆ เป็น Array ว่าง `[]`
   - แสดง Loading Skeleton/Spinner ระหว่างดึงข้อมูลจริง
   - แสดง Empty State Card เมื่อยังไม่มีข้อมูลในระบบ

---

## 📂 รายละเอียดการพัฒนาทีละขั้นตอน (Step-by-Step Tasks)

### ─── STEP 1: SQL MIGRATION (DATABASE SCHEMA & RLS) ───
**ตำแหน่งไฟล์**: `Performante_Lab_Backend/supabase/migrations/202610310004_car_catalog_schema.sql`

```sql
-- Migration: Car Catalog Schema (Brands, Models, Parts) with Strict Admin Write RLS
begin;

-- 1. ตาราง แบรนด์รถยนต์ (car_brands)
create table if not exists public.car_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique check (char_length(slug) between 1 and 80),
  logo_url text not null,
  is_custom_bg boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ตาราง รุ่นรถยนต์ (car_models)
create table if not exists public.car_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.car_brands(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  slug text not null check (char_length(slug) between 1 and 100),
  image_url text not null,
  body_type text not null default 'Coupe',
  year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ตาราง ชิ้นส่วนและชุดแต่ง (car_parts)
create table if not exists public.car_parts (
  id uuid primary key default gen_random_uuid(),
  car_model_id uuid not null references public.car_models(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  name text not null check (char_length(name) between 1 and 120),
  manufacturer text not null check (char_length(manufacturer) between 1 and 80),
  image_url text not null,
  price numeric not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. ดัชนีเพื่อประสิทธิภาพการค้นหา (Indexes)
create index if not exists idx_car_models_brand_id on public.car_models(brand_id);
create index if not exists idx_car_parts_car_model_id on public.car_parts(car_model_id);
create index if not exists idx_car_parts_category on public.car_parts(category);

-- 5. เปิดใช้งาน ROW LEVEL SECURITY (RLS)
alter table public.car_brands enable row level security;
alter table public.car_models enable row level security;
alter table public.car_parts enable row level security;

-- ─── 5.1 RLS: car_brands ───
drop policy if exists "Public read car_brands" on public.car_brands;
create policy "Public read car_brands" on public.car_brands
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins can insert car_brands" on public.car_brands;
create policy "Admins can insert car_brands" on public.car_brands
  for insert to authenticated
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can update car_brands" on public.car_brands;
create policy "Admins can update car_brands" on public.car_brands
  for update to authenticated
  using (public.is_admin_or_superadmin(auth.uid()))
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can delete car_brands" on public.car_brands;
create policy "Admins can delete car_brands" on public.car_brands
  for delete to authenticated
  using (public.is_admin_or_superadmin(auth.uid()));

-- ─── 5.2 RLS: car_models ───
drop policy if exists "Public read car_models" on public.car_models;
create policy "Public read car_models" on public.car_models
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins can insert car_models" on public.car_models;
create policy "Admins can insert car_models" on public.car_models
  for insert to authenticated
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can update car_models" on public.car_models;
create policy "Admins can update car_models" on public.car_models
  for update to authenticated
  using (public.is_admin_or_superadmin(auth.uid()))
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can delete car_models" on public.car_models;
create policy "Admins can delete car_models" on public.car_models
  for delete to authenticated
  using (public.is_admin_or_superadmin(auth.uid()));

-- ─── 5.3 RLS: car_parts ───
drop policy if exists "Public read car_parts" on public.car_parts;
create policy "Public read car_parts" on public.car_parts
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins can insert car_parts" on public.car_parts;
create policy "Admins can insert car_parts" on public.car_parts
  for insert to authenticated
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can update car_parts" on public.car_parts;
create policy "Admins can update car_parts" on public.car_parts
  for update to authenticated
  using (public.is_admin_or_superadmin(auth.uid()))
  with check (public.is_admin_or_superadmin(auth.uid()));

drop policy if exists "Admins can delete car_parts" on public.car_parts;
create policy "Admins can delete car_parts" on public.car_parts
  for delete to authenticated
  using (public.is_admin_or_superadmin(auth.uid()));

commit;
```

---

### ─── STEP 2: อัปเดต `AdminService` สำหรับดึงและบันทึกฐานข้อมูลจริง ───
**ตำแหน่งไฟล์**: `Performante_Lab_Frontend/src/app/features/admin/services/admin.service.ts`

1. **ปรับ Interfaces ให้ตรงกับตารางฐานข้อมูล**:
   ```typescript
   export interface RealBrandItem {
     id: string;
     name: string;
     slug: string;
     logo_url: string;
     is_custom_bg: boolean;
     created_at?: string;
   }

   export interface RealCarModelItem {
     id: string;
     brand_id: string;
     name: string;
     slug: string;
     image_url: string;
     body_type: string;
     year?: string;
     created_at?: string;
   }

   export interface RealPartItem {
     id: string;
     car_model_id: string;
     category: string;
     name: string;
     manufacturer: string;
     image_url: string;
     price: number;
     created_at?: string;
   }
   ```

2. **Signals เริ่มต้นด้วย `[]` (ไม่มี Mockup)**:
   ```typescript
   readonly catalogBrands = signal<RealBrandItem[]>([]);
   readonly catalogModels = signal<RealCarModelItem[]>([]);
   readonly catalogParts = signal<RealPartItem[]>([]);
   readonly catalogLoading = signal<boolean>(false);
   ```

3. **ฟังก์ชันดึงข้อมูลจาก Database**:
   ```typescript
   // 1. ดึงแบรนด์ทั้งหมด
   async fetchCatalogBrands(): Promise<void> {
     const client = await this.getClient();
     if (!client) return;
     this.catalogLoading.set(true);
     try {
       const { data, error } = await client
         .from('car_brands')
         .select('*')
         .order('name', { ascending: true });
       if (error) throw error;
       this.catalogBrands.set(data || []);
     } catch (err: any) {
       this.error.set('โหลดข้อมูลแบรนด์ไม่สำเร็จ');
     } finally {
       this.catalogLoading.set(false);
     }
   }

   // 2. ดึงรุ่นรถตาม brand_id
   async fetchCatalogModels(brandId: string): Promise<void> {
     const client = await this.getClient();
     if (!client || !brandId) return;
     this.catalogLoading.set(true);
     try {
       const { data, error } = await client
         .from('car_models')
         .select('*')
         .eq('brand_id', brandId)
         .order('name', { ascending: true });
       if (error) throw error;
       this.catalogModels.set(data || []);
     } catch (err: any) {
       this.error.set('โหลดข้อมูลรุ่นรถไม่สำเร็จ');
     } finally {
       this.catalogLoading.set(false);
     }
   }

   // 3. ดึงพาร์ตตาม car_model_id
   async fetchCatalogParts(carModelId: string): Promise<void> {
     const client = await this.getClient();
     if (!client || !carModelId) return;
     this.catalogLoading.set(true);
     try {
       const { data, error } = await client
         .from('car_parts')
         .select('*')
         .eq('car_model_id', carModelId)
         .order('created_at', { ascending: true });
       if (error) throw error;
       this.catalogParts.set(data || []);
     } catch (err: any) {
       this.error.set('โหลดข้อมูลพาร์ตไม่สำเร็จ');
     } finally {
       this.catalogLoading.set(false);
     }
   }
   ```

4. **ฟังก์ชันบันทึกข้อมูลลง Database**:
   ```typescript
   // บันทึก Brand
   async insertBrand(item: { name: string; slug: string; logo_url: string; is_custom_bg?: boolean }): Promise<{ ok: boolean; error?: string }> {
     const client = await this.getClient();
     if (!client) return { ok: false, error: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน' };
     try {
       const { data, error } = await client
         .from('car_brands')
         .insert([{
           name: item.name,
           slug: item.slug,
           logo_url: item.logo_url,
           is_custom_bg: item.is_custom_bg ?? false,
         }])
         .select()
         .single();
       if (error) throw error;
       this.catalogBrands.update((list) => [...list, data]);
       return { ok: true };
     } catch (err: any) {
       return { ok: false, error: err.message || 'บันทึก Brand ล้มเหลว' };
     }
   }

   // บันทึก Car Model
   async insertCarModel(item: { brand_id: string; name: string; slug: string; image_url: string; body_type?: string; year?: string }): Promise<{ ok: boolean; error?: string }> {
     const client = await this.getClient();
     if (!client) return { ok: false, error: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน' };
     try {
       const { data, error } = await client
         .from('car_models')
         .insert([item])
         .select()
         .single();
       if (error) throw error;
       this.catalogModels.update((list) => [...list, data]);
       return { ok: true };
     } catch (err: any) {
       return { ok: false, error: err.message || 'บันทึกรุ่นรถล้มเหลว' };
     }
   }

   // บันทึก Part
   async insertCarPart(item: { car_model_id: string; category: string; name: string; manufacturer: string; image_url: string; price?: number }): Promise<{ ok: boolean; error?: string }> {
     const client = await this.getClient();
     if (!client) return { ok: false, error: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน' };
     try {
       const { data, error } = await client
         .from('car_parts')
         .insert([item])
         .select()
         .single();
       if (error) throw error;
       this.catalogParts.update((list) => [...list, data]);
       return { ok: true };
     } catch (err: any) {
       return { ok: false, error: err.message || 'บันทึกพาร์ตล้มเหลว' };
     }
   }
   ```

---

### ─── STEP 3: เชื่อมต่อ COMPONENT `AdminEditData` กับ DATABASE ───
**ตำแหน่งไฟล์**: `Performante_Lab_Frontend/src/app/features/admin/edit-data/`

1. **โหลดข้อมูลตาม View State**:
   - เมื่อเข้าหน้า Edit Data: เรียก `this.adminService.fetchCatalogBrands()`
   - เมื่อคลิกเลือก Brand ใด: เรียก `this.adminService.fetchCatalogModels(brand.id)` แล้วสลับ View เป็น `'models'`
   - เมื่อคลิกเลือกรถ Car Model ใด: เรียก `this.adminService.fetchCatalogParts(car.id)` แล้วสลับ View เป็น `'parts'`
2. **Submit Modal Flow**:
   - **อัปโหลดรูปขึ้น Supabase Storage (`catalog` Bucket)** ผ่าน `CatalogStorageHelper.uploadFile()`
   - เมื่อได้ `publicUrl` ให้เรียกฟังก์ชัน `insertBrand()`, `insertCarModel()` หรือ `insertCarPart()`
   - แสดงข้อความ Toast แจ้งผลลัพธ์ ปิด Modal และแสดงข้อมูลใหม่ทันที
3. **Empty States**:
   - หากในแบรนด์ยังไม่มีรถ หรือในรถยังไม่มีพาร์ต ให้แสดงการ์ดปุ่ม `(+)` เด่นชัด พร้อมข้อความแจ้งว่ายังไม่มีข้อมูลจริง เพื่อให้ผู้ดูแลระบบกดเพิ่มข้อมูลจริงได้ทันที

---

## 🧪 4. Testing & Verification Checklist
1. **Migration Verification**:
   - นำไฟล์ `202610310004_car_catalog_schema.sql` ไปรันใน Supabase
   - ตรวจสอบว่ามีตาราง `car_brands`, `car_models`, `car_parts` พร้อม RLS Policies
2. **Unit Tests (`admin.spec.ts` & `admin.service.spec.ts`)**:
   - อัปเดตชุดทดสอบให้ Mock ข้อมูล Supabase client คืนค่าตารางจริง
   - ยืนยันว่าไม่มีการอ้างอิงถึง Static Array Mockup อีกต่อไป
3. **Automated Verification**:
   ```bash
   cd Performante_Lab_Frontend
   npm test -- --watch=false
   npm run build
   ```
4. **End-to-End Live Check**:
   - เปิดหน้า `/admin/edit-data`
   - ทดสอบกดปุ่ม `(+)` อัปโหลดรูปโลโก้และเพิ่มแบรนด์ใหม่ เช่น "Porsche" $\rightarrow$ ตรวจสอบว่าแบรนด์ปรากฏจริงในหน้าจอและในตาราง Supabase
   - กดเข้าไปใน "Porsche" กด `(+)` เพิ่มรุ่นรถ "911 GT3 RS" $\rightarrow$ ตรวจสอบว่ารุ่นรถปรากฏจริง
   - กดเข้าไปในรถ กด `(+)` เพิ่มชุดแต่ง "Manthey Racing Kit" $\rightarrow$ ตรวจสอบว่าพาร์ตแสดงผลพร้อมรูปจริง

---

## 📋 Definition of Done
- [ ] ไม่มี Mockup Data หลงเหลืออยู่ในหน้า Edit Data (เริ่มต้นว่าง และโหลดจาก DB จริง)
- [ ] มีตาราง `car_brands`, `car_models`, `car_parts` บน Supabase พร้อม RLS ควบคุมสิทธิ์
- [ ] แอดมินสามารถอัปโหลดรูปจริงจากเครื่อง และบันทึกข้อมูลเข้าสู่ฐานข้อมูลได้จริง
- [ ] เมื่อบันทึกแล้ว ข้อมูลแสดงผลบนการ์ดทันที และคงอยู่ถาวรใน Database
- [ ] Build และ Unit Tests ใน Frontend ผ่าน 100%

