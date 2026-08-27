import { Provider } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { AuthService } from '../app/core/auth/auth.service';
import { CartService } from '../app/core/cart/cart.service';
import { SupabaseClientService } from '../app/core/database/supabase.client';
import { AUTH_REPOSITORY } from '../app/core/repositories/auth.repository';
import { ORDER_REPOSITORY } from '../app/core/repositories/order.repository';
import { PRODUCT_REPOSITORY } from '../app/core/repositories/product.repository';
import { SellerApplicationRepository } from '../app/core/repositories/seller-application.repository';
import { FavoritesService } from '../app/core/services/favorites.service';
import { NotificationService } from '../app/core/services/notification.service';
import { SellerStateService } from '../app/features/seller-panel/services/seller-state.service';

const routerStub = {
  url: '/',
  events: NEVER,
  navigate: () => Promise.resolve(true),
  getCurrentNavigation: () => null,
};

const activatedRouteStub = {
  snapshot: {
    paramMap: convertToParamMap({}),
    queryParamMap: convertToParamMap({}),
  },
  params: of({}),
  queryParams: of({}),
  paramMap: of(convertToParamMap({})),
  queryParamMap: of(convertToParamMap({})),
};

const authServiceStub = {
  currentProfile$: of(null),
  isInitialized$: of(true),
  signOut: () => of(undefined),
};

const favoritesServiceStub = {
  favorites$: of([]),
  getFavorites: () => [],
  isFavorite: () => false,
  toggleFavorite: () => Promise.resolve(),
};

const notificationServiceStub = {
  notifications$: of([]),
  unreadCount$: of(0),
  requestPermission: () => Promise.resolve(),
};

const sellerStateStub = {
  products$: of([]),
  categories$: of([]),
  activeOrders$: of([]),
  allOrders$: of([]),
  stats$: of({}),
  userProfile$: of(null),
  loading$: of(false),
  currentUserProfile: null,
  refreshData: () => undefined,
};

const productRepositoryStub = {
  getCategories: () => of([]),
  getActiveProducts: () => of([]),
  getSellerProducts: () => of([]),
  getProductById: () => of(null),
};

const orderRepositoryStub = {
  getBuyerOrders: () => of([]),
  getSellerOrders: () => of([]),
  getOrderById: () => of(null),
};

const authRepositoryStub = {
  getProfile: () => of(null),
};

/**
 * Dependencias de frontera compartidas por los smoke tests de componentes.
 * Ningún doble realiza red, almacenamiento persistente ni navegación real.
 */
export const TEST_PROVIDERS: Provider[] = [
  { provide: Router, useValue: routerStub },
  { provide: ActivatedRoute, useValue: activatedRouteStub },
  { provide: AuthService, useValue: authServiceStub },
  { provide: FavoritesService, useValue: favoritesServiceStub },
  { provide: NotificationService, useValue: notificationServiceStub },
  { provide: SellerStateService, useValue: sellerStateStub },
  { provide: SupabaseClientService, useValue: { client: {} } },
  { provide: SellerApplicationRepository, useValue: {} },
  { provide: CartService, useValue: {} },
  { provide: AUTH_REPOSITORY, useValue: authRepositoryStub },
  { provide: PRODUCT_REPOSITORY, useValue: productRepositoryStub },
  { provide: ORDER_REPOSITORY, useValue: orderRepositoryStub },
];
