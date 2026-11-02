import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ads-banner',
  template: `
    <div
      class="w-full rounded-lg border border-dashed border-white/15 bg-gradient-to-b from-white/[.04] to-transparent flex flex-col items-center justify-center px-4 py-9 text-center select-none"
    >
      <span class="font-[family-name:var(--font-display)] text-[10px] text-stone-400 tracking-wide">
        Web Ads Space
      </span>
      <div class="my-5 w-8 h-[1px] bg-white/20"></div>
      <span class="text-[10px] text-stone-500"> Banner </span>
      <span class="text-[9px] text-stone-600 mt-1">
        {{ size() }}
      </span>
    </div>
  `,
  host: { class: 'block w-full' },
})
export class AdsBanner {
  readonly size = input('300x400');
}
