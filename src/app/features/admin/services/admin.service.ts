import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_CLIENT, AUTH_CONFIG } from '../../../core/auth/auth-client';
import { AuthService, UserRole } from '../../../core/auth/auth.service';
import { CatalogStorageHelper } from '../../../core/storage/catalog-storage';

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

const INITIAL_BUILDS: AdminBuildItem[] = [
  {
    id: 'b-1',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Sano Widebody Fenders', 'Carbon Fiber Front Lip', 'GT Wing Spoiler', 'Forged 18-inch Wheels'],
    budget: 245000,
    category: 'Show',
    createdAt: '2026-10-28',
  },
  {
    id: 'b-2',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Dual Titanium Exhaust', 'Track Coilovers', 'Roll Cage', 'Cup 2 Tires'],
    budget: 310000,
    category: 'Track',
    createdAt: '2026-10-27',
  },
  {
    id: 'b-3',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Air Suspension Kit', 'Custom 3-piece Wheels', 'Alcantara Interior'],
    budget: 280000,
    category: 'Street',
    createdAt: '2026-10-26',
  },
  {
    id: 'b-4',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Full Carbon Aerodynamic Pack', 'Big Brake Kit 6-Pot'],
    budget: 350000,
    category: 'Track',
    createdAt: '2026-10-25',
  },
  {
    id: 'b-5',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Sano Front Bumper', 'Side Skirts', 'Rear Diffuser'],
    budget: 190000,
    category: 'Street',
    createdAt: '2026-10-24',
  },
  {
    id: 'b-6',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Custom Candy Red Paint', 'Polished Lip Wheels', 'Audio System'],
    budget: 220000,
    category: 'Show',
    createdAt: '2026-10-23',
  },
  {
    id: 'b-7',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Stage 2 Turbo Kit', 'Front Mount Intercooler', 'Oil Cooler'],
    budget: 420000,
    category: 'Track',
    createdAt: '2026-10-22',
  },
  {
    id: 'b-8',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    parts: ['Daily Street Lowering Springs', 'OEM+ Spoiler', 'Enkei RPF1'],
    budget: 110000,
    category: 'Street',
    createdAt: '2026-10-21',
  },
];

const INITIAL_REQUESTS: AdminRequestItem[] = [
  {
    id: 'req-1',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Pending',
    category: 'Body Kit',
    description: 'ขอเพิ่มพาร์ต Sano Design V2 Widebody kit สำหรับโมเดล Toyota GT86 รุ่นปี 2017+',
    requestedAt: '2026-10-29',
  },
  {
    id: 'req-2',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Pending',
    category: 'Exhaust',
    description: 'ขอชุดท่อไอเสีย Tomei Expreme Ti Titanium Catback',
    requestedAt: '2026-10-28',
  },
  {
    id: 'req-3',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Accepted',
    category: 'Suspension',
    description: 'ขอชุดโช้ค KW Variant 3 Coilovers พร้อมระบบ Rebound damping',
    requestedAt: '2026-10-27',
  },
  {
    id: 'req-4',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Rejected',
    category: 'Wheels',
    description: 'ล้อ Custom 22 นิ้ว (ขนาดเกินสเปกรองรับตัวถังเดิม)',
    requestedAt: '2026-10-26',
  },
  {
    id: 'req-5',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Pending',
    category: 'Aero',
    description: 'ขอสปอยเลอร์ Voltex Type 7 Swan Neck GT Wing คาร์บอนไฟเบอร์',
    requestedAt: '2026-10-25',
  },
  {
    id: 'req-6',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Pending',
    category: 'Brakes',
    description: 'ขอชุดจานเบรก Brembo GT 355mm drilled พร้อม 4-piston calipers',
    requestedAt: '2026-10-24',
  },
  {
    id: 'req-7',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Accepted',
    category: 'Interior',
    description: 'เบาะ Bride Stradia III Carbon Kevlar',
    requestedAt: '2026-10-23',
  },
  {
    id: 'req-8',
    title: 'Sano Design body kit on Toyota GT86.',
    author: 'username',
    car: 'Toyota GT86',
    tag: 'Toyota',
    likes: '1000k+',
    image: 'assets/car_pic.png',
    status: 'Pending',
    category: 'Lighting',
    description: 'ไฟท้าย Valenti Revo LED Sequential Tail Lights',
    requestedAt: '2026-10-22',
  },
];

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
  private readonly createClient = inject(AUTH_CLIENT);
  private readonly loadConfig = inject(AUTH_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private client: SupabaseClient | null = null;

  // Real Database Loading & Error States
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Builds state
  readonly builds = signal<AdminBuildItem[]>(INITIAL_BUILDS);
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
  readonly requests = signal<AdminRequestItem[]>(INITIAL_REQUESTS);
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
          this.catalogModels.set(mapped);
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
            // ตรวจสอบว่ามีรูปรถใน Storage หรือไม่
            const storageCarImage = `https://oxzejsgfazbjjqopkzuf.supabase.co/storage/v1/object/public/catalog/${brandName}/${m.name}/CarPicture.jpg`;

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

      // 1. ดึง BodyKit workshops และ items
      const bkWorkshops = await CatalogStorageHelper.listWorkshops(
        client,
        brandName,
        modelName,
        'BodyKit',
      );
      for (const ws of bkWorkshops) {
        const items = await CatalogStorageHelper.listItems(
          client,
          brandName,
          modelName,
          'BodyKit',
          ws.name,
        );
        for (const item of items) {
          allParts.push({
            id: `${modelName}-bodykit-${ws.name}-${item.name}`,
            car_model_id: modelName,
            carId: modelName,
            category: 'BodyKit',
            name: item.displayName || item.name,
            manufacturer: ws.name,
            image_url: item.imageUrl,
            image: item.imageUrl,
            price: 0,
          });
        }
      }

      // 2. ดึง Part workshops และ items
      const partWorkshops = await CatalogStorageHelper.listWorkshops(
        client,
        brandName,
        modelName,
        'Part',
      );
      for (const ws of partWorkshops) {
        const items = await CatalogStorageHelper.listItems(
          client,
          brandName,
          modelName,
          'Part',
          ws.name,
        );
        for (const item of items) {
          allParts.push({
            id: `${modelName}-part-${ws.name}-${item.name}`,
            car_model_id: modelName,
            carId: modelName,
            category: 'Part',
            name: item.displayName || item.name,
            manufacturer: ws.name,
            image_url: item.imageUrl,
            image: item.imageUrl,
            price: 0,
          });
        }
      }

      if (allParts.length > 0) {
        this.catalogParts.set(allParts);
      } else {
        await this.fetchCatalogParts(modelName);
      }

      return {
        workshops: {
          bodykit: bkWorkshops,
          parts: partWorkshops,
        },
        parts: allParts,
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
      if (error) {
        console.error('[AdminService] insertCarPart error:', error);
        throw error;
      }
      const mapped = mapPart(data);
      this.catalogParts.update((list) => [...list, mapped]);
      return { ok: true, data: mapped };
    } catch (err: any) {
      console.error('[AdminService] insertCarPart exception:', err);
      return { ok: false, error: err?.message || 'บันทึกพาร์ตล้มเหลว' };
    }
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
  async fetchBuilds(): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    try {
      const { data, error } = await client
        .from('builds')
        .select('*, profiles(username)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped: AdminBuildItem[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          author: item.profiles?.username || 'Unknown',
          car: item.car_name,
          tag: item.tag,
          likes: item.likes >= 1000 ? `${(item.likes / 1000).toFixed(0)}k+` : `${item.likes || 0}`,
          image: item.image_url || 'assets/car_pic.png',
          parts: Array.isArray(item.parts) ? item.parts : [],
          budget: Number(item.budget) || 0,
          category: item.category || 'Street',
          createdAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
        }));
        this.builds.set(mapped);
      }
    } catch {
      // Graceful fallback to initial seed builds
    }
  }

  async fetchRequests(): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    try {
      const { data, error } = await client
        .from('part_requests')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped: AdminRequestItem[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          author: item.profiles?.username || 'Unknown',
          car: item.car_model,
          tag: item.tag,
          likes: '1000k+',
          image: 'assets/car_pic.png',
          status: item.status,
          category: item.category,
          description: item.description,
          requestedAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
        }));
        this.requests.set(mapped);
      }
    } catch {
      // Graceful fallback to initial seed requests
    }
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

  // Actions: Builds with Optimistic UI & Rollback
  async deleteBuild(id: string): Promise<boolean> {
    const previous = this.builds();
    const exists = previous.some((b) => b.id === id);
    if (!exists) return false;

    // Optimistic UI update
    this.builds.set(previous.filter((b) => b.id !== id));
    if (this.selectedBuild()?.id === id) {
      this.selectedBuild.set(null);
    }

    const client = await this.getClient();
    if (client) {
      try {
        const { error } = await client
          .from('builds')
          .update({ is_deleted: true })
          .eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        // Rollback
        this.builds.set(previous);
        this.error.set('ลบ Build ไม่สำเร็จ: ' + (err?.message || 'เครือข่ายขัดข้อง'));
        return false;
      }
    }
    return true;
  }

  // Actions: Requests with Optimistic UI & Rollback
  async acceptRequest(id: string): Promise<boolean> {
    const previous = this.requests();
    this.requests.update((list) =>
      list.map((r) => (r.id === id ? { ...r, status: 'Accepted' } : r)),
    );

    const client = await this.getClient();
    if (client) {
      try {
        const { error } = await client
          .from('part_requests')
          .update({ status: 'Accepted' })
          .eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        // Rollback
        this.requests.set(previous);
        this.error.set('อนุมัติคำขอไม่สำเร็จ: ' + (err?.message || 'เครือข่ายขัดข้อง'));
        return false;
      }
    }
    return true;
  }

  async rejectRequest(id: string): Promise<boolean> {
    const previous = this.requests();
    this.requests.update((list) =>
      list.map((r) => (r.id === id ? { ...r, status: 'Rejected' } : r)),
    );

    const client = await this.getClient();
    if (client) {
      try {
        const { error } = await client
          .from('part_requests')
          .update({ status: 'Rejected' })
          .eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        // Rollback
        this.requests.set(previous);
        this.error.set('ปฏิเสธคำขอไม่สำเร็จ: ' + (err?.message || 'เครือข่ายขัดข้อง'));
        return false;
      }
    }
    return true;
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
