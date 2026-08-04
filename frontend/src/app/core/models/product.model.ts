import { Profile } from './profile.model';
import { Category } from './category.model';

export interface ProductImage {
  id?: string;
  product_id?: string;
  image_url: string;
  is_featured: boolean;
  created_at?: string;
}

export interface Product {
  id: string; // UUID
  seller_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  is_active: boolean;
  pickup_location: string;
  whatsapp_clicks?: number;
  created_at?: string;
  updated_at?: string;

  // Relaciones cargadas dinámicamente
  seller?: Profile;
  category?: Category;
  product_images?: ProductImage[];
}
