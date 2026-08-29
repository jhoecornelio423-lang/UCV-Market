import { normalizeAppPath } from './buyer-navigation';

export const ADMIN_PRIMARY_ROUTES = [
  '/admin/dashboard',
  '/admin/sellers',
  '/admin/users',
  '/admin/products',
  '/admin/categories',
  '/admin/support',
  '/admin/reports',
] as const;

export function isAdminPrimaryRoute(path: string): boolean {
  const normalizedPath = normalizeAppPath(path);
  return ADMIN_PRIMARY_ROUTES.some(route => route === normalizedPath);
}
