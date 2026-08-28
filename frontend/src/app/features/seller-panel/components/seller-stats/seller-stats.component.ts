import { Component, OnInit, inject } from '@angular/core';
import { SellerStateService } from '../../services/seller-state.service';
import { ToastController } from '@ionic/angular';
import { MonthlySalesPoint } from '../../services/seller-stats-calculator';

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
    if (!stats.monthlySalesData?.length) return 10;
    const max = Math.max(...stats.monthlySalesData.map((d: MonthlySalesPoint) => d.sales));
    return max > 0 ? max : 10;
  }

  get svgLinePath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.monthlySalesData) return '';
    const max = this.getMaxSales();
    const points = stats.monthlySalesData.map((d: MonthlySalesPoint, i: number) => {
      const x = this.getChartPointX(i);
      const y = 140 - (d.sales / max) * 110;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  get svgAreaPath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.monthlySalesData) return '';
    const max = this.getMaxSales();
    const points = stats.monthlySalesData.map((d: MonthlySalesPoint, i: number) => {
      const x = this.getChartPointX(i);
      const y = 140 - (d.sales / max) * 110;
      return `${x},${y}`;
    });
    if (points.length === 0) return '';
    const firstX = this.getChartPointX(0);
    const lastX = this.getChartPointX(points.length - 1);
    return `M ${firstX},140 L ${points.join(' L ')} L ${lastX},140 Z`;
  }

  getChartPointX(index: number): number {
    const count = this.sellerState['statsSubject'].value.monthlySalesData?.length || 0;
    return count <= 1 ? 350 : 50 + index * (600 / (count - 1));
  }

  getChartPointY(val: number): number {
    const max = this.getMaxSales();
    return 140 - (val / max) * 110;
  }

  async onChartBarClick(data: MonthlySalesPoint) {
    const toast = await this.toastCtrl.create({
      message: `${data.label}: S/ ${data.sales.toFixed(2)} en ${this.ordersLabel(data.orders)}.`,
      duration: 2000,
      color: 'primary',
      position: 'bottom'
    });
    await toast.present();
  }

  chartPointLabel(data: MonthlySalesPoint): string {
    return `${data.label}: S/ ${data.sales.toFixed(2)}, ${this.ordersLabel(data.orders)}`;
  }

  ordersLabel(count: number): string {
    return `${count} ${count === 1 ? 'pedido' : 'pedidos'}`;
  }

  unitsSoldLabel(count: number): string {
    return `${count} ${count === 1 ? 'unidad vendida' : 'unidades vendidas'}`;
  }
}
