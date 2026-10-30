import { Component, afterNextRender, effect, inject, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { LoginVisual } from './components/login-visual/login-visual';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { loginDestination } from '../../../core/auth/auth-client';
import { StartButton } from '../../../shared/ui/start-button/start-button';

@Component({
  selector: 'app-login',
  imports: [Icon, ReactiveFormsModule, RouterLink, StartButton, LoginVisual],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly next = loginDestination(
    this.route.snapshot.queryParamMap.get('next'),
  );
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    afterNextRender(() => {
      void this.auth.initialize();
    });
    effect(() => {
      if (this.auth.ready() && this.auth.user()) {
        const destination = this.getRedirectDestination();
        void this.router.navigateByUrl(destination, { replaceUrl: true });
      }
    });
  }

  private getRedirectDestination(): string {
    const rawNext = this.route.snapshot.queryParamMap.get('next');
    if (rawNext && rawNext !== '/discover') {
      return this.next;
    }
    return this.auth.isAdmin() ? '/admin/discover' : '/discover';
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.message.set('');
    const result = await this.auth.signInWithPassword(
      this.form.controls.username.value,
      this.form.controls.password.value,
    );
    if (!result.ok) this.message.set(result.error);
    else {
      this.form.controls.password.reset();
      const destination = this.getRedirectDestination();
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    }
  }

  async googleSignIn(): Promise<void> {
    this.message.set('');
    await this.auth.signInWithGoogle(this.next);
  }

  forgotPassword(): void {
    void this.router.navigateByUrl('/forgot-password');
  }
}
