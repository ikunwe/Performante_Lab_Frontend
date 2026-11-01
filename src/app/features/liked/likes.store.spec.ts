import { DiscoverFeedStore } from '../discover/discover-feed.store';
import { invalidateDiscoverFeed } from '../discover/discover-feed.store';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_CONFIG } from '../../core/auth/auth-client';
import { LikesStore, LIKES_FETCH } from './likes.store';
const build = {
  id: 'build-1',
  title: 'Civic',
  car: 'Honda Civic',
  author: 'Driver',
  image: 'https://test/car.png',
  parts: [],
  budget: 0,
  category: 'Street',
  isPublic: true,
  isOwn: false,
};
function setup() {
  const request = vi.fn();
  const auth = {
    user: signal<{ id: string } | null>({ id: 'a' }),
    initialize: vi.fn().mockResolvedValue(undefined),
    apiSession: vi.fn(async () => ({ userId: auth.user()?.id, accessToken: 'token' })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: LIKES_FETCH, useValue: request },
      { provide: AuthService, useValue: auth },
      { provide: AUTH_CONFIG, useValue: async () => ({ apiBaseUrl: 'https://api.test' }) },
    ],
  });
  return { store: TestBed.inject(LikesStore), request, auth };
}
const page = (builds: (typeof build)[]) =>
  new Response(JSON.stringify({ builds, nextOffset: null }));
describe('Persistent account Likes', () => {
  it('loads liked builds from the backend, reuses cache and unlikes immediately while the server confirms', async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce(page([build]));
    await store.load();
    await store.load();
    expect(request).toHaveBeenCalledOnce();
    expect(store.ids().has(build.id)).toBe(true);
    let done!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const pending = store.toggle(build);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(store.ids().has(build.id)).toBe(false);
    expect(store.busyIds()).toContain(build.id);
    expect((await store.toggle(build)).ok).toBe(false);
    done(new Response(JSON.stringify({ buildId: build.id, liked: false, likes: 0 })));
    await pending;
    expect(request.mock.calls[1][1].method).toBe('DELETE');
    expect(store.builds()).toEqual([]);
  });
  it('persists a Like, keeps state on failures and reloads it after a fresh store instance', async () => {
    const { store, request, auth } = setup();
    request.mockResolvedValueOnce(page([]));
    await store.load();
    request.mockResolvedValueOnce(
      new Response(JSON.stringify({ buildId: build.id, liked: true, likes: 1 })),
    );
    expect((await store.toggle(build)).ok).toBe(true);
    expect(request.mock.calls[1][1].method).toBe('PUT');
    request.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'offline' }), { status: 503 }),
    );
    expect((await store.toggle(build)).ok).toBe(false);
    expect(store.ids().has(build.id)).toBe(true);
    TestBed.resetTestingModule();
    const next = setup();
    next.request.mockResolvedValueOnce(page([build]));
    await next.store.load();
    expect(next.store.ids().has(build.id)).toBe(true);
  });
  it('ignores late mutations after account changes and never keeps the previous account list', async () => {
    const { store, request, auth } = setup();
    request.mockResolvedValueOnce(page([]));
    await store.load();
    let done!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const pending = store.toggle(build);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    auth.user.set({ id: 'b' });
    request.mockResolvedValueOnce(page([]));
    await store.load();
    done(new Response(JSON.stringify({ buildId: build.id, liked: true, likes: 1 })));
    expect((await pending).ok).toBe(false);
    expect(store.builds()).toEqual([]);
    auth.user.set(null);
    TestBed.tick();
    expect(store.ids().size).toBe(0);
  });
  it('reloads visibility changes received during a Like instead of resurrecting a removed card', async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce(page([]));
    await store.load();
    let done!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const pending = store.toggle(build);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    invalidateDiscoverFeed();
    request.mockResolvedValueOnce(page([]));
    done(new Response(JSON.stringify({ buildId: build.id, liked: true, likes: 1 })));
    await pending;
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(store.builds()).toEqual([]);
  });
  it('shows a Like immediately and rolls back only the failed build when another Like succeeds', async () => {
    const { store, request } = setup();
    request.mockResolvedValueOnce(page([]));
    await store.load();
    let fail!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          fail = resolve;
        }),
    );
    const pending = store.toggle(build);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(store.ids().has(build.id)).toBe(true);
    const other = { ...build, id: 'build-2' };
    request.mockResolvedValueOnce(
      new Response(JSON.stringify({ buildId: other.id, liked: true, likes: 1 })),
    );
    await store.toggle(other);
    fail(new Response(JSON.stringify({ message: 'offline' }), { status: 503 }));
    await pending;
    expect(store.ids().has(build.id)).toBe(false);
    expect(store.ids().has(other.id)).toBe(true);
  });
  it('updates totals immediately in Discover and Liked, reconciles server counts and rolls back errors', async () => {
    const { store, request } = setup();
    TestBed.tick();
    const feed = TestBed.inject(DiscoverFeedStore),
      counted = { ...build, likes: 7 };
    feed.builds.set([counted]);
    request.mockResolvedValueOnce(page([]));
    await store.load();
    let done!: (response: Response) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const pending = store.toggle(counted);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(feed.builds()[0].likes).toBe(8);
    expect(store.builds()[0].likes).toBe(8);
    done(new Response(JSON.stringify({ buildId: build.id, liked: true, likes: 10 })));
    await pending;
    expect(feed.builds()[0].likes).toBe(10);
    expect(store.builds()[0].likes).toBe(10);
    request.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'offline' }), { status: 503 }),
    );
    await store.toggle(store.builds()[0]);
    expect(feed.builds()[0].likes).toBe(10);
    expect(store.builds()[0].likes).toBe(10);
  });
});
