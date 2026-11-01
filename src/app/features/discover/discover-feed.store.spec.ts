import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { DiscoverFeedStore, DISCOVER_FETCH } from './discover-feed.store';
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
  it('loads public and own private database records across pages using the current session', async () => {
    const { store, request } = setup();
    request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ builds: [row('public')], nextOffset: 100 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ builds: [row('mine', true, false)], nextOffset: null }),
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
      json: async () => ({ builds: [row('private-b', true, false)], nextOffset: null }),
    });
    await store.load();
    done({
      ok: true,
      json: async () => ({ builds: [row('private-a', true, false)], nextOffset: null }),
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
      json: async () => ({ builds: [row('mine', true, false)], nextOffset: null }),
    });
    await store.load();
    request.mockResolvedValueOnce({ ok: false });
    await store.load();
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
    expect(store.builds()[0].id).toBe('mine');
  });
});
