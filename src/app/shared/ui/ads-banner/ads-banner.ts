import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ads-banner',
  template: `
    <div
      class="w-full aspect-[3/4] min-h-[260px] max-h-[380px] rounded-xl bg-[#383838] border border-white/5 flex flex-col items-center justify-center p-6 text-center select-none shadow-inner"
    >
      <span class="font-[family-name:var(--font-display)] text-sm sm:text-base font-semibold text-white tracking-wide">
        Web Ads Space
      </span>
      <div class="my-5 w-8 h-[1px] bg-white/20"></div>
      <span class="text-xs text-stone-300 font-medium">
        Banner
      </span>
      <span class="font-mono text-xs text-stone-400 mt-0.5">
        {{ size() }}
      </span>
    </div>
  `,
  host: { class: 'block w-full' },
})
export class AdsBanner {
  readonly size = input('300x400');
}

