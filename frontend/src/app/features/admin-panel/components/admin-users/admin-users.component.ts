import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { Profile } from '../../../../core/models/profile.model';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
  standalone: false
})
export class AdminUsersComponent implements OnInit {
  users: Profile[] = [];
  filteredUsers: Profile[] = [];
  
  loading = true;
  searchTerm = '';
  activeFilter: 'all' | 'active' | 'suspended' = 'all';

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.adminRepo.getBuyers().subscribe({
      next: (users) => {
        this.users = users || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.loading = false;
      }
    });
  }

  setFilter(filter: 'all' | 'active' | 'suspended') {
    this.activeFilter = filter;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.users];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(u => 
        (u.full_name?.toLowerCase().includes(term)) ||
        (u.email?.toLowerCase().includes(term)) ||
        (u.student_code?.toLowerCase().includes(term))
      );
    }

    if (this.activeFilter === 'active') {
      result = result.filter(u => u.role === 'comprador');
    } else if (this.activeFilter === 'suspended') {
      result = result.filter(u => u.role === 'suspended_buyer');
    }
    
    this.filteredUsers = result;
  }

  async toggleUserStatus(user: Profile) {
    const isBanning = user.role === 'comprador';
    const newRole = isBanning ? 'suspended_buyer' : 'comprador';

    const alert = await this.alertCtrl.create({
      header: isBanning ? 'Suspender Usuario' : 'Reactivar Usuario',
      message: `¿Estás seguro de que deseas ${isBanning ? 'suspender' : 'reactivar'} al usuario ${user.full_name}?`,
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
            this.adminRepo.updateBuyerRole(user.id, newRole, reason).subscribe({
              next: () => {
                this.showToast(`Usuario ${isBanning ? 'suspendido' : 'reactivado'} con éxito`);
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
