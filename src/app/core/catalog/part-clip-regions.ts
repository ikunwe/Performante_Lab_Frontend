import type { CatalogCar } from '../../features/catalog/catalog.data';
import type { CarViewId } from './car-views';

/** Coordinates are fractions of the entire, consistently framed angle photo. */
export type PartClipRegion =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotation?: number }
  | { kind: 'polygon'; points: readonly (readonly [number, number])[] };
const ellipse = (cx: number, cy: number, rx: number, ry: number): PartClipRegion => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
});
const polygon = (...points: (readonly [number, number])[]): PartClipRegion => ({
  kind: 'polygon',
  points,
});

// Civic FE template. A new model/framing needs its own explicitly calibrated profile.
// Bumpers are normally used as the full-frame foundation; wheel/wing clips preserve them.
const civic: Partial<Record<CarViewId, Record<string, readonly PartClipRegion[]>>> = {
  front45: {
    wheels: [ellipse(0.138, 0.665, 0.054, 0.166), ellipse(0.47, 0.703, 0.066, 0.181)],
    front: [
      polygon([0.552, 0.569], [0.735, 0.596], [0.928, 0.549], [0.958, 0.847], [0.548, 0.873]),
    ],
    spoilers: [
      polygon([0.015, 0.185], [0.25, 0.185], [0.25, 0.36], [0.135, 0.438], [0.015, 0.414]),
    ],
  },
  front: { front: [polygon([0.07, 0.617], [0.93, 0.617], [0.93, 0.938], [0.07, 0.938])] },
  rear45: {
    wheels: [ellipse(0.513, 0.706, 0.072, 0.195), ellipse(0.888, 0.644, 0.054, 0.183)],
    rear: [polygon([0.055, 0.548], [0.333, 0.554], [0.448, 0.639], [0.447, 0.79], [0.063, 0.779])],
    spoilers: [polygon([0.038, 0.17], [0.402, 0.17], [0.455, 0.279], [0.4, 0.392], [0.065, 0.392])],
  },
  rear: {
    rear: [polygon([0.194, 0.586], [0.852, 0.586], [0.858, 0.815], [0.194, 0.815])],
    spoilers: [polygon([0.184, 0.25], [0.844, 0.25], [0.86, 0.41], [0.18, 0.41])],
  },
};
const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function hasAutomaticPartClips(modelName: string): boolean {
  return ['civic', 'civicfe', 'civic11', 'civic11thgen'].includes(normalize(modelName));
}
export function automaticPartClips(
  car: CatalogCar,
  category: string,
  view: CarViewId,
): readonly PartClipRegion[] | null {
  const model =
    car.modelName ||
    car.reference?.modelName ||
    car.storagePath?.split('/')[1] ||
    car.name.replace(
      new RegExp('^' + car.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'),
      '',
    );
  return hasAutomaticPartClips(model) ? civic[view]?.[category] || null : null;
}
export function paintPartClips(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  regions: readonly PartClipRegion[],
): void {
  if (!regions.length) throw new Error('ยังไม่ได้กำหนดบริเวณตัดของพาร์ทนี้');
  ctx.fillStyle = '#ffffff';
  for (const region of regions) {
    ctx.beginPath();
    if (region.kind === 'ellipse') {
      const { cx, cy, rx, ry } = region;
      if (
        ![cx, cy, rx, ry].every(Number.isFinite) ||
        cx < 0 ||
        cx > 1 ||
        cy < 0 ||
        cy > 1 ||
        rx <= 0 ||
        ry <= 0 ||
        rx > 1 ||
        ry > 1
      )
        throw new Error('บริเวณตัดไม่ถูกต้อง');
      ctx.ellipse(
        cx * width,
        cy * height,
        rx * width,
        ry * height,
        ((region.rotation || 0) * Math.PI) / 180,
        0,
        Math.PI * 2,
      );
    } else {
      if (
        region.points.length < 3 ||
        region.points.some((p) => p.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
      )
        throw new Error('บริเวณตัดไม่ถูกต้อง');
      ctx.moveTo(region.points[0][0] * width, region.points[0][1] * height);
      for (const [x, y] of region.points.slice(1)) ctx.lineTo(x * width, y * height);
      ctx.closePath();
    }
    ctx.fill();
  }
}
