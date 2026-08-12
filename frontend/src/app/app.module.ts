import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { AUTH_REPOSITORY } from './core/repositories/auth.repository';
import { SupabaseAuthRepository } from './core/repositories/supabase/supabase-auth.repository';
import { PRODUCT_REPOSITORY } from './core/repositories/product.repository';
import { SupabaseProductRepository } from './core/repositories/supabase/supabase-product.repository';
import { ORDER_REPOSITORY } from './core/repositories/order.repository';
import { SupabaseOrderRepository } from './core/repositories/supabase/supabase-order.repository';

registerLocaleData(localeEs);

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: AUTH_REPOSITORY, useClass: SupabaseAuthRepository },
    { provide: PRODUCT_REPOSITORY, useClass: SupabaseProductRepository },
    { provide: ORDER_REPOSITORY, useClass: SupabaseOrderRepository },
    { provide: LOCALE_ID, useValue: 'es' }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
