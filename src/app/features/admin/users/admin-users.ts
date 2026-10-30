import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../shared/ui/icon/icon';
import { AuthService, UserRole } from '../../../core/auth/auth.service';
import { AdminService, AdminUserItem } from '../services/admin.service';

@Component({
  selector: 'app-admin-users',
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './admin-users.html',
})
export class AdminUsers {
  readonly auth = inject(AuthService);
  readonly admin = inject(AdminService);

  readonly filtersOpen = signal(false);
  readonly editingUserRole = signal<string | null>(null);
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  readonly roles: ('All' | 'User' | 'Admin' | 'SuperAdmin')[] = [
    'All',
    'User',
    'Admin',
    'SuperAdmin',
  ];
  readonly statuses: ('All' | 'Active' | 'InActive')[] = ['All', 'Active', 'InActive'];

  readonly pageSize = 10;
  readonly currentPage = signal(1);

  // คำนวณจำนวนหน้าทั้งหมด
  readonly totalUsers = computed(() => this.admin.filteredUsers().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalUsers() / this.pageSize)));

  // ตัดข้อมูล 10 คนสำหรับหน้าปัจจุบัน
  readonly pagedUsers = computed(() => {
    const page = Math.max(1, Math.min(this.currentPage(), this.totalPages()));
    const start = (page - 1) * this.pageSize;
    return this.admin.filteredUsers().slice(start, start + this.pageSize);
  });

  // ช่วงรายการที่กำลังแสดง (สำหรับข้อความแสดง 1 - 10 จาก...)
  readonly displayRange = computed(() => {
    const total = this.totalUsers();
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = Math.max(1, Math.min(this.currentPage(), this.totalPages()));
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(page * this.pageSize, total);
    return { start, end, total };
  });

  // Array หมายเลขหน้าสำหรับ Loop แสดงปุ่ม
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  constructor() {
    effect(() => {
      // Auto-reset currentPage to 1 whenever search query or filters change
      this.admin.usersSearch();
      this.admin.usersRoleFilter();
      this.admin.usersStatusFilter();
      this.currentPage.set(1);
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  onSearchChange(search: string): void {
    this.admin.usersSearch.set(search);
    this.currentPage.set(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  setRoleFilter(role: 'All' | 'User' | 'Admin' | 'SuperAdmin'): void {
    this.admin.usersRoleFilter.set(role);
    this.currentPage.set(1);
  }

  setStatusFilter(status: 'All' | 'Active' | 'InActive'): void {
    this.admin.usersStatusFilter.set(status);
    this.currentPage.set(1);
  }

  async toggleStatus(user: AdminUserItem): Promise<void> {
    if (!this.admin.canSuspendUser(user)) {
      if (user.role === 'SuperAdmin') {
        this.showToast('ไม่สามารถระงับบัญชี SuperAdmin ได้', 'error');
      } else {
        this.showToast('เฉพาะ SuperAdmin เท่านั้นที่จัดการ Admin ได้', 'error');
      }
      return;
    }
    const res = await this.admin.toggleUserStatus(user.id);
    if (res.ok) {
      const action = user.status === 'Active' ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี';
      this.showToast(`${action} "${user.username}" (${user.email}) เรียบร้อยแล้ว`, 'success');
    } else {
      this.showToast(res.message || 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
    }
  }

  toggleRoleEditor(userId: string, event?: Event): void {
    event?.stopPropagation();
    // RBAC check: only SuperAdmin can open role editor
    if (!this.auth.isSuperAdmin()) {
      this.showToast('เฉพาะ SuperAdmin เท่านั้นที่มีสิทธิ์แก้ไข Role ของผู้ใช้', 'error');
      return;
    }
    this.editingUserRole.set(this.editingUserRole() === userId ? null : userId);
  }

  async changeUserRole(user: AdminUserItem, newRole: UserRole, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.auth.isSuperAdmin()) {
      this.showToast('เฉพาะ SuperAdmin เท่านั้นที่มีสิทธิ์แก้ไข Role ของผู้ใช้', 'error');
      return;
    }
    const res = await this.admin.updateUserRole(user.id, newRole);
    this.editingUserRole.set(null);
    if (res.ok) {
      this.showToast(`เปลี่ยน Role ของ "${user.username}" เป็น ${newRole} สำเร็จ`, 'success');
    } else {
      this.showToast(res.message || 'ไม่สามารถเปลี่ยน Role ได้', 'error');
    }
  }

  closeRoleEditor(): void {
    this.editingUserRole.set(null);
  }

  getRoleBadgeText(role: UserRole): string {
    return role === 'SuperAdmin' ? 'SpAdmin' : role;
  }

  private showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3500);
  }
}
