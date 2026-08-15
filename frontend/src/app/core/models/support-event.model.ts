export interface SupportEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  description: string;
  created_by?: string | null;
  created_at: string;
}
