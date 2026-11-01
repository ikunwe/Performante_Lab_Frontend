import { buildLayerPlan } from './build-layers';
import { compositeBuild, validateAlphaMask } from './composite-build';
import type { CatalogCar, CatalogPart } from '../../features/catalog/catalog.data';
import { vi } from 'vitest';
const car: CatalogCar = {
  id: 'car',
  storagePath: 'Honda/Civic',
  name: 'Civic',
  brand: 'Honda',
  body: '',
  image: 'base',
  views: { front45: 'base', front: 'front', rear45: 'rear45', rear: 'rear' },
};
function part(category: string, mask = true): CatalogPart {
  return {
    id: category,
    carId: car.id,
    category,
    name: category,
    finish: '',
    crop: 'full',
    description: '',
    views: {
      front45: category + '-f45',
      front: category + '-front',
      rear45: category + '-r45',
      rear: category + '-rear',
    },
    masks: mask
      ? {
          front45: 'mask-' + category,
          front: 'mask-front-' + category,
          rear45: 'mask-r45-' + category,
          rear: 'mask-rear-' + category,
        }
      : undefined,
  };
}
describe('Full-car photo layers', () => {
  it('composes only the relevant categories for each angle and uses stable order', () => {
    const selected = ['spoilers', 'rear', 'wheels', 'front'].map((c) => part(c));
    expect(buildLayerPlan(car, selected, 'front45').layers.map((l) => l.id)).toEqual([
      'front',
      'wheels',
      'spoilers',
    ]);
    expect(buildLayerPlan(car, selected, 'front').layers.map((l) => l.id)).toEqual(['front']);
    expect(buildLayerPlan(car, selected, 'rear45').layers.map((l) => l.id)).toEqual([
      'rear',
      'wheels',
      'spoilers',
    ]);
    expect(buildLayerPlan(car, selected, 'rear').layers.map((l) => l.id)).toEqual([
      'rear',
      'spoilers',
    ]);
    expect(buildLayerPlan(car, [...selected].reverse(), 'front45')).toEqual(
      buildLayerPlan(car, selected, 'front45'),
    );
  });
  it('uses one unmasked photo and reports missing presets for unconfigured models', () => {
    const plan = buildLayerPlan(
      { ...car, modelName: 'Unknown model' },
      [part('front', false), part('wheels', false), part('spoilers')],
      'front45',
    );
    const aligned = { ...part('wheels'), layerViews: { front45: 'aligned-wheels' } };
    expect(buildLayerPlan(car, [aligned], 'front45').layers[0].image).toBe('aligned-wheels');
    expect(plan.base).toBe('front-f45');
    expect(plan.layers.map((p) => p.id)).toEqual(['spoilers']);
    expect(plan.missing).toEqual(['wheels']);
    expect(buildLayerPlan(car, [part('front', false)], 'rear').selected).toBe(false);
  });
  it('does not borrow another angle, ignores other cars and makes full kits exclusive', () => {
    const wheel = { ...part('wheels'), views: { rear45: 'wheel-rear' } };
    expect(buildLayerPlan(car, [wheel], 'front45').missing).toEqual(['wheels']);
    expect(buildLayerPlan(car, [{ ...part('front'), carId: 'other' }], 'front').layers).toEqual([]);
    const plan = buildLayerPlan(car, [part('front'), part('bodykits', false)], 'front45');
    expect(plan.base).toBe('bodykits-f45');
    expect(plan.layers).toEqual([]);
    expect(plan.missing).toEqual([]);
    expect(buildLayerPlan(car, [], 'front45')).toEqual({
      base: 'base',
      layers: [],
      missing: [],
      selected: false,
    });
  });
  it('rejects opaque black/white or empty masks, preserves partial alpha edges', () => {
    expect(() =>
      validateAlphaMask(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])),
    ).toThrow();
    expect(() => validateAlphaMask(new Uint8ClampedArray([0, 0, 0, 0]))).toThrow();
    expect(() =>
      validateAlphaMask(new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 128])),
    ).not.toThrow();
  });
  it('clears the old part then draws only the masked replacement, rejecting misaligned canvas sizes', async () => {
    const events: string[] = [];
    const ctx = () => ({
      globalCompositeOperation: 'source-over',
      drawImage() {
        events.push(this.globalCompositeOperation);
      },
      clearRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]) }),
    });
    const create = () =>
      ({ width: 0, height: 0, getContext: () => ctx() }) as unknown as HTMLCanvasElement;
    const load = async () => ({ naturalWidth: 1200, naturalHeight: 600 }) as HTMLImageElement;
    const plan = buildLayerPlan(car, [part('front')], 'front45');
    const result = await compositeBuild(plan, load, create);
    expect(result.width).toBe(1200);
    expect(events).toEqual([
      'source-over',
      'source-over',
      'destination-out',
      'source-over',
      'destination-in',
      'source-over',
    ]);
    await expect(
      compositeBuild(
        plan,
        async (url) =>
          ({
            naturalWidth: url === 'base' ? 600 : 1200,
            naturalHeight: url === 'base' ? 300 : 600,
          }) as HTMLImageElement,
        create,
      ),
    ).resolves.toMatchObject({ width: 600, height: 300 });
    await expect(
      compositeBuild(
        plan,
        async (url) =>
          ({ naturalWidth: url === 'base' ? 1200 : 1000, naturalHeight: 600 }) as HTMLImageElement,
        create,
      ),
    ).rejects.toThrow('ขนาดกรอบเท่ากัน');
    await expect(
      compositeBuild(
        plan,
        async () => {
          throw new Error('offline');
        },
        create,
      ),
    ).rejects.toThrow('offline');
  });
});
