import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AUTH_CONFIG } from '../auth/auth-client';
import {
  StorageCatalogStore,
  storageCatalogData,
  validStorageCatalog,
  notifyStorageCatalogChanged,
} from './storage-catalog';
const response = () => ({
  schemaVersion: 1 as const,
  source: 'storage' as const,
  brands: [],
  cars: [],
  parts: [],
  fetchedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
describe('Shared Storage catalog cache', () => {
  beforeEach(() => {
    let mockStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => { mockStore[key] = String(val); },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { mockStore = {}; },
      length: 0,
      key: (i: number) => Object.keys(mockStore)[i] ?? null,
    };
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
        localStorage.clear();
      } else {
        vi.stubGlobal('localStorage', mockStorage);
      }
    } catch {
      vi.stubGlobal('localStorage', mockStorage);
    }
    storageCatalogData.set({ ...response(), fetchedAt: '' });
  });
  afterEach(() => vi.unstubAllGlobals());
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUTH_CONFIG,
          useValue: async () => ({
            apiBaseUrl: 'https://api.example.com',
            supabaseUrl: 'https://test.supabase.co',
          }),
        },
      ],
    });
    return TestBed.inject(StorageCatalogStore);
  }
  it('coalesces loads and reuses the shared and persistent cache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal('fetch', fetcher);
    const store = setup();
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(fetcher).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    await setup().load();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('forces a fresh Storage read after an Admin upload', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal('fetch', fetcher);
    const store = setup();
    await store.load();
    await store.invalidate();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('refresh=1');
  });
  it('retains cached data and reports an outage instead of injecting static sample cars', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal('fetch', fetcher);
    const store = setup();
    await store.load();
    fetcher.mockRejectedValue(new Error('offline'));
    await store.load(true);
    expect(store.stale()).toBe(true);
    expect(store.error()).toBeTruthy();
    expect(store.data().cars).toEqual([]);
  });
  it('rejects local asset URLs in persisted remote catalog data', () => {
    expect(
      validStorageCatalog({
        ...response(),
        brands: [{ id: 'Honda', name: 'Honda', aliases: [], logoUrl: 'assets/honda.png' }],
      }),
    ).toBe(false);
  });
});
