import { seedCatalogFixture } from '../../testing/storage-catalog.fixture';
import { StorageCatalogStore, storageCatalogData } from '../../core/catalog/storage-catalog';
beforeEach(() => {
  seedCatalogFixture(false);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: StorageCatalogStore,
        useValue: {
          data: storageCatalogData,
          load: async () => {},
          loading: signal(false),
          error: signal(''),
          stale: signal(false),
        },
      },
    ],
  });
});
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BuildsStore, SavedBuild } from './builds.store';
import { BuildsApi } from './builds.api';

const row = (id: string): SavedBuild => ({
  id,
  name: id,
  carId: 'f8-tributo',
  partIds: [],
  createdAt: '2026-10-31T00:00:00Z',
  updatedAt: '2026-10-31T00:00:00Z',
});
describe('Account-scoped cloud builds', () => {
  function setup() {
    const api = {
      owner: signal<string | null>('account-a'),
      initialize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      remove: vi.fn(),
      setVisibility: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: BuildsApi, useValue: api }] });
    return { api, store: TestBed.inject(BuildsStore) };
  }
  it('clears the old account list and ignores in-flight results after account changes', async () => {
    const { api, store } = setup();
    await store.load();
    store.builds.set([row('private-a')]);
    let resolve!: (rows: SavedBuild[]) => void;
    api.list.mockImplementationOnce(
      () =>
        new Promise<SavedBuild[]>((done) => {
          resolve = done;
        }),
    );
    const old = store.load();
    api.owner.set('account-b');
    await store.load();
    expect(store.builds()).toEqual([]);
    resolve([row('private-a')]);
    await old;
    expect(store.builds()).toEqual([]);
    api.owner.set(null);
    await store.load();
    expect(store.builds()).toEqual([]);
  });
  it('retains a create ID across a timeout retry and blocks concurrent saves', async () => {
    const { api, store } = setup();
    await store.load();
    let fail!: (error: Error) => void;
    api.save.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const draft = { name: 'Retry me', carId: 'f8-tributo', partIds: [] };
    const first = store.save(draft);
    expect(store.saving()).toBe(true);
    expect((await store.save(draft)).ok).toBe(false);
    fail(new Error('timeout'));
    expect((await first).ok).toBe(false);
    expect(store.builds()).toEqual([]);
    const id = api.save.mock.calls[0][2];
    api.save.mockResolvedValueOnce(row(id));
    expect((await store.save(draft)).ok).toBe(true);
    expect(api.save.mock.calls[1][2]).toBe(id);
    expect(store.builds()).toHaveLength(1);
    expect(store.saving()).toBe(false);
  });
  it('waits for visibility confirmation, blocks duplicates and retains the old flag after errors', async () => {
    const { api, store } = setup();
    await store.load();
    store.builds.set([{ ...row('one'), isPublic: false }]);
    let reject!: (error: Error) => void;
    api.setVisibility.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = store.setVisibility('one', true);
    expect(store.saving()).toBe(true);
    expect(store.builds()[0].isPublic).toBe(false);
    expect((await store.setVisibility('one', true)).ok).toBe(false);
    reject(new Error('offline'));
    expect((await pending).ok).toBe(false);
    expect(store.builds()[0].isPublic).toBe(false);
    api.setVisibility.mockResolvedValueOnce({
      id: 'one',
      isPublic: true,
      updatedAt: new Date().toISOString(),
    });
    expect((await store.setVisibility('one', true)).ok).toBe(true);
    expect(store.builds()[0].isPublic).toBe(true);
  });
  it('ignores a visibility response after an account switch', async () => {
    const { api, store } = setup();
    await store.load();
    store.builds.set([row('one')]);
    let done!: (result: unknown) => void;
    api.setVisibility.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const pending = store.setVisibility('one', true);
    api.owner.set('account-b');
    await store.load();
    done({ id: 'one', isPublic: true, updatedAt: new Date().toISOString() });
    expect((await pending).ok).toBe(false);
    expect(store.builds()).toEqual([]);
  });
});
