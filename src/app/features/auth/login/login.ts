import { Component, inject, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { LoginVisual } from './components/login-visual/login-visual';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StartButton } from '../../../shared/ui/start-button/start-button';

@Component({
  selector: 'app-login',
  imports: [Icon, ReactiveFormsModule, RouterLink, StartButton, LoginVisual],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly router = inject(Router);
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    this.message.set('');
    // Temporary UI preview: navigate without creating an authenticated session.
    void this.router.navigateByUrl('/discover');
  }

  googleSignIn(): void {
    this.message.set('การเข้าสู่ระบบด้วย Google ยังไม่เปิดใช้งาน');
  }

  forgotPassword(): void {
    this.message.set('ระบบกู้คืนรหัสผ่านยังไม่เปิดใช้งาน');
  }
}
