import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  {
    path: 'buyer-panel',
    loadChildren: () => import('./features/buyer-panel/buyer-panel.module').then(m => m.BuyerPanelModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
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
    redirectTo: 'buyer-panel',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'buyer-panel'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
