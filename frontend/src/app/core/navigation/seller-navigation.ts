import { normalizeAppPath } from './buyer-navigation';

export const SELLER_PRIMARY_ROUTES = [
  '/seller/dashboard',
  '/seller/orders',
  '/seller/products',
  '/seller/stats',
  '/seller/business',
] as const;

export function isSellerPrimaryRoute(path: string): boolean {
  const normalizedPath = normalizeAppPath(path);
  return SELLER_PRIMARY_ROUTES.some(route => route === normalizedPath);
}
