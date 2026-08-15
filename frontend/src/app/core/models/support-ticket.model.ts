export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'in_review'
  | 'waiting_buyer'
  | 'waiting_seller'
  | 'evidence_received'
  | 'resolved'
  | 'rejected'
  | 'closed';

export type SupportPriority = 'alto' | 'medio' | 'critico';

export interface SupportTicket {
  id: string;
  user_id: string;
  seller_id?: string | null;
  order_id?: string | null;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  admin_reply?: string | null;
  ticket_code?: string;
  priority?: SupportPriority;
  created_at: string;
  updated_at: string;

  // Joins
  profiles?: {
    full_name: string;
    student_code?: string;
    avatar_url?: string;
  };
  seller?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  } | null;
  order?: {
    id: string;
    order_code?: string;
    total_price: number;
    created_at?: string;
    status?: string;
  } | null;
}
