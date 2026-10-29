import { Component, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { AccountAvatar } from '../../shared/ui/account-avatar/account-avatar';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, DatePipe, AccountAvatar, Icon],
  templateUrl: './profile.html',
  host: { class: 'block' },
})
export class Profile {
  readonly auth = inject(AuthService);
  readonly saving = signal<'username' | 'password' | null>(null);
  readonly usernameMessage = signal('');
  readonly passwordMessage = signal('');
  readonly usernameFailed = signal(false);
  readonly passwordFailed = signal(false);
  readonly showPassword = signal(false);
  readonly loading = signal(true);
  readonly fullName = computed(
    () => this.auth.user()?.user_metadata?.['full_name'] || 'ยังไม่มีชื่อ',
  );
  readonly providers = computed(() =>
    [...new Set(this.auth.user()?.identities?.map((identity) => identity.provider) ?? [])]
      .map((provider) =>
        provider === 'google' ? 'Google' : provider === 'email' ? 'Email' : provider,
      )
      .join(' · '),
  );
  readonly usernameForm = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control) => {
          const value = String(control.value ?? '').trim();
          return value && [...value].length <= 64 && !/[\u0000-\u001f\u007f-\u009f@]/.test(value)
            ? null
            : { username: true };
        },
      ],
    }),
  });
  readonly passwordForm = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    {
      validators: (form: AbstractControl) =>
        form.get('password')?.value === form.get('confirmPassword')?.value
          ? null
          : { mismatch: true },
    },
  );

  constructor() {
    effect(() => {
      const username = this.auth.account()?.username;
      if (username && !this.usernameForm.dirty)
        this.usernameForm.controls.username.setValue(username);
    });
    afterNextRender(() => {
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    await this.auth.initialize();
    await this.auth.refreshAccount();
    this.loading.set(false);
  }

  async saveUsername(): Promise<void> {
    if (this.saving()) return;
    this.usernameForm.markAllAsTouched();
    if (this.usernameForm.invalid) return;
    this.saving.set('username');
    this.usernameMessage.set('');
    try {
      const result = await this.auth.setUsername(this.usernameForm.controls.username.value);
      this.usernameFailed.set(!result.ok);
      this.usernameMessage.set(result.ok ? 'บันทึก Username แล้ว' : result.error);
      if (result.ok) {
        this.usernameForm.reset({ username: this.auth.account()?.username ?? '' });
      }
    } finally {
      this.saving.set(null);
    }
  }

  async savePassword(): Promise<void> {
    if (this.saving()) return;
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;
    this.saving.set('password');
    this.passwordMessage.set('');
    try {
      const result = await this.auth.setPassword(this.passwordForm.controls.password.value);
      this.passwordFailed.set(!result.ok);
      this.passwordMessage.set(
        result.ok
          ? 'บันทึกรหัสผ่านแล้ว ครั้งถัดไปเข้าสู่ระบบด้วยอีเมลหรือ Username และรหัสผ่านนี้ได้'
          : result.error,
      );
      if (result.ok) {
        this.passwordForm.reset();
        this.showPassword.set(false);
      }
    } finally {
      this.saving.set(null);
    }
  }
}
