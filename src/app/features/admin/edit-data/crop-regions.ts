import type { PartClipRegion } from '../../../core/catalog/part-clip-regions';
export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function cropBounds(region: PartClipRegion): CropBounds {
  if (region.kind === 'ellipse')
    return {
      x: region.cx - region.rx,
      y: region.cy - region.ry,
      width: region.rx * 2,
      height: region.ry * 2,
    };
  const xs = region.points.map((p) => p[0]),
    ys = region.points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
export function resizeCrop(region: PartClipRegion, bounds: CropBounds): PartClipRegion {
  const width = Math.max(0.01, Math.min(1, bounds.width)),
    height = Math.max(0.01, Math.min(1, bounds.height));
  const x = Math.max(0, Math.min(1 - width, bounds.x)),
    y = Math.max(0, Math.min(1 - height, bounds.y));
  if (region.kind === 'ellipse')
    return {
      kind: 'ellipse',
      cx: x + width / 2,
      cy: y + height / 2,
      rx: width / 2,
      ry: height / 2,
    };
  const old = cropBounds(region);
  return {
    kind: 'polygon',
    points: region.points.map(
      ([px, py]) =>
        [x + ((px - old.x) / old.width) * width, y + ((py - old.y) / old.height) * height] as const,
    ),
  };
}
export function defaultCrops(category: string): PartClipRegion[] {
  return category === 'wheels'
    ? [
        { kind: 'ellipse', cx: 0.25, cy: 0.65, rx: 0.07, ry: 0.16 },
        { kind: 'ellipse', cx: 0.7, cy: 0.65, rx: 0.07, ry: 0.16 },
      ]
    : [
        {
          kind: 'polygon',
          points: [
            [0.2, 0.2],
            [0.55, 0.2],
            [0.55, 0.45],
            [0.2, 0.45],
          ],
        },
      ];
}
export function validCrops(value: unknown): value is PartClipRegion[] {
  if (!Array.isArray(value) || !value.length || value.length > 8) return false;
  return value.every((region) => {
    if (!region || typeof region !== 'object') return false;
    if (region.kind === 'ellipse')
      return (
        [region.cx, region.cy, region.rx, region.ry].every(Number.isFinite) &&
        region.rx >= 0.005 &&
        region.ry >= 0.005 &&
        region.cx - region.rx >= -0.000001 &&
        region.cy - region.ry >= -0.000001 &&
        region.cx + region.rx <= 1.000001 &&
        region.cy + region.ry <= 1.000001
      );
    if (
      region.kind !== 'polygon' ||
      !Array.isArray(region.points) ||
      region.points.length < 3 ||
      region.points.length > 64
    )
      return false;
    if (
      region.points.some(
        (point: unknown) =>
          !Array.isArray(point) ||
          point.length !== 2 ||
          point.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1),
      )
    )
      return false;
    const b = cropBounds(region);
    return b.width >= 0.01 && b.height >= 0.01;
  });
}
