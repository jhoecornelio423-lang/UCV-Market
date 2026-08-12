export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  
  // Joins
  profiles?: {
    full_name: string;
    email: string;
    avatar_url: string;
  };
}
