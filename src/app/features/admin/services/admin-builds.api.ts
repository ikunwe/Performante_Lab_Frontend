import { Injectable, InjectionToken, inject } from '@angular/core';
import { AUTH_CONFIG } from '../../../core/auth/auth-client';
import { AuthService } from '../../../core/auth/auth.service';
import type { ShowcaseBuild } from '../../discover/discover.data';
export const ADMIN_BUILDS_FETCH = new InjectionToken<typeof fetch>('ADMIN_BUILDS_FETCH', {
  providedIn: 'root',
  factory: () => fetch.bind(globalThis),
});
@Injectable({ providedIn: 'root' })
export class AdminBuildsApi {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AUTH_CONFIG);
  private readonly fetch = inject(ADMIN_BUILDS_FETCH);
  private async call<T>(owner: string, path: string, method = 'GET'): Promise<T> {
    const session = await this.auth.apiSession(),
      config = await this.config();
    if (session.userId !== owner || this.auth.user()?.id !== owner)
      throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้านี้ใหม่');
    const response = await this.fetch(
      config.apiBaseUrl.replace(/\/$/, '') + '/api/admin/builds' + path,
      {
        method,
        headers: { Authorization: 'Bearer ' + session.accessToken },
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      },
    );
    if (this.auth.user()?.id !== owner) throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้านี้ใหม่');
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.message || 'โหลดหรือจัดการ Build ไม่สำเร็จ กรุณาตรวจ backend และสิทธิ์ Admin',
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  async list(): Promise<ShowcaseBuild[]> {
    const owner = this.auth.user()?.id;
    if (!owner) throw new Error('กรุณาเข้าสู่ระบบก่อนโหลด Build');
    const rows: ShowcaseBuild[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { builds: ShowcaseBuild[]; nextOffset: number | null } = await this.call(
        owner,
        '?offset=' + offset,
      );
      if (
        !Array.isArray(page.builds) ||
        (page.nextOffset !== null &&
          (!Number.isInteger(page.nextOffset) ||
            page.nextOffset <= offset ||
            page.nextOffset > 10000))
      )
        throw new Error('ข้อมูล Build ที่ได้รับไม่ถูกต้อง');
      rows.push(...page.builds);
      offset = page.nextOffset;
    }
    return rows;
  }
  remove(id: string): Promise<void> {
    const owner = this.auth.user()?.id;
    if (!owner) return Promise.reject(new Error('กรุณาเข้าสู่ระบบใหม่'));
    return this.call(owner, '/' + encodeURIComponent(id), 'DELETE');
  }
}
