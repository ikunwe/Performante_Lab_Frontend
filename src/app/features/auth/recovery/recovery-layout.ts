import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginVisual } from '../login/components/login-visual/login-visual';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-recovery-layout',
  imports: [RouterLink, LoginVisual, Icon],
  template: `
    <main class="grid min-h-dvh gap-3 bg-[#090909] p-3 text-stone-100 lg:grid-cols-[1.12fr_1fr]">
      <section
        class="flex min-h-[calc(100dvh_-_24px)] flex-col rounded-lg border border-white/5 bg-[#151515] px-6 py-7 sm:px-12"
      >
        <a
          routerLink="/login"
          class="inline-flex min-h-10 cursor-pointer items-center gap-3 self-start text-[10px] tracking-widest text-stone-500 hover:text-white"
          ><app-icon name="back" class="!size-3" />BACK TO SIGN IN</a
        >
        <div class="mx-auto my-auto w-full max-w-[400px] py-10">
          <p class="mb-5 text-[9px] tracking-[.22em] text-red-400">ACCOUNT RECOVERY</p>
          <h1
            class="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-.06em] sm:text-4xl"
          >
            {{ title() }}<span class="text-red-500">.</span>
          </h1>
          <p class="mt-4 text-sm leading-relaxed text-stone-500">{{ description() }}</p>
          <div class="mt-8"><ng-content /></div>
        </div>
        <footer class="text-[8px] tracking-widest text-stone-600">
          PERFORMANTE LAB · YOUR VISION. YOUR DRIVE.
        </footer>
      </section>
      <aside appLoginVisual class="hidden rounded-lg lg:block" aria-label="Performante Lab"></aside>
    </main>
  `,
})
export class RecoveryLayout {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
