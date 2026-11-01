import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { CROP_EDITOR_IMAGES, PartCropResult } from './part-crop-image';
import { validateAlphaMask } from '../../../core/catalog/composite-build';
import { PartClipRegion, paintPartClips } from '../../../core/catalog/part-clip-regions';
import { pngBlob } from './part-crop-image';
import { cropBounds, resizeCrop, defaultCrops, validCrops, CropBounds } from './crop-regions';
@Component({
  selector: 'app-part-crop-editor',
  imports: [Icon],
  templateUrl: './part-crop-editor.html',
})
export class PartCropEditor {
  readonly source = input.required<string>();
  readonly reference = input('');
  readonly category = input('spoilers');
  readonly presetRegions = input<readonly PartClipRegion[]>([]);
  readonly storedRegions = input<readonly PartClipRegion[]>([]);
  readonly saving = input(false);
  readonly saveError = input('');
  readonly save = output<PartCropResult>();
  readonly cancel = output<void>();
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly preview = signal(false);
  readonly width = signal(1800);
  readonly height = signal(900);
  readonly regions = signal<PartClipRegion[]>([]);
  readonly selected = signal(0);
  readonly cropBounds = cropBounds;
  readonly activeBounds = computed(() =>
    this.regions()[this.selected()] ? cropBounds(this.regions()[this.selected()]) : null,
  );
  readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly loadImage = inject(CROP_EDITOR_IMAGES);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly previousFocus =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  private photo: HTMLImageElement | null = null;
  private stock: HTMLImageElement | null = null;
  private dragStart: {
    x: number;
    y: number;
    bounds: CropBounds;
    region: PartClipRegion;
    resize: boolean;
    index: number;
    pointer: number;
  } | null = null;
  constructor() {
    afterNextRender(() => {
      this.heading()?.nativeElement.focus();
      void this.load();
    });
  }
  ngOnDestroy() {
    this.previousFocus?.focus();
  }
  private initial(): PartClipRegion[] {
    return structuredClone(
      validCrops(this.presetRegions()) ? this.presetRegions() : defaultCrops(this.category()),
    ) as PartClipRegion[];
  }
  private async load(): Promise<void> {
    try {
      this.photo = await this.loadImage(this.source());
      if (this.photo.naturalWidth * this.photo.naturalHeight > 16777216)
        throw new Error('ภาพต้องไม่เกิน 16 ล้านพิกเซล');
      this.width.set(this.photo.naturalWidth);
      this.height.set(this.photo.naturalHeight);
      this.regions.set(
        structuredClone(
          validCrops(this.storedRegions()) ? this.storedRegions() : this.initial(),
        ) as PartClipRegion[],
      );
      if (this.reference())
        try {
          this.stock = await this.loadImage(this.reference());
        } catch {
          this.error.set('โหลด Default ไม่สำเร็จ ยังเลือกบริเวณจากภาพต้นฉบับได้');
        }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'โหลดภาพไม่สำเร็จ');
    } finally {
      this.loading.set(false);
    }
  }
  polygon(region: PartClipRegion): string {
    return region.kind === 'polygon'
      ? region.points.map(([x, y]) => `${x * this.width()},${y * this.height()}`).join(' ')
      : '';
  }
  label(index: number): string {
    return this.category() === 'wheels' ? 'ล้อ ' + (index + 1) : 'พื้นที่ ' + (index + 1);
  }
  select(index: number): void {
    this.selected.set(index);
  }
  begin(event: PointerEvent, index: number, resize = false): void {
    if (this.saving() || this.exporting() || this.loading() || this.preview() || event.button !== 0)
      return;
    event.stopPropagation();
    event.preventDefault();
    this.selected.set(index);
    const region = this.regions()[index];
    this.dragStart = {
      x: event.clientX,
      y: event.clientY,
      bounds: cropBounds(region),
      region: structuredClone(region),
      resize,
      index,
      pointer: event.pointerId,
    };
    (event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId);
  }
  drag(event: PointerEvent): void {
    const start = this.dragStart;
    if (!start || this.saving() || this.exporting() || this.preview()) return;
    const svg = event.currentTarget as SVGElement,
      rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (event.clientX - start.x) / rect.width,
      dy = (event.clientY - start.y) / rect.height;
    const b = start.resize
      ? { ...start.bounds, width: start.bounds.width + dx, height: start.bounds.height + dy }
      : { ...start.bounds, x: start.bounds.x + dx, y: start.bounds.y + dy };
    this.regions.update((regions) =>
      regions.map((r, i) => (i === start.index ? resizeCrop(start.region, b) : r)),
    );
  }
  end(): void {
    this.dragStart = null;
  }
  adjust(key: keyof CropBounds, event: Event): void {
    const region = this.regions()[this.selected()],
      bounds = this.activeBounds(),
      value = Number((event.target as HTMLInputElement).value);
    if (
      !region ||
      !bounds ||
      !Number.isFinite(value) ||
      this.saving() ||
      this.exporting() ||
      this.preview()
    )
      return;
    this.regions.update((regions) =>
      regions.map((r, i) =>
        i === this.selected() ? resizeCrop(region, { ...bounds, [key]: value }) : r,
      ),
    );
  }
  nudge(event: KeyboardEvent): void {
    if (this.saving() || this.exporting() || this.preview()) return;
    const key =
      event.key === 'ArrowLeft' || event.key === 'ArrowRight'
        ? 'x'
        : event.key === 'ArrowUp' || event.key === 'ArrowDown'
          ? 'y'
          : null;
    const bounds = this.activeBounds();
    if (!key || !bounds) return;
    event.preventDefault();
    event.stopPropagation();
    const delta =
      (event.shiftKey ? 0.01 : 0.001) *
      (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
    this.adjust(key, { target: { value: bounds[key] + delta } } as unknown as Event);
  }
  add(): void {
    if (this.regions().length >= 8 || this.saving() || this.exporting() || this.preview()) return;
    this.regions.update((regions) => [...regions, ...defaultCrops('spoilers')]);
    this.selected.set(this.regions().length - 1);
  }
  remove(): void {
    if (this.regions().length <= 1 || this.saving() || this.exporting() || this.preview()) return;
    this.regions.update((regions) => regions.filter((_, i) => i !== this.selected()));
    this.selected.set(0);
  }
  reset(): void {
    if (this.saving() || this.exporting()) return;
    this.regions.set(this.initial());
    this.selected.set(0);
    this.preview.set(false);
    this.error.set('');
  }
  private frames(): { mask: HTMLCanvasElement; photo: HTMLCanvasElement } {
    if (!this.photo || !validCrops(this.regions()))
      throw new Error('กรุณาเลือกพื้นที่ตัดให้ถูกต้อง');
    const mask = document.createElement('canvas'),
      photo = document.createElement('canvas');
    mask.width = photo.width = this.width();
    mask.height = photo.height = this.height();
    const m = mask.getContext('2d'),
      p = photo.getContext('2d');
    if (!m || !p) throw new Error('สร้างภาพตัดไม่สำเร็จ');
    paintPartClips(m, this.width(), this.height(), this.regions());
    validateAlphaMask(m.getImageData(0, 0, this.width(), this.height()).data);
    // The original photo never moves. Keep a full-size transparent frame so coordinates survive compositing.
    p.drawImage(this.photo, 0, 0, this.width(), this.height());
    p.globalCompositeOperation = 'destination-in';
    p.drawImage(mask, 0, 0);
    return { mask, photo };
  }
  showPreview(withDefault = false): void {
    try {
      const result = this.frames(),
        canvas = this.canvas()?.nativeElement;
      if (!canvas) return;
      canvas.width = this.width();
      canvas.height = this.height();
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('แสดงตัวอย่างไม่ได้');
      if (withDefault && this.stock) ctx.drawImage(this.stock, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(result.mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(result.photo, 0, 0);
      this.preview.set(true);
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'แสดงตัวอย่างไม่ได้');
    }
  }
  async export(): Promise<void> {
    if (this.loading() || this.exporting() || this.saving()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      const regions = structuredClone(this.regions()),
        result = this.frames();
      const [mask, photo] = await Promise.all([pngBlob(result.mask), pngBlob(result.photo)]);
      if (Math.max(mask.size, photo.size) > 10 * 1024 * 1024)
        throw new Error('ภาพตัดต้องไม่เกิน 10 MB ต่อไฟล์');
      this.save.emit({ mask, photo, regions });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'สร้างภาพตัดไม่สำเร็จ');
    } finally {
      this.exporting.set(false);
    }
  }
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!this.saving() && !this.exporting()) this.cancel.emit();
    }
    if (event.key === 'Tab') {
      const items = Array.from(
          this.host.nativeElement.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ),
        ),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
}
