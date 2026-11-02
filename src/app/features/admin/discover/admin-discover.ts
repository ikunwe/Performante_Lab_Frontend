import { Component, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingSkeleton } from '../../../shared/ui/loading-skeleton/loading-skeleton';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminBuildItem, AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-discover',
  imports: [CommonModule, FormsModule, Icon, LoadingSkeleton, DecimalPipe],
  templateUrl: './admin-discover.html',
})
export class AdminDiscover {
  readonly admin = inject(AdminService);
  constructor() {
    afterNextRender(() => {
      void this.admin.fetchBuilds();
    });
  }

  readonly filtersOpen = signal(false);
  readonly detailsModalBuild = signal<AdminBuildItem | null>(null);
  readonly deleteConfirmBuild = signal<AdminBuildItem | null>(null);
  readonly toastMessage = signal('');

  readonly categories = ['All', 'Toyota', 'Street', 'Track', 'Show'];

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  setFilter(tag: string): void {
    this.admin.discoverTagFilter.set(tag);
    this.filtersOpen.set(false);
  }

  openDetails(build: AdminBuildItem): void {
    this.detailsModalBuild.set(build);
  }

  closeDetails(): void {
    this.detailsModalBuild.set(null);
  }

  confirmDelete(build: AdminBuildItem): void {
    this.deleteConfirmBuild.set(build);
  }

  cancelDelete(): void {
    this.deleteConfirmBuild.set(null);
  }

  async executeDelete(): Promise<void> {
    const build = this.deleteConfirmBuild();
    if (build) {
      const ok = await this.admin.deleteBuild(build.id);
      if (ok) {
        this.showToast(`ลบ Build "${build.title}" ออกจากระบบเรียบร้อยแล้ว`);
      }
      this.deleteConfirmBuild.set(null);
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3500);
  }
}
