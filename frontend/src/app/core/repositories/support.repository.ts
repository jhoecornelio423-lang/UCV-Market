import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseClientService } from '../database/supabase.client';
import { SupportTicket } from '../models/support-ticket.model';
import { SupportMessage, SupportThread } from '../models/support-message.model';
import { SupportEvent } from '../models/support-event.model';

/**
 * Repositorio del flujo de soporte del lado del usuario
 * (comprador y vendedor): crear tickets, ver los propios y
 * conversar con soporte en SU hilo (nunca con la otra parte).
 */
@Injectable({
  providedIn: 'root'
})
export class SupportRepository {
  private supabaseService = inject(SupabaseClientService);

  /**
   * Crea un ticket de soporte bajo el usuario autenticado
   * (la política RLS fuerza auth.uid() = user_id).
   */
  createTicket(subject: string, message: string, userId: string): Observable<SupportTicket> {
    return from(
      this.supabaseService.client
        .from('support_tickets')
        .insert({ subject, message, user_id: userId })
        .select('*')
        .single()
        .then(res => {
          if (res.error) throw res.error;
          return res.data as SupportTicket;
        })
    );
  }

  /**
   * Tickets del usuario: los que reportó (user_id) y los que lo
   * tienen vinculado como vendedor (seller_id).
   */
  getMyTickets(userId: string): Observable<SupportTicket[]> {
    return from(
      this.supabaseService.client
        .from('support_tickets')
        .select(`
          *,
          profiles:user_id(full_name, student_code, avatar_url),
          seller:profiles!seller_id(id, full_name, avatar_url),
          order:orders!order_id(order_code, total_price, created_at, status)
        `)
        .or(`user_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .then(res => {
          if (res.error) throw res.error;
          const rows = (res.data as SupportTicket[]) || [];
          // Defensa en profundidad: aunque el RLS del servidor estuviera
          // mal configurado, nunca se muestran tickets de terceros.
          return rows.filter(t => t.user_id === userId || t.seller_id === userId);
        })
    );
  }

  /**
   * Mensajes del hilo propio del usuario. Se filtra por thread para
   * garantizar que comprador y vendedor JAMÁS vean el hilo del otro,
   * incluso si la RLS fallara (defensa en profundidad).
   */
  getTicketMessages(ticketId: string, thread: SupportThread): Observable<SupportMessage[]> {
    return from(
      this.supabaseService.client
        .from('support_messages')
        .select('*, profiles:participant_id(full_name, avatar_url)')
        .eq('ticket_id', ticketId)
        .eq('thread', thread)
        .order('created_at', { ascending: true })
        .then(res => {
          if (res.error) throw res.error;
          return (res.data as SupportMessage[]) || [];
        })
    );
  }

  /**
   * Eventos del historial de la disputa.
   */
  getTicketEvents(ticketId: string): Observable<SupportEvent[]> {
    return from(
      this.supabaseService.client
        .from('support_events')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .then(res => {
          if (res.error) throw res.error;
          return (res.data as SupportEvent[]) || [];
        })
    );
  }

  /**
   * Envía un mensaje en el hilo propio del usuario (buyer o seller).
   * El rol de remitente se deduce del hilo.
   */
  sendMessage(ticketId: string, userId: string, thread: SupportThread, body: string): Observable<SupportMessage> {
    const senderRole = thread === 'buyer' ? 'buyer' : 'seller';
    return from(
      this.supabaseService.client
        .from('support_messages')
        .insert({ ticket_id: ticketId, participant_id: userId, sender_role: senderRole, thread, body })
        .select()
        .single()
        .then(res => {
          if (res.error) throw res.error;
          return res.data as SupportMessage;
        })
    );
  }
}
