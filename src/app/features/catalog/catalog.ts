import { StorageCatalogStore, storageCatalogData } from '../../core/catalog/storage-catalog';
import { Component, computed, inject, signal, ElementRef, effect } from '@angular/core';
import { LoadingSkeleton } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { Icon } from '../../shared/ui/icon/icon';
import {
  CatalogCar,
  catalogCars,
  catalogParts,
  catalogBrandLogos,
  partCategories,
} from './catalog.data';

@Component({
  selector: 'app-catalog',
  host: { class: 'block scroll-mt-[100px]' },
  imports: [LoadingSkeleton, Icon],
  templateUrl: './catalog.html',
})
export class Catalog {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly directory = inject(StorageCatalogStore);
  constructor() {
    void this.directory.load();
    effect(() => {
      const selected = this.selectedCar();
      if (!selected) return;
      const current = catalogCars().find((car) => car.id === selected.id);
      if (current && current !== selected) this.selectedCar.set(current);
      else if (!current && !this.directory.loading()) this.selectedCar.set(null);
    });
  }
  get cars() {
    return catalogCars();
  }
  get brandLogos() {
    return catalogBrandLogos();
  }
  get brands() {
    return storageCatalogData().brands.map((brand) => brand.name);
  }
  readonly categories = partCategories;
  readonly selectedCar = signal<CatalogCar | null>(null);
  readonly search = signal('');
  readonly brand = signal('All');
  readonly category = signal('All');
  readonly filtersOpen = signal(false);

  readonly brandGroups = computed(() =>
    this.brands
      .map((brand) => ({
        name: brand,
        cars: this.cars.filter(
          (car) =>
            car.brand === brand &&
            (this.brand() === 'All' || car.brand === this.brand()) &&
            (car.name + ' ' + car.brand).toLowerCase().includes(this.search().trim().toLowerCase()),
        ),
      }))
      .filter(
        (group) =>
          group.cars.length ||
          ((this.brand() === 'All' || this.brand() === group.name) &&
            group.name.toLowerCase().includes(this.search().trim().toLowerCase())),
      ),
  );
  readonly sections = computed(() =>
    this.categories
      .map((category) => ({
        ...category,
        parts: catalogParts().filter(
          (part) =>
            part.carId === this.selectedCar()?.id &&
            part.category === category.id &&
            (this.category() === 'All' || this.category() === category.id) &&
            [part.name, part.finish, category.name, category.label]
              .join(' ')
              .toLowerCase()
              .includes(this.search().trim().toLowerCase()),
        ),
      }))
      .filter((section) => section.parts.length),
  );
  readonly partCount = computed(() =>
    this.sections().reduce((count, section) => count + section.parts.length, 0),
  );

  openCar(car: CatalogCar): void {
    this.selectedCar.set(car);
    this.search.set('');
    this.category.set('All');
    this.filtersOpen.set(false);
    this.scrollToHeading();
  }
  back(): void {
    this.selectedCar.set(null);
    this.search.set('');
    this.category.set('All');
    this.brand.set('All');
    this.filtersOpen.set(false);
  }
  private scrollToHeading(): void {
    const heading = this.host.nativeElement.closest('section[aria-labelledby="page-title"]');
    (heading ?? this.host.nativeElement).scrollIntoView?.({ block: 'start' });
  }
  resetFilters(): void {
    this.search.set('');
    this.brand.set('All');
    this.category.set('All');
  }
}
