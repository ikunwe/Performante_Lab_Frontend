import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  // SSR contains no account data; session restoration and routing happen in the browser.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();

  if (!auth.user()) {
    return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
  }

  // Prevent suspended users from accessing protected features
  if (!auth.isActive()) {
    return router.createUrlTree(['/login'], { queryParams: { error: 'suspended' } });
  }

  return true;
};
