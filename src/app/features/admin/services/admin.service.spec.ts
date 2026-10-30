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
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
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
});
