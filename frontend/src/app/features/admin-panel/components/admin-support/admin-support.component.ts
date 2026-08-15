import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { SupportTicket } from '../../../../core/models/support-ticket.model';
import { SupportMessage } from '../../../../core/models/support-message.model';
import { SupportEvent } from '../../../../core/models/support-event.model';
import { Profile } from '../../../../core/models/profile.model';
import { SupabaseClientService } from '../../../../core/database/supabase.client';

interface TimelineItem {
  kind: 'message' | 'event';
  id: string;
  body?: string;
  sender_role?: string;
  participant_id?: string | null;
  created_at: string;
  description?: string;
  event_type?: string;
  profiles?: { full_name?: string; avatar_url?: string };
}

@Component({
  selector: 'app-admin-support',
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss'],
  standalone: false
})
export class AdminSupportComponent implements OnInit, OnDestroy {
  tickets: SupportTicket[] = [];
  loading = true;
  selectedTicket: SupportTicket | null = null;
  selectedThread: 'buyer' | 'seller' = 'buyer';
  loadingThread = false;
  newMessage = '';
  timeline: TimelineItem[] = [];
  sellers: Profile[] = [];
  orders: any[] = [];
  sellersLoaded = false;
  ordersLoaded = false;
  searchTerm = '';
  statusFilter: 'all' | 'open' | 'resolved' = 'all';

  readonly filterOptions: { value: 'all' | 'open' | 'resolved'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abiertas' },
    { value: 'resolved', label: 'Resueltas' }
  ];

  get filteredTickets(): SupportTicket[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.tickets.filter(t => {
      const matchesStatus =
        this.statusFilter === 'all'
          ? true
          : this.statusFilter === 'open'
            ? !['resolved', 'rejected', 'closed'].includes(t.status)
            : ['resolved', 'closed'].includes(t.status);
      if (!matchesStatus) return false;
      if (!term) return true;
      return (
        (t.subject || '').toLowerCase().includes(term) ||
        (t.ticket_code || '').toLowerCase().includes(term) ||
        (t.profiles?.full_name || '').toLowerCase().includes(term) ||
        (t.seller?.full_name || '').toLowerCase().includes(term) ||
        (t.order?.order_code || '').toLowerCase().includes(term) ||
        (t.message || '').toLowerCase().includes(term)
      );
    });
  }

  private channels: any[] = [];

  private adminRepo = inject(AdminRepository);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private supabaseService = inject(SupabaseClientService);

  @ViewChild('threadScroll') threadScroll?: ElementRef<HTMLElement>;

  readonly statusOptions = [
    { value: 'open', label: 'Abierto' },
    { value: 'in_progress', label: 'En progreso' },
    { value: 'in_review', label: 'En revisión' },
    { value: 'waiting_buyer', label: 'Esperando comprador' },
    { value: 'waiting_seller', label: 'Esperando vendedor' },
    { value: 'evidence_received', label: 'Evidencias recibidas' },
    { value: 'resolved', label: 'Resuelto' },
    { value: 'rejected', label: 'Desestimada' },
    { value: 'closed', label: 'Cerrado' }
  ];

  readonly priorityOptions = [
    { value: 'medio', label: 'Medio' },
    { value: 'alto', label: 'Alto' },
    { value: 'critico', label: 'Crítico' }
  ];

  get openCount(): number {
    return this.tickets.filter(t => !['resolved', 'rejected', 'closed'].includes(t.status)).length;
  }

  get canWrite(): boolean {
    return !!this.selectedTicket && this.selectedTicket.status !== 'closed' && this.selectedTicket.status !== 'rejected';
  }

  ngOnInit() {
    this.loadTickets();
    this.setupNewTicketsRealtime();
  }

  ngOnDestroy() {
    this.removeChannels();
  }

  loadTickets() {
    this.loading = true;
    this.adminRepo.getSupportTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.loading = false;
        if (this.selectedTicket) {
          const fresh = tickets.find(t => t.id === this.selectedTicket!.id);
          if (fresh) this.selectedTicket = fresh;
        }
      },
      error: (err) => {
        console.error('Error al cargar tickets:', err);
        this.loading = false;
        this.showToast('Error al cargar los tickets', 'danger');
      }
    });
  }

  async selectTicket(ticket: SupportTicket) {
    this.selectedTicket = ticket;
    this.selectedThread = 'buyer';
    this.loadThread();
  }

  async setThread(thread: 'buyer' | 'seller') {
    if (!this.selectedTicket || thread === this.selectedThread) return;
    if (thread === 'seller' && !this.selectedTicket.seller_id) {
      this.showToast('Primero vincula el vendedor de la disputa', 'warning');
      return;
    }
    this.selectedThread = thread;
    this.loadThread();
  }

  loadThread() {
    if (!this.selectedTicket) return;
    const ticket = this.selectedTicket;
    this.loadingThread = true;
    this.timeline = [];
    this.removeChannels();

    forkJoin({
      messages: this.adminRepo.getTicketMessages(ticket.id, this.selectedThread),
      events: this.adminRepo.getTicketEvents(ticket.id)
    }).subscribe({
      next: ({ messages, events }) => {
        this.buildTimeline(messages, events);
        this.loadingThread = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error al cargar la conversación:', err);
        this.loadingThread = false;
        this.showToast('Error al cargar la conversación', 'danger');
      }
    });

    this.setupThreadRealtime(ticket.id);
  }

  private buildTimeline(messages: SupportMessage[], events: SupportEvent[]) {
    const merged: TimelineItem[] = [
      ...events.map(e => ({ kind: 'event' as const, id: e.id, description: e.description, event_type: e.event_type, created_at: e.created_at })),
      ...messages.map(m => ({
        kind: 'message' as const,
        id: m.id,
        body: m.body,
        sender_role: m.sender_role,
        participant_id: m.participant_id,
        created_at: m.created_at,
        profiles: m.profiles
      }))
    ];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    this.timeline = merged;
  }

  private setupThreadRealtime(ticketId: string) {
    const thread = this.selectedThread;
    const msgChannel = this.supabaseService.client
      .channel(`support-thread-msgs-${ticketId}-${thread}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        () => this.loadThread()
      )
      .subscribe();
    this.channels.push(msgChannel);

    const evtChannel = this.supabaseService.client
      .channel(`support-thread-evts-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_events', filter: `ticket_id=eq.${ticketId}` },
        () => this.loadThread()
      )
      .subscribe();
    this.channels.push(evtChannel);
  }

  private setupNewTicketsRealtime() {
    const channel = this.supabaseService.client
      .channel('admin-support-tickets')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets' },
        () => this.loadTickets()
      )
      .subscribe();
    this.channels.push(channel);
  }

  sendMessage() {
    if (!this.selectedTicket) return;
    const body = this.newMessage.trim();
    if (!body) return;
    const ticket = this.selectedTicket;
    const recipientId = this.selectedThread === 'buyer' ? ticket.user_id : ticket.seller_id;
    if (!recipientId) {
      this.showToast('No hay participante vinculado en este hilo', 'warning');
      return;
    }
    this.adminRepo.sendAdminMessage(ticket.id, this.selectedThread, recipientId, body).subscribe({
      next: () => {
        this.newMessage = '';
        this.loadThread();
      },
      error: () => this.showToast('Error al enviar el mensaje', 'danger')
    });
  }

  onStatusChange(status: string) {
    if (!this.selectedTicket) return;
    const ticket = this.selectedTicket;
    this.adminRepo.updateTicketStatus(ticket.id, status).subscribe({
      next: () => this.loadTickets(),
      error: () => this.showToast('Error al cambiar el estado', 'danger')
    });
  }

  onPriorityChange(priority: string) {
    if (!this.selectedTicket) return;
    const ticket = this.selectedTicket;
    this.adminRepo.setTicketPriority(ticket.id, priority).subscribe({
      next: () => this.loadTickets(),
      error: () => this.showToast('Error al cambiar la prioridad', 'danger')
    });
  }

  async linkSeller() {
    if (!this.selectedTicket) return;
    await this.ensureSellers();
    if (this.sellers.length === 0) {
      this.showToast('No hay vendedores para vincular', 'warning');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Vincular vendedor',
      subHeader: this.selectedTicket.subject,
      inputs: this.sellers.map(s => ({
        name: 'seller',
        type: 'radio' as const,
        label: s.full_name,
        value: s.id
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Vincular',
          handler: (value: string) => {
            if (!value) return false;
            this.adminRepo.linkSeller(this.selectedTicket!.id, value).subscribe({
              next: () => {
                this.showToast('Vendedor vinculado', 'success');
                this.loadTickets();
                this.loadThread();
              },
              error: () => this.showToast('Error al vincular vendedor', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async linkOrder() {
    if (!this.selectedTicket) return;
    await this.ensureOrders();
    if (this.orders.length === 0) {
      this.showToast('No hay pedidos para vincular', 'warning');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Vincular pedido',
      subHeader: this.selectedTicket.subject,
      inputs: this.orders.map(o => ({
        name: 'order',
        type: 'radio' as const,
        label: `${o.order_code || this.shortId(o.id)} · S/ ${Number(o.total_price).toFixed(2)} · ${o.seller?.full_name || ''}`,
        value: o.id
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Vincular',
          handler: (value: string) => {
            if (!value) return false;
            this.adminRepo.linkOrder(this.selectedTicket!.id, value).subscribe({
              next: () => {
                this.showToast('Pedido vinculado', 'success');
                this.loadTickets();
                this.loadThread();
              },
              error: () => this.showToast('Error al vincular pedido', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async dismissTicket() {
    if (!this.selectedTicket) return;
    const alert = await this.alertCtrl.create({
      header: 'Desestimar reporte',
      message: '¿Confirma que esta disputa no procede? Se cerrará como desestimada.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desestimar',
          cssClass: 'danger',
          handler: () => {
            this.adminRepo.dismissTicket(this.selectedTicket!.id).subscribe({
              next: () => {
                this.showToast('Disputa desestimada', 'success');
                this.loadTickets();
                this.loadThread();
              },
              error: () => this.showToast('Error al desestimar', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async warnSeller() {
    const ticket = this.selectedTicket;
    if (!ticket || !ticket.seller_id) return;
    const alert = await this.alertCtrl.create({
      header: 'Advertir al emprendedor',
      subHeader: ticket.seller?.full_name || 'Vendedor',
      inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Motivo de la advertencia...' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Emitir advertencia',
          handler: (data: any) => {
            const reason = (data?.reason || '').trim();
            if (!reason) return false;
            this.adminRepo.warnSeller(ticket.id, ticket.seller_id!, reason).subscribe({
              next: () => {
                this.showToast('Advertencia emitida', 'success');
                this.loadThread();
              },
              error: () => this.showToast('Error al emitir advertencia', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async banSeller() {
    const ticket = this.selectedTicket;
    if (!ticket || !ticket.seller_id) return;
    const alert = await this.alertCtrl.create({
      header: 'Banear emprendedor',
      subHeader: ticket.seller?.full_name || 'Vendedor',
      message: '⚠️ Esta acción bloquea la cuenta del vendedor y oculta todos sus productos. ¿Estás seguro?',
      inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Motivo del baneo...' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Banear',
          cssClass: 'danger',
          handler: (data: any) => {
            const reason = (data?.reason || '').trim() || 'Infracción grave';
            this.adminRepo.banSeller(ticket.id, ticket.seller_id!, reason).subscribe({
              next: () => {
                this.showToast('Emprendedor baneado', 'success');
                this.loadTickets();
                this.loadThread();
              },
              error: () => this.showToast('Error al banear', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async ensureSellers() {
    if (this.sellersLoaded) return;
    this.sellers = await new Promise<Profile[]>((resolve, reject) => {
      this.adminRepo.getSellers().subscribe({ next: resolve, error: reject });
    });
    this.sellersLoaded = true;
  }

  private async ensureOrders() {
    if (this.ordersLoaded) return;
    this.orders = await new Promise<any[]>((resolve, reject) => {
      this.adminRepo.getOrdersForLinking().subscribe({ next: resolve, error: reject });
    });
    this.ordersLoaded = true;
  }

  private removeChannels() {
    this.channels.forEach(ch => {
      try {
        this.supabaseService.client.removeChannel(ch);
      } catch (e) {
        console.error('Error al remover canal realtime', e);
      }
    });
    this.channels = [];
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.threadScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
  }

  senderName(item: TimelineItem): string {
    if (item.sender_role === 'admin') return 'Equipo de Soporte';
    if (item.profiles?.full_name) return item.profiles.full_name;
    return 'Participante';
  }

  initials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  statusLabel(status: string): string {
    const s = this.statusOptions.find(o => o.value === status);
    return s ? s.label : status;
  }

  priorityLabel(priority?: string): string {
    const p = this.priorityOptions.find(o => o.value === priority);
    return p ? p.label : 'Medio';
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  shortId(id?: string): string {
    return id ? id.slice(0, 8).toUpperCase() : '';
  }
}
