import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ShowcaseBuild } from '../../discover.data';

@Component({
  selector: 'app-build-card',
  imports: [Icon, DecimalPipe],
  templateUrl: './build-card.html',
})
export class BuildCard {
  readonly build = input.required<ShowcaseBuild>();
  readonly liked = input(false);
  readonly busy = input(false);
  readonly details = output<ShowcaseBuild>();
  readonly like = output<ShowcaseBuild>();
  readonly copy = output<ShowcaseBuild>();
  readonly remove = output<ShowcaseBuild>();
}
