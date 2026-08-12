import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository, AdminDashboardStats } from '../../../../core/repositories/admin.repository';
import { SellerApplication } from '../../../../core/models/seller-application.model';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  standalone: false
})
export class AdminDashboardComponent implements OnInit {
  stats: AdminDashboardStats = {
    totalUsers: 0,
    activeSellers: 0,
    publishedProducts: 0,
    totalRevenue: 0
  };
  
  pendingApplications: SellerApplication[] = [];
  reportedItems: any[] = [];
  
  // Weekly Sales Line Chart
  lineChartData: ChartConfiguration['data'] = {
    datasets: [],
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  };
  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.4 },
      point: { radius: 0 }
    },
    scales: {
      x: { grid: { display: false } },
      y: { border: { dash: [4, 4] }, grid: { color: '#f3f4f6' }, beginAtZero: true }
    },
    plugins: { legend: { display: false } }
  };
  lineChartType: 'line' = 'line';

  // Categories Doughnut Chart
  doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } },
    cutout: '65%'
  };
  doughnutChartType: 'doughnut' = 'doughnut';

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  todayDate = new Date();

  ngOnInit() {
    this.adjustChartOptions();
    this.loadStats();
    this.loadCharts();
    this.loadApplications();
    this.loadReports();
  }

  loadReports() {
    this.adminRepo.getReportedProducts().subscribe({
      next: (reports) => {
        this.reportedItems = reports || [];
      },
      error: (err) => {
        console.error('Error al cargar reportes:', err);
      }
    });
  }

  dismissReport(reportId: string) {
    this.adminRepo.dismissReport(reportId).subscribe({
      next: () => {
        this.loadReports();
      },
      error: (err) => {
        console.error('Error al descartar reporte:', err);
      }
    });
  }

  adjustChartOptions() {
    if (window.innerWidth < 768) {
      if (this.doughnutChartOptions && this.doughnutChartOptions.plugins && this.doughnutChartOptions.plugins.legend) {
        this.doughnutChartOptions.plugins.legend.position = 'bottom';
      }
    }
  }

  loadStats() {
    this.adminRepo.getDashboardStats().subscribe(stats => {
      this.stats = stats;
    });
  }

  loadCharts() {
    this.adminRepo.getWeeklySales().subscribe(sales => {
      this.lineChartData = {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        datasets: [
          {
            data: sales,
            label: 'Ingresos (S/)',
            borderColor: '#E8432D',
            backgroundColor: 'rgba(232, 67, 45, 0.1)',
            fill: true,
          }
        ]
      };
    });

    this.adminRepo.getSalesByCategory().subscribe(cats => {
      this.doughnutChartData = {
        labels: cats.map(c => c.label),
        datasets: [
          {
            data: cats.map(c => c.value),
            backgroundColor: ['#E8432D', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6'],
            borderWidth: 0
          }
        ]
      };
    });
  }

  loadApplications() {
    this.adminRepo.getPendingApplications().subscribe(apps => {
      this.pendingApplications = apps;
    });
  }

  async deactivateProduct(productId: string, productName: string) {
    const alert = await this.alertCtrl.create({
      header: 'Desactivar Producto',
      message: `¿Estás seguro de que deseas desactivar temporalmente el producto "${productName || 'este producto'}"? Dejará de ser visible en el catálogo.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          handler: () => {
            this.adminRepo.updateProductStatus(productId, false).subscribe({
              next: () => {
                this.showToast('Producto desactivado correctamente.', 'success');
                this.loadReports();
                this.loadStats();
              },
              error: () => this.showToast('Error al desactivar el producto.', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async confirmDeleteProduct(productId: string, productName: string, reportId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar Producto',
      message: `¿Estás seguro de que deseas eliminar permanentemente el producto "${productName || 'este producto'}"? Se borrará del catálogo y se cerrarán todos los reportes asociados.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.adminRepo.deleteProduct(productId).subscribe({
              next: () => {
                this.adminRepo.dismissReport(reportId).subscribe(() => {
                  this.showToast('Producto eliminado y reporte resuelto.', 'success');
                  this.loadReports();
                  this.loadStats();
                });
              },
              error: () => this.showToast('Error al eliminar el producto.', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
