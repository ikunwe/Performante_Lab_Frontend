import { StorageCatalogStore, storageCatalogData } from '../../../core/catalog/storage-catalog';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { automaticPartClips } from '../../../core/catalog/part-clip-regions';
import type { CarViewId } from '../../../core/catalog/car-views';
import { CatalogStorageHelper } from '../../../core/storage/catalog-storage';
import { AdminService } from '../services/admin.service';
import type { PartCropResult } from './part-crop-image';
import { PartCropEditor } from './part-crop-editor';
import { PartPlacement, validPlacements } from './part-placement';
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
      @if (canCrop()) {
        <label class="mb-3 block text-stone-300"
          >จัดวางสำหรับภาพฐาน
          <select
            [value]="baseId()"
            (focus)="loadBases()"
            (change)="chooseBase($event)"
            [disabled]="busy() || cropOpening() || cropOpen()"
            class="mt-2 min-h-9 w-full cursor-pointer rounded-lg border border-white/15 bg-[#202020] px-2 text-white disabled:cursor-not-allowed"
          >
            <option value="">Default / ตำแหน่งทั่วไป</option>
            @for (base of baseOptions(); track base.id) {
              <option [value]="base.id">
                {{ base.name }} · {{ base.finish }} ({{
                  base.category === 'front' ? 'Front Bumper' : 'Rear Bumper'
                }})
              </option>
            }
          </select>
        </label>
        @if (catalog.loading()) {
          <p class="mb-2 animate-pulse">กำลังโหลดภาพฐาน…</p>
        }
        @if (catalog.error()) {
          <p class="mb-2 text-amber-300">{{ catalog.error() }}</p>
        }
        <p class="mb-3 leading-5">
          {{
            baseId()
              ? 'บันทึกเฉพาะเมื่อนำพาร์ทนี้วางบนชุดแต่งที่เลือก'
              : 'ใช้เป็นตำแหน่งเริ่มต้นเมื่อไม่มีค่าของชุดแต่งนั้น'
          }}
        </p>
      }
      <div class="flex gap-2">
        @if (canCrop()) {
          <button
            type="button"
            (click)="openCrop()"
            [disabled]="busy() || disabled()"
            class="min-h-8 cursor-pointer rounded-lg bg-[#ce281a] px-3 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {{ cropOpening() ? 'กำลังโหลดกรอบ…' : 'ตัดภาพ / จัดวาง' }}
          </button>
        }
        @if (hasCrop()) {
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
          [reference]="referenceImage()"
          [referenceLabel]="referenceLabel()"
          [category]="categoryKey()"
          [presetRegions]="placementRegions()"
          [storedRegions]="storedCropRegions()"
          [storedPlacements]="storedPlacements()"
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
  readonly catalog = inject(StorageCatalogStore);
  readonly baseId = signal('');
  readonly savedBases = signal<string[]>([]);
  readonly view = computed(
    () =>
      (
        ({ '45_front': 'front45', front: 'front', '45_back': 'rear45', back: 'rear' }) as Record<
          string,
          CarViewId
        >
      )[this.angle().toLowerCase()],
  );
  readonly currentPart = computed(() => {
    const normalize = (url: string) => {
      const path = CatalogStorageHelper.extractStoragePath(url);
      try {
        return decodeURIComponent(path);
      } catch {
        return path;
      }
    };
    const path = normalize(this.source());
    return storageCatalogData().parts.find((p) =>
      Object.values(p.views || {}).some((url) => normalize(url!) === path),
    );
  });
  readonly baseOptions = computed(() => {
    const part = this.currentPart(),
      view = this.view();
    return part && view
      ? storageCatalogData().parts.filter(
          (p) =>
            p.carId === part.carId &&
            (['front45', 'front'].includes(view)
              ? p.category === 'front'
              : p.category === 'rear') &&
            !!p.views?.[view] &&
            !p.masks?.[view] &&
            /^storage-part:[a-f0-9]{32}$/.test(p.id),
        )
      : [];
  });
  readonly referenceImage = computed(
    () =>
      this.baseOptions().find((p) => p.id === this.baseId())?.views?.[this.view()] ||
      this.reference(),
  );
  readonly referenceLabel = computed(
    () => this.baseOptions().find((p) => p.id === this.baseId())?.name || 'Default / ตำแหน่งทั่วไป',
  );
  readonly hasCrop = computed(() =>
    !this.baseId()
      ? !!this.mask()
      : this.savedBases().includes(this.baseId()) ||
        !!this.currentPart()?.placementVariants?.[this.baseId()]?.masks?.[this.view()],
  );
  loadBases(): void {
    if (!this.catalog.loading()) void this.catalog.load();
  }
  chooseBase(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (
      this.busy() ||
      this.cropOpen() ||
      this.cropOpening() ||
      (value && !this.baseOptions().some((p) => p.id === value))
    )
      return;
    this.baseId.set(value);
    this.message.set('');
  }
  readonly cropOpen = signal(false);
  readonly cropOpening = signal(false);
  readonly storedCropRegions = signal<PartClipRegion[]>([]);
  readonly storedPlacements = signal<PartPlacement[]>([]);
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
      this.baseId.set('');
      this.savedBases.set([]);
      this.message.set('');
      this.cropOpen.set(false);
      this.storedCropRegions.set([]);
      this.storedPlacements.set([]);
    });
  }
  async openCrop(): Promise<void> {
    if (this.busy() || this.disabled() || this.cropOpening()) return;
    const source = this.source();
    this.cropOpening.set(true);
    this.message.set('');
    try {
      let regions: PartClipRegion[] = [];
      let placements: PartPlacement[] = [];
      if (this.hasCrop() || this.mask()) {
        const client = await this.admin.getClient();
        if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
        const info = await client.storage
          .from('catalog')
          .info(this.path(source, this.hasCrop() ? this.baseId() : ''));
        if (info.error) throw new Error('โหลดกรอบที่บันทึกไว้ไม่สำเร็จ กรุณาลองใหม่');
        const saved = info.data.metadata?.['cropEditor'];
        if ((saved?.version === 1 || saved?.version === 2) && validCrops(saved.regions)) {
          regions = structuredClone(saved.regions);
          if (saved.version === 2) {
            if (!validPlacements(saved.placements, regions.length))
              throw new Error('ข้อมูลตำแหน่งที่บันทึกไว้ไม่ถูกต้อง');
            placements = structuredClone(saved.placements);
          }
        }
      }
      if (this.source() === source) {
        this.storedCropRegions.set(regions);
        this.storedPlacements.set(placements);
        this.cropOpen.set(true);
      }
    } catch (error) {
      if (this.source() === source)
        this.message.set(error instanceof Error ? error.message : 'เปิดกรอบตัดไม่สำเร็จ');
    } finally {
      this.cropOpening.set(false);
    }
  }
  private path(source: string, baseId = this.baseId()): string {
    const path = decodeURIComponent(CatalogStorageHelper.extractStoragePath(source));
    if (
      !/\/(45_front|front|45_Back|Back)\.(png|jpe?g|webp)$/i.test(path) ||
      path.split('/').some((p) => p === '..' || p === '.' || !p)
    )
      throw new Error('ต้องเป็นภาพมุมรถที่บันทึกใน catalog แล้ว');
    if (baseId && !/^storage-part:[a-f0-9]{32}$/.test(baseId)) throw new Error('ภาพฐานไม่ถูกต้อง');
    return path.replace(
      /\.[^.]+$/,
      (baseId ? '.on-' + baseId.slice('storage-part:'.length) : '') + '.mask.png',
    );
  }
  async saveDrawing(drawing: PartCropResult): Promise<void> {
    if (this.busy() || this.disabled()) return;
    const source = this.source();
    this.busy.set(true);
    this.message.set('');
    try {
      if (drawing.regions && !validCrops(drawing.regions))
        throw new Error('ข้อมูลกรอบตัดไม่ถูกต้อง');
      if (drawing.placements && !validPlacements(drawing.placements, drawing.regions?.length ?? 0))
        throw new Error('ข้อมูลตำแหน่งพาร์ทไม่ถูกต้อง');
      const client = await this.admin.getClient();
      if (!client) throw new Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
      const maskPath = this.path(source),
        layerPath = maskPath.replace(/\.mask\.png$/, '.layer.png');
      const photo = await CatalogStorageHelper.uploadFile(client, layerPath, drawing.photo);
      if (!photo.ok || !photo.url) throw new Error(photo.error || 'บันทึกภาพจัดตำแหน่งไม่สำเร็จ');
      const mask = drawing.regions
        ? await CatalogStorageHelper.uploadFile(client, maskPath, drawing.mask, true, {
            cropEditor: drawing.placements
              ? { version: 2, regions: drawing.regions, placements: drawing.placements }
              : { version: 1, regions: drawing.regions },
          })
        : await CatalogStorageHelper.uploadFile(client, maskPath, drawing.mask);
      if (!mask.ok || !mask.url)
        throw new Error(mask.error || 'บันทึก mask ไม่สำเร็จ กรุณาลองอีกครั้ง');
      if (this.source() === source) {
        const version = '?v=' + Date.now();
        if (this.baseId()) this.savedBases.update((ids) => [...new Set([...ids, this.baseId()])]);
        else {
          this.layerSaved.emit(photo.url + version);
          this.saved.emit(mask.url + version);
        }
        this.cropOpen.set(false);
        this.message.set(
          this.baseId()
            ? 'บันทึกตำแหน่งสำหรับชุดแต่งที่เลือกแล้ว'
            : drawing.regions
              ? 'บันทึกกรอบตัดและภาพพาร์ทแล้ว'
              : 'บันทึกพื้นที่พาร์ทแล้ว',
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
        if (this.baseId()) {
          this.savedBases.update((ids) => ids.filter((id) => id !== this.baseId()));
          await this.catalog.load(true);
        } else this.saved.emit('');
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
