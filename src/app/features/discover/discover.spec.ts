import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Discover } from './discover';
import { showcaseBuilds } from './discover.data';
import { AUTH_CLIENT } from '../../core/auth/auth-client';

describe('Discover workspace', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Discover],
      providers: [
        provideRouter([{ path: 'login', component: Discover }]),
        { provide: AUTH_CLIENT, useValue: async () => null },
      ],
    }),
  );

  it('filters builds by search, category and saved state', () => {
    const page = TestBed.createComponent(Discover).componentInstance;
    page.query.set('Ferrari');
    expect(page.visibleBuilds().every((b) => b.car.includes('Ferrari'))).toBe(true);
    page.category.set('Track');
    expect(page.visibleBuilds().length).toBe(2);
    page.toggleSaved(showcaseBuilds[3]);
    page.savedOnly.set(true);
    expect(page.visibleBuilds().map((b) => b.id)).toEqual([4]);
    page.toggleSaved(showcaseBuilds[3]);
    expect(page.visibleBuilds()).toEqual([]);
  });

  it('resets discovery filters when switching workspace tabs', () => {
    const page = TestBed.createComponent(Discover).componentInstance;
    page.query.set('Track');
    page.category.set('Show');
    page.switchTab('Catalog');
    expect(page.activeTab()).toBe('Catalog');
    expect(page.query()).toBe('');
    expect(page.category()).toBe('All');
    page.switchTab('Discover');
    expect(page.visibleBuilds().length).toBe(8);
  });

  it('renders modal content before opening and reuses the existing backdrop', async () => {
    const fixture = TestBed.createComponent(Discover);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const open = vi.fn(() => {
      expect(dialog.querySelector('h2')?.textContent).toContain('Build details');
      expect(dialog.textContent).toContain(showcaseBuilds[0].title);
      dialog.setAttribute('open', '');
    });
    const close = vi.fn(() => dialog.removeAttribute('open'));
    Object.defineProperties(dialog, {
      showModal: { value: open, configurable: true },
      close: { value: close, configurable: true },
      open: { get: () => dialog.hasAttribute('open'), configurable: true },
    });
    page.showDetails(showcaseBuilds[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(open).toHaveBeenCalledTimes(1);

    page.notifications();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.querySelector('h2')?.textContent).toContain('Notifications');
    expect(open).toHaveBeenCalledTimes(1);
    page.close();
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });
});
