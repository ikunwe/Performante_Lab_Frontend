# 🛠️ MASTER FIX PROMPT: แก้ไขปัญหา Upload & ดึงข้อมูลใน Admin Edit Data ไม่ขึ้น
## Root Cause: ตาราง `car_brands`, `car_models`, `car_parts` ยังไม่ได้สร้างใน Supabase

---

## 🔍 สรุปผลการตรวจสอบ (Diagnostic Investigation)
จากการตรวจสอบการเชื่อมต่อกับ Supabase (`oxzejsgfazbjjqopkzuf.supabase.co`) พบข้อเท็จจริงดังนี้:

1. **Storage Bucket `catalog` ทำงานได้สมบูรณ์ (HTTP 200)**:
   - ตรวจพบไฟล์รูปภาพที่คุณอัปโหลดไว้แล้วจริงใน Storage:
     - `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/Ahoy/logo.jpg`
     - `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/dogdog/logo.png`
     - `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/medic-boss/logo.png`
     - `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/yeeyee/logo.jpg`
     - `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/Ahoy/asd/CarPicture.jpg`
2. **สาเหตุที่ข้อมูลไม่ขึ้นและบันทึกไม่ได้ (Root Cause)**:
   - **ตาราง PostgreSQL `car_brands`, `car_models`, `car_parts` ยังไม่มีอยู่ในฐานข้อมูล Supabase**
   - Supabase PostgREST ตอบกลับ Error:
     `PGRST205: Could not find the table 'public.car_brands' in the schema cache`
   - ส่งผลให้:
     - เมื่อกด `saveBrand()` $\rightarrow$ อัปโหลดรูปสำเร็จ แต่ `insert` ลงตาราง `car_brands` ล้มเหลว
     - เมื่อโหลดหน้าเว็บ `fetchCatalogBrands()` $\rightarrow$ ล้มเหลวเพราะไม่พบตาราง รายการจึงว่างเปล่า `[]`

---

## 🚀 วิธีแก้ไข (Action Items)

### ─── ACTION 1: รัน SQL MIGRATION ใน SUPABASE DASHBOARD ───
ไฟล์ Migration พร้อมกู้คืนข้อมูลเดิมถูกสร้างไว้แล้วที่:
📁 `Performante_Lab_Backend/supabase/migrations/202610310004_car_catalog_schema.sql`

**ขั้นตอนการรัน**:
1. เปิด **Supabase Dashboard** (โปรเจกต์ `oxzejsgfazbjjqopkzuf`)
2. ไปที่เมนู **SQL Editor** ด้านซ้าย
3. คัดลอกโค้ด SQL ด้านล่างนี้ไปวาง แล้วกดปุ่ม **RUN**:

```sql
begin;

-- 1. สร้างตาราง car_brands
create table if not exists public.car_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique check (char_length(slug) between 1 and 80),
  logo_url text not null,
  is_custom_bg boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. สร้างตาราง car_models
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

-- 3. สร้างตาราง car_parts
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

-- 4. Indexes
create index if not exists idx_car_models_brand_id on public.car_models(brand_id);
create index if not exists idx_car_parts_car_model_id on public.car_parts(car_model_id);
create index if not exists idx_car_parts_category on public.car_parts(category);

-- 5. RLS Policies
alter table public.car_brands enable row level security;
alter table public.car_models enable row level security;
alter table public.car_parts enable row level security;

-- car_brands RLS
drop policy if exists "Public read car_brands" on public.car_brands;
create policy "Public read car_brands" on public.car_brands for select to anon, authenticated using (true);
drop policy if exists "Admins can insert car_brands" on public.car_brands;
create policy "Admins can insert car_brands" on public.car_brands for insert to authenticated with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can update car_brands" on public.car_brands;
create policy "Admins can update car_brands" on public.car_brands for update to authenticated using (public.is_admin_or_superadmin(auth.uid())) with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can delete car_brands" on public.car_brands;
create policy "Admins can delete car_brands" on public.car_brands for delete to authenticated using (public.is_admin_or_superadmin(auth.uid()));

-- car_models RLS
drop policy if exists "Public read car_models" on public.car_models;
create policy "Public read car_models" on public.car_models for select to anon, authenticated using (true);
drop policy if exists "Admins can insert car_models" on public.car_models;
create policy "Admins can insert car_models" on public.car_models for insert to authenticated with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can update car_models" on public.car_models;
create policy "Admins can update car_models" on public.car_models for update to authenticated using (public.is_admin_or_superadmin(auth.uid())) with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can delete car_models" on public.car_models;
create policy "Admins can delete car_models" on public.car_models for delete to authenticated using (public.is_admin_or_superadmin(auth.uid()));

-- car_parts RLS
drop policy if exists "Public read car_parts" on public.car_parts;
create policy "Public read car_parts" on public.car_parts for select to anon, authenticated using (true);
drop policy if exists "Admins can insert car_parts" on public.car_parts;
create policy "Admins can insert car_parts" on public.car_parts for insert to authenticated with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can update car_parts" on public.car_parts;
create policy "Admins can update car_parts" on public.car_parts for update to authenticated using (public.is_admin_or_superadmin(auth.uid())) with check (public.is_admin_or_superadmin(auth.uid()));
drop policy if exists "Admins can delete car_parts" on public.car_parts;
create policy "Admins can delete car_parts" on public.car_parts for delete to authenticated using (public.is_admin_or_superadmin(auth.uid()));

-- 6. กู้คืนข้อมูลรูปภาพที่คุณอัปโหลดไว้แล้วใน Storage เข้าสู่ฐานข้อมูลทันที
insert into public.car_brands (id, name, slug, logo_url, is_custom_bg)
values
  ('b0000000-0000-0000-0000-000000000001', 'Ahoy', 'ahoy', 'https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/Ahoy/logo.jpg', false),
  ('b0000000-0000-0000-0000-000000000002', 'dogdog', 'dogdog', 'https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/dogdog/logo.png', false),
  ('b0000000-0000-0000-0000-000000000003', 'medic-boss', 'medic-boss', 'https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/medic-boss/logo.png', false),
  ('b0000000-0000-0000-0000-000000000004', 'yeeyee', 'yeeyee', 'https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/yeeyee/logo.jpg', false)
on conflict (name) do update set logo_url = excluded.logo_url;

-- กู้คืนรุ่นรถ asd ใต้ Ahoy
insert into public.car_models (id, brand_id, name, slug, image_url, body_type)
values (
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'asd',
  'asd',
  'https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/Ahoy/asd/CarPicture.jpg',
  'Coupe'
)
on conflict do nothing;

commit;
```

---

### ─── ACTION 2: ปรับปรุง ERROR LOGGING ใน FRONTEND ───
**ตำแหน่งไฟล์**: `Performante_Lab_Frontend/src/app/features/admin/services/admin.service.ts`

ในฟังก์ชัน `fetchCatalogBrands`, `fetchCatalogModels`, `fetchCatalogParts`:
ปรับปรุงส่วน `catch` ให้แสดง error ละเอียดทาง `console.error` เพื่อความง่ายในการ Debug:
```typescript
async fetchCatalogBrands(): Promise<void> {
  const client = await this.getClient();
  if (!client) return;
  this.catalogLoading.set(true);
  try {
    const { data, error } = await client
      .from('car_brands')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('[AdminService] fetchCatalogBrands error:', error);
      throw error;
    }
    this.catalogBrands.set((data || []).map(mapBrand));
  } catch (err: any) {
    console.error('[AdminService] fetchCatalogBrands exception:', err);
    this.error.set(err?.message || 'โหลดข้อมูลแบรนด์ไม่สำเร็จ');
  } finally {
    this.catalogLoading.set(false);
  }
}
```

---

## 📋 ผลลัพธ์หลังแก้ไข (Verification Result)
1. เมื่อรัน SQL ข้างต้นใน Supabase Dashboard เสร็จสิ้น:
   - แบรนด์ **Ahoy**, **dogdog**, **medic-boss**, **yeeyee** จะแสดงบนหน้าจอทันที พร้อมรูปโลโก้จริงจาก Storage!
   - เมื่อคลิกเข้าไปในแบรนด์ **Ahoy** จะเห็นรุ่นรถ **asd** แสดงพร้อมรูปรถ `CarPicture.jpg` จริงทันที!
2. เมื่อทดสอบกด `(+)` เพิ่มแบรนด์ใหม่:
   - รูปภาพจะอัปโหลดขึ้น Storage ได้สำเร็จ
   - ข้อมูลชื่อและ URL จะบันทึกเข้าสู่ตาราง `car_brands` อย่างถูกต้อง และแสดงผลบนหน้าจอทันที

