import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CatalogStorageHelper } from './catalog-storage';

describe('Recursive catalog folder deletion', () => {
  const file = (name: string) => ({ name, id: `id-${name}` });
  function setup(tree: Record<string, { name: string; id: string | null }[]>) {
    const list = vi.fn(async (path: string, options: { offset: number; limit: number }) => ({
      data: (tree[path] || []).slice(options.offset, options.offset + options.limit), error: null,
    }));
    const remove = vi.fn(async (_paths: string[]) => ({ error: null }));
    const from = vi.fn(() => ({ list, remove }));
    const client = { storage: { from } } as unknown as SupabaseClient;
    return { client, from, list, remove };
  }

  it('deletes nested files, including extensionless files and dotted folders, within the exact prefix', async () => {
    const {client, from, remove} = setup({
      'Honda/Civic': [file('front.png'), {name:'kit.v2',id:null}, file('README')],
      'Honda/Civic/kit.v2': [file('rear.png')],
      'Honda/Civic-TypeR': [file('keep.png')],
    });
    await CatalogStorageHelper.deleteFolderRecursively(client, '/Honda/Civic/');
    expect(from).toHaveBeenCalledWith('catalog');
    expect(remove).toHaveBeenCalledExactlyOnceWith([
      'Honda/Civic/front.png','Honda/Civic/README','Honda/Civic/kit.v2/rear.png',
    ]);
  });

  it('enumerates all pages before deleting in batches of at most 1000', async () => {
    const {client,list,remove} = setup({'Honda':Array.from({length:1001},(_,i)=>file(`${i}.png`))});
    await CatalogStorageHelper.deleteFolderRecursively(client,'Honda');
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][1].offset).toBe(1000);
    expect(remove.mock.calls.map(([paths])=>paths.length)).toEqual([1000,1]);
    expect(list.mock.invocationCallOrder[1]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('rejects root and malformed paths before contacting Storage', async () => {
    const {client,from} = setup({});
    for (const path of ['', '/', ' / ', 'Honda/../Toyota', 'Honda//Civic', 'Honda\\Civic', 'https://example.com/catalog/Honda']) {
      await expect(CatalogStorageHelper.deleteFolderRecursively(client,path)).rejects.toThrow();
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('does not delete anything if a later folder cannot be listed', async () => {
    const {client,list,remove} = setup({});
    list.mockResolvedValueOnce({data:[file('front.png'),{name:'kit',id:null}],error:null});
    list.mockRejectedValueOnce(new Error('list denied'));
    await expect(CatalogStorageHelper.deleteFolderRecursively(client,'Honda')).rejects.toThrow('list denied');
    expect(remove).not.toHaveBeenCalled();
  });

  it('propagates removal errors instead of reporting success and ignores empty folders', async () => {
    const empty = setup({});
    await CatalogStorageHelper.deleteFolderRecursively(empty.client,'Honda/Empty');
    expect(empty.remove).not.toHaveBeenCalled();
    const {client,remove} = setup({'Honda':[file('logo.png')]});
    remove.mockResolvedValueOnce({error:new Error('remove denied')} as never);
    await expect(CatalogStorageHelper.deleteFolderRecursively(client,'Honda')).rejects.toThrow('remove denied');
  });
});
