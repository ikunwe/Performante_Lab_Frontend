import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { AUTH_CONFIG } from '../auth/auth-client';
import type { RequestKind } from './requests.api';

export interface LocalRequestDraft {
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
  photos: { id: string; file: File }[];
  createdAt: string;
}
export interface RequestDraftState {
  drafts: LocalRequestDraft[];
  editor: LocalRequestDraft | null;
  editingId: string | null;
  submissionId: string;
  submissionKey: string;
}
interface PhotoRef {
  id: string;
  name: string;
  type: string;
  lastModified: number;
}
type StoredDraft = Omit<LocalRequestDraft, 'photos'> & { photos: PhotoRef[] };
type StoredState = Omit<RequestDraftState, 'drafts' | 'editor'> & {
  drafts: StoredDraft[];
  editor: StoredDraft | null;
};
export const REQUEST_DRAFT_IDB = new InjectionToken<IDBFactory>('REQUEST_DRAFT_IDB', {
  providedIn: 'root',
  factory: () => globalThis.indexedDB,
});

@Injectable({ providedIn: 'root' })
export class RequestDraftStorage {
  private readonly factory = inject(REQUEST_DRAFT_IDB);
  private readonly config = inject(AUTH_CONFIG);
  private database?: Promise<IDBDatabase>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      void this.queue
        .then(async () => {
          (await this.database)?.close();
        })
        .catch(() => {});
    });
  }
  private open(): Promise<IDBDatabase> {
    if (!this.factory)
      return Promise.reject(
        new Error('เบราว์เซอร์ไม่รองรับการเก็บฉบับร่าง กรุณาใช้เบราว์เซอร์ปกติ'),
      );
    return (this.database ??= new Promise((resolve, reject) => {
      const request = this.factory.open('performante-request-drafts', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('states');
        request.result.createObjectStore('photos');
      };
      request.onerror = () => {
        this.database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        this.database = undefined;
        reject(new Error('กรุณาปิดแท็บเก่าก่อนกู้คืนฉบับร่าง'));
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.database = undefined;
        };
        resolve(request.result);
      };
    }));
  }
  private async key(owner: string): Promise<string> {
    if (!owner) throw new Error('กรุณาเข้าสู่ระบบก่อนเก็บฉบับร่าง');
    return (await this.config()).supabaseUrl + '|' + owner;
  }
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const task = this.queue.then(action);
    this.queue = task.catch(() => {});
    return task;
  }
  private photoIds(state: StoredState | null | undefined): string[] {
    return [
      ...new Set(
        [...(state?.drafts || []), ...(state?.editor ? [state.editor] : [])].flatMap((draft) =>
          draft.photos.map((photo) => photo.id),
        ),
      ),
    ];
  }
  load(owner: string): Promise<RequestDraftState | null> {
    return this.enqueue(async () => {
      const key = await this.key(owner),
        db = await this.open();
      return new Promise<RequestDraftState | null>((resolve, reject) => {
        const transaction = db.transaction(['states', 'photos'], 'readonly');
        let stored: StoredState | undefined;
        const blobs = new Map<string, Blob>();
        const request = transaction.objectStore('states').get(key);
        request.onsuccess = () => {
          stored = request.result;
          for (const id of this.photoIds(stored)) {
            const image = transaction.objectStore('photos').get(key + '|' + id);
            image.onsuccess = () => {
              blobs.set(id, image.result);
            };
          }
        };
        transaction.onabort = () => reject(transaction.error || new Error('อ่านฉบับร่างไม่สำเร็จ'));
        transaction.oncomplete = () => {
          if (!stored) {
            resolve(null);
            return;
          }
          try {
            const draft = (value: StoredDraft): LocalRequestDraft => ({
              ...value,
              photos: value.photos.map((photo) => {
                const blob = blobs.get(photo.id);
                if (!blob || typeof blob.slice !== 'function')
                  throw new Error('ภาพฉบับร่างบางไฟล์อ่านไม่ได้ กรุณาลองกู้คืนอีกครั้ง');
                return {
                  id: photo.id,
                  file: new File([blob], photo.name, {
                    type: photo.type,
                    lastModified: photo.lastModified,
                  }),
                };
              }),
            });
            resolve({
              ...stored,
              drafts: stored.drafts.map(draft),
              editor: stored.editor ? draft(stored.editor) : null,
            });
          } catch (error) {
            reject(error);
          }
        };
      });
    });
  }
  save(owner: string, state: RequestDraftState): Promise<void> {
    // Capture metadata now, before a later edit or navigation changes the component.
    const files = new Map<string, File>();
    const draft = (value: LocalRequestDraft): StoredDraft => ({
      ...value,
      photos: value.photos.map((photo) => {
        files.set(photo.id, photo.file);
        return {
          id: photo.id,
          name: photo.file.name,
          type: photo.file.type,
          lastModified: photo.file.lastModified,
        };
      }),
    });
    const snapshot: StoredState = {
      ...state,
      drafts: state.drafts.map(draft),
      editor: state.editor ? draft(state.editor) : null,
    };
    return this.enqueue(async () => {
      const key = await this.key(owner),
        db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['states', 'photos'], 'readwrite');
        const states = transaction.objectStore('states'),
          photos = transaction.objectStore('photos');
        const previous = states.get(key);
        previous.onsuccess = () => {
          const oldIds = new Set(this.photoIds(previous.result));
          for (const [id, file] of files)
            if (!oldIds.has(id)) photos.put(file.slice(0, file.size, file.type), key + '|' + id);
          for (const id of oldIds) if (!files.has(id)) photos.delete(key + '|' + id);
          if (!snapshot.drafts.length && !snapshot.editor) states.delete(key);
          else states.put(snapshot, key);
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
          reject(transaction.error || new Error('บันทึกฉบับร่างไม่สำเร็จ'));
      });
    });
  }
}
