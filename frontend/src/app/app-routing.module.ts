import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'catalog',
    loadChildren: () => import('./features/catalog/catalog.module').then(m => m.CatalogModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'cart',
    loadChildren: () => import('./features/cart/cart.module').then(m => m.CartModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/orders.module').then(m => m.OrdersModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'seller',
    loadChildren: () => import('./features/seller-panel/seller-panel.module').then(m => m.SellerPanelModule),
    canActivate: [AuthGuard],
    data: { expectedRoles: ['emprendedor'] }
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin-panel/admin-panel.module').then(m => m.AdminPanelModule),
    canActivate: [AuthGuard],
    data: { expectedRoles: ['admin'] }
  },
  {
    path: '',
    redirectTo: 'catalog',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'catalog'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
