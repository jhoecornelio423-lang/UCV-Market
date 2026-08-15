import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { SupportPageComponent } from './support-page.component';

@NgModule({
  declarations: [
    SupportPageComponent
  ],
  exports: [
    SupportPageComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ]
})
export class SupportModule { }
