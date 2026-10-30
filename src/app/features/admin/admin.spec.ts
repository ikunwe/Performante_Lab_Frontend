import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminLayout } from './layout/admin-layout';
import { AdminDiscover } from './discover/admin-discover';
import { AdminRequests } from './requests/admin-requests';
import { AdminUsers } from './users/admin-users';
import { AdminService, INITIAL_USERS } from './services/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_CLIENT, AUTH_CONFIG } from '../../core/auth/auth-client';
import { signal } from '@angular/core';

describe('Admin Portal Features', () => {
  let mockAuth: any;

  beforeEach(async () => {
    mockAuth = {
      user: signal({ email: 'admin@performante.lab' }),
      displayName: signal('Admin User'),
      userRole: signal('SuperAdmin'),
      isAdmin: signal(true),
      isSuperAdmin: signal(true),
      isActive: signal(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      setRole: vi.fn(),
      signOut: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLayout, AdminDiscover, AdminRequests, AdminUsers],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: AUTH_CLIENT, useValue: vi.fn().mockResolvedValue(null) },
        {
          provide: AUTH_CONFIG,
          useValue: vi.fn().mockResolvedValue({
            supabaseUrl: 'https://test.supabase.co',
            supabasePublishableKey: 'test-key',
            apiBaseUrl: 'http://localhost:3000',
          }),
        },
      ],
    }).compileComponents();
  });

  it('renders AdminLayout shell with navigation and ads banner', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Discover');
    expect(compiled.textContent).toContain('Requests');
    expect(compiled.textContent).toContain('Users');
    expect(compiled.textContent).toContain('Web Ads Space');
    expect(compiled.textContent).toContain('300x400');
  });

  it('renders loading state when loading is true', () => {
    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(true);
    const fixture = TestBed.createComponent(AdminDiscover);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('กำลังโหลดข้อมูลจากฐานข้อมูล...');
  });

  it('renders AdminDiscover with 4-column cards and action buttons', () => {
    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(false);
    const fixture = TestBed.createComponent(AdminDiscover);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Discover');
    expect(compiled.textContent).toContain('ค้นหาหรือดูBuild ของคนอื่นได้');
    expect(compiled.textContent).toContain('See Details');
    expect(compiled.textContent).toContain('Delete');
  });

  it('renders AdminRequests with request cards and Accept / Reject buttons', () => {
    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(false);
    const fixture = TestBed.createComponent(AdminRequests);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Requests');
    expect(compiled.textContent).toContain('ชิ้นส่วนที่ User ร้องขอ');
    expect(compiled.textContent).toContain('Accept');
    expect(compiled.textContent).toContain('Reject');
  });

  it('renders AdminUsers with user rows, role badges, and Suspend buttons', () => {
    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(false);
    adminService.users.set([...INITIAL_USERS]);
    const fixture = TestBed.createComponent(AdminUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Users');
    expect(compiled.textContent).toContain('จัดการบัญชีของ User');
    expect(compiled.textContent).toContain('Suspend');
    expect(compiled.textContent).toContain('Active');
  });

  it('renders disabled action button and read-only badge when actor is regular Admin', () => {
    mockAuth.isSuperAdmin.set(false);
    mockAuth.isAdmin.set(true);
    mockAuth.userRole.set('Admin');

    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(false);
    adminService.users.set([...INITIAL_USERS]);
    const fixture = TestBed.createComponent(AdminUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Title attribute for disabled admin button
    expect(compiled.innerHTML).toContain('เฉพาะ SuperAdmin เท่านั้นที่จัดการ Admin ได้');
    // Read-only role title
    expect(compiled.innerHTML).toContain('Read-only (ไม่มีสิทธิ์เปลี่ยน Role)');
  });

  it('renders empty state when users list is empty', () => {
    const adminService = TestBed.inject(AdminService);
    adminService.loading.set(false);
    adminService.users.set([]);
    const fixture = TestBed.createComponent(AdminUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('ไม่พบบัญชีผู้ใช้ในระบบ');
  });
});
