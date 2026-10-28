import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  DestroyRef,
  viewChild,
} from '@angular/core';

/**
 * Angular adaptation of React Bits Magnet (David Haz).
 * Source and license: THIRD_PARTY_NOTICES.md.
 * Uses the source's center-distance pull and damped spring, limited to 8px.
 */
@Component({
  selector: 'app-magnet',
  template: '<div #surface><ng-content /></div>',
  styles: ':host { display: inline-block; }',
})
export class Magnet {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      const surface = this.surface().nativeElement;
      const media = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
      let frame = 0;
      let last = 0;
      let x = 0,
        y = 0,
        vx = 0,
        vy = 0,
        tx = 0,
        ty = 0;
      const draw = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        const steps = Math.ceil(dt / (1 / 120));
        for (let i = 0; i < steps; i++) {
          const step = dt / steps;
          vx += (170 * (tx - x) - 16 * vx) * step;
          vy += (170 * (ty - y) - 16 * vy) * step;
          x += vx * step;
          y += vy * step;
        }
        const resting = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) < 0.05;
        if (resting) {
          x = tx;
          y = ty;
          vx = vy = 0;
        }
        surface.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        frame = resting ? 0 : requestAnimationFrame(draw);
        if (resting) last = 0;
      };
      const wake = () => {
        if (!frame) frame = requestAnimationFrame(draw);
      };
      const reset = () => {
        tx = ty = 0;
        wake();
      };
      const move = (event: PointerEvent) => {
        if (media.matches || event.pointerType === 'touch') return;
        const rect = host.getBoundingClientRect();
        tx = (event.clientX - rect.left - rect.width / 2) / 4;
        ty = (event.clientY - rect.top - rect.height / 2) / 4;
        const length = Math.hypot(tx, ty);
        if (length > 8) {
          tx *= 8 / length;
          ty *= 8 / length;
        }
        wake();
      };
      const preferenceChanged = () => {
        cancelAnimationFrame(frame);
        frame = last = x = y = vx = vy = tx = ty = 0;
        surface.style.transform = '';
      };
      host.addEventListener('pointermove', move, { passive: true });
      host.addEventListener('pointerleave', reset);
      window.addEventListener('blur', reset);
      media.addEventListener('change', preferenceChanged);
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', reset);
        window.removeEventListener('blur', reset);
        media.removeEventListener('change', preferenceChanged);
      });
    });
  }
}
