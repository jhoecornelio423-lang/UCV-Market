import { Profile } from './profile.model';
import { Product } from './product.model';

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  price_at_sale: number;
  created_at?: string;

  // Relaciones cargadas
  product?: Product;
}

export interface Order {
  id: string; // UUID
  buyer_id: string;
  seller_id: string;
  total_price: number;
  delivery_place: string;
  status: OrderStatus;
  created_at?: string;
  updated_at?: string;

  // Relaciones cargadas
  buyer?: Profile;
  seller?: Profile;
  order_items?: OrderItem[];
}
