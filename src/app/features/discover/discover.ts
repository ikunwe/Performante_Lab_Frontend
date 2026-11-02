import { workspaceVisibility } from '../../shared/ui/workspace-visibility';
import { LikesStore } from '../liked/likes.store';
import { DiscoverFeedStore, discoverRevision } from './discover-feed.store';
import { StorageCatalogStore } from '../../core/catalog/storage-catalog';
import {
  Component,
  computed,
  inject,
  signal,
  ElementRef,
  viewChild,
  afterNextRender,
  Injector,
  effect,
  untracked,
} from '@angular/core';
import { Catalog } from '../catalog/catalog';
import { MyBuilds } from '../my-builds/my-builds';
import { catalogCars, buildPartCategories } from '../catalog/catalog.data';
import { Compare } from '../compare/compare';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { ShowcaseImage } from './components/showcase-image/showcase-image';
import { BuildCard } from './components/build-card/build-card';
import { ShowcaseBuild } from './discover.data';
import { AuthService } from '../../core/auth/auth.service';
import { AccountAvatar } from '../../shared/ui/account-avatar/account-avatar';
import { AccountMenu } from '../../shared/ui/account-menu/account-menu';
import { Profile } from '../profile/profile';
import { BuildsStore } from '../my-builds/builds.store';

import { UserRequests } from '../requests/user-requests';
import { LoadingSkeleton } from '../../shared/ui/loading-skeleton/loading-skeleton';

type Tab = 'Discover' | 'Catalog' | 'Compare' | 'My Builds' | 'Profile' | 'Requests' | 'Liked';
@Component({
  selector: 'app-discover',
  imports: [
    RouterLink,
    Icon,
    BuildCard,
    ShowcaseImage,
    Catalog,
    Compare,
    MyBuilds,
    AccountMenu,
    AccountAvatar,
    Profile, UserRequests, LoadingSkeleton,
  ],
  templateUrl: './discover.html',
  styleUrl: './discover.css',
})
export class Discover {
  readonly uiVisibility = workspaceVisibility;
  readonly auth = inject(AuthService);
  readonly feed = inject(DiscoverFeedStore);
  readonly likes = inject(LikesStore);
  private readonly catalog = inject(StorageCatalogStore);
  readonly ready = signal(this.auth.ready());
  readonly preparingBuild = signal(false);
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
  readonly liked = computed(()=>[...this.likes.ids()]);
  readonly likedOnly = signal(false);
  readonly selected = signal<ShowcaseBuild | null>(null);
  readonly modal = signal<'details' | 'notifications' | 'delete'>('details');
  readonly deletingBuild = signal(false);
  readonly deleteError = signal('');
  readonly status = signal('');
  readonly buildsWorkspace = viewChild(MyBuilds);
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly categories = ['All', 'Street', 'Track', 'Show'];
  readonly visibleBuilds = computed(() => {
    const source = this.activeTab() === 'Liked' ? this.likes.builds() : this.feed.builds();
    const search = this.query().trim().toLowerCase();
    return source.filter(
      (b) =>
        b.isPublic &&
        (!search || [b.title, b.author, b.car].join(' ').toLowerCase().includes(search)) &&
        (this.category() === 'All' || b.category === this.category()) &&
        (!this.likedOnly() || this.liked().includes(b.id)),
    );
  });

  constructor() {
    effect(() => {
      const ready = this.ready();
      const tab = this.activeTab();
      this.auth.user();
      discoverRevision();
      if (ready && (tab === 'Discover' || tab === 'Liked')) untracked(()=>{void this.likes.load();});
      if (ready && tab === 'Discover')
        untracked(() => {
          void this.feed.load();
        });
    });
    let previousOwner: string | null | undefined;
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      untracked(() => {
        if (previousOwner !== undefined && previousOwner !== owner) {

          this.selected.set(null);
          afterNextRender(
            () => {
              if (this.dialog().nativeElement.open) this.close();
            },
            { injector: this.injector },
          );
        }
        previousOwner = owner;
      });
    });
    afterNextRender(() => {
      void this.auth.initialize().then(() => this.ready.set(true));
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
    // The URL owns the workspace selection, including the first render after reload.
    // Wait for navigation/guards before replacing the currently visible workspace.
    const urls: Record<Tab, string> = {
      Discover: '/discover',
      Catalog: '/catalog',
      Compare: '/compare',
      'My Builds': '/my-builds',
      Profile: '/profile',
      Requests: '/requests',
      Liked: '/liked',
    };
    void this.router.navigateByUrl(urls[tab]);
  }
  readonly feedLoading=computed(()=>this.activeTab()==='Liked'?this.likes.loading():this.feed.loading());
  readonly feedError=computed(()=>this.activeTab()==='Liked'?this.likes.error():this.feed.error());
  refreshBuilds():void {if(this.activeTab()==='Liked')void this.likes.load(true);else {void this.feed.load(true);void this.likes.load(true);}}
  async toggleLike(build:ShowcaseBuild):Promise<void> {
    if(!this.auth.user()){void this.router.navigate(['/login'],{queryParams:{next:this.activeTab()==='Liked'?'/liked':'/discover'}});return;}
    const result=await this.likes.toggle(build);this.status.set(result.ok?'':result.error || 'บันทึก Like ไม่สำเร็จ');
  }
  requestDelete(build: ShowcaseBuild): void {
    if (!build.isOwn || this.deletingBuild()) return;
    this.selected.set(build);
    this.deleteError.set('');
    this.modal.set('delete');
    this.openModal();
  }
  async confirmDelete(): Promise<void> {
    const build = this.selected();
    if (!build?.isOwn || this.deletingBuild()) return;
    this.deletingBuild.set(true);
    this.deleteError.set('');
    try {
      const result = await this.injector.get(BuildsStore).remove(build.id);
      if (!result.ok) { this.deleteError.set(result.error); return; }
      this.feed.builds.update(rows => rows.filter(row => row.id !== build.id));
      this.likes.forget(build.id);
      this.status.set('ลบ Build แล้ว');
      this.dialog().nativeElement.close();
      this.selected.set(null);
    } finally {
      this.deletingBuild.set(false);
      if (!this.selected()) this.dialog().nativeElement.close();
    }
  }
  partCategoryName(category: string | null): string {
    return buildPartCategories.find(item => item.id === category)?.name || 'ของแต่ง';
  }
  showDetails(build: ShowcaseBuild): void {
    this.selected.set(build);
    this.modal.set('details');
    this.openModal();
  }
  async openCreate(build?: ShowcaseBuild): Promise<void> {
    if (this.preparingBuild()) return;
    if (this.dialog().nativeElement.open) this.close();
    this.preparingBuild.set(true);
    try {
      if (build) await this.catalog.load();
      const car = catalogCars().find((car) => car.id === build?.carId || car.name === build?.car);
      await this.router.navigate(['/build/new'], { queryParams: car ? { car: car.id } : {} });
    } finally {
      this.preparingBuild.set(false);
    }
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
  showLiked(): void {
    const open=()=>this.applyTab('Liked');const workspace=this.buildsWorkspace();
    if(workspace?.editing())workspace.requestLeave(open);else open();
  }
  showRequests(): void {
    const workspace = this.buildsWorkspace();
    const open = () => this.applyTab('Requests');
    if (workspace?.editing()) workspace.requestLeave(open);
    else open();
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
    if (this.deletingBuild()) return;
    this.dialog().nativeElement.close();
  }
}
