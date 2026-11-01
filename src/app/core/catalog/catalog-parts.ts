import { CatalogCar, CatalogPart, catalogParts } from '../../features/catalog/catalog.data';
export function partsForCar(car: CatalogCar | null | undefined): CatalogPart[] {
  return car ? catalogParts().filter((part) => part.carId === car.id) : [];
}
