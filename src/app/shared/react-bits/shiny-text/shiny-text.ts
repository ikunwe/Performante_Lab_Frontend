import { Component } from '@angular/core';

/**
 * Lightweight Angular adaptation of React Bits ShinyText.
 * Retains its clipped gradient sweep, implemented with CSS instead of React hooks.
 * Source and license: THIRD_PARTY_NOTICES.md.
 */
@Component({
  selector: '[appShinyText]',
  template: '<ng-content />',
  styleUrl: './shiny-text.css',
})
export class ShinyText {}
