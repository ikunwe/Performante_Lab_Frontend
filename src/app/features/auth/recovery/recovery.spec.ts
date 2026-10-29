import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';

describe('Password recovery screens', () => {
  const request = vi.fn();
  const verify = vi.fn();
  const save = vi.fn();
  beforeEach(() => {
    request.mockReset().mockResolvedValue({ ok: true });
    verify.mockReset().mockResolvedValue({ ok: true });
    save.mockReset().mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ code: 'recovery-code' }) } },
        },
        {
          provide: AuthService,
          useValue: {
            requestPasswordReset: request,
            completePasswordRecovery: verify,
            saveRecoveryPassword: save,
            user: () => ({ email: 'driver@example.com' }),
          },
        },
      ],
    });
  });

  it('validates email, shows a neutral success message and prevents immediate resends', async () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.email.setValue('invalid');
    await page.submit();
    expect(request).not.toHaveBeenCalled();
    page.email.setValue('driver@example.com');
    await page.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('หากอีเมลนี้มีบัญชี');
    await page.submit();
    expect(request).toHaveBeenCalledOnce();
    expect(page.cooldown()).toBe(60);
    fixture.destroy();
  });

  it('keeps send button loading and blocks duplicate sends until response', async () => {
    let finish!: (value: { ok: boolean }) => void;
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.email.setValue('driver@example.com');
    const pending = page.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('กำลังส่งลิงก์');
    await page.submit();
    expect(request).toHaveBeenCalledOnce();
    finish({ ok: true });
    await pending;
    fixture.destroy();
  });

  it('shows invalid/expired link without a password form', async () => {
    verify.mockResolvedValueOnce({ ok: false, error: 'ลิงก์กู้คืนหมดอายุ' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('หมดอายุ');
    expect(fixture.nativeElement.querySelector('#reset-password')).toBeNull();
    await fixture.componentInstance.submit();
    expect(save).not.toHaveBeenCalled();
  });

  it('requires matching passwords of at least 8 characters and clears them after success', async () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.setValue({ password: 'Pass123', confirmation: 'Pass123' });
    await page.submit();
    page.form.setValue({ password: 'Pass1234', confirmation: 'different' });
    await page.submit();
    expect(save).not.toHaveBeenCalled();
    page.form.setValue({ password: 'Pass1234', confirmation: 'Pass1234' });
    await page.submit();
    fixture.detectChanges();
    expect(save).toHaveBeenCalledWith('Pass1234');
    expect(page.form.controls.password.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('ตั้งรหัสผ่านใหม่สำเร็จ');
  });

  it('keeps password form available and shows update errors without claiming success', async () => {
    save.mockResolvedValueOnce({ ok: false, error: 'บันทึกไม่สำเร็จ' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.form.setValue({ password: 'Pass1234', confirmation: 'Pass1234' });
    await page.submit();
    fixture.detectChanges();
    expect(page.saved()).toBe(false);
    expect(page.saving()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('บันทึกไม่สำเร็จ');
  });
});
