import { storageCatalogData } from './storage-catalog';

/** Resolve only the image recorded for the exact model in the shared cloud catalog. */
export function modelImage(
  brandId: string,
  name: string,
  _generation?: { name: string; yearStart: number | null },
): string | null {
  return (
    storageCatalogData().cars.find(
      (car) => car.storagePath?.split('/')[0] === brandId && car.modelName === name,
    )?.image || null
  );
}
