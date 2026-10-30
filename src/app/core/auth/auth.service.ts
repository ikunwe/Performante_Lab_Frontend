import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  AUTH_CLIENT,
  AUTH_CONFIG,
  AUTH_NEXT_KEY,
  AUTH_RECOVERY_KEY,
  loginDestination,
} from './auth-client';

export interface AccountSettings {
  username: string | null;
  hasPassword: boolean;
}
export type AccountResult = { ok: true } | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly createClient = inject(AUTH_CLIENT);
  private readonly loadConfig = inject(AUTH_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private client: SupabaseClient | null = null;
  private initialization?: Promise<void>;
  private callback?: Promise<boolean>;
  private recoveryExchange?: Promise<AccountResult>;
  private recoveryUser: string | null = null;
  private recoveryEventUser: string | null = null;
  private unsubscribe?: () => void;
  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly account = signal<AccountSettings | null>(null);
  readonly accountError = signal('');
  readonly accountComplete = computed(() =>
    this.account() ? !!this.account()!.username && this.account()!.hasPassword : null,
  );
  readonly avatarUrl = computed(() => {
    const url = this.user()?.user_metadata?.['avatar_url'];
    return typeof url === 'string' && url.startsWith('https://') ? url : '';
  });
  readonly displayName = computed(
    () =>
      this.account()?.username ||
      this.user()?.user_metadata?.['full_name'] ||
      this.user()?.email ||
      'Account',
  );
  readonly ready = signal(false);
  readonly configured = signal(false);
  readonly busy = signal(false);
  readonly action = signal<'google' | 'password' | 'logout' | null>(null);
  readonly apiLoading = signal(false);
  readonly error = signal('');
  readonly apiError = signal('');
  readonly backendProfile = signal<{ id: string; email: string | null; name: string } | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
    const window = this.document.defaultView;
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && this.action() === 'google') {
        this.busy.set(false);
        this.action.set(null);
      }
    };
    window?.addEventListener('pageshow', onPageShow);
    this.destroyRef.onDestroy(() => window?.removeEventListener('pageshow', onPageShow));
  }

  initialize(): Promise<void> {
    return (this.initialization ??= this.load());
  }

  private async load(): Promise<void> {
    try {
      this.client = await this.createClient();
      this.configured.set(!!this.client);
      if (!this.client) return;
      const { data } = this.client.auth.onAuthStateChange((_event, session) => {
        // Keep this callback synchronous to avoid Supabase auth lock contention.
        this.session.set(session);
        if (_event === 'PASSWORD_RECOVERY') this.recoveryEventUser = session?.user.id ?? null;
        if (!session) {
          this.clearRecovery();
          this.backendProfile.set(null);
          this.account.set(null);
        }
      });
      this.unsubscribe = () => data.subscription.unsubscribe();
      const result = await this.client.auth.getSession();
      if (result.error) throw result.error;
      this.session.set(result.data.session);
      if (result.data.session)
        await Promise.all([this.refreshBackendProfile(), this.refreshAccount()]);
    } catch {
      this.error.set('เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      this.ready.set(true);
    }
  }

  async signInWithGoogle(next = '/discover'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.action.set('google');
    let redirecting = false;
    this.error.set('');
    try {
      await this.initialize();
      if (!this.client) {
        this.error.set('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase');
        return;
      }
      const redirect = new URL('auth/callback', this.document.baseURI);
      this.document.defaultView?.sessionStorage.setItem(AUTH_NEXT_KEY, loginDestination(next));
      const { error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      // OAuth navigates away; keep loading until callback/new page or browser Back.
      redirecting = true;
    } catch {
      this.error.set('เปิด Google Login ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      if (!redirecting) {
        this.busy.set(false);
        this.action.set(null);
      }
    }
  }

  completeCallback(code: string | null, denied: boolean): Promise<boolean> {
    return (this.callback ??= this.exchange(code, denied));
  }

  private async exchange(code: string | null, denied: boolean): Promise<boolean> {
    this.error.set('');
    await this.initialize();
    if (denied) {
      this.error.set('การเข้าสู่ระบบถูกยกเลิกหรือไม่ได้รับอนุญาต กรุณาลองใหม่');
      return false;
    }
    if (!code || !this.client) {
      this.error.set('ลิงก์เข้าสู่ระบบไม่สมบูรณ์ กรุณากลับไปเข้าสู่ระบบใหม่');
      return false;
    }
    try {
      const { data, error } = await this.client.auth.exchangeCodeForSession(code);
      if (error || !data.session) throw error;
      this.session.set(data.session);
      await Promise.all([this.refreshBackendProfile(), this.refreshAccount()]);
      return true;
    } catch {
      this.error.set('ลิงก์เข้าสู่ระบบหมดอายุหรือใช้ไม่ได้ กรุณาเข้าสู่ระบบใหม่จากเบราว์เซอร์เดิม');
      return false;
    }
  }

  async signOut(): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.action.set('logout');
    this.error.set('');
    try {
      await this.initialize();
      if (this.client) {
        const { error } = await this.client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }
      this.session.set(null);
      this.clearRecovery();
      this.account.set(null);
      this.backendProfile.set(null);
      this.apiError.set('');
      return true;
    } catch {
      this.error.set('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
      return false;
    } finally {
      this.busy.set(false);
      this.action.set(null);
    }
  }

  async refreshBackendProfile(): Promise<void> {
    if (!this.client || this.apiLoading()) return;
    this.apiLoading.set(true);
    try {
      // getSession refreshes expired tokens; protected API calls use the current access token.
      const { data, error } = await this.client.auth.getSession();
      if (error || !data.session) throw error;
      const config = await this.loadConfig();
      const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/auth/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('api');
      const body = await response.json();
      this.backendProfile.set(body.user);
      this.apiError.set('');
    } catch {
      this.backendProfile.set(null);
      this.apiError.set(
        'เข้าสู่ระบบ Google แล้ว แต่เชื่อมต่อ Backend ไม่สำเร็จ กรุณาตรวจว่า API เปิดใช้งานและตั้งค่า Supabase แล้ว',
      );
    } finally {
      this.apiLoading.set(false);
    }
  }

  async apiSession(): Promise<{ userId: string; accessToken: string }> {
    await this.initialize();
    if (!this.client) throw new Error('AUTH_REQUIRED');
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) throw new Error('AUTH_REQUIRED');
    return { userId: data.session.user.id, accessToken: data.session.access_token };
  }

  async refreshAccount(): Promise<void> {
    if (!this.client || !this.user()) return;
    const userId = this.user()!.id;
    try {
      const { data, error } = await this.client.rpc('get_my_account');
      if (error || !data || typeof data.hasPassword !== 'boolean') throw error;
      if (this.user()?.id === userId) {
        this.account.set(data as AccountSettings);
        this.accountError.set('');
      }
    } catch {
      if (this.user()?.id === userId) {
        this.account.set(null);
        this.accountError.set('โหลดข้อมูลการตั้งค่าบัญชีไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ');
      }
    }
  }

  async setUsername(username: string): Promise<AccountResult> {
    await this.initialize();
    const normalized = username.trim();
    if (
      !normalized ||
      [...normalized].length > 64 ||
      /[\u0000-\u001f\u007f-\u009f@]/.test(normalized)
    )
      return { ok: false, error: 'Username ต้องยาว 1–64 ตัวอักษร และไม่มี @ หรืออักขระควบคุม' };
    if (!this.client || !this.user()) return { ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' };
    try {
      const { data, error } = await this.client.rpc('set_my_username', {
        new_username: normalized,
      });
      if (error)
        return {
          ok: false,
          error:
            error.code === '23505'
              ? 'Username นี้มีผู้ใช้แล้ว กรุณาเลือกชื่ออื่น'
              : 'บันทึก Username ไม่สำเร็จ กรุณาลองใหม่',
        };
      this.account.set(data as AccountSettings);
      return { ok: true };
    } catch {
      return { ok: false, error: 'เชื่อมต่อไม่ได้ กรุณาลองใหม่' };
    }
  }

  async setPassword(password: string): Promise<AccountResult> {
    await this.initialize();
    if (password.length < 8 || password.length > 128)
      return { ok: false, error: 'รหัสผ่านต้องยาว 8–128 ตัวอักษร' };
    if (!this.client || !this.user()) return { ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' };
    try {
      const { error } = await this.client.auth.updateUser({ password });
      if (error) {
        const reauth = [
          'reauthentication_needed',
          'reauthentication_not_valid',
          'session_not_found',
        ].includes(error.code ?? '');
        return {
          ok: false,
          error: reauth
            ? 'กรุณาเข้าสู่ระบบด้วย Google ใหม่ก่อนเปลี่ยนรหัสผ่าน'
            : 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาใช้รหัสผ่านที่แข็งแรงและตรงตามข้อกำหนดของระบบ',
        };
      }
      await this.refreshAccount();
      return { ok: true };
    } catch {
      return { ok: false, error: 'เชื่อมต่อไม่ได้ กรุณาลองใหม่' };
    }
  }

  async signInWithPassword(identifier: string, password: string): Promise<AccountResult> {
    if (this.busy()) return { ok: false, error: 'กำลังเข้าสู่ระบบ กรุณารอสักครู่' };
    this.busy.set(true);
    this.action.set('password');
    try {
      await this.initialize();
      if (!this.client) return { ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase' };
      if (identifier.includes('@')) {
        const result = await this.client.auth.signInWithPassword({
          email: identifier.trim(),
          password,
        });
        if (result.error || !result.data.session)
          return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
        this.session.set(result.data.session);
      } else {
        const config = await this.loadConfig();
        const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier.trim(), password }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok) return { ok: false, error: result.message || 'เข้าสู่ระบบไม่สำเร็จ' };
        const { data, error } = await this.client.auth.setSession(result);
        if (error || !data.session)
          return { ok: false, error: 'สร้างเซสชันไม่สำเร็จ กรุณาลองใหม่' };
        this.session.set(data.session);
      }
      await Promise.all([this.refreshAccount(), this.refreshBackendProfile()]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่' };
    } finally {
      this.busy.set(false);
      this.action.set(null);
    }
  }

  async requestPasswordReset(email: string): Promise<AccountResult> {
    const normalized = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
      return { ok: false, error: 'กรุณากรอกอีเมลให้ถูกต้อง' };
    await this.initialize();
    if (!this.client) return { ok: false, error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase' };
    try {
      const redirectTo = new URL('reset-password', this.document.baseURI).href;
      const { error } = await this.client.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error)
        return {
          ok: false,
          error:
            error.status === 429 || error.code === 'over_email_send_rate_limit'
              ? 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
              : 'ส่งลิงก์ไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
        };
      this.recoveryExchange = undefined;
      return { ok: true };
    } catch {
      return { ok: false, error: 'เชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง' };
    }
  }

  completePasswordRecovery(
    code: string | null,
    tokenHash: string | null,
    denied: boolean,
  ): Promise<AccountResult> {
    return (this.recoveryExchange ??= this.verifyRecovery(code, tokenHash, denied));
  }

  private async verifyRecovery(
    code: string | null,
    tokenHash: string | null,
    denied: boolean,
  ): Promise<AccountResult> {
    const invalid: AccountResult = {
      ok: false,
      error: 'ลิงก์กู้คืนหมดอายุ ใช้ไปแล้ว หรือไม่สมบูรณ์ กรุณาขอลิงก์ใหม่',
    };
    await this.initialize();
    if (denied || !this.client || (code && tokenHash)) {
      this.clearRecovery();
      return invalid;
    }
    try {
      if (tokenHash) {
        const { data, error } = await this.client.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (error || !data.session) {
          this.clearRecovery();
          return invalid;
        }
        this.session.set(data.session);
        this.recoveryUser = data.session.user.id;
      } else if (code) {
        this.recoveryEventUser = null;
        const { data, error } = await this.client.auth.exchangeCodeForSession(code);
        if (error || !data.session || this.recoveryEventUser !== data.session.user.id) {
          this.clearRecovery();
          return invalid;
        }
        this.session.set(data.session);
        this.recoveryUser = data.session.user.id;
      } else {
        // A refresh may restore a previously verified recovery session, never just any login session.
        const expectedUser =
          this.recoveryUser ?? this.document.defaultView?.sessionStorage.getItem(AUTH_RECOVERY_KEY);
        if (!expectedUser) return invalid;
        const { data, error } = await this.client.auth.getUser();
        if (error || data.user?.id !== expectedUser) {
          this.clearRecovery();
          return invalid;
        }
        this.recoveryUser = expectedUser;
      }
      try {
        this.document.defaultView?.sessionStorage.setItem(AUTH_RECOVERY_KEY, this.recoveryUser!);
      } catch {
        /* The form still works without reload support. */
      }
      return { ok: true };
    } catch {
      this.clearRecovery();
      return invalid;
    }
  }

  async saveRecoveryPassword(password: string): Promise<AccountResult> {
    if (!this.recoveryUser || this.user()?.id !== this.recoveryUser)
      return { ok: false, error: 'กรุณาเปิดลิงก์กู้คืนจากอีเมลก่อนตั้งรหัสผ่าน' };
    const result = await this.setPassword(password);
    if (result.ok) {
      this.clearRecovery();
      this.recoveryExchange = undefined;
    }
    return result;
  }

  private clearRecovery(): void {
    this.recoveryUser = null;
    this.recoveryEventUser = null;
    this.recoveryExchange = undefined;
    try {
      this.document.defaultView?.sessionStorage.removeItem(AUTH_RECOVERY_KEY);
    } catch {
      /* Storage is optional. */
    }
  }
}
