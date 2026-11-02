import { workspaceVisibility } from '../../../shared/ui/workspace-visibility';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountAvatar } from '../../../shared/ui/account-avatar/account-avatar';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdsBanner } from '../../../shared/ui/ads-banner/ads-banner';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, AdsBanner, AccountAvatar],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  readonly uiVisibility = workspaceVisibility;
  readonly auth = inject(AuthService);
  readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  readonly userMenuOpen = signal(false);
  readonly notificationsOpen = signal(false);

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
    if (this.userMenuOpen()) this.notificationsOpen.set(false);
  }

  toggleNotifications(): void {
    this.notificationsOpen.update((v) => !v);
    if (this.notificationsOpen()) this.userMenuOpen.set(false);
  }

  closeMenus(): void {
    this.userMenuOpen.set(false);
    this.notificationsOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeMenus();
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
