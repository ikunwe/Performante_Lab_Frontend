import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { StorageCatalogStore } from '../../core/catalog/storage-catalog';

import {
  RequestsApi,
  RequestKind,
  RequestRecord,
  RequestSubmission,
} from '../../core/requests/requests.api';
import { AuthService } from '../../core/auth/auth.service';
import {
  RequestDraftStorage,
  RequestDraftState,
  LocalRequestDraft,
} from '../../core/requests/request-drafts.store';
import { LoadingSkeleton } from '../../shared/ui/loading-skeleton/loading-skeleton';
interface RequestPhoto {
  id: string;
  file: File;
  url: string;
}
interface RequestDraft {
  id: string;
  kind: RequestKind;
  title: string;
  brandId: string;
  modelId: string;
  brandName: string;
  modelName: string;
  manufacturer: string;
  description: string;
  source: string;
  photos: RequestPhoto[];
  createdAt: string;
}
@Component({
  selector: 'app-user-requests',
  imports: [FormsModule, DatePipe, Icon, LoadingSkeleton],
  templateUrl: './user-requests.html',
  host: { class: 'block' },
})
export class UserRequests {
  readonly catalog = inject(StorageCatalogStore);
  private readonly api = inject(RequestsApi);
  private readonly auth = inject(AuthService);
  private readonly draftStorage = inject(RequestDraftStorage);
  readonly draftsLoading = signal(true);
  readonly savingDraft = signal(false);
  readonly draftStorageError = signal('');
  readonly draftSaveState = signal('');
  private draftOwner: string | null = null;
  private draftsReady = false;
  private ownerVersion = 0;
  private saveVersion = 0;
  private editorId: string = crypto.randomUUID();
  private editorCreatedAt = new Date().toISOString();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly draftBrowserReady = signal(false);
  readonly submitted = signal<RequestRecord[]>([]);
  readonly submitting = signal(false);
  readonly loadingRequests = signal(false);
  readonly requestsError = signal('');
  readonly cancelTarget = signal<string | null>(null);
  readonly cancellingId = signal<string | null>(null);
  private submissionId = '';
  private submissionKey = '';
  private destroyed = false;
  private requestVersion = 0;
  readonly kinds: { id: RequestKind; name: string; label: string; icon: string; note: string }[] = [
    { id: 'brand', name: 'Car Brand', label: 'แบรนด์รถ', icon: 'car', note: 'ขอเพิ่มยี่ห้อรถใหม่' },
    {
      id: 'model',
      name: 'Car Model',
      label: 'รุ่นรถ',
      icon: 'front',
      note: 'ขอเพิ่มรุ่นในแบรนด์ที่มี',
    },
    {
      id: 'bodykit',
      name: 'BodyKit',
      label: 'ชุดแต่งรอบคัน',
      icon: 'parts',
      note: 'ชุดครบทั้งคัน',
    },
    {
      id: 'part',
      name: 'Part',
      label: 'พาร์ทแยก',
      icon: 'wheel',
      note: 'กันชน ล้อ สปอยเลอร์ และอื่น ๆ',
    },
  ];
  readonly kind = signal<RequestKind>('brand');
  readonly tab = signal<'new' | 'mine'>('new');
  readonly title = signal('');
  readonly brandId = signal('');
  readonly modelId = signal('');
  readonly manufacturer = signal('');
  readonly description = signal('');
  readonly source = signal('');
  readonly photos = signal<RequestPhoto[]>([]);
  readonly drafts = signal<RequestDraft[]>([]);
  readonly reviewing = signal(false);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editingId = signal<string | null>(null);
  readonly needsBrand = computed(() => this.kind() !== 'brand');
  readonly needsModel = computed(() => this.kind() === 'bodykit' || this.kind() === 'part');
  readonly brands = computed(() => this.catalog.data().brands);
  readonly models = computed(() =>
    this.catalog.data().cars.filter((car) => car.storagePath?.split('/')[0] === this.brandId()),
  );
  readonly selectedKind = computed(() => this.kinds.find((kind) => kind.id === this.kind())!);
  readonly brandName = computed(
    () => this.brands().find((brand) => brand.id === this.brandId())?.name || '',
  );
  readonly modelName = computed(
    () => this.models().find((model) => model.id === this.modelId())?.modelName || '',
  );
  private readonly urls = new Set<string>();
  constructor() {
    void this.catalog.load();
    afterNextRender(() => {
      this.draftBrowserReady.set(true);
      void this.loadRequests();
    });
    effect(() => {
      if (!this.draftBrowserReady()) return;
      const owner = this.auth.user()?.id ?? null;
      untracked(() => {
        void this.restoreDrafts(owner);
      });
    });
    effect(() => {
      const state = this.draftSnapshot();
      this.draftsLoading();
      const busy = this.savingDraft() || this.submitting();
      if (busy) clearTimeout(this.saveTimer);
      else if (this.draftsReady && this.draftOwner) untracked(() => this.scheduleSave(state));
    });
    const pagehide = () => {
      if (this.draftsReady && this.draftOwner) void this.persistDrafts();
    };
    afterNextRender(() => window.addEventListener('pagehide', pagehide));
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
      if (this.draftsReady && this.draftOwner)
        void this.draftStorage.save(this.draftOwner, this.draftSnapshot()).catch(() => {});
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', pagehide);
      this.destroyed = true;
      for (const url of this.urls) URL.revokeObjectURL(url);
    });
  }
  private hasEditorContent(): boolean {
    return !!(
      this.title() ||
      this.description() ||
      this.source() ||
      this.manufacturer() ||
      this.brandId() ||
      this.modelId() ||
      this.photos().length ||
      this.editingId() ||
      this.kind() !== 'brand'
    );
  }
  private draftSnapshot(): RequestDraftState {
    // Read every editable signal so changes are observed even for incomplete drafts.
    const editor: LocalRequestDraft = {
      id: this.editingId() || this.editorId,
      kind: this.kind(),
      title: this.title(),
      brandId: this.brandId(),
      modelId: this.modelId(),
      brandName: this.brandName(),
      modelName: this.modelName(),
      manufacturer: this.manufacturer(),
      description: this.description(),
      source: this.source(),
      photos: this.photos().map(({ id, file }) => ({ id, file })),
      createdAt: this.editorCreatedAt,
    };
    return {
      drafts: this.drafts(),
      editor: this.hasEditorContent() ? editor : null,
      editingId: this.editingId(),
      submissionId: this.submissionId,
      submissionKey: this.submissionKey,
    };
  }
  private withPreviews(draft: LocalRequestDraft): RequestDraft {
    return {
      ...draft,
      photos: draft.photos.map((photo) => {
        const url = URL.createObjectURL(photo.file);
        this.urls.add(url);
        return { ...photo, url };
      }),
    };
  }
  private releaseUnusedPreviews(): void {
    const retained = new Set(
      [...this.photos(), ...this.drafts().flatMap((draft) => draft.photos)].map(
        (photo) => photo.url,
      ),
    );
    for (const url of this.urls)
      if (!retained.has(url)) {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
      }
  }
  private clearEditor(): void {
    this.kind.set('brand');
    this.title.set('');
    this.brandId.set('');
    this.modelId.set('');
    this.manufacturer.set('');
    this.description.set('');
    this.source.set('');
    this.photos.set([]);
    this.editingId.set(null);
    this.reviewing.set(false);
    this.submissionId = '';
    this.submissionKey = '';
    this.editorId = crypto.randomUUID();
    this.editorCreatedAt = new Date().toISOString();
  }
  async restoreDrafts(owner = this.auth.user()?.id ?? null, force = false): Promise<void> {
    if (!force && owner === this.draftOwner && this.draftsReady) return;
    const version = ++this.ownerVersion;
    clearTimeout(this.saveTimer);
    if (this.draftsReady && this.draftOwner)
      void this.draftStorage.save(this.draftOwner, this.draftSnapshot()).catch(() => {});
    if (this.draftOwner !== owner) {
      this.cancelTarget.set(null);
      if (this.draftOwner) {
        this.clearEditor();
        this.drafts.set([]);
        this.submitted.set([]);
        for (const url of this.urls) URL.revokeObjectURL(url);
        this.urls.clear();
      }
      this.draftOwner = owner;
    }
    this.draftsReady = false;
    this.draftsLoading.set(true);
    this.draftStorageError.set('');
    if (!owner) {
      this.draftsLoading.set(false);
      return;
    }
    try {
      const state = await this.draftStorage.load(owner);
      if (this.destroyed || version !== this.ownerVersion) return;
      if (state && !this.hasEditorContent() && !this.drafts().length) {
        this.drafts.set(state.drafts.map((draft) => this.withPreviews(draft)));
        if (state.editor) {
          this.editDraft(this.withPreviews(state.editor));
          this.editingId.set(state.editingId);
          this.editorId = state.editor.id;
          this.editorCreatedAt = state.editor.createdAt;
          this.submissionId = state.submissionId;
          this.submissionKey = state.submissionKey;
        } else if (state.drafts.length) this.tab.set('mine');
      }
      this.draftsReady = true;
      this.draftSaveState.set(state ? 'บันทึกฉบับร่างแล้ว' : '');
    } catch (error) {
      if (version === this.ownerVersion && !this.destroyed)
        this.draftStorageError.set(
          'กู้คืนฉบับร่างไม่สำเร็จ: ' +
            (error instanceof Error ? error.message : 'พื้นที่เก็บข้อมูลไม่พร้อมใช้งาน'),
        );
    } finally {
      if (version === this.ownerVersion && !this.destroyed) this.draftsLoading.set(false);
    }
  }
  private scheduleSave(state: RequestDraftState): void {
    clearTimeout(this.saveTimer);
    this.draftSaveState.set('กำลังบันทึกฉบับร่าง…');
    this.saveTimer = setTimeout(() => {
      void this.persistDrafts(state);
    }, 250);
  }
  async persistDrafts(state = this.draftSnapshot()): Promise<boolean> {
    clearTimeout(this.saveTimer);
    const owner = this.draftOwner,
      ownerVersion = this.ownerVersion,
      version = ++this.saveVersion;
    if (!owner || !this.draftsReady) {
      this.draftStorageError.set('ยังบันทึกฉบับร่างไม่ได้ กรุณาลองกู้คืนอีกครั้ง');
      return false;
    }
    this.draftSaveState.set('กำลังบันทึกฉบับร่าง…');
    try {
      await this.draftStorage.save(owner, state);
      if (!this.destroyed && ownerVersion === this.ownerVersion && version === this.saveVersion) {
        this.draftStorageError.set('');
        this.draftSaveState.set('บันทึกฉบับร่างแล้ว');
      }
      return !this.destroyed && ownerVersion === this.ownerVersion;
    } catch (error) {
      if (!this.destroyed && ownerVersion === this.ownerVersion && version === this.saveVersion) {
        this.draftStorageError.set(
          'ยังบันทึกฉบับร่างไม่ได้ ข้อมูลอาจหายเมื่อออกจากหน้า: ' +
            (error instanceof Error ? error.message : 'พื้นที่ไม่เพียงพอ'),
        );
        this.draftSaveState.set('');
      }
      return false;
    }
  }
  async loadRequests(): Promise<void> {
    if (this.loadingRequests() || this.cancellingId()) return;
    const version = ++this.requestVersion;
    this.loadingRequests.set(true);
    this.requestsError.set('');
    try {
      const rows = await this.api.list();
      if (!this.destroyed && version === this.requestVersion) this.submitted.set(rows.filter(row => row.status !== 'Cancelled'));
    } catch (error) {
      if (!this.destroyed && version === this.requestVersion)
        this.requestsError.set(error instanceof Error ? error.message : 'โหลดคำขอไม่สำเร็จ');
    } finally {
      if (!this.destroyed && version === this.requestVersion) this.loadingRequests.set(false);
    }
  }
  requestCancel(request: RequestRecord): void {
    if (request.status !== 'Pending' || this.cancellingId() || this.loadingRequests()) return;
    this.cancelTarget.set(request.id);
    this.requestsError.set('');
  }
  async confirmCancel(id: string): Promise<void> {
    if (
      this.cancelTarget() !== id ||
      this.cancellingId() ||
      !this.submitted().some((row) => row.id === id && row.status === 'Pending')
    )
      return;
    const owner = this.auth.user()?.id;
    this.cancellingId.set(id);
    this.requestsError.set('');
    this.message.set('');
    try {
      await this.api.cancel(id);
      if (this.destroyed || this.auth.user()?.id !== owner) return;
      this.submitted.update((rows) => rows.filter((row) => row.id !== id));
      this.cancelTarget.set(null);
      this.message.set('ยกเลิกคำขอแล้ว');
    } catch (error) {
      if (!this.destroyed && this.auth.user()?.id === owner)
        this.requestsError.set(error instanceof Error ? error.message : 'ยกเลิกคำขอไม่สำเร็จ');
    } finally {
      this.cancellingId.set(null);
    }
  }
  async submit(): Promise<void> {
    if (this.submitting() || !this.validate()) return;
    const value = {
      kind: this.kind(),
      title: this.title().trim(),
      brandId: this.needsBrand() ? this.brandId() : '',
      modelId: this.needsModel() ? this.modelId() : '',
      brandName: this.needsBrand() ? this.brandName() : '',
      modelName: this.needsModel() ? this.modelName() : '',
      manufacturer: this.manufacturer().trim(),
      description: this.description().trim(),
      source: this.source().trim(),
    };
    const submittingOwner = this.auth.user()?.id;
    const files = this.photos().map((photo) => photo.file);
    const key = JSON.stringify({
      value,
      files: files.map((file) => [file.name, file.size, file.lastModified]),
    });
    if (key !== this.submissionKey) {
      this.submissionKey = key;
      this.submissionId = crypto.randomUUID();
    }
    const data: RequestSubmission = { ...value, id: this.submissionId };
    this.submitting.set(true);
    this.error.set('');
    try {
      await this.persistDrafts();
      if (this.destroyed || this.auth.user()?.id !== submittingOwner)
        throw new Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้านี้ใหม่');
      const request = await this.api.submit(data, files);
      if (this.destroyed) return;
      ++this.requestVersion;
      this.loadingRequests.set(false);
      this.submitted.update((rows) => [request, ...rows.filter((row) => row.id !== request.id)]);
      this.drafts.update((rows) => rows.filter((row) => row.id !== this.editingId()));
      this.photos.set([]);
      const retained = new Set(
        this.drafts().flatMap((draft) => draft.photos.map((photo) => photo.url)),
      );
      for (const url of this.urls)
        if (!retained.has(url)) {
          URL.revokeObjectURL(url);
          this.urls.delete(url);
        }
      this.editingId.set(null);
      this.reviewing.set(false);
      this.tab.set('mine');
      this.title.set('');
      this.description.set('');
      this.source.set('');
      this.manufacturer.set('');
      this.submissionKey = '';
      this.submissionId = '';
      this.clearEditor();
      await this.persistDrafts();
      this.message.set('ส่งคำขอให้ผู้ดูแลแล้ว สถานะ ' + request.status);
    } catch (error) {
      if (!this.destroyed)
        this.error.set(error instanceof Error ? error.message : 'ส่งคำขอไม่สำเร็จ');
    } finally {
      if (!this.destroyed) this.submitting.set(false);
    }
  }
  chooseKind(kind: RequestKind): void {
    this.kind.set(kind);
    this.modelId.set('');
    this.error.set('');
  }
  chooseBrand(id: string): void {
    this.brandId.set(id);
    this.modelId.set('');
  }
  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files || []));
    input.value = '';
  }
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files || []));
  }
  addFiles(files: File[]): void {
    this.error.set('');
    const next = [...this.photos()];
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        this.error.set('รองรับไฟล์ PNG, JPG และ WebP เท่านั้น');
        continue;
      }
      if (!file.size || file.size > 10 * 1024 * 1024) {
        this.error.set('แต่ละรูปต้องมีขนาดไม่เกิน 10 MB และไม่เป็นไฟล์ว่าง');
        continue;
      }
      if (
        next.some(
          (photo) =>
            photo.file.name === file.name &&
            photo.file.size === file.size &&
            photo.file.lastModified === file.lastModified,
        )
      )
        continue;
      if (next.length >= 5) {
        this.error.set('แนบรูปได้สูงสุด 5 รูปต่อคำขอ');
        break;
      }
      const url = URL.createObjectURL(file);
      this.urls.add(url);
      next.push({ id: crypto.randomUUID(), file, url });
    }
    this.photos.set(next);
  }
  removePhoto(id: string): void {
    const photo = this.photos().find((photo) => photo.id === id);
    this.photos.update((photos) => photos.filter((photo) => photo.id !== id));
    if (
      photo &&
      !this.drafts().some((draft) => draft.photos.some((item) => item.url === photo.url))
    ) {
      URL.revokeObjectURL(photo.url);
      this.urls.delete(photo.url);
    }
  }
  private validate(): boolean {
    this.error.set('');
    if (!this.title().trim()) this.error.set('กรุณากรอก Title ของรายการที่ต้องการขอเพิ่ม');
    else if (this.needsBrand() && !this.brandName())
      this.error.set('กรุณาเลือกแบรนด์รถที่เกี่ยวข้อง');
    else if (this.needsModel() && !this.modelName())
      this.error.set('กรุณาเลือกรุ่นรถที่รองรับของแต่งนี้');
    else if (!this.photos().length) this.error.set('กรุณาแนบโลโก้หรือรูปอ้างอิงอย่างน้อย 1 รูป');
    else if (this.source().trim()) {
      try {
        const url = new URL(this.source().trim());
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        this.error.set('ลิงก์อ้างอิงต้องขึ้นต้นด้วย https:// หรือ http://');
      }
    }
    return !this.error();
  }
  review(): void {
    if (this.validate()) {
      this.reviewing.set(true);
      this.message.set('');
    }
  }
  async saveDraft(): Promise<void> {
    if (this.savingDraft() || this.submitting()) return;
    if (!this.validate()) {
      this.reviewing.set(false);
      return;
    }
    const existing = this.drafts().find((draft) => draft.id === this.editingId());
    const draft: RequestDraft = {
      id: existing?.id || this.editorId,
      kind: this.kind(),
      title: this.title().trim(),
      brandId: this.needsBrand() ? this.brandId() : '',
      modelId: this.needsModel() ? this.modelId() : '',
      brandName: this.needsBrand() ? this.brandName() : '',
      modelName: this.needsModel() ? this.modelName() : '',
      manufacturer: this.manufacturer().trim(),
      description: this.description().trim(),
      source: this.source().trim(),
      photos: [...this.photos()],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const drafts = [draft, ...this.drafts().filter((item) => item.id !== draft.id)];
    this.savingDraft.set(true);
    try {
      const state = {
        ...this.draftSnapshot(),
        drafts,
        editor: null,
        editingId: null,
        submissionId: '',
        submissionKey: '',
      };
      if (!(await this.persistDrafts(state))) return;
      this.drafts.set(drafts);
      this.clearEditor();
      this.releaseUnusedPreviews();
      this.tab.set('mine');
      this.message.set('บันทึกฉบับร่างพร้อมภาพในเบราว์เซอร์แล้ว ยังไม่ได้ส่งให้ผู้ดูแล');
    } finally {
      this.savingDraft.set(false);
    }
  }
  async deleteDraft(id: string): Promise<void> {
    const drafts = this.drafts().filter((draft) => draft.id !== id);
    if (this.savingDraft()) return;
    this.savingDraft.set(true);
    try {
      const state = this.draftSnapshot();
      state.drafts = drafts;
      if (this.editingId() === id) {
        state.editor = null;
        state.editingId = null;
      }
      if (!(await this.persistDrafts(state))) return;
      this.drafts.set(drafts);
      if (this.editingId() === id) this.clearEditor();
      this.releaseUnusedPreviews();
      this.message.set('ลบฉบับร่างแล้ว');
    } finally {
      this.savingDraft.set(false);
    }
  }
  editDraft(draft: RequestDraft): void {
    this.kind.set(draft.kind);
    this.title.set(draft.title);
    this.brandId.set(draft.brandId);
    this.modelId.set(draft.modelId);
    this.manufacturer.set(draft.manufacturer);
    this.description.set(draft.description);
    this.source.set(draft.source);
    this.photos.set([...draft.photos]);
    this.editingId.set(draft.id);
    this.reviewing.set(false);
    this.tab.set('new');
    this.error.set('');
    this.message.set('');
  }
  kindLabel(kind: RequestKind): string {
    return this.kinds.find((item) => item.id === kind)?.label || '';
  }
}
