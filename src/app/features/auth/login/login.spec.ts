import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Login } from './login';

describe('Login', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

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

  it('opens Discover from Sign In without credentials for the UI preview', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', Login);
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.submit-button')?.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Discover');
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
