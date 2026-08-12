import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { SupportTicket } from '../../../../core/models/support-ticket.model';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-support',
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss'],
  standalone: false
})
export class AdminSupportComponent implements OnInit {
  tickets: SupportTicket[] = [];
  loading = true;

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading = true;
    this.adminRepo.getSupportTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar tickets:', err);
        this.loading = false;
      }
    });
  }

  async markAsResolved(ticket: SupportTicket) {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Resolver Ticket',
      message: `¿Deseas marcar el ticket de ${ticket.profiles?.full_name || 'este usuario'} como resuelto?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Resolver', 
          handler: () => {
            this.adminRepo.updateTicketStatus(ticket.id, 'resolved').subscribe({
              next: () => {
                this.showToast('Ticket resuelto exitosamente', 'success');
                this.loadTickets();
              },
              error: () => this.showToast('Error al actualizar el ticket', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
