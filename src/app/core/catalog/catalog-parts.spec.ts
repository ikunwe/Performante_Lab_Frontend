import { partsForCar } from './catalog-parts';
import { storageCatalogData } from './storage-catalog';
import { seedCatalogFixture } from '../../testing/storage-catalog.fixture';
describe('Parts from the shared cloud catalog', () => {
  beforeEach(() => seedCatalogFixture());
  it('returns only current parts for the selected car', () => {
    const car = storageCatalogData().cars[0];
    expect(partsForCar(car)).toEqual(storageCatalogData().parts.filter((p) => p.carId === car.id));
    expect(partsForCar(null)).toEqual([]);
  });
  it('does not invent prepared local parts for old reference snapshots', () => {
    const car = { ...storageCatalogData().cars[0], id: 'ref:honda:civic' };
    expect(partsForCar(car)).toEqual([]);
  });
});
