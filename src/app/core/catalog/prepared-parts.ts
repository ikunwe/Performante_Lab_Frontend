import { CatalogCar, CatalogPart, catalogParts } from '../../features/catalog/catalog.data';
import { partImageManifest, PartImageEntry } from './part-image-manifest';
import { carViewManifest, CarViewEntry, CarViewId } from './car-view-manifest';

const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
export function createPreparedPartsResolver(images: readonly PartImageEntry[]) {
  return (car: CatalogCar | null | undefined): CatalogPart[] => {
    const ref = car?.reference;
    // Model-level prepared pictures do not establish fitment for a specific generation.
    if (!car || !ref || ref.generationId) return [];
    return images.filter(image => image.brandId === ref.brandId && image.model === normalize(ref.modelName))
      .map(image => ({
        id: image.id, carId: car.id, category: image.category, name: image.name,
        finish: 'ภาพรถพร้อมติดตั้ง', crop: 'full', previewImage: image.url,
        description: 'ภาพตัวอย่างที่เตรียมไว้สำหรับรุ่นนี้ ยังไม่ยืนยันเงื่อนไขติดตั้งจริง',
      }));
  };
}
const preparedParts = createPreparedPartsResolver(partImageManifest);
export function partsForCar(car: CatalogCar | null | undefined): CatalogPart[] {
  if (!car) return [];
  if (car.storagePath) return catalogParts().filter(part => part.carId === car.id);
  return [...catalogParts().filter(part => part.carId === car.id), ...preparedParts(car)];
}
export function partForView(parts: readonly CatalogPart[], view: CarViewId): CatalogPart | null {
  const kit = parts.find(part => part.category === 'bodykits');
  if (kit) return kit;
  const category = view === 'front' || view === 'front45' ? 'front'
    : view === 'rear' || view === 'rear45' ? 'rear' : null;
  return parts.find(part => part.category === category) ?? null;
}
export function resolvePreparedViewState(
  car: CatalogCar | null | undefined, parts: readonly CatalogPart[], view: CarViewId,
  entries: readonly CarViewEntry[],
): { image: string | null; missing: string[] } {
  const ref = car?.reference;
  if (!ref || ref.generationId) return { image: null, missing: [] };
  const part = partForView(parts, view);
  const wheel = (view === 'front45' || view === 'rear45') && part?.category !== 'bodykits'
    ? parts.find(item => item.category === 'wheels') : undefined;
  const spoiler = ['front45', 'rear45', 'rear'].includes(view) && part?.category !== 'bodykits'
    ? parts.find(item => item.category === 'spoilers') : undefined;
  const accessories = [wheel, spoiler].filter((item): item is CatalogPart => !!item);
  const find = (variant: string, wheelVariant?: string, spoilerVariant?: string) => entries.find(entry =>
    entry.brandId === ref.brandId && entry.model === normalize(ref.modelName) &&
    entry.variant === variant && entry.wheelVariant === wheelVariant && entry.spoilerVariant === spoilerVariant && entry.view === view)?.url ?? null;
  const variant = part ? normalize(part.name) : 'default';
  // Prefer a complete prepared combination, then the largest available subset.
  // Every accessory omitted from the image is reported instead of implied present.
  const candidates = [accessories, ...(accessories.length > 1 ? accessories.map(item => [item]) : [])];
  for (const shown of candidates) {
    if (!shown.length) continue;
    const shownWheel = shown.find(item => item.category === 'wheels');
    const shownSpoiler = shown.find(item => item.category === 'spoilers');
    const combination = find(variant,
      shownWheel ? normalize(shownWheel.name).replace(/^wheels/, 'wheel') : undefined,
      shownSpoiler ? normalize(shownSpoiler.name).replace(/^spoilers/, 'spoiler') : undefined);
    if (combination) return { image: combination, missing: accessories.filter(item => !shown.includes(item)).map(item => item.id) };
  }
  let image: string | null = null;
  if (part) {
    image = find(variant);
    const coverView = part.category === 'rear' ? 'rear45' : 'front45';
    if (!image && view === coverView) image = part.previewImage ?? null;
  }
  if (!part) {
    const cover = accessories.find(item => item.previewImage &&
      (item.category === 'wheels' ? view === 'front45' : view === 'rear45'));
    if (cover) return { image: cover.previewImage!, missing: accessories.filter(item => item !== cover).map(item => item.id) };
  }
  return { image, missing: [...(part && !image ? [part.id] : []), ...accessories.map(item => item.id)] };
}
export function resolvePreparedView(
  car: CatalogCar | null | undefined, parts: readonly CatalogPart[], view: CarViewId,
  entries: readonly CarViewEntry[],
): string | null {
  return resolvePreparedViewState(car, parts, view, entries).image;
}
export function preparedViewState(car: CatalogCar | null | undefined, ids: readonly string[], view: CarViewId = 'front45') {
  return resolvePreparedViewState(car, partsForCar(car).filter(part => ids.includes(part.id)), view, carViewManifest);
}
export function preparedPreview(car: CatalogCar | null | undefined, ids: readonly string[], view: CarViewId = 'front45'): string | null {
  return preparedViewState(car, ids, view).image;
}
