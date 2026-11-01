export interface VehicleFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
const frames = new WeakMap<HTMLImageElement, VehicleFrame | null>();
/** Ignore transparent padding, soft ground shadows, and isolated edge speckles. */
export function solidPhotoFrame(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): VehicleFrame | null {
  const rows = new Uint32Array(height),
    columns = new Uint32Array(width);
  let transparent = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha === 0) transparent = true;
      if (alpha >= 245) {
        rows[y]++;
        columns[x]++;
      }
    }
  if (!transparent) return null;
  const rowMinimum = Math.max(2, Math.round(width * 0.004)),
    columnMinimum = Math.max(2, Math.round(height * 0.004));
  const left = columns.findIndex((count) => count >= columnMinimum),
    top = rows.findIndex((count) => count >= rowMinimum);
  let right = width - 1,
    bottom = height - 1;
  while (right >= 0 && columns[right] < columnMinimum) right--;
  while (bottom >= 0 && rows[bottom] < rowMinimum) bottom--;
  if (left < 0 || top < 0 || right - left < width * 0.3 || bottom - top < height * 0.2) return null;
  return {
    x: left / width,
    y: top / height,
    width: (right - left + 1) / width,
    height: (bottom - top + 1) / height,
  };
}
export function photoFrame(
  image: HTMLImageElement,
  createCanvas: () => HTMLCanvasElement,
): VehicleFrame | null {
  if (frames.has(image)) return frames.get(image)!;
  const canvas = createCanvas();
  canvas.width = 512;
  canvas.height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * 512));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('อ่านขอบภาพรถไม่สำเร็จ');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = solidPhotoFrame(
    context.getImageData(0, 0, canvas.width, canvas.height).data,
    canvas.width,
    canvas.height,
  );
  frames.set(image, frame);
  return frame;
}
export function alignedPhotoRect(
  source: VehicleFrame | null,
  target: VehicleFrame | null,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  if (!source || !target) return { x: 0, y: 0, width, height };
  const w = (width * target.width) / source.width,
    h = (height * target.height) / source.height;
  return {
    x: target.x * width - source.x * w,
    y: target.y * height - source.y * h,
    width: w,
    height: h,
  };
}
