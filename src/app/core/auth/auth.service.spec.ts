import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  AUTH_CLIENT,
  AUTH_CONFIG,
  AUTH_NEXT_KEY,
  AUTH_RECOVERY_KEY,
  loginDestination,
} from './auth-client';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('Supabase authentication', () => {
  const session = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      aud: 'authenticated',
      app_metadata: {},
      created_at: '2026-10-29T00:00:00Z',
      email: 'driver@example.com',
      user_metadata: { full_name: 'Driver' },
    },
  } satisfies Session;
  let listener: (event: string, session: Session | null) => void;
  let client: { auth: Record<string, ReturnType<typeof vi.fn>>; rpc: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = {
      rpc: vi.fn().mockResolvedValue({ data: { username: null, hasPassword: false }, error: null }),
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          listener = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: { user: session.user }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user }, error: null }),
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: 'user-1', name: 'Driver' } }),
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTH_CLIENT, useValue: async () => client as unknown as SupabaseClient },
        { provide: AUTH_CONFIG, useValue: async () => ({ apiBaseUrl: 'http://localhost:3000' }) },
      ],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.removeItem(AUTH_RECOVERY_KEY);
  });

  it('requests recovery by email with a same-origin reset URL without checking account existence', async () => {
    const auth = TestBed.inject(AuthService);
    expect((await auth.requestPasswordReset('not-an-email')).ok).toBe(false);
    expect(client.auth['resetPasswordForEmail']).not.toHaveBeenCalled();
    expect((await auth.requestPasswordReset(' driver@example.com ')).ok).toBe(true);
    expect(client.auth['resetPasswordForEmail']).toHaveBeenCalledWith('driver@example.com', {
      redirectTo: location.origin + '/reset-password',
    });
    expect(client.auth['getUser']).not.toHaveBeenCalled();
  });

  it('reports email rate limits and network failure', async () => {
    const auth = TestBed.inject(AuthService);
    client.auth['resetPasswordForEmail'].mockResolvedValueOnce({ error: { status: 429 } });
    const limited = await auth.requestPasswordReset('driver@example.com');
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.error).toContain('ถี่เกินไป');
    client.auth['resetPasswordForEmail'].mockRejectedValueOnce(new Error('offline'));
    expect((await auth.requestPasswordReset('driver@example.com')).ok).toBe(false);
  });

  it('rejects normal login codes and does not allow password reset from a plain session', async () => {
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    expect((await auth.saveRecoveryPassword('Pass1234')).ok).toBe(false);
    expect((await auth.completePasswordRecovery('oauth-code', null, false)).ok).toBe(false);
    expect((await auth.saveRecoveryPassword('Pass1234')).ok).toBe(false);
    expect(client.auth['updateUser']).not.toHaveBeenCalled();
  });

  it('validates PKCE recovery once, updates password and clears recovery state', async () => {
    const auth = TestBed.inject(AuthService);
    client.auth['exchangeCodeForSession'].mockImplementation(async () => {
      listener('PASSWORD_RECOVERY', session);
      return { data: { session }, error: null };
    });
    const results = await Promise.all([
      auth.completePasswordRecovery('recovery-code', null, false),
      auth.completePasswordRecovery('recovery-code', null, false),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(client.auth['exchangeCodeForSession']).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(AUTH_RECOVERY_KEY)).toBe('user-1');
    expect((await auth.saveRecoveryPassword('Pass1234')).ok).toBe(true);
    expect(client.auth['updateUser']).toHaveBeenCalledWith({ password: 'Pass1234' });
    expect(sessionStorage.getItem(AUTH_RECOVERY_KEY)).toBeNull();
    expect((await auth.saveRecoveryPassword('Pass1234')).ok).toBe(false);
  });

  it('verifies recovery token hashes using the recovery type', async () => {
    const auth = TestBed.inject(AuthService);
    expect((await auth.completePasswordRecovery(null, 'email-token-hash', false)).ok).toBe(true);
    expect(client.auth['verifyOtp']).toHaveBeenCalledWith({
      token_hash: 'email-token-hash',
      type: 'recovery',
    });
    expect(client.auth['exchangeCodeForSession']).not.toHaveBeenCalled();
  });

  it('rejects expired recovery links and explicit denial', async () => {
    const auth = TestBed.inject(AuthService);
    client.auth['verifyOtp'].mockResolvedValueOnce({
      data: { session: null },
      error: new Error('expired'),
    });
    expect((await auth.completePasswordRecovery(null, 'expired', false)).ok).toBe(false);
    expect((await auth.saveRecoveryPassword('Pass1234')).ok).toBe(false);
  });

  it('restores recovery after reload only when the verified user matches the saved recovery user', async () => {
    sessionStorage.setItem(AUTH_RECOVERY_KEY, 'user-1');
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    expect((await auth.completePasswordRecovery(null, null, false)).ok).toBe(true);
    expect(client.auth['getUser']).toHaveBeenCalledOnce();
  });

  it('keeps Google loading after OAuth dispatch and restores the button when returning with Back', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signInWithGoogle();
    expect(auth.busy()).toBe(true);
    expect(auth.action()).toBe('google');
    await auth.signInWithGoogle();
    expect(client.auth['signInWithOAuth']).toHaveBeenCalledTimes(1);
    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    window.dispatchEvent(restored);
    expect(auth.busy()).toBe(false);
    expect(auth.action()).toBeNull();
  });

  it('keeps password login loading until response and prevents a second request', async () => {
    let finish!: (value: unknown) => void;
    client.auth['signInWithPassword'].mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const auth = TestBed.inject(AuthService);
    const pending = auth.signInWithPassword('driver@example.com', 'long-password-123');
    await vi.waitFor(() => expect(client.auth['signInWithPassword']).toHaveBeenCalledOnce());
    expect(auth.busy()).toBe(true);
    expect(auth.action()).toBe('password');
    expect((await auth.signInWithPassword('driver@example.com', 'long-password-123')).ok).toBe(
      false,
    );
    expect(client.auth['signInWithPassword']).toHaveBeenCalledOnce();
    finish({ data: { session: null }, error: { code: 'invalid_credentials' } });
    expect((await pending).ok).toBe(false);
    expect(auth.busy()).toBe(false);
    expect(auth.action()).toBeNull();
  });

  it('reads password status from the account RPC and handles duplicate usernames', async () => {
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    await auth.initialize();
    expect(auth.accountComplete()).toBe(false);
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    const duplicate = await auth.setUsername('Driver');
    expect(duplicate.ok).toBe(false);
    expect(client.rpc).toHaveBeenLastCalledWith('set_my_username', { new_username: 'Driver' });
    expect(auth.account()?.username).toBeNull();
    client.rpc.mockResolvedValue({ data: { username: 'driver', hasPassword: true }, error: null });
    expect((await auth.setUsername('Driver')).ok).toBe(true);
    expect(auth.accountComplete()).toBe(true);
    client.rpc.mockRejectedValueOnce(new Error('offline'));
    await auth.refreshAccount();
    expect(auth.accountComplete()).toBeNull();
  });

  it('only changes password status after a successful Supabase password update and reload', async () => {
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    await auth.initialize();
    expect((await auth.setPassword('Pass123')).ok).toBe(false);
    expect(client.auth['updateUser']).not.toHaveBeenCalled();
    client.auth['updateUser'].mockResolvedValueOnce({ error: { code: 'reauthentication_needed' } });
    expect((await auth.setPassword('long-password-123')).ok).toBe(false);
    expect(auth.account()?.hasPassword).toBe(false);
    client.rpc.mockResolvedValue({ data: { username: 'driver', hasPassword: true }, error: null });
    expect((await auth.setPassword('Pass1234')).ok).toBe(true);
    expect(client.auth['updateUser']).toHaveBeenLastCalledWith({ password: 'Pass1234' });
    expect(auth.accountComplete()).toBe(true);
  });

  it('logs in with username through the Backend and installs the returned session', async () => {
    const auth = TestBed.inject(AuthService);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'access-token', refresh_token: 'refresh-token' }),
    } as Response);
    expect((await auth.signInWithPassword('driver', 'long-password-123')).ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'driver', password: 'long-password-123' }),
      }),
    );
    expect(client.auth['setSession']).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(auth.user()?.id).toBe('user-1');
  });

  it('logs in by email directly with Supabase and does not accept API login failures', async () => {
    const auth = TestBed.inject(AuthService);
    expect((await auth.signInWithPassword('driver@example.com', 'long-password-123')).ok).toBe(
      true,
    );
    expect(client.auth['signInWithPassword']).toHaveBeenCalledWith({
      email: 'driver@example.com',
      password: 'long-password-123',
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Username หรือรหัสผ่านไม่ถูกต้อง' }),
    } as Response);
    const result = await auth.signInWithPassword('wrong', 'bad-password');
    expect(result.ok).toBe(false);
    expect(client.auth['setSession']).not.toHaveBeenCalled();
  });

  it('restores sessions, validates them through the API and receives logout events', async () => {
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    await auth.initialize();
    expect(auth.displayName()).toBe('Driver');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-token' } }),
    );
    listener('SIGNED_OUT', null);
    expect(auth.user()).toBeNull();
    expect(auth.backendProfile()).toBeNull();
  });

  it('starts Google OAuth with a callback on this origin and a safe destination', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signInWithGoogle('//evil.example');
    const args = client.auth['signInWithOAuth'].mock.calls[0][0];
    expect(args.provider).toBe('google');
    const callback = new URL(args.options.redirectTo);
    expect(callback.origin).toBe(location.origin);
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.search).toBe('');
    expect(sessionStorage.getItem(AUTH_NEXT_KEY)).toBe('/discover');
  });

  it('exchanges a callback code exactly once and restores its user', async () => {
    client.auth['getSession'].mockResolvedValue({ data: { session }, error: null });
    const auth = TestBed.inject(AuthService);
    const results = await Promise.all([
      auth.completeCallback('one-time-code', false),
      auth.completeCallback('one-time-code', false),
    ]);
    expect(results).toEqual([true, true]);
    expect(client.auth['exchangeCodeForSession']).toHaveBeenCalledTimes(1);
    expect(auth.user()?.id).toBe('user-1');
  });

  it('handles cancellation and expired codes without creating a session', async () => {
    const auth = TestBed.inject(AuthService);
    expect(await auth.completeCallback(null, true)).toBe(false);
    expect(client.auth['exchangeCodeForSession']).not.toHaveBeenCalled();
    expect(auth.error()).toContain('ยกเลิก');
  });

  it('reports invalid codes and login/signout failures', async () => {
    const auth = TestBed.inject(AuthService);
    client.auth['exchangeCodeForSession'].mockResolvedValue({
      data: { session: null },
      error: new Error('expired'),
    });
    expect(await auth.completeCallback('expired', false)).toBe(false);
    expect(auth.error()).toContain('หมดอายุ');
    client.auth['signInWithOAuth'].mockRejectedValue(new Error('offline'));
    await auth.signInWithGoogle();
    expect(auth.error()).toContain('ไม่สำเร็จ');
    listener('SIGNED_IN', session);
    client.auth['signOut'].mockResolvedValue({ error: new Error('offline') });
    expect(await auth.signOut()).toBe(false);
    expect(auth.user()?.id).toBe('user-1');
    client.auth['signOut'].mockResolvedValue({ error: null });
    expect(await auth.signOut()).toBe(true);
    expect(auth.user()).toBeNull();
  });

  it('redirects unauthenticated private routes and allows signed-in users', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/build/new?car=f8-tributo' } as never),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toContain('/login?next=');
    listener('SIGNED_IN', session);
    expect(
      await TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/my-builds' } as never),
      ),
    ).toBe(true);
  });

  it('only accepts known application destinations', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/auth/callback',
      '/unknown',
    ])
      expect(loginDestination(value)).toBe('/discover');
    expect(loginDestination('/build/new?car=f8-tributo&next=https://evil.example')).toBe(
      '/build/new?car=f8-tributo',
    );
  });
});
