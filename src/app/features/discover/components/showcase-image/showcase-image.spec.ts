import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ShowcaseImage } from './showcase-image';
import { StorageCatalogStore, storageCatalogData } from '../../../../core/catalog/storage-catalog';
import { buildLayerPlan } from '../../../../core/catalog/build-layers';
import type { CatalogCar, CatalogPart } from '../../../catalog/catalog.data';

const car: CatalogCar = {
  id: 'storage-car:Honda/Civic',
  storagePath: 'Honda/Civic',
  name: 'Honda Civic FE',
  modelName: 'Civic FE',
  brand: 'Honda',
  body: '',
  image: 'stock',
  views: { front45: 'stock' },
};
const parts: CatalogPart[] = ['front', 'wheels', 'spoilers'].map((category) => ({
  id: 'storage-part:' + category,
  carId: car.id,
  category,
  name: category,
  finish: '',
  description: '',
  crop: 'full',
  views: { front45: category + '-photo' },
  ...(category === 'front'
    ? {}
    : { masks: { front45: category + '-mask' }, layerViews: { front45: category + '-cutout' } }),
}));
const build = {
  id: 'build',
  title: 'My Build',
  author: 'Other user',
  car: car.name,
  carId: car.id,
  partIds: parts.slice(0, 2).map((p) => p.id),
  parts: ['Front Bumper', 'Wheels'],
  category: 'Street',
  image: 'stock',
  budget: 0,
  isOwn: false,
  isPublic: true,
};

describe('Showcase saved build image', () => {
  const empty = storageCatalogData();
  afterEach(() => storageCatalogData.set(empty));
  it('resolves another user’s saved IDs after catalog loads and renders the same bumper and wheel plan as My Builds', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageCatalogStore, useValue: { load: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    storageCatalogData.set({ ...empty, cars: [], parts: [] });
    const fixture = TestBed.createComponent(ShowcaseImage);
    fixture.componentRef.setInput('build', build);
    fixture.detectChanges();
    expect(fixture.componentInstance.plan()).toBeNull();
    storageCatalogData.set({ ...empty, cars: [car], parts });
    expect(fixture.componentInstance.plan()).toEqual(
      buildLayerPlan(car, parts.slice(0, 2), 'front45'),
    );
    expect(fixture.componentInstance.plan()?.base).toBe('front-photo');
    expect(fixture.componentInstance.plan()?.layers).toEqual([
      { id: 'storage-part:wheels', image: 'wheels-cutout', mask: 'wheels-mask' },
    ]);
    fixture.componentRef.setInput('build', { ...build, partIds: [] });
    expect(fixture.componentInstance.plan()?.base).toBe('stock');
    expect(fixture.componentInstance.plan()?.layers).toEqual([]);
    fixture.destroy();
  });
  it('preserves legacy cover images when no saved part IDs are available', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageCatalogStore, useValue: { load: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    const fixture = TestBed.createComponent(ShowcaseImage);
    fixture.componentRef.setInput('build', {
      ...build,
      partIds: undefined,
      image: 'https://example.com/legacy.png',
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.plan()).toBeNull();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      'https://example.com/legacy.png',
    );
    fixture.destroy();
  });
});
