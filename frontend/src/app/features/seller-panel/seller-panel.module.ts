import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { SellerPanelComponent } from './seller-panel.component';

const routes: Routes = [
  { path: '', component: SellerPanelComponent }
];

@NgModule({
  declarations: [SellerPanelComponent],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class SellerPanelModule { }
