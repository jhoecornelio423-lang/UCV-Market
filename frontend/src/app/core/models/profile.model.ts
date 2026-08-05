export type UserRole = 'comprador' | 'emprendedor' | 'admin';

export interface Profile {
  id: string; // UUID references auth.users
  full_name: string;
  phone: string;
  student_code?: string;
  role: UserRole;
  rating_average: number;
  campus: string;
  business_description?: string;
  business_category?: string;
  business_location?: string;
  open_time?: string;
  close_time?: string;
  banner_url?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}
