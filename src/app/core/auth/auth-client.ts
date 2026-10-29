import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
export const AUTH_NEXT_KEY = 'performante-lab.auth.next';
export const AUTH_RECOVERY_KEY = 'performante-lab.auth.recovery-user';

export interface AuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiBaseUrl: string;
}

export const AUTH_CONFIG = new InjectionToken<() => Promise<AuthConfig>>('AUTH_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    let pending: Promise<AuthConfig> | undefined;
    return () =>
      (pending ??= (async () => {
        const response = await fetch(new URL('auth-config.json', document.baseURI), {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('config');
        return response.json();
      })());
  },
});

// Public browser configuration only. Never put a service_role/secret key here.
export const AUTH_CLIENT = new InjectionToken<() => Promise<SupabaseClient | null>>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const loadConfig = inject(AUTH_CONFIG);
    return async () => {
      if (!browser) return null;
      const config = await loadConfig();
      if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
      const url = new URL(config.supabaseUrl);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
        throw new Error('config');
      }
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(url.href, config.supabasePublishableKey, {
        auth: {
          flowType: 'pkce',
          // The callback route exchanges the code exactly once.
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    };
  },
});

const destinations = new Set([
  '/discover',
  '/catalog',
  '/compare',
  '/my-builds',
  '/build/new',
  '/profile',
]);
export function loginDestination(value: string | null): string {
  if (!value) return '/discover';
  try {
    const url = new URL(value, 'https://performante.invalid');
    if (
      !value.startsWith('/') ||
      url.origin !== 'https://performante.invalid' ||
      !destinations.has(url.pathname)
    ) {
      return '/discover';
    }
    return url.pathname === '/build/new'
      ? url.pathname +
          (url.searchParams.has('car')
            ? '?car=' + encodeURIComponent(url.searchParams.get('car')!)
            : '')
      : url.pathname;
  } catch {
    return '/discover';
  }
}
