import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StorageCatalogStore, storageCatalogData } from './storage-catalog';
import { ModelDirectory } from './model-directory';
describe('Storage model directory', () => {
  it('selects only models in the current Storage brand folder', async () => {
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
    storageCatalogData.update((d) => ({
      ...d,
      cars: [
        {
          id: 'storage-car:test',
          storagePath: 'Honda/Civic-FE',
          modelName: 'Civic FE',
          brand: 'Honda',
          name: 'Honda Civic FE',
          image: 'https://example.com/car.png',
          body: '',
        },
      ],
    }));
    const directory = TestBed.inject(ModelDirectory);
    await directory.load('Honda');
    expect(directory.models()[0].id).toBe('storage-car:test');
    await directory.load('Toyota');
    expect(directory.models()).toEqual([]);
  });
});
