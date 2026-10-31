import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AUTH_CONFIG } from '../auth/auth-client';
import { BRAND_FETCH, BRAND_STORAGE } from './brand-directory';
import { ModelDirectory, validModelResponse } from './model-directory';

const response = (brandId: string) => {
  const now = Date.now();
  return { schemaVersion: 2, brandId, stale: false, fetchedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString(), models: [{ id: brandId + ':model', brandId, name: 'Civic', sourceUrl: 'https://example.com' }] };
};
describe('ModelDirectory', () => {
  let storage: Storage;
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    const memory = new Map<string, string>();
    storage = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      get length() {
        return memory.size;
      },
    };
    request = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => response(new URL(url).searchParams.get('brandId')!),
    }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUTH_CONFIG,
          useValue: async () => ({
            apiBaseUrl: 'https://api.example.com',
            supabaseUrl: 'https://project.supabase.co',
          }),
        },
        { provide: BRAND_FETCH, useValue: request },
        { provide: BRAND_STORAGE, useValue: storage },
      ],
    });
  });
  it('coalesces requests, caches per brand and reuses persisted data after recreation', async () => {
    const directory = TestBed.inject(ModelDirectory);
    await Promise.all([directory.load('honda'), directory.load('honda')]);
    expect(request).toHaveBeenCalledTimes(1);
    await directory.load('toyota');
    await directory.load('honda');
    expect(request).toHaveBeenCalledTimes(2);
    const recreated = TestBed.runInInjectionContext(() => new ModelDirectory());
    await recreated.load('honda');
    expect(request).toHaveBeenCalledTimes(2);
    expect(recreated.models()[0].brandId).toBe('honda');
  });
  it('keeps the selected brand when an older request resolves late', async () => {
    let finish: (value: unknown) => void = () => {};
    request.mockImplementation((url: string) =>
      url.includes('honda')
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ ok: true, json: async () => response('toyota') }),
    );
    const directory = TestBed.inject(ModelDirectory);
    const older = directory.load('honda');
    await Promise.resolve();
    await directory.load('toyota');
    finish({ ok: true, json: async () => response('honda') });
    await older;
    expect(directory.brandId()).toBe('toyota');
    expect(directory.models()[0].brandId).toBe('toyota');
  });
  it('uses previous models on refresh failure and rejects corrupt/foreign cached models', async () => {
    const directory = TestBed.inject(ModelDirectory);
    await directory.load('honda');
    request.mockRejectedValue(new Error('offline'));
    await directory.load('honda', true);
    expect(directory.stale()).toBe(true);
    expect(directory.models().length).toBe(1);
    expect(directory.loading()).toBe(false);
    expect(validModelResponse(response('toyota'), 'honda')).toBe(false);
    const corrupt = response('honda');
    corrupt.models[0].sourceUrl = 'javascript:invalid';
    expect(validModelResponse(corrupt, 'honda')).toBe(false);
  });
});
