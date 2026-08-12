import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AdminPanelComponent } from './admin-panel.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminSellersComponent } from './components/admin-sellers/admin-sellers.component';
import { AdminProductsComponent } from './components/admin-products/admin-products.component';
import { AdminCategoriesComponent } from './components/admin-categories/admin-categories.component';
import { AdminSupportComponent } from './components/admin-support/admin-support.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

const routes: Routes = [
  { 
    path: '', 
    component: AdminPanelComponent,
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'sellers', component: AdminSellersComponent },
      { path: 'products', component: AdminProductsComponent },
      { path: 'categories', component: AdminCategoriesComponent },
      { path: 'support', component: AdminSupportComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AdminPanelComponent,
    AdminDashboardComponent,
    AdminSellersComponent,
    AdminProductsComponent,
    AdminCategoriesComponent,
    AdminSupportComponent,
    AdminUsersComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    BaseChartDirective,
    RouterModule.forChild(routes)
  ],
  providers: [
    provideCharts(withDefaultRegisterables())
  ]
})
export class AdminPanelModule { }
