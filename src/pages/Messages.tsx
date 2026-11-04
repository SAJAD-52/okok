// ============================================================================
// JADIJCB: Real-Time Messages Page (Responsive WhatsApp Layout)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles, Truck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { ChatConversationItem, ChatParticipant } from '../types/chat';
import { Machine } from '../types/database';
import { ConversationList } from '../features/chat/ConversationList';
import { ChatThread } from '../features/chat/ChatThread';
import { MOCK_MACHINES } from '../data/mockData';

// Realistic Moroccan Seed Conversations for Instant Experience & Fallback
const DEMO_CONVERSATIONS: ChatConversationItem[] = [
  {
    id: 'conv_1',
    participant_a: 'user_1',
    participant_b: 'user_6',
    last_message_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    unread_count: 1,
    last_message: 'ممتاز! نود بدء العمل يوم الإثنين بورش سيدي معروف لمدة أسبوعين.',
    other_participant: {
      id: 'user_6',
      phone: '+212661998877',
      full_name: 'Youssef El Alami',
      company_name: 'BTP Maroc Construction S.A.',
      role: 'contractor',
      city: 'Casablanca',
    },
    machine: MOCK_MACHINES[0] as Machine,
  },
  {
    id: 'conv_2',
    participant_a: 'user_1',
    participant_b: 'user_demo_atlas',
    last_message_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    unread_count: 0,
    last_message: 'سعر كراء الحفارة الكبيرة كاتربيلر 320D يشمل الصيانة الدورية وتأمين الورش.',
    other_participant: {
      id: 'user_demo_atlas',
      phone: '+212661889900',
      full_name: 'Karim Benjelloun',
      company_name: 'Atlas Terrassement S.A.R.L.',
      role: 'owner',
      city: 'Casablanca',
    },
    machine: MOCK_MACHINES[1] as Machine,
  },
  {
    id: 'conv_3',
    participant_a: 'user_1',
    participant_b: 'user_demo_sahara',
    last_message_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    unread_count: 0,
    last_message: 'الشاحنة المان متوفرة ابتداءً من منتصف الشهر لنقل الحصى والرمال.',
    other_participant: {
      id: 'user_demo_sahara',
      phone: '+212662334455',
      full_name: 'Tariq Mansouri',
      company_name: 'Sahara Logistique & BTP',
      role: 'owner',
      city: 'Marrakech',
    },
    machine: MOCK_MACHINES[2] as Machine,
  },
];

export const Messages: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentUserId = user?.id || profile?.id || 'user_1';

  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Fetch Conversations from Supabase or Fallback to Demo Data
  const loadConversations = useCallback(async () => {
    setIsLoading(true);

    if (isSupabaseConfigured) {
      try {
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select(`
            id,
            machine_id,
            participant_a,
            participant_b,
            last_message_at,
            machines:machine_id (*)
          `)
          .or(`participant_a.eq.${currentUserId},participant_b.eq.${currentUserId}`)
          .order('last_message_at', { ascending: false });

        if (!convError && convData && convData.length > 0) {
          // Fetch participants and unread counts
          const mapped: ChatConversationItem[] = await Promise.all(
            convData.map(async (c: any) => {
              const otherId = c.participant_a === currentUserId ? c.participant_b : c.participant_a;

              // Fetch other profile
              const { data: otherProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', otherId)
                .single();

              // Fetch last message & unread count
              const { data: msgList } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', c.id)
                .order('created_at', { ascending: false })
                .limit(1);

              const { count: unreadCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', c.id)
                .eq('sender_id', otherId)
                .is('read_at', null);

              const otherParticipant: ChatParticipant = {
                id: otherId,
                phone: otherProfile?.phone || '+212600000000',
                full_name: otherProfile?.full_name || 'Partenaire JADIJCB',
                company_name: otherProfile?.company_name,
                role: otherProfile?.role || 'owner',
                city: otherProfile?.city || 'Maroc',
                avatar_url: otherProfile?.avatar_url,
              };

              return {
                id: c.id,
                machine_id: c.machine_id,
                participant_a: c.participant_a,
                participant_b: c.participant_b,
                last_message_at: c.last_message_at || new Date().toISOString(),
                other_participant: otherParticipant,
                machine: c.machines as Machine,
                unread_count: unreadCount || 0,
                last_message: msgList?.[0]?.body || msgList?.[0]?.content || '',
              };
            })
          );

          setConversations(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Realtime conversations load failed, falling back to demo state:', err);
      }
    }

    // Default Seed Data
    setConversations(DEMO_CONVERSATIONS);
    return DEMO_CONVERSATIONS;
  }, [currentUserId]);

  useEffect(() => {
    let isMounted = true;
    loadConversations().then((loaded) => {
      if (!isMounted) return;
      setIsLoading(false);

      // Handle Query Params: ?conversationId= or ?machineId=
      const urlConvId = searchParams.get('conversationId');
      const urlMachineId = searchParams.get('machineId');

      if (urlConvId) {
        const found = loaded.find((c) => c.id === urlConvId);
        if (found) {
          setActiveConversation(found);
          return;
        }
      }

      if (urlMachineId) {
        const matchingConv = loaded.find((c) => c.machine_id === urlMachineId || c.machine?.id === urlMachineId);
        if (matchingConv) {
          setActiveConversation(matchingConv);
        } else {
          // Find machine from seed or database and initiate conversation
          const targetMachine = MOCK_MACHINES.find((m: any) => m.id === urlMachineId) as Machine;
          if (targetMachine) {
            const newConv: ChatConversationItem = {
              id: `conv_new_${Date.now()}`,
              participant_a: currentUserId,
              participant_b: targetMachine.owner_id || 'owner_partner',
              last_message_at: new Date().toISOString(),
              unread_count: 0,
              last_message: '',
              other_participant: {
                id: targetMachine.owner_id || 'owner_partner',
                phone: targetMachine.owner?.phone || '+212661889900',
                full_name: targetMachine.owner?.full_name || 'Karim Benjelloun',
                company_name: targetMachine.owner?.company_name || 'Atlas Terrassement',
                role: 'owner',
                city: targetMachine.city || 'Casablanca',
              },
              machine: targetMachine,
            };
            setConversations((prev) => [newConv, ...prev]);
            setActiveConversation(newConv);
          }
        }
      } else if (window.innerWidth >= 768 && loaded.length > 0 && !activeConversation) {
        // Desktop default select first conversation
        setActiveConversation(loaded[0]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadConversations, searchParams]);

  // 2. Global Realtime Subscription on Conversations
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('chat:global_conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Handle selecting conversation
  const handleSelectConversation = (conv: ChatConversationItem) => {
    setActiveConversation(conv);
    setSearchParams({ conversationId: conv.id });

    // Mark as locally read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const handleBackToList = () => {
    setActiveConversation(null);
    setSearchParams({});
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[550px] bg-white rounded-3xl border border-steel-200 shadow-soft overflow-hidden flex flex-col md:flex-row relative">
      {/* Sidebar: Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
          activeConversation ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          isLoading={isLoading}
        />
      </div>

      {/* Main Area: Chat Thread or Empty Placeholder */}
      <div
        className={`flex-1 h-full min-w-0 ${
          activeConversation ? 'block' : 'hidden md:flex md:items-center md:justify-center'
        }`}
      >
        {activeConversation ? (
          <ChatThread
            conversation={activeConversation}
            onBackToList={handleBackToList}
          />
        ) : (
          <div className="p-8 text-center max-w-md mx-auto my-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-ink flex items-center justify-center mx-auto shadow-inner">
              <MessageSquare className="w-8 h-8 text-primary-dark" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-ink">
                {t('chat.title')}
              </h3>
              <p className="text-xs text-steel-500 leading-relaxed">
                {t('chat.select_conversation')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-steel-200 text-start space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{lang === 'fr' ? 'Messagerie directe sécurisée' : 'تواصل مباشر وموثوق'}</span>
              </div>
              <p className="text-[11px] text-steel-500 leading-normal">
                {lang === 'fr'
                  ? 'Discutez en temps réel des disponibilités, chauffeurs, et tarifs sans intermédiaire.'
                  : 'ناقش شروط الكراء وتوافر السائقين ومواعيد التوصيل مباشرة مع ملاك الآليات في مختلف مدن المغرب.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
