# 🛠️ WORKER PROMPT: In-Place Editing for Part & BodyKit Items (Name & Image)

> **เอกสารอ้างอิงและรูปภาพ**:
> - โฟลเดอร์: [`fix list/`](../fix%20list/)
> - แผนผังแค็ตตาล็อก: [`STORAGE_CATALOG_TREE.md`](../../STORAGE_CATALOG_TREE.md)

---

## 📌 สรุปความต้องการ (Requirements)
ในหน้า **Portal Admin > Edit Data (`/admin/edit-data`)**:
เมื่ออยู่ในหน้าแสดงรายการชิ้นส่วนของแต่ง (ทั้งแท็บ **Body Kit** และ **Part** ภายใต้แบรนด์ของแต่งที่เลือก เช่น Sano-Design, Novitec):
1. **การกดที่ตัวการ์ดชิ้นส่วน (Click to Edit Part)**:
   - เมื่อกดที่ตัวการ์ดของชิ้นส่วน (เช่น Sano Street Aero, Sano Track Edition) ให้เปิด Modal **"แก้ไขข้อมูลชิ้นส่วน" (`editPartModalOpen`)**
   - มีไอคอน Hint การแก้ไข (`app-icon name="edit"`) แสดงขึ้นที่มุมซ้ายบนของการ์ดเมื่อ Hover
   - ปุ่มลบชิ้นส่วนรูปถังขยะ (`app-icon name="trash"`) ที่มุมขวาบนยังคงทำงานแยกต่างหาก (เมื่อกดลบจะไม่เปิด Modal แก้ไข ด้วย `stopPropagation()`)
2. **Modal แก้ไขข้อมูลชิ้นส่วน (`editPartModal`)**:
   - สามารถ**แก้ไขชื่อชิ้นส่วน** (`editingPartName`)
   - สามารถ**แก้ไขราคาโดยประมาณ** (`editingPartPrice`)
   - สามารถ**เปลี่ยนรูปภาพชิ้นส่วน** (ทั้งแบบ Multi-Angle ตามที่หมวดนั้นกำหนด หรือรูปหลัก)
   - **กรณีไม่มีการอัปโหลดรูปใหม่**: ให้ระบบใช้รูปภาพเดิมโดยอัตโนมัติ (ไม่บังคับอัปโหลดรูปใหม่เมื่อทำการแก้ไข)
   - มีปุ่ม **"ยกเลิก"** และปุ่ม **"บันทึกการแก้ไข"**
3. **การบันทึกข้อมูล (Save & Persistence)**:
   - อัปโหลดไฟล์รูปภาพใหม่เข้า Supabase Storage ตามโครงสร้าง Path:
     `catalog/{CarBrand}/{CarModel}/BodyKit/{BodyKitBrand}/{KitName}/{Angle}.png` หรือ
     `catalog/{CarBrand}/{CarModel}/Part/{Category}/{PartBrand}/{PartName}/{Angle}.png`
   - เรียกใช้ `admin.updateCarPart(...)` เพื่อบันทึกชื่อ, ราคา และ `image_url` ลงฐานข้อมูล Supabase `car_parts`
   - อัปเดต Signal `catalogParts` แบบเรียลไทม์ และแสดง Toast ข้อความแจ้งเตือนความสำเร็จ

---

## 🎯 รายละเอียดการแก้ไขในโค้ด (Files to Modify)

### 1. `src/app/features/admin/services/admin.service.ts`
เพิ่มฟังก์ชัน `updateCarPart`:
```typescript
async updateCarPart(item: {
  id: string;
  name: string;
  price?: number;
  image_url?: string;
}): Promise<{ ok: boolean; data?: RealPartItem; error?: string }> {
  const client = await this.getClient();
  const updatePayload: Record<string, any> = {
    name: item.name.trim(),
  };
  if (item.price !== undefined) updatePayload['price'] = item.price;
  if (item.image_url) updatePayload['image_url'] = item.image_url;

  if (!client || typeof client.from !== 'function') {
    let updatedItem: RealPartItem | undefined;
    this.catalogParts.update((list) =>
      list.map((p) => {
        if (p.id === item.id) {
          updatedItem = {
            ...p,
            name: item.name.trim(),
            price: item.price ?? p.price,
            image: item.image_url || p.image,
            image_url: item.image_url || p.image_url,
          };
          return updatedItem;
        }
        return p;
      }),
    );
    return { ok: true, data: updatedItem };
  }

  try {
    const { data, error } = await client
      .from('car_parts')
      .update(updatePayload)
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw error;
    const mapped = mapPart(data);
    this.catalogParts.update((list) => list.map((p) => (p.id === item.id ? mapped : p)));
    return { ok: true, data: mapped };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'อัปเดตพาร์ตล้มเหลว' };
  }
}
```

---

### 2. `src/app/features/admin/edit-data/admin-edit-data.ts`
- เพิ่ม Signals สำหรับจัดการ State การแก้ไข:
  ```typescript
  readonly editPartModalOpen = signal(false);
  readonly editingPart = signal<RealPartItem | null>(null);
  readonly editingPartName = signal('');
  readonly editingPartPrice = signal<number | null>(null);
  readonly editPartFile = signal<File | null>(null);
  readonly editPartFilePreview = signal<string | null>(null);
  readonly editPartAngleFiles = signal<Map<string, File>>(new Map());
  readonly editPartAnglePreviews = signal<Map<string, string>>(new Map());
  ```
- เพิ่ม Handlers:
  - `openEditPartModal(part: RealPartItem): void`
  - `closeEditPartModal(): void`
  - `onEditPartFileChange(event: Event): void`
  - `onEditPartAngleFileChange(angleKey: string, event: Event): void`
  - `saveEditPart(): Promise<void>` (อัปโหลดรูปภาพใหม่ถ้ามี หรือใช้รูปเดิมถ้าไม่มีการเลือกรูปใหม่)

---

### 3. `src/app/features/admin/edit-data/admin-edit-data.html`
1. ใส่ `(click)="openEditPartModal(part)"` ที่ตัวการ์ดชิ้นส่วน:
   ```html
   <div
     (click)="openEditPartModal(part)"
     class="aspect-square rounded-2xl bg-[#191919] border border-white/10 hover:border-white/30 relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.02] group select-none shadow-sm cursor-pointer"
     [title]="'คลิกเพื่อแก้ไขรูปและชื่อ: ' + part.name"
   >
     <!-- Edit Hint Icon in Top-Left Corner -->
     <div class="absolute top-2 left-2 size-7 rounded-lg bg-black/60 text-stone-400 group-hover:text-emerald-400 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10" title="แก้ไขชิ้นส่วน">
       <app-icon name="edit" class="!size-3" />
     </div>
   ```
2. ใส่ Modal Template `@if (editPartModalOpen() && editingPart()) { ... }` พร้อมช่องกรอกชื่อ, ราคา, และกล่องอัปโหลดรูปภาพแต่ละมุม (แสดงรูปเดิมเป็นค่าเริ่มต้น และมีป้าย "หากไม่เลือกรูปใหม่ จะใช้รูปเดิม")

---

## 4. Verification & Testing
รัน Unit Tests ในโปรเจกต์ `Performante_Lab_Frontend`:
```powershell
npm test -- --watch=false
```
ต้องผ่านครบ 100% ทั้ง 22 Test Suites (166 tests passed).

