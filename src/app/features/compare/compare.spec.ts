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
import { Compare } from './compare';

describe('Compare parts', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Compare], providers: [provideRouter(routes)] }),
  );

  it('compares distinct parts in the same vehicle/category and swaps sides', () => {
    const page = TestBed.createComponent(Compare).componentInstance;
    const [first, second] = page.parts();
    expect(page.ready()).toBe(false);
    page.choosePart('left', first.id);
    page.choosePart('right', first.id);
    expect(page.selectedParts().right).toBeNull();
    page.choosePart('right', second.id);
    expect(page.ready()).toBe(true);
    expect(page.finishDifferent()).toBe(true);
    page.swap();
    expect(page.selectedParts().left?.id).toBe(second.id);
    expect(page.selectedParts().right?.id).toBe(first.id);
  });

  it('clears incompatible selections when changing brand or category', () => {
    const page = TestBed.createComponent(Compare).componentInstance;
    const original = page.parts()[0];
    page.choosePart('left', original.id);
    page.chooseBrand('Lamborghini');
    expect(page.car()?.id).toBe('revuelto');
    expect(page.selection()).toEqual({ left: '', right: '' });
    page.choosePart('right', original.id);
    expect(page.selectedParts().right).toBeNull();
    page.choosePart('left', page.parts()[0].id);
    page.chooseCategory('front');
    expect(page.selection()).toEqual({ left: '', right: '' });
    expect(
      page.parts().every((part) => part.category === 'front' && part.carId === 'revuelto'),
    ).toBe(true);
    page.chooseCategory('wheels');
    expect(page.parts().length).toBe(1);
    expect(page.ready()).toBe(false);
  });

  it('renders part details inline and opens directly at /compare', async () => {
    const fixture = TestBed.createComponent(Compare);
    const page = fixture.componentInstance;
    page.choosePart('left', page.parts()[0].id);
    page.choosePart('right', page.parts()[1].id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gloss finish');
    expect(fixture.nativeElement.textContent).toContain('Carbon finish');
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    const harness = await RouterTestingHarness.create('/compare');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Compare');
    expect(harness.routeNativeElement?.textContent).toContain('เปรียบเทียบของแต่ง');
  });
});
