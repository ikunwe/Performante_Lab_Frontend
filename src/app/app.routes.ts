import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'discover',
      },
      {
        path: 'discover',
        title: 'Admin Discover | Performante Lab',
        loadComponent: () =>
          import('./features/admin/discover/admin-discover').then((m) => m.AdminDiscover),
      },
      {
        path: 'requests',
        title: 'Admin Requests | Performante Lab',
        loadComponent: () =>
          import('./features/admin/requests/admin-requests').then((m) => m.AdminRequests),
      },
      {
        path: 'edit-data',
        title: 'Admin Edit Data | Performante Lab',
        loadComponent: () =>
          import('./features/admin/edit-data/admin-edit-data').then((m) => m.AdminEditData),
      },
      {
        path: 'users',
        title: 'Admin Users | Performante Lab',
        loadComponent: () =>
          import('./features/admin/users/admin-users').then((m) => m.AdminUsers),
      },
    ],
  },
  {
    path: 'forgot-password',
    title: 'Forgot Password | Performante Lab',
    loadComponent: () =>
      import('./features/auth/recovery/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Reset Password | Performante Lab',
    loadComponent: () =>
      import('./features/auth/recovery/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    title: 'Profile | Performante Lab',
    data: { tab: 'Profile' },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'my-builds',
    canActivate: [authGuard],
    title: 'My Builds | Performante Lab',
    data: { tab: 'My Builds' },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'build/new',
    canActivate: [authGuard],
    title: 'Create Build | Performante Lab',
    data: { tab: 'My Builds', builder: true },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'compare',
    title: 'Compare | Performante Lab',
    data: { tab: 'Compare' },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'catalog',
    title: 'Catalog | Performante Lab',
    data: { tab: 'Catalog' },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'discover',
    title: 'Discover | Performante Lab',
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'auth/callback',
    title: 'Signing in | Performante Lab',
    loadComponent: () =>
      import('./features/auth/callback/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: 'login',
    title: 'Sign in | Performante Lab',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
];
