// ============================================================================
// JADIJCB: Real-Time Chat Engine & Conversation Store
// Strictly Real Supabase Messaging between Machinery Owners and Contractors
// ZERO mock data, ZERO fake seed conversations, ZERO fake auto-replies
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { ChatConversationItem, ChatMessageItem } from '../types/chat';
import { Machine, UserProfile } from '../types/database';
import { serverApi } from './serverApi';
import { sendWebPushToUsers } from './pushService';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'jadijcb_chat_conversations';
const LOCAL_STORAGE_MESSAGES_KEY = 'jadijcb_chat_messages';
const CHAT_BROADCAST_CHANNEL = 'jadijcb_chat_channel';

export interface LocalChatBroadcastEvent {
  type: 'NEW_MESSAGE' | 'MARK_READ';
  conversationId: string;
  senderId: string;
  recipientId?: string;
  senderName?: string;
  recipientRole?: string;
  message?: ChatMessageItem;
}

function stripMarkersInline(text: string): string {
  const raw = String(text || '');
  const markers = ['#DISPATCH_DATA:', '#DISPATCH_DEAL:', '#DRIVER_OFFER:', '#DRIVER_DEAL:'];
  let cutIdx = -1;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx !== -1 && (cutIdx === -1 || idx < cutIdx)) {
      cutIdx = idx;
    }
  }
  const sliced = cutIdx === -1 ? raw : raw.slice(0, cutIdx);
  return sliced
    .replace(/\s*\[JADIJCB_DISPATCH:[^\]]+\]\s*/g, '')
    .replace(/\s*\[JADIJCB_DEAL:[^\]]+\]\s*/g, '')
    .trim();
}

export function broadcastChatEvent(event: LocalChatBroadcastEvent): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHAT_BROADCAST_CHANNEL);
      ch.postMessage(event);
      ch.close();
    }
  } catch {
    // ignore BroadcastChannel errors
  }
}

export function subscribeLocalChatEvents(
  handler: (event: LocalChatBroadcastEvent) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CHAT_BROADCAST_CHANNEL);
    ch.onmessage = (e) => {
      if (e?.data) handler(e.data as LocalChatBroadcastEvent);
    };
  } catch {
    ch = null;
  }
  return () => {
    try {
      ch?.close();
    } catch {
      // ignore
    }
  };
}

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
    otherParticipantId?: string,
    meta?: {
      senderName?: string;
      recipientRole?: string;
    }
  ): Promise<ChatMessageItem> {
    const trimmed = text.trim();
    const cleanPreview = stripMarkersInline(trimmed) || 'رسالة جديدة';
    const shortPreview =
      cleanPreview.length > 90 ? cleanPreview.slice(0, 90) + '...' : cleanPreview;
    const isRawDispatchLaunch = trimmed.includes('[JADIJCB_DISPATCH:');

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
    let resolvedRecipientId = otherParticipantId;
    let resolvedRecipientRole = meta?.recipientRole;
    if (convIdx >= 0) {
      const conv = this.conversations[convIdx];
      conv.last_message = cleanPreview;
      conv.last_message_at = newMsg.created_at;
      if (!resolvedRecipientId) {
        resolvedRecipientId =
          conv.participant_a === senderId ? conv.participant_b : conv.participant_a;
      }
      if (!resolvedRecipientRole) {
        resolvedRecipientRole = conv.other_participant?.role;
      }
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

    // Deliver notification + Web Push to the recipient (skip duplicate for raw dispatch launch which already sends dispatch_opportunity push)
    if (resolvedRecipientId && !isRawDispatchLaunch) {
      const isRecipientContractor =
        resolvedRecipientRole === 'client' || resolvedRecipientRole === 'contractor';
      const isRecipientDriver = resolvedRecipientRole === 'driver';
      const targetUrl = isRecipientDriver
        ? `/driver/messages?conv=${encodeURIComponent(conversationId)}`
        : isRecipientContractor
        ? `/entreprise/messages?conv=${encodeURIComponent(conversationId)}`
        : `/owner/messages?conv=${encodeURIComponent(conversationId)}`;
      const titleAr = meta?.senderName
        ? `رسالة من ${meta.senderName} 💬`
        : 'رسالة جديدة في المحادثة 💬';
      const titleFr = meta?.senderName
        ? `Message de ${meta.senderName} 💬`
        : 'Nouveau message 💬';

      if (isSupabaseConfigured) {
        Promise.resolve(
          supabase.from('notifications').insert({
            user_id: resolvedRecipientId,
            title_ar: titleAr,
            title_fr: titleFr,
            body_ar: shortPreview,
            body_fr: shortPreview,
            type: 'chat_message',
            data: {
              conversation_id: conversationId,
              message_id: newMsg.id,
              sender_id: senderId,
              sender_name: meta?.senderName || '',
              url: targetUrl,
            },
            is_read: false,
          })
        ).catch(() => {});
      }

      sendWebPushToUsers({
        userIds: [resolvedRecipientId],
        id: newMsg.id,
        type: 'chat_message',
        title: titleAr,
        body: shortPreview,
        tag: `jadijcb-chat-${conversationId}`,
        url: targetUrl,
      }).catch(() => {});

      broadcastChatEvent({
        type: 'NEW_MESSAGE',
        conversationId,
        senderId,
        recipientId: resolvedRecipientId,
        senderName: meta?.senderName,
        recipientRole: resolvedRecipientRole,
        message: newMsg,
      });
    }

    // Persist to Server SQLite fallback (also inserts notification & dispatches SQLite Web Push)
    if (!isRawDispatchLaunch) {
      serverApi
        .sendMessage({
          id: newMsg.id,
          conversation_id: conversationId,
          sender_id: senderId,
          body: trimmed,
          recipient_id: resolvedRecipientId,
          sender_name: meta?.senderName,
          recipient_role: resolvedRecipientRole,
        })
        .catch(() => {});
    }

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
    const wantedMachineId = machine?.id || null;
    const existing = this.conversations.find(
      (c) =>
        !c.id.includes('seed') &&
        (c.machine_id || null) === wantedMachineId &&
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
        // One conversation per machine: filter on machine_id too
        let convQuery = supabase
          .from('conversations')
          .select('id, machine_id, participant_a, participant_b, participant_one, participant_two, last_message_at')
          .or(
            `and(participant_a.eq.${userAId},participant_b.eq.${userBId}),and(participant_a.eq.${userBId},participant_b.eq.${userAId}),and(participant_one.eq.${userAId},participant_two.eq.${userBId}),and(participant_one.eq.${userBId},participant_two.eq.${userAId})`
          );
        convQuery = wantedMachineId
          ? convQuery.eq('machine_id', wantedMachineId)
          : convQuery.is('machine_id', null);
        const { data: dbConvRows } = await convQuery
          .order('last_message_at', { ascending: false })
          .limit(1);
        const dbConv = dbConvRows && dbConvRows.length > 0 ? dbConvRows[0] : null;

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

    if (currentUserId && conversationId) {
      serverApi.markConversationNotificationsRead(currentUserId, conversationId).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jadijcb_chat_unread_updated'));
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
