import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuyerPanelComponent } from './buyer-panel.component';
import { BuyerCatalogComponent } from './components/buyer-catalog/buyer-catalog.component';
import { BuyerExploreComponent } from './components/buyer-explore/buyer-explore.component';
import { BuyerCheckoutComponent } from './components/buyer-checkout/buyer-checkout.component';
import { BuyerOrdersComponent } from './components/buyer-orders/buyer-orders.component';
import { BuyerFavoritesComponent } from './components/buyer-favorites/buyer-favorites.component';
import { BuyerProfileComponent } from './components/buyer-profile/buyer-profile.component';
import { BuyerCartComponent } from './components/buyer-cart/buyer-cart.component';
import { BuyerNotificationsComponent } from './components/buyer-notifications/buyer-notifications.component';
import { BuyerOrderConfirmedComponent } from './components/buyer-order-confirmed/buyer-order-confirmed.component';
import { BuyerProductDetailComponent } from './components/buyer-product-detail/buyer-product-detail.component';
import { BuyerOrderTrackingComponent } from './components/buyer-order-tracking/buyer-order-tracking.component';
import { BuyerSellerApplicationComponent } from './components/buyer-seller-application/buyer-seller-application.component';
import { BuyerSellerStoreComponent } from './components/buyer-seller-store/buyer-seller-store.component';

const routes: Routes = [
  {
    path: '',
    component: BuyerPanelComponent,
    children: [
      { path: 'catalog', component: BuyerCatalogComponent },
      { path: 'explore', component: BuyerExploreComponent },
      { path: 'orders', component: BuyerOrdersComponent },
      { path: 'favorites', component: BuyerFavoritesComponent },
      { path: 'profile', component: BuyerProfileComponent },
      { path: 'seller-application', component: BuyerSellerApplicationComponent },
      { path: 'cart', component: BuyerCartComponent },
      { path: 'checkout', component: BuyerCheckoutComponent },
      { path: 'order-confirmed', component: BuyerOrderConfirmedComponent },
      { path: 'tracking/:id', component: BuyerOrderTrackingComponent },
      { path: 'product/:id', component: BuyerProductDetailComponent },
      { path: 'notifications', component: BuyerNotificationsComponent },
      { path: 'seller-store/:id', component: BuyerSellerStoreComponent },
      { path: '', redirectTo: 'catalog', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BuyerPanelRoutingModule { }
