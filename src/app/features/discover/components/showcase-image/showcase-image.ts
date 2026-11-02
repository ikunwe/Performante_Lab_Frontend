import { Component, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { ShowcaseBuild } from '../../discover.data';
import { StorageCatalogStore } from '../../../../core/catalog/storage-catalog';
import { catalogCars } from '../../../catalog/catalog.data';
import { partsForCar } from '../../../../core/catalog/catalog-parts';
import { viewsForCar } from '../../../../core/catalog/car-views';
import { buildLayerPlan } from '../../../../core/catalog/build-layers';
import { BuildPreview } from '../../../../shared/ui/build-preview/build-preview';
import { Icon } from '../../../../shared/ui/icon/icon';

/** The same saved part IDs and angle selection used by My Builds thumbnails. */
@Component({
  selector: 'app-showcase-image',
  imports: [BuildPreview, Icon],
  host: { class: 'block h-full w-full' },
  template: `
    @if (plan(); as layers) {
      <div class="h-full w-full p-2">
        <app-build-preview [plan]="layers" [label]="build().car + ' พร้อมพาร์ทที่เลือก'" />
      </div>
    } @else if (image(); as source) {
      <img
        [src]="source"
        [alt]="build().car"
        width="1280"
        height="960"
        loading="lazy"
        (error)="failedImage.set(source)"
        class="h-full w-full object-contain p-2"
      />
    } @else {
      <span class="flex h-full items-center justify-center text-stone-500"
        ><app-icon name="car" class="!size-10"
      /></span>
    }
  `,
})
export class ShowcaseImage {
  readonly build = input.required<Pick<ShowcaseBuild, 'car' | 'carId' | 'partIds' | 'image'>>();
  readonly failedImage = signal('');
  private readonly catalog = inject(StorageCatalogStore);
  readonly plan = computed(() => {
    const build = this.build();
    if (!build.carId || !build.partIds) return null;
    const car = catalogCars().find((car) => car.id === build.carId);
    if (!car?.storagePath) return null;
    return buildLayerPlan(
      car,
      partsForCar(car).filter((part) => build.partIds!.includes(part.id)),
      viewsForCar(car)[0]?.view ?? 'front45',
    );
  });
  readonly image = computed(() => {
    const url = this.build().image;
    return !url ||
      this.failedImage() === url ||
      /^\/?assets\/(List_Car|ListCar_view|List_Part|brands)\//i.test(url)
      ? null
      : url;
  });
  constructor() {
    afterNextRender(() => {
      void this.catalog.load();
    });
  }
}
