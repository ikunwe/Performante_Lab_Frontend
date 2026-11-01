import { modelImage } from './car-images';
import { storageCatalogData } from './storage-catalog';
describe('Cloud model images', () => {
  const original = storageCatalogData();
  afterEach(() => storageCatalogData.set(original));
  it('uses the exact uploaded URL and its version, without a brand/model asset fallback', () => {
    const url =
      'https://test.supabase.co/storage/v1/object/public/catalog/Honda/Civic/45_front.png?v=123';
    storageCatalogData.update((data) => ({
      ...data,
      cars: [
        {
          id: 'storage-car:civic',
          storagePath: 'Honda/Civic',
          modelName: 'Civic',
          brand: 'Honda',
          name: 'Honda Civic',
          image: url,
          body: '',
        },
      ],
    }));
    expect(modelImage('Honda', 'Civic')).toBe(url);
    expect(modelImage('Honda', 'Civic Type R')).toBeNull();
    expect(modelImage('Toyota', 'Civic')).toBeNull();
  });
  it('keeps missing photos empty rather than substituting a local demo', () => {
    storageCatalogData.update((data) => ({ ...data, cars: [] }));
    expect(modelImage('Honda', 'Civic')).toBeNull();
  });
});
