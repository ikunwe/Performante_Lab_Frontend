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
});

