import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, listCarImages } from './write-car-image-manifest.mjs';
import { listPartImages } from './write-part-image-manifest.mjs';

export async function writeBuildCatalog({ root = projectRoot } = {}) {
  const viewSource = await readFile(
    path.join(root, 'src/app/core/catalog/car-view-manifest.ts'),
    'utf8',
  );
  const marker = 'export const carViewManifest: readonly CarViewEntry[] = ';
  const views = JSON.parse(
    viewSource
      .slice(viewSource.indexOf(marker) + marker.length)
      .trim()
      .replace(/;$/, ''),
  );
  const data = {
    schemaVersion: 1,
    cars: await listCarImages(root),
    parts: await listPartImages(root),
    views,
  };
  const content = JSON.stringify(data, null, 2) + '\n';
  // Public metadata only. This artifact travels with deployments of the separate API.
  const targets = [path.join(root, 'assets/build-catalog.json')];
  const backend = path.resolve(root, '../Performante_Lab_Backend');
  try {
    if (
      JSON.parse(await readFile(path.join(backend, 'package.json'), 'utf8')).name ===
      'performante_lab_backend'
    )
      targets.push(path.join(backend, 'data/build-assets.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const target of targets) {
    let previous;
    try {
      previous = await readFile(target, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (previous !== content) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await writeBuildCatalog();
