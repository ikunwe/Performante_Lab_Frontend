import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, Injectable, Renderer2, effect, inject, input } from '@angular/core';
import { pickLogoBackdrop } from './logo-palette';

const CACHE_KEY = 'performante-lab.logo-backdrops.v1';
const TTL = 7 * 24 * 60 * 60 * 1000;
type Entry = { color: string; expiresAt: number };

@Injectable({ providedIn: 'root' })
export class LogoBackdropCache {
  private readonly document = inject(DOCUMENT);
  private readonly entries = new Map<string, Entry>();
  constructor() {
    try {
      const saved = JSON.parse(this.document.defaultView?.localStorage.getItem(CACHE_KEY) ?? '[]');
      if (Array.isArray(saved))
        for (const item of saved.slice(-600)) {
          if (
            Array.isArray(item) &&
            typeof item[0] === 'string' &&
            /^#[0-9a-f]{6}$/.test(item[1]?.color) &&
            item[1].expiresAt > Date.now() &&
            item[1].expiresAt <= Date.now() + TTL
          )
            this.entries.set(item[0], item[1]);
        }
    } catch {
      /* A blocked/corrupt cache does not affect image display. */
    }
  }
  get(source: string): string | null {
    const entry = this.entries.get(source);
    return entry && entry.expiresAt > Date.now() ? entry.color : null;
  }
  analyse(source: string, image: HTMLImageElement): string {
    const cached = this.get(source);
    if (cached) return cached;
    if (!image.naturalWidth || !image.naturalHeight) return '#737373';
    try {
      const canvas = this.document.createElement('canvas');
      canvas.width = canvas.height = 48;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return '#737373';
      const ratio = Math.min(48 / image.naturalWidth, 48 / image.naturalHeight);
      const width = image.naturalWidth * ratio;
      const height = image.naturalHeight * ratio;
      context.drawImage(image, (48 - width) / 2, (48 - height) / 2, width, height);
      const color = pickLogoBackdrop(context.getImageData(0, 0, 48, 48).data);
      this.entries.set(source, { color, expiresAt: Date.now() + TTL });
      while (this.entries.size > 600) this.entries.delete(this.entries.keys().next().value!);
      try {
        this.document.defaultView?.localStorage.setItem(
          CACHE_KEY,
          JSON.stringify([...this.entries]),
        );
      } catch {
        /* Memory cache still works. */
      }
      return color;
    } catch {
      return '#737373'; /* Keep a neutral plate if pixel access is unavailable. */
    }
  }
}

@Directive({ selector: 'img[appLogoBackdrop]', host: { '(load)': 'onLoad()' } })
export class LogoBackdrop {
  readonly appLogoBackdrop = input.required<string>();
  private readonly image = inject(ElementRef<HTMLImageElement>);
  private readonly renderer = inject(Renderer2);
  private readonly cache = inject(LogoBackdropCache);
  constructor() {
    effect(() => {
      const source = this.appLogoBackdrop();
      this.paint(this.cache.get(source) ?? '#737373');
      if (this.image.nativeElement.complete && this.image.nativeElement.naturalWidth) this.onLoad();
    });
  }
  onLoad(): void {
    const image = this.image.nativeElement;
    // Ignore a late load event from a previous src when the brand list changes.
    if (image.getAttribute('src') !== this.appLogoBackdrop()) return;
    this.paint(this.cache.analyse(this.appLogoBackdrop(), image));
  }
  private paint(color: string): void {
    const plate = this.image.nativeElement.parentElement;
    if (plate) this.renderer.setStyle(plate, 'background-color', color);
  }
}
