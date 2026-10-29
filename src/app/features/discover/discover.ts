import {
  Component,
  computed,
  inject,
  signal,
  ElementRef,
  viewChild,
  afterNextRender,
  Injector,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Catalog } from '../catalog/catalog';
import { MyBuilds } from '../my-builds/my-builds';
import { catalogCars } from '../catalog/catalog.data';
import { Compare } from '../compare/compare';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { BuildCard } from './components/build-card/build-card';
import { ShowcaseBuild, showcaseBuilds } from './discover.data';
import { AuthService } from '../../core/auth/auth.service';
import { AccountMenu } from '../../shared/ui/account-menu/account-menu';
import { Profile } from '../profile/profile';

type Tab = 'Discover' | 'Catalog' | 'Compare' | 'My Builds' | 'Profile';
@Component({
  selector: 'app-discover',
  imports: [
    RouterLink,
    Icon,
    BuildCard,
    DecimalPipe,
    Catalog,
    Compare,
    MyBuilds,
    AccountMenu,
    Profile,
  ],
  templateUrl: './discover.html',
  styleUrl: './discover.css',
})
export class Discover {
  readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly createRequest = signal(this.route.snapshot.data['builder'] ? 1 : 0);
  readonly sourceCarId = signal<string | null>(this.route.snapshot.queryParamMap.get('car'));
  readonly buildHeading = signal(
    this.route.snapshot.data['builder'] ? 'Create Build' : 'My Builds',
  );
  readonly tabs: { name: Tab; icon: string }[] = [
    { name: 'Discover', icon: 'discover' },
    { name: 'Catalog', icon: 'catalog' },
    { name: 'Compare', icon: 'compare' },
    { name: 'My Builds', icon: 'builds' },
  ];
  readonly activeTab = signal<Tab>(
    (inject(ActivatedRoute).snapshot.data['tab'] ?? 'Discover') as Tab,
  );
  readonly query = signal('');
  readonly category = signal('All');
  readonly filtersOpen = signal(false);
  readonly saved = signal<number[]>([]);
  readonly savedOnly = signal(false);
  readonly selected = signal<ShowcaseBuild | null>(null);
  readonly modal = signal<'details' | 'notifications'>('details');
  readonly status = signal('');
  readonly buildsWorkspace = viewChild(MyBuilds);
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly categories = ['All', 'Street', 'Track', 'Show'];
  readonly visibleBuilds = computed(() => {
    const source = showcaseBuilds;
    const search = this.query().trim().toLowerCase();
    return source.filter(
      (b) =>
        (!search || [b.title, b.author, b.car].join(' ').toLowerCase().includes(search)) &&
        (this.category() === 'All' || b.category === this.category()) &&
        (!this.savedOnly() || this.saved().includes(b.id)),
    );
  });

  constructor() {
    afterNextRender(() => {
      void this.auth.initialize();
    });
  }

  switchTab(tab: Tab): void {
    if (tab === 'My Builds' && !this.auth.user()) {
      void this.router.navigate(['/login'], { queryParams: { next: '/my-builds' } });
      return;
    }
    const workspace = this.buildsWorkspace();
    if (this.activeTab() === 'My Builds' && workspace?.editing()) {
      if (tab === 'My Builds') workspace.requestBack();
      else workspace.requestLeave(() => this.applyTab(tab));
      return;
    }
    this.applyTab(tab);
  }
  private applyTab(tab: Tab): void {
    this.createRequest.set(0);
    this.sourceCarId.set(null);
    this.buildHeading.set('My Builds');
    if (
      this.route.snapshot.data['builder'] ||
      this.route.snapshot.data['tab'] === 'Profile' ||
      tab === 'Profile'
    ) {
      const urls: Record<Tab, string> = {
        Discover: '/discover',
        Catalog: '/catalog',
        Compare: '/compare',
        'My Builds': '/my-builds',
        Profile: '/profile',
      };
      void this.router.navigateByUrl(urls[tab]);
    }
    this.status.set('');
    this.activeTab.set(tab);
    this.query.set('');
    this.category.set('All');
    this.savedOnly.set(false);
  }
  toggleSaved(build: ShowcaseBuild): void {
    this.saved.update((ids) =>
      ids.includes(build.id) ? ids.filter((id) => id !== build.id) : [...ids, build.id],
    );
  }
  showDetails(build: ShowcaseBuild): void {
    this.selected.set(build);
    this.modal.set('details');
    this.openModal();
  }
  openCreate(build?: ShowcaseBuild): void {
    if (this.dialog().nativeElement.open) this.close();
    const car = catalogCars.find((car) => car.name === build?.car);
    void this.router.navigate(['/build/new'], { queryParams: car ? { car: car.id } : {} });
  }

  signOut(): void {
    const leave = async () => {
      if (await this.auth.signOut()) await this.router.navigateByUrl('/login');
      else this.status.set(this.auth.error());
    };
    const workspace = this.buildsWorkspace();
    if (workspace?.editing())
      workspace.requestLeave(() => {
        void leave();
      });
    else void leave();
  }
  onBuildHeading(heading: string): void {
    this.buildHeading.set(heading);
    if (heading === 'My Builds' && this.route.snapshot.data['builder']) {
      void this.router.navigateByUrl('/my-builds');
    }
  }
  notifications(): void {
    this.modal.set('notifications');
    this.openModal();
  }
  showProfile(): void {
    const workspace = this.buildsWorkspace();
    const open = () => this.applyTab('Profile');
    if (workspace?.editing()) workspace.requestLeave(open);
    else open();
  }
  private openModal(): void {
    if (this.dialog().nativeElement.open) return;
    // Render the selected content before native dialog positioning and autofocus.
    afterNextRender(
      () => {
        const dialog = this.dialog().nativeElement;
        if (!dialog.open) dialog.showModal();
      },
      { injector: this.injector },
    );
  }
  close(): void {
    this.dialog().nativeElement.close();
  }
}
