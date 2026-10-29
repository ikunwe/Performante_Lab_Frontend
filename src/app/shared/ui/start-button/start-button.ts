import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { mountSpecularButton } from '../../react-bits/specular-button/specular-button.engine';

@Component({
  selector: 'button[appStartButton]',
  imports: [Icon],
  templateUrl: './start-button.html',
  styleUrl: './start-button.css',
  host: {
    class:
      'relative isolate inline-flex items-center justify-center min-h-12 px-[26px] py-4 border-0 rounded-lg cursor-pointer disabled:cursor-not-allowed',
    '[class.start-button--light]': "variant() === 'light'",
    '[class.start-button--red]': "variant() === 'red'",
  },
})
export class StartButton {
  readonly variant = input<'light' | 'red'>('red');
  readonly showArrow = input(false);
  private readonly host = inject(ElementRef<HTMLButtonElement>);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('light');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      // Keep the CSS glass rim when WebGL is unavailable (including test DOMs).
      if (typeof WebGL2RenderingContext === 'undefined') return;
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      let cleanup: (() => void) | undefined;
      const mount = () => {
        cleanup?.();
        try {
          cleanup = mountSpecularButton(this.host.nativeElement, this.canvas().nativeElement, {
            lineColor: this.variant() === 'red' ? '#ffb49d' : '#ffffff',
            reducedMotion: media.matches,
          });
        } catch {
          // Native button and static rim remain available if rendering cannot initialize.
          cleanup = undefined;
        }
      };
      mount();
      media.addEventListener('change', mount);
      this.destroyRef.onDestroy(() => {
        media.removeEventListener('change', mount);
        cleanup?.();
      });
    });
  }
}
