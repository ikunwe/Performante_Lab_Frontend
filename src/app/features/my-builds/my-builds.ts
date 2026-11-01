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
import { LoadingSkeleton } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { Icon } from '../../shared/ui/icon/icon';
import {
  catalogBrandLogos,
  catalogCars,
  partCategories,
  CatalogCar,
  CatalogPart,
} from '../catalog/catalog.data';
import { BuildsStore, SavedBuild, buildCategories } from './builds.store';
import { BrandDirectory, CarBrand } from '../../core/catalog/brand-directory';
import { LogoBackdrop } from '../../shared/ui/brand-logo/logo-backdrop';
import { modelImage } from '../../core/catalog/car-images';
import { partsForCar, preparedPreview, preparedViewState } from '../../core/catalog/prepared-parts';
import { viewsForCar } from '../../core/catalog/car-views';
import { CarViewId } from '../../core/catalog/car-view-manifest';
import {
  ModelDirectory,
  VehicleModel,
  VehicleGeneration,
} from '../../core/catalog/model-directory';

@Component({
  selector: 'app-my-builds',
  imports: [LoadingSkeleton, Icon, DatePipe, LogoBackdrop],
  templateUrl: './my-builds.html',
  host: { class: 'block' },
})
export class MyBuilds {
  readonly store = inject(BuildsStore);
  readonly brandDirectory = inject(BrandDirectory);
  readonly modelDirectory = inject(ModelDirectory);
  readonly modelQuery = signal('');
  readonly selectedModelId = signal<string | null>(null);
  readonly referenceCar = signal<CatalogCar | null>(null);
  readonly selectedBrand = computed(
    () =>
      this.brandDirectory
        .brands()
        .find((item) => this.brandKey(item.name) === this.brandKey(this.brand() ?? '')) ?? null,
  );
  readonly modelList = computed(() => {
    if (this.modelDirectory.loading()) return [];
    const query = this.modelQuery().trim().toLowerCase();
    return this.modelDirectory
      .models()
      .filter(
        (model) =>
          !query ||
          [
            model.name,
            ...model.generations.flatMap((generation) => [
              generation.name,
              ...generation.chassisCodes,
            ]),
          ].some((name) => name.toLowerCase().includes(query)),
      );
  });
  readonly selectedModel = computed(
    () => this.modelDirectory.models().find((model) => model.id === this.selectedModelId()) ?? null,
  );
  readonly brandQuery = signal('');
  readonly brokenBrandLogos = signal<string[]>([]);
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
  readonly buildCategories = buildCategories;
  readonly buildCategory = signal<string>('Street');
  readonly query = signal('');
  readonly message = signal('');
  readonly formError = signal('');
  readonly modalKind = signal<'save' | 'delete' | 'discard' | 'change-car' | 'replace-kit' | 'visibility'>('save');
  readonly pendingDelete = signal<SavedBuild | null>(null);
  readonly pendingCar = signal<CatalogCar | null>(null);
  readonly pendingKit = signal<CatalogPart | null>(null);
  readonly baseline = signal('');
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('buildDialog');
  readonly brands = computed(() => {
    if (this.brandDirectory.loading()) return [];
    const query = this.brandQuery().trim().toLowerCase();
    return this.brandDirectory
      .brands()
      .filter(
        (brand) =>
          !query ||
          [brand.name, ...brand.aliases].some((name) => name.toLowerCase().includes(query)),
      );
  });
  get logos() {
    return catalogBrandLogos();
  }
  readonly categories = partCategories.filter(category => ['bodykits','front','rear','wheels','spoilers'].includes(category.id)).map(category => ({...category,name:({bodykits:'Full Body Kits',front:'Front Bumper',rear:'Rear Bumper',wheels:'Wheels',spoilers:'Spoilers'} as Record<string,string>)[category.id]}));
  readonly car = computed(() =>
    this.referenceCar()?.id === this.carId()
      ? this.referenceCar()
      : (catalogCars().find((car) => car.id === this.carId()) ?? null),
  );
  readonly brandCars = computed(() =>
    catalogCars().filter((car) => this.brandKey(car.brand) === this.brandKey(this.brand() ?? '')),
  );
  private brandKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  brandLogo(brand: CarBrand): string | null {
    if (this.brokenBrandLogos().includes(brand.id)) return null;
    return brand.logoUrl;
  }
  hasDemoCars(brand: CarBrand): boolean {
    return catalogCars().some((car) => this.brandKey(car.brand) === this.brandKey(brand.name));
  }
  yearLabel(start: number | null, end: number | null): string {
    if (start === null && end === null) return 'ยังไม่มีข้อมูลปี';
    return `${start ?? 'ไม่ระบุ'} – ${end ?? 'ไม่ระบุปีสิ้นสุด'}`;
  }
  readonly modelImage = modelImage;
  readonly availableParts = computed(() => partsForCar(this.car()));
  readonly selectedView = signal<CarViewId>('front45');
  readonly carViews = computed(() => viewsForCar(this.car()));
  readonly activeView = computed(
    () =>
      this.carViews().find((view) => view.view === this.selectedView()) ??
      this.carViews()[0] ??
      null,
  );
  readonly previewState = computed(() =>
    preparedViewState(this.car(), this.partIds(), this.activeView()?.view ?? 'front45'),
  );
  readonly hasPreparedPreview = computed(() => !!this.previewState().image);
  readonly missingPartView = computed(() => this.previewState().missing.length > 0);
  readonly previewImage = computed(
    () => this.previewState().image ?? this.activeView()?.url ?? this.carImage(this.car()),
  );
  viewImage(view: CarViewId): string | null {
    return (
      preparedPreview(this.car(), this.partIds(), view) ??
      this.carViews().find((item) => item.view === view)?.url ??
      null
    );
  }
  selectView(view: CarViewId): void {
    if (this.carViews().some((item) => item.view === view)) this.selectedView.set(view);
  }
  buildImage(build: SavedBuild): string | null {
    const car = this.carFor(build);
    return (
      preparedPreview(car, build.partIds) ??
      preparedPreview(car, build.partIds, 'rear45') ??
      this.carImage(car)
    );
  }
  carImage(car: CatalogCar | null | undefined): string | null {
    if (!car) return null;
    if (car.storagePath) return car.image || null;
    const ref = car.reference;
    return ref
      ? (viewsForCar(car)[0]?.url ??
          modelImage(
            ref.brandId,
            ref.modelName,
            ref.generationName ? { name: ref.generationName, yearStart: ref.yearStart } : undefined,
          ))
      : car.image || null;
  }
  chooseModel(model: VehicleModel): void {
    if (model.brandId !== this.selectedBrand()?.id) return;
    const car = catalogCars().find((car) => car.id === model.id);
    if (car) this.chooseCar(car);
    else this.chooseReference(model, null);
  }
  chooseReference(model: VehicleModel, generation: VehicleGeneration | null): void {
    const brand = this.selectedBrand();
    if (
      !brand ||
      model.brandId !== brand.id ||
      (generation && !model.generations.some((item) => item.id === generation.id))
    )
      return;
    this.chooseCar({
      id: 'ref:' + (generation?.id ?? model.id),
      brand: brand.name,
      name: `${brand.name} ${model.name}`,
      image: '',
      body: generation?.name ?? 'ยังไม่มีข้อมูลเจเนอเรชัน',
      reference: {
        brandId: brand.id,
        modelId: model.id,
        generationId: generation?.id ?? null,
        modelName: model.name,
        generationName: generation?.name ?? null,
        chassisCodes: generation?.chassisCodes ?? [],
        yearStart: generation ? generation.yearStart : model.yearStart,
        yearEnd: generation ? generation.yearEnd : model.yearEnd,
        sourceUrl: model.sourceUrl,
      },
    });
  }
  markBrandLogoBroken(id: string): void {
    this.brokenBrandLogos.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }
  readonly selectedParts = computed(() =>
    this.availableParts().filter((part) => this.partIds().includes(part.id)),
  );
  readonly fullBodyKit = computed(
    () => this.selectedParts().find((part) => part.category === 'bodykits') ?? null,
  );
  partsFor(category: string): CatalogPart[] {
    return this.availableParts().filter((part) => part.category === category);
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
      const brand = this.selectedBrand();
      if (this.editing() && this.section() === 'car' && brand)
        untracked(() => {
          this.selectedModelId.set(null);
          this.modelQuery.set('');
          void this.modelDirectory.load(brand.id);
        });
    });
    effect(() => {
      if (this.editing() && this.section() === 'car')
        untracked(() => {
          void this.brandDirectory.load();
        });
    });
    effect(() => {
      const request = this.createRequest();
      const source = this.sourceCarId();
      if (request > 0) untracked(() => this.startNew(source));
    });
  }
  private snapshot(): string {
    return JSON.stringify([this.carId(), [...this.partIds()].sort(), this.buildCategory()]);
  }
  carFor(build: SavedBuild): CatalogCar | undefined {
    if (build.carId.startsWith('storage-car:'))
      return catalogCars().find((car) => car.id === build.carId) ?? build.carSnapshot;
    return build.carSnapshot ?? catalogCars().find((car) => car.id === build.carId);
  }
  startNew(sourceId: string | null = null): void {
    if (this.editing() && this.dirty()) {
      this.requestLeave(() => this.beginNew(sourceId));
      return;
    }
    this.beginNew(sourceId);
  }
  private beginNew(sourceId: string | null): void {
    this.selectedView.set('front45');
    this.referenceCar.set(null);
    const car = catalogCars().find((car) => car.id === sourceId);
    this.editingId.set(null);
    this.carId.set(car?.id ?? null);
    this.brand.set(car?.brand ?? null);
    this.partIds.set([]);
    this.section.set(car ? 'bodykits' : 'car');
    this.name.set('');
    this.buildCategory.set('Street');
    this.message.set('');
    this.editing.set(true);
    this.baseline.set(this.snapshot());
    this.headingChange.emit('Create Build');
  }
  editBuild(build: SavedBuild): void {
    this.selectedView.set('front45');
    this.referenceCar.set(build.carSnapshot ?? null);
    this.editingId.set(build.id);
    this.carId.set(build.carId);
    this.brand.set(this.carFor(build)?.brand ?? null);
    const kit = partsForCar(this.carFor(build)).find(
      (part) => build.partIds.includes(part.id) && part.category === 'bodykits',
    );
    const legacyConflict = !!kit && build.partIds.length > 1;
    this.partIds.set(legacyConflict ? [kit.id] : [...build.partIds]);
    this.name.set(build.name);
    this.buildCategory.set(buildCategories.some(category => category === build.category) ? build.category! : 'Street');
    this.section.set('bodykits');
    this.editing.set(true);
    this.message.set('');
    this.baseline.set(this.snapshot());
    if (legacyConflict) {
      this.baseline.set(JSON.stringify([build.carId, [...build.partIds].sort(), this.buildCategory()]));
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
    this.selectedView.set('front45');
    this.referenceCar.set(car.reference ? car : null);
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
    if (part.previewImage) {
      const currentView = this.activeView()?.view ?? this.selectedView();
      if (part.category === 'wheels') {
        if (currentView !== 'front45' && currentView !== 'rear45') this.selectedView.set('front45');
      } else if (part.category === 'spoilers') {
        if (!['front45', 'rear45', 'rear'].includes(currentView)) this.selectedView.set('rear45');
      } else {
        const rear = part.category === 'rear';
        const sameSide = rear ? ['rear', 'rear45'] : ['front', 'front45'];
        if (!sameSide.includes(currentView)) this.selectedView.set(rear ? 'rear45' : 'front45');
      }
    }
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
        (id) => this.availableParts().find((item) => item.id === id)?.category !== part.category,
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
  async save(): Promise<void> {
    if (!this.carId() || this.store.saving() || this.store.deleting()) return;
    const result = await this.store.save({
      carSnapshot: this.car()?.reference ? this.car()! : undefined,
      id: this.editingId() ?? undefined,
      name: this.name(),
      category: this.buildCategory(),
      carId: this.carId()!,
      partIds: this.partIds(),
    });
    if (result.ok === false) {
      this.formError.set(result.error);
      return;
    }
    this.closeDialog();
    this.showList();
    this.message.set('บันทึก Build ในบัญชีของคุณแล้ว');
  }
  readonly visibilityBuild = signal<SavedBuild | null>(null);
  readonly visibilityPublic = signal(false);
  requestVisibility(build: SavedBuild): void {
    if (this.store.saving() || this.store.deleting()) return;
    this.visibilityBuild.set(build);
    this.visibilityPublic.set(build.isPublic === true);
    this.formError.set('');
    this.modalKind.set('visibility');
    this.openDialog();
  }
  async saveVisibility(): Promise<void> {
    const build = this.visibilityBuild();
    if (!build || this.store.saving() || this.store.deleting()) return;
    this.formError.set('');
    const result = await this.store.setVisibility(build.id,this.visibilityPublic());
    if (!result.ok) { this.formError.set(result.error); return; }
    this.message.set(this.visibilityPublic() ? 'เผยแพร่ Build บน Discover แล้ว' : 'เปลี่ยน Build เป็นส่วนตัวแล้ว');
    this.closeDialog();
  }
  requestDelete(build: SavedBuild): void {
    this.pendingDelete.set(build);
    this.formError.set('');
    this.modalKind.set('delete');
    this.openDialog();
  }
  async confirmDelete(): Promise<void> {
    const build = this.pendingDelete();
    if (!build || this.store.deleting() || this.store.saving()) return;
    const result = await this.store.remove(build.id);
    if (result.ok === false) {
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
  onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closeDialog();
  }
  onDialogCancel(event: Event): void {
    if (this.store.saving() || this.store.deleting()) event.preventDefault();
  }
  closeDialog(): void {
    if (this.store.saving() || this.store.deleting()) return;
    this.pendingLeave = null;
    this.dialog().nativeElement.close();
  }
}
