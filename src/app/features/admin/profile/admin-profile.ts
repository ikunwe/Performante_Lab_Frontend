import { Component } from '@angular/core';
import { Profile } from '../../profile/profile';

@Component({
  selector: 'app-admin-profile',
  imports: [Profile],
  template: `
    <div class="space-y-7">
      <div>
        <p class="mb-2 text-[8px] tracking-[.24em] text-red-400/80">ADMIN WORKSPACE</p>
        <h1 class="font-[family-name:var(--font-display)] text-[25px] tracking-[-.06em] md:text-[29px]">Profile</h1>
        <p class="mt-2 text-xs text-stone-500">ข้อมูลส่วนตัวและการตั้งค่าบัญชี</p>
      </div>
      <app-profile />
    </div>
  `,
})
export class AdminProfile {}
