import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Order, OrderStatus } from '../models/order.model';

export const ORDER_REPOSITORY = new InjectionToken<OrderRepository>('OrderRepository');

export interface OrderRepository {
  createOrder(sellerId: string, deliveryPlace: string, items: { product_id: string; quantity: number }[]): Observable<string>;
  getBuyerOrders(buyerId: string): Observable<Order[]>;
  getSellerOrders(sellerId: string): Observable<Order[]>;
  getOrderById(id: string): Observable<Order>;
  updateOrderStatus(id: string, status: OrderStatus): Observable<Order>;
  addReview(orderId: string, rating: number, comment: string, reviewerId: string, revieweeId: string): Observable<boolean>;
}
