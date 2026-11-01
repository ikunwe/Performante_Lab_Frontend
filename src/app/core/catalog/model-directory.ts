import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageCatalogStore } from './storage-catalog';

export interface VehicleGeneration {
  id: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  bodyType: string | null;
  chassisCodes: string[];
  chassisSourceUrl: string | null;
}
export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  sourceUrl: string;
  generations: VehicleGeneration[];
}
@Injectable({ providedIn: 'root' })
export class ModelDirectory {
  private readonly directory = inject(StorageCatalogStore);
  readonly brandId = signal<string | null>(null);
  readonly models = computed<VehicleModel[]>(() =>
    this.directory
      .data()
      .cars.filter((car) => car.storagePath?.split('/')[0] === this.brandId())
      .map((car) => ({
        id: car.id,
        brandId: this.brandId()!,
        name: car.modelName || car.name,
        sourceUrl: '',
        yearStart: null,
        yearEnd: null,
        generations: [],
      })),
  );
  readonly loading = this.directory.loading;
  readonly error = this.directory.error;
  readonly stale = this.directory.stale;
  async load(brandId: string, force = false): Promise<void> {
    this.brandId.set(brandId);
    await this.directory.load(force);
  }
}
