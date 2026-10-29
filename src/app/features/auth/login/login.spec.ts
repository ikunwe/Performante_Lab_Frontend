import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Login } from './login';
import { AUTH_CLIENT } from '../../../core/auth/auth-client';

describe('Login', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AUTH_CLIENT, useValue: async () => null }],
    }),
  );

  it('opens directly at /login and returns home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', Login);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Welcome');
    await harness.routeNativeElement?.querySelector<HTMLAnchorElement>('.back-link')?.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Build your best',
    );
  });

  it('requires credentials instead of bypassing authentication', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', Login);
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.submit-button')?.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Welcome');
    expect(harness.routeNativeElement?.textContent).toContain('กรุณากรอกรหัสผ่าน');
  });

  it('reports missing configuration when Google login is clicked', async () => {
    const harness = await RouterTestingHarness.create();
    const login = await harness.navigateByUrl('/login', Login);
    await login.googleSignIn();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('ยังไม่ได้ตั้งค่า');
  });

  it('toggles password visibility without changing its value', async () => {
    const harness = await RouterTestingHarness.create();
    const login = await harness.navigateByUrl('/login', Login);
    login.form.controls.password.setValue('test-password');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.visibility-toggle')?.click();
    harness.detectChanges();
    const input = harness.routeNativeElement?.querySelector<HTMLInputElement>('#password');
    expect(input?.type).toBe('text');
    expect(input?.value).toBe('test-password');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.visibility-toggle')?.click();
    harness.detectChanges();
    expect(input?.type).toBe('password');
  });
});
