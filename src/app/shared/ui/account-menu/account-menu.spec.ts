import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AccountMenu } from './account-menu';

describe('Account menu', () => {
  function setup() {
    const fixture = TestBed.createComponent(AccountMenu);
    fixture.componentRef.setInput('name', 'Driver');
    fixture.componentRef.setInput('email', 'driver@example.com');
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, trigger, page: fixture.componentInstance };
  }

  it('opens from the profile trigger and closes on outside click or Escape', () => {
    const { fixture, trigger, page } = setup();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Profile');
    document.body.click();
    expect(page.open()).toBe(false);
    trigger.click();
    fixture.detectChanges();
    const item = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(page.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('opens Requests from the account dropdown and restores focus', () => {
    const { fixture, trigger, page } = setup();
    const requests = vi.fn();
    page.requests.subscribe(requests);
    trigger.click();
    fixture.detectChanges();
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((item) => item.textContent?.includes('Requests'))!;
    button.click();
    expect(requests).toHaveBeenCalledOnce();
    expect(page.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes for Profile and keeps logout visible while awaiting the result', () => {
    const { fixture, trigger, page } = setup();
    const profile = vi.fn();
    const logout = vi.fn();
    page.profile.subscribe(profile);
    page.logout.subscribe(logout);
    trigger.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[1].click();
    expect(profile).toHaveBeenCalledOnce();
    expect(page.open()).toBe(false);
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();
    const logoutButton = fixture.nativeElement.querySelectorAll('button')[3] as HTMLButtonElement;
    expect(logoutButton.className).toContain('text-red-400');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    logoutButton.click();
    expect(logout).not.toHaveBeenCalled();
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    logoutButton.click();
    expect(logout).toHaveBeenCalledOnce();
    expect(page.open()).toBe(true);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(logoutButton.textContent).toContain('กำลังออกจากระบบ');
    expect(logoutButton.getAttribute('aria-busy')).toBe('true');
  });
});
