import type { PartClipRegion } from './part-clip-regions';
import { alignedPhotoRect, photoFrame } from './part-photo-frame';
type Ellipse = Extract<PartClipRegion, { kind: 'ellipse' }>;
export interface PhotoPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
export interface WheelPatch {
  source: Ellipse;
  target: Ellipse;
}
const samples = new WeakMap<HTMLImageElement, PhotoPixels>();
const fits = new WeakMap<PhotoPixels, Map<string, Ellipse>>();
function sample(image: HTMLImageElement, create: () => HTMLCanvasElement): PhotoPixels {
  let result = samples.get(image);
  if (result) return result;
  const canvas = create();
  canvas.width = 512;
  canvas.height = Math.max(1, Math.round((512 * image.naturalHeight) / image.naturalWidth));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('อ่านตำแหน่งล้อไม่สำเร็จ');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  result = {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
  samples.set(image, result);
  return result;
}
function pixel(p: PhotoPixels, x: number, y: number): { light: number; alpha: number } {
  const px = Math.round(x * p.width),
    py = Math.round(y * p.height);
  if (px < 0 || py < 0 || px >= p.width || py >= p.height) return { light: 255, alpha: 0 };
  const i = (py * p.width + px) * 4,
    alpha = (p.data[i + 3] || 0) / 255;
  const light =
    0.2126 * (p.data[i] || 0) + 0.7152 * (p.data[i + 1] || 0) + 0.0722 * (p.data[i + 2] || 0);
  return { light: light * alpha + 255 * (1 - alpha), alpha };
}
/** Match the dark sidewall edge, never the changing wheel spokes or whole car silhouette. */
export function wheelEdgeScore(p: PhotoPixels, e: Ellipse): number {
  let score = 0;
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI * 2) / 40,
      dx = Math.cos(a) * e.rx,
      dy = Math.sin(a) * e.ry;
    const inner = pixel(p, e.cx + dx * 0.9, e.cy + dy * 0.9),
      outer = pixel(p, e.cx + dx * 1.04, e.cy + dy * 1.04);
    score +=
      ((outer.light - inner.light) / 255) * 0.8 + inner.alpha * (1 - inner.light / 255) * 0.2;
    if (inner.alpha < 0.75) score -= 0.5;
  }
  return score / 40;
}
export function fitWheelEdge(p: PhotoPixels, seed: Ellipse): Ellipse {
  let cache = fits.get(p);
  if (!cache) {
    cache = new Map();
    fits.set(p, cache);
  }
  const key = [seed.cx, seed.cy, seed.rx, seed.ry].map((v) => v.toFixed(5)).join(',');
  const cached = cache.get(key);
  if (cached) return cached;
  let best = { ...seed },
    score = wheelEdgeScore(p, best);
  const keys = ['cx', 'cy', 'rx', 'ry'] as const;
  const reach = { cx: seed.rx * 0.4, cy: seed.ry * 0.3, rx: seed.rx * 0.25, ry: seed.ry * 0.25 };
  for (const fraction of [1, 0.4, 0.15]) {
    for (let pass = 0; pass < 2; pass++)
      for (const dimension of keys) {
        const center = best[dimension];
        for (let step = -3; step <= 3; step++) {
          const candidate = {
            ...best,
            [dimension]: center + (reach[dimension] * fraction * step) / 3,
          };
          if (
            Math.abs(candidate[dimension] - seed[dimension]) > reach[dimension] ||
            candidate.rx <= 0 ||
            candidate.ry <= 0
          )
            continue;
          const next = wheelEdgeScore(p, candidate);
          if (next > score) {
            best = candidate;
            score = next;
          }
        }
      }
  }
  // Low-contrast/non-wheel content must not trigger a speculative shift.
  const result = score >= 0.2 ? best : seed;
  cache.set(key, result);
  return result;
}
export function wheelPhotoPatches(
  base: HTMLImageElement,
  source: HTMLImageElement,
  regions: readonly PartClipRegion[],
  create: () => HTMLCanvasElement,
): WheelPatch[] {
  const basePixels = sample(base, create),
    sourcePixels = sample(source, create);
  const approximate = alignedPhotoRect(photoFrame(source, create), photoFrame(base, create), 1, 1);
  return regions
    .filter((region): region is Ellipse => region.kind === 'ellipse')
    .map((region) => {
      const target = fitWheelEdge(basePixels, region);
      const sourceSeed: Ellipse = {
        ...region,
        cx: (target.cx - approximate.x) / approximate.width,
        cy: (target.cy - approximate.y) / approximate.height,
        rx: target.rx / approximate.width,
        ry: target.ry / approximate.height,
      };
      return { target, source: fitWheelEdge(sourcePixels, sourceSeed) };
    });
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function solidBodyLight(p: PhotoPixels, x: number, y: number, e: Ellipse): boolean {
  const center = pixel(p, x, y);
  if (center.light < 145 || center.alpha < 0.9) return false;
  // A flat painted panel stays light in every direction; a bright spoke has dark neighbours.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      n = pixel(p, x + Math.cos(a) * e.rx * 0.16, y + Math.sin(a) * e.ry * 0.16);
    if (n.light < 135 || n.alpha < 0.9) return false;
  }
  return true;
}
/** Preserve bright fender pixels around the sidewall, including on slightly different renders. */
export function wheelMaskAlpha(
  base: PhotoPixels,
  source: PhotoPixels,
  patch: WheelPatch,
  x: number,
  y: number,
): number {
  const e = patch.target,
    s = patch.source,
    nx = (x - e.cx) / e.rx,
    ny = (y - e.cy) / e.ry,
    r = Math.hypot(nx, ny);
  if (r >= 1) return 0;
  if (
    solidBodyLight(base, x, y, e) ||
    solidBodyLight(source, s.cx + nx * s.rx, s.cy + ny * s.ry, s)
  )
    return 0;
  const before = pixel(base, x, y),
    after = pixel(source, s.cx + nx * s.rx, s.cy + ny * s.ry);
  const rim = clamp((0.86 - r) / 0.1);
  const sidewall =
    clamp((130 - before.light) / 60) *
    clamp((140 - after.light) / 60) *
    clamp((before.alpha - 0.75) * 4) *
    clamp((after.alpha - 0.75) * 4);
  return rim + (1 - rim) * sidewall;
}
export function paintWheelMask(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  source: HTMLImageElement,
  patch: WheelPatch,
  width: number,
  height: number,
  create: () => HTMLCanvasElement,
): void {
  const b = sample(base, create),
    s = sample(source, create),
    e = patch.target;
  const left = Math.max(0, Math.floor((e.cx - e.rx) * width)),
    top = Math.max(0, Math.floor((e.cy - e.ry) * height));
  const right = Math.min(width, Math.ceil((e.cx + e.rx) * width)),
    bottom = Math.min(height, Math.ceil((e.cy + e.ry) * height));
  if (right <= left || bottom <= top) return;
  const data = ctx.createImageData(right - left, bottom - top);
  for (let y = 0; y < data.height; y++)
    for (let x = 0; x < data.width; x++) {
      const px = (x + left + 0.5) / width,
        py = (y + top + 0.5) / height;
      const edge = clamp(
        (1 - Math.hypot((px - e.cx) / e.rx, (py - e.cy) / e.ry)) *
          Math.min(e.rx * width, e.ry * height),
      );
      const i = (y * data.width + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
      data.data[i + 3] = Math.round(255 * edge * wheelMaskAlpha(b, s, patch, px, py));
    }
  ctx.putImageData(data, left, top);
}
