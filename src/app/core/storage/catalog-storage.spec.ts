import { CatalogStorageHelper } from './catalog-storage';

describe('CatalogStorageHelper', () => {
  it('generates brand logo path correctly', () => {
    expect(CatalogStorageHelper.getBrandLogoPath('Ferrari')).toBe('Ferrari/logo.png');
    expect(CatalogStorageHelper.getBrandLogoPath('Mercedes Benz', 'svg')).toBe(
      'Mercedes-Benz/logo.svg',
    );
    expect(CatalogStorageHelper.getBrandLogoPath('Honda', '.jpg')).toBe('Honda/logo.jpg');
  });

  it('generates car picture path correctly with default jpg extension', () => {
    expect(CatalogStorageHelper.getCarPicturePath('Ferrari', '488 Pista')).toBe(
      'Ferrari/488-Pista/CarPicture.jpg',
    );
    expect(CatalogStorageHelper.getCarPicturePath('Ferrari', '458', 'png')).toBe(
      'Ferrari/458/CarPicture.png',
    );
  });

  it('generates body kit path correctly matching tree structure', () => {
    expect(
      CatalogStorageHelper.getBodyKitPath(
        'Ferrari',
        '488 Pista',
        'Sano Design',
        'Track Aero',
        'png',
      ),
    ).toBe('Ferrari/488-Pista/BodyKit/Sano-Design/Track-Aero.png');

    expect(
      CatalogStorageHelper.getBodyKitPath(
        'Ferrari',
        '488 Pista',
        'Sano Design',
        'Track Edition',
      ),
    ).toBe('Ferrari/488-Pista/BodyKit/Sano-Design/Track-Edition.png');

    expect(
      CatalogStorageHelper.getBodyKitPath(
        'Toyota',
        'GT86',
        'Rocket Bunny',
        'Widebody V2',
        'jpeg',
      ),
    ).toBe('Toyota/GT86/BodyKit/Rocket-Bunny/Widebody-V2.jpeg');
  });

  it('extracts file extensions properly', () => {
    expect(CatalogStorageHelper.getFileExtension(new File([], 'car.JPEG'))).toBe('jpg');
    expect(CatalogStorageHelper.getFileExtension(new File([], 'car.jpg'))).toBe('jpg');
    expect(CatalogStorageHelper.getFileExtension(new File([], 'logo.png'))).toBe('png');
    expect(CatalogStorageHelper.getFileExtension(new File([], 'part.webp'))).toBe('webp');
    expect(CatalogStorageHelper.getFileExtension(new File([], 'noext'))).toBe('png');
  });

  it('generates part path correctly matching tree structure', () => {
    expect(
      CatalogStorageHelper.getPartPath(
        'Ferrari',
        '488 Pista',
        'Novitec',
        'Carbon Front Lip',
      ),
    ).toBe('Ferrari/488-Pista/Part/Novitec/Carbon-Front-Lip.png');
  });

  it('generates tuning brand logo path correctly for bodykit and parts', () => {
    expect(
      CatalogStorageHelper.getTuningBrandLogoPath(
        'Ferrari',
        '488 Pista',
        'bodykit',
        'Novitec',
        'png',
      ),
    ).toBe('Ferrari/488-Pista/BodyKit/Novitec/logo.png');

    expect(
      CatalogStorageHelper.getTuningBrandLogoPath(
        'Toyota',
        'GT86',
        'parts',
        'Brembo',
        'jpg',
      ),
    ).toBe('Toyota/GT86/Part/Brembo/logo.jpg');
  });

  it('sanitizes special characters and spaces safely', () => {
    expect(CatalogStorageHelper.sanitize('  Toyota   Supra  ')).toBe('Toyota-Supra');
    expect(CatalogStorageHelper.sanitize('Brand@#$ %^&*Name!')).toBe('Brand-Name');
    expect(CatalogStorageHelper.sanitize('Model_V1.2')).toBe('Model_V1.2');
  });

  it('uploads file and returns public URL on success', async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'Ferrari/logo.png' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/catalog/Ferrari/logo.png' },
          }),
        }),
      },
    } as any;

    const dummyBlob = new Blob(['mock-data'], { type: 'image/png' });
    const res = await CatalogStorageHelper.uploadFile(mockClient, 'Ferrari/logo.png', dummyBlob);

    expect(res.ok).toBe(true);
    expect(res.url).toBe(
      'https://test.supabase.co/storage/v1/object/public/catalog/Ferrari/logo.png',
    );
  });

  it('handles upload errors gracefully without throwing', async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Bucket not found' },
          }),
        }),
      },
    } as any;

    const dummyBlob = new Blob(['mock-data'], { type: 'image/png' });
    const res = await CatalogStorageHelper.uploadFile(mockClient, 'invalid/path.png', dummyBlob);

    expect(res.ok).toBe(false);
    expect(res.error).toBe('Bucket not found');
  });

  it('returns public URL directly via getPublicUrl', () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/catalog/Toyota/logo.png' },
          }),
        }),
      },
    } as any;

    const url = CatalogStorageHelper.getPublicUrl(mockClient, 'Toyota/logo.png');
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/catalog/Toyota/logo.png');
  });

  describe('Storage Listing Operations', () => {
    it('lists brands and detects logo extension automatically', async () => {
      const mockClient = {
        storage: {
          from: vi.fn().mockImplementation((bucket: string) => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === '') {
                return Promise.resolve({
                  data: [
                    { name: 'Ferrari', id: null, metadata: null },
                    { name: 'Porsche', id: null, metadata: null },
                    { name: '.emptyFolderPlaceholder', id: 'f1', metadata: { size: 0 } },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari') {
                return Promise.resolve({
                  data: [{ name: 'logo.png', id: '1', metadata: { mimetype: 'image/png' } }],
                  error: null,
                });
              }
              if (path === 'Porsche') {
                return Promise.resolve({
                  data: [{ name: 'logo.svg', id: '2', metadata: { mimetype: 'image/svg+xml' } }],
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

      const brands = await CatalogStorageHelper.listBrands(mockClient);
      expect(brands.length).toBe(2);
      expect(brands[0].name).toBe('Ferrari');
      expect(brands[0].logoUrl).toBe('https://test.supabase.co/catalog/Ferrari/logo.png');
      expect(brands[1].name).toBe('Porsche');
      expect(brands[1].logoUrl).toBe('https://test.supabase.co/catalog/Porsche/logo.svg');
    });

    it('lists models and filters out logo files while detecting car picture extension', async () => {
      const mockClient = {
        storage: {
          from: vi.fn().mockImplementation(() => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === 'Ferrari') {
                return Promise.resolve({
                  data: [
                    { name: '488-Pista', id: null, metadata: null },
                    { name: '458-Italia', id: null, metadata: null },
                    { name: 'logo.png', id: '1', metadata: { mimetype: 'image/png' } },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista') {
                return Promise.resolve({
                  data: [
                    { name: 'CarPicture.jpg', id: 'img1', metadata: { mimetype: 'image/jpeg' } },
                    { name: 'BodyKit', id: null, metadata: null },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/458-Italia') {
                return Promise.resolve({
                  data: [
                    { name: 'CarPicture.webp', id: 'img2', metadata: { mimetype: 'image/webp' } },
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

      const models = await CatalogStorageHelper.listModels(mockClient, 'Ferrari');
      expect(models.length).toBe(2);
      expect(models[0].name).toBe('458-Italia');
      expect(models[0].imageUrl).toBe('https://test.supabase.co/catalog/Ferrari/458-Italia/CarPicture.webp');
      expect(models[1].name).toBe('488-Pista');
      expect(models[1].imageUrl).toBe('https://test.supabase.co/catalog/Ferrari/488-Pista/CarPicture.jpg');
    });

    it('lists workshops and items under BodyKit or Part correctly', async () => {
      const mockClient = {
        storage: {
          from: vi.fn().mockImplementation(() => ({
            list: vi.fn().mockImplementation((path: string) => {
              if (path === 'Ferrari/488-Pista/BodyKit') {
                return Promise.resolve({
                  data: [
                    { name: 'Novitec', id: null, metadata: null },
                    { name: 'Sano-Design', id: null, metadata: null },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista/BodyKit/Novitec') {
                return Promise.resolve({
                  data: [
                    { name: 'logo.png', id: 'nl1', metadata: {} },
                    { name: 'Carbon-Lip-Kit.png', id: 'ni1', metadata: {} },
                    { name: 'N-Largo-Widebody.png', id: 'ni2', metadata: {} },
                  ],
                  error: null,
                });
              }
              if (path === 'Ferrari/488-Pista/BodyKit/Sano-Design') {
                return Promise.resolve({
                  data: [{ name: 'logo.png', id: 'sl1', metadata: {} }],
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

      const workshops = await CatalogStorageHelper.listWorkshops(
        mockClient,
        'Ferrari',
        '488-Pista',
        'BodyKit',
      );
      expect(workshops.length).toBe(2);
      expect(workshops[0].name).toBe('Novitec');
      expect(workshops[0].logoUrl).toBe('https://test.supabase.co/catalog/Ferrari/488-Pista/BodyKit/Novitec/logo.png');

      const items = await CatalogStorageHelper.listItems(
        mockClient,
        'Ferrari',
        '488-Pista',
        'BodyKit',
        'Novitec',
      );
      expect(items.length).toBe(2);
      expect(items[0].name).toBe('Carbon-Lip-Kit');
      expect(items[0].displayName).toBe('Carbon Lip Kit');
      expect(items[0].imageUrl).toBe('https://test.supabase.co/catalog/Ferrari/488-Pista/BodyKit/Novitec/Carbon-Lip-Kit.png');
      expect(items[1].name).toBe('N-Largo-Widebody');
      expect(items[1].displayName).toBe('N Largo Widebody');
    });

    it('deletes a file successfully from storage', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
          }),
        },
      } as any;

      const res = await CatalogStorageHelper.deleteFile(mockClient, 'Ferrari/logo.png');
      expect(res.ok).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith(['Ferrari/logo.png']);
    });

    it('deletes a folder and all its contents from storage', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockList = vi.fn().mockResolvedValue({
        data: [{ name: 'logo.png' }, { name: 'part.png' }, { name: '.hidden' }],
        error: null,
      });
      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            list: mockList,
            remove: mockRemove,
          }),
        },
      } as any;

      const res = await CatalogStorageHelper.deleteFolder(mockClient, 'Ferrari/488-Pista/BodyKit/Novitec');
      expect(res.ok).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith([
        'Ferrari/488-Pista/BodyKit/Novitec/logo.png',
        'Ferrari/488-Pista/BodyKit/Novitec/part.png',
      ]);
    });
  });
});
