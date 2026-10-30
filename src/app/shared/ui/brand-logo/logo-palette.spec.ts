import { pickLogoBackdrop } from './logo-palette';

describe('Adaptive logo backdrop', () => {
  const rgb = (color: string) =>
    [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  it('uses a light plate for black marks and a dark plate for white marks', () => {
    expect(rgb(pickLogoBackdrop([0, 0, 0, 255])).every((channel) => channel > 220)).toBe(true);
    expect(rgb(pickLogoBackdrop([255, 255, 255, 255])).every((channel) => channel < 50)).toBe(true);
  });
  it('keeps both black and white parts visible using a middle tone', () => {
    const color = rgb(pickLogoBackdrop([0, 0, 0, 255, 255, 255, 255, 255]));
    expect(color.every((channel) => channel >= 100 && channel <= 135)).toBe(true);
  });
  it('tints the plate toward the logo color without reusing the bright logo color directly', () => {
    const color = rgb(pickLogoBackdrop([240, 20, 20, 255]));
    expect(color[0]).toBeGreaterThan(color[1]);
    expect(color[1]).toBe(color[2]);
    expect(color).not.toEqual([240, 20, 20]);
  });
  it('ignores transparent padding and falls back safely for empty images', () => {
    expect(pickLogoBackdrop([255, 0, 0, 0, 255, 255, 255, 255])).toBe(
      pickLogoBackdrop([255, 255, 255, 255]),
    );
    expect(pickLogoBackdrop([0, 0, 0, 0])).toBe('#737373');
    expect(pickLogoBackdrop([])).toBe('#737373');
  });
});
