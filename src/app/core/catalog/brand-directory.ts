import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, inject, signal } from '@angular/core';
import { AUTH_CONFIG } from '../auth/auth-client';

export interface CarBrand {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  logoUrl: string | null;
}
export type BrandScope = 'starter' | 'all';
interface BrandResponse {
  schemaVersion: number;
  scope: BrandScope;
  brands: CarBrand[];
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
}
const TTL = 60 * 60 * 1000;
export const BRAND_STORAGE = new InjectionToken<Storage | null>('BRAND_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});
export const BRAND_FETCH = new InjectionToken<typeof fetch>('BRAND_FETCH', {
  providedIn: 'root',
  factory:
    () =>
    (...args) =>
      fetch(...args),
});

@Injectable({ providedIn: 'root' })
export class BrandDirectory {
  private readonly loadConfig = inject(AUTH_CONFIG);
  private readonly storage = inject(BRAND_STORAGE);
  private readonly request = inject(BRAND_FETCH);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly memory = new Map<string, BrandResponse>();
  private readonly pending = new Map<string, Promise<BrandResponse>>();
  private generation = 0;
  readonly brands = signal<CarBrand[]>([]);
  readonly scope = signal<BrandScope>('starter');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly stale = signal(false);

  private valid(value: unknown, scope: BrandScope): value is BrandResponse {
    const data = value as BrandResponse;
    return (
      !!data &&
      data.schemaVersion === 1 &&
      data.scope === scope &&
      typeof data.stale === 'boolean' &&
      Number.isFinite(Date.parse(data.fetchedAt)) &&
      Number.isFinite(Date.parse(data.expiresAt)) &&
      Date.parse(data.expiresAt) >= Date.parse(data.fetchedAt) &&
      Date.parse(data.expiresAt) - Date.parse(data.fetchedAt) <= TTL &&
      Array.isArray(data.brands) &&
      data.brands.length > 0 &&
      data.brands.length <= 10000 &&
      new Set(data.brands.map((brand) => brand?.id)).size === data.brands.length &&
      data.brands.every(
        (brand) =>
          !!brand &&
          typeof brand.id === 'string' &&
          typeof brand.slug === 'string' &&
          typeof brand.name === 'string' &&
          Array.isArray(brand.aliases) &&
          brand.aliases.every((alias) => typeof alias === 'string') &&
          (brand.logoUrl === null ||
            (typeof brand.logoUrl === 'string' &&
              brand.logoUrl.startsWith(
                'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/',
              ))),
      )
    );
  }

  async load(scope: BrandScope = this.scope(), force = false): Promise<void> {
    if (!this.browser) return;
    const generation = ++this.generation;
    const changed = this.scope() !== scope;
    this.scope.set(scope);
    if (changed) this.brands.set([]);
    this.loading.set(true);
    this.error.set('');
    this.stale.set(false);
    let cached: BrandResponse | undefined;
    try {
      const config = await this.loadConfig();
      if (generation !== this.generation) return;
      const api = config.apiBaseUrl.replace(/\/$/, '');
      const key = `performante-lab.brands.v2-thailand:${api}:${config.supabaseUrl}:${scope}`;
      cached = this.memory.get(key);
      if (!cached) {
        try {
          const raw = this.storage?.getItem(key);
          const data: unknown = raw ? JSON.parse(raw) : null;
          if (this.valid(data, scope)) cached = data;
        } catch {
          /* A corrupted/blocked cache is replaced by a network response. */
        }
      }
      if (cached) this.brands.set(cached.brands);
      if (!force && cached && !cached.stale && Date.parse(cached.expiresAt) > Date.now()) {
        this.memory.set(key, cached);
        return;
      }
      let pending = this.pending.get(key);
      if (!pending) {
        pending = (async () => {
          const response = await this.request(`${api}/api/catalog/brands?scope=${scope}`, {
            cache: 'no-cache',
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error('catalog');
          const data: unknown = await response.json();
          if (!this.valid(data, scope)) throw new Error('invalid catalog');
          this.memory.set(key, data);
          try {
            this.storage?.setItem(key, JSON.stringify(data));
          } catch {
            /* Memory cache remains available. */
          }
          return data;
        })().finally(() => {
          this.pending.delete(key);
        });
        this.pending.set(key, pending);
      }
      const result = await pending;
      if (generation !== this.generation) return;
      this.brands.set(result.brands);
      this.stale.set(result.stale);
      if (result.stale)
        this.error.set('ใช้รายการที่เคยโหลดไว้ชั่วคราว เนื่องจากยังอัปเดตข้อมูลไม่ได้');
    } catch {
      if (generation === this.generation) {
        this.stale.set(!!cached);
        this.error.set(
          cached
            ? 'ใช้รายการที่เก็บไว้ชั่วคราว เชื่อมต่อเพื่ออัปเดตไม่ได้'
            : 'โหลดรายการยี่ห้อรถไม่ได้ กรุณาลองใหม่',
        );
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
