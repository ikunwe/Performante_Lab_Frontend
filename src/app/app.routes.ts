import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'my-builds',
    title: 'My Builds | Performante Lab',
    data: { tab: 'My Builds' },
    loadComponent: () => import('./features/discover/discover').then((m) => m.Discover),
  },
  {
    path: 'build/new',
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
