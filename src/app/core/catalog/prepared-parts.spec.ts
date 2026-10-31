import { CatalogCar, CatalogPart } from '../../features/catalog/catalog.data';
import { CarViewEntry, CarViewId } from './car-view-manifest';
import { resolvePreparedView, resolvePreparedViewState } from './prepared-parts';

const car: CatalogCar = { id: 'ref:honda:civic', brand: 'Honda', name: 'Civic', image: '', body: '',
  reference: { brandId: 'honda', modelId: 'honda:civic', generationId: null, modelName: 'Civic', generationName: null,
    chassisCodes: [], yearStart: null, yearEnd: null, sourceUrl: 'https://example.com' } };
const part = (category: string, name: string): CatalogPart => ({ id: name, carId: car.id, category, name,
  previewImage: name + '-cover.png', crop: 'full', description: '', finish: '' });
const front = part('front', 'Front Bumper 1');
const rear = part('rear', 'Rear Bumper 1');
const entries: CarViewEntry[] = [
  ['frontbumper1', 'front45'], ['frontbumper1', 'front'], ['rearbumper1', 'rear45'], ['rearbumper1', 'rear'],
].map(([variant, view]) => ({ brandId: 'honda', model: 'civic', variant, view: view as CarViewId, url: variant + '/' + view + '.png' }));

describe('Prepared bumper views', () => {
  it('keeps front and rear independent when both are selected', () => {
    for (const view of ['front45', 'front'] as const) {
      expect(resolvePreparedView(car, [front, rear], view, entries)).toBe('frontbumper1/' + view + '.png');
      expect(resolvePreparedView(car, [rear], view, entries)).toBeNull();
    }
    for (const view of ['rear45', 'rear'] as const) {
      expect(resolvePreparedView(car, [front, rear], view, entries)).toBe('rearbumper1/' + view + '.png');
      expect(resolvePreparedView(car, [front], view, entries)).toBeNull();
    }
    expect(resolvePreparedView(car, [front, rear], 'side', entries)).toBeNull();
  });
  it('falls back to the matching cover angle without borrowing another variant or model', () => {
    const second = part('rear', 'Rear Bumper 2');
    expect(resolvePreparedView(car, [front, second], 'rear45', entries)).toBe(second.previewImage);
    expect(resolvePreparedView(car, [front, second], 'rear', entries)).toBeNull();
    expect(resolvePreparedView(car, [second], 'front45', entries)).toBeNull();
    expect(resolvePreparedView({ ...car, reference: { ...car.reference!, modelName: 'Accord' } }, [front], 'front', entries)).toBeNull();
  });
  it('resolves wheels alone and together with the bumper for each 45 degree view', () => {
    const wheel = part('wheels', 'Wheel 1');
    const combinations: CarViewEntry[] = [
      ...entries,
      ...[['default', 'front45'], ['default', 'rear45'], ['frontbumper1', 'front45'], ['rearbumper1', 'rear45']]
        .map(([variant, view]) => ({ brandId: 'honda', model: 'civic', variant, wheelVariant: 'wheel1', view: view as CarViewId,
          url: variant + '/wheel1/' + view + '.png' })),
    ];
    expect(resolvePreparedView(car, [wheel], 'front45', combinations)).toBe('default/wheel1/front45.png');
    expect(resolvePreparedView(car, [wheel], 'rear45', combinations)).toBe('default/wheel1/rear45.png');
    expect(resolvePreparedView(car, [front, rear, wheel], 'front45', combinations)).toBe('frontbumper1/wheel1/front45.png');
    expect(resolvePreparedView(car, [front, rear, wheel], 'rear45', combinations)).toBe('rearbumper1/wheel1/rear45.png');
    expect(resolvePreparedView(car, [front, rear, wheel], 'front', combinations)).toBe('frontbumper1/front.png');
    expect(resolvePreparedView(car, [front, rear, wheel], 'rear', combinations)).toBe('rearbumper1/rear.png');
    expect(resolvePreparedView(car, [wheel], 'front', combinations)).toBeNull();
    expect(resolvePreparedView(car, [wheel], 'rear', combinations)).toBeNull();
    expect(resolvePreparedView(car, [front, rear], 'front45', combinations)).toBe('frontbumper1/front45.png');
    expect(resolvePreparedView(car, [front, rear], 'rear45', combinations)).toBe('rearbumper1/rear45.png');
  });
  it('retains the selected bumper when a wheel combination is missing and reports the omission', () => {
    const wheel = part('wheels', 'Wheel 2');
    const state = resolvePreparedViewState(car, [front, wheel], 'front45', entries);
    expect(state).toEqual({ image: 'frontbumper1/front45.png', missing: [wheel.id] });
    expect(resolvePreparedViewState(car, [front, wheel], 'rear45', entries)).toEqual({ image: null, missing: [wheel.id] });
    expect(resolvePreparedViewState(car, [wheel], 'rear', entries)).toEqual({ image: null, missing: [] });
  });
  it('uses spoiler pictures at supported angles without affecting the straight front view', () => {
    const spoiler = part('spoilers', 'Spoilers 1');
    const variants: CarViewEntry[] = [
      ...entries,
      ...[['default', 'front45'], ['default', 'rear45'], ['default', 'rear'], ['frontbumper1', 'front45'], ['rearbumper1', 'rear45'], ['rearbumper1', 'rear']]
        .map(([variant, view]) => ({ brandId: 'honda', model: 'civic', variant, spoilerVariant: 'spoiler1', view: view as CarViewId,
          url: variant + '/spoiler1/' + view + '.png' })),
    ];
    for (const view of ['front45', 'rear45', 'rear'] as const) {
      expect(resolvePreparedView(car, [spoiler], view, variants)).toBe('default/spoiler1/' + view + '.png');
    }
    expect(resolvePreparedView(car, [spoiler], 'front', variants)).toBeNull();
    expect(resolvePreparedView(car, [front, rear, spoiler], 'front45', variants)).toBe('frontbumper1/spoiler1/front45.png');
    expect(resolvePreparedView(car, [front, rear, spoiler], 'rear', variants)).toBe('rearbumper1/spoiler1/rear.png');
    expect(resolvePreparedView(car, [front, rear, spoiler], 'front', variants)).toBe('frontbumper1/front.png');
    expect(resolvePreparedView(car, [front, rear], 'rear45', variants)).toBe('rearbumper1/rear45.png');
  });
  it('reports missing wheel/spoiler combinations and uses a complete image when provided', () => {
    const wheel = part('wheels', 'Wheel 1');
    const spoiler = part('spoilers', 'Spoilers 1');
    const spoilerOnly: CarViewEntry = { brandId: 'honda', model: 'civic', variant: 'rearbumper1', spoilerVariant: 'spoiler1', view: 'rear45', url: 'rear-with-spoiler.png' };
    expect(resolvePreparedViewState(car, [rear, wheel, spoiler], 'rear45', [...entries, spoilerOnly]))
      .toEqual({ image: spoilerOnly.url, missing: [wheel.id] });
    const combined: CarViewEntry = { ...spoilerOnly, wheelVariant: 'wheel1', url: 'rear-with-wheels-and-spoiler.png' };
    expect(resolvePreparedViewState(car, [rear, wheel, spoiler], 'rear45', [...entries, spoilerOnly, combined]))
      .toEqual({ image: combined.url, missing: [] });
    expect(resolvePreparedView(car, [rear, wheel], 'rear45', [combined])).toBe(rear.previewImage);
    expect(resolvePreparedView(car, [spoiler], 'rear45', [])).toBe(spoiler.previewImage);
  });
});
