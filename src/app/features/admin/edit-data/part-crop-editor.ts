import {
  Component,
  ElementRef,
  Injector,
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
import {
  PartPlacement,
  defaultPlacement,
  validPlacements,
  isOriginalPlacement,
  placeContext,
} from './part-placement';
import { cropBounds, resizeCrop, defaultCrops, validCrops, CropBounds } from './crop-regions';
@Component({
  selector: 'app-part-crop-editor',
  imports: [Icon],
  templateUrl: './part-crop-editor.html',
})
export class PartCropEditor {
  readonly source = input.required<string>();
  readonly reference = input('');
  readonly referenceLabel = input('Default');
  readonly category = input('spoilers');
  readonly presetRegions = input<readonly PartClipRegion[]>([]);
  readonly storedRegions = input<readonly PartClipRegion[]>([]);
  readonly storedPlacements = input<readonly PartPlacement[]>([]);
  readonly saving = input(false);
  readonly saveError = input('');
  readonly save = output<PartCropResult>();
  readonly cancel = output<void>();
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly preview = signal(false);
  readonly mode = signal<'crop' | 'place'>('crop');
  readonly showGuides = signal(true);
  readonly zoom = signal(1);
  readonly panMode = signal(false);
  readonly panning = signal(false);
  readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');
  private readonly injector = inject(Injector);
  private panStart: { x: number; y: number; left: number; top: number; pointer: number } | null =
    null;
  readonly resizeHandles = ['x', 'y', 'both'] as const;
  readonly placements = signal<PartPlacement[]>([]);
  readonly opacity = signal(0.8);
  readonly placementControls: {
    key: keyof PartPlacement;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    { key: 'x', label: 'เลื่อนแนวนอน', min: -1, max: 1, step: 0.001 },
    { key: 'y', label: 'เลื่อนแนวตั้ง', min: -1, max: 1, step: 0.001 },
    { key: 'scale', label: 'ขนาดรวม', min: 0.1, max: 3, step: 0.01 },
    { key: 'scaleX', label: 'ยืดความกว้าง', min: 0.1, max: 3, step: 0.01 },
    { key: 'scaleY', label: 'ยืดความสูง', min: 0.1, max: 3, step: 0.01 },
    { key: 'rotation', label: 'หมุน (องศา)', min: -180, max: 180, step: 0.5 },
  ];
  readonly activePlacement = computed(
    () => this.placements()[this.selected()] || defaultPlacement(),
  );
  private placementDrag: {
    x: number;
    y: number;
    value: PartPlacement;
    pointer: number;
    index: number;
    resize: 'move' | 'x' | 'y' | 'both';
  } | null = null;
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
  private placementBuffers: HTMLCanvasElement[] | null = null;
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
      this.placements.set(
        validPlacements(this.storedPlacements(), this.regions().length)
          ? (structuredClone(this.storedPlacements()) as PartPlacement[])
          : this.regions().map(defaultPlacement),
      );
      if (this.reference())
        try {
          this.stock = await this.loadImage(this.reference());
        } catch {
          this.error.set('โหลดภาพฐานไม่สำเร็จ ยังเลือกบริเวณจากภาพต้นฉบับได้');
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
  setMode(mode: 'crop' | 'place'): void {
    if (this.saving() || this.exporting() || this.loading()) return;
    this.end();
    this.mode.set(mode);
    this.preview.set(false);
    if (mode === 'place') this.showPreview(true);
  }
  placementTransform(index: number): string {
    const b = cropBounds(this.regions()[index]),
      p = this.placements()[index] || defaultPlacement();
    const cx = (b.x + b.width / 2) * this.width(),
      cy = (b.y + b.height / 2) * this.height();
    return `translate(${cx + p.x * this.width()} ${cy + p.y * this.height()}) rotate(${p.rotation}) scale(${p.scale * (p.scaleX ?? 1)} ${p.scale * (p.scaleY ?? 1)}) translate(${-cx} ${-cy})`;
  }
  setZoom(value: number): void {
    if (!Number.isFinite(value) || this.loading()) return;
    const next = Math.max(1, Math.min(4, value)),
      old = this.zoom(),
      viewport = this.viewport()?.nativeElement;
    if (next === old) return;
    this.end();
    this.endPan();
    const x = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / old : 0;
    const y = viewport ? (viewport.scrollTop + viewport.clientHeight / 2) / old : 0;
    this.zoom.set(next);
    if (next === 1) this.panMode.set(false);
    afterNextRender(
      () => {
        const view = this.viewport()?.nativeElement;
        if (!view) return;
        view.scrollLeft = next === 1 ? 0 : x * next - view.clientWidth / 2;
        view.scrollTop = next === 1 ? 0 : y * next - view.clientHeight / 2;
      },
      { injector: this.injector },
    );
  }
  zoomInput(event: Event): void {
    this.setZoom(Number((event.target as HTMLInputElement).value));
  }
  togglePan(): void {
    this.end();
    this.endPan();
    this.panMode.update((value) => !value);
  }
  beginPan(event: PointerEvent): void {
    if (!this.panMode() || this.zoom() <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.end();
    const view = this.viewport()?.nativeElement;
    if (!view) return;
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      left: view.scrollLeft,
      top: view.scrollTop,
      pointer: event.pointerId,
    };
    this.panning.set(true);
    view.setPointerCapture?.(event.pointerId);
  }
  dragPan(event: PointerEvent): void {
    const start = this.panStart,
      view = this.viewport()?.nativeElement;
    if (!start || start.pointer !== event.pointerId || !view) return;
    view.scrollLeft = start.left - event.clientX + start.x;
    view.scrollTop = start.top - event.clientY + start.y;
  }
  endPan(): void {
    this.panStart = null;
    this.panning.set(false);
  }
  placementInputValue(key: keyof PartPlacement): number {
    return this.activePlacement()[key] ?? 1;
  }
  toggleGuides(): void {
    this.end();
    this.showGuides.update((value) => !value);
  }
  placementValue(key: keyof PartPlacement): string {
    const value = this.placementInputValue(key);
    return key === 'rotation' ? value.toFixed(1) + '°' : (value * 100).toFixed(1) + '%';
  }
  adjustPlacement(key: keyof PartPlacement, event: Event): void {
    if (this.saving() || this.exporting() || this.mode() !== 'place') return;
    const value = Number((event.target as HTMLInputElement).value);
    const next = this.placements().map((p, i) =>
      i === this.selected() ? { ...p, [key]: value } : p,
    );
    if (!validPlacements(next, this.regions().length)) return;
    this.placements.set(next);
    this.showPreview(true);
  }
  beginPlacement(
    event: PointerEvent,
    index: number,
    resize: 'move' | 'x' | 'y' | 'both' = 'move',
  ): void {
    if (event.button !== 0 || this.saving() || this.exporting() || this.mode() !== 'place') return;
    event.preventDefault();
    event.stopPropagation();
    this.selected.set(index);
    this.placementDrag = {
      x: event.clientX,
      y: event.clientY,
      value: { ...this.activePlacement() },
      pointer: event.pointerId,
      index,
      resize,
    };
    (event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId);
  }
  dragPlacement(event: PointerEvent): void {
    const start = this.placementDrag;
    if (!start || event.pointerId !== start.pointer || this.saving() || this.exporting()) return;
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-1, Math.min(1, start.value.x + (event.clientX - start.x) / rect.width));
    const y = Math.max(-1, Math.min(1, start.value.y + (event.clientY - start.y) / rect.height));
    if (start.resize === 'move') {
      this.placements.update((ps) => ps.map((p, i) => (i === start.index ? { ...p, x, y } : p)));
    } else {
      const dx = ((event.clientX - start.x) / rect.width) * this.width(),
        dy = ((event.clientY - start.y) / rect.height) * this.height();
      const angle = (start.value.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle),
        localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const b = cropBounds(this.regions()[start.index]);
      const clamp = (n: number) => Math.max(0.1, Math.min(3, n));
      const scaleX =
        start.resize === 'y'
          ? (start.value.scaleX ?? 1)
          : clamp(
              (start.value.scaleX ?? 1) +
                (2 * localX) / (b.width * this.width() * start.value.scale),
            );
      const scaleY =
        start.resize === 'x'
          ? (start.value.scaleY ?? 1)
          : clamp(
              (start.value.scaleY ?? 1) +
                (2 * localY) / (b.height * this.height() * start.value.scale),
            );
      this.placements.update((ps) =>
        ps.map((p, i) => (i === start.index ? { ...p, scaleX, scaleY } : p)),
      );
    }
    this.showPreview(true);
  }
  placementOpacity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.opacity.set(Math.max(0.1, Math.min(1, value)));
    this.showPreview(true);
  }
  resetPlacement(): void {
    if (this.saving() || this.exporting()) return;
    this.placements.update((ps) =>
      ps.map((p, i) => (i === this.selected() ? defaultPlacement() : p)),
    );
    this.showPreview(true);
  }
  begin(event: PointerEvent, index: number, resize = false): void {
    if (
      this.saving() ||
      this.exporting() ||
      this.loading() ||
      this.mode() !== 'crop' ||
      this.preview() ||
      event.button !== 0
    )
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
    this.placementDrag = null;
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
    if (this.mode() === 'place') {
      const key =
        event.key === 'ArrowLeft' || event.key === 'ArrowRight'
          ? 'x'
          : event.key === 'ArrowUp' || event.key === 'ArrowDown'
            ? 'y'
            : null;
      if (key) {
        event.preventDefault();
        event.stopPropagation();
        const delta =
          (event.shiftKey ? 0.01 : 0.001) *
          (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
        this.adjustPlacement(key, {
          target: { value: Math.max(-1, Math.min(1, this.activePlacement()[key] + delta)) },
        } as unknown as Event);
      }
      return;
    }
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
    this.placements.update((ps) => [...ps, defaultPlacement()]);
    this.selected.set(this.regions().length - 1);
  }
  remove(): void {
    if (this.regions().length <= 1 || this.saving() || this.exporting() || this.preview()) return;
    this.regions.update((regions) => regions.filter((_, i) => i !== this.selected()));
    this.placements.update((ps) => ps.filter((_, i) => i !== this.selected()));
    this.selected.set(0);
  }
  reset(): void {
    if (this.saving() || this.exporting()) return;
    this.regions.set(this.initial());
    this.placements.set(this.regions().map(defaultPlacement));
    this.mode.set('crop');
    this.selected.set(0);
    this.preview.set(false);
    this.error.set('');
  }
  private frames(): { mask: HTMLCanvasElement; photo: HTMLCanvasElement } {
    if (!this.photo || !validCrops(this.regions()))
      throw new Error('กรุณาเลือกพื้นที่ตัดให้ถูกต้อง');
    if (this.placements().some((p) => !isOriginalPlacement(p))) return this.placedFrames();
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
  private placedFrames(): { mask: HTMLCanvasElement; photo: HTMLCanvasElement } {
    const create = () => {
      const c = document.createElement('canvas');
      c.width = this.width();
      c.height = this.height();
      return c;
    };
    // Reuse full-size buffers while dragging rather than allocating four canvases for every move.
    this.placementBuffers ??= [create(), create(), create(), create()];
    const [mask, photo, clip, cut] = this.placementBuffers;
    const m = mask.getContext('2d')!,
      p = photo.getContext('2d')!,
      c = clip.getContext('2d')!,
      source = cut.getContext('2d')!;
    if (!m || !p || !c || !source) throw new Error('สร้างภาพจัดวางไม่สำเร็จ');
    if (!validPlacements(this.placements(), this.regions().length))
      throw new Error('ตำแหน่งพาร์ทไม่ถูกต้อง');
    const w = this.width(),
      h = this.height();
    m.clearRect(0, 0, w, h);
    p.clearRect(0, 0, w, h);
    this.regions().forEach((r, i) => {
      c.clearRect(0, 0, w, h);
      paintPartClips(c, w, h, [r]);
      source.clearRect(0, 0, w, h);
      source.globalCompositeOperation = 'source-over';
      source.drawImage(this.photo!, 0, 0, w, h);
      source.globalCompositeOperation = 'destination-in';
      source.drawImage(clip, 0, 0);
      const b = cropBounds(r),
        cx = (b.x + b.width / 2) * w,
        cy = (b.y + b.height / 2) * h;
      for (const [ctx, image] of [
        [m, clip],
        [p, cut],
      ] as const) {
        ctx.save();
        placeContext(ctx, this.placements()[i], cx, cy, w, h);
        ctx.drawImage(image, 0, 0);
        ctx.restore();
      }
    });
    validateAlphaMask(m.getImageData(0, 0, w, h).data);
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
      if (this.mode() !== 'place') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(result.mask, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = this.mode() === 'place' ? this.opacity() : 1;
      ctx.drawImage(result.photo, 0, 0);
      ctx.globalAlpha = 1;
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
      this.save.emit({ mask, photo, regions, placements: structuredClone(this.placements()) });
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
