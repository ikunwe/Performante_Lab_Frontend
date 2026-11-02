import type { CatalogCar, CatalogPart } from '../../features/catalog/catalog.data';
import type { CarViewId } from './car-views';
import { automaticPartClips, PartClipRegion } from './part-clip-regions';

export type BuildLayer = {
  id: string;
  image: string;
  registration?: 'wheels';
} & ({ mask: string; regions?: never } | { mask?: never; regions: readonly PartClipRegion[] });
export interface BuildLayerPlan {
  base: string | null;
  layers: BuildLayer[];
  missing: string[];
  selected: boolean;
}
const visible: Record<string, readonly CarViewId[]> = {
  front: ['front45', 'front'],
  rear: ['rear45', 'rear'],
  wheels: ['front45', 'rear45'],
  spoilers: ['front45', 'rear45', 'rear'],
  bodykits: ['front45', 'front', 'rear45', 'rear', 'side'],
};
const order = ['bodykits', 'front', 'rear', 'wheels', 'spoilers'];
/** Compose calibrated regions of full-car photos; never blend entire vehicles. */
export function buildLayerPlan(
  car: CatalogCar,
  parts: readonly CatalogPart[],
  view: CarViewId,
): BuildLayerPlan {
  const base =
    car.views?.[view] ||
    (!Object.keys(car.views || {}).length && view === 'front45' ? car.image : null);
  const all = parts.filter((p) => p.carId === car.id);
  const kit = all.find((p) => p.category === 'bodykits');
  const relevant = (kit ? [kit] : all)
    .filter((p) => visible[p.category]?.includes(view))
    .sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id.localeCompare(b.id),
    );
  const plan: BuildLayerPlan = { base, layers: [], missing: [], selected: false };
  if (!relevant.length) return plan;
  const photos = relevant.filter((p) => !!p.views?.[view]);
  plan.missing = relevant.filter((p) => !p.views?.[view]).map((p) => p.id);
  // Prefer the full bumper photograph as a foundation, preserving its exact edges.
  const spoiler = photos.some((p) => p.category === 'spoilers');
  const foundation =
    photos.find(
      (p) =>
        !p.masks?.[view] &&
        (!spoiler || p.category === 'front' || p.category === 'rear' || p.category === 'bodykits'),
    ) || (!base ? photos[0] : undefined);
  if (foundation) {
    plan.base = foundation.views![view]!;
    plan.selected = true;
  }
  for (const part of photos) {
    if (part === foundation) continue;
    const variant = foundation ? part.placementVariants?.[foundation.id] : undefined;
    const calibrated = variant?.masks[view] && variant.layerViews[view] ? variant : undefined;
    const mask = calibrated?.masks[view] || part.masks?.[view];
    if (mask && plan.base) {
      plan.layers.push({
        id: part.id,
        image: calibrated?.layerViews[view] || part.layerViews?.[view] || part.views![view]!,
        mask,
      });
      plan.selected = true;
    } else {
      const regions = automaticPartClips(car, part.category, view);
      if (regions && plan.base) {
        plan.layers.push({
          id: part.id,
          image: part.views![view]!,
          regions,
          ...(part.category === 'wheels' ? { registration: 'wheels' as const } : {}),
        });
        plan.selected = true;
      } else plan.missing.push(part.id);
    }
  }
  return plan;
}
