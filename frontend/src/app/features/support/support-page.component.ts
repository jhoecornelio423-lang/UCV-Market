import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { SupportRepository } from '../../core/repositories/support.repository';
import { SupportTicket } from '../../core/models/support-ticket.model';
import { SupportMessage, SupportThread } from '../../core/models/support-message.model';
import { SupportEvent } from '../../core/models/support-event.model';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseClientService } from '../../core/database/supabase.client';

interface TimelineItem {
  kind: 'message' | 'event';
  id: string;
  body?: string;
  sender_role?: string;
  created_at: string;
  description?: string;
  event_type?: string;
  profiles?: { full_name?: string; avatar_url?: string };
}

interface HelpCategory {
  value: string;
  label: string;
  icon: string;
  placeholder: string;
  hint: string;
}

@Component({
  selector: 'app-support-page',
  templateUrl: './support-page.component.html',
  styleUrls: ['./support-page.component.scss'],
  standalone: false
})
export class SupportPageComponent implements OnInit, OnDestroy {
  tickets: SupportTicket[] = [];
  loading = true;

  selectedTicket: SupportTicket | null = null;
  selectedThread: SupportThread = 'buyer';
  myThread: SupportThread = 'buyer';
  loadingThread = false;
  timeline: TimelineItem[] = [];
  newMessage = '';

  private channels: any[] = [];

  private supportRepo = inject(SupportRepository);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private supabaseService = inject(SupabaseClientService);

  @ViewChild('threadScroll') threadScroll?: ElementRef<HTMLElement>;

  get userId(): string | null {
    return this.authService.currentProfileValue?.id || null;
  }

  get backHref(): string {
    return this.router.url.startsWith('/seller')
      ? '/seller/business'
      : '/buyer-panel/profile';
  }

  get isSeller(): boolean {
    return this.router.url.startsWith('/seller');
  }

  readonly helpCategories: HelpCategory[] = [
    {
      value: 'problema_pedido',
      label: 'Problema con un pedido',
      icon: 'receipt-outline',
      placeholder: 'Ej. El pedido llegó incompleto, no me lo quisieron entregar...',
      hint: 'Indica el código del pedido (TXN-XXXX) si lo tienes a la mano.'
    },
    {
      value: 'disputa',
      label: 'Disputa con la otra parte',
      icon: 'alert-circle-outline',
      placeholder: 'Ej. Hubo un desacuerdo con el vendedor/comprador sobre el pedido...',
      hint: 'Un mediador revisará la conversación de tu pedido.'
    },
    {
      value: 'cuenta',
      label: 'Problema con mi cuenta',
      icon: 'person-circle-outline',
      placeholder: 'Ej. No puedo iniciar sesión, cambio de datos...',
      hint: 'Te ayudaremos con tu cuenta y perfil.'
    },
    {
      value: 'otro',
      label: 'Otra consulta',
      icon: 'help-buoy-outline',
      placeholder: 'Cuéntanos en qué podemos ayudarte...',
      hint: 'Describe tu consulta con el mayor detalle posible.'
    }
  ];

  get canWrite(): boolean {
    return !!this.selectedTicket && this.selectedTicket.status !== 'closed' && this.selectedTicket.status !== 'rejected';
  }

  ngOnInit() {
    this.loadTickets();
  }

  ngOnDestroy() {
    this.removeChannels();
  }

  loadTickets() {
    if (!this.userId) return;
    this.loading = true;
    this.supportRepo.getMyTickets(this.userId).subscribe({
      next: tickets => {
        this.tickets = tickets;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar tickets:', err);
        this.loading = false;
      }
    });
  }

  openConversation(ticket: SupportTicket) {
    if (!this.userId) return;
    this.selectedTicket = ticket;
    this.myThread = this.userId === ticket.user_id ? 'buyer' : 'seller';
    this.selectedThread = this.myThread;
    this.loadThread();
  }

  backToList() {
    this.selectedTicket = null;
    this.timeline = [];
    this.newMessage = '';
    this.removeChannels();
    this.loadTickets();
  }

  loadThread() {
    if (!this.selectedTicket || !this.userId) return;
    const ticket = this.selectedTicket;
    this.loadingThread = true;
    this.timeline = [];
    this.removeChannels();

    forkJoin({
      messages: this.supportRepo.getTicketMessages(ticket.id, this.myThread),
      events: this.supportRepo.getTicketEvents(ticket.id)
    }).subscribe({
      next: ({ messages, events }) => {
        // Defensa en profundidad: el usuario solo ve sus propios mensajes
        // y las respuestas del admin en su hilo, nunca los de la otra parte.
        const visible = messages.filter(
          m => m.sender_role === 'admin' || m.participant_id === this.userId
        );
        this.buildTimeline(visible, events);
        this.loadingThread = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error al cargar la conversación:', err);
        this.loadingThread = false;
      }
    });

    this.setupThreadRealtime(ticket.id);
  }

  private buildTimeline(messages: SupportMessage[], events: SupportEvent[]) {
    const merged: TimelineItem[] = [
      ...events.map(e => ({
        kind: 'event' as const,
        id: e.id,
        description: e.description,
        event_type: e.event_type,
        created_at: e.created_at
      })),
      ...messages.map(m => ({
        kind: 'message' as const,
        id: m.id,
        body: m.body,
        sender_role: m.sender_role,
        created_at: m.created_at,
        profiles: m.profiles
      }))
    ];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    this.timeline = merged;
  }

  private setupThreadRealtime(ticketId: string) {
    const msgChannel = this.supabaseService.client
      .channel(`user-thread-msgs-${ticketId}-${this.myThread}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        () => this.loadThread()
      )
      .subscribe();
    this.channels.push(msgChannel);

    const evtChannel = this.supabaseService.client
      .channel(`user-thread-evts-${ticketId}-${this.myThread}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_events', filter: `ticket_id=eq.${ticketId}` },
        () => this.loadThread()
      )
      .subscribe();
    this.channels.push(evtChannel);
  }

  sendMessage() {
    if (!this.selectedTicket || !this.userId) return;
    const body = this.newMessage.trim();
    if (!body) return;
    this.supportRepo.sendMessage(this.selectedTicket.id, this.userId, this.myThread, body).subscribe({
      next: () => {
        this.newMessage = '';
        this.loadThread();
      },
      error: () => this.showToast('Error al enviar el mensaje', 'danger')
    });
  }

  showNewTicketForm = false;
  newTicketCategory = 'problema_pedido';
  newTicketSubject = '';
  newTicketMessage = '';

  get selectedCategory(): HelpCategory {
    return this.helpCategories.find(c => c.value === this.newTicketCategory) || this.helpCategories[0];
  }

  toggleNewTicketForm() {
    this.showNewTicketForm = !this.showNewTicketForm;
    if (this.showNewTicketForm) {
      this.newTicketCategory = this.isSeller ? 'disputa' : 'problema_pedido';
    }
  }

  chooseCategory(value: string) {
    this.newTicketCategory = value;
    this.newTicketSubject = '';
    this.newTicketMessage = '';
  }

  submitNewTicket() {
    const subject = this.newTicketSubject.trim();
    const message = this.newTicketMessage.trim();
    if (!subject || !message) {
      this.showToast('Completa el asunto y el mensaje', 'danger');
      return;
    }

    const loading = this.loadingCtrl.create({
      message: 'Enviando ticket...',
      spinner: 'crescent'
    });
    loading.then(l => l.present());

    const userId = this.authService.currentProfileValue?.id;
    if (!userId) {
      this.showToast('No se pudo identificar tu usuario. Vuelve a iniciar sesión.', 'danger');
      return;
    }

    this.supportRepo.createTicket(subject, message, userId).subscribe({
      next: () => {
        this.showToast('Ticket enviado. Te responderemos pronto.', 'success');
        this.showNewTicketForm = false;
        this.newTicketSubject = '';
        this.newTicketMessage = '';
        this.loadTickets();
      },
      error: (err) => {
        console.error('Error al crear ticket:', err);
        this.showToast('Error al enviar el ticket', 'danger');
      }
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'open': return 'Abierto';
      case 'in_progress': return 'En progreso';
      case 'in_review': return 'En revisión';
      case 'waiting_buyer': return 'Esperando tu respuesta';
      case 'waiting_seller': return 'Esperando respuesta';
      case 'evidence_received': return 'Evidencias recibidas';
      case 'resolved': return 'Resuelto';
      case 'rejected': return 'Desestimada';
      case 'closed': return 'Cerrado';
      default: return status;
    }
  }

  priorityLabel(priority?: string): string {
    switch (priority) {
      case 'alto': return 'Alto';
      case 'critico': return 'Crítico';
      default: return 'Medio';
    }
  }

  senderName(item: TimelineItem): string {
    if (item.sender_role === 'admin') return 'Equipo de Soporte';
    if (item.profiles?.full_name) return item.profiles.full_name;
    return 'Tú';
  }

  initials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  authName(): string {
    return this.authService.currentProfileValue?.full_name || 'Tú';
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
