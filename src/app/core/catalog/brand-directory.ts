import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageCatalogStore } from './storage-catalog';

export interface CarBrand {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  logoUrl: string | null;
}
export type BrandScope = 'starter' | 'all';
@Injectable({ providedIn: 'root' })
export class BrandDirectory {
  private readonly directory = inject(StorageCatalogStore);
  readonly brands = computed(() => this.directory.data().brands);
  readonly scope = signal<BrandScope>('all');
  readonly loading = this.directory.loading;
  readonly error = this.directory.error;
  readonly stale = this.directory.stale;
  async load(scope: BrandScope = 'all', force = false): Promise<void> {
    this.scope.set(scope);
    await this.directory.load(force);
  }
}
