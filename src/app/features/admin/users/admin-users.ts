import { Component, inject, signal } from '@angular/core';
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

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  setRoleFilter(role: 'All' | 'User' | 'Admin' | 'SuperAdmin'): void {
    this.admin.usersRoleFilter.set(role);
  }

  setStatusFilter(status: 'All' | 'Active' | 'InActive'): void {
    this.admin.usersStatusFilter.set(status);
  }

  async toggleStatus(user: AdminUserItem): Promise<void> {
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

