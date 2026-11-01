import {
  Component,
  ElementRef,
  InjectionToken,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { BuildLayerPlan } from '../../../core/catalog/build-layers';
import { compositeBuild } from '../../../core/catalog/composite-build';
export const BUILD_COMPOSITOR = new InjectionToken<typeof compositeBuild>('BUILD_COMPOSITOR', {
  providedIn: 'root',
  factory: () => compositeBuild,
});

@Component({
  selector: 'app-build-preview',
  host: { class: 'relative block h-full w-full' },
  template: `
    @if (plan().base; as base) {
      <img
        [src]="base"
        [alt]="label()"
        class="h-full w-full object-contain"
        [class.invisible]="ready()"
      />
    }
    <canvas
      #canvas
      role="img"
      [attr.aria-label]="label()"
      class="absolute inset-0 h-full w-full object-contain"
      [class.invisible]="!ready()"
    ></canvas>
    @if (loading()) {
      <span
        role="status"
        class="absolute bottom-1 right-1 animate-pulse rounded-lg bg-black/70 px-2 py-1 text-[9px] text-stone-300"
        >กำลังประกอบภาพ…</span
      >
    }
    @if (error()) {
      <span
        role="alert"
        class="absolute inset-x-1 bottom-1 rounded-lg bg-black/80 px-2 py-1 text-[9px] text-amber-200"
        >{{ error() }}</span
      >
    }
  `,
})
export class BuildPreview {
  readonly plan = input.required<BuildLayerPlan>();
  readonly label = input('ภาพรถพร้อมพาร์ทที่เลือก');
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly compose = inject(BUILD_COMPOSITOR);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  constructor() {
    effect((onCleanup) => {
      const plan = this.plan(),
        canvas = this.canvas()?.nativeElement;
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      this.ready.set(false);
      this.error.set('');
      this.loading.set(false);
      if (!this.browser || !canvas || !plan.base || !plan.layers.length) return;
      this.loading.set(true);
      void this.compose(plan)
        .then((result) => {
          if (cancelled) return;
          canvas.width = result.width;
          canvas.height = result.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('ไม่สามารถแสดงภาพประกอบได้');
          context.drawImage(result, 0, 0);
          this.ready.set(true);
        })
        .catch((error) => {
          if (!cancelled)
            this.error.set(
              (error instanceof Error ? error.message : 'ประกอบภาพไม่สำเร็จ') +
                ' · แสดงภาพฐานชั่วคราว',
            );
        })
        .finally(() => {
          if (!cancelled) this.loading.set(false);
        });
    });
  }
}
