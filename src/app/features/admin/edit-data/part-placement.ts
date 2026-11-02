/** Offsets are fractions of the full image; scale/rotation pivot around the crop centre. */
export interface PartPlacement {
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
}
export const defaultPlacement = (): PartPlacement => ({ x: 0, y: 0, scale: 1, rotation: 0 });
export function validPlacements(value: unknown, count: number): value is PartPlacement[] {
  return (
    Array.isArray(value) &&
    value.length === count &&
    value.every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Math.abs(p.x) <= 1 &&
        Number.isFinite(p.y) &&
        Math.abs(p.y) <= 1 &&
        Number.isFinite(p.scale) &&
        p.scale >= 0.1 &&
        p.scale <= 3 &&
        (p.scaleX === undefined ||
          (Number.isFinite(p.scaleX) && p.scaleX >= 0.1 && p.scaleX <= 3)) &&
        (p.scaleY === undefined ||
          (Number.isFinite(p.scaleY) && p.scaleY >= 0.1 && p.scaleY <= 3)) &&
        Number.isFinite(p.rotation) &&
        Math.abs(p.rotation) <= 180,
    )
  );
}
export function isOriginalPlacement(p: PartPlacement): boolean {
  return (
    p.x === 0 &&
    p.y === 0 &&
    p.scale === 1 &&
    (p.scaleX ?? 1) === 1 &&
    (p.scaleY ?? 1) === 1 &&
    p.rotation === 0
  );
}
export function placeContext(
  ctx: CanvasRenderingContext2D,
  p: PartPlacement,
  cx: number,
  cy: number,
  w: number,
  h: number,
): void {
  ctx.translate(cx + p.x * w, cy + p.y * h);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.scale * (p.scaleX ?? 1), p.scale * (p.scaleY ?? 1));
  ctx.translate(-cx, -cy);
}
