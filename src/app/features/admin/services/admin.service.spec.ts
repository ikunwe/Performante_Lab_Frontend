import { TestBed } from '@angular/core/testing';
import { AdminService } from './admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTH_CLIENT } from '../../../core/auth/auth-client';
import { signal } from '@angular/core';

describe('AdminService', () => {
  let service: AdminService;
  let isSuperAdminSignal = signal(true);

  beforeEach(() => {
    isSuperAdminSignal.set(true);
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        {
          provide: AUTH_CLIENT,
          useValue: vi.fn().mockResolvedValue(null),
        },
        {
          provide: AuthService,
          useValue: {
            isSuperAdmin: isSuperAdminSignal,
            displayName: signal('Super Admin User'),
            user: signal({ email: 'superadmin@performante.lab' }),
            userRole: signal('SuperAdmin'),
          },
        },
      ],
    });
    service = TestBed.inject(AdminService);
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
      expect(filtered.every((b) => b.title.toLowerCase().includes('rosso') || b.car.toLowerCase().includes('rosso'))).toBe(true);
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
    it('toggles user status between Active and InActive', async () => {
      // Find a normal user (not SuperAdmin)
      const user = service.users().find((u) => u.role !== 'SuperAdmin');
      expect(user).toBeDefined();

      const initialStatus = user!.status;
      const res = await service.toggleUserStatus(user!.id);

      expect(res.ok).toBe(true);
      const updated = service.users().find((u) => u.id === user!.id);
      expect(updated?.status).not.toBe(initialStatus);
    });

    it('prevents suspending a SuperAdmin user', async () => {
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
      isSuperAdminSignal.set(false); // Simulate regular Admin
      const user = service.users().find((u) => u.role === 'User');
      expect(user).toBeDefined();

      const res = await service.updateUserRole(user!.id, 'Admin');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('SuperAdmin');

      const notUpdated = service.users().find((u) => u.id === user!.id);
      expect(notUpdated?.role).toBe('User');
    });
  });
});
