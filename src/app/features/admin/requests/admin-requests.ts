import { Component, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminRequestItem, AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-requests',
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './admin-requests.html',
})
export class AdminRequests {
  readonly admin = inject(AdminService);
  constructor() {
    afterNextRender(() => {
      void this.admin.fetchRequests();
    });
  }

  readonly filtersOpen = signal(false);
  readonly detailsModalRequest = signal<AdminRequestItem | null>(null);
  readonly toastMessage = signal('');

  readonly statuses: ('All' | 'Pending' | 'Accepted' | 'Rejected')[] = [
    'All',
    'Pending',
    'Accepted',
    'Rejected',
  ];

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  setStatusFilter(status: 'All' | 'Pending' | 'Accepted' | 'Rejected'): void {
    this.admin.requestsStatusFilter.set(status);
    this.filtersOpen.set(false);
  }

  openDetails(request: AdminRequestItem): void {
    this.detailsModalRequest.set(request);
  }

  closeDetails(): void {
    this.detailsModalRequest.set(null);
  }

  async handleAccept(request: AdminRequestItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!(await this.admin.acceptRequest(request.id))) return;
    this.closeDetails();
    this.showToast(`อนุมัติคำขอชิ้นส่วน "${request.title}" เรียบร้อยแล้ว`);
  }

  async handleReject(request: AdminRequestItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!(await this.admin.rejectRequest(request.id))) return;
    this.closeDetails();
    this.showToast(`ปฏิเสธคำขอชิ้นส่วน "${request.title}" เรียบร้อยแล้ว`);
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3500);
  }
}
