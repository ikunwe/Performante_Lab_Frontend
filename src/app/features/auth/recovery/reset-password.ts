import { DOCUMENT } from '@angular/common';
import { Component, afterNextRender, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { RecoveryLayout } from './recovery-layout';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, Icon, RecoveryLayout],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  readonly checking = signal(true);
  readonly verified = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      }),
      confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    {
      validators: (control: AbstractControl) =>
        control.get('password')?.value === control.get('confirmation')?.value
          ? null
          : { mismatch: true },
    },
  );

  constructor() {
    afterNextRender(() => {
      void this.verify();
    });
  }

  private async verify(): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    const hash = new URLSearchParams(this.document.defaultView?.location.hash.slice(1));
    const code = query.get('code');
    const tokenHash = query.get('token_hash');
    const denied =
      query.has('error') ||
      hash.has('error') ||
      (query.has('type') && query.get('type') !== 'recovery');
    // Do not retain recovery credentials in browser history or links.
    this.document.defaultView?.history.replaceState(null, '', this.document.location.pathname);
    try {
      const result = await this.auth.completePasswordRecovery(code, tokenHash, denied);
      this.verified.set(result.ok);
      if (!result.ok) this.error.set(result.error);
    } finally {
      this.checking.set(false);
    }
  }

  async submit(): Promise<void> {
    if (!this.verified() || this.saving() || this.saved()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await this.auth.saveRecoveryPassword(this.form.controls.password.value);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.form.reset();
      this.showPassword.set(false);
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
