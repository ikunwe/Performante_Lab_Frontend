import { AdminBuildsApi } from './admin-builds.api';
import { invalidateDiscoverFeed } from '../../discover/discover-feed.store';
import { RequestsApi, RequestRecord } from '../../../core/requests/requests.api';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_CLIENT, AUTH_CONFIG } from '../../../core/auth/auth-client';
import { AuthService, UserRole } from '../../../core/auth/auth.service';
import { CatalogStorageHelper, type StorageWorkshopItem } from '../../../core/storage/catalog-storage';

export interface AdminBuildItem {
  id: string;
  title: string;
  author: string;
  authorAvatar?: string;
  car: string;
  tag: string;
  likes: string;
  image: string;
  parts: string[];
  budget: number;
  category: string;
  createdAt: string;
}

export interface AdminRequestItem {
  images?: string[];
  source?: string;
  manufacturer?: string;
  id: string;
  title: string;
  author: string;
  authorAvatar?: string;
  car: string;
  tag: string;
  likes: string;
  image: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  category: string;
  description: string;
  requestedAt: string;
}

export interface AdminUserItem {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'InActive';
  avatarUrl?: string;
  joinedAt: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'request' | 'user' | 'build';
}

export interface RealBrandItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  is_custom_bg: boolean;
  created_at?: string;
  // Aliases for compatibility
  logoUrl?: string;
  isCustomBg?: boolean;
}

export interface RealCarModelItem {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  image_url: string;
  body_type: string;
  year?: string;
  created_at?: string;
  // Aliases
  brandId?: string;
  image?: string;
  bodyType?: string;
}

export interface RealPartItem {
  id: string;
  car_model_id: string;
  category: string;
  name: string;
  manufacturer: string;
  image_url: string;
  price: number;
  created_at?: string;
  // Aliases
  carId?: string;
  image?: string;
}

export type AdminBrandItem = RealBrandItem;
export type AdminCarModelItem = RealCarModelItem;
export type AdminPartDataItem = RealPartItem;

export function mapBrand(row: any): RealBrandItem {
  const logo = row.logo_url || row.logoUrl || '';
  const isCustom = Boolean(row.is_custom_bg ?? row.isCustomBg);
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug || row.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    logo_url: logo,
    logoUrl: logo,
    is_custom_bg: isCustom,
    isCustomBg: isCustom,
    created_at: row.created_at,
  };
}

export function mapCarModel(row: any): RealCarModelItem {
  const image = row.image_url || row.image || '';
  const brandId = row.brand_id || row.brandId || '';
  const bodyType = row.body_type || row.bodyType || 'Coupe';
  return {
    id: String(row.id),
    brand_id: brandId,
    brandId,
    name: row.name,
    slug: row.slug || row.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    image_url: image,
    image,
    body_type: bodyType,
    bodyType,
    year: row.year,
    created_at: row.created_at,
  };
}

export function mapPart(row: any): RealPartItem {
  const image = row.image_url || row.image || '';
  const carModelId = row.car_model_id || row.carId || '';
  return {
    id: String(row.id),
    car_model_id: carModelId,
    carId: carModelId,
    category: row.category,
    name: row.name,
    manufacturer: row.manufacturer || 'Custom',
    image_url: image,
    image,
    price: Number(row.price) || 0,
    created_at: row.created_at,
  };
}

export const INITIAL_USERS: AdminUserItem[] = [
  {
    id: 'u-1',
    username: 'alex_r',
    email: 'alex.r@performante.lab',
    role: 'Admin',
    status: 'Active',
    joinedAt: '2026-09-15',
  },
  {
    id: 'u-2',
    username: 'sarah_chief',
    email: 'sarah.chief@performante.lab',
    role: 'SuperAdmin',
    status: 'Active',
    joinedAt: '2026-08-01',
  },
  {
    id: 'u-3',
    username: 'driver_ken',
    email: 'driver.ken@gmail.com',
    role: 'User',
    status: 'InActive',
    joinedAt: '2026-10-10',
  },
  {
    id: 'u-4',
    username: 'marcus_m',
    email: 'marcus.m@performante.lab',
    role: 'Admin',
    status: 'Active',
    joinedAt: '2026-09-20',
  },
  {
    id: 'u-5',
    username: 'elena_sp',
    email: 'elena.sp@performante.lab',
    role: 'SuperAdmin',
    status: 'Active',
    joinedAt: '2026-07-12',
  },
];

export const INITIAL_EDIT_BRANDS: RealBrandItem[] = [];
export const INITIAL_EDIT_CARS: RealCarModelItem[] = [];
export const INITIAL_EDIT_PARTS: RealPartItem[] = [];

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly auth = inject(AuthService);
  private readonly buildsApi=inject(AdminBuildsApi);
  private buildsOwner:string|null=null;
  private buildsExpires=0;
  private buildsVersion=0;
  private readonly requestsApi=inject(RequestsApi);
  private readonly createClient = inject(AUTH_CLIENT);
  private readonly loadConfig = inject(AUTH_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private client: SupabaseClient | null = null;

  // Real Database Loading & Error States
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Builds state
  readonly builds = signal<AdminBuildItem[]>([]);
  readonly buildsLoading=signal(false);
  readonly buildsError=signal('');
  readonly buildDeleteBusyId=signal<string|null>(null);
  readonly discoverSearch = signal('');
  readonly discoverTagFilter = signal('All');
  readonly selectedBuild = signal<AdminBuildItem | null>(null);

  readonly filteredBuilds = computed(() => {
    const query = this.discoverSearch().trim().toLowerCase();
    const tag = this.discoverTagFilter();
    return this.builds().filter((b) => {
      const matchesQuery =
        !query ||
        [b.title, b.author, b.car, b.tag].join(' ').toLowerCase().includes(query);
      const matchesTag = tag === 'All' || b.tag === tag || b.category === tag;
      return matchesQuery && matchesTag;
    });
  });

  // Requests state
  readonly requests = signal<AdminRequestItem[]>([]);
  readonly requestsLoading=signal(false);
  readonly requestsError=signal('');
  readonly requestBusyId=signal<string|null>(null);
  readonly requestsSearch = signal('');
  readonly requestsStatusFilter = signal<'All' | 'Pending' | 'Accepted' | 'Rejected'>('All');
  readonly selectedRequest = signal<AdminRequestItem | null>(null);

  readonly filteredRequests = computed(() => {
    const query = this.requestsSearch().trim().toLowerCase();
    const status = this.requestsStatusFilter();
    return this.requests().filter((r) => {
      const matchesQuery =
        !query ||
        [r.title, r.author, r.car, r.tag, r.category, r.description].join(' ').toLowerCase().includes(query);
      const matchesStatus = status === 'All' || r.status === status;
      return matchesQuery && matchesStatus;
    });
  });

  // Users state: Real database integration starts empty []
  readonly users = signal<AdminUserItem[]>([]);
  readonly usersSearch = signal('');
  readonly usersRoleFilter = signal<'All' | 'User' | 'Admin' | 'SuperAdmin'>('All');
  readonly usersStatusFilter = signal<'All' | 'Active' | 'InActive'>('All');

  readonly filteredUsers = computed(() => {
    const query = this.usersSearch().trim().toLowerCase();
    const role = this.usersRoleFilter();
    const status = this.usersStatusFilter();
    return this.users().filter((u) => {
      const matchesQuery =
        !query || [u.username, u.email, u.role].join(' ').toLowerCase().includes(query);
      const matchesRole = role === 'All' || u.role === role;
      const matchesStatus = status === 'All' || u.status === status;
      return matchesQuery && matchesRole && matchesStatus;
    });
  });

  // Notifications
  readonly notifications = signal<AdminNotification[]>([
    {
      id: 'n-1',
      title: 'คำขอชิ้นส่วนใหม่',
      message: 'มีผู้ใช้ส่งคำขอพาร์ต Sano Widebody V2 สำหรับ Toyota GT86',
      time: '10 นาทีที่แล้ว',
      read: false,
      type: 'request',
    },
    {
      id: 'n-2',
      title: 'ผู้ใช้ใหม่ลงทะเบียน',
      message: 'บัญชี user_speedy สมัครเข้าสู่ระบบแล้ว',
      time: '1 ชั่วโมงที่แล้ว',
      read: false,
      type: 'user',
    },
    {
      id: 'n-3',
      title: 'Build ยอดนิยม',
      message: 'Build "Rosso. Refined." มียอดถูกใจครบ 100,000 ครั้ง',
      time: '3 ชั่วโมงที่แล้ว',
      read: true,
      type: 'build',
    },
  ]);

  readonly unreadNotificationsCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  // Edit Data (Real Database Integration: car_brands, car_models, car_parts)
  readonly catalogBrands = signal<RealBrandItem[]>([]);
  readonly catalogModels = signal<RealCarModelItem[]>([]);
  readonly catalogParts = signal<RealPartItem[]>([]);
  readonly catalogLoading = signal<boolean>(false);

  // Backward compatibility aliases
  readonly editBrands = this.catalogBrands;
  readonly editCars = this.catalogModels;
  readonly editParts = this.catalogParts;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.loadAll();
    }
  }

  isBodyKitCategory(cat: string): boolean {
    const c = (cat || '').toLowerCase().replace(/[\s_-]+/g, '');
    return c === 'bodykit' || c === 'fullbodykits' || c === 'bodykits';
  }

  // 1. ดึงแบรนด์ทั้งหมด (Storage catalog bucket -> car_brand_reference fallback)
  async fetchCatalogBrands(): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    this.catalogLoading.set(true);

    try {
      // ดึงจาก Storage Bucket 'catalog' เป็นหลัก
      if (typeof (client as any).storage?.from === 'function') {
        const storageBrands = await CatalogStorageHelper.listBrands(client);
        if (storageBrands && storageBrands.length > 0) {
          const mapped: RealBrandItem[] = storageBrands.map((b) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            logo_url: b.logoUrl,
            logoUrl: b.logoUrl,
            is_custom_bg: b.id.toLowerCase() === 'ferrari',
            isCustomBg: b.id.toLowerCase() === 'ferrari',
          }));
          this.catalogBrands.set(mapped);
          return;
        }
      }

      // Fallback: car_brand_reference database table
      if (typeof client.from === 'function') {
        const query = client.from('car_brand_reference');
        if (query && typeof query.select === 'function') {
          const { data, error } = await query
            .select('id, name, slug, details')
            .order('name', { ascending: true });

          if (error) {
            console.error('[AdminService] fetchCatalogBrands error:', error);
            throw error;
          }

          const mapped: RealBrandItem[] = (data || []).map((row: any) => {
            const details = row.details || {};
            const refLogo = details.logoReferenceUrl || '';

            // ตรวจสอบรูปใน Storage หรือใช้ logoReferenceUrl (ห้าม hardcode โลโก้ Ferrari เด็ดขาด)
            const customStorageLogo = `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/${row.name}/logo.png`;
            const logoUrl = refLogo || row.logo_url || customStorageLogo || '';
            const isFerrari = row.id === 'ferrari' || details.isCustomBg || row.is_custom_bg || false;

            return {
              id: row.id,
              name: row.id === 'great-wall' ? 'GWM' : row.name,
              slug: row.slug,
              logo_url: logoUrl,
              logoUrl: logoUrl,
              is_custom_bg: isFerrari,
              isCustomBg: isFerrari,
            };
          });

          this.catalogBrands.set(mapped);
        }
      }
    } catch (err: any) {
      console.error('[AdminService] fetchCatalogBrands failed:', err);
      this.error.set(err?.message || 'โหลดข้อมูลแบรนด์ไม่สำเร็จ');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  // 2. ดึงรุ่นรถตาม brand (Storage catalog/{brand} -> car_brand_reference fallback)
  async fetchCatalogModels(brandId: string): Promise<void> {
    const client = await this.getClient();
    if (!client || !brandId) return;
    this.catalogLoading.set(true);

    try {
      // ดึงจาก Storage Bucket 'catalog/{brandId}' เป็นหลัก
      if (typeof (client as any).storage?.from === 'function') {
        const storageModels = await CatalogStorageHelper.listModels(client, brandId);
        if (storageModels && storageModels.length > 0) {
          const mapped: RealCarModelItem[] = storageModels.map((m) => ({
            id: m.id,
            brand_id: brandId,
            brandId: brandId,
            name: m.name,
            slug: m.slug,
            image_url: m.imageUrl,
            image: m.imageUrl,
            body_type: 'Coupe',
            bodyType: 'Coupe',
          }));

          // Merge กับ catalogModels ที่มีอยู่แล้ว ไม่ wipe out รถที่เพิ่ง optimistic insert
          const current = this.catalogModels();
          const merged = [...mapped];
          for (const cm of current) {
            const isMatchBrand = (cm.brand_id || cm.brandId) === brandId;
            if (isMatchBrand && !merged.some((m) => m.name.toLowerCase() === cm.name.toLowerCase())) {
              merged.push(cm);
            }
          }
          this.catalogModels.set(merged);
          return;
        }
      }

      // Fallback: car_brand_reference database table
      if (typeof client.from === 'function') {
        const query = client.from('car_brand_reference');
        if (query && typeof query.select === 'function') {
          const { data, error } = await query
            .select('id, name, details')
            .eq('id', brandId)
            .single();

          if (error) {
            console.error('[AdminService] fetchCatalogModels error:', error);
            throw error;
          }

          const brandName = data.name;
          const rawModels = data.details?.modelCatalog?.models || [];
          const mapped: RealCarModelItem[] = rawModels.map((m: any) => {
            // ใช้ 45_front.png เป็นรูปรถหลักตามข้อกำหนดล่าสุด
            const storageCarImage = `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/${brandName}/${m.name}/45_front.png`;

            return {
              id: m.id || `${brandId}-${m.name}`,
              brand_id: brandId,
              brandId: brandId,
              name: m.name,
              slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              image_url: storageCarImage,
              image: storageCarImage,
              body_type: 'Coupe',
              bodyType: 'Coupe',
            };
          });

          this.catalogModels.set(mapped);
        }
      }
    } catch (err: any) {
      console.error('[AdminService] fetchCatalogModels failed:', err);
      this.error.set(err?.message || 'โหลดข้อมูลรุ่นรถไม่สำเร็จ');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  // 3. ดึงรายการ Tuning (BodyKit และ Part) จาก Storage Bucket 'catalog'
  async fetchCatalogTuning(
    brandName: string,
    modelName: string,
  ): Promise<{
    workshops: {
      bodykit: { name: string; logoUrl: string }[];
      parts: { name: string; logoUrl: string }[];
    };
    parts: RealPartItem[];
  }> {
    const client = await this.getClient();
    const emptyResult = { workshops: { bodykit: [], parts: [] }, parts: [] };
    if (!client || !brandName || !modelName) return emptyResult;
    this.catalogLoading.set(true);

    try {
      const allParts: RealPartItem[] = [];
      const storage = client?.storage?.from ? client.storage.from(CatalogStorageHelper.BUCKET) : null;
      const safeBrand = CatalogStorageHelper.sanitize(brandName);
      const safeModel = CatalogStorageHelper.sanitize(modelName);

      // 1. ดึง BodyKit workshops และ items (Parallel Optimized)
      let bkWorkshops: StorageWorkshopItem[] = [];
      const bkPath = `${safeBrand}/${safeModel}/BodyKit`;
      if (storage) {
        try {
          const { data: bkEntries } = await storage.list(bkPath, { limit: 100 });
          if (bkEntries && bkEntries.length > 0) {
            const validBkFolders = bkEntries.filter(
              (f) => !f.name.startsWith('.') && (f.id === null || f.metadata === null || !f.name.includes('.')),
            );
            bkWorkshops = validBkFolders.map((f) => ({ name: f.name, logoUrl: '' }));

            // โหลด items ของทุก workshop ขนานกัน (Promise.all)
            await Promise.all(
              bkWorkshops.map(async (ws) => {
                const items = await CatalogStorageHelper.listItems(client, brandName, modelName, 'BodyKit', ws.name);
                for (const item of items) {
                  allParts.push({
                    id: `${modelName}-bodykit-${ws.name}-${item.name}`,
                    car_model_id: modelName,
                    carId: modelName,
                    category: 'FullBodyKits',
                    name: item.displayName || item.name,
                    manufacturer: ws.name,
                    image_url: item.imageUrl,
                    image: item.imageUrl,
                    price: 0,
                  });
                }
              }),
            );
          }
        } catch (bkErr) {
          console.warn('[AdminService] fetchCatalogTuning bodykit scan warning:', bkErr);
        }
      }

      // 2. ดึง Part categories, brands และ items ตาม STORAGE_CATALOG_TREE.md (Parallel Optimized)
      // โครงสร้างโฟลเดอร์: {brand}/{model}/Part/{Category}/{PartBrand}/{PartName}/{angle}.png
      const partWorkshops: StorageWorkshopItem[] = [];

      if (storage) {
        try {
          const { data: partEntries } = await storage.list(`${safeBrand}/${safeModel}/Part`, { limit: 100 });
          if (partEntries && partEntries.length > 0) {
            await Promise.all(
              partEntries.map(async (pEntry) => {
                if (pEntry.name.startsWith('.')) return;
                const rawCatName = pEntry.name;
                const normCat = rawCatName.toLowerCase().replace(/[\s_-]+/g, '');
                let standardCatName = '';
                if (normCat === 'frontbumper' || normCat === 'front' || normCat === 'frontbumpers') standardCatName = 'Front Bumper';
                else if (normCat === 'rearbumper' || normCat === 'rear' || normCat === 'rearbumpers') standardCatName = 'Rear Bumper';
                else if (normCat === 'wheels' || normCat === 'wheel') standardCatName = 'Wheels';
                else if (normCat === 'spoilers' || normCat === 'spoiler') standardCatName = 'Spoilers';

                if (standardCatName) {
                  const { data: brandEntries } = await storage.list(`${safeBrand}/${safeModel}/Part/${rawCatName}`, { limit: 100 });
                  if (brandEntries) {
                    await Promise.all(
                      brandEntries.map(async (bEntry) => {
                        if (bEntry.name.startsWith('.')) return;
                        const partBrandName = bEntry.name;
                        if (!partWorkshops.some((w) => w.name.toLowerCase() === partBrandName.toLowerCase())) {
                          partWorkshops.push({ name: partBrandName, logoUrl: '' });
                        }

                        // ดึง items ภายใต้ {PartBrand}
                        const { data: itemEntries } = await storage.list(
                          `${safeBrand}/${safeModel}/Part/${rawCatName}/${partBrandName}`,
                          { limit: 100 },
                        );
                        if (itemEntries) {
                          await Promise.all(
                            itemEntries.map(async (iEntry) => {
                              if (iEntry.name.startsWith('.')) return;
                              const partName = iEntry.name.replace(/\.[^/.]+$/, '');
                              let imageUrl = '';

                              if (!iEntry.name.includes('.')) {
                                const { data: angleFiles } = await storage.list(
                                  `${safeBrand}/${safeModel}/Part/${rawCatName}/${partBrandName}/${iEntry.name}`,
                                  { limit: 20 },
                                );
                                if (angleFiles && angleFiles.length > 0) {
                                  const primaryAngle =
                                    angleFiles.find((f) => /^45_front\./i.test(f.name)) ||
                                    angleFiles.find((f) => /^45_Back\./i.test(f.name)) ||
                                    angleFiles.find((f) => /^front\./i.test(f.name)) ||
                                    angleFiles.find((f) => /^Back\./i.test(f.name)) ||
                                    angleFiles.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
                                  if (primaryAngle) {
                                    imageUrl = CatalogStorageHelper.getPublicUrl(
                                      client,
                                      `${safeBrand}/${safeModel}/Part/${rawCatName}/${partBrandName}/${iEntry.name}/${primaryAngle.name}`,
                                    );
                                  }
                                }
                              } else if (/\.(png|jpe?g|webp|svg)$/i.test(iEntry.name)) {
                                imageUrl = CatalogStorageHelper.getPublicUrl(
                                  client,
                                  `${safeBrand}/${safeModel}/Part/${rawCatName}/${partBrandName}/${iEntry.name}`,
                                );
                              }

                              if (imageUrl) {
                                allParts.push({
                                  id: `${modelName}-part-${normCat}-${partBrandName}-${partName}`,
                                  car_model_id: modelName,
                                  carId: modelName,
                                  category: standardCatName,
                                  name: partName.replace(/[-_]+/g, ' '),
                                  manufacturer: partBrandName,
                                  image_url: imageUrl,
                                  image: imageUrl,
                                  price: 0,
                                });
                              }
                            }),
                          );
                        }
                      }),
                    );
                  }
                } else {
                  // Legacy structure
                  const legacyItems = await CatalogStorageHelper.listItems(client, brandName, modelName, 'Part', pEntry.name);
                  if (legacyItems.length > 0) {
                    if (!partWorkshops.some((w) => w.name.toLowerCase() === pEntry.name.toLowerCase())) {
                      partWorkshops.push({ name: pEntry.name, logoUrl: '' });
                    }
                    for (const li of legacyItems) {
                      allParts.push({
                        id: `${modelName}-part-${pEntry.name}-${li.name}`,
                        car_model_id: modelName,
                        carId: modelName,
                        category: 'Wheels',
                        name: li.displayName || li.name,
                        manufacturer: pEntry.name,
                        image_url: li.imageUrl,
                        image: li.imageUrl,
                        price: 0,
                      });
                    }
                  }
                }
              }),
            );
          }
        } catch (partErr) {
          console.warn('[AdminService] fetchCatalogTuning part scan warning:', partErr);
        }
      }

      // 3. รวมข้อมูลจากฐานข้อมูล Supabase `car_parts` Table
      if (typeof client.from === 'function') {
        try {
          const { data: dbParts } = await client
            .from('car_parts')
            .select('*')
            .or(`car_model_id.eq.${modelName},car_model_id.eq.${safeModel},car_model_id.ilike.%${safeModel}%`);
          if (dbParts) {
            for (const dp of dbParts) {
              const mapped = mapPart(dp);
              if (
                !allParts.some(
                  (p) =>
                    p.name.toLowerCase() === mapped.name.toLowerCase() &&
                    p.category.toLowerCase().replace(/[\s_-]+/g, '') ===
                      mapped.category.toLowerCase().replace(/[\s_-]+/g, ''),
                )
              ) {
                allParts.push(mapped);
              }
              if (mapped.manufacturer && !this.isBodyKitCategory(mapped.category)) {
                if (!partWorkshops.some((w) => w.name.toLowerCase() === mapped.manufacturer.toLowerCase())) {
                  partWorkshops.push({ name: mapped.manufacturer, logoUrl: '' });
                }
              }
            }
          }
        } catch {
          // ignore db error
        }
      }

      // Merge กับ parts ที่มีอยู่ใน memory ไม่ให้ล้างข้อมูลที่เพิ่ง optimistic insert
      const currentParts = this.catalogParts();
      const mergedParts = [...allParts];
      for (const cp of currentParts) {
        const isMatchCar =
          (cp.car_model_id || cp.carId) === modelName ||
          (cp.car_model_id || cp.carId) === safeModel ||
          (cp.car_model_id || cp.carId)?.toLowerCase().includes(safeModel.toLowerCase());
        if (
          isMatchCar &&
          !mergedParts.some(
            (p) =>
              p.id === cp.id ||
              (p.name.toLowerCase() === cp.name.toLowerCase() &&
                (p.manufacturer || '').toLowerCase() === (cp.manufacturer || '').toLowerCase()),
          )
        ) {
          mergedParts.push(cp);
        }
      }

      this.catalogParts.set(mergedParts);

      return {
        workshops: {
          bodykit: bkWorkshops,
          parts: partWorkshops,
        },
        parts: mergedParts,
      };
    } catch (err: any) {
      console.error('[AdminService] fetchCatalogTuning exception:', err);
      this.error.set(err?.message || 'โหลดข้อมูล Tuning ไม่สำเร็จ');
      return emptyResult;
    } finally {
      this.catalogLoading.set(false);
    }
  }

  // 4. ดึงพาร์ตตาม car_model_id (car_parts)
  async fetchCatalogParts(carModelId: string): Promise<void> {
    const client = await this.getClient();
    if (!client || !carModelId) return;
    this.catalogLoading.set(true);
    try {
      const { data, error } = await client
        .from('car_parts')
        .select('*')
        .eq('car_model_id', carModelId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[AdminService] fetchCatalogParts error:', error);
        throw error;
      }
      this.catalogParts.set((data || []).map(mapPart));
    } catch (err: any) {
      console.error('[AdminService] fetchCatalogParts exception:', err);
      this.error.set(err?.message || 'โหลดข้อมูลพาร์ตไม่สำเร็จ');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  // บันทึก Brand (car_brand_reference)
  async insertBrand(item: {
    name: string;
    slug?: string;
    logo_url: string;
    is_custom_bg?: boolean;
  }): Promise<{ ok: boolean; data?: RealBrandItem; error?: string }> {
    const client = await this.getClient();
    const id = item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = item.slug || id;
    const isFerrari = id === 'ferrari';

    const fallbackItem: RealBrandItem = {
      id,
      name: id === 'great-wall' ? 'GWM' : item.name.trim(),
      slug,
      logo_url: item.logo_url,
      logoUrl: item.logo_url,
      is_custom_bg: item.is_custom_bg ?? isFerrari,
      isCustomBg: item.is_custom_bg ?? isFerrari,
    };

    if (!client) {
      this.catalogBrands.update((list) => [...list, fallbackItem].sort((a, b) => a.name.localeCompare(b.name)));
      return { ok: true, data: fallbackItem };
    }

    const payload = {
      id,
      slug,
      name: item.name.trim(),
      details: {
        id,
        name: item.name.trim(),
        slug,
        logoReferenceUrl: item.logo_url,
        modelCatalog: {
          brandId: id,
          brandName: item.name.trim(),
          models: [],
        },
      },
      collected_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await client
        .from('car_brand_reference')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      const mapped: RealBrandItem = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        logo_url: item.logo_url,
        logoUrl: item.logo_url,
        is_custom_bg: item.is_custom_bg ?? isFerrari,
        isCustomBg: item.is_custom_bg ?? isFerrari,
      };

      this.catalogBrands.update((list) => [...list, mapped].sort((a, b) => a.name.localeCompare(b.name)));
      return { ok: true, data: mapped };
    } catch (err: any) {
      console.error('[AdminService] insertBrand exception:', err);
      return { ok: false, error: err?.message || 'บันทึก Brand ล้มเหลว' };
    }
  }

  // บันทึก Car Model (car_brand_reference modelCatalog)
  async insertCarModel(item: {
    brand_id: string;
    name: string;
    slug?: string;
    image_url: string;
    body_type?: string;
    year?: string;
  }): Promise<{ ok: boolean; data?: RealCarModelItem; error?: string }> {
    const client = await this.getClient();
    const slug = item.slug || item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const modelId = `${item.brand_id}-${slug}`;

    const newCarItem: RealCarModelItem = {
      id: modelId,
      brand_id: item.brand_id,
      brandId: item.brand_id,
      name: item.name.trim(),
      slug,
      image_url: item.image_url,
      image: item.image_url,
      body_type: item.body_type || 'Coupe',
      bodyType: item.body_type || 'Coupe',
      year: item.year || undefined,
    };

    if (!client) {
      this.catalogModels.update((list) => [...list, newCarItem]);
      return { ok: true, data: newCarItem };
    }

    try {
      const { data: brandData, error: fetchErr } = await client
        .from('car_brand_reference')
        .select('id, name, details')
        .eq('id', item.brand_id)
        .single();

      if (!fetchErr && brandData) {
        const details = brandData.details || {};
        const modelCatalog = details.modelCatalog || {
          brandId: brandData.id,
          brandName: brandData.name,
          models: [],
        };
        const models = Array.isArray(modelCatalog.models) ? [...modelCatalog.models] : [];
        models.push({
          id: modelId,
          name: item.name.trim(),
          brandId: item.brand_id,
          imageUrl: item.image_url,
        });
        modelCatalog.models = models;
        details.modelCatalog = modelCatalog;

        await client
          .from('car_brand_reference')
          .update({ details })
          .eq('id', item.brand_id);
      }

      this.catalogModels.update((list) => [...list, newCarItem]);
      return { ok: true, data: newCarItem };
    } catch (err: any) {
      console.error('[AdminService] insertCarModel exception:', err);
      this.catalogModels.update((list) => [...list, newCarItem]);
      return { ok: true, data: newCarItem };
    }
  }

  // บันทึก Part (car_parts)
  async insertCarPart(item: {
    car_model_id: string;
    category: string;
    name: string;
    manufacturer?: string;
    image_url: string;
    price?: number;
  }): Promise<{ ok: boolean; data?: RealPartItem; error?: string }> {
    const client = await this.getClient();
    const payload = {
      car_model_id: item.car_model_id,
      category: item.category,
      name: item.name.trim(),
      manufacturer: item.manufacturer || 'Custom',
      image_url: item.image_url,
      price: item.price ?? 0,
    };

    if (!client) {
      const fallbackItem = mapPart({
        id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...payload,
      });
      this.catalogParts.update((list) => [...list, fallbackItem]);
      return { ok: true, data: fallbackItem };
    }

    try {
      const { data, error } = await client
        .from('car_parts')
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        const mapped = mapPart(data);
        this.catalogParts.update((list) => [...list, mapped]);
        return { ok: true, data: mapped };
      }
    } catch (err: any) {
      console.warn('[AdminService] insertCarPart DB fallback to local memory:', err);
    }

    const fallbackItem = mapPart({
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
    });
    this.catalogParts.update((list) => [...list, fallbackItem]);
    return { ok: true, data: fallbackItem };
  }

  // อัปเดตชิ้นส่วน Part (car_parts)
  async updateCarPart(item: {
    id: string;
    name: string;
    price?: number;
    image_url?: string;
  }): Promise<{ ok: boolean; data?: RealPartItem; error?: string }> {
    const client = await this.getClient();
    const updatePayload: Record<string, any> = {
      name: item.name.trim(),
    };
    if (item.price !== undefined) updatePayload['price'] = item.price;
    if (item.image_url) updatePayload['image_url'] = item.image_url;

    if (!client || typeof client.from !== 'function') {
      let updatedItem: RealPartItem | undefined;
      this.catalogParts.update((list) =>
        list.map((p) => {
          if (p.id === item.id) {
            updatedItem = {
              ...p,
              name: item.name.trim(),
              price: item.price ?? p.price,
              image: item.image_url || p.image,
              image_url: item.image_url || p.image_url,
            };
            return updatedItem;
          }
          return p;
        }),
      );
      return { ok: true, data: updatedItem };
    }

    try {
      const { data, error } = await client
        .from('car_parts')
        .update(updatePayload)
        .eq('id', item.id)
        .select()
        .single();
      if (error) {
        console.error('[AdminService] updateCarPart error:', error);
        throw error;
      }
      const mapped = mapPart(data);
      this.catalogParts.update((list) => list.map((p) => (p.id === item.id ? mapped : p)));
      return { ok: true, data: mapped };
    } catch (err: any) {
      console.error('[AdminService] updateCarPart exception:', err);
      return { ok: false, error: err?.message || 'อัปเดตพาร์ตล้มเหลว' };
    }
  }

  // ลบชิ้นส่วน Part หรือชุดแต่ง (car_parts & recursive storage cleanup)
  async deletePartItem(
    partId: string,
    storagePath?: string,
    partName?: string,
    carModelName?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const client = await this.getClient();
    if (client) {
      try {
        if (typeof client.from === 'function') {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partId);
          if (isUuid) {
            await client.from('car_parts').delete().eq('id', partId);
          }
          if (partName) {
            let query = client.from('car_parts').delete().ilike('name', partName);
            if (carModelName) {
              const safeModel = CatalogStorageHelper.sanitize(carModelName);
              query = query.or(`car_model_id.eq.${carModelName},car_model_id.eq.${safeModel}`);
            }
            await query;
          }
        }
        if (storagePath) {
          const cleanPath = CatalogStorageHelper.extractStoragePath(storagePath);
          if (cleanPath) {
            // ดึงโฟลเดอร์ของชิ้นส่วน (ตัดชื่อไฟล์รูปมุมมองออก)
            const lastSlash = cleanPath.lastIndexOf('/');
            const folderPath = lastSlash !== -1 ? cleanPath.substring(0, lastSlash) : cleanPath;
            await CatalogStorageHelper.deleteFolderRecursively(client, folderPath);
          }
        }
      } catch (err: any) {
        console.warn('[AdminService] deletePartItem error:', err);
        return { ok: false, error: err?.message || 'ลบข้อมูลไม่สำเร็จ' };
      }
    }
    this.catalogParts.update((list) =>
      list.filter((p) => p.id !== partId && (!partName || p.name.toLowerCase() !== partName.toLowerCase())),
    );
    return { ok: true };
  }

  // ลบสำนักแต่ง Tuning Brand (car_parts & storage folders recursively)
  async deleteTuningBrand(
    brandName: string,
    carModelName: string,
    tab: 'bodykit' | 'parts',
    tuningBrand: string,
    category?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const client = await this.getClient();
    const safeBrand = CatalogStorageHelper.sanitize(brandName);
    const safeModel = CatalogStorageHelper.sanitize(carModelName);
    const safeTuningBrand = CatalogStorageHelper.sanitize(tuningBrand);

    if (client) {
      try {
        if (tab === 'bodykit') {
          const prefix = `${safeBrand}/${safeModel}/BodyKit/${safeTuningBrand}`;
          await CatalogStorageHelper.deleteFolderRecursively(client, prefix);
        } else {
          // ถ้าเป็น Tab parts ให้ลบโฟลเดอร์ของแบรนด์นี้ใน category ที่เลือก หรือทุก standard category
          const categoriesToClean = category
            ? [CatalogStorageHelper.sanitize(category)]
            : ['Front-Bumper', 'Rear-Bumper', 'Wheels', 'Spoilers'];

          for (const cat of categoriesToClean) {
            const catPrefix = `${safeBrand}/${safeModel}/Part/${cat}/${safeTuningBrand}`;
            await CatalogStorageHelper.deleteFolderRecursively(client, catPrefix);
          }
          // Legacy direct folder
          const legacyPrefix = `${safeBrand}/${safeModel}/Part/${safeTuningBrand}`;
          await CatalogStorageHelper.deleteFolderRecursively(client, legacyPrefix);
        }

        if (typeof client.from === 'function') {
          await client
            .from('car_parts')
            .delete()
            .ilike('manufacturer', tuningBrand);
        }
      } catch (err: any) {
        console.warn('[AdminService] deleteTuningBrand error:', err);
        return { ok: false, error: err?.message || 'ลบข้อมูลไม่สำเร็จ' };
      }
    }

    this.catalogParts.update((list) =>
      list.filter((p) => p.manufacturer?.toLowerCase() !== tuningBrand.toLowerCase()),
    );
    return { ok: true };
  }

  // ลบหมวดหมู่ Part (car_parts)
  async deletePartCategory(
    categoryName: string,
    carModelName: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const client = await this.getClient();
    if (client) {
      try {
        if (typeof client.from === 'function') {
          await client
            .from('car_parts')
            .delete()
            .ilike('category', categoryName);
        }
      } catch (err: any) {
        console.warn('[AdminService] deletePartCategory error:', err);
      }
    }

    this.catalogParts.update((list) =>
      list.filter((p) => p.category?.toLowerCase() !== categoryName.toLowerCase()),
    );
    return { ok: true };
  }

  // Synchronous mutation helpers for tests and local updates
  addBrand(brand: {
    name: string;
    logoUrl?: string;
    logo_url?: string;
    isCustomBg?: boolean;
    is_custom_bg?: boolean;
    id?: string;
  }): RealBrandItem {
    const mapped = mapBrand({
      id: brand.id || `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: brand.name.trim(),
      logo_url: brand.logo_url || brand.logoUrl || 'assets/brands/ferrari.png',
      is_custom_bg: brand.is_custom_bg ?? brand.isCustomBg ?? false,
    });
    this.catalogBrands.update((list) => [...list, mapped]);
    return mapped;
  }

  addCarModel(car: {
    brandId?: string;
    brand_id?: string;
    name: string;
    image?: string;
    image_url?: string;
    bodyType?: string;
    body_type?: string;
    id?: string;
  }): RealCarModelItem {
    const mapped = mapCarModel({
      id: car.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      brand_id: car.brand_id || car.brandId || '',
      name: car.name.trim(),
      image_url: car.image_url || car.image || 'assets/car_pic.png',
      body_type: car.body_type || car.bodyType || 'Coupe',
    });
    this.catalogModels.update((list) => [...list, mapped]);
    return mapped;
  }

  addPartData(part: {
    carId?: string;
    car_model_id?: string;
    category?: string;
    name: string;
    manufacturer?: string;
    image?: string;
    image_url?: string;
    price?: number;
    id?: string;
  }): RealPartItem {
    const mapped = mapPart({
      id: part.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      car_model_id: part.car_model_id || part.carId || '',
      category: part.category || 'Full Body Kits',
      name: part.name.trim(),
      manufacturer: part.manufacturer || 'Custom',
      image_url: part.image_url || part.image || 'assets/car_pic.png',
      price: part.price ?? 0,
    });
    this.catalogParts.update((list) => [...list, mapped]);
    return mapped;
  }

  async getClient(): Promise<SupabaseClient | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    return (this.client ??= await this.createClient());
  }

  /**
   * RBAC Permission Helper: Checks if the current actor can suspend/activate the target user
   * - SuperAdmin cannot be suspended by anyone.
   * - SuperAdmin can suspend both Admin and User.
   * - Admin can suspend ONLY User.
   */
  canSuspendUser(target: AdminUserItem): boolean {
    if (target.role === 'SuperAdmin') return false;
    if (this.auth.isSuperAdmin()) return true; // SuperAdmin จัดการได้ทั้ง Admin และ User
    if (this.auth.isAdmin()) return target.role === 'User'; // Admin จัดการได้เฉพาะ User
    return false;
  }

  // Real Database Queries
  async fetchBuilds(force=false): Promise<void> {
    const owner=this.auth.user()?.id??null;
    if(owner!==this.buildsOwner){this.buildsOwner=owner;this.buildsExpires=0;++this.buildsVersion;this.builds.set([]);this.buildsLoading.set(false);this.buildDeleteBusyId.set(null);}
    if(this.buildsLoading()||this.buildDeleteBusyId()||(!force&&Date.now()<this.buildsExpires))return;
    const version=++this.buildsVersion;
    this.buildsLoading.set(true);this.buildsError.set('');
    try{
      const data=await this.buildsApi.list();
      if(version!==this.buildsVersion||this.auth.user()?.id!==owner)return;
      this.builds.set(data.map(item=>({id:item.id,title:item.title,author:item.author,car:item.car,tag:item.carId||'',likes:String(item.likes??0),image:item.image,parts:item.parts,budget:item.budget,category:item.category,createdAt:item.createdAt||''})));
      this.buildsExpires=Date.now()+5*60*1000;
    }catch(error){if(version===this.buildsVersion){this.buildsExpires=0;this.buildsError.set(error instanceof Error?error.message:'โหลด Build ไม่สำเร็จ');}}
    finally{if(version===this.buildsVersion)this.buildsLoading.set(false);}
  }

  private mapRequest(item:RequestRecord):AdminRequestItem {
    return {id:item.id,title:item.title,author:item.author,car:[item.brandName,item.modelName].filter(Boolean).join(' ') || 'ไม่ระบุรุ่น',
      tag:item.kind,likes:'0',image:item.images[0] || '',images:item.images,status:item.status,category:item.kind,
      description:item.description,requestedAt:item.createdAt,source:item.source,manufacturer:item.manufacturer};
  }
  async fetchRequests(): Promise<void> {
    if (this.requestsLoading() || this.requestBusyId()) return;
    this.requestsLoading.set(true);this.requestsError.set('');
    try { this.requests.set((await this.requestsApi.list(true)).map(item=>this.mapRequest(item))); }
    catch(error) { this.requestsError.set(error instanceof Error ? error.message : 'โหลดคำขอไม่สำเร็จ'); }
    finally { this.requestsLoading.set(false); }
  }

  /**
   * Hybrid Data Fetching for Admin Users:
   * 1. Primary: Calls Backend Express API `GET /api/admin/users` with Bearer token
   * 2. Fallback: Calls Supabase direct RPC `admin_list_users()` if backend is unavailable
   */
  async fetchUsers(): Promise<void> {
    const client = await this.getClient();
    let token: string | undefined;
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        token = data.session?.access_token;
      } catch {
        // ignore session retrieval error
      }
    }

    // ── 1. ลองเรียกผ่าน Backend Express API ──
    let apiLoaded = false;
    try {
      const config = await this.loadConfig();
      if (config.apiBaseUrl && token) {
        const res = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body?.users)) {
            const mapped: AdminUserItem[] = body.users.map((item: any) => ({
              id: item.id,
              username: item.username,
              email: item.email || '-',
              role: (item.role as UserRole) || 'User',
              status: (item.status as 'Active' | 'InActive') || 'Active',
              joinedAt: item.joinedAt
                ? item.joinedAt.includes('T')
                  ? item.joinedAt.split('T')[0]
                  : item.joinedAt
                : '2026-10-30',
              avatarUrl: item.avatarUrl,
            }));
            this.users.set(mapped);
            apiLoaded = true;
            return;
          }
        }
      }
    } catch {
      // Backend API ไม่พร้อม ให้ตกมาทำงานที่ Fallback RPC
    }

    // ── 2. Fallback: เรียกตรงผ่าน Supabase RPC admin_list_users() ──
    if (client && !apiLoaded) {
      try {
        const { data, error } = await client.rpc('admin_list_users');
        if (error) throw error;
        if (Array.isArray(data)) {
          const mapped: AdminUserItem[] = data.map((item: any) => ({
            id: item.id,
            username: item.username,
            email: item.email || '-',
            role: (item.role as UserRole) || 'User',
            status: (item.status as 'Active' | 'InActive') || 'Active',
            joinedAt: item.joined_at
              ? new Date(item.joined_at).toISOString().split('T')[0]
              : '2026-10-30',
          }));
          this.users.set(mapped);
          return;
        }
      } catch {
        // หากทั้ง API และ RPC ล้มเหลว ให้คงสถานะ users เป็น [] และแสดง Error Alert
      }
    }
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await Promise.all([this.fetchBuilds(), this.fetchRequests(), this.fetchUsers()]);
    } catch {
      this.error.set('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteBuild(id: string): Promise<boolean> {
    if(this.buildDeleteBusyId() || this.buildsLoading() || !this.builds().some(build=>build.id===id))return false;
    const owner=this.auth.user()?.id,version=++this.buildsVersion;
    this.buildDeleteBusyId.set(id);this.buildsError.set('');
    try{
      await this.buildsApi.remove(id);
      if(this.auth.user()?.id!==owner||version!==this.buildsVersion)return false;
      this.builds.update(rows=>rows.filter(row=>row.id!==id));
      if(this.selectedBuild()?.id===id)this.selectedBuild.set(null);
      invalidateDiscoverFeed();return true;
    }catch(error){if(this.auth.user()?.id===owner)this.buildsError.set(error instanceof Error?error.message:'ลบ Build ไม่สำเร็จ');return false;}
    finally{if(version===this.buildsVersion)this.buildDeleteBusyId.set(null);}
  }

  async acceptRequest(id:string):Promise<boolean> { return this.reviewRequest(id,'Accepted'); }
  async rejectRequest(id:string):Promise<boolean> { return this.reviewRequest(id,'Rejected'); }
  private async reviewRequest(id:string,status:'Accepted'|'Rejected'):Promise<boolean> {
    if (this.requestBusyId() || this.requestsLoading()) return false;
    this.requestBusyId.set(id);this.requestsError.set('');
    try {
      const item=await this.requestsApi.review(id,status);
      this.requests.update(rows=>rows.map(row=>row.id===id?this.mapRequest(item):row));
      return true;
    } catch(error) { this.requestsError.set(error instanceof Error ? error.message : 'บันทึกสถานะไม่สำเร็จ'); return false; }
    finally { this.requestBusyId.set(null); }
  }

  // Actions: Users with Optimistic UI & Rollback
  async toggleUserStatus(id: string): Promise<{ ok: boolean; message?: string }> {
    const target = this.users().find((u) => u.id === id);
    if (!target) return { ok: false, message: 'ไม่พบผู้ใช้' };

    // SuperAdmin cannot be suspended
    if (target.role === 'SuperAdmin') {
      return { ok: false, message: 'ห้ามระงับ SuperAdmin' };
    }

    // Role-based permission check
    if (!this.canSuspendUser(target)) {
      return { ok: false, message: 'Admin สามารถจัดการได้เฉพาะบัญชี User เท่านั้น' };
    }

    const nextStatus = target.status === 'Active' ? 'InActive' : 'Active';
    const previous = this.users();

    // Optimistic UI update
    this.users.update((list) =>
      list.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)),
    );

    const client = await this.getClient();
    if (client) {
      try {
        let apiUpdated = false;
        try {
          const config = await this.loadConfig();
          const { data: sessionData } = await client.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token && config.apiBaseUrl) {
            const res = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/admin/users/${id}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: nextStatus }),
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              apiUpdated = true;
            } else if (res.status === 403 || res.status === 400) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || 'ถูกปฏิเสธสิทธิ์การเปลี่ยนสถานะ');
            }
          }
        } catch (backendErr: any) {
          if (
            backendErr?.message &&
            (backendErr.message.includes('ถูกปฏิเสธ') ||
              backendErr.message.includes('สิทธิ์') ||
              backendErr.message.includes('ห้าม'))
          ) {
            throw backendErr;
          }
        }

        if (!apiUpdated) {
          const { error } = await client
            .from('profiles')
            .update({ status: nextStatus })
            .eq('id', id);
          if (error) throw error;
        }
      } catch (err: any) {
        // Rollback
        this.users.set(previous);
        this.error.set('เปลี่ยนสถานะผู้ใช้ไม่สำเร็จ');
        return { ok: false, message: 'เปลี่ยนสถานะไม่สำเร็จ: ' + (err?.message || 'เครือข่ายหรือสิทธิ์') };
      }
    }
    return { ok: true };
  }

  async updateUserRole(id: string, newRole: UserRole): Promise<{ ok: boolean; message?: string }> {
    // RBAC: Only SuperAdmin can modify user roles
    if (!this.auth.isSuperAdmin()) {
      return {
        ok: false,
        message: 'ต้องใช้สิทธิ์ SuperAdmin เท่านั้น',
      };
    }

    const target = this.users().find((u) => u.id === id);
    if (!target) return { ok: false, message: 'ไม่พบผู้ใช้' };

    const previous = this.users();

    // Optimistic UI update
    this.users.update((list) =>
      list.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
    );

    const client = await this.getClient();
    if (client) {
      try {
        let apiUpdated = false;
        try {
          const config = await this.loadConfig();
          const { data: sessionData } = await client.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token && config.apiBaseUrl) {
            const res = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/api/admin/users/${id}/role`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ role: newRole }),
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              apiUpdated = true;
            } else if (res.status === 403 || res.status === 400) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || 'ถูกปฏิเสธสิทธิ์การเปลี่ยน Role');
            }
          }
        } catch (backendErr: any) {
          if (
            backendErr?.message &&
            (backendErr.message.includes('ถูกปฏิเสธ') ||
              backendErr.message.includes('สิทธิ์') ||
              backendErr.message.includes('ต้องใช้สิทธิ์'))
          ) {
            throw backendErr;
          }
        }

        if (!apiUpdated) {
          const { error } = await client
            .from('profiles')
            .update({ role: newRole })
            .eq('id', id);
          if (error) throw error;
        }
      } catch (err: any) {
        // Rollback
        this.users.set(previous);
        this.error.set('เปลี่ยน Role ไม่สำเร็จ');
        return { ok: false, message: 'เปลี่ยน Role ไม่สำเร็จ: ' + (err?.message || 'เครือข่ายหรือสิทธิ์') };
      }
    }
    return { ok: true };
  }

  markAllNotificationsRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }
}
