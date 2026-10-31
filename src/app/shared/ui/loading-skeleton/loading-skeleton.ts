import { Component, computed, input } from '@angular/core';
@Component({
  selector: 'app-loading-skeleton',
  template: `<div role="status" aria-live="polite" [attr.aria-label]="label()">
    <span class="sr-only">{{ label() }}</span>
    <div
      [class]="
        variant() === 'brand'
          ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5'
          : 'grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4'
      "
    >
      @for (slot of slots(); track slot) {
        <div
          aria-hidden="true"
          class="animate-pulse overflow-hidden rounded-lg border border-white/[.08] bg-[#171717] motion-reduce:animate-none"
        >
          <div
            [class]="
              variant() === 'brand'
                ? 'mx-auto mb-5 mt-7 h-20 w-20 rounded-lg bg-white/[.09]'
                : 'aspect-[1.65] bg-white/[.07]'
            "
          ></div>
          <div class="space-y-3 p-4">
            <div class="h-3 w-3/4 rounded-lg bg-white/10"></div>
            <div class="h-2 w-1/2 rounded-lg bg-white/[.06]"></div>
            @if (variant() === 'build') {
              <div class="mt-4 h-8 rounded-lg bg-white/[.06]"></div>
            }
          </div>
        </div>
      }
    </div>
  </div>`,
  host: { class: 'block' },
})
export class LoadingSkeleton {
  readonly count = input(8);
  readonly variant = input<'build' | 'brand' | 'model'>('build');
  readonly label = input('กำลังโหลดข้อมูล');
  readonly slots = computed(() =>
    Array.from({ length: Math.max(1, Math.min(24, this.count())) }, (_, i) => i),
  );
}
