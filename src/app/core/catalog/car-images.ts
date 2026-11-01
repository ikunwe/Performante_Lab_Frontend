import { storageCatalogData } from './storage-catalog';
import { carImageManifest, CarImageEntry } from './car-image-manifest';

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function createModelImageResolver(localImages: readonly CarImageEntry[]) {
  return function resolveModelImage(
    brandId: string,
    name: string,
    generation?: { name: string; yearStart: number | null },
  ): string | null {
    const model = normalize(name);
    const images = localImages.filter(
      (image) => image.brandId === brandId && image.model === model,
    );
    if (!images.length) return null;
    const generic = images.find((image) => image.year === null);
    if (generation) {
      // A sedan image must not appear on a Coupe/Tourer card under the same model.
      if (normalize(generation.name.replace(/\s*\(\d{4}\)\s*$/, '')) !== model) return null;
      return (
        images.find((image) => image.year !== null && image.year === generation.yearStart)?.url ??
        generic?.url ??
        null
      );
    }
    return generic?.url ?? [...images].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0].url;
  };
}
export const modelImage = (
  brandId: string,
  name: string,
  generation?: { name: string; yearStart: number | null },
) => {
  return (
    storageCatalogData().cars.find(
      (car) => car.storagePath?.split('/')[0] === brandId && car.modelName === name,
    )?.image ?? null
  );
};
