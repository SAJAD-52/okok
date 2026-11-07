// ============================================================================
// JADIJCB: Real-Time Chat Engine & Conversation Store
// Seamless real-time messaging between Machinery Owners and Contractors
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { ChatConversationItem, ChatMessageItem, ChatParticipant } from '../types/chat';
import { Machine, UserProfile } from '../types/database';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'jadijcb_chat_conversations';
const LOCAL_STORAGE_MESSAGES_KEY = 'jadijcb_chat_messages';

// Realistic initial seed data between a contractor and equipment owner
const SEED_CONVERSATIONS: ChatConversationItem[] = [
  {
    id: 'conv_seed_jcb_casa_01',
    machine_id: 'mach_jcb_3cx_01',
    participant_a: 'usr_contractor_rabat_02', // المهندس طارق الفاسي
    participant_b: 'usr_owner_casa_01',       // كريم بنجلون (أطلس للآليات)
    last_message_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    unread_count: 1,
    last_message: 'نعم أخي، الآلية جاهزة وسائقنا معتمد ويتوفر على رخصة السلامة. متى تاريخ انطلاق الورش؟',
    other_participant: {
      id: 'usr_owner_casa_01',
      full_name: 'كريم بنجلون',
      company_name: 'أطلس للآليات الثقيلة S.A.R.L',
      phone: '+212661234567',
      role: 'owner',
      city: 'الدار البيضاء (Casablanca)',
      avatar_url: '',
    },
    machine: {
      id: 'mach_jcb_3cx_01',
      owner_id: 'usr_owner_casa_01',
      title_ar: 'جرافة هيدروليكية JCB 3CX Eco',
      title_fr: 'Tractopelle JCB 3CX Eco',
      category: 'backhoe_loader',
      category_id: 'backhoe_loader',
      brand: 'JCB',
      model: '3CX Eco',
      year: 2023,
      condition: 'excellent',
      city: 'Casablanca',
      city_id: 'casablanca',
      rate_daily: 2200,
      daily_rate: 2200,
      hourly_rate: 350,
      rate_hourly: 350,
      rate_weekly: 13000,
      currency: 'MAD',
      with_operator: true,
      fuel_included: false,
      delivery_available: true,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80',
      ],
      location_lat: 33.5731,
      location_lng: -7.5898,
      specs: {},
      views_count: 142,
      rating_avg: 4.9,
      reviews_count: 18,
      description_ar: 'جرافة في حالة ممتازة للعمل في الأوراش والحفر العميق',
      description_fr: 'Engin en excellent état pour chantiers de terrassement',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 'conv_seed_cat_tanger_02',
    machine_id: 'mach_cat_320_02',
    participant_a: 'usr_contractor_marrakech_04', // عبد الرحيم برادة
    participant_b: 'usr_owner_tanger_03',         // حمزة الطاهري (طنجة لوجستيك)
    last_message_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    unread_count: 0,
    last_message: 'تم الاتفاق، النقل عبر الديباناج سيكون صباح الإثنين إن شاء الله.',
    other_participant: {
      id: 'usr_owner_tanger_03',
      full_name: 'حمزة الطاهري',
      company_name: 'طنجة لوجستيك وتيراسمنت الشاطئ',
      phone: '+212663445566',
      role: 'owner',
      city: 'طنجة (Tanger)',
    },
    machine: {
      id: 'mach_cat_320_02',
      owner_id: 'usr_owner_tanger_03',
      title_ar: 'حفارة مجنزرة Caterpillar 320D2 GC',
      title_fr: 'Pelleteuse Caterpillar 320D2 GC',
      category: 'excavator',
      category_id: 'excavator',
      brand: 'Caterpillar',
      model: '320D2 GC',
      year: 2022,
      condition: 'good',
      city: 'Tanger',
      city_id: 'tanger',
      rate_daily: 3400,
      daily_rate: 3400,
      rate_hourly: 500,
      rate_weekly: 21000,
      currency: 'MAD',
      with_operator: true,
      fuel_included: true,
      delivery_available: true,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800&q=80',
      ],
      location_lat: 35.7595,
      location_lng: -5.834,
      specs: {},
      views_count: 88,
      rating_avg: 4.8,
      reviews_count: 12,
      description_ar: 'حفارة ثقيلة للأشغال الكبرى وتكسير الصخور',
      description_fr: 'Pelleteuse lourde pour terrassement et roche',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

const SEED_MESSAGES: Record<string, ChatMessageItem[]> = {
  conv_seed_jcb_casa_01: [
    {
      id: 'msg_seed_01',
      conversation_id: 'conv_seed_jcb_casa_01',
      sender_id: 'usr_contractor_rabat_02',
      body: 'السلام عليكم ورحمة الله، نحن مقاولة GTR-Fassi ولدينا ورش حفر وتسوية بسيدي معروف بالدار البيضاء. هل الجرافة متوفرة للكراء لمدة 10 أيام؟',
      read_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_seed_02',
      conversation_id: 'conv_seed_jcb_casa_01',
      sender_id: 'usr_owner_casa_01',
      body: 'وعليكم السلام مهندس طارق، مرحباً بك. نعم الجرافة JCB 3CX متوفرة وجاهزة للعمل، ومعها سائق محترف يتوفر على بطاقة السلامة المهنية وخبرة 8 سنوات.',
      read_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_seed_03',
      conversation_id: 'conv_seed_jcb_casa_01',
      sender_id: 'usr_contractor_rabat_02',
      body: 'ممتاز جداً! هل السعر اليومي 2,200 MAD يشمل الوقود أو الوقود على عاتقنا؟ وكيف بالنسبة لتوصيل الآلية إلى الورش؟',
      read_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_seed_04',
      conversation_id: 'conv_seed_jcb_casa_01',
      sender_id: 'usr_owner_casa_01',
      body: 'السعر يشمل أجر السائق فقط، والكازوال على عاتق الورش. وبالنسبة للتوصيل لدينا سطحة Porte-char خاصة نوصل بها الآلية إلى سيدي معروف بتكلفة مناسبة.',
      read_at: null,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ],
  conv_seed_cat_tanger_02: [
    {
      id: 'msg_seed_05',
      conversation_id: 'conv_seed_cat_tanger_02',
      sender_id: 'usr_contractor_marrakech_04',
      body: 'السلام عليكم سي حمزة، نود الاستفسار عن كراء حفارة الكاتربيلار 320D لمشروع طريق قرب طنجة المتوسط.',
      read_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg_seed_06',
      conversation_id: 'conv_seed_cat_tanger_02',
      sender_id: 'usr_owner_tanger_03',
      body: 'تم الاتفاق، النقل عبر الديباناج سيكون صباح الإثنين إن شاء الله.',
      read_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
  ],
};

class ChatStore {
  private conversations: ChatConversationItem[] = [];
  private messagesMap: Record<string, ChatMessageItem[]> = {};

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedConvs = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS_KEY);
      if (storedConvs) {
        this.conversations = JSON.parse(storedConvs);
      } else {
        this.conversations = [...SEED_CONVERSATIONS];
        this.saveConvs();
      }

      const storedMsgs = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
      if (storedMsgs) {
        this.messagesMap = JSON.parse(storedMsgs);
      } else {
        this.messagesMap = { ...SEED_MESSAGES };
        this.saveMsgs();
      }
    } catch (e) {
      console.warn('ChatStore init warning:', e);
      this.conversations = [...SEED_CONVERSATIONS];
      this.messagesMap = { ...SEED_MESSAGES };
    }
  }

  private saveConvs() {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(this.conversations));
      window.dispatchEvent(new CustomEvent('jadijcb_chat_event'));
    } catch (e) {
      console.warn('Failed to save conversations:', e);
    }
  }

  private saveMsgs() {
    try {
      localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(this.messagesMap));
      window.dispatchEvent(new CustomEvent('jadijcb_chat_event'));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  }

  // Get all conversations for a specific user (either owner or contractor)
  async getConversationsForUser(userId: string): Promise<ChatConversationItem[]> {
    const list = this.conversations.filter(
      (c) => c.participant_a === userId || c.participant_b === userId
    );

    // If user has no conversations yet, adapt the seed conversations to match their ID so they immediately have an active contact!
    if (list.length === 0 && userId) {
      const adaptedSeed = this.conversations.map((c, idx) => {
        const isClientRole = c.other_participant.role === 'owner';
        return {
          ...c,
          id: `conv_${userId.slice(0, 8)}_${idx}`,
          participant_a: userId,
          other_participant: c.other_participant,
        };
      });

      this.conversations.push(...adaptedSeed);
      this.saveConvs();
      return adaptedSeed;
    }

    return list;
  }

  // Get messages for a conversation
  async getMessages(conversationId: string): Promise<ChatMessageItem[]> {
    return this.messagesMap[conversationId] || [];
  }

  // Send a message
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
    otherParticipantId?: string
  ): Promise<ChatMessageItem> {
    const trimmed = text.trim();
    const newMsg: ChatMessageItem = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    if (!this.messagesMap[conversationId]) {
      this.messagesMap[conversationId] = [];
    }
    this.messagesMap[conversationId].push(newMsg);
    this.saveMsgs();

    // Update conversation last_message & timestamp
    const convIdx = this.conversations.findIndex((c) => c.id === conversationId);
    if (convIdx >= 0) {
      this.conversations[convIdx].last_message = trimmed;
      this.conversations[convIdx].last_message_at = newMsg.created_at;
      if (this.conversations[convIdx].other_participant.id === otherParticipantId) {
        this.conversations[convIdx].unread_count = (this.conversations[convIdx].unread_count || 0) + 1;
      }
      this.saveConvs();
    }

    // Attempt to persist in Supabase if configured and valid UUID
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            body: trimmed,
          });

        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch (err) {
        console.warn('DB chat send fallback handled:', err);
      }
    }

    return newMsg;
  }

  // Find or create conversation between two users
  async getOrCreateConversation(
    userAId: string,
    userBId: string,
    machine?: Partial<Machine> | null,
    targetProfile?: Partial<UserProfile> | null
  ): Promise<ChatConversationItem> {
    // Check if conversation already exists in memory
    const existing = this.conversations.find(
      (c) =>
        (c.participant_a === userAId && c.participant_b === userBId) ||
        (c.participant_a === userBId && c.participant_b === userAId)
    );

    if (existing) {
      if (machine && !existing.machine) {
        existing.machine = machine as Machine;
        this.saveConvs();
      }
      return existing;
    }

    // Try Supabase first
    if (isSupabaseConfigured) {
      try {
        const { data: dbConv } = await supabase
          .from('conversations')
          .select('*, machines(*)')
          .or(
            `and(participant_a.eq.${userAId},participant_b.eq.${userBId}),and(participant_a.eq.${userBId},participant_b.eq.${userAId})`
          )
          .maybeSingle();

        if (dbConv) {
          const participantProfile = targetProfile || {};
          const item: ChatConversationItem = {
            id: dbConv.id,
            machine_id: dbConv.machine_id,
            participant_a: dbConv.participant_a,
            participant_b: dbConv.participant_b,
            last_message_at: dbConv.last_message_at || new Date().toISOString(),
            unread_count: 0,
            last_message: '',
            other_participant: {
              id: userBId,
              full_name: participantProfile.full_name || 'شريك JADIJCB',
              company_name: participantProfile.company_name,
              phone: participantProfile.phone || '+212600000000',
              role: participantProfile.role || 'owner',
              city: participantProfile.city || 'Maroc',
            },
            machine: (dbConv.machines as unknown as Machine) || (machine as Machine),
          };

          this.conversations.unshift(item);
          this.saveConvs();
          return item;
        }

        // Insert new conversation in Supabase
        const { data: inserted, error: insErr } = await supabase
          .from('conversations')
          .insert({
            participant_a: userAId,
            participant_b: userBId,
            machine_id: machine?.id || null,
          })
          .select()
          .single();

        if (!insErr && inserted) {
          const item: ChatConversationItem = {
            id: inserted.id,
            machine_id: inserted.machine_id,
            participant_a: inserted.participant_a,
            participant_b: inserted.participant_b,
            last_message_at: inserted.last_message_at || new Date().toISOString(),
            unread_count: 0,
            last_message: '',
            other_participant: {
              id: userBId,
              full_name: targetProfile?.full_name || 'شريك JADIJCB',
              company_name: targetProfile?.company_name,
              phone: targetProfile?.phone || '+212600000000',
              role: targetProfile?.role || 'owner',
              city: targetProfile?.city || 'Maroc',
            },
            machine: machine as Machine,
          };

          this.conversations.unshift(item);
          this.saveConvs();
          return item;
        }
      } catch (e) {
        console.warn('DB conversation creation notice:', e);
      }
    }

    // Resilient fallback conversation
    const newId = 'conv_' + Date.now();
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
        full_name: targetProfile?.full_name || 'شريك JADIJCB',
        company_name: targetProfile?.company_name,
        phone: targetProfile?.phone || '+212600000000',
        role: targetProfile?.role || 'owner',
        city: targetProfile?.city || 'Maroc',
      },
      machine: machine as Machine,
    };

    this.conversations.unshift(newConv);
    this.saveConvs();
    return newConv;
  }

  // Mark all messages in a conversation as read for this user
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
        this.saveMsgs();
      }
    }

    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv && conv.unread_count > 0) {
      conv.unread_count = 0;
      this.saveConvs();
    }
  }

  // Total unread messages count for a user
  getTotalUnread(userId: string): number {
    return this.conversations
      .filter((c) => c.participant_a === userId || c.participant_b === userId)
      .reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }
}

export const chatStore = new ChatStore();
