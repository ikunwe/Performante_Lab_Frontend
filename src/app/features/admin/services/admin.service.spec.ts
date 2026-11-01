import { AdminBuildsApi } from './admin-builds.api';
import { RequestsApi } from '../../../core/requests/requests.api';
import { TestBed } from '@angular/core/testing';
import { AdminService, INITIAL_USERS } from './admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTH_CLIENT, AUTH_CONFIG } from '../../../core/auth/auth-client';
import { signal } from '@angular/core';

describe('AdminService', () => {
  let service: AdminService;
  const build={id:'database-build',title:'Rosso Build',author:'Driver',car:'Civic',carId:'ref:honda:civic',parts:[],budget:0,category:'Street',image:'https://test/car.png',likes:5,isPublic:false,isOwn:false};
  const buildsApi={list:vi.fn(),remove:vi.fn()};
  const request={id:'request-test',title:'New brand',kind:'brand' as const,description:'Details',brandName:'',modelName:'',manufacturer:'',source:'',images:[],author:'Driver',status:'Pending' as const,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  const requestsApi={list:vi.fn(),review:vi.fn()};
  let isAdminSignal = signal(true);
  let isSuperAdminSignal = signal(true);
  let mockSupabaseClient: any;
  let mockLoadConfig: any;

  beforeEach(async () => {
    requestsApi.list.mockResolvedValue([]);requestsApi.review.mockImplementation(async (_id:string,status:string)=>({...request,status}));
    buildsApi.list.mockResolvedValue([build]);buildsApi.remove.mockResolvedValue(undefined);
    isAdminSignal.set(true);
    isSuperAdminSignal.set(true);

    mockSupabaseClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'gen-uuid-1',
                name: 'Test Item',
                slug: 'test-item',
                logo_url: 'https://test.supabase.co/logo.png',
                image_url: 'https://test.supabase.co/img.png',
                is_custom_bg: false,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    };

    mockLoadConfig = vi.fn().mockResolvedValue({
      supabaseUrl: 'https://test.supabase.co',
      supabasePublishableKey: 'test-key',
      apiBaseUrl: 'http://localhost:3000',
    });

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        {provide:AdminBuildsApi,useValue:buildsApi},
        {provide:RequestsApi,useValue:requestsApi},
        {
          provide: AUTH_CLIENT,
          useValue: vi.fn().mockResolvedValue(null),
        },
        {
          provide: AUTH_CONFIG,
          useValue: mockLoadConfig,
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: isAdminSignal,
            isSuperAdmin: isSuperAdminSignal,
            displayName: signal('Super Admin User'),
            user: signal({ id:'admin-test',email: 'superadmin@performante.lab' }),
            userRole: signal('SuperAdmin'),
          },
        },
      ],
    });
    service = TestBed.inject(AdminService);
    await service.fetchBuilds(true);
    // Seed test users for permission tests
    service.users.set([...INITIAL_USERS]);
  });

  describe('Builds management', () => {
    it('deletes a build by id', async () => {
      const initialCount = service.builds().length;
      expect(initialCount).toBeGreaterThan(0);

      const targetId = service.builds()[0].id;
      const ok = await service.deleteBuild(targetId);

      expect(ok).toBe(true);
      expect(service.builds().some((b) => b.id === targetId)).toBe(false);
      expect(service.builds().length).toBe(initialCount - 1);
    });

    it('filters builds by query', () => {
      service.discoverSearch.set('Rosso');
      const filtered = service.filteredBuilds();
      expect(
        filtered.every(
          (b) =>
            b.title.toLowerCase().includes('rosso') ||
            b.car.toLowerCase().includes('rosso'),
        ),
      ).toBe(true);
    });
  });

  describe('Requests management', () => {
    it('accepts a request', async () => {
      requestsApi.list.mockResolvedValueOnce([request]); await service.fetchRequests();
      const reqId = service.requests()[0].id;
      await service.acceptRequest(reqId);

      const updated = service.requests().find((r) => r.id === reqId);
      expect(updated?.status).toBe('Accepted');
    });

    it('rejects a request', async () => {
      requestsApi.list.mockResolvedValueOnce([request]); await service.fetchRequests();
      const reqId = service.requests()[0].id;
      await service.rejectRequest(reqId);

      const updated = service.requests().find((r) => r.id === reqId);
      expect(updated?.status).toBe('Rejected');
    });
  });

  describe('Users management & RBAC', () => {
    it('initializes users as empty array by default', () => {
      const freshService = TestBed.inject(AdminService);
      freshService.users.set([]);
      expect(freshService.users()).toEqual([]);
    });

    it('evaluates canSuspendUser correctly for SuperAdmin and Admin', () => {
      const userTarget = service.users().find((u) => u.role === 'User')!;
      const adminTarget = service.users().find((u) => u.role === 'Admin')!;
      const superAdminTarget = service.users().find((u) => u.role === 'SuperAdmin')!;

      // When Actor is SuperAdmin:
      isSuperAdminSignal.set(true);
      isAdminSignal.set(true);
      expect(service.canSuspendUser(userTarget)).toBe(true);
      expect(service.canSuspendUser(adminTarget)).toBe(true);
      expect(service.canSuspendUser(superAdminTarget)).toBe(false);

      // When Actor is Admin:
      isSuperAdminSignal.set(false);
      isAdminSignal.set(true);
      expect(service.canSuspendUser(userTarget)).toBe(true);
      expect(service.canSuspendUser(adminTarget)).toBe(false);
      expect(service.canSuspendUser(superAdminTarget)).toBe(false);

      // When Actor is regular User:
      isSuperAdminSignal.set(false);
      isAdminSignal.set(false);
      expect(service.canSuspendUser(userTarget)).toBe(false);
      expect(service.canSuspendUser(adminTarget)).toBe(false);
      expect(service.canSuspendUser(superAdminTarget)).toBe(false);
    });

    it('allows Admin to suspend/activate User role accounts', async () => {
      isSuperAdminSignal.set(false);
      isAdminSignal.set(true);

      const user = service.users().find((u) => u.role === 'User');
      expect(user).toBeDefined();

      const initialStatus = user!.status;
      const res = await service.toggleUserStatus(user!.id);

      expect(res.ok).toBe(true);
      const updated = service.users().find((u) => u.id === user!.id);
      expect(updated?.status).not.toBe(initialStatus);
    });

    it('blocks Admin from suspending other Admin users', async () => {
      isSuperAdminSignal.set(false);
      isAdminSignal.set(true);

      const adminTarget = service.users().find((u) => u.role === 'Admin');
      expect(adminTarget).toBeDefined();

      const res = await service.toggleUserStatus(adminTarget!.id);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Admin สามารถจัดการได้เฉพาะบัญชี User');
    });

    it('allows SuperAdmin to suspend Admin users', async () => {
      isSuperAdminSignal.set(true);
      isAdminSignal.set(true);

      const adminTarget = service.users().find((u) => u.role === 'Admin');
      expect(adminTarget).toBeDefined();

      const initialStatus = adminTarget!.status;
      const res = await service.toggleUserStatus(adminTarget!.id);
      expect(res.ok).toBe(true);

      const updated = service.users().find((u) => u.id === adminTarget!.id);
      expect(updated?.status).not.toBe(initialStatus);
    });

    it('prevents suspending a SuperAdmin user even by SuperAdmin', async () => {
      isSuperAdminSignal.set(true);
      isAdminSignal.set(true);

      const superAdminUser = service.users().find((u) => u.role === 'SuperAdmin');
      expect(superAdminUser).toBeDefined();

      const res = await service.toggleUserStatus(superAdminUser!.id);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('SuperAdmin');
    });

    it('allows SuperAdmin to update any user role', async () => {
      isSuperAdminSignal.set(true);
      const user = service.users().find((u) => u.role === 'User');
      expect(user).toBeDefined();

      const res = await service.updateUserRole(user!.id, 'Admin');
      expect(res.ok).toBe(true);

      const updated = service.users().find((u) => u.id === user!.id);
      expect(updated?.role).toBe('Admin');
    });

    it('blocks Admin (non-SuperAdmin) from modifying user roles', async () => {
      isSuperAdminSignal.set(false);
      const user = service.users().find((u) => u.role === 'User');
      expect(user).toBeDefined();

      const res = await service.updateUserRole(user!.id, 'Admin');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('SuperAdmin');

      const notUpdated = service.users().find((u) => u.id === user!.id);
      expect(notUpdated?.role).toBe('User');
    });
  });

  describe('Hybrid Data Fetching (fetchUsers)', () => {
    it('fetches users with actual emails from Backend Express API', async () => {
      (service as any).client = mockSupabaseClient;
      const mockUsers = [
        {
          id: 'u-101',
          username: 'real_driver',
          email: 'driver.real@example.com',
          role: 'User',
          status: 'Active',
          joinedAt: '2026-10-31T00:00:00.000Z',
        },
      ];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ users: mockUsers }),
      }) as any;

      try {
        await service.fetchUsers();
        expect(service.users().length).toBe(1);
        expect(service.users()[0].email).toBe('driver.real@example.com');
        expect(service.users()[0].username).toBe('real_driver');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to Supabase RPC admin_list_users() if Backend Express API fails', async () => {
      (service as any).client = mockSupabaseClient;
      const originalFetch = globalThis.fetch;
      // Simulate Backend offline
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Backend offline')) as any;

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            id: 'u-202',
            username: 'rpc_user',
            email: 'rpc.user@example.com',
            role: 'Admin',
            status: 'Active',
            joined_at: '2026-10-31T01:00:00.000Z',
          },
        ],
        error: null,
      });

      try {
        await service.fetchUsers();
        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('admin_list_users');
        expect(service.users().length).toBe(1);
        expect(service.users()[0].email).toBe('rpc.user@example.com');
        expect(service.users()[0].username).toBe('rpc_user');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('uses "-" placeholder when user has no email', async () => {
      (service as any).client = mockSupabaseClient;
      const mockUsers = [
        {
          id: 'u-303',
          username: 'no_email_user',
          email: null,
          role: 'User',
          status: 'Active',
          joinedAt: '2026-10-31T00:00:00.000Z',
        },
      ];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ users: mockUsers }),
      }) as any;

      try {
        await service.fetchUsers();
        expect(service.users().length).toBe(1);
        expect(service.users()[0].email).toBe('-');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Real Car Catalog Database Operations', () => {
    it('initializes catalog signals as empty arrays', () => {
      expect(service.catalogBrands()).toEqual([]);
      expect(service.catalogModels()).toEqual([]);
      expect(service.catalogParts()).toEqual([]);
      expect(service.catalogLoading()).toBe(false);
    });

    it('fetches brands from car_brand_reference table and populates catalogBrands signal', async () => {
      const mockDbBrands = [
        {
          id: 'ferrari',
          name: 'Ferrari',
          slug: 'ferrari',
          details: {
            logoReferenceUrl: 'https://test.supabase.co/ferrari.png',
          },
          collected_at: '2026-10-31T00:00:00.000Z',
        },
        {
          id: 'great-wall',
          name: 'Great Wall Motor',
          slug: 'great-wall',
          details: {
            logoReferenceUrl: '',
          },
          collected_at: '2026-10-31T00:00:00.000Z',
        },
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbBrands, error: null }),
      });
      (service as any).client = mockSupabaseClient;

      await service.fetchCatalogBrands();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('car_brand_reference');
      expect(service.catalogBrands().length).toBe(2);
      expect(service.catalogBrands()[0].name).toBe('Ferrari');
      expect(service.catalogBrands()[0].logoUrl).toBe('https://test.supabase.co/ferrari.png');
      expect(service.catalogBrands()[0].isCustomBg).toBe(true);

      // Great Wall mapped to GWM with storage logo fallback
      expect(service.catalogBrands()[1].name).toBe('GWM');
      expect(service.catalogBrands()[1].logoUrl).toContain('Great Wall Motor/logo.png');
    });

    it('fetches car models from car_brand_reference table modelCatalog filtered by brand_id', async () => {
      const mockBrandRecord = {
        id: 'ferrari',
        name: 'Ferrari',
        details: {
          modelCatalog: {
            models: [
              {
                id: 'ferrari-488-pista',
                name: '488 Pista',
              },
            ],
          },
        },
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBrandRecord, error: null }),
      });
      (service as any).client = mockSupabaseClient;

      await service.fetchCatalogModels('ferrari');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('car_brand_reference');
      expect(service.catalogModels().length).toBe(1);
      expect(service.catalogModels()[0].name).toBe('488 Pista');
      expect(service.catalogModels()[0].brandId).toBe('ferrari');
    });

    it('fetches car parts from car_parts table filtered by car_model_id', async () => {
      const mockDbParts = [
        {
          id: 'p-300',
          car_model_id: 'c-200',
          category: 'Full Body Kits',
          name: 'Carbon Aero Kit',
          manufacturer: 'Ferrari',
          image_url: 'https://test.supabase.co/kit.png',
          price: 500000,
        },
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbParts, error: null }),
      });
      (service as any).client = mockSupabaseClient;

      await service.fetchCatalogParts('c-200');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('car_parts');
      expect(service.catalogParts().length).toBe(1);
      expect(service.catalogParts()[0].name).toBe('Carbon Aero Kit');
      expect(service.catalogParts()[0].carId).toBe('c-200');
    });

    it('inserts brand into car_brand_reference and updates catalogBrands signal', async () => {
      const insertedRow = {
        id: 'mclaren',
        name: 'McLaren',
        slug: 'mclaren',
        details: {
          logoReferenceUrl: 'https://test.supabase.co/mclaren.png',
        },
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
          }),
        }),
      });
      (service as any).client = mockSupabaseClient;

      const res = await service.insertBrand({
        name: 'McLaren',
        logo_url: 'https://test.supabase.co/mclaren.png',
      });

      expect(res.ok).toBe(true);
      expect(service.catalogBrands().some((b) => b.name === 'McLaren')).toBe(true);
    });

    it('inserts car model into car_brand_reference and updates catalogModels signal', async () => {
      const mockBrandRecord = {
        id: 'mclaren',
        name: 'McLaren',
        details: {
          modelCatalog: {
            brandId: 'mclaren',
            brandName: 'McLaren',
            models: [],
          },
        },
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBrandRecord, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      (service as any).client = mockSupabaseClient;

      const res = await service.insertCarModel({
        brand_id: 'mclaren',
        name: '720S',
        image_url: 'https://test.supabase.co/720s.png',
      });

      expect(res.ok).toBe(true);
      expect(service.catalogModels().some((c) => c.name === '720S')).toBe(true);
    });

    it('inserts part into car_parts and updates catalogParts signal', async () => {
      const insertedRow = {
        id: 'p-999',
        car_model_id: 'c-999',
        category: 'Exhaust',
        name: 'Titanium Exhaust',
        manufacturer: 'Akrapovic',
        image_url: 'https://test.supabase.co/exhaust.png',
        price: 320000,
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
          }),
        }),
      });
      (service as any).client = mockSupabaseClient;

      const res = await service.insertCarPart({
        car_model_id: 'c-999',
        category: 'Exhaust',
        name: 'Titanium Exhaust',
        manufacturer: 'Akrapovic',
        image_url: 'https://test.supabase.co/exhaust.png',
        price: 320000,
      });

      expect(res.ok).toBe(true);
      expect(service.catalogParts().some((p) => p.name === 'Titanium Exhaust')).toBe(true);
    });

    it('fetches brands directly from storage catalog bucket when available', async () => {
      const storageClient = {
        storage: {
          from: vi.fn().mockImplementation(() => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === '') {
                return Promise.resolve({
                  data: [
                    { name: 'Ferrari', id: null, metadata: null },
                    { name: 'Toyota', id: null, metadata: null },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari') {
                return Promise.resolve({
                  data: [{ name: 'logo.png', id: '1', metadata: {} }],
                  error: null,
                });
              }
              if (path === 'Toyota') {
                return Promise.resolve({
                  data: [{ name: 'logo.svg', id: '2', metadata: {} }],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
            getPublicUrl: vi.fn().mockImplementation((filePath: string) => ({
              data: { publicUrl: `https://test.supabase.co/catalog/${filePath}` },
            })),
          })),
        },
      } as any;
      (service as any).client = storageClient;

      await service.fetchCatalogBrands();

      expect(service.catalogBrands().length).toBe(2);
      expect(service.catalogBrands()[0].name).toBe('Ferrari');
      expect(service.catalogBrands()[0].logoUrl).toBe('https://test.supabase.co/catalog/Ferrari/logo.png');
      expect(service.catalogBrands()[1].name).toBe('Toyota');
      expect(service.catalogBrands()[1].logoUrl).toBe('https://test.supabase.co/catalog/Toyota/logo.svg');
    });

    it('fetches car models directly from storage catalog bucket', async () => {
      const storageClient = {
        storage: {
          from: vi.fn().mockImplementation(() => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === 'Ferrari') {
                return Promise.resolve({
                  data: [
                    { name: '488-Pista', id: null, metadata: null },
                    { name: 'logo.png', id: '1', metadata: {} },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista') {
                return Promise.resolve({
                  data: [
                    { name: 'CarPicture.jpg', id: 'p1', metadata: {} },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
            getPublicUrl: vi.fn().mockImplementation((filePath: string) => ({
              data: { publicUrl: `https://test.supabase.co/catalog/${filePath}` },
            })),
          })),
        },
      } as any;
      (service as any).client = storageClient;

      await service.fetchCatalogModels('Ferrari');

      expect(service.catalogModels().length).toBe(1);
      expect(service.catalogModels()[0].name).toBe('488-Pista');
      expect(service.catalogModels()[0].image_url).toBe(
        'https://test.supabase.co/catalog/Ferrari/488-Pista/CarPicture.jpg',
      );
    });

    it('fetches catalog tuning (BodyKit and Part workshops and items) from storage', async () => {
      const storageClient = {
        storage: {
          from: vi.fn().mockImplementation(() => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === 'Ferrari/488-Pista/BodyKit') {
                return Promise.resolve({
                  data: [{ name: 'Novitec', id: null, metadata: null }],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista/BodyKit/Novitec') {
                return Promise.resolve({
                  data: [
                    { name: 'logo.png', id: 'l1', metadata: {} },
                    { name: 'Carbon-Lip.png', id: 'i1', metadata: {} },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista/Part') {
                return Promise.resolve({
                  data: [{ name: 'Brembo', id: null, metadata: null }],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista/Part/Brembo') {
                return Promise.resolve({
                  data: [
                    { name: 'logo.png', id: 'l2', metadata: {} },
                    { name: 'GT-R-Brake.png', id: 'i2', metadata: {} },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
            getPublicUrl: vi.fn().mockImplementation((filePath: string) => ({
              data: { publicUrl: `https://test.supabase.co/catalog/${filePath}` },
            })),
          })),
        },
      } as any;
      (service as any).client = storageClient;

      const res = await service.fetchCatalogTuning('Ferrari', '488-Pista');

      expect(res.workshops.bodykit.length).toBe(1);
      expect(res.workshops.bodykit[0].name).toBe('Novitec');
      expect(res.workshops.parts.length).toBe(1);
      expect(res.workshops.parts[0].name).toBe('Brembo');
      expect(res.parts.length).toBe(2);
      expect(res.parts[0].name).toBe('Carbon Lip');
      expect(res.parts[0].manufacturer).toBe('Novitec');
      expect(res.parts[1].name).toBe('GT R Brake');
      expect(res.parts[1].manufacturer).toBe('Brembo');
      expect(service.catalogParts().length).toBe(2);
    });

    it('deletes part item, tuning brand, and category from catalogParts and storage', async () => {
      service.catalogParts.set([
        {
          id: 'p-1',
          car_model_id: '488-Pista',
          category: 'Wheels',
          name: 'Wheel Item 1',
          manufacturer: 'Enkei',
          image_url: 'https://test/1.png',
          price: 10000,
        },
        {
          id: 'p-2',
          car_model_id: '488-Pista',
          category: 'Wheels',
          name: 'Wheel Item 2',
          manufacturer: 'BBS',
          image_url: 'https://test/2.png',
          price: 20000,
        },
        {
          id: 'p-3',
          car_model_id: '488-Pista',
          category: 'Exhaust',
          name: 'Exhaust 1',
          manufacturer: 'Akrapovic',
          image_url: 'https://test/3.png',
          price: 50000,
        },
      ]);

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        ilike: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockClient = {
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({ data: [], error: null }),
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      } as any;
      (service as any).client = mockClient;

      // 1. Delete single part item
      await service.deletePartItem('p-1');
      expect(service.catalogParts().some((p) => p.id === 'p-1')).toBe(false);
      expect(service.catalogParts().length).toBe(2);

      // 2. Delete tuning brand
      await service.deleteTuningBrand('Ferrari', '488-Pista', 'parts', 'BBS');
      expect(service.catalogParts().some((p) => p.manufacturer === 'BBS')).toBe(false);
      expect(service.catalogParts().length).toBe(1);

      // 3. Delete category
      await service.deletePartCategory('Exhaust', '488-Pista');
      expect(service.catalogParts().some((p) => p.category === 'Exhaust')).toBe(false);
      expect(service.catalogParts().length).toBe(0);
    });

    it('updates car part name, price, and image_url in catalogParts and database', async () => {
      service.catalogParts.set([
        {
          id: 'p-100',
          car_model_id: '488-Pista',
          category: 'BodyKit',
          name: 'Old Name',
          manufacturer: 'Novitec',
          image_url: 'https://test/old.png',
          price: 50000,
        },
      ]);

      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'p-100',
                    car_model_id: '488-Pista',
                    category: 'BodyKit',
                    name: 'New Name',
                    manufacturer: 'Novitec',
                    image_url: 'https://test/new.png',
                    price: 75000,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any;
      (service as any).client = mockClient;

      const res = await service.updateCarPart({
        id: 'p-100',
        name: 'New Name',
        price: 75000,
        image_url: 'https://test/new.png',
      });

      expect(res.ok).toBe(true);
      expect(res.data?.name).toBe('New Name');
      expect(res.data?.price).toBe(75000);
      expect(service.catalogParts()[0].name).toBe('New Name');
      expect(service.catalogParts()[0].price).toBe(75000);
    });
  });
  it('shows empty backend request results and never substitutes demonstration requests', async () => {
    requestsApi.list.mockResolvedValueOnce([]);await service.fetchRequests();expect(service.requests()).toEqual([]);
  });
  it('retains the last request status when Admin review fails', async () => {
    requestsApi.list.mockResolvedValueOnce([request]);await service.fetchRequests();
    requestsApi.review.mockRejectedValueOnce(new Error('offline'));
    expect(await service.acceptRequest(request.id)).toBe(false);
    expect(service.requests()[0].status).toBe('Pending');expect(service.requestsError()).toBe('offline');
  });

  it('uses empty database results without restoring demonstration builds', async () => {
    buildsApi.list.mockResolvedValueOnce([]);await service.fetchBuilds(true);expect(service.builds()).toEqual([]);
  });
  it('shows errors and keeps only the last real database snapshot on fetch failure', async () => {
    buildsApi.list.mockRejectedValueOnce(new Error('offline'));await service.fetchBuilds(true);
    expect(service.builds().map(row=>row.id)).toEqual([build.id]);expect(service.buildsError()).toBe('offline');
  });
  it('does not remove a card or report success when backend deletion fails', async () => {
    buildsApi.remove.mockRejectedValueOnce(new Error('offline'));expect(await service.deleteBuild(build.id)).toBe(false);
    expect(service.builds()).toHaveLength(1);expect(service.buildsError()).toBe('offline');
  });

});
