import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { RecoveryLayout } from './recovery-layout';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, Icon, RecoveryLayout],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(254)],
  });
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');
  readonly cooldown = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  async submit(): Promise<void> {
    if (this.sending() || this.cooldown()) return;
    this.email.markAsTouched();
    if (this.email.invalid) return;
    this.sending.set(true);
    this.error.set('');
    try {
      const result = await this.auth.requestPasswordReset(this.email.value);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.sent.set(true);
      this.cooldown.set(60);
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.cooldown.update((value) => Math.max(0, value - 1));
        if (!this.cooldown()) clearInterval(this.timer);
      }, 1000);
    } finally {
      this.sending.set(false);
    }
  }
}
