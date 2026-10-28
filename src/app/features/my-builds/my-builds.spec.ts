import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BUILDS_STORAGE, BUILDS_STORAGE_KEY, BuildsStore } from './builds.store';
import { MyBuilds } from './my-builds';
import { catalogCars, catalogParts } from '../catalog/catalog.data';

describe('My Builds and local storage', () => {
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
      providers: [{ provide: BUILDS_STORAGE, useValue: storage }],
    });
  });

  it('saves, reloads, updates and deletes a build without changing its identity', () => {
    const store = TestBed.inject(BuildsStore);
    store.load();
    const part = catalogParts.find((part) => part.carId === catalogCars[0].id)!;
    expect(
      store.save({ name: '  Weekend spec  ', carId: catalogCars[0].id, partIds: [part.id] }).ok,
    ).toBe(true);
    const first = store.builds()[0];
    expect(first.name).toBe('Weekend spec');
    store.builds.set([]);
    store.load();
    expect(store.builds()[0]).toEqual(first);
    store.save({ ...first, name: 'Updated spec', partIds: [] });
    expect(store.builds().length).toBe(1);
    expect(store.builds()[0].id).toBe(first.id);
    expect(store.builds()[0].createdAt).toBe(first.createdAt);
    expect(store.remove(first.id).ok).toBe(true);
    store.load();
    expect(store.builds()).toEqual([]);
  });

  it('rejects blank names and parts from a different car', () => {
    const store = TestBed.inject(BuildsStore);
    store.load();
    const wrongPart = catalogParts.find((part) => part.carId === catalogCars[1].id)!;
    expect(store.save({ name: ' ', carId: catalogCars[0].id, partIds: [] }).ok).toBe(false);
    expect(
      store.save({ name: 'Invalid', carId: catalogCars[0].id, partIds: [wrongPart.id] }).ok,
    ).toBe(false);
    expect(store.builds()).toEqual([]);
  });

  it('does not overwrite current state when browser storage fails', () => {
    const store = TestBed.inject(BuildsStore);
    store.load();
    store.save({ name: 'Original', carId: catalogCars[0].id, partIds: [] });
    const original = store.builds()[0];
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(store.save({ ...original, name: 'Unsaved update' }).ok).toBe(false);
    expect(store.builds()[0].name).toBe('Original');
    expect(store.remove(original.id).ok).toBe(false);
    expect(store.builds().length).toBe(1);
  });

  it('selects one part per category and restores saved selections in the editor', () => {
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
    page.store.save({ name: 'Restore me', carId: catalogCars[0].id, partIds: [first.id] });
    page.editBuild(page.store.builds()[0]);
    expect(page.selectedParts().map((part) => part.id)).toEqual([first.id]);
    expect(page.dirty()).toBe(false);
    page.removePart(first.id);
    expect(page.dirty()).toBe(true);
  });

  it('asks for a name only after editing and preserves work when storage rejects a save', async () => {
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
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    page.save();
    expect(page.formError()).toContain('บันทึกไม่ได้');
    expect(page.editing()).toBe(true);
    expect(page.partIds().length).toBe(1);
    expect(dialog.open).toBe(true);
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

  it('rejects saving a full kit mixed with any separate part', () => {
    const store = TestBed.inject(BuildsStore);
    store.load();
    const kit = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'bodykits',
    )!;
    const wheel = catalogParts.find(
      (part) => part.carId === catalogCars[0].id && part.category === 'wheels',
    )!;
    expect(
      store.save({ name: 'Conflict', carId: catalogCars[0].id, partIds: [kit.id, wheel.id] }).ok,
    ).toBe(false);
    expect(store.builds()).toEqual([]);
    expect(
      store.save({ name: 'Complete kit', carId: catalogCars[0].id, partIds: [kit.id] }).ok,
    ).toBe(true);
  });

  it('loads legacy mixed builds without silently overwriting them and requests a corrected save', () => {
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
    page.store.load();
    expect(page.store.builds()[0].partIds).toEqual([kit.id, front.id]);
    page.editBuild(page.store.builds()[0]);
    expect(page.partIds()).toEqual([kit.id]);
    expect(page.dirty()).toBe(true);
    expect(page.message()).toContain('กรุณาตรวจสอบ');
    expect(JSON.parse(storage.getItem(BUILDS_STORAGE_KEY)!)[0].partIds).toEqual([kit.id, front.id]);
  });
});
