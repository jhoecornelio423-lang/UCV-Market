import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository, AdminDashboardStats } from '../../../../core/repositories/admin.repository';
import { SellerApplication } from '../../../../core/models/seller-application.model';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

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
  todayDate = new Date();

  ngOnInit() {
    this.loadStats();
    this.loadCharts();
    this.loadApplications();
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
}
