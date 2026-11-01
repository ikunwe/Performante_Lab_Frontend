import { seedCatalogFixture } from '../../testing/storage-catalog.fixture';
import { StorageCatalogStore, storageCatalogData } from '../../core/catalog/storage-catalog';
beforeEach(() => {
  seedCatalogFixture(true);
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
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BUILDS_STORAGE_KEY, BuildsStore } from './builds.store';
import { BuildsApi } from './builds.api';
import { MyBuilds } from './my-builds';
import { BUILD_COMPOSITOR } from '../../shared/ui/build-preview/build-preview';
import { catalogCars, catalogParts } from '../../testing/catalog.fixture';
import { BrandDirectory } from '../../core/catalog/brand-directory';
import { ModelDirectory } from '../../core/catalog/model-directory';

describe('My Builds with the account API', () => {
  let memory: Map<string, string>;
  let storage: Storage;
  beforeEach(() => {
    memory = new Map();
    storage = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: (index) => [...memory.keys()][index] ?? null,
      get length() {
        return memory.size;
      },
    };
    TestBed.configureTestingModule({
      imports: [MyBuilds],
      providers: [
        {
          provide: ModelDirectory,
          useValue: {
            models: signal([
              {
                id: 'toyota:corolla',
                brandId: 'toyota',
                name: 'Corolla',
                yearStart: 1966,
                yearEnd: null,
                sourceUrl: 'https://example.com/toyota',
                generations: [
                  {
                    id: 'toyota:corolla:gen',
                    name: 'Corolla Sedan (2022)',
                    yearStart: 2022,
                    yearEnd: null,
                    bodyType: null,
                    chassisCodes: [],
                    chassisSourceUrl: null,
                  },
                ],
              },
            ]),
            loading: signal(false),
            error: signal(''),
            load: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BuildsApi,
          useValue: {
            owner: signal('account-1'),
            initialize: vi.fn().mockResolvedValue(undefined),
            list: async () => JSON.parse(storage.getItem(BUILDS_STORAGE_KEY) ?? '[]'),
            save: async (_owner: string, input: any, createId: string) => {
              const rows = JSON.parse(storage.getItem(BUILDS_STORAGE_KEY) ?? '[]');
              const existing = rows.find((row: any) => row.id === input.id);
              if (input.id && !existing) throw new Error('ไม่พบ Build');
              const now = new Date().toISOString();
              const row = {
                ...input,
                id: input.id ?? createId,
                name: input.name.trim(),
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              };
              storage.setItem(
                BUILDS_STORAGE_KEY,
                JSON.stringify([row, ...rows.filter((item: any) => item.id !== row.id)]),
              );
              return row;
            },
            remove: async (_owner: string, id: string) => {
              const rows = JSON.parse(storage.getItem(BUILDS_STORAGE_KEY) ?? '[]');
              storage.setItem(
                BUILDS_STORAGE_KEY,
                JSON.stringify(rows.filter((row: any) => row.id !== id)),
              );
            },
          },
        },
        {
          provide: BrandDirectory,
          useValue: {
            brands: signal([
              { id: 'toyota', slug: 'toyota', name: 'Toyota', aliases: ['TOYOTA'], logoUrl: null },
              { id: 'ferrari', slug: 'ferrari', name: 'Ferrari', aliases: [], logoUrl: null },
            ]),
            scope: signal('starter'),
            loading: signal(false),
            error: signal(''),
            load: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });
  });

  it('uses cloud angle photos and part IDs, restores the default and persists selections without local assets', async () => {
    TestBed.overrideProvider(BUILD_COMPOSITOR,{useValue:vi.fn().mockRejectedValue(new Error('Renderer tested separately'))});
    const base='https://test.supabase.co/storage/v1/object/public/catalog/Honda/Civic/';
    const car={id:'storage-car:civic',storagePath:'Honda/Civic',modelName:'Civic',name:'Honda Civic',brand:'Honda',body:'',image:base+'45_front.png',views:{front45:base+'45_front.png',front:base+'front.png',rear45:base+'45_Back.png',rear:base+'Back.png'}};
    const parts=['front','rear','wheels'].map(category=>({id:'storage-part:'+category,storagePath:'Honda/Civic/Part/'+category,carId:car.id,category,name:category,description:'',finish:'Test',crop:'full' as const,previewImage:base+category+'/45_front.png',views:{front45:base+category+'/45_front.png',front:base+category+'/front.png',rear45:base+category+'/45_Back.png',rear:base+category+'/Back.png'}}));
    storageCatalogData.update(data=>({...data,cars:[...data.cars,car],parts:[...data.parts,...parts]}));
    const fixture=TestBed.createComponent(MyBuilds),page=fixture.componentInstance;
    fixture.detectChanges();page.startNew();page.chooseCar(car);
    expect(page.previewImage()).toBe(car.views.front45);
    page.togglePart(parts[0]);expect(page.previewImage()).toBe(parts[0].views.front45);
    page.togglePart(parts[2]);expect(page.layerPlan()?.layers.map(layer=>layer.id)).toEqual([parts[2].id]);expect(page.missingPartView()).toBe(false);
    page.selectView('rear');expect(page.previewImage()).toBe(car.views.rear);
    page.togglePart(parts[1]);expect(page.activeView()?.view).toBe('rear');expect(page.previewImage()).toBe(parts[1].views.rear);
    const store=TestBed.inject(BuildsStore);
    expect((await store.save({name:'Cloud Civic',carId:car.id,partIds:page.partIds()})).ok).toBe(true);
    store.builds.set([]);await store.load();page.editBuild(store.builds()[0]);
    expect(page.partIds().sort()).toEqual(parts.map(part=>part.id).sort());
    page.removePart(parts[0].id);page.removePart(parts[2].id);page.selectView('front45');
    expect(page.previewImage()).toBe(car.views.front45);
    expect(page.carImage({...car,id:'old',storagePath:undefined,image:'assets/List_Car/Honda/civic.png'})).toBeNull();
    fixture.destroy();
  });

  it('saves, reloads, updates and deletes a build without changing its identity', async () => {
    const store = TestBed.inject(BuildsStore);
    await store.load();
    const part = catalogParts.find((part) => part.carId === catalogCars[0].id)!;
    expect(
      (await store.save({ name: '  Weekend spec  ', carId: catalogCars[0].id, partIds: [part.id] }))
        .ok,
    ).toBe(true);
    const first = store.builds()[0];
    expect(first.name).toBe('Weekend spec');
    store.builds.set([]);
    await store.load();
    expect(store.builds()[0]).toEqual(first);
    await store.save({ ...first, name: 'Updated spec', partIds: [] });
    expect(store.builds().length).toBe(1);
    expect(store.builds()[0].id).toBe(first.id);
    expect(store.builds()[0].createdAt).toBe(first.createdAt);
    expect((await store.remove(first.id)).ok).toBe(true);
    await store.load();
    expect(store.builds()).toEqual([]);
  });

  it('shows fetched brands, supports search and explains brands without available models', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.startNew();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="เลือกยี่ห้อ Toyota"]')).not.toBeNull();
    page.brandQuery.set('toy');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="เลือกยี่ห้อ Ferrari"]')).toBeNull();
    fixture.nativeElement.querySelector('[aria-label="เลือกยี่ห้อ Toyota"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Corolla');
    expect(page.carId()).toBeNull();
    page.brand.set('Ferrari');
    fixture.detectChanges();
    expect(page.brandCars().map((car) => car.id)).toEqual(['f8-tributo']);
  });

  it('does not substitute local logo assets for missing Storage logos', async () => {
    const page = TestBed.createComponent(MyBuilds).componentInstance;
    const brand = { id: 'aion', slug: 'aion', name: 'AION', aliases: [], logoUrl: null };
    expect(page.brandLogo(brand)).toBeNull();
    expect(page.brandLogo({ ...brand, id: 'tank', name: 'TANK' })).toBeNull();
    page.markBrandLogoBroken('aion');
    expect(page.brandLogo(brand)).toBeNull();
  });

  it('selects a database generation and keeps it when saving, reloading and editing a base build', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    const page = fixture.componentInstance;
    page.startNew();
    page.brand.set('Toyota');
    fixture.detectChanges();
    expect(page.modelDirectory.load).toHaveBeenCalledWith('toyota');
    const model = page.modelDirectory.models()[0];
    page.selectedModelId.set(model.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Corolla');
    page.chooseReference(model, model.generations[0]);
    fixture.detectChanges();
    expect(page.car()?.reference?.generationId).toBe('toyota:corolla:gen');
    expect(page.car()?.image).toBe('');
    const store = TestBed.inject(BuildsStore);
    await store.load();
    expect(
      (
        await store.save({
          name: 'My base',
          carId: page.carId()!,
          carSnapshot: page.car()!,
          partIds: [],
        })
      ).ok,
    ).toBe(true);
    store.builds.set([]);
    await store.load();
    expect(store.builds()[0].carSnapshot?.reference?.yearStart).toBe(2022);
    page.editBuild(store.builds()[0]);
    fixture.detectChanges();
    expect(page.car()?.name).toBe('Toyota Corolla');
    expect(
      (
        await store.save({
          name: 'Invalid parts',
          carId: page.carId()!,
          carSnapshot: page.car()!,
          partIds: [catalogParts[0].id],
        })
      ).ok,
    ).toBe(false);
  });

  it.each([0, 1])('opens parts directly when the model has %i generations', async (count) => {
    const fixture = TestBed.createComponent(MyBuilds);
    const page = fixture.componentInstance;
    page.startNew();
    page.brand.set('Toyota');
    const original = page.modelDirectory.models()[0];
    const model = { ...original, generations: original.generations.slice(0, count) };
    (page.modelDirectory.models as any).set([model]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[title="Corolla"]').click();
    fixture.detectChanges();
    expect(page.section()).toBe('bodykits');
    expect(page.car()?.reference?.modelId).toBe(model.id);
    expect(page.car()?.reference?.generationId).toBeNull();
    expect(page.selectedModelId()).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="ไปยังหมวดของแต่ง"]')).not.toBeNull();
  });

  it('ignores legacy generation metadata and opens parts for the model', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    const page = fixture.componentInstance;
    page.startNew();
    page.brand.set('Toyota');
    const original = page.modelDirectory.models()[0];
    const model = {
      ...original,
      generations: [
        ...original.generations,
        { ...original.generations[0], id: original.id + ':other', name: 'Other generation' },
      ],
    };
    (page.modelDirectory.models as any).set([model]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[title="Corolla"]').click();
    fixture.detectChanges();
    expect(page.section()).toBe('bodykits');
    expect(page.car()?.reference?.generationId).toBeNull();
    expect(page.selectedModelId()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Other generation');
  });

  it('rejects blank names and parts from a different car', async () => {
    const store = TestBed.inject(BuildsStore);
    await store.load();
    const wrongPart = catalogParts.find((part) => part.carId === catalogCars[1].id)!;
    expect((await store.save({ name: ' ', carId: catalogCars[0].id, partIds: [] })).ok).toBe(false);
    expect(
      (await store.save({ name: 'Invalid', carId: catalogCars[0].id, partIds: [wrongPart.id] })).ok,
    ).toBe(false);
    expect(store.builds()).toEqual([]);
  });

  it('does not overwrite current state when the API rejects a write', async () => {
    const store = TestBed.inject(BuildsStore);
    await store.load();
    await store.save({ name: 'Original', carId: catalogCars[0].id, partIds: [] });
    const original = store.builds()[0];
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect((await store.save({ ...original, name: 'Unsaved update' })).ok).toBe(false);
    expect(store.builds()[0].name).toBe('Original');
    expect((await store.remove(original.id)).ok).toBe(false);
    expect(store.builds().length).toBe(1);
  });

  it('selects one part per category and restores saved selections in the editor', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.startNew();
    expect(page.car()).toBeNull();
    page.chooseCar(catalogCars[0]);
    const [first, second] = page.partsFor('bodykits');
    page.togglePart(first);
    page.togglePart(second);
    expect(page.partIds()).toEqual([second.id]);
    page.togglePart(second);
    expect(page.partIds()).toEqual([]);
    page.togglePart(first);
    await page.store.save({ name: 'Restore me', carId: catalogCars[0].id, partIds: [first.id] });
    page.editBuild(page.store.builds()[0]);
    expect(page.selectedParts().map((part) => part.id)).toEqual([first.id]);
    expect(page.dirty()).toBe(false);
    page.removePart(first.id);
    expect(page.dirty()).toBe(true);
  });

  it('asks for a name only after editing and preserves work when the API rejects a save', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const show = vi.fn(() => dialog.setAttribute('open', ''));
    Object.defineProperties(dialog, {
      showModal: { value: show },
      close: { value: () => dialog.removeAttribute('open') },
      open: { get: () => dialog.hasAttribute('open') },
    });
    page.startNew();
    page.chooseCar(catalogCars[0]);
    page.togglePart(page.partsFor('bodykits')[0]);
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(fixture.nativeElement.querySelector('#saved-build-name')?.closest('dialog')).toBe(
      dialog,
    );
    page.requestSave();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(show).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('#saved-build-name')).not.toBeNull();
    page.name.set('Keep this work');
    let reject!: (error: Error) => void;
    const apiSave = vi.spyOn(TestBed.inject(BuildsApi), 'save').mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    submit.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    fixture.detectChanges();
    expect(page.store.saving()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type="submit"]')?.disabled).toBe(true);
    expect(dialog.textContent).toContain('กำลังบันทึก');
    page.closeDialog();
    expect(dialog.open).toBe(true);
    const busyCancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(busyCancel);
    expect(busyCancel.defaultPrevented).toBe(true);
    await page.save();
    expect(apiSave).toHaveBeenCalledOnce();
    reject(new Error('บันทึกไม่ได้'));
    await fixture.whenStable();
    expect(page.formError()).toContain('บันทึกไม่ได้');
    expect(page.editing()).toBe(true);
    expect(page.partIds().length).toBe(1);
    expect(dialog.open).toBe(true);
    const idleCancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(idleCancel);
    expect(idleCancel.defaultPrevented).toBe(false);
  });

  it('submits the named build by clicking Save and closes the dialog only after success', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperties(dialog, {
      showModal: { value: () => dialog.setAttribute('open', '') },
      close: { value: () => dialog.removeAttribute('open') },
      open: { get: () => dialog.hasAttribute('open') },
    });
    page.startNew();
    page.chooseCar(catalogCars[0]);
    page.requestSave();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('#saved-build-name') as HTMLInputElement;
    expect(page.categories.map(category=>category.id)).toEqual(['bodykits','front','rear','wheels','spoilers']);
    const category = fixture.nativeElement.querySelector('#saved-build-category') as HTMLSelectElement;
    category.value = 'Track'; category.dispatchEvent(new Event('change', {bubbles:true}));
    input.value = 'Weekend build';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const save = vi.spyOn(TestBed.inject(BuildsApi), 'save');
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(save).toHaveBeenCalledOnce();
    expect(page.store.builds()[0].name).toBe('Weekend build');
    expect(page.store.builds()[0].category).toBe('Track');
    expect(page.editing()).toBe(false);
    expect(dialog.open).toBe(false);
    expect(page.message()).toContain('บันทึก Build ในบัญชี');
    page.editBuild(page.store.builds()[0]); expect(page.buildCategory()).toBe('Track');
  });

  it('confirms changing a car and allows cancelling unsaved exit', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperties(dialog, {
      showModal: { value: () => dialog.setAttribute('open', '') },
      close: { value: () => dialog.removeAttribute('open') },
      open: { get: () => dialog.hasAttribute('open') },
    });
    page.startNew();
    page.chooseCar(catalogCars[0]);
    const part = page.partsFor('bodykits')[0];
    page.togglePart(part);
    page.chooseCar(catalogCars[1]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.carId()).toBe(catalogCars[0].id);
    expect(page.partIds()).toEqual([part.id]);
    page.confirmCarChange();
    expect(page.carId()).toBe(catalogCars[1].id);
    expect(page.partIds()).toEqual([]);
    page.requestBack();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.modalKind()).toBe('discard');
    page.closeDialog();
    expect(page.editing()).toBe(true);
    page.requestBack();
    fixture.detectChanges();
    await fixture.whenStable();
    page.confirmDiscard();
    expect(page.editing()).toBe(false);
    expect(page.store.builds()).toEqual([]);
  });

  it('replaces separate parts only after confirmation and locks them while a full kit is selected', async () => {
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperties(dialog, {
      showModal: { value: () => dialog.setAttribute('open', '') },
      close: { value: () => dialog.removeAttribute('open') },
      open: { get: () => dialog.hasAttribute('open') },
    });
    page.startNew();
    page.chooseCar(catalogCars[0]);
    const front = page.partsFor('front')[0];
    const rear = page.partsFor('rear')[0];
    const kit = page.partsFor('bodykits')[0];
    page.togglePart(front);
    page.togglePart(rear);
    page.togglePart(kit);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.modalKind()).toBe('replace-kit');
    expect(page.partIds()).toEqual([front.id, rear.id]);
    page.closeDialog();
    expect(page.partIds()).toEqual([front.id, rear.id]);

    page.togglePart(kit);
    fixture.detectChanges();
    await fixture.whenStable();
    page.confirmFullKit();
    expect(page.partIds()).toEqual([kit.id]);
    page.togglePart(front);
    expect(page.partIds()).toEqual([kit.id]);
    fixture.detectChanges();
    const frontCard = fixture.nativeElement.querySelector(
      '#build-category-front button',
    ) as HTMLButtonElement;
    expect(frontCard.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('aside[aria-label="สรุปรายการแต่ง"]')).toBeTruthy();
    page.removePart(kit.id);
    page.togglePart(front);
    expect(page.partIds()).toEqual([front.id]);
  });

  it('rejects saving a full kit mixed with any separate part', async () => {
    const store = TestBed.inject(BuildsStore);
    await store.load();
    const kit = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'bodykits',
    )!;
    const wheel = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'wheels',
    )!;
    expect(
      (
        await store.save({
          name: 'Conflict',
          carId: catalogCars[0].id,
          partIds: [kit.id, wheel.id],
        })
      ).ok,
    ).toBe(false);
    expect(store.builds()).toEqual([]);
    expect(
      (await store.save({ name: 'Complete kit', carId: catalogCars[0].id, partIds: [kit.id] })).ok,
    ).toBe(true);
  });

  it('loads legacy mixed builds without silently overwriting them and requests a corrected save', async () => {
    const kit = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'bodykits',
    )!;
    const front = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'front',
    )!;
    const legacy = {
      id: 'legacy',
      name: 'Old build',
      carId: catalogCars[0].id,
      partIds: [kit.id, front.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(BUILDS_STORAGE_KEY, JSON.stringify([legacy]));
    const fixture = TestBed.createComponent(MyBuilds);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    await page.store.load();
    expect(page.store.builds()[0].partIds).toEqual([kit.id, front.id]);
    page.editBuild(page.store.builds()[0]);
    expect(page.partIds()).toEqual([kit.id]);
    expect(page.dirty()).toBe(true);
    expect(page.message()).toContain('กรุณาตรวจสอบ');
    expect(JSON.parse(storage.getItem(BUILDS_STORAGE_KEY)!)[0].partIds).toEqual([kit.id, front.id]);
  });
  it('opens publishing settings and keeps the dialog open if the backend rejects the change', async () => {
    const fixture=TestBed.createComponent(MyBuilds); fixture.detectChanges(); await fixture.whenStable();
    const page=fixture.componentInstance;
    const build={id:'own',name:'My private car',carId:'f8-tributo',partIds:[],isPublic:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    page.store.builds.set([build]);
    const dialog=fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperty(dialog,'showModal',{configurable:true,value:()=>dialog.setAttribute('open','')});
    Object.defineProperty(dialog,'close',{configurable:true,value:()=>dialog.removeAttribute('open')});
    page.requestVisibility(build); fixture.detectChanges(); await fixture.whenStable();
    expect(dialog.textContent).toContain('ตั้งค่าการเผยแพร่ Build');
    expect(dialog.querySelectorAll('input[type=radio]').length).toBe(2);
    expect(page.visibilityPublic()).toBe(false);
    page.visibilityPublic.set(true);
    const save=vi.spyOn(page.store,'setVisibility').mockResolvedValueOnce({ok:false,error:'offline'});
    await page.saveVisibility(); fixture.detectChanges();
    expect(dialog.textContent).toContain('offline'); expect(dialog.hasAttribute('open')).toBe(true);
    save.mockResolvedValueOnce({ok:true}); await page.saveVisibility();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(page.message()).toContain('เผยแพร่');
  });

});
