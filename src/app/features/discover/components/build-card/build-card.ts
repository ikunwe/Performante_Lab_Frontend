import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AccountAvatar } from '../../../../shared/ui/account-avatar/account-avatar';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ShowcaseImage } from '../showcase-image/showcase-image';
import { ShowcaseBuild } from '../../discover.data';

@Component({
  selector: 'app-build-card',
  imports: [Icon, DecimalPipe, ShowcaseImage, AccountAvatar],
  templateUrl: './build-card.html',
})
export class BuildCard {
  readonly build = input.required<ShowcaseBuild>();
  readonly liked = input(false);
  readonly likeCount = input(0);
  readonly likeBusy = input(false);
  readonly likeDisabled = input(false);
  readonly busy = input(false);
  readonly details = output<ShowcaseBuild>();
  readonly like = output<ShowcaseBuild>();
  readonly copy = output<ShowcaseBuild>();
  readonly remove = output<ShowcaseBuild>();
}
