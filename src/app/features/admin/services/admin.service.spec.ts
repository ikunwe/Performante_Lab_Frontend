import { TestBed } from '@angular/core/testing';
import { AdminService, INITIAL_USERS } from './admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTH_CLIENT, AUTH_CONFIG } from '../../../core/auth/auth-client';
import { signal } from '@angular/core';

describe('AdminService', () => {
  let service: AdminService;
  let isAdminSignal = signal(true);
  let isSuperAdminSignal = signal(true);
  let mockSupabaseClient: any;
  let mockLoadConfig: any;

  beforeEach(() => {
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
            user: signal({ email: 'superadmin@performante.lab' }),
            userRole: signal('SuperAdmin'),
          },
        },
      ],
    });
    service = TestBed.inject(AdminService);
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
      const reqId = service.requests()[0].id;
      await service.acceptRequest(reqId);

      const updated = service.requests().find((r) => r.id === reqId);
      expect(updated?.status).toBe('Accepted');
    });

    it('rejects a request', async () => {
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

    it('fetches brands from car_brands table and populates catalogBrands signal', async () => {
      const mockDbBrands = [
        {
          id: 'b-100',
          name: 'Ferrari',
          slug: 'ferrari',
          logo_url: 'https://test.supabase.co/ferrari.png',
          is_custom_bg: true,
          created_at: '2026-10-31T00:00:00.000Z',
        },
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbBrands, error: null }),
      });
      (service as any).client = mockSupabaseClient;

      await service.fetchCatalogBrands();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('car_brands');
      expect(service.catalogBrands().length).toBe(1);
      expect(service.catalogBrands()[0].name).toBe('Ferrari');
      expect(service.catalogBrands()[0].logoUrl).toBe('https://test.supabase.co/ferrari.png');
      expect(service.catalogBrands()[0].isCustomBg).toBe(true);
    });

    it('fetches car models from car_models table filtered by brand_id', async () => {
      const mockDbModels = [
        {
          id: 'c-200',
          brand_id: 'b-100',
          name: '488 Pista',
          slug: '488-pista',
          image_url: 'https://test.supabase.co/pista.png',
          body_type: 'Coupe',
        },
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDbModels, error: null }),
      });
      (service as any).client = mockSupabaseClient;

      await service.fetchCatalogModels('b-100');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('car_models');
      expect(service.catalogModels().length).toBe(1);
      expect(service.catalogModels()[0].name).toBe('488 Pista');
      expect(service.catalogModels()[0].brandId).toBe('b-100');
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

    it('inserts brand into car_brands and updates catalogBrands signal', async () => {
      const insertedRow = {
        id: 'b-999',
        name: 'McLaren',
        slug: 'mclaren',
        logo_url: 'https://test.supabase.co/mclaren.png',
        is_custom_bg: false,
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

    it('inserts car model into car_models and updates catalogModels signal', async () => {
      const insertedRow = {
        id: 'c-999',
        brand_id: 'b-999',
        name: '720S',
        slug: '720s',
        image_url: 'https://test.supabase.co/720s.png',
        body_type: 'Coupe',
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
          }),
        }),
      });
      (service as any).client = mockSupabaseClient;

      const res = await service.insertCarModel({
        brand_id: 'b-999',
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
  });
});
