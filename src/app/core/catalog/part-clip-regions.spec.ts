import { vi } from 'vitest';
import { automaticPartClips, hasAutomaticPartClips, paintPartClips } from './part-clip-regions';
import { buildLayerPlan } from './build-layers';
import { compositeBuild } from './composite-build';
import type { CatalogCar, CatalogPart } from '../../features/catalog/catalog.data';
const car: CatalogCar = {
  id: 'civic',
  storagePath: 'Hondaaaa/Civic-FE',
  modelName: 'Civic FE',
  name: 'Civic FE',
  brand: 'Hondaaaa',
  body: '',
  image: 'stock-f',
  views: { front45: 'stock-f', front: 'stock-front', rear45: 'stock-r', rear: 'stock-rear' },
};
const part = (category: string): CatalogPart => ({
  id: category,
  carId: car.id,
  name: category,
  category,
  crop: 'full',
  description: '',
  finish: '',
  views: {
    front45: category + '-f',
    front: category + '-front',
    rear45: category + '-r',
    rear: category + '-rear',
  },
});
describe('Automatic part clipping without uploaded masks', () => {
  it('keeps a stable default for spoiler alone or spoiler with wheels, and layers it last over a bumper', () => {
    const solo = buildLayerPlan(car, [part('spoilers')], 'front45');
    const together = buildLayerPlan(car, [part('wheels'), part('spoilers')], 'front45');
    expect(solo.base).toBe('stock-f');
    expect(together.base).toBe('stock-f');
    expect(together.layers.map((layer) => layer.id)).toEqual(['wheels', 'spoilers']);
    const bumper = buildLayerPlan(
      car,
      [part('front'), part('wheels'), part('spoilers')],
      'front45',
    );
    expect(bumper.base).toBe('front-f');
    expect(bumper.layers.at(-1)?.id).toBe('spoilers');
    expect(
      buildLayerPlan(car, [part('rear'), part('spoilers')], 'rear').layers.map((layer) => layer.id),
    ).toEqual(['spoilers']);
  });
  it('keeps the bumper and adds wheels/wing in stable order without fetching a mask', () => {
    const selected = ['spoilers', 'wheels', 'rear', 'front'].map(part);
    const front = buildLayerPlan(car, selected, 'front45');
    expect(front.base).toBe('front-f');
    expect(front.missing).toEqual([]);
    expect(front.layers.map((l) => l.id)).toEqual(['wheels', 'spoilers']);
    expect(front.layers.every((l) => !l.mask && !!l.regions?.length)).toBe(true);
    expect(front.layers[0].regions).toHaveLength(2);
    const rear = buildLayerPlan(car, selected, 'rear45');
    expect(rear.base).toBe('rear-r');
    expect(rear.layers.map((l) => l.id)).toEqual(['wheels', 'spoilers']);
    expect(buildLayerPlan(car, selected, 'front').layers).toEqual([]);
    expect(buildLayerPlan(car, selected, 'rear').layers.map((l) => l.id)).toEqual(['spoilers']);
    expect(buildLayerPlan(car, [...selected].reverse(), 'front45')).toEqual(front);
    expect(buildLayerPlan(car, [part('front')], 'front45').layers).toEqual([]);
  });
  it('does not invent missing angles or reuse Civic geometry on another model', () => {
    expect(hasAutomaticPartClips('Civic-FE')).toBe(true);
    expect(hasAutomaticPartClips('Accord')).toBe(false);
    expect(automaticPartClips({ ...car, modelName: 'Accord' }, 'wheels', 'front45')).toBeNull();
    const missing = { ...part('wheels'), views: { rear45: 'rear-only' } };
    expect(buildLayerPlan(car, [part('front'), missing], 'front45').missing).toEqual(['wheels']);
    expect(
      buildLayerPlan({ ...car, modelName: 'Accord' }, [part('front'), part('wheels')], 'front45')
        .missing,
    ).toEqual(['wheels']);
    const kit = buildLayerPlan(car, [part('bodykits'), part('wheels')], 'front45');
    expect(kit.base).toBe('bodykits-f');
    expect(kit.layers).toEqual([]);
  });
  it('uses an explicit corrected mask/aligned frame when one exists', () => {
    const wheel = {
      ...part('wheels'),
      masks: { front45: 'custom-mask' },
      layerViews: { front45: 'aligned-wheel' },
    };
    const plan = buildLayerPlan(car, [part('front'), wheel], 'front45');
    expect(plan.layers[0]).toEqual({ id: 'wheels', image: 'aligned-wheel', mask: 'custom-mask' });
  });
  it('paints two normalized wheel clips and rejects invalid regions', () => {
    const ctx = { beginPath: vi.fn(), ellipse: vi.fn(), fill: vi.fn() } as any;
    const clips = automaticPartClips(car, 'wheels', 'front45')!;
    paintPartClips(ctx, 1800, 900, clips);
    expect(ctx.ellipse).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(() => paintPartClips(ctx, 1800, 900, [])).toThrow();
    expect(() =>
      paintPartClips(ctx, 1800, 900, [{ kind: 'ellipse', cx: 0, cy: 0, rx: -1, ry: 1 }]),
    ).toThrow();
  });
  it('clips real layer plans without requesting mask files, scales matching aspect ratios and rejects incompatible frames', async () => {
    const loaded: string[] = [],
      ops: string[] = [];
    const context = () => ({
      globalCompositeOperation: 'source-over',
      clearRect: vi.fn(),
      createImageData: (width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(0) }),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      drawImage() {
        ops.push(this.globalCompositeOperation);
      },
    });
    const create = () =>
      ({ width: 0, height: 0, getContext: () => context() }) as unknown as HTMLCanvasElement;
    const load = async (url: string) => {
      loaded.push(url);
      return {
        naturalWidth: url.startsWith('front') ? 1800 : 900,
        naturalHeight: url.startsWith('front') ? 900 : 450,
      } as HTMLImageElement;
    };
    const plan = buildLayerPlan(car, [part('front'), part('wheels')], 'front45');
    await compositeBuild(plan, load, create);
    expect(loaded).toEqual(['front-f', 'wheels-f']);
    expect(ops).toContain('destination-out');
    expect(ops).toContain('destination-in');
    await expect(
      compositeBuild(
        plan,
        async (url) =>
          ({
            naturalWidth: 1800,
            naturalHeight: url === 'front-f' ? 900 : 1200,
          }) as HTMLImageElement,
        create,
      ),
    ).rejects.toThrow('สัดส่วนกรอบเท่า');
  });
});
