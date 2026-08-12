import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss'],
  standalone: false
})
export class AdminReportsComponent implements OnInit {
  reports: any[] = [];
  filteredReports: any[] = [];
  loading = true;
  searchTerm = '';
  activeTab: 'pending' | 'resolved' | 'rejected' = 'pending';
  
  isZoomModalOpen = false;
  zoomImageUrl = '';

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.loading = true;
    this.adminRepo.getReportedProducts().subscribe({
      next: (reports) => {
        this.reports = reports || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar reportes:', err);
        this.loading = false;
      }
    });
  }

  setFilterTab(tab: 'pending' | 'resolved' | 'rejected') {
    this.activeTab = tab;
    this.applyFilters();
  }

  applyFilters() {
    let result = this.reports.filter(r => (r.status || 'pending') === this.activeTab);

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.product?.name?.toLowerCase().includes(term)) ||
        (r.reason?.toLowerCase().includes(term)) ||
        (r.reporter?.full_name?.toLowerCase().includes(term))
      );
    }

    this.filteredReports = result;
  }

  openZoomModal(url: string) {
    this.zoomImageUrl = url;
    this.isZoomModalOpen = true;
  }

  extractStoragePath(url: string): string | null {
    if (!url) return null;
    const parts = url.split('/public/product-images/');
    if (parts.length > 1) {
      return parts[1];
    }
    return null;
  }

  async rejectReport(reportItem: any) {
    const alert = await this.alertCtrl.create({
      header: 'Rechazar Reporte',
      message: 'Ingresa una nota breve explicando por qué rechazas este reporte:',
      inputs: [
        {
          name: 'notes',
          type: 'text',
          placeholder: 'Ej. Falso reporte, el vendedor sí entregó...'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          handler: (data) => {
            const notes = data.notes?.trim() || 'Desestimado por moderación';
            const storagePath = reportItem.evidence_url ? this.extractStoragePath(reportItem.evidence_url) : undefined;
            
            this.adminRepo.updateReportStatus(reportItem.id, 'rejected', notes, storagePath || undefined).subscribe({
              next: () => {
                this.showToast('Reporte rechazado y desestimado correctamente.', 'success');
                this.loadReports();
              },
              error: (err) => {
                console.error(err);
                this.showToast('Error al rechazar el reporte.', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async acceptReport(reportItem: any, action: 'deactivate' | 'delete') {
    const headerTitle = action === 'deactivate' ? 'Aceptar y Ocultar' : 'Aceptar y Eliminar';
    const msg = action === 'deactivate' 
      ? 'Aceptas la denuncia. El producto se desactivará temporalmente del catálogo. Ingresa notas:' 
      : 'Aceptas la denuncia. El producto será borrado permanentemente. Ingresa notas:';

    const alert = await this.alertCtrl.create({
      header: headerTitle,
      message: msg,
      inputs: [
        {
          name: 'notes',
          type: 'text',
          placeholder: 'Ej. Confirmado producto vencido...'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: (data) => {
            const notes = data.notes?.trim() || 'Infracción confirmada por moderador';
            const storagePath = reportItem.evidence_url ? this.extractStoragePath(reportItem.evidence_url) : undefined;

            if (action === 'deactivate') {
              // Desactivar producto y cambiar estado reporte a resolved
              this.adminRepo.updateProductStatus(reportItem.product_id, false).subscribe({
                next: () => {
                  this.adminRepo.updateReportStatus(reportItem.id, 'resolved', notes, storagePath || undefined).subscribe({
                    next: () => {
                      this.showToast('Reporte resuelto y producto ocultado.', 'success');
                      this.loadReports();
                    }
                  });
                },
                error: () => this.showToast('Error al desactivar el producto.', 'danger')
              });
            } else {
              // Eliminar producto y cambiar estado reporte a resolved
              this.adminRepo.deleteProduct(reportItem.product_id).subscribe({
                next: () => {
                  this.adminRepo.updateReportStatus(reportItem.id, 'resolved', notes, storagePath || undefined).subscribe({
                    next: () => {
                      this.showToast('Reporte resuelto y producto eliminado permanentemente.', 'success');
                      this.loadReports();
                    }
                  });
                },
                error: () => this.showToast('Error al eliminar el producto.', 'danger')
              });
            }
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
