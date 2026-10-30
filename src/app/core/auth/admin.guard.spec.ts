import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

describe('adminGuard', () => {
  let mockAuthService: {
    initialize: () => Promise<void>;
    user: ReturnType<typeof signal>;
    isAdmin: ReturnType<typeof signal>;
    isActive: ReturnType<typeof signal>;
  };
  let mockRouter: {
    createUrlTree: (commands: unknown[], extras?: unknown) => UrlTree;
  };

  beforeEach(() => {
    mockAuthService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      user: signal<any>(null),
      isAdmin: signal(false),
      isActive: signal(true),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockImplementation((commands) => ({ toString: () => commands.join('/') } as UrlTree)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('redirects to /login when user is not logged in', async () => {
    mockAuthService.user.set(null);
    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin/discover' } as any),
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/admin/discover' },
    });
    expect(result).not.toBe(true);
  });

  it('redirects to /login?error=suspended when account is suspended (isActive === false)', async () => {
    mockAuthService.user.set({ id: 'admin1', email: 'suspended@gmail.com' });
    mockAuthService.isAdmin.set(true);
    mockAuthService.isActive.set(false);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin/discover' } as any),
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'suspended' },
    });
    expect(result).not.toBe(true);
  });

  it('redirects to /discover when logged in user is a regular User', async () => {
    mockAuthService.user.set({ id: 'u1', email: 'user@gmail.com' });
    mockAuthService.isAdmin.set(false);
    mockAuthService.isActive.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin/discover' } as any),
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/discover']);
    expect(result).not.toBe(true);
  });

  it('grants access when user has Admin or SuperAdmin role and is Active', async () => {
    mockAuthService.user.set({ id: 'admin1', email: 'admin@gmail.com' });
    mockAuthService.isAdmin.set(true);
    mockAuthService.isActive.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin/discover' } as any),
    );

    expect(result).toBe(true);
  });
});
