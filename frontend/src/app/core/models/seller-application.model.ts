export type SellerApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface SellerApplication {
  id?: string;
  user_id?: string;
  dni: string;
  full_name: string;
  business_name: string;
  business_category: string;
  open_time: string;
  close_time: string;
  logo_url?: string;
  description?: string;
  phone: string;
  delivery_points?: string;
  status?: SellerApplicationStatus;
  created_at?: string;
  updated_at?: string;
}
