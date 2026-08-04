import { Injectable } from '@angular/core';
import { OrderRepository } from '../order.repository';
import { SupabaseClientService } from '../../database/supabase.client';
import { Order, OrderStatus } from '../../models/order.model';
import { from, Observable, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SupabaseOrderRepository implements OrderRepository {
  constructor(private supabaseService: SupabaseClientService) {}

  createOrder(sellerId: string, deliveryPlace: string, items: { product_id: string; quantity: number }[]): Observable<string> {
    // Invocamos la función almacenada create_order (RPC) de PostgreSQL
    const promise = this.supabaseService.client.rpc('create_order', {
      p_seller_id: sellerId,
      p_delivery_place: deliveryPlace,
      p_items: items
    });

    return from(promise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as string; // Retorna el UUID de la orden creada
      }),
      catchError(error => throwError(() => new Error(error.message)))
    );
  }

  getBuyerOrders(buyerId: string): Observable<Order[]> {
    const query = this.supabaseService.client
      .from('orders')
      .select('*, order_items(*, product:products(*, product_images(*))), seller:profiles(*)')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Order[];
      })
    );
  }

  getSellerOrders(sellerId: string): Observable<Order[]> {
    const query = this.supabaseService.client
      .from('orders')
      .select('*, order_items(*, product:products(*, product_images(*))), buyer:profiles(*)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Order[];
      })
    );
  }

  getOrderById(id: string): Observable<Order> {
    const query = this.supabaseService.client
      .from('orders')
      .select('*, order_items(*, product:products(*, product_images(*))), buyer:profiles(*), seller:profiles(*)')
      .eq('id', id)
      .single();

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Order;
      })
    );
  }

  updateOrderStatus(id: string, status: OrderStatus): Observable<Order> {
    const query = this.supabaseService.client
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return from(query).pipe(
      switchMap(response => {
        if (response.error) throw new Error(response.error.message);
        return this.getOrderById(id);
      })
    );
  }

  addReview(orderId: string, rating: number, comment: string, reviewerId: string, revieweeId: string): Observable<boolean> {
    const query = this.supabaseService.client
      .from('reviews')
      .insert({
        order_id: orderId,
        rating: rating,
        comment: comment,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId
      });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return true;
      })
    );
  }
}
