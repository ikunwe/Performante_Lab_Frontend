import { Injectable, afterNextRender, effect, inject, signal, untracked } from '@angular/core';
import { catalogCars, CatalogCar } from '../catalog/catalog.data';
import { partsForCar } from '../../core/catalog/prepared-parts';
import { BuildsApi } from './builds.api';

export interface SavedBuild {
  id: string;
  name: string;
  carId: string;
  carSnapshot?: CatalogCar;
  partIds: string[];
  createdAt: string;
  updatedAt: string;
}
type Result = { ok: true; build?: SavedBuild } | { ok: false; error: string };
export const BUILDS_STORAGE_KEY = 'performante-lab.builds.v1';

@Injectable({ providedIn: 'root' })
export class BuildsStore {
  private readonly api = inject(BuildsApi);
  private owner: string | null = null;
  private epoch = 0;
  private version = 0;
  private createIds = new Map<string, string>();
  readonly builds = signal<SavedBuild[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);

  constructor() {
    effect(() => {
      const owner = this.api.owner();
      untracked(() => {
        this.switchOwner(owner);
        if (owner) void this.load();
        else this.loaded.set(true);
      });
    });
    afterNextRender(() => {
      void this.api.initialize();
    });
  }

  private switchOwner(owner: string | null): void {
    if (this.owner === owner) return;
    this.owner = owner;
    this.epoch++;
    this.version++;
    this.createIds.clear();
    this.builds.set([]);
    this.error.set('');
    this.loaded.set(!owner);
    this.saving.set(false);
    this.deleting.set(false);
    this.loading.set(false);
  }
  private validParts(carId: string, ids: unknown, snapshot?: CatalogCar): ids is string[] {
    if (!Array.isArray(ids)) return false;
    const available = partsForCar(snapshot ?? catalogCars.find((car) => car.id === carId));
    const parts = ids.map((id) => available.find((part) => part.id === id && part.carId === carId));
    return parts.every(Boolean) && new Set(parts.map((part) => part!.category)).size === ids.length;
  }
  private validCar(carId: string, snapshot?: CatalogCar): boolean {
    if (catalogCars.some((car) => car.id === carId)) return !snapshot;
    const ref = snapshot?.reference;
    const year = (value: unknown) =>
      value === null || (Number.isInteger(value) && Number(value) >= 1880 && Number(value) <= 2100);
    return (
      !!snapshot &&
      !!ref &&
      snapshot.id === carId &&
      carId === 'ref:' + (ref.generationId ?? ref.modelId) &&
      typeof ref.brandId === 'string' &&
      typeof ref.modelId === 'string' &&
      ref.modelId.startsWith(ref.brandId + ':') &&
      (ref.generationId === null ||
        (typeof ref.generationId === 'string' && ref.generationId.startsWith(ref.modelId + ':'))) &&
      typeof snapshot.brand === 'string' &&
      !!snapshot.brand.trim() &&
      typeof snapshot.name === 'string' &&
      !!snapshot.name.trim() &&
      snapshot.image === '' &&
      typeof snapshot.body === 'string' &&
      typeof ref.modelName === 'string' &&
      (ref.generationName === null || typeof ref.generationName === 'string') &&
      year(ref.yearStart) &&
      year(ref.yearEnd) &&
      Array.isArray(ref.chassisCodes) &&
      ref.chassisCodes.every(
        (code) => typeof code === 'string' && /^[A-Z0-9-]{1,20}$/.test(code),
      ) &&
      typeof ref.sourceUrl === 'string' &&
      ref.sourceUrl.startsWith('https://')
    );
  }
  private isBuild(item: unknown): item is SavedBuild {
    const value = item as SavedBuild;
    return (
      !!value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.carId === 'string' &&
      Array.isArray(value.partIds) &&
      value.partIds.every((id) => typeof id === 'string') &&
      Number.isFinite(Date.parse(value.createdAt)) &&
      Number.isFinite(Date.parse(value.updatedAt))
    );
  }
  async load(): Promise<void> {
    const owner = this.api.owner();
    this.switchOwner(owner);
    if (!owner) {
      this.loaded.set(true);
      return;
    }
    const epoch = this.epoch,
      version = ++this.version;
    this.loading.set(true);
    this.error.set('');
    try {
      const builds = await this.api.list(owner);
      if (epoch !== this.epoch || version !== this.version || this.api.owner() !== owner) return;
      if (!Array.isArray(builds) || !builds.every((item) => this.isBuild(item)))
        throw new Error('ข้อมูล Build ที่ได้รับไม่ถูกต้อง');
      this.builds.set(builds);
    } catch (error) {
      if (epoch === this.epoch && version === this.version && this.api.owner() === owner)
        this.error.set(error instanceof Error ? error.message : 'โหลด Build ไม่สำเร็จ');
    } finally {
      if (epoch === this.epoch && version === this.version && this.api.owner() === owner) {
        this.loading.set(false);
        this.loaded.set(true);
      }
    }
  }
  async save(input: {
    id?: string;
    name: string;
    carId: string;
    carSnapshot?: CatalogCar;
    partIds: string[];
  }): Promise<Result> {
    const owner = this.api.owner();
    this.switchOwner(owner);
    if (!owner) return { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนบันทึก Build' };
    if (this.saving() || this.deleting())
      return { ok: false, error: 'กำลังบันทึกข้อมูล กรุณารอสักครู่' };
    const name = input.name.trim();
    if (!name || [...name].length > 80)
      return { ok: false, error: 'กรุณาตั้งชื่อ Build 1–80 ตัวอักษร' };
    if (
      !this.validCar(input.carId, input.carSnapshot) ||
      !this.validParts(input.carId, input.partIds, input.carSnapshot)
    )
      return { ok: false, error: 'รถหรือรายการพาร์ทไม่ถูกต้อง กรุณาเลือกใหม่' };
    if (
      input.partIds.length > 1 &&
      partsForCar(input.carSnapshot ?? catalogCars.find((car) => car.id === input.carId)).some(
        (part) => input.partIds.includes(part.id) && part.category === 'bodykits',
      )
    )
      return { ok: false, error: 'Full Body Kit ต้องใช้แยกจากพาร์ทแต่งรายชิ้น' };
    const value = {
      ...(input.id ? { id: input.id } : {}),
      ...(input.carSnapshot ? { carSnapshot: input.carSnapshot } : {}),
      name,
      carId: input.carId,
      partIds: [...input.partIds],
    };
    const key = JSON.stringify(value);
    const createId = this.createIds.get(key) ?? crypto.randomUUID();
    this.createIds.set(key, createId);
    const epoch = this.epoch;
    ++this.version;
    this.loading.set(false);
    this.saving.set(true);
    try {
      const build = await this.api.save(owner, value, createId);
      if (epoch !== this.epoch || this.api.owner() !== owner)
        return { ok: false, error: 'บัญชีเปลี่ยนแล้ว กรุณาโหลด Build ใหม่' };
      if (!this.isBuild(build)) throw new Error('ข้อมูล Build ที่ได้รับไม่ถูกต้อง');
      this.builds.update((rows) => [build, ...rows.filter((row) => row.id !== build.id)]);
      this.loaded.set(true);
      this.error.set('');
      this.createIds.delete(key);
      return { ok: true, build };
    } catch (error) {
      if (epoch === this.epoch && this.api.owner() === owner && !this.loaded()) {
        this.loaded.set(true);
        this.error.set('โหลด My Builds ใหม่เพื่อดูรายการล่าสุด');
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'บันทึก Build ไม่สำเร็จ รายการแต่งยังอยู่',
      };
    } finally {
      if (epoch === this.epoch) this.saving.set(false);
    }
  }
  async remove(id: string): Promise<Result> {
    const owner = this.api.owner();
    this.switchOwner(owner);
    if (!owner) return { ok: false, error: 'กรุณาเข้าสู่ระบบใหม่' };
    if (this.saving() || this.deleting())
      return { ok: false, error: 'กำลังบันทึกข้อมูล กรุณารอสักครู่' };
    const epoch = this.epoch;
    ++this.version;
    this.loading.set(false);
    this.deleting.set(true);
    try {
      await this.api.remove(owner, id);
      if (epoch !== this.epoch || this.api.owner() !== owner)
        return { ok: false, error: 'บัญชีเปลี่ยนแล้ว กรุณาโหลด Build ใหม่' };
      this.builds.update((rows) => rows.filter((row) => row.id !== id));
      this.error.set('');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'ลบ Build ไม่สำเร็จ กรุณาลองใหม่',
      };
    } finally {
      if (epoch === this.epoch) this.deleting.set(false);
    }
  }
}
