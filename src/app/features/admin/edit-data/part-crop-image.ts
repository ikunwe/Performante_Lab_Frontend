import { InjectionToken } from '@angular/core';
import { loadBuildImage } from '../../../core/catalog/composite-build';
import type { PartClipRegion } from '../../../core/catalog/part-clip-regions';

import type { PartPlacement } from './part-placement';

export interface PartCropResult {
  mask: Blob;
  photo: Blob;
  regions?: readonly PartClipRegion[];
  placements?: readonly PartPlacement[];
}
export const CROP_EDITOR_IMAGES = new InjectionToken<typeof loadBuildImage>('CROP_EDITOR_IMAGES', {
  providedIn: 'root',
  factory: () => loadBuildImage,
});

export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ'))),
      'image/png',
    ),
  );
}
