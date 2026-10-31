import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StorageCatalogStore, storageCatalogData } from './storage-catalog';
import { BrandDirectory } from './brand-directory';
import { vi } from 'vitest';
describe('Storage brand directory', () => {
  it('uses Storage brands and forwards force refresh without the old brand allowlist', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageCatalogStore,
          useValue: {
            data: storageCatalogData,
            load,
            loading: signal(false),
            error: signal(''),
            stale: signal(false),
          },
        },
      ],
    });
    storageCatalogData.update((d) => ({
      ...d,
      brands: [{ id: 'Custom', name: 'Custom', slug: 'Custom', aliases: [], logoUrl: null }],
    }));
    const directory = TestBed.inject(BrandDirectory);
    await directory.load('all', true);
    expect(directory.brands()[0].id).toBe('Custom');
    expect(load).toHaveBeenCalledWith(true);
  });
});
