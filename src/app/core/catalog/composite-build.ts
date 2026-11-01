import type { BuildLayerPlan } from './build-layers';
import { paintPartClips } from './part-clip-regions';
import { wheelPhotoPatches, paintWheelMask } from './wheel-photo-alignment';

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadBuildImage(url: string): Promise<HTMLImageElement> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => {
        image.src = '';
        reject(new Error('โหลดภาพหรือ mask ใช้เวลานานเกินไป'));
      }, 30000);
      image.onload = () => {
        clearTimeout(timeout);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('โหลดภาพหรือ mask ไม่สำเร็จ'));
      };
      image.src = url;
    });
    images.set(url, pending);
    void pending.catch(() => {
      if (images.get(url) === pending) images.delete(url);
    });
    while (images.size > 32) images.delete(images.keys().next().value!);
  }
  return pending;
}

export function validateAlphaMask(pixels: Uint8ClampedArray): void {
  let transparent = false,
    opaque = false;
  for (let i = 3; i < pixels.length; i += 4) {
    transparent ||= pixels[i] === 0;
    opaque ||= pixels[i] > 0;
  }
  if (!transparent || !opaque)
    throw new Error('Mask ต้องมีพื้นที่โปร่งใสด้านนอก และพื้นที่ทึบเฉพาะบริเวณพาร์ท');
}

/** Replace pixels in the mask, including erasing the old bumper's silhouette. */
export async function compositeBuild(
  plan: BuildLayerPlan,
  load = loadBuildImage,
  createCanvas = () => document.createElement('canvas'),
): Promise<HTMLCanvasElement> {
  if (!plan.base) throw new Error('ไม่มีภาพรถของมุมนี้');
  const base = await load(plan.base);
  const sources = await Promise.all(
    plan.layers.map(async (layer) => ({
      photo: await load(layer.image),
      mask: layer.mask ? await load(layer.mask) : null,
      regions: layer.regions,
      registration: layer.registration,
    })),
  );
  for (const { photo, mask } of sources) {
    if (
      mask &&
      (photo.naturalWidth !== mask.naturalWidth ||
        photo.naturalHeight !== mask.naturalHeight ||
        Math.abs(
          photo.naturalWidth / photo.naturalHeight / (base.naturalWidth / base.naturalHeight) - 1,
        ) > 0.005)
    )
      throw new Error('ภาพพาร์ทกับ mask ต้องมีขนาดกรอบเท่ากัน และมีสัดส่วนตรงกับภาพฐาน');
    if (
      !mask &&
      Math.abs(
        photo.naturalWidth / photo.naturalHeight / (base.naturalWidth / base.naturalHeight) - 1,
      ) > 0.005
    )
      throw new Error('ภาพพาร์ทต้องมีสัดส่วนกรอบเท่าภาพฐาน และจัดตำแหน่งรถให้ตรงกันก่อนซ้อน');
  }
  const result = createCanvas(),
    scratch = createCanvas(),
    clip = createCanvas();
  const scale = Math.min(1, 2048 / Math.max(base.naturalWidth, base.naturalHeight));
  result.width = scratch.width = clip.width = Math.max(1, Math.round(base.naturalWidth * scale));
  result.height =
    scratch.height =
    clip.height =
      Math.max(1, Math.round(base.naturalHeight * scale));
  const ctx = result.getContext('2d'),
    region = scratch.getContext('2d'),
    clipping = clip.getContext('2d');
  if (!ctx || !region || !clipping) throw new Error('เบราว์เซอร์ไม่รองรับการประกอบภาพ');
  const w = result.width,
    h = result.height;
  ctx.drawImage(base, 0, 0, w, h);
  for (const { photo, mask, regions, registration } of sources) {
    if (!mask && registration === 'wheels') {
      for (const patch of wheelPhotoPatches(base, photo, regions || [], createCanvas)) {
        const target = patch.target,
          source = patch.source;
        clipping.clearRect(0, 0, w, h);
        // Sidewall-only replacement leaves the original fender/body untouched.
        paintWheelMask(clipping, base, photo, patch, w, h, createCanvas);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(clip, 0, 0, w, h);
        region.clearRect(0, 0, w, h);
        region.globalCompositeOperation = 'source-over';
        region.drawImage(
          photo,
          (source.cx - source.rx) * photo.naturalWidth,
          (source.cy - source.ry) * photo.naturalHeight,
          source.rx * 2 * photo.naturalWidth,
          source.ry * 2 * photo.naturalHeight,
          (target.cx - target.rx) * w,
          (target.cy - target.ry) * h,
          target.rx * 2 * w,
          target.ry * 2 * h,
        );
        region.globalCompositeOperation = 'destination-in';
        region.drawImage(clip, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(scratch, 0, 0);
      }
      continue;
    }
    clipping.clearRect(0, 0, w, h);
    if (mask) {
      clipping.drawImage(mask, 0, 0, w, h);
      validateAlphaMask(clipping.getImageData(0, 0, w, h).data);
    } else paintPartClips(clipping, w, h, regions || []);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(clip, 0, 0, w, h);
    region.clearRect(0, 0, w, h);
    region.globalCompositeOperation = 'source-over';
    // Equal framing must remain equal; body kits/wing silhouettes are not alignment anchors.
    region.drawImage(photo, 0, 0, w, h);
    region.globalCompositeOperation = 'destination-in';
    region.drawImage(clip, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0);
  }
  return result;
}
