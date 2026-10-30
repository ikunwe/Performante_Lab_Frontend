import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  // SSR contains no session data; session validation happens on browser hydration.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();

  if (!auth.user()) {
    return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
  }

  // Suspended accounts cannot access the admin portal
  if (!auth.isActive()) {
    return router.createUrlTree(['/login'], { queryParams: { error: 'suspended' } });
  }

  if (auth.isAdmin()) {
    return true;
  }

  // Regular users are redirected to user portal
  return router.createUrlTree(['/discover']);
};
