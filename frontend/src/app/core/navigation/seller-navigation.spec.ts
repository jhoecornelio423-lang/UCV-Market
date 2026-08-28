import { isSellerPrimaryRoute } from './seller-navigation';

describe('isSellerPrimaryRoute', () => {
  it('accepts only normalized seller primary routes', () => {
    for (const path of [
      '/seller/dashboard',
      '/seller/orders?tab=nuevos',
      '/seller/products#catalogo',
      '/seller/stats/',
      '/seller/business///',
    ]) {
      expect(isSellerPrimaryRoute(path)).withContext(path).toBeTrue();
    }
  });

  it('rejects seller secondary and foreign routes', () => {
    for (const path of [
      '/seller',
      '/seller/product-form',
      '/seller/notifications',
      '/seller/support',
      '/buyer-panel/catalog',
      '/admin',
    ]) {
      expect(isSellerPrimaryRoute(path)).withContext(path).toBeFalse();
    }
  });
});
