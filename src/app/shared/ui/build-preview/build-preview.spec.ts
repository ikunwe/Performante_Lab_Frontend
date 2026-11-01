import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BuildPreview, BUILD_COMPOSITOR } from './build-preview';
import type { BuildLayerPlan } from '../../../core/catalog/build-layers';
const mocks = { compose: vi.fn() };
const plan = (base: string): BuildLayerPlan => ({
  base,
  layers: [{ id: 'front', image: 'photo-' + base, mask: 'mask-' + base }],
  missing: [],
  selected: true,
});
describe('Build preview asynchronous frames', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: BUILD_COMPOSITOR, useValue: mocks.compose }],
    }),
  );
  afterEach(() => vi.restoreAllMocks());
  it('does not let a slow previous selection overwrite the latest frame', async () => {
    let old!: (canvas: HTMLCanvasElement) => void, newer!: (canvas: HTMLCanvasElement) => void;
    mocks.compose
      .mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => (old = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (newer = resolve)));
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw } as any);
    const fixture = TestBed.createComponent(BuildPreview);
    fixture.componentRef.setInput('plan', plan('old'));
    fixture.detectChanges();
    fixture.componentRef.setInput('plan', plan('new'));
    fixture.detectChanges();
    const current = document.createElement('canvas');
    current.width = 900;
    current.height = 450;
    newer(current);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(draw).toHaveBeenCalledOnce();
    expect(draw.mock.calls[0][0]).toBe(current);
    old(document.createElement('canvas'));
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(draw).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.ready()).toBe(true);
    fixture.destroy();
  });
  it('keeps the base and surfaces loading errors instead of showing partial layers', async () => {
    mocks.compose.mockReset().mockRejectedValue(new Error('mask unavailable'));
    const fixture = TestBed.createComponent(BuildPreview);
    fixture.componentRef.setInput('plan', plan('stock'));
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('stock');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'mask unavailable',
    );
    fixture.destroy();
  });
});
