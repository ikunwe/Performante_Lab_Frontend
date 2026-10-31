import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AUTH_CONFIG } from '../auth/auth-client';
import { BRAND_FETCH, BRAND_STORAGE, BrandDirectory } from './brand-directory';

describe('Brand directory cache', () => {
  let memory: Map<string, string>;
  let request: ReturnType<typeof vi.fn>;
  const payload = (scope = 'starter', name = 'Ferrari') => {
    const now = Date.now();
    return {
      schemaVersion: 1,
      scope,
      stale: false,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 3600000).toISOString(),
      brands: [
        { id: name.toLowerCase(), slug: name.toLowerCase(), name, aliases: [], logoUrl: null },
      ],
    };
  };
  beforeEach(() => {
    memory = new Map();
    request = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => payload(url.includes('scope=all') ? 'all' : 'starter'),
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
        {
          provide: BRAND_STORAGE,
          useValue: {
            getItem: (key: string) => memory.get(key) ?? null,
            setItem: (key: string, value: string) => memory.set(key, value),
          },
        },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('fetches once and reuses in-memory and persistent cache across service instances', async () => {
    const directory = TestBed.inject(BrandDirectory);
    await Promise.all([directory.load(), directory.load()]);
    expect(request).toHaveBeenCalledTimes(1);
    await directory.load();
    expect(request).toHaveBeenCalledTimes(1);
    const reloaded = TestBed.runInInjectionContext(() => new BrandDirectory());
    await reloaded.load();
    expect(request).toHaveBeenCalledTimes(1);
    expect(reloaded.brands()[0].name).toBe('Ferrari');
    expect([...memory.keys()][0]).toContain('https://api.example.com:https://project.supabase.co');
  });

  it('refreshes expired data and keeps stale data if the refresh fails', async () => {
    const directory = TestBed.inject(BrandDirectory);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await directory.load();
    vi.spyOn(Date, 'now').mockReturnValue(now + 3600001);
    request.mockRejectedValueOnce(new Error('offline'));
    await directory.load();
    expect(request).toHaveBeenCalledTimes(2);
    expect(directory.brands()[0].name).toBe('Ferrari');
    expect(directory.stale()).toBe(true);
    expect(directory.error()).toContain('ชั่วคราว');
  });

  it('caches scopes separately and permits manual retry without reusing expired response', async () => {
    const directory = TestBed.inject(BrandDirectory);
    await directory.load('starter');
    await directory.load('all');
    expect(request).toHaveBeenCalledTimes(2);
    await directory.load('starter');
    expect(request).toHaveBeenCalledTimes(2);
    await directory.load('starter', true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('ignores corrupt stored data and reports first-load failures', async () => {
    const directory = TestBed.inject(BrandDirectory);
    memory.set(
      'performante-lab.brands.v2-thailand:https://api.example.com:https://project.supabase.co:starter',
      '{invalid',
    );
    request.mockResolvedValueOnce({ ok: false });
    await directory.load();
    expect(directory.brands()).toEqual([]);
    expect(directory.error()).toContain('โหลดรายการ');
    expect(directory.loading()).toBe(false);
    await directory.load();
    expect(directory.brands()).toHaveLength(1);
  });

  it('keeps the selected scope when an older response arrives late', async () => {
    let finishStarter!: (response: unknown) => void;
    let finishAll!: (response: unknown) => void;
    request.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          if (url.includes('scope=all')) finishAll = resolve;
          else finishStarter = resolve;
        }),
    );
    const directory = TestBed.inject(BrandDirectory);
    const starter = directory.load('starter');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const all = directory.load('all');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    finishAll({ ok: true, json: async () => payload('all', 'Toyota') });
    await all;
    finishStarter({ ok: true, json: async () => payload('starter', 'Ferrari') });
    await starter;
    expect(directory.scope()).toBe('all');
    expect(directory.brands()[0].name).toBe('Toyota');
    expect(directory.loading()).toBe(false);
  });
});
