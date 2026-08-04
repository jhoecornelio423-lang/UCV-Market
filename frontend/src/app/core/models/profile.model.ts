export type UserRole = 'comprador' | 'emprendedor' | 'admin';

export interface Profile {
  id: string; // UUID references auth.users
  full_name: string;
  phone: string;
  student_code?: string;
  role: UserRole;
  rating_average: number;
  campus: string;
  created_at?: string;
  updated_at?: string;
}
