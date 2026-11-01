import {
  fitWheelEdge,
  wheelEdgeScore,
  wheelMaskAlpha,
  PhotoPixels,
  WheelPatch,
} from './wheel-photo-alignment';
function tire(cx = 0.53, cy = 0.55, rx = 0.16, ry = 0.3): PhotoPixels {
  const width = 120,
    height = 80,
    data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot((x / width - cx) / rx, (y / height - cy) / ry),
        i = (y * width + x) * 4;
      if (distance < 1) data[i] = data[i + 1] = data[i + 2] = 24;
    }
  return { data, width, height };
}
describe('Wheel-local image alignment', () => {
  it('aligns a wheel by its sidewall rather than stretching the car around a changed bumper', () => {
    const image = tire(),
      seed = { kind: 'ellipse' as const, cx: 0.5, cy: 0.53, rx: 0.18, ry: 0.33 };
    const fit = fitWheelEdge(image, seed);
    expect(wheelEdgeScore(image, fit)).toBeGreaterThan(wheelEdgeScore(image, seed));
    expect(Math.abs(fit.cx - 0.53)).toBeLessThan(0.025);
    expect(Math.abs(fit.cy - 0.55)).toBeLessThan(0.035);
    expect(fitWheelEdge(image, seed)).toBe(fit);
  });
  it('keeps flat low-contrast content at its calibrated position', () => {
    const image = tire();
    image.data.fill(255);
    const seed = { kind: 'ellipse' as const, cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.3 };
    expect(fitWheelEdge(image, seed)).toEqual(seed);
  });
  it('protects plain body panels but keeps bright spokes and dark sidewalls replaceable', () => {
    const ellipse = { kind: 'ellipse' as const, cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.3 };
    const patch: WheelPatch = { source: ellipse, target: ellipse };
    const body = tire();
    body.data.fill(255);
    expect(wheelMaskAlpha(body, body, patch, 0.5, 0.5)).toBe(0);
    const before = tire(0.5, 0.5, 0.2, 0.3),
      after = tire(0.5, 0.5, 0.2, 0.3);
    // A narrow light spoke surrounded by dark tire/rim pixels remains part of the new wheel.
    const center = (40 * 120 + 60) * 4;
    after.data[center] = after.data[center + 1] = after.data[center + 2] = 240;
    expect(wheelMaskAlpha(before, after, patch, 0.5, 0.5)).toBe(1);
    expect(wheelMaskAlpha(before, after, patch, 0.5, 0.77)).toBeGreaterThan(0.9);
    expect(wheelMaskAlpha(before, after, patch, 0.99, 0.5)).toBe(0);
  });
});
