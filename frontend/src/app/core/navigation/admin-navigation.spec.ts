import { ADMIN_PRIMARY_ROUTES, isAdminPrimaryRoute } from './admin-navigation';

describe('admin navigation', () => {
  it('recognizes every exact primary route', () => {
    ADMIN_PRIMARY_ROUTES.forEach(route => {
      expect(isAdminPrimaryRoute(route)).withContext(route).toBeTrue();
      expect(isAdminPrimaryRoute(`${route}/`)).withContext(`${route}/`).toBeTrue();
      expect(isAdminPrimaryRoute(`${route}?page=2#results`)).withContext(`${route}?page=2#results`).toBeTrue();
    });
  });

  it('rejects contextual, nested and foreign routes', () => {
    [
      '/admin',
      '/admin/users/123',
      '/admin/products/123/edit',
      '/admin/support/ticket-1',
      '/seller/dashboard',
      '/buyer-panel/catalog',
    ].forEach(route => expect(isAdminPrimaryRoute(route)).withContext(route).toBeFalse());
  });
});
