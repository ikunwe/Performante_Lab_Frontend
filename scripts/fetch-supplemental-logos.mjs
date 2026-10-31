import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Exact brand matches reviewed against the supplemental car-brand records.
const revision = '3f0929e70e0a9a2a502063edc4b3e5c0146cba74';
const base = `https://raw.githubusercontent.com/vehiclespecs/brand-logos/${revision}/`;
const files = ['aion', 'avatr', 'deepal', 'denza', 'jaecoo', 'kgm', 'ora', 'xiaomi', 'yangwang'];
const directory = new URL('../assets/brands/supplemental/', import.meta.url);
await mkdir(directory, { recursive: true });
const assets = [];
for (const id of files) {
  const filename = `${id}-logo.${id === 'ora' ? 'png' : 'svg'}`;
  const response = await fetch(base + filename);
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (filename.endsWith('.svg')) {
    const svg = bytes.toString('utf8');
    const references = [...svg.matchAll(/(?:href\s*=\s*["']([^"']+)["']|url\(\s*["']?([^\s)'";]+))/gi)];
    if (!svg.includes('<svg') || /<script|<foreignObject|<image|<style|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|@import/i.test(svg) || references.some((match) => !(match[1] ?? match[2]).startsWith('#'))) {
      throw new Error(`Unexpected active or linked content in ${filename}; review before importing`);
    }
  } else if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Invalid PNG: ${filename}`);
  }
  await writeFile(new URL(filename, directory), bytes);
  assets.push({ id, filename, source: base + filename, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const filename of ['LICENSE', 'README.md']) {
  const response = await fetch(base + filename);
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  await writeFile(new URL(filename, directory), await response.text());
}
await writeFile(new URL('manifest.json', directory), JSON.stringify({ repository: 'https://github.com/vehiclespecs/brand-logos', revision, assets }, null, 2) + '\n');
console.log(`Imported ${assets.length} logos with pinned sources and SHA-256 checksums.`);
