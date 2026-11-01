import {
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import type { ShowcaseBuild } from '../discover/discover.data';
import { DiscoverFeedStore, discoverRevision, validBuild } from '../discover/discover-feed.store';
export const LIKES_FETCH = new InjectionToken<typeof fetch>('LIKES_FETCH', {
  providedIn: 'root',
  factory: () => fetch.bind(globalThis),
});
@Injectable({ providedIn: 'root' })
export class LikesStore {
  private readonly auth = inject(AuthService);
  private readonly feed = inject(DiscoverFeedStore);
  private readonly config = inject(AUTH_CONFIG);
  private readonly fetch = inject(LIKES_FETCH);
  private owner: string | null | undefined;
  private generation = 0;
  private expires = 0;
  private revision = -1;
  private pending?: { owner: string; revision: number; promise: Promise<void> };
  readonly builds = signal<ShowcaseBuild[]>([]);
  readonly ids = computed(() => new Set(this.builds().map((build) => build.id)));
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly busyIds = signal<string[]>([]);
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      untracked(() => this.switchOwner(owner));
    });
  }
  private switchOwner(owner: string | null): void {
    if (this.owner === owner) return;
    this.owner = owner;
    ++this.generation;
    this.expires = 0;
    this.revision = -1;
    this.pending = undefined;
    this.builds.set([]);
    this.busyIds.set([]);
    this.error.set('');
    this.loading.set(false);
    this.loaded.set(!owner);
  }
  private async call<T>(owner: string, path: string, method = 'GET'): Promise<T> {
    const session = await this.auth.apiSession();
    const config = await this.config();
    if (session.userId !== owner || this.auth.user()?.id !== owner)
      throw new Error('บัญชีเปลี่ยนแล้ว');
    const response = await this.fetch(config.apiBaseUrl.replace(/\/$/, '') + '/api/likes' + path, {
      method,
      headers: { Authorization: 'Bearer ' + session.accessToken },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (this.auth.user()?.id !== owner) throw new Error('บัญชีเปลี่ยนแล้ว');
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || 'โหลดหรือบันทึก Like ไม่สำเร็จ');
    }
    return response.json();
  }
  async load(force = false): Promise<void> {
    await this.auth.initialize();
    const owner = this.auth.user()?.id ?? null;
    this.switchOwner(owner);
    if (!owner || this.busyIds().length) return;
    const revision = discoverRevision();
    if (!force && this.loaded() && Date.now() < this.expires && this.revision === revision) return;
    if (this.pending?.owner === owner && this.pending.revision === revision)
      return this.pending.promise;
    const generation = ++this.generation;
    const promise = this.fetchBuilds(owner, generation, revision);
    this.pending = { owner, revision, promise };
    try {
      await promise;
    } finally {
      if (this.pending?.promise === promise) this.pending = undefined;
    }
  }
  private async fetchBuilds(owner: string, generation: number, revision: number): Promise<void> {
    const current = () => this.auth.user()?.id === owner && generation === this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const rows = new Map<string, ShowcaseBuild>();
      let offset: number | null = 0;
      while (offset !== null) {
        const page: { builds: ShowcaseBuild[]; nextOffset: number | null } = await this.call(
          owner,
          '/builds?offset=' + offset,
        );
        if (!current()) return;
        if (
          !Array.isArray(page.builds) ||
          !page.builds.every(validBuild) ||
          (page.nextOffset !== null &&
            (!Number.isInteger(page.nextOffset) ||
              page.nextOffset <= offset ||
              page.nextOffset > 10000))
        )
          throw new Error('ข้อมูล Liked ไม่ถูกต้อง');
        for (const build of page.builds) if (build.isPublic) rows.set(build.id, build);
        offset = page.nextOffset;
      }
      if (current()) {
        this.builds.set([...rows.values()]);
        this.loaded.set(true);
        this.expires = Date.now() + 5 * 60 * 1000;
        this.revision = revision;
      }
    } catch (error) {
      if (current()) {
        this.expires = 0;
        this.error.set(error instanceof Error ? error.message : 'โหลด Liked ไม่สำเร็จ');
      }
    } finally {
      if (current()) this.loading.set(false);
    }
  }
  private setCount(id: string, likes: number): void {
    this.feed.setLikeCount(id, likes);
    this.builds.update((rows) => rows.map((row) => (row.id === id ? { ...row, likes } : row)));
  }
  async toggle(build: ShowcaseBuild): Promise<{ ok: boolean; error?: string }> {
    await this.auth.initialize();
    const owner = this.auth.user()?.id ?? null;
    this.switchOwner(owner);
    if (!owner) return { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนกด Like' };
    if (this.loading() || !this.loaded() || this.busyIds().includes(build.id))
      return { ok: false, error: 'กำลังโหลดหรือบันทึก Like กรุณารอสักครู่' };
    if (!build.isPublic) return { ok: false, error: 'กด Like ได้เฉพาะ Build สาธารณะ' };
    const mutationRevision = discoverRevision();
    const generation = this.generation,
      liked = !this.ids().has(build.id);
    const previousIndex = this.builds().findIndex((row) => row.id === build.id);
    const previousBuild = this.builds()[previousIndex];
    const previousCount = Math.max(0, build.likes ?? previousBuild?.likes ?? 0);
    const nextCount = Math.max(0, previousCount + (liked ? 1 : -1));
    this.builds.update((rows) =>
      liked
        ? [{ ...build, likes: nextCount }, ...rows.filter((row) => row.id !== build.id)]
        : rows.filter((row) => row.id !== build.id),
    );
    this.setCount(build.id, nextCount);
    this.busyIds.update((ids) => [...ids, build.id]);
    this.error.set('');
    try {
      const result = await this.call<{ buildId: string; liked: boolean; likes: number }>(
        owner,
        '/' + encodeURIComponent(build.id),
        liked ? 'PUT' : 'DELETE',
      );
      if (this.auth.user()?.id !== owner || this.generation !== generation)
        return { ok: false, error: 'บัญชีเปลี่ยนแล้ว' };
      if (
        result.buildId !== build.id ||
        result.liked !== liked ||
        !Number.isInteger(result.likes) ||
        result.likes < 0
      )
        throw new Error('ข้อมูล Like ที่ได้รับไม่ถูกต้อง');
      this.setCount(build.id, result.likes);
      if (mutationRevision !== discoverRevision()) {
        this.expires = 0;
        return { ok: true };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึก Like ไม่สำเร็จ';
      if (this.auth.user()?.id === owner && this.generation === generation) {
        if (mutationRevision === discoverRevision()) {
          this.builds.update((rows) => {
            const restored = rows.filter((row) => row.id !== build.id);
            if (!liked && previousBuild)
              restored.splice(Math.min(previousIndex, restored.length), 0, previousBuild);
            return restored;
          });
          this.setCount(build.id, previousCount);
        }
        this.error.set(message);
      }
      return { ok: false, error: message };
    } finally {
      if (this.auth.user()?.id === owner) {
        this.busyIds.update((ids) => ids.filter((id) => id !== build.id));
        if (!this.busyIds().length && this.revision !== discoverRevision()) void this.load(true);
      }
    }
  }
  forget(id: string): void {
    this.builds.update((rows) => rows.filter((row) => row.id !== id));
  }
}
