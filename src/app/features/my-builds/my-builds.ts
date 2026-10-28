import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import {
  catalogBrandLogos,
  catalogCars,
  catalogParts,
  partCategories,
  CatalogCar,
  CatalogPart,
} from '../catalog/catalog.data';
import { BuildsStore, SavedBuild } from './builds.store';

@Component({
  selector: 'app-my-builds',
  imports: [Icon, DatePipe],
  templateUrl: './my-builds.html',
  host: { class: 'block' },
})
export class MyBuilds {
  readonly store = inject(BuildsStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private pendingLeave: (() => void) | null = null;
  private readonly injector = inject(Injector);
  readonly createRequest = input(0);
  readonly sourceCarId = input<string | null>(null);
  readonly headingChange = output<string>();
  readonly editing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly carId = signal<string | null>(null);
  readonly brand = signal<string | null>(null);
  readonly partIds = signal<string[]>([]);
  readonly section = signal('car');
  readonly name = signal('');
  readonly query = signal('');
  readonly message = signal('');
  readonly formError = signal('');
  readonly modalKind = signal<'save' | 'delete' | 'discard' | 'change-car' | 'replace-kit'>('save');
  readonly pendingDelete = signal<SavedBuild | null>(null);
  readonly pendingCar = signal<CatalogCar | null>(null);
  readonly pendingKit = signal<CatalogPart | null>(null);
  readonly baseline = signal('');
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('buildDialog');
  readonly brands = Object.keys(catalogBrandLogos);
  readonly logos = catalogBrandLogos;
  readonly categories = partCategories;
  readonly car = computed(() => catalogCars.find((car) => car.id === this.carId()) ?? null);
  readonly brandCars = computed(() => catalogCars.filter((car) => car.brand === this.brand()));
  readonly selectedParts = computed(() =>
    catalogParts.filter((part) => this.partIds().includes(part.id)),
  );
  readonly fullBodyKit = computed(
    () => this.selectedParts().find((part) => part.category === 'bodykits') ?? null,
  );
  partsFor(category: string): CatalogPart[] {
    return catalogParts.filter((part) => part.carId === this.carId() && part.category === category);
  }
  jumpTo(id: string): void {
    const target: HTMLElement | null = this.host.nativeElement.querySelector('#' + id);
    target?.scrollIntoView?.({ block: 'start' });
  }
  categoryLabel(id: string): string {
    return this.categories.find((category) => category.id === id)?.name ?? id;
  }
  readonly visibleBuilds = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.store
      .builds()
      .filter((build) =>
        [build.name, this.carFor(build)?.name].join(' ').toLowerCase().includes(query),
      );
  });
  readonly dirty = computed(() => this.snapshot() !== this.baseline());

  constructor() {
    effect(() => {
      const request = this.createRequest();
      const source = this.sourceCarId();
      if (request > 0) untracked(() => this.startNew(source));
    });
  }
  private snapshot(): string {
    return JSON.stringify([this.carId(), [...this.partIds()].sort()]);
  }
  carFor(build: SavedBuild): CatalogCar | undefined {
    return catalogCars.find((car) => car.id === build.carId);
  }
  startNew(sourceId: string | null = null): void {
    if (this.editing() && this.dirty()) {
      this.requestLeave(() => this.beginNew(sourceId));
      return;
    }
    this.beginNew(sourceId);
  }
  private beginNew(sourceId: string | null): void {
    const car = catalogCars.find((car) => car.id === sourceId);
    this.editingId.set(null);
    this.carId.set(car?.id ?? null);
    this.brand.set(car?.brand ?? null);
    this.partIds.set([]);
    this.section.set(car ? 'bodykits' : 'car');
    this.name.set('');
    this.message.set('');
    this.editing.set(true);
    this.baseline.set(this.snapshot());
    this.headingChange.emit('Create Build');
  }
  editBuild(build: SavedBuild): void {
    this.editingId.set(build.id);
    this.carId.set(build.carId);
    this.brand.set(this.carFor(build)?.brand ?? null);
    const kit = catalogParts.find(
      (part) => build.partIds.includes(part.id) && part.category === 'bodykits',
    );
    const legacyConflict = !!kit && build.partIds.length > 1;
    this.partIds.set(legacyConflict ? [kit.id] : [...build.partIds]);
    this.name.set(build.name);
    this.section.set('bodykits');
    this.editing.set(true);
    this.message.set('');
    this.baseline.set(this.snapshot());
    if (legacyConflict) {
      this.baseline.set(JSON.stringify([build.carId, [...build.partIds].sort()]));
      this.message.set(
        'Build เดิมมีชุดเต็มร่วมกับพาร์ตแยก จึงใช้เฉพาะ Full Body Kit ตามกฎใหม่ กรุณาตรวจสอบแล้ว Save อีกครั้ง',
      );
    }
    this.headingChange.emit('Edit Build');
  }
  chooseCar(car: CatalogCar): void {
    if (this.carId() === car.id) {
      this.section.set('bodykits');
      return;
    }
    if (this.partIds().length) {
      this.pendingCar.set(car);
      this.modalKind.set('change-car');
      this.openDialog();
      return;
    }
    this.applyCar(car);
  }
  private applyCar(car: CatalogCar): void {
    this.carId.set(car.id);
    this.brand.set(car.brand);
    this.partIds.set([]);
    this.section.set('bodykits');
  }
  togglePart(part: CatalogPart): void {
    if (part.carId !== this.carId()) return;
    if (this.partIds().includes(part.id)) {
      this.removePart(part.id);
      return;
    }
    if (part.category !== 'bodykits' && this.fullBodyKit()) return;
    if (part.category === 'bodykits') {
      if (this.selectedParts().some((item) => item.category !== 'bodykits')) {
        this.pendingKit.set(part);
        this.formError.set('');
        this.modalKind.set('replace-kit');
        this.openDialog();
        return;
      }
      this.partIds.set([part.id]);
      return;
    }
    this.partIds.update((ids) => [
      ...ids.filter(
        (id) => catalogParts.find((item) => item.id === id)?.category !== part.category,
      ),
      part.id,
    ]);
  }
  confirmFullKit(): void {
    const kit = this.pendingKit();
    if (kit?.carId === this.carId()) this.partIds.set([kit.id]);
    this.closeDialog();
    this.pendingKit.set(null);
  }
  removePart(id: string): void {
    this.partIds.update((ids) => ids.filter((item) => item !== id));
  }
  requestSave(): void {
    if (!this.car()) return;
    this.formError.set('');
    this.modalKind.set('save');
    this.openDialog();
  }
  save(): void {
    if (!this.carId()) return;
    const result = this.store.save({
      id: this.editingId() ?? undefined,
      name: this.name(),
      carId: this.carId()!,
      partIds: this.partIds(),
    });
    if (!result.ok) {
      this.formError.set(result.error);
      return;
    }
    this.closeDialog();
    this.showList();
    this.message.set('บันทึก Build ในเบราว์เซอร์เครื่องนี้แล้ว');
  }
  requestDelete(build: SavedBuild): void {
    this.pendingDelete.set(build);
    this.formError.set('');
    this.modalKind.set('delete');
    this.openDialog();
  }
  confirmDelete(): void {
    const build = this.pendingDelete();
    if (!build) return;
    const result = this.store.remove(build.id);
    if (!result.ok) {
      this.formError.set(result.error);
      return;
    }
    this.closeDialog();
    this.message.set('ลบ Build แล้ว');
  }
  requestBack(): void {
    this.requestLeave(() => this.showList());
  }
  requestLeave(action: () => void): void {
    if (!this.dirty()) {
      action();
      return;
    }
    this.pendingLeave = action;
    this.formError.set('');
    this.modalKind.set('discard');
    this.openDialog();
  }
  confirmDiscard(): void {
    const action = this.pendingLeave;
    this.closeDialog();
    action?.();
  }
  confirmCarChange(): void {
    const car = this.pendingCar();
    if (car) this.applyCar(car);
    this.closeDialog();
    this.pendingCar.set(null);
  }
  private showList(): void {
    this.editing.set(false);
    this.headingChange.emit('My Builds');
  }
  private openDialog(): void {
    if (this.dialog().nativeElement.open) return;
    afterNextRender(() => this.dialog().nativeElement.showModal(), { injector: this.injector });
  }
  closeDialog(): void {
    this.pendingLeave = null;
    this.dialog().nativeElement.close();
  }
}
