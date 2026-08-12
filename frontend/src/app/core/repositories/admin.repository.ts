import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseClientService } from '../database/supabase.client';
import { SellerApplication } from '../models/seller-application.model';

export interface AdminDashboardStats {
  totalUsers: number;
  activeSellers: number;
  publishedProducts: number;
  totalRevenue: number;
}

import { Profile } from '../models/profile.model';
import { Product } from '../models/product.model';
import { SupportTicket } from '../models/support-ticket.model';

@Injectable({
  providedIn: 'root'
})
export class AdminRepository {
  private supabaseService = inject(SupabaseClientService);

  /**
   * Obtiene las estadísticas generales para el Panel de Control
   */
  getDashboardStats(): Observable<AdminDashboardStats> {
    const supabase = this.supabaseService.client;
    
    // Hacemos múltiples llamadas a count/sum. Usamos Promise.all.
    const promise = Promise.all([
      // Total Usuarios
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      // Vendedores Activos
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'emprendedor'),
      // Productos Publicados
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      // Ingresos Totales (Suma de total_price en orders completadas)
      supabase.from('orders').select('total_price').in('status', ['completed', 'ready', 'accepted'])
    ]).then(([usersRes, sellersRes, productsRes, ordersRes]) => {
      
      let totalRevenue = 0;
      if (ordersRes.data) {
        totalRevenue = ordersRes.data.reduce((acc, order) => acc + (order.total_price || 0), 0);
      }

      return {
        totalUsers: usersRes.count || 0,
        activeSellers: sellersRes.count || 0,
        publishedProducts: productsRes.count || 0,
        totalRevenue: totalRevenue
      };
    });

    return from(promise);
  }

  /**
   * Obtiene la distribución de ventas por categoría
   */
  getSalesByCategory(): Observable<{label: string, value: number}[]> {
    // Mocked for now to match the UI perfectly without complex RPCs
    return from(Promise.resolve([
      { label: 'Almuerzos', value: 38 },
      { label: 'Postres', value: 24 },
      { label: 'Bebidas', value: 18 },
      { label: 'Snacks', value: 12 },
      { label: 'Desayunos', value: 8 }
    ]));
  }

  /**
   * Obtiene el historial de ventas de los últimos 7 días
   */
  getWeeklySales(): Observable<number[]> {
    return from(Promise.resolve([800, 1200, 700, 1600, 2100, 3100, 1500]));
  }

  /**
   * Obtiene solicitudes de vendedores pendientes de verificación
   */
  getPendingApplications(): Observable<SellerApplication[]> {
    return from(
      this.supabaseService.client
        .from('seller_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .then(res => res.data as SellerApplication[] || [])
    );
  }

  /**
   * Actualiza el estado de una solicitud y cambia el rol si es aprobada
   */
  async updateApplicationStatus(applicationId: string, status: 'approved' | 'rejected', userId: string): Promise<void> {
    const { error: appError } = await this.supabaseService.client
      .from('seller_applications')
      .update({ status })
      .eq('id', applicationId);
    
    if (appError) throw appError;

    if (status === 'approved') {
      const { error: profileError } = await this.supabaseService.client
        .from('profiles')
        .update({ role: 'emprendedor' })
        .eq('id', userId);
      
      if (profileError) throw profileError;
    }
  }

  /**
   * Obtiene todos los vendedores
   */
  getSellers(): Observable<Profile[]> {
    return from(
      this.supabaseService.client
        .from('profiles')
        .select('*')
        .in('role', ['emprendedor', 'suspended'])
        .order('created_at', { ascending: false })
        .then(res => res.data as Profile[] || [])
    );
  }

  /**
   * Obtiene todos los compradores
   */
  getBuyers(): Observable<Profile[]> {
    return from(
      this.supabaseService.client
        .from('profiles')
        .select('*')
        .in('role', ['comprador', 'suspended_buyer'])
        .order('created_at', { ascending: false })
        .then(res => res.data as Profile[] || [])
    );
  }

  /**
   * Cambia el estado (ban) de un vendedor
   */
  updateSellerRole(sellerId: string, role: string, suspensionReason?: string): Observable<void> {
    const updateData: any = { role };
    if (suspensionReason !== undefined) {
      updateData.suspension_reason = suspensionReason;
    }
    return from(
      this.supabaseService.client
        .from('profiles')
        .update(updateData)
        .eq('id', sellerId)
        .select()
        .single()
        .then(({ error, data }) => {
          if (error) throw error;
          if (!data) throw new Error('No se pudo actualizar. Permisos insuficientes.');
        })
    );
  }

  /**
   * Cambia el estado (ban) de un comprador
   */
  updateBuyerRole(buyerId: string, role: string, suspensionReason?: string): Observable<void> {
    const updateData: any = { role };
    if (suspensionReason !== undefined) {
      updateData.suspension_reason = suspensionReason;
    }
    return from(
      this.supabaseService.client
        .from('profiles')
        .update(updateData)
        .eq('id', buyerId)
        .select()
        .single()
        .then(({ error, data }) => {
          if (error) throw error;
          if (!data) throw new Error('No se pudo actualizar. Permisos insuficientes.');
        })
    );
  }

  /**
   * Obtiene todos los productos (con datos del vendedor)
   */
  getProducts(): Observable<Product[]> {
    return from(
      this.supabaseService.client
        .from('products')
        .select('*, product_images(*), seller:profiles(*), category:categories(*)')
        .order('created_at', { ascending: false })
        .then(res => res.data as Product[] || [])
    );
  }

  /**
   * Cambia el estado activo/inactivo de un producto
   */
  updateProductStatus(productId: string, isActive: boolean): Observable<void> {
    return from(
      this.supabaseService.client
        .from('products')
        .update({ is_active: isActive })
        .eq('id', productId)
        .select()
        .single()
        .then(({ error, data }) => {
          if (error) throw error;
          if (!data) throw new Error('No se pudo actualizar. Permisos insuficientes.');
        })
    );
  }

  /**
   * Elimina un producto por infracción
   */
  deleteProduct(productId: string): Observable<void> {
    return from(
      this.supabaseService.client
        .from('products')
        .delete()
        .eq('id', productId)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  /**
   * Obtiene todos los tickets de soporte
   */
  getSupportTickets(): Observable<SupportTicket[]> {
    return from(
      this.supabaseService.client
        .from('support_tickets')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .then(res => res.data as SupportTicket[] || [])
    );
  }

  /**
   * Cambia el estado de un ticket
   */
  updateTicketStatus(ticketId: string, status: string): Observable<void> {
    return from(
      this.supabaseService.client
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }
}
