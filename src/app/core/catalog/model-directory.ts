import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { AUTH_CONFIG } from '../auth/auth-client';
import { BRAND_FETCH, BRAND_STORAGE } from './brand-directory';

export interface VehicleGeneration {
  id: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  bodyType: string | null;
  chassisCodes: string[];
  chassisSourceUrl: string | null;
}
export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  sourceUrl: string;
  generations: VehicleGeneration[];
}
interface ModelRecord { id: string; brandId: string; name: string; sourceUrl: string; }
const hydrateModels = (models: ModelRecord[]): VehicleModel[] => models.map(model => ({ ...model, yearStart: null, yearEnd: null, generations: [] }));
interface ModelResponse {
  schemaVersion: number;
  brandId: string;
  models: ModelRecord[];
  stale: boolean;
  fetchedAt: string;
  expiresAt: string;
}
export function validModelResponse(value: unknown, brandId: string): value is ModelResponse {
  const data = value as ModelResponse;
  return !!data && data.schemaVersion === 2 && data.brandId === brandId && typeof data.stale === 'boolean' &&
    Number.isFinite(Date.parse(data.fetchedAt)) && Number.isFinite(Date.parse(data.expiresAt)) &&
    Date.parse(data.expiresAt) >= Date.parse(data.fetchedAt) && Date.parse(data.expiresAt) - Date.parse(data.fetchedAt) <= 3600000 &&
    Array.isArray(data.models) && data.models.length <= 2000 && new Set(data.models.map(model => model?.id)).size === data.models.length &&
    data.models.every(model => !!model && typeof model.id === 'string' && model.id.startsWith(brandId + ':') && model.brandId === brandId &&
      typeof model.name === 'string' && !!model.name.trim() && typeof model.sourceUrl === 'string' && model.sourceUrl.startsWith('https://') &&
      !('generations' in model) && !('yearStart' in model) && !('yearEnd' in model));
}
@Injectable({ providedIn: 'root' })
export class ModelDirectory {
  private readonly config = inject(AUTH_CONFIG);
  private readonly request = inject(BRAND_FETCH);
  private readonly storage = inject(BRAND_STORAGE);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly memory = new Map<string, ModelResponse>();
  private readonly pending = new Map<string, Promise<ModelResponse>>();
  private generation = 0;
  readonly brandId = signal<string | null>(null);
  readonly models = signal<VehicleModel[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly stale = signal(false);
  readonly exportUrl = signal('');

  async load(brandId: string, force = false): Promise<void> {
    if (!this.browser) return;
    const generation = ++this.generation;
    if (brandId !== this.brandId()) this.models.set([]);
    this.brandId.set(brandId);
    this.loading.set(true);
    this.error.set('');
    this.stale.set(false);
    let cached: ModelResponse | undefined;
    try {
      const config = await this.config();
      if (generation !== this.generation) return;
      const api = config.apiBaseUrl.replace(/\/$/, '');
      this.exportUrl.set(new URL(`${api}/api/catalog/models/export`, this.document.baseURI).href);
      const key = `performante-lab.models.v2-names:${api}:${config.supabaseUrl}:${brandId}`;
      try {
        this.storage?.removeItem(`performante-lab.models.v1:${api}:${config.supabaseUrl}:${brandId}`);
      } catch { /* Blocked storage does not prevent memory caching. */ }
      cached = this.memory.get(key);
      if (!cached) {
        try {
          const raw = this.storage?.getItem(key);
          const data: unknown = raw ? JSON.parse(raw) : null;
          if (validModelResponse(data, brandId)) cached = data;
        } catch {
          /* Storage may be blocked. */
        }
      }
      if (cached) this.models.set(hydrateModels(cached.models));
      if (!force && cached && !cached.stale && Date.parse(cached.expiresAt) > Date.now()) {
        this.memory.set(key, cached);
        return;
      }
      let pending = this.pending.get(key);
      if (!pending) {
        pending = (async () => {
          const response = await this.request(
            `${api}/api/catalog/models?brandId=${encodeURIComponent(brandId)}`,
            { cache: 'no-cache', signal: AbortSignal.timeout(20000) },
          );
          if (!response.ok) throw new Error('models');
          const data: unknown = await response.json();
          if (!validModelResponse(data, brandId)) throw new Error('invalid models');
          this.memory.set(key, data);
          try {
            this.storage?.setItem(key, JSON.stringify(data));
          } catch {
            /* Memory remains usable. */
          }
          return data;
        })().finally(() => this.pending.delete(key));
        this.pending.set(key, pending);
      }
      const result = await pending;
      if (generation !== this.generation) return;
      this.models.set(hydrateModels(result.models));
      this.stale.set(result.stale);
      if (result.stale)
        this.error.set('ใช้ข้อมูลรุ่นที่เคยโหลดไว้ชั่วคราว เนื่องจากยังอัปเดตไม่ได้');
    } catch {
      if (generation === this.generation) {
        this.stale.set(!!cached);
        this.error.set(
          cached
            ? 'ใช้ข้อมูลรุ่นที่เก็บไว้ชั่วคราว เชื่อมต่อเพื่ออัปเดตไม่ได้'
            : 'โหลดรายการรุ่นรถไม่ได้ กรุณาลองใหม่',
        );
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
