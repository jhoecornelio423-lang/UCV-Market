import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { SellerPanelComponent } from './seller-panel.component';
import { SellerDashboardComponent } from './components/seller-dashboard/seller-dashboard.component';
import { SellerProductsComponent } from './components/seller-products/seller-products.component';
import { SellerProductFormComponent } from './components/seller-product-form/seller-product-form.component';
import { SellerStatsComponent } from './components/seller-stats/seller-stats.component';
import { SellerBusinessComponent } from './components/seller-business/seller-business.component';
import { SellerOrdersComponent } from './components/seller-orders/seller-orders.component';

const routes: Routes = [
  {
    path: '',
    component: SellerPanelComponent,
    children: [
      { path: 'dashboard', component: SellerDashboardComponent },
      { path: 'products', component: SellerProductsComponent },
      { path: 'product-form', component: SellerProductFormComponent },
      { path: 'orders', component: SellerOrdersComponent },
      { path: 'stats', component: SellerStatsComponent },
      { path: 'business', component: SellerBusinessComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  declarations: [
    SellerPanelComponent,
    SellerDashboardComponent,
    SellerProductsComponent,
    SellerProductFormComponent,
    SellerStatsComponent,
    SellerBusinessComponent,
    SellerOrdersComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class SellerPanelModule { }
