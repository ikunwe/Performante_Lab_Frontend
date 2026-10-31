import { Injectable, InjectionToken, computed, inject } from '@angular/core';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { AuthService } from '../../core/auth/auth.service';
import type { SavedBuild } from './builds.store';
import type { CatalogCar } from '../catalog/catalog.data';

export const BUILD_FETCH = new InjectionToken<typeof fetch>('BUILD_FETCH', {
  providedIn: 'root',
  factory: () => fetch.bind(globalThis),
});
export interface BuildInput {
  id?: string;
  name: string;
  carId: string;
  partIds: string[];
  carSnapshot?: CatalogCar;
}
@Injectable({ providedIn: 'root' })
export class BuildsApi {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AUTH_CONFIG);
  private readonly fetch = inject(BUILD_FETCH);
  readonly owner = computed(() => this.auth.user()?.id ?? null);
  initialize() {
    return this.auth.initialize();
  }
  private async request<T>(
    owner: string,
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    const session = await this.auth.apiSession().catch(() => {
      throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน My Builds');
    });
    if (session.userId !== owner) throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลด My Builds ใหม่');
    const config = await this.config();
    if (this.owner() !== owner) throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลด My Builds ใหม่');
    let response: Response;
    try {
      response = await this.fetch(config.apiBaseUrl.replace(/\/$/, '') + '/api/builds' + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('เชื่อมต่อ Backend ไม่สำเร็จ กรุณาลองใหม่ รายการแต่งยังอยู่');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.message ??
          (response.status === 401
            ? 'กรุณาเข้าสู่ระบบใหม่'
            : 'บันทึกหรือโหลด Build ไม่สำเร็จ กรุณาลองใหม่'),
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  async list(owner: string): Promise<SavedBuild[]> {
    const builds: SavedBuild[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { builds: SavedBuild[]; nextOffset: number | null } = await this.request(
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
      builds.push(...page.builds);
      offset = page.nextOffset;
    }
    return builds;
  }
  async save(owner: string, input: BuildInput, createId: string): Promise<SavedBuild> {
    const { carSnapshot: _snapshot, ...value } = input; // The API reconstructs canonical car details itself.
    const data = input.id
      ? await this.request<{ build: SavedBuild }>(
          owner,
          '/' + encodeURIComponent(input.id),
          'PUT',
          value,
        )
      : await this.request<{ build: SavedBuild }>(owner, '', 'POST', { ...value, id: createId });
    return data.build;
  }
  remove(owner: string, id: string): Promise<void> {
    return this.request(owner, '/' + encodeURIComponent(id), 'DELETE');
  }
}
