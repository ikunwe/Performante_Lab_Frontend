import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { automaticPartClips } from '../../../core/catalog/part-clip-regions';
import type { CarViewId } from '../../../core/catalog/car-views';
import { CatalogStorageHelper } from '../../../core/storage/catalog-storage';
import { AdminService } from '../services/admin.service';
import type { PartCropResult } from './part-crop-image';
import { PartCropEditor } from './part-crop-editor';
import { validCrops } from './crop-regions';
import type { PartClipRegion } from '../../../core/catalog/part-clip-regions';

@Component({
  selector: 'app-part-mask-upload',
  imports: [PartCropEditor],
  template: `
    <div class="mt-3 rounded-lg border border-white/10 p-3 text-[10px] text-stone-400">
      <p class="mb-2 text-stone-200">
        การซ้อนพาร์ท
        {{
          mask()
            ? '· ใช้พื้นที่ตัดที่บันทึกไว้'
            : automatic()
              ? '· ใช้บริเวณตัดอัตโนมัติได้'
              : canCrop()
                ? '· เลือกกรอบตัดได้'
                : '· ยังไม่ตั้งค่าพื้นที่ตัด'
        }}
      </p>
      <p class="mb-2 leading-5">
        @if (canCrop()) {
          ปรับกรอบให้ครอบเฉพาะพาร์ทจากภาพเต็ม แล้วดูภาพที่ตัดก่อนบันทึก
          ระบบจะนำเฉพาะส่วนนั้นไปซ้อนเมื่อเลือกหลายพาร์ท
        } @else if (automatic()) {
          อัปโหลดภาพเต็มที่จัดกรอบตรงกับ Default ได้เลย · ระบบจะใช้พื้นที่ตัดตามมุมของภาพ
        } @else {
          ภาพนี้จะแสดงเป็นภาพเต็มตามมุมที่เลือก
        }
      </p>
      @if (disabled()) {
        <p>บันทึกภาพหรือชื่อพาร์ทก่อน แล้วเปิดแก้ไขอีกครั้งเพื่อตั้ง mask</p>
      }
      <div class="flex gap-2">
        @if (canCrop()) {
          <button
            type="button"
            (click)="openCrop()"
            [disabled]="busy() || disabled()"
            class="min-h-8 cursor-pointer rounded-lg bg-[#ce281a] px-3 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {{ cropOpening() ? 'กำลังโหลดกรอบ…' : 'ปรับกรอบตัดภาพ' }}
          </button>
        }
        @if (mask()) {
          <button
            type="button"
            (click)="remove()"
            [disabled]="busy() || disabled()"
            class="cursor-pointer rounded-lg px-2 text-red-400 disabled:cursor-not-allowed"
          >
            ล้างพื้นที่ตัดที่บันทึก
          </button>
        }
      </div>
      @if (message()) {
        <p role="status" class="mt-2 text-amber-200">{{ message() }}</p>
      }
      @if (cropOpen()) {
        <app-part-crop-editor
          [source]="source()"
          [reference]="reference()"
          [category]="categoryKey()"
          [presetRegions]="placementRegions()"
          [storedRegions]="storedCropRegions()"
          [saving]="busy()"
          [saveError]="message()"
          (save)="saveDrawing($event)"
          (cancel)="cropOpen.set(false)"
        />
      }
    </div>
  `,
})
export class PartMaskUpload {
  readonly source = input.required<string>();
  readonly mask = input('');
  readonly layer = input('');
  readonly reference = input('');
  readonly automatic = input(false);
  readonly modelName = input('');
  readonly category = input('');
  readonly angle = input('');
  readonly cropOpen = signal(false);
  readonly cropOpening = signal(false);
  readonly storedCropRegions = signal<PartClipRegion[]>([]);
  readonly categoryKey = computed(() => {
    const key = this.category()
      .toLowerCase()
      .replace(/[\s_-]/g, '');
    return /^wheels?$/.test(key) ? 'wheels' : /^spoilers?$/.test(key) ? 'spoilers' : key;
  });
  readonly placementRegions = computed(() => {
    const view = (
      { '45_front': 'front45', front: 'front', '45_back': 'rear45', back: 'rear' } as Record<
        string,
        CarViewId
      >
    )[this.angle().toLowerCase()];
    if (!view) return [];
    return (
      automaticPartClips(
        {
          id: '',
          brand: '',
          name: this.modelName(),
          modelName: this.modelName(),
          body: '',
          image: '',
        },
        this.categoryKey(),
        view,
      ) || []
    );
  });
  readonly canCrop = computed(() => ['wheels', 'spoilers'].includes(this.categoryKey()));
  readonly disabled = input(false);
  readonly saved = output<string>();
  readonly layerSaved = output<string>();
  readonly busy = signal(false);
  readonly message = signal('');
  private readonly admin = inject(AdminService);
  constructor() {
    effect(() => {
      this.source();
      this.message.set('');
      this.cropOpen.set(false);
      this.storedCropRegions.set([]);
    });
  }
  async openCrop(): Promise<void> {
    if (this.busy() || this.disabled() || this.cropOpening()) return;
    const source = this.source();
    this.cropOpening.set(true);
    this.message.set('');
    try {
      let regions: PartClipRegion[] = [];
      if (this.mask()) {
        const client = await this.admin.getClient();
        if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
        const info = await client.storage.from('catalog').info(this.path(source));
        if (info.error) throw new Error('โหลดกรอบที่บันทึกไว้ไม่สำเร็จ กรุณาลองใหม่');
        const saved = info.data.metadata?.['cropEditor'];
        if (saved?.version === 1 && validCrops(saved.regions))
          regions = structuredClone(saved.regions);
      }
      if (this.source() === source) {
        this.storedCropRegions.set(regions);
        this.cropOpen.set(true);
      }
    } catch (error) {
      if (this.source() === source)
        this.message.set(error instanceof Error ? error.message : 'เปิดกรอบตัดไม่สำเร็จ');
    } finally {
      this.cropOpening.set(false);
    }
  }
  private path(source: string): string {
    const path = decodeURIComponent(CatalogStorageHelper.extractStoragePath(source));
    if (
      !/\/(45_front|front|45_Back|Back)\.(png|jpe?g|webp)$/i.test(path) ||
      path.split('/').some((p) => p === '..' || p === '.' || !p)
    )
      throw new Error('ต้องเป็นภาพมุมรถที่บันทึกใน catalog แล้ว');
    return path.replace(/\.[^.]+$/, '.mask.png');
  }
  async saveDrawing(drawing: PartCropResult): Promise<void> {
    if (this.busy() || this.disabled()) return;
    const source = this.source();
    this.busy.set(true);
    this.message.set('');
    try {
      if (drawing.regions && !validCrops(drawing.regions))
        throw new Error('ข้อมูลกรอบตัดไม่ถูกต้อง');
      const client = await this.admin.getClient();
      if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
      const maskPath = this.path(source),
        layerPath = maskPath.replace(/\.mask\.png$/, '.layer.png');
      const photo = await CatalogStorageHelper.uploadFile(client, layerPath, drawing.photo);
      if (!photo.ok || !photo.url) throw new Error(photo.error || 'บันทึกภาพจัดตำแหน่งไม่สำเร็จ');
      const mask = drawing.regions
        ? await CatalogStorageHelper.uploadFile(client, maskPath, drawing.mask, true, {
            cropEditor: { version: 1, regions: drawing.regions },
          })
        : await CatalogStorageHelper.uploadFile(client, maskPath, drawing.mask);
      if (!mask.ok || !mask.url)
        throw new Error(mask.error || 'บันทึก mask ไม่สำเร็จ กรุณาลองอีกครั้ง');
      if (this.source() === source) {
        const version = '?v=' + Date.now();
        this.layerSaved.emit(photo.url + version);
        this.saved.emit(mask.url + version);
        this.cropOpen.set(false);
        this.message.set(
          drawing.regions ? 'บันทึกกรอบตัดและภาพพาร์ทแล้ว' : 'บันทึกพื้นที่พาร์ทแล้ว',
        );
      }
    } catch (error) {
      if (this.source() === source)
        this.message.set(error instanceof Error ? error.message : 'บันทึกพื้นที่ไม่สำเร็จ');
    } finally {
      this.busy.set(false);
    }
  }
  async remove(): Promise<void> {
    if (this.busy() || this.disabled()) return;
    const source = this.source();
    this.busy.set(true);
    this.message.set('');
    try {
      const client = await this.admin.getClient();
      if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
      const result = await CatalogStorageHelper.deleteFile(client, this.path(source));
      if (!result.ok) throw new Error(result.error || 'ลบ mask ไม่สำเร็จ');
      if (this.source() === source) {
        this.saved.emit('');
        this.message.set('ลบ mask แล้ว');
      }
    } catch (error) {
      if (this.source() === source)
        this.message.set(error instanceof Error ? error.message : 'ลบ mask ไม่สำเร็จ');
    } finally {
      this.busy.set(false);
    }
  }
}
