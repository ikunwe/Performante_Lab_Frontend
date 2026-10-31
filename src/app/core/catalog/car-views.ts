import type { CatalogCar } from '../../features/catalog/catalog.data';
import { carViewManifest, CarViewEntry, CarViewId } from './car-view-manifest';

const labels: Record<CarViewId, string> = { front45: 'เฉียงหน้า 45°', front: 'หน้าตรง', side: 'ด้านข้าง', rear45: 'เฉียงหลัง 45°', rear: 'หลังตรง' };
const order: CarViewId[] = ['front45', 'front', 'side', 'rear45', 'rear'];
const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
export function createCarViewResolver(entries: readonly CarViewEntry[]) {
  return (car: CatalogCar | null | undefined) => {
    const ref = car?.reference;
    if (!ref || ref.generationId) return [];
    return entries.filter(entry => entry.brandId === ref.brandId && entry.model === normalize(ref.modelName) && entry.variant === 'default' && !entry.wheelVariant && !entry.spoilerVariant)
      .map(entry => ({ ...entry, label: labels[entry.view] }))
      .sort((a, b) => order.indexOf(a.view) - order.indexOf(b.view));
  };
}
export const viewsForCar = createCarViewResolver(carViewManifest);
