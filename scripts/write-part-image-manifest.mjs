import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './write-car-image-manifest.mjs';

const normalize = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const categories = [
  ['fullbodykits', 'bodykits'], ['fullbodykit', 'bodykits'], ['bodykits', 'bodykits'], ['bodykit', 'bodykits'],
  ['frontbumpers', 'front'], ['frontbumper', 'front'],
  ['rearbumpers', 'rear'], ['rearbumper', 'rear'],
  ['wheels', 'wheels'], ['wheel', 'wheels'], ['spoilers', 'spoilers'], ['spoiler', 'spoilers'],
];
const hash = data => createHash('sha256').update(data).digest('hex');
export async function listPartImages(root = projectRoot) {
  const directory = path.join(root, 'assets/List_Part');
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const brand of await readdir(directory, { withFileTypes: true })) {
    if (!brand.isDirectory()) continue;
    for (const model of await readdir(path.join(directory, brand.name), { withFileTypes: true })) {
      if (!model.isDirectory()) continue;
      for (const file of await readdir(path.join(directory, brand.name, model.name), { withFileTypes: true })) {
        if (!file.isFile() || !/\.(png|jpe?g|webp|avif)$/i.test(file.name)) continue;
        const stem = file.name.replace(/\.[^.]+$/, '');
        const category = categories.find(([prefix]) => normalize(stem).startsWith(prefix))?.[1];
        if (!category) continue;
        const relative = [brand.name, model.name, file.name];
        const brandKey = normalize(brand.name);
        entries.push({
          id: 'local-part:' + hash(relative.join('/').toLowerCase()).slice(0, 20),
          brandId: ({ gwm: 'great-wall', greatwall: 'great-wall', mercedesbenz: 'mercedes-benz' })[brandKey] ?? brandKey,
          model: normalize(model.name), category,
          name: stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
          url: 'assets/List_Part/' + relative.map(encodeURIComponent).join('/') + '?v=' +
            hash(await readFile(path.join(directory, ...relative))).slice(0, 12),
        });
      }
    }
  }
  entries.sort((a, b) => (a.brandId + '/' + a.model + '/' + a.name).localeCompare(b.brandId + '/' + b.model + '/' + b.name, 'en', { numeric: true }));
  return entries;
}

export async function writePartImageManifest({ root = projectRoot } = {}) {
  const entries = await listPartImages(root);
  const target = path.join(root, 'src/app/core/catalog/part-image-manifest.ts');
  const content = '// Generated from assets/List_Part by scripts/write-part-image-manifest.mjs.\n' +
    'export interface PartImageEntry { readonly id: string; readonly brandId: string; readonly model: string; readonly category: string; readonly name: string; readonly url: string; }\n' +
    'export const partImageManifest: readonly PartImageEntry[] = ' + JSON.stringify(entries, null, 2) + ';\n';
  let previous;
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== content) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { changed: previous !== content, count: entries.length };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await writePartImageManifest();
  console.log(`Indexed ${result.count} prepared part images${result.changed ? '' : ' (unchanged)'}.`);
}
