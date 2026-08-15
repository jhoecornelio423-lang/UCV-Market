export type SupportThread = 'buyer' | 'seller';
export type SupportSenderRole = 'admin' | 'buyer' | 'seller';

export interface SupportMessage {
  id: string;
  ticket_id: string;
  participant_id: string | null;
  sender_role: SupportSenderRole;
  thread: SupportThread;
  body: string;
  read_at?: string | null;
  created_at: string;

  // Joins
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}
