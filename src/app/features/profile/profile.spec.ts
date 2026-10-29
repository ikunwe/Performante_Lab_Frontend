import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { Profile } from './profile';

describe('Profile settings', () => {
  let auth: {
    account: ReturnType<typeof signal<{ username: string | null; hasPassword: boolean } | null>>;
    user: ReturnType<typeof vi.fn>;
    accountComplete: () => boolean;
    avatarUrl: ReturnType<typeof vi.fn>;
    accountError: ReturnType<typeof signal<string>>;
    initialize: ReturnType<typeof vi.fn>;
    refreshAccount: ReturnType<typeof vi.fn>;
    setUsername: ReturnType<typeof vi.fn>;
    setPassword: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    auth = {
      account: signal({ username: null, hasPassword: false }),
      user: vi.fn(() => ({
        email: 'driver@example.com',
        created_at: '2026-10-29',
        user_metadata: { full_name: 'Test Driver' },
        identities: [{ provider: 'google' }],
      })),
      avatarUrl: vi.fn(() => ''),
      accountComplete: vi.fn(() => !!auth.account()?.username && !!auth.account()?.hasPassword),
      accountError: signal(''),
      initialize: vi.fn().mockResolvedValue(undefined),
      refreshAccount: vi.fn().mockResolvedValue(undefined),
      setUsername: vi.fn().mockImplementation(async (username) => {
        auth.account.set({ username, hasPassword: false });
        return { ok: true };
      }),
      setPassword: vi.fn().mockImplementation(async () => {
        auth.account.update((account) => ({ ...account!, hasPassword: true }));
        return { ok: true };
      }),
    };
    TestBed.configureTestingModule({
      imports: [Profile],
      providers: [{ provide: AuthService, useValue: auth }],
    });
  });

  it('shows real profile data and separate setup statuses', async () => {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test Driver');
    expect(fixture.nativeElement.textContent).toContain('driver@example.com');
    expect(fixture.nativeElement.textContent).toContain('Google');
    expect(fixture.nativeElement.textContent).toContain('ยังไม่ได้ตั้งค่า');
    auth.account.set({ username: 'driver', hasPassword: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ตั้งค่าบัญชีครบแล้ว');
  });

  it('does not save invalid usernames or mismatching/short passwords', async () => {
    const page = TestBed.createComponent(Profile).componentInstance;
    page.usernameForm.controls.username.setValue('bad@name');
    await page.saveUsername();
    expect(auth.setUsername).not.toHaveBeenCalled();
    page.passwordForm.setValue({
      password: 'long-password-123',
      confirmPassword: 'different-password',
    });
    await page.savePassword();
    page.passwordForm.setValue({ password: 'Pass123', confirmPassword: 'Pass123' });
    await page.savePassword();
    expect(auth.setPassword).not.toHaveBeenCalled();
  });

  it('saves username and password, then clears password fields', async () => {
    const page = TestBed.createComponent(Profile).componentInstance;
    page.usernameForm.controls.username.setValue('สมชาย Jaidee');
    await page.saveUsername();
    expect(page.usernameForm.controls.username.value).toBe('สมชาย Jaidee');
    page.passwordForm.setValue({
      password: 'Pass1234',
      confirmPassword: 'Pass1234',
    });
    await page.savePassword();
    expect(auth.setPassword).toHaveBeenCalledWith('Pass1234');
    expect(page.passwordForm.controls.password.value).toBe('');
    expect(page.passwordForm.controls.confirmPassword.value).toBe('');
    expect(auth.accountComplete()).toBe(true);
  });

  it('keeps input and displays duplicate/save errors without claiming success', async () => {
    const page = TestBed.createComponent(Profile).componentInstance;
    auth.setUsername.mockResolvedValue({ ok: false, error: 'Username นี้มีผู้ใช้แล้ว' });
    page.usernameForm.controls.username.setValue('driver');
    await page.saveUsername();
    expect(page.usernameMessage()).toContain('มีผู้ใช้แล้ว');
    auth.setPassword.mockResolvedValue({ ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' });
    page.passwordForm.setValue({
      password: 'long-password-123',
      confirmPassword: 'long-password-123',
    });
    await page.savePassword();
    expect(page.passwordFailed()).toBe(true);
    expect(auth.account()?.hasPassword).toBe(false);
    expect(page.passwordForm.controls.password.value).toBe('long-password-123');
  });
});
