import type { CatalogCar } from '../../features/catalog/catalog.data';
export type CarViewId = 'front45' | 'front' | 'rear45' | 'rear' | 'side';
const labels: Record<CarViewId, string> = {
  front45: 'เฉียงหน้า 45°',
  front: 'หน้าตรง',
  side: 'ด้านข้าง',
  rear45: 'เฉียงหลัง 45°',
  rear: 'หลังตรง',
};
const order: CarViewId[] = ['front45', 'front', 'side', 'rear45', 'rear'];
/** Angles are supplied by Storage metadata; never fabricate a local-image fallback. */
export function viewsForCar(car: CatalogCar | null | undefined) {
  return order
    .filter((view) => /^https?:\/\//i.test(car?.views?.[view] || ''))
    .map((view) => ({ view, url: car!.views![view]!, label: labels[view] }));
}
