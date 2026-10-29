import { Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCarSide,
  faCar,
  faCarRear,
  faCircleDot,
  faScrewdriverWrench,
  faCompass,
  faBookOpen,
  faCodeCompare,
  faFloppyDisk,
  faMagnifyingGlass,
  faFilter,
  faBell,
  faUser,
  faBookmark,
  faHeart,
  faPlus,
  faArrowRight,
  faArrowLeft,
  faXmark,
  faLock,
  faEye,
  faEyeSlash,
  faChevronDown,
  faArrowRightFromBracket,
  faCheck,
  faExclamation,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';

const icons: Record<string, IconDefinition> = {
  car: faCarSide,
  front: faCar,
  rear: faCarRear,
  wheel: faCircleDot,
  parts: faScrewdriverWrench,
  discover: faCompass,
  catalog: faBookOpen,
  compare: faCodeCompare,
  builds: faFloppyDisk,
  search: faMagnifyingGlass,
  filter: faFilter,
  bell: faBell,
  user: faUser,
  bookmark: faBookmark,
  heart: faHeart,
  plus: faPlus,
  arrow: faArrowRight,
  back: faArrowLeft,
  close: faXmark,
  lock: faLock,
  eye: faEye,
  'eye-off': faEyeSlash,
  google: faGoogle,
  'chevron-down': faChevronDown,
  logout: faArrowRightFromBracket,
  check: faCheck,
  exclamation: faExclamation,
  spinner: faSpinner,
};

@Component({
  selector: 'app-icon',
  imports: [FaIconComponent],
  template:
    '<fa-icon [icon]="icon" class="flex h-full w-full items-center justify-center [&_svg]:h-full! [&_svg]:w-full!" />',
  host: { class: 'inline-block size-4 shrink-0', 'aria-hidden': 'true' },
})
export class Icon {
  readonly name = input('discover');
  get icon(): IconDefinition {
    return icons[this.name()] ?? faCompass;
  }
}
