import { viewsForCar } from './car-views';
import type { CatalogCar } from '../../features/catalog/catalog.data';

describe('Storage vehicle views', () => {
  it('does not request removed local view files from a historical snapshot', () => {
    const car: CatalogCar = {
      id: 'old',
      brand: 'Honda',
      name: 'Civic',
      body: '',
      image: '',
      views: { front45: 'assets/ListCar_view/Honda/civic/default/45_front.png' },
    };
    expect(viewsForCar(car)).toEqual([]);
  });
  it('uses remote Admin angles in the view selector without local assets', () => {
    const car: CatalogCar = {
      id: 'storage-car:test',
      storagePath: 'Honda/Civic',
      brand: 'Honda',
      name: 'Civic',
      body: '',
      image: 'https://storage/cover.png',
      views: {
        rear: 'https://storage/Back.png',
        front45: 'https://storage/45_front.jpg',
        front: 'https://storage/front.png',
        rear45: 'https://storage/45_Back.png',
      },
    };
    const views = viewsForCar(car);
    expect(views.map((v) => v.view)).toEqual(['front45', 'front', 'rear45', 'rear']);
    expect(views[0].url).toBe(car.views!.front45);
    expect(views[0].label).toContain('45');
  });
  it('keeps a legacy single-cover Storage car usable without inventing additional views', () => {
    expect(
      viewsForCar({
        id: 'storage-car:test',
        storagePath: 'Honda/Civic',
        brand: 'Honda',
        name: 'Civic',
        body: '',
        image: 'https://storage/CarPicture.png',
      }),
    ).toEqual([]);
  });
});
