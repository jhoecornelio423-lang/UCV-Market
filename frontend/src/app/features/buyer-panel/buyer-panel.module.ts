import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { BuyerPanelRoutingModule } from './buyer-panel-routing.module';
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
import { SupportModule } from '../support/support.module';
import { SupportPageComponent } from '../support/support-page.component';

@NgModule({
  declarations: [
    BuyerPanelComponent,
    BuyerCatalogComponent,
    BuyerExploreComponent,
    BuyerCheckoutComponent,
    BuyerOrdersComponent,
    BuyerFavoritesComponent,
    BuyerProfileComponent,
    BuyerCartComponent,
    BuyerNotificationsComponent,
    BuyerOrderConfirmedComponent,
    BuyerProductDetailComponent,
    BuyerOrderTrackingComponent,
    BuyerSellerApplicationComponent,
    BuyerSellerStoreComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    BuyerPanelRoutingModule,
    SupportModule
  ]
})
export class BuyerPanelModule { }
