import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { projectRoot, writeCarImageManifest } from './write-car-image-manifest.mjs';
import { watchCarImages } from './watch-car-images.mjs';
import { writePartImageManifest } from './write-part-image-manifest.mjs';
import { writeCarViewManifest } from './write-car-view-manifest.mjs';

async function workspace(t) {
  const temporary = path.resolve(projectRoot, 'tmp');
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(path.join(temporary, 'car-image-watch-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(temporary + path.sep));
    await rm(resolved, { recursive: true, force: true });
  });
  return root;
}
const manifest = root => path.join(root, 'src/app/core/catalog/car-image-manifest.ts');
const partManifest = root => path.join(root, 'src/app/core/catalog/part-image-manifest.ts');
async function until(check) {
  const end = Date.now() + 8000;
  do {
    if (await check()) return;
    await delay(25);
  } while (Date.now() < end);
  assert.fail('File watcher did not update the manifest');
}

test('unchanged scans do not rewrite the manifest or trigger rebuild loops', async t => {
  const root = await workspace(t);
  assert.equal((await writeCarImageManifest({ root })).changed, true);
  const before = await stat(manifest(root));
  assert.equal((await writeCarImageManifest({ root })).changed, false);
  assert.equal((await stat(manifest(root))).mtimeMs, before.mtimeMs);
});

test('watcher discovers new brand folders and automatically handles add, replace, rename and delete', async t => {
  const root = await workspace(t);
  const watcher = await watchCarImages({ root, log: () => {}, debounceMs: 50 });
  try {
    const brand = path.join(root, 'assets/List_Car/Honda');
    await mkdir(brand, { recursive: true });
    const civic = path.join(brand, 'Civic.png');
    await writeFile(civic, 'image fixture version one');
    await until(async () => (await readFile(manifest(root), 'utf8')).includes('Honda/Civic.png?v='));
    const initial = await readFile(manifest(root), 'utf8');
    await writeFile(civic, 'image fixture version two');
    await until(async () => (await readFile(manifest(root), 'utf8')) !== initial);
    await rename(civic, path.join(brand, 'City.png'));
    await until(async () => {
      const content = await readFile(manifest(root), 'utf8');
      return content.includes('Honda/City.png?v=') && !content.includes('Civic.png');
    });
    await rm(path.join(brand, 'City.png'));
    await until(async () => !(await readFile(manifest(root), 'utf8')).includes('City.png'));
    const beforeClose = await readFile(manifest(root), 'utf8');
    watcher.close();
    await writeFile(civic, 'after close');
    assert.equal(await readFile(manifest(root), 'utf8'), beforeClose);
  } finally {
    watcher.close();
  }
});

test('prepared part watcher supports new models, cache busting, stable identity and removal', async t => {
  const root = await workspace(t);
  const watcher = await watchCarImages({ root, log: () => {}, debounceMs: 50 });
  try {
    const folder = path.join(root, 'assets/List_Part/Honda/Civic');
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, 'Front Bumper_1.png');
    await writeFile(file, 'prepared view one');
    await until(async () => (await readFile(partManifest(root), 'utf8')).includes('Front%20Bumper_1.png?v='));
    const initial = await readFile(partManifest(root), 'utf8');
    const id = initial.match(/local-part:[a-f0-9]+/)[0];
    await writeFile(file, 'prepared view updated');
    await until(async () => (await readFile(partManifest(root), 'utf8')) !== initial);
    assert.ok((await readFile(partManifest(root), 'utf8')).includes(id));
    assert.equal((await writePartImageManifest({ root })).changed, false);
    await rename(file, path.join(folder, 'Rear Bumper_1.png'));
    await until(async () => {
      const content = await readFile(partManifest(root), 'utf8');
      return content.includes('"category": "rear"') && !content.includes('Front%20Bumper');
    });
    await rm(folder, { recursive: true });
    await until(async () => !(await readFile(partManifest(root), 'utf8')).includes('local-part:'));
  } finally { watcher.close(); }
});

test('view watcher discovers default angles and updates replacements, renames and removed folders', async t => {
  const root = await workspace(t);
  const target = path.join(root, 'src/app/core/catalog/car-view-manifest.ts');
  const watcher = await watchCarImages({ root, log: () => {}, debounceMs: 50 });
  try {
    const folder = path.join(root, 'assets/ListCar_view/Honda/Civic/default');
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, '45_front.png');
    await writeFile(file, 'front view version one');
    await until(async () => (await readFile(target, 'utf8')).includes('"view": "front45"'));
    const initial = await readFile(target, 'utf8');
    assert.equal((await writeCarViewManifest({ root })).changed, false);
    await writeFile(file, 'front view updated');
    await until(async () => (await readFile(target, 'utf8')) !== initial);
    await rename(file, path.join(folder, '45_Back.png'));
    await until(async () => {
      const content = await readFile(target, 'utf8');
      return content.includes('"view": "rear45"') && !content.includes('45_front.png');
    });
    const variant = path.join(root, 'assets/ListCar_view/Honda/Civic/Rear Bumper 1');
    await mkdir(variant, { recursive: true });
    const variantFile = path.join(variant, '45_Back.png');
    await writeFile(variantFile, 'rear bumper variant image');
    await until(async () => (await readFile(target, 'utf8')).includes('"variant": "rearbumper1"'));
    const previous = await readFile(target, 'utf8');
    await writeFile(variantFile, 'replaced rear bumper variant');
    await until(async () => (await readFile(target, 'utf8')) !== previous);
    const wheels = path.join(variant, 'Wheel 1');
    await mkdir(wheels);
    const wheelFile = path.join(wheels, '45_Back.png');
    await writeFile(wheelFile, 'bumper and wheel combination');
    await until(async () => (await readFile(target, 'utf8')).includes('"wheelVariant": "wheel1"'));
    const combined = await readFile(target, 'utf8');
    await writeFile(wheelFile, 'updated bumper and wheel combination');
    await until(async () => (await readFile(target, 'utf8')) !== combined);
    const spoilers = path.join(wheels, 'Spoilers 1');
    await mkdir(spoilers);
    const spoilerFile = path.join(spoilers, '45_Back.png');
    await writeFile(spoilerFile, 'bumper wheel spoiler combination');
    await until(async () => (await readFile(target, 'utf8')).includes('"spoilerVariant": "spoiler1"'));
    const withSpoiler = await readFile(target, 'utf8');
    await writeFile(spoilerFile, 'updated spoiler combination');
    await until(async () => (await readFile(target, 'utf8')) !== withSpoiler);
    await rm(spoilers, { recursive: true });
    await until(async () => !(await readFile(target, 'utf8')).includes('"spoilerVariant": "spoiler1"'));
    await rm(wheels, { recursive: true });
    await until(async () => !(await readFile(target, 'utf8')).includes('wheelVariant\": \"wheel1'));
    await rm(path.join(root, 'assets/ListCar_view/Honda'), { recursive: true });
    await until(async () => !(await readFile(target, 'utf8')).includes('"brandId": "honda"'));
  } finally { watcher.close(); }
});
