import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_CONFIG } from '../auth/auth-client';
import type { CatalogCar, CatalogPart } from '../../features/catalog/catalog.data';
export interface StorageCatalogBrand {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  logoUrl: string | null;
}
export interface StorageCatalogData {
  schemaVersion: 1;
  source: 'storage';
  brands: StorageCatalogBrand[];
  cars: CatalogCar[];
  parts: CatalogPart[];
  fetchedAt: string;
  expiresAt: string;
}
export const storageCatalogData = signal<StorageCatalogData>({
  schemaVersion: 1,
  source: 'storage',
  brands: [],
  cars: [],
  parts: [],
  fetchedAt: '',
  expiresAt: '',
});
const PREFIX = 'performante.storage-catalog.v1:';
const CHANGED = 'performante-storage-catalog-changed';
const TTL = 5 * 60 * 1000;
export function notifyStorageCatalogChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(window.localStorage))
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
  } catch {
    /* Browser storage is optional. */
  }
  window.dispatchEvent(new Event(CHANGED));
}
export function validStorageCatalog(value: unknown): value is StorageCatalogData {
  const data = value as StorageCatalogData;
  const image = (value: unknown) =>
    typeof value === 'string' &&
    /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/catalog\//.test(value);
  return (
    !!data &&
    data.schemaVersion === 1 &&
    data.source === 'storage' &&
    Number.isFinite(Date.parse(data.fetchedAt)) &&
    Number.isFinite(Date.parse(data.expiresAt)) &&
    Array.isArray(data.brands) &&
    Array.isArray(data.cars) &&
    Array.isArray(data.parts) &&
    data.brands.every(
      (b) =>
        typeof b.id === 'string' &&
        typeof b.name === 'string' &&
        Array.isArray(b.aliases) &&
        (b.logoUrl === null || image(b.logoUrl)),
    ) &&
    data.cars.every(
      (c) =>
        typeof c.id === 'string' &&
        c.id.startsWith('storage-car:') &&
        typeof c.storagePath === 'string' &&
        typeof c.name === 'string' &&
        image(c.image),
    ) &&
    data.parts.every(
      (p) =>
        typeof p.id === 'string' &&
        p.id.startsWith('storage-part:') &&
        data.cars.some((c) => c.id === p.carId) &&
        typeof p.name === 'string' &&
        typeof p.category === 'string' &&
        image(p.previewImage),
    )
  );
}
@Injectable({ providedIn: 'root' })
export class StorageCatalogStore {
  private readonly config = inject(AUTH_CONFIG);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private pending?: Promise<void>;
  private key = '';
  private expires = 0;
  private epoch = 0;
  readonly data = storageCatalogData.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly stale = signal(false);
  constructor() {
    const destroy = inject(DestroyRef);
    if (this.browser) {
      const changed = () => {
        void this.invalidate();
      };
      const otherTab = (event: StorageEvent) => {
        if (event.key === this.key && event.newValue === null) changed();
      };
      window.addEventListener(CHANGED, changed);
      window.addEventListener('storage', otherTab);
      destroy.onDestroy(() => {
        window.removeEventListener(CHANGED, changed);
        window.removeEventListener('storage', otherTab);
      });
    }
  }
  load(force = false): Promise<void> {
    if (!this.browser) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.refresh(force).finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async refresh(force: boolean): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const epoch = this.epoch;
    try {
      const config = await this.config();
      const key = PREFIX + config.supabaseUrl + ':' + config.apiBaseUrl;
      if (this.key !== key) {
        this.key = key;
        this.expires = 0;
        storageCatalogData.set({
          schemaVersion: 1,
          source: 'storage',
          brands: [],
          cars: [],
          parts: [],
          fetchedAt: '',
          expiresAt: '',
        });
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (validStorageCatalog(cached?.data)) {
            storageCatalogData.set(cached.data);
            const expires = Number(cached.expires);
            this.expires = Number.isFinite(expires) && expires <= Date.now() + TTL ? expires : 0;
          }
        } catch {
          /* Memory cache remains available. */
        }
      }
      if (!force && this.expires > Date.now()) return;
      const response = await fetch(
        config.apiBaseUrl.replace(/\/$/, '') + '/api/catalog/storage' + (force ? '?refresh=1' : ''),
        { cache: 'no-cache', signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok) throw new Error('catalog');
      const data: unknown = await response.json();
      if (!validStorageCatalog(data)) throw new Error('invalid catalog');
      if (epoch !== this.epoch) return;
      storageCatalogData.set(data);
      this.expires = Date.now() + TTL;
      this.stale.set(false);
      try {
        localStorage.setItem(key, JSON.stringify({ data, expires: this.expires }));
      } catch {
        /* Quota can be full. */
      }
    } catch {
      if (epoch === this.epoch) {
        this.stale.set(!!storageCatalogData().fetchedAt);
        this.error.set(
          this.stale()
            ? 'ใช้ข้อมูลที่เคยโหลดไว้ชั่วคราว อัปเดตรายการไม่ได้'
            : 'โหลดข้อมูลรถไม่ได้ กรุณาลองใหม่',
        );
      }
    } finally {
      this.loading.set(false);
    }
  }
  async invalidate(): Promise<void> {
    ++this.epoch;
    this.expires = 0;
    if (this.pending) await this.pending;
    await this.load(true);
  }
}
