import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { Profile } from '../../../../core/models/profile.model';
import { SellerApplication } from '../../../../core/models/seller-application.model';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-sellers',
  templateUrl: './admin-sellers.component.html',
  styleUrls: ['./admin-sellers.component.scss'],
  standalone: false
})
export class AdminSellersComponent implements OnInit {
  sellers: Profile[] = [];
  filteredSellers: Profile[] = [];
  applications: SellerApplication[] = [];
  
  loading = true;
  searchTerm = '';
  activeFilter: 'all' | 'pending' | 'active' | 'suspended' = 'all';

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    Promise.all([
      this.adminRepo.getSellers().toPromise(),
      this.adminRepo.getPendingApplications().toPromise()
    ]).then(([sellers, apps]) => {
      this.sellers = sellers || [];
      this.applications = apps || [];
      this.applyFilters();
      this.loading = false;
    }).catch(err => {
      console.error('Error al cargar datos:', err);
      this.loading = false;
    });
  }

  setFilter(filter: 'all' | 'pending' | 'active' | 'suspended') {
    this.activeFilter = filter;
    this.applyFilters();
  }

  applyFilters() {
    // Para simplificar, en este mockup usamos el role para saber si está activo o suspendido.
    // Asumiremos que role = 'emprendedor' es activo, y si tiene un ban, podríamos guardarlo.
    // Como el modelo de datos real no tiene campo status, usaremos un mock en el frontend.
    
    let result = [...this.sellers];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.full_name?.toLowerCase().includes(term)) ||
        (s.business_name?.toLowerCase().includes(term))
      );
    }

    if (this.activeFilter === 'active') {
      result = result.filter(s => s.role === 'emprendedor');
    } else if (this.activeFilter === 'suspended') {
      result = result.filter(s => s.role === 'suspended');
    } else if (this.activeFilter === 'pending') {
      result = []; // No sellers in table, only pending applications will be shown in the grid
    }
    
    this.filteredSellers = result;
  }

  async processApplication(app: SellerApplication, status: 'approved' | 'rejected') {
    const isApproving = status === 'approved';
    const alert = await this.alertCtrl.create({
      header: isApproving ? 'Aprobar Solicitud' : 'Rechazar Solicitud',
      message: `¿Estás seguro de que deseas ${isApproving ? 'aprobar' : 'rechazar'} a ${app.full_name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Confirmar', 
          handler: () => {
            this.adminRepo.updateApplicationStatus(app.id!, status, app.user_id!).then(() => {
              this.showToast(`Solicitud ${isApproving ? 'aprobada' : 'rechazada'}`);
              this.loadData();
            }).catch(() => this.showToast('Error al procesar solicitud', 'danger'));
          }
        }
      ]
    });
    await alert.present();
  }

  async toggleSellerStatus(seller: Profile) {
    const isBanning = seller.role === 'emprendedor';
    const newRole = isBanning ? 'suspended' : 'emprendedor';

    const alert = await this.alertCtrl.create({
      header: isBanning ? 'Suspender Vendedor' : 'Reactivar Vendedor',
      message: `¿Estás seguro de que deseas ${isBanning ? 'suspender' : 'reactivar'} a ${seller.full_name || 'este vendedor'}?`,
      inputs: isBanning ? [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Motivo de la suspensión (opcional)'
        }
      ] : [],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Confirmar', 
          handler: (data) => {
            const reason = isBanning ? data?.reason : null; // Clear reason if reactivating
            this.adminRepo.updateSellerRole(seller.id, newRole, reason).subscribe({
              next: () => {
                this.showToast(`Vendedor ${isBanning ? 'suspendido' : 'reactivado'} con éxito`);
                this.loadData();
              },
              error: (err) => {
                console.error(err);
                this.showToast('Error al actualizar el estado. Verifica tus permisos.', 'danger');
              }
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
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
