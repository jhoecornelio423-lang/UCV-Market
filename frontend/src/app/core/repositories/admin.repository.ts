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
    const promise = this.supabaseService.client
      .from('order_items')
      .select('quantity, price_at_sale, order:orders!inner(status), product:products!inner(category:categories!inner(name))')
      .in('order.status', ['completed', 'ready', 'accepted'])
      .then(res => {
        if (res.error) throw res.error;
        const data = res.data || [];
        const map = new Map<string, number>();
        data.forEach((item: any) => {
          const catName = item.product?.category?.name || 'Otros';
          const total = (item.price_at_sale || 0) * (item.quantity || 1);
          map.set(catName, (map.get(catName) || 0) + total);
        });
        
        const result = Array.from(map.entries()).map(([label, value]) => ({
          label,
          value: Math.round(value)
        }));
        
        if (result.length === 0) {
          return [
            { label: 'Almuerzos', value: 0 },
            { label: 'Postres', value: 0 },
            { label: 'Bebidas', value: 0 },
            { label: 'Snacks', value: 0 }
          ];
        }
        return result;
      });
      
    return from(promise);
  }

  /**
   * Obtiene el historial de ventas de los últimos 7 días
   */
  getWeeklySales(): Observable<number[]> {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const promise = this.supabaseService.client
      .from('orders')
      .select('total_price, created_at')
      .in('status', ['completed', 'ready', 'accepted'])
      .gte('created_at', sevenDaysAgo.toISOString())
      .then(res => {
        if (res.error) throw res.error;
        const data = res.data || [];
        
        // Creamos un arreglo de 7 elementos inicializado en 0 (Lunes a Domingo)
        const salesByDay = Array(7).fill(0);
        
        // Mapeo del día de la semana (donde Lunes = 0, ..., Domingo = 6)
        const dayIndices = [1, 2, 3, 4, 5, 6, 0]; // Monday = 1, Sunday = 0
        
        data.forEach(order => {
          const date = new Date(order.created_at);
          const day = date.getDay(); // 0 (Domingo) al 6 (Sábado)
          const chartIdx = dayIndices.indexOf(day);
          if (chartIdx !== -1) {
            salesByDay[chartIdx] += Number(order.total_price || 0);
          }
        });
        
        return salesByDay.map(s => Math.round(s));
      });
      
    return from(promise);
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

  /**
   * Obtiene la lista de productos reportados
   */
  getReportedProducts(): Observable<any[]> {
    const promise = this.supabaseService.client
      .from('product_reports')
      .select('*, product:products!product_id(*, product_images(*), seller:profiles!seller_id(*)), reporter:profiles!reporter_id(full_name, phone)')
      .order('created_at', { ascending: false })
      .then(res => {
        if (res.error) throw res.error;
        return res.data || [];
      });
    return from(promise);
  }

  /**
   * Descarta un reporte de producto (eliminándolo)
   */
  dismissReport(reportId: string): Observable<void> {
    return from(
      this.supabaseService.client
        .from('product_reports')
        .delete()
        .eq('id', reportId)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  /**
   * Actualiza el estado de un reporte de producto, opcionalmente eliminando la evidencia de storage
   */
  updateReportStatus(reportId: string, status: 'resolved' | 'rejected', notes?: string, deleteFilePath?: string): Observable<void> {
    const promise = this.supabaseService.client
      .from('product_reports')
      .update({ status, moderator_notes: notes || null })
      .eq('id', reportId)
      .then(async ({ error }) => {
        if (error) throw error;
        if (deleteFilePath) {
          await this.supabaseService.client.storage
            .from('product-images')
            .remove([deleteFilePath]);
        }
      });
    return from(promise);
  }
}
