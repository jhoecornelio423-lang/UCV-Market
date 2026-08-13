import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss'],
  standalone: false
})
export class AdminReportsComponent implements OnInit, OnDestroy {
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
  private supabaseService = inject(SupabaseClientService);

  private realtimeChannel: any = null;

  ngOnInit() {
    this.loadReports();

    // Reportes en tiempo real: recargar ante cualquier cambio
    this.realtimeChannel = this.supabaseService.client
      .channel('admin-reports-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_reports' },
        () => {
          this.loadReports();
        }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabaseService.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
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

            const finalizeReport = () => {
              this.adminRepo.updateReportStatus(reportItem.id, 'resolved', notes, storagePath || undefined).subscribe({
                next: () => {
                  this.showToast('Reporte resuelto y producto procesado correctamente.', 'success');
                  this.loadReports();
                },
                error: (err) => {
                  console.error('Error al actualizar el estado del reporte:', err);
                  this.showToast('El producto se procesó, pero no se pudo actualizar el estado del reporte.', 'warning');
                  this.loadReports();
                }
              });
            };

            if (action === 'deactivate') {
              this.adminRepo.updateProductStatus(reportItem.product_id, false).subscribe({
                next: () => finalizeReport(),
                error: (err) => {
                  console.error('Error al desactivar el producto:', err);
                  this.showToast('Error al ocultar el producto. Verifica tus permisos de administrador.', 'danger');
                }
              });
            } else {
              this.adminRepo.deleteProduct(reportItem.product_id).subscribe({
                next: () => finalizeReport(),
                error: (err) => {
                  console.error('Error al eliminar el producto:', err);
                  this.showToast('Error al eliminar el producto. Verifica tus permisos de administrador.', 'danger');
                }
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
