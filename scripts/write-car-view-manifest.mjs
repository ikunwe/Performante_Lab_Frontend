import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './write-car-image-manifest.mjs';

const normalize = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const views = { '45front': 'front45', front: 'front', '45back': 'rear45', '45rear': 'rear45', back: 'rear', rear: 'rear', side: 'side' };
export async function writeCarViewManifest({ root = projectRoot } = {}) {
  const directory = path.join(root, 'assets/ListCar_view');
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const brand of await readdir(directory, { withFileTypes: true })) {
    if (!brand.isDirectory()) continue;
    for (const model of await readdir(path.join(directory, brand.name), { withFileTypes: true })) {
      if (!model.isDirectory()) continue;
      const modelPath = path.join(directory, brand.name, model.name);
      const variants = (await readdir(modelPath, { withFileTypes: true })).filter(folder => folder.isDirectory());
      for (const stock of variants) {
      const variant = normalize(stock.name);
      const folders = [{ relative: [stock.name], wheelVariant: undefined, spoilerVariant: undefined }];
      for (const folder of folders) {
      for (const child of await readdir(path.join(modelPath, ...folder.relative), { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const name = normalize(child.name);
        if (!folder.wheelVariant && /^wheels?\d/.test(name))
          folders.push({ ...folder, relative: [...folder.relative, child.name], wheelVariant: name.replace(/^wheels/, 'wheel') });
        else if (!folder.spoilerVariant && /^spoilers?\d/.test(name))
          folders.push({ ...folder, relative: [...folder.relative, child.name], spoilerVariant: name.replace(/^spoilers/, 'spoiler') });
      }
      for (const file of await readdir(path.join(modelPath, ...folder.relative), { withFileTypes: true })) {
        if (!file.isFile() || !/\.(png|jpe?g|webp|avif)$/i.test(file.name)) continue;
        const view = views[normalize(file.name.replace(/\.[^.]+$/, ''))];
        if (!view) continue;
        const brandKey = normalize(brand.name);
        const relative = [brand.name, model.name, ...folder.relative, file.name];
        const version = createHash('sha256').update(await readFile(path.join(directory, ...relative))).digest('hex').slice(0, 12);
        const brandId = ({ gwm: 'great-wall', greatwall: 'great-wall', mercedesbenz: 'mercedes-benz' })[brandKey] ?? brandKey;
        if (entries.some(entry => entry.brandId === brandId && entry.model === normalize(model.name) && entry.variant === variant && entry.wheelVariant === folder.wheelVariant && entry.spoilerVariant === folder.spoilerVariant && entry.view === view))
          throw new Error(`Duplicate car view: ${relative.join('/')}`);
        entries.push({ brandId, model: normalize(model.name), variant, ...(folder.wheelVariant ? { wheelVariant: folder.wheelVariant } : {}), ...(folder.spoilerVariant ? { spoilerVariant: folder.spoilerVariant } : {}), view, url: 'assets/ListCar_view/' + relative.map(encodeURIComponent).join('/') + '?v=' + version });
      }
      }
      }
    }
  }
  entries.sort((a, b) => a.url.localeCompare(b.url, 'en'));
  const target = path.join(root, 'src/app/core/catalog/car-view-manifest.ts');
  const content = '// Generated from assets/ListCar_view by scripts/write-car-view-manifest.mjs.\n' +
    "export type CarViewId = 'front45' | 'front' | 'rear45' | 'rear' | 'side';\n" +
    'export interface CarViewEntry { readonly brandId: string; readonly model: string; readonly variant: string; readonly wheelVariant?: string; readonly spoilerVariant?: string; readonly view: CarViewId; readonly url: string; }\n' +
    'export const carViewManifest: readonly CarViewEntry[] = ' + JSON.stringify(entries, null, 2) + ';\n';
  let previous;
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== content) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { changed: previous !== content, count: entries.length };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await writeCarViewManifest();
  console.log(`Indexed ${result.count} car views${result.changed ? '' : ' (unchanged)'}.`);
}
