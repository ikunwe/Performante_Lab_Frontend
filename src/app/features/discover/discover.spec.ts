import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Discover } from './discover';
import { BuildsStore } from '../my-builds/builds.store';
import { showcaseBuilds as examples } from '../../testing/discover.fixture';
import { DiscoverFeedStore } from './discover-feed.store';
import { signal } from '@angular/core';
const showcaseBuilds = examples.map((build) => ({
  ...build,
  id: String(build.id),
  isOwn: false,
  isPublic: true,
}));
import { AUTH_CLIENT } from '../../core/auth/auth-client';

describe('Discover workspace', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Discover],
      providers: [
        {
          provide: DiscoverFeedStore,
          useValue: {
            builds: signal(showcaseBuilds),
            loading: signal(false),
            error: signal(''),
            load: async () => {},
          },
        },
        provideRouter(routes),
        { provide: AUTH_CLIENT, useValue: async () => null },
      ],
    }),
  );

  it('filters builds by search, category and liked state', () => {
    const page = TestBed.createComponent(Discover).componentInstance;
    page.query.set('Ferrari');
    expect(page.visibleBuilds().every((b) => b.car.includes('Ferrari'))).toBe(true);
    page.category.set('Track');
    expect(page.visibleBuilds().length).toBe(2);
    page.toggleLike(showcaseBuilds[3]);
    page.likedOnly.set(true);
    expect(page.visibleBuilds().map((b) => b.id)).toEqual(['4']);
    page.toggleLike(showcaseBuilds[3]);
    expect(page.visibleBuilds()).toEqual([]);
  });

  it('starts at Discover and uses the URL for sidebar navigation', async () => {
    const harness = await RouterTestingHarness.create('/discover');
    let page = harness.routeDebugElement!.componentInstance as Discover;
    expect(page.activeTab()).toBe('Discover');
    page.switchTab('Catalog');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/catalog');
    page = harness.routeDebugElement!.componentInstance as Discover;
    expect(page.activeTab()).toBe('Catalog');
    page.switchTab('Compare');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/compare');
    expect((harness.routeDebugElement!.componentInstance as Discover).activeTab()).toBe('Compare');
    await harness.navigateByUrl('/discover');
    expect((harness.routeDebugElement!.componentInstance as Discover).activeTab()).toBe('Discover');
  });

  for (const tab of ['Catalog', 'Compare']) {
    it(`restores ${tab} directly from its URL without first showing Discover`, async () => {
      const load = vi.spyOn(TestBed.inject(DiscoverFeedStore), 'load');
      const harness = await RouterTestingHarness.create(`/${tab.toLowerCase()}`);
      const page = harness.routeDebugElement!.componentInstance as Discover;
      expect(page.activeTab()).toBe(tab);
      expect(harness.routeNativeElement!.querySelector('#page-title')?.textContent?.trim()).toBe(tab);
      expect(harness.routeNativeElement!.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(tab);
      expect(harness.routeNativeElement!.querySelector('app-build-card')).toBeNull();
      expect(load).not.toHaveBeenCalled();
    });
  }

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
  it('confirms own-build deletion and retains the dialog and card on failure', async () => {
    const remove=vi.fn().mockResolvedValueOnce({ok:false,error:'offline'}).mockResolvedValueOnce({ok:true});
    TestBed.overrideProvider(BuildsStore,{useValue:{remove}});
    const fixture=TestBed.createComponent(Discover); fixture.detectChanges(); await fixture.whenStable();
    const page=fixture.componentInstance;
    const own={...showcaseBuilds[0],isOwn:true};
    const dialog=fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperty(dialog,'showModal',{value:()=>dialog.setAttribute('open','')});
    Object.defineProperty(dialog,'close',{value:()=>dialog.removeAttribute('open')});
    page.requestDelete(showcaseBuilds[0]); expect(page.modal()).toBe('details');
    page.feed.builds.set([own]); page.requestDelete(own);
    fixture.detectChanges(); await fixture.whenStable();
    expect(remove).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('ยืนยันลบ');
    await page.confirmDelete(); fixture.detectChanges();
    expect(dialog.textContent).toContain('offline');
    expect(page.feed.builds()).toHaveLength(1);
    expect(dialog.hasAttribute('open')).toBe(true);
    await page.confirmDelete();
    expect(page.feed.builds()).toEqual([]);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(remove).toHaveBeenCalledWith(own.id);
  });

});
