import { vi } from 'vitest';
import { CatalogStorageHelper } from './catalog-storage';

describe('Workshop display-name persistence', () => {
  it('stores an editable label in the existing folder, reloads it and never creates a folder named after the label', async () => {
    const path = 'Honda/Civic/Part/Front-Bumper/Mugen';
    let metadata: Record<string, unknown> = {},
      exists = false;
    const upload = vi.fn(async (_path: string, _photo: Blob, options: any) => {
      metadata = options.metadata;
      exists = true;
      return { error: null };
    });
    const list = vi.fn(async (_path: string) => ({
      data: exists ? [{ name: 'logo.png', id: 'logo' }] : [],
      error: null,
    }));
    const client = {
      storage: {
        from: () => ({
          list,
          upload,
          info: async () => ({ data: { metadata }, error: null }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: 'https://test/catalog/' + path } }),
        }),
      },
    } as any;
    const result = await CatalogStorageHelper.saveWorkshopProfile(client, path, 'Mugen Japan');
    expect(result.ok).toBe(true);
    expect(upload.mock.calls[0][0]).toBe(path + '/logo.png');
    expect(upload.mock.calls[0][2].metadata).toEqual({
      workshopDisplayName: 'Mugen Japan',
      workshopPlaceholderLogo: true,
    });
    expect(await CatalogStorageHelper.readWorkshopProfile(client, path)).toEqual({
      displayName: 'Mugen Japan',
      logoUrl: '',
    });
    expect(list.mock.calls.every((call) => call[0] === path)).toBe(true);
  });
  it('keeps the original label and files when a write fails', async () => {
    const path = 'Honda/Civic/BodyKit/Mugen';
    const client = {
      storage: {
        from: () => ({
          list: async () => ({ data: [], error: null }),
          upload: async () => ({ error: { message: 'Write denied' } }),
        }),
      },
    } as any;
    expect(await CatalogStorageHelper.saveWorkshopProfile(client, path, 'Renamed')).toEqual({
      ok: false,
      error: 'Write denied',
    });
  });
});
