import { Component, OnInit, inject } from '@angular/core';
import { SellerStateService } from '../../services/seller-state.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-seller-stats',
  templateUrl: './seller-stats.component.html',
  styleUrls: ['./seller-stats.component.scss'],
  standalone: false
})
export class SellerStatsComponent implements OnInit {
  private sellerState = inject(SellerStateService);
  private toastCtrl = inject(ToastController);

  stats$ = this.sellerState.stats$;
  userProfile$ = this.sellerState.userProfile$;

  currentMonthYear = '';

  ngOnInit() {
    const now = new Date();
    this.currentMonthYear = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  }

  getMaxSales(): number {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return 10;
    const max = Math.max(...stats.salesData.map((d: any) => d.ventas));
    return max > 0 ? max : 10;
  }

  get svgLinePath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return '';
    const max = this.getMaxSales();
    const points = stats.salesData.map((d: any, i: number) => {
      const x = 50 + i * 100;
      const y = 140 - (d.ventas / max) * 110;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  get svgAreaPath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return '';
    const max = this.getMaxSales();
    const points = stats.salesData.map((d: any, i: number) => {
      const x = 50 + i * 100;
      const y = 140 - (d.ventas / max) * 110;
      return `${x},${y}`;
    });
    if (points.length === 0) return '';
    return `M 50,140 L ${points.join(' L ')} L 650,140 Z`;
  }

  getChartPointX(index: number): number {
    return 50 + index * 100;
  }

  getChartPointY(val: number): number {
    const max = this.getMaxSales();
    return 140 - (val / max) * 110;
  }

  async onChartBarClick(data: any) {
    const toast = await this.toastCtrl.create({
      message: `Ventas del ${data.day}: ${data.ventas} pedidos realizados.`,
      duration: 2000,
      color: 'primary',
      position: 'bottom'
    });
    await toast.present();
  }
}
