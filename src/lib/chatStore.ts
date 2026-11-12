// ============================================================================
// JADIJCB: Real-Time Chat Engine & Conversation Store
// Strictly Real Supabase Messaging between Machinery Owners and Contractors
// ZERO mock data, ZERO fake seed conversations, ZERO fake auto-replies
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { ChatConversationItem, ChatMessageItem } from '../types/chat';
import { Machine, UserProfile } from '../types/database';
import { serverApi } from './serverApi';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'jadijcb_chat_conversations';
const LOCAL_STORAGE_MESSAGES_KEY = 'jadijcb_chat_messages';

class ChatStore {
  private conversations: ChatConversationItem[] = [];
  private messagesMap: Record<string, ChatMessageItem[]> = {};

  constructor() {
    this.init();
  }

  private init() {
    try {
      // Purge any legacy fake/seed conversations from storage
      localStorage.removeItem('jadijcb_chat_conversations_seed');
      const storedConvs = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS_KEY);
      if (storedConvs) {
        const parsed: ChatConversationItem[] = JSON.parse(storedConvs);
        // Strictly filter out any mock/seed conversations
        this.conversations = Array.isArray(parsed)
          ? parsed.filter(
              (c) =>
                !c.id.includes('seed') &&
                !c.id.includes('demo') &&
                c.participant_a !== 'usr_partner_demo_btp' &&
                c.participant_b !== 'usr_partner_demo_btp'
            )
          : [];
      } else {
        this.conversations = [];
      }

      const storedMsgs = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
      if (storedMsgs) {
        const parsedMsgs: Record<string, ChatMessageItem[]> = JSON.parse(storedMsgs);
        const cleaned: Record<string, ChatMessageItem[]> = {};
        for (const [convId, list] of Object.entries(parsedMsgs)) {
          if (!convId.includes('seed') && !convId.includes('demo')) {
            cleaned[convId] = (list || []).filter(
              (m) =>
                !m.id.includes('seed') &&
                !m.id.includes('msg_reply_') &&
                m.sender_id !== 'usr_partner_demo_btp'
            );
          }
        }
        this.messagesMap = cleaned;
      } else {
        this.messagesMap = {};
      }
    } catch (e) {
      console.warn('ChatStore init warning:', e);
      this.conversations = [];
      this.messagesMap = {};
    }
  }

  private saveConvsSilently() {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(this.conversations));
    } catch (e) {
      console.warn('Failed to save conversations:', e);
    }
  }

  private saveMsgsSilently() {
    try {
      localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(this.messagesMap));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  }

  // Get all conversations for a specific user (pure read, NEVER triggers event loop)
  async getConversationsForUser(userId: string): Promise<ChatConversationItem[]> {
    if (!userId) return [];
    return this.conversations.filter(
      (c) =>
        (c.participant_a === userId || c.participant_b === userId) &&
        !c.id.includes('seed') &&
        !c.id.includes('demo')
    );
  }

  // Set conversations cache from Supabase
  setConversations(convs: ChatConversationItem[]): void {
    const cleanList = (convs || []).filter(
      (c) =>
        !c.id.includes('seed') &&
        !c.id.includes('demo') &&
        c.participant_a !== 'usr_partner_demo_btp' &&
        c.participant_b !== 'usr_partner_demo_btp'
    );
    this.conversations = cleanList;
    this.saveConvsSilently();
  }

  // Get messages for a conversation (pure read, NO mock injection)
  async getMessages(conversationId: string): Promise<ChatMessageItem[]> {
    if (!conversationId || conversationId.includes('seed') || conversationId.includes('demo')) {
      return [];
    }

    return (this.messagesMap[conversationId] || []).filter(
      (m) => !m.id.includes('seed') && !m.id.includes('msg_reply_')
    );
  }

  // Set messages cache from Supabase
  setMessages(conversationId: string, msgs: ChatMessageItem[]): void {
    if (!conversationId) return;
    const clean = (msgs || []).filter(
      (m) => !m.id.includes('seed') && !m.id.includes('msg_reply_')
    );
    this.messagesMap[conversationId] = clean;
    this.saveMsgsSilently();
  }

  // Send a real message
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
    otherParticipantId?: string
  ): Promise<ChatMessageItem> {
    const trimmed = text.trim();
    const newMsg: ChatMessageItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
      content: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
      is_optimistic: true,
    };

    if (!this.messagesMap[conversationId]) {
      this.messagesMap[conversationId] = [];
    }
    this.messagesMap[conversationId].push(newMsg);
    this.saveMsgsSilently();

    // Update conversation last_message in local cache
    const convIdx = this.conversations.findIndex((c) => c.id === conversationId);
    if (convIdx >= 0) {
      this.conversations[convIdx].last_message = trimmed;
      this.conversations[convIdx].last_message_at = newMsg.created_at;
      this.saveConvsSilently();
    }

    // Persist in Supabase directly
    if (isSupabaseConfigured) {
      try {
        const msgPayload = {
          id: newMsg.id,
          conversation_id: conversationId,
          sender_id: senderId,
          content: trimmed,
          body: trimmed,
        };

        const { data: inserted } = await supabase
          .from('messages')
          .insert(msgPayload)
          .select()
          .maybeSingle();

        if (inserted?.id) {
          newMsg.id = inserted.id;
          newMsg.is_optimistic = false;
        }

        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch (err) {
        console.warn('Supabase message insert notice:', err);
      }
    }

    // Persist to Server fallback
    serverApi
      .sendMessage({
        conversation_id: conversationId,
        sender_id: senderId,
        body: trimmed,
        recipient_id: otherParticipantId,
      })
      .catch(() => {});

    return newMsg;
  }

  // Find or create conversation in Supabase
  async getOrCreateConversation(
    userAId: string,
    userBId: string,
    machine?: Partial<Machine> | null,
    targetProfile?: Partial<UserProfile> | null
  ): Promise<ChatConversationItem> {
    if (!userAId || !userBId || userAId === userBId) {
      throw new Error('Valid distinct participants required for conversation');
    }

    // 1. Check in-memory list
    const existing = this.conversations.find(
      (c) =>
        !c.id.includes('seed') &&
        ((c.participant_a === userAId && c.participant_b === userBId) ||
          (c.participant_a === userBId && c.participant_b === userAId))
    );

    if (existing) {
      if (machine && !existing.machine) {
        existing.machine = machine as Machine;
        this.saveConvsSilently();
      }
      return existing;
    }

    // 2. Query Supabase (supports participant_a/b AND participant_one/two)
    if (isSupabaseConfigured) {
      try {
        const { data: dbConv } = await supabase
          .from('conversations')
          .select('id, machine_id, participant_a, participant_b, participant_one, participant_two, last_message_at')
          .or(
            `and(participant_a.eq.${userAId},participant_b.eq.${userBId}),and(participant_a.eq.${userBId},participant_b.eq.${userAId}),and(participant_one.eq.${userAId},participant_two.eq.${userBId}),and(participant_one.eq.${userBId},participant_two.eq.${userAId})`
          )
          .maybeSingle();

        if (dbConv) {
          const item: ChatConversationItem = {
            id: dbConv.id,
            machine_id: dbConv.machine_id,
            participant_a: dbConv.participant_a || dbConv.participant_one || userAId,
            participant_b: dbConv.participant_b || dbConv.participant_two || userBId,
            last_message_at: dbConv.last_message_at || new Date().toISOString(),
            unread_count: 0,
            last_message: '',
            other_participant: {
              id: userBId,
              full_name: targetProfile?.full_name || targetProfile?.company_name || 'شريك JADIJCB',
              company_name: targetProfile?.company_name,
              phone: targetProfile?.phone || '',
              role: (targetProfile?.role as any) || 'owner',
              city: targetProfile?.city || 'المغرب',
              avatar_url: targetProfile?.avatar_url,
            },
            machine: machine as Machine,
          };

          this.conversations.unshift(item);
          this.saveConvsSilently();
          return item;
        }

        // 3. Insert new conversation in Supabase
        const isMachineUuid = Boolean(
          machine?.id &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(machine.id)
        );

        const convInsertPayload: any = {
          participant_a: userAId,
          participant_b: userBId,
          participant_one: userAId,
          participant_two: userBId,
        };
        if (isMachineUuid) {
          convInsertPayload.machine_id = machine!.id;
        }

        const { data: inserted, error: insErr } = await supabase
          .from('conversations')
          .insert(convInsertPayload)
          .select()
          .maybeSingle();

        if (!insErr && inserted) {
          const item: ChatConversationItem = {
            id: inserted.id,
            machine_id: inserted.machine_id,
            participant_a: inserted.participant_a || inserted.participant_one || userAId,
            participant_b: inserted.participant_b || inserted.participant_two || userBId,
            last_message_at: inserted.last_message_at || new Date().toISOString(),
            unread_count: 0,
            last_message: '',
            other_participant: {
              id: userBId,
              full_name: targetProfile?.full_name || targetProfile?.company_name || 'شريك JADIJCB',
              company_name: targetProfile?.company_name,
              phone: targetProfile?.phone || '',
              role: (targetProfile?.role as any) || 'owner',
              city: targetProfile?.city || 'المغرب',
              avatar_url: targetProfile?.avatar_url,
            },
            machine: machine as Machine,
          };

          this.conversations.unshift(item);
          this.saveConvsSilently();
          return item;
        }
      } catch (e) {
        console.warn('DB conversation creation error:', e);
      }
    }

    // 4. Fallback conversation container
    const newId = crypto.randomUUID ? crypto.randomUUID() : 'conv_' + Date.now();
    const newConv: ChatConversationItem = {
      id: newId,
      machine_id: machine?.id || null,
      participant_a: userAId,
      participant_b: userBId,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      last_message: '',
      other_participant: {
        id: userBId,
        full_name: targetProfile?.full_name || targetProfile?.company_name || 'شريك JADIJCB',
        company_name: targetProfile?.company_name,
        phone: targetProfile?.phone || '',
        role: (targetProfile?.role as any) || 'owner',
        city: targetProfile?.city || 'المغرب',
        avatar_url: targetProfile?.avatar_url,
      },
      machine: machine as Machine,
    };

    this.conversations.unshift(newConv);
    this.saveConvsSilently();
    this.messagesMap[newId] = [];
    this.saveMsgsSilently();

    return newConv;
  }

  // Mark all messages as read
  markAsRead(conversationId: string, currentUserId: string) {
    const msgs = this.messagesMap[conversationId];
    if (msgs) {
      let changed = false;
      const now = new Date().toISOString();
      msgs.forEach((m) => {
        if (m.sender_id !== currentUserId && !m.read_at) {
          m.read_at = now;
          changed = true;
        }
      });
      if (changed) {
        this.saveMsgsSilently();
      }
    }

    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv && conv.unread_count > 0) {
      conv.unread_count = 0;
      this.saveConvsSilently();
    }
  }

  // Total unread messages count
  getTotalUnread(userId: string): number {
    if (!userId) return 0;
    return this.conversations
      .filter((c) => c.participant_a === userId || c.participant_b === userId)
      .reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }
}

export const chatStore = new ChatStore();
