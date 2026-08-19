import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

const SESSION_CHECK_TIMEOUT_MS = 6000;

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const signIn = () =>
    router.createUrlTree(['/owner-auth'], { queryParams: { returnUrl: state.url } });

  // Navigate immediately on a stored session and re-validate in the background.
  // Blocking on /api/auth/me here made guarded routes hang whenever the API was
  // slow; an expired session is still caught by the background check and the
  // 401 interceptor.
  if (authService.hasStoredSession()) {
    authService.refreshSessionIfNeeded();
    return true;
  }

  return authService.validateSession().pipe(
    timeout(SESSION_CHECK_TIMEOUT_MS),
    map((valid) => (valid ? true : signIn())),
    catchError(() => of(signIn()))
  );
};
