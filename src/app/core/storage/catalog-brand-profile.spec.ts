import { vi } from 'vitest';
import { CatalogStorageHelper } from './catalog-storage';

describe('Storage brand display names', () => {
  it('persists and reloads the display name while retaining the original logo, folder and metadata', async () => {
    let metadata: Record<string, unknown> = { attribution: 'Original source' };
    const photo = new Blob(['original-image'], { type: 'image/png' });
    const upload = vi.fn(async (_path: string, _photo: Blob, options: any) => {
      metadata = options.metadata;
      return { error: null };
    });
    const storage = {
      list: async (path: string) => ({
        data:
          path === ''
            ? [{ name: 'Honda', id: null, metadata: null }]
            : [{ name: 'logo.png', id: 'logo', metadata: { size: 14 } }],
        error: null,
      }),
      info: async () => ({ data: { metadata }, error: null }),
      download: async () => ({ data: photo, error: null }),
      upload,
      getPublicUrl: (path: string) => ({ data: { publicUrl: 'https://test/catalog/' + path } }),
    };
    const client = { storage: { from: () => storage } } as any;
    expect(
      (await CatalogStorageHelper.saveBrandProfile(client, 'Honda', 'Honda Thailand')).ok,
    ).toBe(true);
    expect(upload).toHaveBeenCalledWith(
      'Honda/logo.png',
      photo,
      expect.objectContaining({
        metadata: { attribution: 'Original source', brandDisplayName: 'Honda Thailand' },
      }),
    );
    const brands = await CatalogStorageHelper.listBrands(client);
    expect(brands[0].id).toBe('Honda');
    expect(brands[0].name).toBe('Honda Thailand');
    expect(brands[0].logoUrl).toBe('https://test/catalog/Honda/logo.png');
  });
  it('does not report success when Storage cannot read or write the brand', async () => {
    const upload = vi.fn();
    const client = {
      storage: {
        from: () => ({ list: async () => ({ error: { message: 'Storage unavailable' } }), upload }),
      },
    } as any;
    expect(await CatalogStorageHelper.saveBrandProfile(client, 'Honda', 'New Name')).toEqual({
      ok: false,
      error: 'Storage unavailable',
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
