import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, afterNextRender, inject, signal } from '@angular/core';
import { catalogCars, catalogParts } from '../catalog/catalog.data';

export interface SavedBuild {
  id: string;
  name: string;
  carId: string;
  partIds: string[];
  createdAt: string;
  updatedAt: string;
}
type Result = { ok: true; build?: SavedBuild } | { ok: false; error: string };
export const BUILDS_STORAGE_KEY = 'performante-lab.builds.v1';

export const BUILDS_STORAGE = new InjectionToken<Storage | null>('BUILDS_STORAGE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    try {
      return document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class BuildsStore {
  private readonly storageRef = inject(BUILDS_STORAGE);
  readonly builds = signal<SavedBuild[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.load());
  }

  private storage(): Storage {
    const storage = this.storageRef;
    if (!storage) throw new Error('Storage unavailable');
    return storage;
  }
  private validParts(carId: string, ids: unknown): ids is string[] {
    if (!Array.isArray(ids)) return false;
    const parts = ids.map((id) =>
      catalogParts.find((part) => part.id === id && part.carId === carId),
    );
    return parts.every(Boolean) && new Set(parts.map((part) => part!.category)).size === ids.length;
  }
  private isBuild(item: unknown): item is SavedBuild {
    if (!item || typeof item !== 'object') return false;
    const build = item as SavedBuild;
    return (
      typeof build.id === 'string' &&
      typeof build.name === 'string' &&
      !!build.name.trim() &&
      build.name.length <= 80 &&
      catalogCars.some((car) => car.id === build.carId) &&
      this.validParts(build.carId, build.partIds) &&
      typeof build.createdAt === 'string' &&
      typeof build.updatedAt === 'string' &&
      Number.isFinite(Date.parse(build.createdAt)) &&
      Number.isFinite(Date.parse(build.updatedAt))
    );
  }
  load(): void {
    try {
      const raw = this.storage().getItem(BUILDS_STORAGE_KEY);
      const data: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data) || !data.every((item) => this.isBuild(item))) {
        this.error.set('อ่าน Build ที่บันทึกไว้ไม่ได้ กรุณาตรวจข้อมูลในเบราว์เซอร์');
        return;
      }
      this.builds.set(data);
      this.error.set('');
    } catch {
      this.error.set('อ่านข้อมูลที่บันทึกไว้ไม่ได้ กรุณาอนุญาตพื้นที่จัดเก็บของเบราว์เซอร์');
    } finally {
      this.loaded.set(true);
    }
  }
  save(input: { id?: string; name: string; carId: string; partIds: string[] }): Result {
    if (!this.loaded()) this.load();
    if (this.error()) return { ok: false, error: this.error() };
    const name = input.name.trim();
    if (!name || name.length > 80) return { ok: false, error: 'กรุณาตั้งชื่อ Build 1–80 ตัวอักษร' };
    if (
      !catalogCars.some((car) => car.id === input.carId) ||
      !this.validParts(input.carId, input.partIds)
    )
      return { ok: false, error: 'รถหรือรายการพาร์ตไม่ถูกต้อง กรุณาเลือกใหม่' };
    if (
      input.partIds.length > 1 &&
      catalogParts.some((part) => input.partIds.includes(part.id) && part.category === 'bodykits')
    ) {
      return {
        ok: false,
        error: 'Full Body Kit ต้องใช้แยกจากพาร์ตแต่งรายชิ้น กรุณาเลือกอย่างใดอย่างหนึ่ง',
      };
    }
    const existing = input.id ? this.builds().find((build) => build.id === input.id) : null;
    if (input.id && !existing) return { ok: false, error: 'ไม่พบ Build ที่ต้องการแก้ไข' };
    const now = new Date().toISOString();
    const build: SavedBuild = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      carId: input.carId,
      partIds: [...input.partIds],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = [build, ...this.builds().filter((item) => item.id !== build.id)];
    try {
      this.storage().setItem(BUILDS_STORAGE_KEY, JSON.stringify(next));
      this.builds.set(next);
      return { ok: true, build };
    } catch {
      return {
        ok: false,
        error: 'บันทึกไม่ได้ พื้นที่อาจเต็มหรือถูกปิดกั้น รายการแต่งของคุณยังอยู่',
      };
    }
  }
  remove(id: string): Result {
    const next = this.builds().filter((build) => build.id !== id);
    try {
      this.storage().setItem(BUILDS_STORAGE_KEY, JSON.stringify(next));
      this.builds.set(next);
      return { ok: true };
    } catch {
      return { ok: false, error: 'ลบ Build ไม่สำเร็จ กรุณาลองอีกครั้ง' };
    }
  }
}
