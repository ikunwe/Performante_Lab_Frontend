import { Component, computed, effect, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-account-avatar',
  imports: [Icon],
  host: { class: 'relative inline-flex size-9 shrink-0 items-center justify-center' },
  template: `
    <span
      class="flex size-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#292929] text-stone-400"
    >
      @if (url() && !failed()) {
        <img
          [src]="url()"
          [alt]="name()"
          referrerpolicy="no-referrer"
          (error)="failed.set(true)"
          class="size-full object-cover"
        />
      } @else {
        <app-icon name="user" class="!size-[45%]" />
      }
    </span>
    @if (showStatus()) {
      <span
        role="img"
        [attr.aria-label]="statusLabel()"
        [title]="statusLabel()"
        class="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-[#151515]"
        [class.bg-sky-400]="complete() === true"
        [class.text-slate-950]="complete() === true"
        [class.bg-amber-400]="complete() !== true"
        [class.text-amber-950]="complete() !== true"
      >
        <app-icon [name]="complete() === true ? 'check' : 'exclamation'" class="!size-2" />
      </span>
    }
  `,
})
export class AccountAvatar {
  readonly url = input('');
  readonly name = input('Profile');
  readonly complete = input<boolean | null>(null);
  readonly showStatus = input(true);
  readonly failed = signal(false);
  readonly statusLabel = computed(() =>
    this.complete() === true
      ? 'ตั้งค่า Username และรหัสผ่านแล้ว'
      : this.complete() === false
        ? 'ยังตั้งค่า Username หรือรหัสผ่านไม่ครบ'
        : 'ยังตรวจสอบสถานะการตั้งค่าไม่ได้',
  );
  constructor() {
    effect(() => {
      this.url();
      this.failed.set(false);
    });
  }
}
