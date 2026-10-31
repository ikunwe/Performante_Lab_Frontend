import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { StorageCatalogStore } from '../../core/catalog/storage-catalog';

type RequestKind = 'brand' | 'model' | 'bodykit' | 'part';
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
  imports: [FormsModule, DatePipe, Icon],
  templateUrl: './user-requests.html',
  host: { class: 'block' },
})
export class UserRequests {
  readonly catalog = inject(StorageCatalogStore);
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
    inject(DestroyRef).onDestroy(() => {
      for (const url of this.urls) URL.revokeObjectURL(url);
    });
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
  saveDraft(): void {
    if (!this.validate()) {
      this.reviewing.set(false);
      return;
    }
    const existing = this.drafts().find((draft) => draft.id === this.editingId());
    const draft: RequestDraft = {
      id: existing?.id || crypto.randomUUID(),
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
    this.drafts.update((drafts) => [draft, ...drafts.filter((item) => item.id !== draft.id)]);
    this.reviewing.set(false);
    this.tab.set('mine');
    this.editingId.set(null);
    this.photos.set([]);
    this.title.set('');
    this.description.set('');
    this.source.set('');
    this.manufacturer.set('');
    this.message.set('เก็บฉบับร่างในหน้านี้แล้ว ยังไม่ได้ส่งให้ผู้ดูแล');
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
