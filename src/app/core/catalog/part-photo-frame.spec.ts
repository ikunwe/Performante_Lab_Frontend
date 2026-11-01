import { solidPhotoFrame, alignedPhotoRect } from './part-photo-frame';
describe('Transparent part-photo framing', () => {
  it('ignores isolated speckles and translucent shadows when measuring vehicle bounds', () => {
    const w = 32,
      h = 16,
      pixels = new Uint8ClampedArray(w * h * 4);
    for (let y = 3; y < 13; y++) for (let x = 4; x < 27; x++) pixels[(y * w + x) * 4 + 3] = 255;
    pixels[3] = 255;
    for (let x = 0; x < w; x++) pixels[((h - 1) * w + x) * 4 + 3] = 120;
    expect(solidPhotoFrame(pixels, w, h)).toEqual({
      x: 4 / 32,
      y: 3 / 16,
      width: 23 / 32,
      height: 10 / 16,
    });
    expect(solidPhotoFrame(new Uint8ClampedArray(w * h * 4).fill(255), w, h)).toBeNull();
    expect(solidPhotoFrame(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull();
  });
  it('maps source vehicle bounds into the base frame and leaves opaque photos unregistered', () => {
    const source = { x: 0.05, y: 0.1, width: 0.9, height: 0.8 },
      target = { x: 0.1, y: 0.15, width: 0.8, height: 0.7 };
    const rect = alignedPhotoRect(source, target, 1800, 900);
    expect(rect.x + source.x * rect.width).toBeCloseTo(target.x * 1800);
    expect(rect.y + source.y * rect.height).toBeCloseTo(target.y * 900);
    expect(source.width * rect.width).toBeCloseTo(target.width * 1800);
    expect(source.height * rect.height).toBeCloseTo(target.height * 900);
    expect(alignedPhotoRect(null, target, 1800, 900)).toEqual({
      x: 0,
      y: 0,
      width: 1800,
      height: 900,
    });
  });
});
