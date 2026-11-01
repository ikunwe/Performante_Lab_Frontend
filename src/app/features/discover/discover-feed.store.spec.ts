import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { DiscoverFeedStore, DISCOVER_FETCH, invalidateDiscoverFeed } from './discover-feed.store';
const row = (id: string, isOwn = false, isPublic = true) => ({
  id,
  title: id,
  author: 'driver',
  car: 'Honda Civic',
  category: 'Street',
  image: 'https://example.com/car.png',
  budget: 0,
  parts: [],
  isOwn,
  isPublic,
});
function setup(owner: string | null = 'a') {
  const auth = {
    user: signal(owner ? { id: owner } : null),
    initialize: vi.fn().mockResolvedValue(undefined),
    apiSession: vi.fn(async () => ({
      userId: auth.user()?.id,
      accessToken: 'token-' + auth.user()?.id,
    })),
  };
  const request = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: AUTH_CONFIG, useValue: async () => ({ apiBaseUrl: 'https://api.example.com' }) },
      { provide: DISCOVER_FETCH, useValue: request },
    ],
  });
  return { auth, request, store: TestBed.inject(DiscoverFeedStore) };
}
describe('Database Discover feed', () => {
  afterEach(() => vi.restoreAllMocks());
  it('loads public records, including own public builds, across pages using the current session', async () => {
    const { store, request } = setup();
    request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ builds: [row('public')], nextOffset: 100 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ builds: [row('mine', true, true)], nextOffset: null }),
      });
    await store.load();
    expect(store.builds().map((b) => b.id)).toEqual(['public', 'mine']);
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer token-a');
    expect(request.mock.calls[1][0]).toContain('offset=100');
    expect(request.mock.calls[0][1].cache).toBe('no-store');
  });
  it('does not request session credentials for public browsing', async () => {
    const { store, request, auth } = setup(null);
    request.mockResolvedValue({
      ok: true,
      json: async () => ({ builds: [row('public')], nextOffset: null }),
    });
    await store.load();
    expect(auth.apiSession).not.toHaveBeenCalled();
    expect(request.mock.calls[0][1].headers).toEqual({});
  });
  it('discards late results after an account switch and clears private state on logout', async () => {
    const { store, request, auth } = setup();
    let done!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const first = store.load();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    auth.user.set({ id: 'b' });
    request.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ builds: [row('private-b', true, true)], nextOffset: null }),
    });
    await store.load();
    done({
      ok: true,
      json: async () => ({ builds: [row('private-a', true, true)], nextOffset: null }),
    });
    await first;
    expect(store.builds().map((b) => b.id)).toEqual(['private-b']);
    auth.user.set(null);
    TestBed.tick();
    expect(store.builds()).toEqual([]);
  });
  it('reports errors and retains only the current account last successful data', async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ builds: [row('mine', true, true)], nextOffset: null }),
    });
    await store.load();
    request.mockResolvedValueOnce({ ok: false });
    await store.load(true);
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
    expect(store.builds()[0].id).toBe('mine');
  });
  it('reuses the in-memory snapshot on navigation, including empty results, and refreshes on expiry or mutation', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { store, request } = setup();
    request.mockResolvedValue({ ok: true, json: async () => ({ builds: [], nextOffset: null }) });
    await store.load();
    await store.load();
    expect(request).toHaveBeenCalledOnce();
    expect(store.loading()).toBe(false);
    now += 5 * 60 * 1000 + 1;
    await store.load();
    expect(request).toHaveBeenCalledTimes(2);
    invalidateDiscoverFeed();
    await store.load();
    expect(request).toHaveBeenCalledTimes(3);
    await store.load(true);
    expect(request).toHaveBeenCalledTimes(4);
  });
  it('shares concurrent refreshes instead of aborting and starting the same request repeatedly', async () => {
    const { store, request } = setup();
    let done!: (response: unknown) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const first = store.load();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const second = store.load(true);
    await Promise.resolve();
    expect(request).toHaveBeenCalledOnce();
    done({ ok: true, json: async () => ({ builds: [row('public')], nextOffset: null }) });
    await Promise.all([first, second]);
    expect(store.builds()[0].id).toBe('public');
  });
  it('filters private records from an older backend response, including own private builds', async () => {
    const {store,request}=setup();
    request.mockResolvedValue({ok:true,json:async()=>({builds:[row('public'),row('own-public',true,true),row('private',true,false)],nextOffset:null})});
    await store.load();
    expect(store.builds().map(b=>b.id)).toEqual(['public','own-public']);
  });

});
