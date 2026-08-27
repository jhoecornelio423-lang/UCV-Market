export const BUYER_PRIMARY_ROUTES = [
  '/buyer-panel/catalog',
  '/buyer-panel/explore',
  '/buyer-panel/orders',
  '/buyer-panel/favorites',
  '/buyer-panel/profile',
] as const;

export function normalizeAppPath(path: string): string {
  const cleanPath = path.split(/[?#]/, 1)[0];
  return cleanPath.length > 1 ? cleanPath.replace(/\/+$/, '') : cleanPath;
}

export function isBuyerPrimaryRoute(path: string): boolean {
  const normalizedPath = normalizeAppPath(path);
  return BUYER_PRIMARY_ROUTES.some(route => route === normalizedPath);
}
