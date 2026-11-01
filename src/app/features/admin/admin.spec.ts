import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminLayout } from './layout/admin-layout';
import { AdminDiscover } from './discover/admin-discover';
import { AdminRequests } from './requests/admin-requests';
import { AdminUsers } from './users/admin-users';
import { AdminEditData } from './edit-data/admin-edit-data';
import { CatalogStorageHelper } from '../../core/storage/catalog-storage';
import {
  AdminService,
  AdminUserItem,
  INITIAL_USERS,
  mapBrand,
  mapCarModel,
  mapPart,
} from './services/admin.service';
import { AuthService, UserRole } from '../../core/auth/auth.service';
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
      imports: [AdminLayout, AdminDiscover, AdminRequests, AdminUsers, AdminEditData],
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
    expect(compiled.textContent).toContain('Edit Data');
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

  describe('AdminUsers Pagination', () => {
    const createMockUsers = (count: number): AdminUserItem[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `u-${i + 1}`,
        username: `user_${i + 1}`,
        email: `user${i + 1}@performante.lab`,
        role: (i % 3 === 0 ? 'Admin' : i % 3 === 1 ? 'SuperAdmin' : 'User') as UserRole,
        status: (i % 2 === 0 ? 'Active' : 'InActive') as 'Active' | 'InActive',
        joinedAt: '2026-10-01',
      }));
    };

    it('calculates totalPages = 3 and displays first 10 users on page 1 when there are 25 users', () => {
      const adminService = TestBed.inject(AdminService);
      adminService.loading.set(false);
      adminService.users.set(createMockUsers(25));
      const fixture = TestBed.createComponent(AdminUsers);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.totalUsers()).toBe(25);
      expect(component.totalPages()).toBe(3);
      expect(component.currentPage()).toBe(1);
      expect(component.pagedUsers().length).toBe(10);
      expect(component.pagedUsers()[0].username).toBe('user_1');
      expect(component.pagedUsers()[9].username).toBe('user_10');
      expect(component.displayRange()).toEqual({ start: 1, end: 10, total: 25 });
    });

    it('navigates to page 2 via nextPage() and displays users 11 to 20', () => {
      const adminService = TestBed.inject(AdminService);
      adminService.loading.set(false);
      adminService.users.set(createMockUsers(25));
      const fixture = TestBed.createComponent(AdminUsers);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component.nextPage();
      fixture.detectChanges();

      expect(component.currentPage()).toBe(2);
      expect(component.pagedUsers().length).toBe(10);
      expect(component.pagedUsers()[0].username).toBe('user_11');
      expect(component.pagedUsers()[9].username).toBe('user_20');
      expect(component.displayRange()).toEqual({ start: 11, end: 20, total: 25 });
    });

    it('disables Previous button on page 1 and disables Next button on page 3', () => {
      const adminService = TestBed.inject(AdminService);
      adminService.loading.set(false);
      adminService.users.set(createMockUsers(25));
      const fixture = TestBed.createComponent(AdminUsers);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const prevButton = compiled.querySelector('button[title="หน้าก่อนหน้า"]') as HTMLButtonElement;
      const nextButton = compiled.querySelector('button[title="หน้าถัดไป"]') as HTMLButtonElement;

      expect(prevButton.disabled).toBe(true);
      expect(nextButton.disabled).toBe(false);

      // Navigate to page 3 (last page)
      component.goToPage(3);
      fixture.detectChanges();

      expect(component.currentPage()).toBe(3);
      expect(prevButton.disabled).toBe(false);
      expect(nextButton.disabled).toBe(true);
      expect(component.pagedUsers().length).toBe(5);
      expect(component.displayRange()).toEqual({ start: 21, end: 25, total: 25 });
    });

    it('resets currentPage to 1 when search or filter changes', () => {
      const adminService = TestBed.inject(AdminService);
      adminService.loading.set(false);
      adminService.users.set(createMockUsers(35));
      const fixture = TestBed.createComponent(AdminUsers);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component.goToPage(2);
      expect(component.currentPage()).toBe(2);

      // Changing role filter resets page to 1
      component.setRoleFilter('Admin');
      fixture.detectChanges();
      expect(component.currentPage()).toBe(1);

      // Move to page 2 again (35 users have 12 Admins -> 2 pages)
      component.goToPage(2);
      expect(component.currentPage()).toBe(2);

      // Changing search query resets page to 1
      component.onSearchChange('user_1');
      fixture.detectChanges();
      expect(component.currentPage()).toBe(1);
    });

    it('handles prevPage navigation correctly without underflowing', () => {
      const adminService = TestBed.inject(AdminService);
      adminService.loading.set(false);
      adminService.users.set(createMockUsers(25));
      const fixture = TestBed.createComponent(AdminUsers);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component.goToPage(2);
      expect(component.currentPage()).toBe(2);

      component.prevPage();
      expect(component.currentPage()).toBe(1);

      component.prevPage();
      expect(component.currentPage()).toBe(1);
    });
  });

  describe('AdminEditData Portal', () => {
    let adminService: AdminService;

    beforeEach(() => {
      adminService = TestBed.inject(AdminService);
      adminService.catalogBrands.set([
        mapBrand({ id: 'b-toyota', name: 'Toyota', slug: 'toyota', logo_url: 'assets/brands/toyota.svg' }),
        mapBrand({ id: 'b-mercedes', name: 'Mercedes-Benz', slug: 'mercedes-benz', logo_url: 'assets/brands/mercedes.svg' }),
        mapBrand({ id: 'b-ferrari', name: 'Ferrari', slug: 'ferrari', logo_url: 'assets/brands/ferrari.png', is_custom_bg: true }),
        mapBrand({ id: 'b-honda', name: 'Honda', slug: 'honda', logo_url: 'assets/brands/honda.svg' }),
      ]);
      adminService.catalogModels.set([
        mapCarModel({ id: 'c-488-pista', brand_id: 'b-ferrari', name: 'Ferrari 488 Pista', slug: 'ferrari-488-pista', image_url: 'assets/car_pic.png', body_type: 'Coupe' }),
        mapCarModel({ id: 'c-458', brand_id: 'b-ferrari', name: 'Ferrari 458', slug: 'ferrari-458', image_url: 'assets/car_pic.png', body_type: 'Coupe' }),
      ]);
      adminService.catalogParts.set([
        mapPart({ id: 'p-1', car_model_id: 'c-488-pista', category: 'Full Body Kits', name: 'Pista Carbon Aero Kit', manufacturer: 'Ferrari', image_url: 'assets/car_pic.png', price: 450000 }),
        mapPart({ id: 'p-2', car_model_id: 'c-488-pista', category: 'Full Body Kits', name: 'Novitec N-Largo Widebody Kit', manufacturer: 'Novitec', image_url: 'assets/car_pic.png', price: 850000 }),
      ]);
    });

    it('shows empty state when catalog brands list is empty and not loading', () => {
      adminService.catalogBrands.set([]);
      adminService.catalogLoading.set(false);
      const fixture = TestBed.createComponent(AdminEditData);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('ยังไม่มีข้อมูล Brand ในฐานข้อมูล');
    });

    it('shows loading spinner when catalogLoading is true and list is empty', () => {
      adminService.catalogBrands.set([]);
      adminService.catalogLoading.set(true);
      const fixture = TestBed.createComponent(AdminEditData);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('กำลังโหลดข้อมูลแบรนด์จากฐานข้อมูล...');
    });

    it('renders initial Level 1 (brands) with Car brand heading and brands grid', () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.level()).toBe('brands');
      expect(compiled.textContent).toContain('Edit Data');
      expect(compiled.textContent).toContain('Car brand');
      expect(component.admin.editBrands().length).toBeGreaterThanOrEqual(4);
      expect(compiled.querySelector('button[title="เพิ่ม Brand รถใหม่"]')).toBeTruthy();
    });

    it('switches to Level 2 (models) when a brand is selected and filters cars for that brand', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      expect(ferrari).toBeTruthy();

      await component.selectBrand(ferrari!);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.level()).toBe('models');
      expect(component.selectedBrand()?.name).toBe('Ferrari');
      expect(compiled.textContent).toContain('Car Name');
      expect(compiled.textContent).toContain('Ferrari 488 Pista');
      expect(component.filteredCarsForBrand().some((c) => c.name === 'Ferrari 488 Pista')).toBe(true);
    });

    it('switches to Level 3 (parts) when a car model is selected', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);

      const pista = component.filteredCarsForBrand().find((c) => c.name === 'Ferrari 488 Pista');
      expect(pista).toBeTruthy();

      await component.selectCar(pista!);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.level()).toBe('parts');
      expect(component.selectedCar()?.name).toBe('Ferrari 488 Pista');
      expect(compiled.textContent).toContain('Body Kit');
      expect(component.tuningBrandsForCurrentContext().length).toBeGreaterThan(0);
      expect(component.filteredPartsForCar().length).toBeGreaterThan(0);
    });

    it('manages 2-step tuning selection and tab switching in Level 3', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);
      fixture.detectChanges();

      // Default tab is 'bodykit', selectedTuningBrand is null (Step 1)
      expect(component.partTab()).toBe('bodykit');
      expect(component.selectedTuningBrand()).toBeNull();
      const tuningBrands = component.tuningBrandsForCurrentContext();
      expect(tuningBrands.length).toBeGreaterThan(0);

      // Step 2: Select a tuning brand
      const brandToSelect = tuningBrands[0];
      component.selectTuningBrand(brandToSelect);
      expect(component.selectedTuningBrand()).toBe(brandToSelect);
      expect(component.partsForSelectedTuningBrand().length).toBeGreaterThan(0);

      // Back to Step 1
      component.backToTuningBrands();
      expect(component.selectedTuningBrand()).toBeNull();

      // Switch to Parts tab
      component.setPartTab('parts');
      expect(component.partTab()).toBe('parts');
      expect(component.selectedTuningBrand()).toBeNull();

      // Add custom category
      component.openCategoryModal();
      expect(component.categoryModalOpen()).toBe(true);
      component.newCustomCategoryName.set('Turbochargers');
      component.addCustomCategory();
      expect(component.availableCategories()).toContain('Turbochargers');
      expect(component.selectedCategory()).toBe('Turbochargers');
      expect(component.categoryModalOpen()).toBe(false);

      // Add custom tuning brand
      component.openTuningBrandModal();
      expect(component.tuningBrandModalOpen()).toBe(true);
      component.newTuningBrandName.set('HKS');
      component.selectedTuningBrandFile.set(new File(['tuning'], 'hks.png', { type: 'image/png' }));
      await component.addTuningBrand();
      expect(component.selectedTuningBrand()).toBe('HKS');
      expect(component.tuningBrandModalOpen()).toBe(false);
    });

    it('navigates back across levels correctly via backToModels() and backToBrands()', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      expect(component.level()).toBe('parts');

      // Back to models
      component.backToModels();
      expect(component.level()).toBe('models');
      expect(component.selectedCar()).toBeNull();
      expect(component.selectedBrand()?.name).toBe('Ferrari');

      // Back to brands
      component.backToBrands();
      expect(component.level()).toBe('brands');
      expect(component.selectedBrand()).toBeNull();
    });

    it('adds new brand, car model, and part via AdminService and updates signals', () => {
      const initialBrandsCount = adminService.editBrands().length;
      const initialCarsCount = adminService.editCars().length;
      const initialPartsCount = adminService.editParts().length;

      // Add Brand
      const newBrand = adminService.addBrand({
        name: 'Porsche',
        logoUrl: 'assets/brands/porsche.png',
        isCustomBg: false,
      });
      expect(adminService.editBrands().length).toBe(initialBrandsCount + 1);
      expect(newBrand.name).toBe('Porsche');

      // Add Car Model
      const newCar = adminService.addCarModel({
        brandId: newBrand.id,
        name: 'Porsche 911 GT3 RS',
        image: 'assets/car_pic.png',
        bodyType: 'Coupe',
      });
      expect(adminService.editCars().length).toBe(initialCarsCount + 1);
      expect(newCar.name).toBe('Porsche 911 GT3 RS');

      // Add Part
      const newPart = adminService.addPartData({
        carId: newCar.id,
        category: 'Full Body Kits',
        name: 'Manthey Racing Aero Kit',
        image: 'assets/car_pic.png',
        price: 950000,
      });
      expect(adminService.editParts().length).toBe(initialPartsCount + 1);
      expect(newPart.name).toBe('Manthey Racing Aero Kit');
    });

    it('supports modal forms to add brands, cars, and parts in component', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      // Modal 1: Add Brand (with mandatory file)
      component.openBrandModal();
      expect(component.brandModalOpen()).toBe(true);
      component.newBrandName.set('Maserati');
      component.selectedBrandFile.set(new File(['logo'], 'maserati.png', { type: 'image/png' }));
      await component.saveBrand();
      expect(component.brandModalOpen()).toBe(false);
      const maserati = component.admin.editBrands().find((b) => b.name === 'Maserati');
      expect(maserati).toBeTruthy();

      // Modal 2: Add Car under Maserati (with mandatory file)
      await component.selectBrand(maserati!);
      component.openCarModal();
      expect(component.carModalOpen()).toBe(true);
      component.newCarName.set('MC20 Cielo');
      component.selectedCarFile.set(new File(['car'], 'mc20.jpg', { type: 'image/jpeg' }));
      await component.saveCar();
      expect(component.carModalOpen()).toBe(false);
      const mc20 = component.filteredCarsForBrand().find((c) => c.name === 'MC20 Cielo');
      expect(mc20).toBeTruthy();

      // Modal 3: Add Part under MC20 (with mandatory file)
      await component.selectCar(mc20!);
      component.openPartModal();
      expect(component.partModalOpen()).toBe(true);
      component.newPartName.set('Novitec Carbon Wing');
      component.newPartPrice.set(380000);
      component.selectedPartFile.set(new File(['part'], 'wing.png', { type: 'image/png' }));
      await component.savePart();
      expect(component.partModalOpen()).toBe(false);
      const wing = component.filteredPartsForCar().find((p) => p.name === 'Novitec Carbon Wing');
      expect(wing).toBeTruthy();
    });

    it('enforces mandatory photo upload for brand, car, and part (tuning brand is text-only)', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      // Try save brand without file
      component.openBrandModal();
      component.newBrandName.set('Bugatti');
      component.selectedBrandFile.set(null);
      await component.saveBrand();
      expect(component.brandModalOpen()).toBe(true);
      expect(component.toastMessage()).toContain('กรุณาอัปโหลดรูปภาพ');

      // Try save car without file
      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      component.openCarModal();
      component.newCarName.set('Ferrari 812');
      component.selectedCarFile.set(null);
      await component.saveCar();
      expect(component.carModalOpen()).toBe(true);
      expect(component.toastMessage()).toContain('กรุณาอัปโหลดรูปภาพ');

      // Tuning brands do not require photo (typography/text-only per latest requirement)
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);
      component.openTuningBrandModal();
      component.newTuningBrandName.set('Mansory');
      component.selectedTuningBrandFile.set(null);
      await component.addTuningBrand();
      expect(component.tuningBrandModalOpen()).toBe(false);

      // Try save part without file
      component.openPartModal();
      component.newPartName.set('Mansory Wing');
      component.selectedPartFile.set(null);
      await component.savePart();
      expect(component.partModalOpen()).toBe(true);
      expect(component.toastMessage()).toContain('กรุณาอัปโหลดรูปภาพ');
    });

    it('filters brands via brandSearchQuery and supports editBrandModal and editCarModal', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      // Search filtering
      component.brandSearchQuery.set('Ferr');
      expect(component.filteredBrands().every((b) => b.name.toLowerCase().includes('ferr'))).toBe(true);
      component.brandSearchQuery.set('NonExistentBrand123');
      expect(component.filteredBrands().length).toBe(0);
      component.brandSearchQuery.set('');
      expect(component.filteredBrands().length).toBeGreaterThan(0);

      // Edit Brand Modal
      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      component.openEditBrandModal(ferrari!);
      expect(component.editBrandModalOpen()).toBe(true);
      expect(component.editingBrandName()).toBe('Ferrari');
      component.editingBrandName.set('Ferrari S.p.A.');
      await component.saveEditBrand();
      expect(component.editBrandModalOpen()).toBe(false);
      expect(component.selectedBrand()?.name).toBe('Ferrari S.p.A.');

      // Edit Car Model Modal
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);
      component.openEditCarModal(pista);
      expect(component.editCarModalOpen()).toBe(true);
      expect(component.editingCarName()).toBe(pista.name);
      component.editingCarName.set('488 Pista Spider');
      await component.saveEditCar();
      expect(component.editCarModalOpen()).toBe(false);
      expect(component.selectedCar()?.name).toBe('488 Pista Spider');
    });

    it('validates file type and size restrictions correctly', () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      let successCalled = false;
      const onSuccess = () => { successCalled = true; };

      // Invalid file type (e.g. text/plain)
      const invalidFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
      const valid1 = component.validateAndPreview(invalidFile, onSuccess);
      expect(valid1).toBe(false);
      expect(successCalled).toBe(false);
      expect(component.toastMessage()).toContain('กรุณาเลือกไฟล์รูปภาพ');

      // Oversized file (> 10MB)
      const oversizedFile = new File([''], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 });
      const valid2 = component.validateAndPreview(oversizedFile, onSuccess);
      expect(valid2).toBe(false);
      expect(component.toastMessage()).toContain('ขนาดไฟล์ต้องไม่เกิน 10 MB');

      // Valid file
      const validFile = new File(['image-data'], 'valid.png', { type: 'image/png' });
      const valid3 = component.validateAndPreview(validFile, onSuccess);
      expect(valid3).toBe(true);
    });

    it('uploads file via CatalogStorageHelper and saves public URL on form submit', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: 'Aston-Martin/logo.png' }, error: null }),
            getPublicUrl: vi.fn().mockReturnValue({
              data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/catalog/Aston-Martin/logo.png' },
            }),
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'b-aston',
                  name: 'Aston Martin',
                  slug: 'aston-martin',
                  logo_url: 'https://test.supabase.co/storage/v1/object/public/catalog/Aston-Martin/logo.png',
                  is_custom_bg: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any;

      vi.spyOn(component.admin, 'getClient').mockResolvedValue(mockClient);

      component.openBrandModal();
      component.newBrandName.set('Aston Martin');
      const testFile = new File(['mock-logo'], 'logo.png', { type: 'image/png' });
      component.selectedBrandFile.set(testFile);
      component.brandFilePreview.set('data:image/png;base64,preview...');

      await component.saveBrand();

      expect(component.brandModalOpen()).toBe(false);
      const brand = component.admin.editBrands().find((b) => b.name === 'Aston Martin');
      expect(brand).toBeTruthy();
      expect(brand?.logoUrl).toBe(
        'https://test.supabase.co/storage/v1/object/public/catalog/Aston-Martin/logo.png',
      );
    });

    it('manages 3-step part selection flow (category -> brand -> parts) and breadcrumb navigation', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      // Switch to Parts Tab
      component.setPartTab('parts');
      expect(component.partTab()).toBe('parts');
      expect(component.partStep()).toBe('category');

      // Step 1: Select Category 'Wheels'
      component.selectPartCategory('Wheels');
      expect(component.partStep()).toBe('brand');
      expect(component.selectedCategory()).toBe('Wheels');
      expect(component.selectedTuningBrand()).toBeNull();

      // Step 2: Select Tuning Brand 'BBS'
      component.selectPartTuningBrand('BBS');
      expect(component.partStep()).toBe('parts');
      expect(component.selectedTuningBrand()).toBe('BBS');

      // Step 3: Back to Brands
      component.backToPartBrands();
      expect(component.partStep()).toBe('brand');
      expect(component.selectedTuningBrand()).toBeNull();

      // Back to Categories
      component.backToPartCategories();
      expect(component.partStep()).toBe('category');
      expect(component.selectedCategory()).toBe('Wheels');
    });

    it('supports editing tuning brand name and logo via editTuningBrandModal', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      component.workshopBrands.set({
        bodykit: [{ name: 'Novitec', logoUrl: 'https://example.com/novitec.png' }],
        parts: [],
      });
      component.tuningBrandLogos.set(new Map([['novitec', 'https://example.com/novitec.png']]));

      component.openEditTuningBrandModal('Novitec');
      expect(component.editTuningBrandModalOpen()).toBe(true);
      expect(component.editingTuningBrandName()).toBe('Novitec');
      expect(component.originalTuningBrandName()).toBe('Novitec');

      component.editingTuningBrandName.set('Novitec Rosso');
      await component.saveEditTuningBrand();

      expect(component.editTuningBrandModalOpen()).toBe(false);
      expect(component.workshopBrands().bodykit.some((w) => w.name === 'Novitec Rosso')).toBe(true);
      expect(component.toastMessage()).toContain('แก้ไขข้อมูลแบรนด์ "Novitec Rosso" เรียบร้อยแล้ว');
    });

    it('enforces Delete Confirmation Safeguard modal before deleting category, brand, or part', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      // 1. Delete Category confirmation
      component.confirmDeleteCategory('Wheels');
      expect(component.confirmDeleteModalOpen()).toBe(true);
      expect(component.deleteTarget()?.type).toBe('category');
      expect(component.deleteTarget()?.name).toBe('Wheels');

      // Cancel delete
      component.closeConfirmDeleteModal();
      expect(component.confirmDeleteModalOpen()).toBe(false);
      expect(component.deleteTarget()).toBeNull();

      // Confirm delete category
      component.confirmDeleteCategory('Wheels');
      await component.executeDelete();
      expect(component.confirmDeleteModalOpen()).toBe(false);
      expect(component.availableCategories()).not.toContain('Wheels');
      expect(component.toastMessage()).toContain('ลบหมวดหมู่ "Wheels" เรียบร้อยแล้ว');

      // 2. Delete Tuning Brand confirmation
      component.workshopBrands.set({
        bodykit: [{ name: 'Mansory', logoUrl: '' }],
        parts: [],
      });
      component.confirmDeleteTuningBrand('Mansory');
      expect(component.confirmDeleteModalOpen()).toBe(true);
      expect(component.deleteTarget()?.type).toBe('tuningBrand');
      expect(component.deleteTarget()?.name).toBe('Mansory');

      await component.executeDelete();
      expect(component.confirmDeleteModalOpen()).toBe(false);
      expect(component.workshopBrands().bodykit.some((w) => w.name === 'Mansory')).toBe(false);
      expect(component.toastMessage()).toContain('ลบแบรนด์ "Mansory" เรียบร้อยแล้ว');

      // 3. Delete Part Item confirmation
      const mockPart = {
        id: 'p-test',
        name: 'Carbon Diffuser',
        car_model_id: pista.id,
        category: 'BodyKit',
        price: 50000,
        image_url: 'catalog/Ferrari/488-Pista/BodyKit/Novitec/Diffuser.png',
      } as any;

      component.confirmDeletePart(mockPart);
      expect(component.confirmDeleteModalOpen()).toBe(true);
      expect(component.deleteTarget()?.type).toBe('part');
      expect(component.deleteTarget()?.name).toBe('Carbon Diffuser');

      await component.executeDelete();
      expect(component.confirmDeleteModalOpen()).toBe(false);
      expect(component.toastMessage()).toContain('ลบชิ้นส่วน "Carbon Diffuser" เรียบร้อยแล้ว');
    });

    it('supports in-place editing of part / bodykit item name and image via editPartModal', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      // Create a test part
      const initialPart = component.admin.addPartData({
        car_model_id: pista.id,
        category: 'FullBodyKits',
        name: 'Initial Aero Kit',
        manufacturer: 'Novitec',
        price: 150000,
        image_url: 'assets/car_pic.png',
      });

      // Open edit modal for part
      component.openEditPartModal(initialPart);
      expect(component.editPartModalOpen()).toBe(true);
      expect(component.editingPart()?.id).toBe(initialPart.id);
      expect(component.editingPartName()).toBe('Initial Aero Kit');
      expect(component.editingPartPrice()).toBe(150000);

      // Modify name and price without uploading new image (keeps existing image)
      component.editingPartName.set('Novitec Esteso Widebody');
      component.editingPartPrice.set(220000);
      await component.saveEditPart();

      expect(component.editPartModalOpen()).toBe(false);
      const updatedPart = component.admin.catalogParts().find((p) => p.id === initialPart.id);
      expect(updatedPart?.name).toBe('Novitec Esteso Widebody');
      expect(updatedPart?.price).toBe(220000);
      expect(updatedPart?.image_url || updatedPart?.image).toBe('assets/car_pic.png');
    });

    it('returns exact required angles for each category according to specifications', () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;

      // 1. Front Bumper: 2 angles (45_front, front)
      const frontAngles = component.getRequiredAngles('Front Bumper');
      expect(frontAngles.length).toBe(2);
      expect(frontAngles.map((a) => a.key)).toEqual(['45_front', 'front']);

      // 2. Rear Bumper: 2 angles (45_Back, Back)
      const rearAngles = component.getRequiredAngles('Rear Bumper');
      expect(rearAngles.length).toBe(2);
      expect(rearAngles.map((a) => a.key)).toEqual(['45_Back', 'Back']);

      // 3. Wheels: 2 angles (45_front, 45_Back)
      const wheelAngles = component.getRequiredAngles('Wheels');
      expect(wheelAngles.length).toBe(2);
      expect(wheelAngles.map((a) => a.key)).toEqual(['45_front', '45_Back']);

      // 4. Spoilers: 3 angles (45_front, 45_Back, Back)
      const spoilerAngles = component.getRequiredAngles('Spoilers');
      expect(spoilerAngles.length).toBe(3);
      expect(spoilerAngles.map((a) => a.key)).toEqual(['45_front', '45_Back', 'Back']);

      // 5. FullBodyKits: 4 angles (45_front, front, 45_Back, Back)
      const bodyKitAngles = component.getRequiredAngles('FullBodyKits');
      expect(bodyKitAngles.length).toBe(4);
      expect(bodyKitAngles.map((a) => a.key)).toEqual(['45_front', 'front', '45_Back', 'Back']);
    });

    it('allows editing tuning brand name and filters category names out of brand list', async () => {
      const fixture = TestBed.createComponent(AdminEditData);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const ferrari = component.admin.editBrands().find((b) => b.name === 'Ferrari');
      await component.selectBrand(ferrari!);
      const pista = component.filteredCarsForBrand()[0];
      await component.selectCar(pista);

      // Set tuning brand & open edit modal
      component.selectedTuningBrand.set('Akrapovic');
      component.openEditTuningBrandModal('Akrapovic');
      expect(component.editTuningBrandModalOpen()).toBe(true);
      expect(component.editingTuningBrandName()).toBe('Akrapovic');

      // Rename tuning brand
      component.editingTuningBrandName.set('Akrapovic Racing');
      await component.saveEditTuningBrand();
      expect(component.editTuningBrandModalOpen()).toBe(false);
      expect(component.selectedTuningBrand()).toBe('Akrapovic Racing');

      // Test that Spoilers or category names are not treated as brands
      component.workshopBrands.set({
        bodykit: [{ name: 'Novitec', logoUrl: '' }],
        parts: [{ name: 'Akrapovic', logoUrl: '' }, { name: 'Spoilers', logoUrl: '' }],
      });
      const brandsForRearBumper = component.tuningBrandsForPartCategory('Rear Bumper');
      expect(brandsForRearBumper).toContain('Akrapovic');
      expect(brandsForRearBumper).not.toContain('Spoilers');
    });
  });
});
