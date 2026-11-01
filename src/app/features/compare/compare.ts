import { StorageCatalogStore } from '../../core/catalog/storage-catalog';
import { Component, computed, signal, inject, effect } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import {
  catalogCars,
  catalogParts,
  catalogBrandLogos,
  buildPartCategories,
} from '../catalog/catalog.data';

type Side = 'left' | 'right';
@Component({
  selector: 'app-compare',
  imports: [Icon],
  templateUrl: './compare.html',
  host: { class: 'block' },
})
export class Compare {
  readonly directory = inject(StorageCatalogStore);
  constructor() {
    void this.directory.load();
    effect(() => {
      if (!this.brands.includes(this.brand())) this.brand.set(this.brands[0]);
    });
  }
  get brands() {
    return [...new Set(catalogCars().map((car) => car.brand))];
  }
  get brandLogos() {
    return catalogBrandLogos();
  }
  readonly categories = buildPartCategories;
  readonly sides = ['left', 'right'] as const;
  readonly brand = signal(this.brands[0]);
  readonly carId = signal(catalogCars()[0]?.id ?? '');
  readonly category = signal(buildPartCategories[0].id);
  readonly selection = signal<Record<Side, string>>({ left: '', right: '' });
  readonly brandIndex = computed(() => this.brands.indexOf(this.brand()));
  readonly cars = computed(() => catalogCars().filter((car) => car.brand === this.brand()));
  readonly car = computed(
    () => this.cars().find((car) => car.id === this.carId()) ?? this.cars()[0],
  );
  readonly parts = computed(() =>
    catalogParts().filter(
      (part) => part.carId === this.car()?.id && part.category === this.category(),
    ),
  );
  readonly selectedParts = computed(() => ({
    left: this.parts().find((part) => part.id === this.selection().left) ?? null,
    right: this.parts().find((part) => part.id === this.selection().right) ?? null,
  }));
  readonly ready = computed(() => !!this.selectedParts().left && !!this.selectedParts().right);
  readonly finishDifferent = computed(
    () => this.ready() && this.selectedParts().left?.finish !== this.selectedParts().right?.finish,
  );

  chooseBrand(name: string): void {
    if (!this.brands.includes(name)) return;
    this.brand.set(name);
    this.carId.set(this.cars()[0]?.id ?? '');
    this.reset();
  }
  stepBrand(step: number): void {
    const name = this.brands[this.brandIndex() + step];
    if (name) this.chooseBrand(name);
  }
  chooseCar(id: string): void {
    if (!this.cars().some((car) => car.id === id)) return;
    this.carId.set(id);
    this.reset();
  }
  chooseCategory(id: string): void {
    if (!this.categories.some((category) => category.id === id)) return;
    this.category.set(id);
    this.reset();
  }
  choosePart(side: Side, id: string): void {
    if (id && !this.parts().some((part) => part.id === id)) return;
    const other = side === 'left' ? 'right' : 'left';
    if (id && this.selection()[other] === id) return;
    this.selection.update((value) => ({ ...value, [side]: id }));
  }
  swap(): void {
    this.selection.update((value) => ({ left: value.right, right: value.left }));
  }
  reset(): void {
    this.selection.set({ left: '', right: '' });
  }
}
