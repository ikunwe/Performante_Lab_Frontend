import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';
import { AccountAvatar } from '../account-avatar/account-avatar';

@Component({
  selector: 'app-account-menu',
  imports: [Icon, AccountAvatar],
  templateUrl: './account-menu.html',
  host: {
    class: 'relative block border-l border-white/10 pl-3 md:pl-5',
    '(document:click)': 'onOutsideClick($event)',
    '(keydown.escape)': 'closeWithFocus($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class AccountMenu {
  readonly name = input.required<string>();
  readonly email = input('');
  readonly busy = input(false);
  readonly avatarUrl = input('');
  readonly complete = input<boolean | null>(null);
  readonly showStatus = input(true);
  readonly profile = output<void>();
  readonly requests = output<void>();
  readonly logout = output<void>();
  readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  onOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  onFocusOut(event: FocusEvent): void {
    if (event.relatedTarget && !this.host.nativeElement.contains(event.relatedTarget as Node)) {
      this.open.set(false);
    }
  }

  closeWithFocus(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  chooseProfile(): void {
    this.open.set(false);
    this.trigger().nativeElement.focus();
    this.profile.emit();
  }

  chooseLogout(): void {
    if (this.busy()) return;
    this.logout.emit();
  }

  chooseRequests(): void {
    this.open.set(false);
    this.trigger().nativeElement.focus();
    this.requests.emit();
  }
}
