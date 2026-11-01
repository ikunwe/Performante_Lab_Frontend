import { signal } from '@angular/core';
import { seedCatalogFixture } from '../../testing/storage-catalog.fixture';
import { StorageCatalogStore, storageCatalogData } from '../../core/catalog/storage-catalog';
beforeEach(() => {
  seedCatalogFixture(false);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: StorageCatalogStore,
        useValue: {
          data: storageCatalogData,
          load: async () => {},
          loading: signal(false),
          error: signal(''),
          stale: signal(false),
        },
      },
    ],
  });
});
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Catalog } from './catalog';
import { catalogCars } from '../../testing/catalog.fixture';

describe('Catalog', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Catalog], providers: [provideRouter(routes)] }),
  );

  it('disables refresh and replaces stale cards with pulse placeholders while waiting', () => {
    const fixture = TestBed.createComponent(Catalog);
    const directory = TestBed.inject(StorageCatalogStore);
    directory.loading.set(true);
    fixture.detectChanges();
    const refresh = fixture.nativeElement.querySelector('button[aria-label="รีเฟรชข้อมูล Catalog"]') as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    expect(refresh.className).toContain('disabled:cursor-not-allowed');
    expect(refresh.querySelector('svg')?.getAttribute('data-icon')).toBe('rotate');
    expect(fixture.nativeElement.querySelectorAll('app-loading-skeleton .animate-pulse').length).toBe(8);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    directory.loading.set(false);
    fixture.detectChanges();
    expect(refresh.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('app-loading-skeleton')).toBeNull();
  });

  it('filters make/model groups and handles no matches', () => {
    const page = TestBed.createComponent(Catalog).componentInstance;
    expect(page.brandGroups().length).toBe(2);
    page.search.set('F8');
    expect(page.brandGroups().map((group) => group.name)).toEqual(['Ferrari']);
    page.search.set('');
    page.brand.set('Lamborghini');
    expect(
      page
        .brandGroups()
        .flatMap((group) => group.cars)
        .map((car) => car.id),
    ).toEqual(['revuelto']);
    page.search.set('no matching model');
    expect(page.brandGroups()).toEqual([]);
    page.resetFilters();
    expect(page.brandGroups().length).toBe(2);
  });

  it('shows only the chosen car parts and resets detail filters when returning', () => {
    const fixture = TestBed.createComponent(Catalog);
    const page = fixture.componentInstance;
    page.openCar(catalogCars[0]);
    fixture.detectChanges();
    expect(page.sections().length).toBe(5);
    expect(
      page
        .sections()
        .flatMap((section) => section.parts)
        .every((part) => part.carId === 'f8-tributo'),
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Full Body Kits');
    const cards = fixture.nativeElement.querySelectorAll('article');
    expect(cards.length).toBe(9);
    expect(fixture.nativeElement.querySelector('article button')).toBeNull();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(cards[0].textContent).toContain('แบรนด์ / สำนักแต่ง');
    expect(cards[0].textContent).toContain('ราคาอ้างอิง');
    expect(cards[0].textContent).toContain('แนวทางชุดแต่งภายนอก');
    expect(fixture.nativeElement.textContent).not.toContain('View details');
    page.category.set('front');
    expect(page.sections().map((section) => section.id)).toEqual(['front']);
    page.search.set('not found');
    expect(page.partCount()).toBe(0);
    page.back();
    expect(page.selectedCar()).toBeNull();
    expect(page.search()).toBe('');
    expect(page.category()).toBe('All');
    expect(page.brandGroups().length).toBe(2);
  });

  it('opens the Catalog workspace directly at /catalog', async () => {
    const harness = await RouterTestingHarness.create('/catalog');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Catalog');
    const model = [
      ...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('app-catalog button'),
    ].find((button) => button.textContent?.includes('Ferrari F8 Tributo'));
    expect(model).toBeTruthy();
    model!.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Front Bumpers');
    expect(harness.routeNativeElement?.textContent).toContain('Back to all');
  });
});
