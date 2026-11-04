// ============================================================================
// JADIJCB: Real-Time Chat Types
// ============================================================================

import { Machine } from './database';

export interface ChatParticipant {
  id: string;
  phone: string;
  full_name: string;
  company_name?: string;
  role: 'owner' | 'client' | 'admin' | 'contractor' | 'equipment_owner';
  avatar_url?: string;
  city?: string;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  content?: string;
  read_at?: string | null;
  created_at: string;
  is_optimistic?: boolean;
}

export interface ChatConversationItem {
  id: string;
  machine_id?: string | null;
  participant_a: string;
  participant_b: string;
  last_message_at: string;
  other_participant: ChatParticipant;
  machine?: Machine | null;
  unread_count: number;
  last_message?: string;
}
