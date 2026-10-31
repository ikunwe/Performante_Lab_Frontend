import { watch } from 'node:fs';
import path from 'node:path';
import { projectRoot, writeCarImageManifest } from './write-car-image-manifest.mjs';
import { writePartImageManifest } from './write-part-image-manifest.mjs';
import { writeCarViewManifest } from './write-car-view-manifest.mjs';
import { writeBuildCatalog } from './write-build-catalog.mjs';

export async function watchCarImages({
  root = projectRoot,
  log = console.log,
  debounceMs = 350,
} = {}) {
  let closed = false;
  let running = false;
  let pending = false;
  let timer;
  let attempts = 0;
  async function rebuild() {
    if (closed) return;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      const result = await writeCarImageManifest({ root });
      const parts = await writePartImageManifest({ root });
      const views = await writeCarViewManifest({ root });
      await writeBuildCatalog({ root });
      attempts = 0;
      if (!closed && result.changed) log(`[car images] Updated ${result.count} images.`);
      if (!closed && parts.changed) log(`[part images] Updated ${parts.count} prepared images.`);
      if (!closed && views.changed) log(`[car views] Updated ${views.count} views.`);
    } catch (error) {
      // Copy/rename operations can temporarily hide or lock a file on Windows.
      if (!closed && attempts++ < 3) pending = true;
      else if (!closed) log(`[car images] ${error.message}; waiting for the next file change.`);
    } finally {
      running = false;
      if (pending && !closed) {
        pending = false;
        schedule();
      }
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!closed) timer = setTimeout(rebuild, debounceMs);
  }
  // Watch the parent so removing/recreating List_Car or a brand folder is supported.
  // Startup generation creates this directory when starting with an empty collection.
  await writeCarImageManifest({ root });
  await writePartImageManifest({ root });
  await writeCarViewManifest({ root });
  await writeBuildCatalog({ root });
  const watcher = watch(path.join(root, 'assets'), { recursive: true }, (_event, filename) => {
    if (!filename || ['list_car', 'list_part', 'listcar_view'].includes(String(filename).replaceAll('\\', '/').split('/')[0].toLowerCase())) {
      attempts = 0;
      schedule();
    }
  });
  const close = () => {
    closed = true;
    clearTimeout(timer);
    watcher.close();
  };
  watcher.on('error', (error) => {
    log(`[car images] Watcher stopped: ${error.message}`);
    close();
  });
  // Catch a file added between initial generation and attaching the watcher.
  await rebuild();
  log('[car images] Watching assets/List_Car for new, changed and removed images.');
  log('[part images] Watching assets/List_Part for new, changed and removed images.');
  log('[car views] Watching assets/ListCar_view for new, changed and removed images.');
  return { close };
}
