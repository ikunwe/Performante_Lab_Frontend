import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { AuthService } from '../../core/auth/auth.service';
import type { ShowcaseBuild } from './discover.data';
export const discoverRevision = signal(0);
export const invalidateDiscoverFeed = () => discoverRevision.update((value) => value + 1);
export const DISCOVER_FETCH = new InjectionToken<typeof fetch>('DISCOVER_FETCH', {
  providedIn: 'root',
  factory: () => fetch.bind(globalThis),
});
function validBuild(value: unknown): value is ShowcaseBuild {
  const row = value as ShowcaseBuild;
  return (
    !!row &&
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.author === 'string' &&
    typeof row.car === 'string' &&
    typeof row.image === 'string' &&
    typeof row.category === 'string' &&
    Number.isFinite(row.budget) &&
    typeof row.isOwn === 'boolean' &&
    typeof row.isPublic === 'boolean' &&
    Array.isArray(row.parts) &&
    row.parts.every((part) => typeof part === 'string')
  );
}
@Injectable({ providedIn: 'root' })
export class DiscoverFeedStore {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AUTH_CONFIG);
  private readonly request = inject(DISCOVER_FETCH);
  private owner: string | null | undefined;
  private version = 0;
  private controller?: AbortController;
  readonly builds = signal<ShowcaseBuild[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      untracked(() => this.switchOwner(owner));
    });
  }
  private switchOwner(owner: string | null): void {
    if (this.owner === owner) return;
    this.owner = owner;
    ++this.version;
    this.controller?.abort();
    this.builds.set([]);
    this.loading.set(false);
    this.error.set('');
  }
  async load(): Promise<void> {
    await this.auth.initialize();
    const owner = this.auth.user()?.id ?? null;
    this.switchOwner(owner);
    const version = ++this.version;
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    const current = () => version === this.version && (this.auth.user()?.id ?? null) === owner;
    this.loading.set(true);
    this.error.set('');
    try {
      const config = await this.config();
      let token: string | null = null;
      if (owner) {
        const session = await this.auth.apiSession();
        if (session.userId !== owner) throw new Error('account changed');
        token = session.accessToken;
      }
      if (!current()) return;
      const rows = new Map<string, ShowcaseBuild>();
      let offset: number | null = 0;
      while (offset !== null) {
        const response: Response = await this.request(
          config.apiBaseUrl.replace(/\/$/, '') + '/api/discover/builds?offset=' + offset,
          {
            headers: token ? { Authorization: 'Bearer ' + token } : {},
            cache: 'no-store',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
          },
        );
        if (!response.ok) throw new Error('feed unavailable');
        const page: { builds: unknown[]; nextOffset: number | null } = await response.json();
        if (
          !Array.isArray(page.builds) ||
          !page.builds.every(validBuild) ||
          (owner === null && page.builds.some((row: ShowcaseBuild) => row.isOwn)) ||
          (page.nextOffset !== null &&
            (!Number.isInteger(page.nextOffset) ||
              page.nextOffset <= offset ||
              page.nextOffset > 10000))
        )
          throw new Error('invalid feed');
        for (const row of page.builds) rows.set(row.id, row);
        if (!current()) return;
        offset = page.nextOffset;
      }
      if (current()) this.builds.set([...rows.values()]);
    } catch {
      if (current())
        this.error.set(
          this.builds().length
            ? 'อัปเดตรายการไม่ได้ กำลังแสดงข้อมูลล่าสุดที่โหลดสำเร็จ'
            : 'โหลดรายการ Build ไม่สำเร็จ กรุณาลองใหม่',
        );
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
