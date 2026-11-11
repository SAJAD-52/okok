// ============================================================================
// JADIJCB: Real-Time Messages Page (Dual-Sided: Owners ↔ Contractors)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles, Truck, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { ChatConversationItem, ChatParticipant } from '../types/chat';
import { Machine } from '../types/database';
import { chatStore } from '../lib/chatStore';
import { machineStore } from '../lib/machineStore';
import { serverApi } from '../lib/serverApi';
import { ConversationList } from '../features/chat/ConversationList';
import { ChatThread } from '../features/chat/ChatThread';

export const Messages: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentUserId = user?.id || profile?.id || 'current-user-demo';

  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Fetch Conversations from chatStore and Supabase
  const loadConversations = useCallback(async () => {
    setIsLoading(true);

    try {
      // Load from chatStore
      const storeList = await chatStore.getConversationsForUser(currentUserId);
      let combined: ChatConversationItem[] = [...storeList];

      // Pull from server SQLite database
      try {
        const sConvs = await serverApi.getConversations(currentUserId);
        if (sConvs && sConvs.length > 0) {
          for (const sc of sConvs) {
            const existingIdx = combined.findIndex((x) => x.id === sc.id);
            const otherId = sc.participant_a === currentUserId ? sc.participant_b : sc.participant_a;
            const item: ChatConversationItem = {
              id: sc.id,
              machine_id: sc.machine_id,
              participant_a: sc.participant_a,
              participant_b: sc.participant_b,
              last_message_at: sc.last_message_at || new Date().toISOString(),
              unread_count: 0,
              last_message: sc.last_message || '',
              other_participant: sc.target_profile || {
                id: otherId,
                full_name: 'شريك JADIJCB',
                phone: '+212600000000',
                role: 'owner',
                city: 'المغرب',
              },
              machine: sc.machine,
            };
            if (existingIdx >= 0) {
              combined[existingIdx] = { ...combined[existingIdx], ...item };
            } else {
              combined.unshift(item);
            }
          }
        }
      } catch {
        // Ignore server fallback error
      }

      // Pull from Supabase if configured
      if (isSupabaseConfigured && currentUserId) {
        try {
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('id, machine_id, participant_a, participant_b, last_message_at')
            .or(`participant_a.eq.${currentUserId},participant_b.eq.${currentUserId}`)
            .order('last_message_at', { ascending: false });

          if (!convError && convData && convData.length > 0) {
            const mapped: ChatConversationItem[] = await Promise.all(
              convData.map(async (c: any) => {
                const otherId = c.participant_a === currentUserId ? c.participant_b : c.participant_a;

                const { data: otherProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', otherId)
                  .maybeSingle();

                let machineData: Machine | undefined = undefined;
                if (c.machine_id) {
                  try {
                    const { data: mData } = await supabase
                      .from('machines')
                      .select('*')
                      .eq('id', c.machine_id)
                      .maybeSingle();
                    if (mData) {
                      machineData = mData as Machine;
                    }
                  } catch (e) {
                    // Ignore machine fetch error
                  }
                }

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
                  phone: otherProfile?.phone || otherProfile?.phone_number || '+212600000000',
                  full_name: otherProfile?.full_name || 'شريك JADIJCB',
                  company_name: otherProfile?.company_name,
                  role: otherProfile?.role || 'owner',
                  city: otherProfile?.city || 'المغرب',
                  avatar_url: otherProfile?.avatar_url,
                };

                const latestMsg =
                  msgList?.[0]?.body ||
                  msgList?.[0]?.content ||
                  msgList?.[0]?.message ||
                  msgList?.[0]?.text ||
                  '';

                return {
                  id: c.id,
                  machine_id: c.machine_id,
                  participant_a: c.participant_a,
                  participant_b: c.participant_b,
                  last_message_at: c.last_message_at || new Date().toISOString(),
                  other_participant: otherParticipant,
                  machine: machineData,
                  unread_count: unreadCount || 0,
                  last_message: latestMsg,
                };
              })
            );

            for (const item of mapped) {
              const existingIdx = combined.findIndex((x) => x.id === item.id);
              if (existingIdx >= 0) {
                combined[existingIdx] = item;
              } else {
                combined.unshift(item);
              }
            }
          }
        } catch (dbErr) {
          console.warn('Realtime Supabase conversations notice:', dbErr);
        }
      }

      setConversations(combined);
      return combined;
    } catch (err) {
      console.warn('Failed to load conversations:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    let isMounted = true;

    async function initSelection() {
      const loaded = await loadConversations();
      if (!isMounted) return;

      // Extract all possible query parameters
      const urlConvId = searchParams.get('conversationId') || searchParams.get('conv');
      const urlMachineId =
        searchParams.get('machine_id') ||
        searchParams.get('machineId') ||
        searchParams.get('machine');
      const targetUserId =
        searchParams.get('target_user') ||
        searchParams.get('target') ||
        searchParams.get('user_id') ||
        searchParams.get('userId') ||
        searchParams.get('client_id') ||
        searchParams.get('owner_id');

      // 1. Direct conversation ID
      if (urlConvId) {
        const found = loaded.find((c) => c.id === urlConvId);
        if (found) {
          setActiveConversation(found);
          return;
        }
      }

      // 2. Direct Target User or Machine context
      if (targetUserId || urlMachineId) {
        // Look for matching conversation in loaded list
        const matching = loaded.find(
          (c) =>
            (targetUserId &&
              (c.other_participant.id === targetUserId ||
                c.participant_a === targetUserId ||
                c.participant_b === targetUserId)) ||
            (urlMachineId && (c.machine_id === urlMachineId || c.machine?.id === urlMachineId))
        );

        if (matching) {
          setActiveConversation(matching);
          return;
        }

        // Fetch machine or target user profile to create a clean new conversation
        let targetMachine: any = null;
        let targetProfile: any = null;

        if (urlMachineId) {
          if (isSupabaseConfigured) {
            try {
              const { data: mData } = await supabase
                .from('machines')
                .select('*, profiles(*)')
                .eq('id', urlMachineId)
                .maybeSingle();
              if (mData) {
                targetMachine = mData;
                targetProfile = mData.profiles;
              }
            } catch (e) {
              console.warn('Machine fetch error:', e);
            }
          }

          if (!targetMachine) {
            const cachedM = machineStore.getCachedMachines().find((m) => m.id === urlMachineId);
            if (cachedM) {
              targetMachine = cachedM;
              targetProfile = cachedM.owner;
            }
          }
        }

        if (targetUserId && !targetProfile && isSupabaseConfigured) {
          try {
            const { data: pData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', targetUserId)
              .maybeSingle();
            if (pData) {
              targetProfile = pData;
            }
          } catch (e) {
            console.warn('Profile fetch error:', e);
          }
        }

        const effectiveTargetId = targetUserId || targetMachine?.owner_id || 'partner_user';
        const newConv = await chatStore.getOrCreateConversation(
          currentUserId,
          effectiveTargetId,
          targetMachine,
          targetProfile
        );

        setConversations((prev) => {
          if (prev.some((c) => c.id === newConv.id)) return prev;
          return [newConv, ...prev];
        });
        setActiveConversation(newConv);
        return;
      }

      // 3. Desktop default: select first conversation if available
      if (window.innerWidth >= 768 && loaded.length > 0 && !activeConversation) {
        setActiveConversation(loaded[0]);
      }
    }

    initSelection();

    // Heartbeat poll for conversations every 3s
    const pollInterval = setInterval(() => {
      loadConversations();
    }, 3000);

    // Listen to local chat events
    const handleChatEvent = () => {
      loadConversations();
    };
    window.addEventListener('jadijcb_chat_event', handleChatEvent);

    // Cross-tab storage sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'jadijcb_chat_messages' || e.key === 'jadijcb_chat_conversations') {
        loadConversations();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('jadijcb_chat_event', handleChatEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [loadConversations, searchParams, currentUserId]);

  // Global Realtime Subscription on Conversations table
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
    chatStore.markAsRead(conv.id, currentUserId);

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
                {lang === 'fr' ? 'Messagerie Directe BTP & Engins' : 'نظام المحادثات المباشرة بين الملاك والمقاولات'}
              </h3>
              <p className="text-xs text-steel-500 leading-relaxed">
                {lang === 'fr'
                  ? 'Sélectionnez une discussion pour échanger en direct avec le loueur ou le client.'
                  : 'اختر محادثة من القائمة للتواصل الفوري ومناقشة تفاصيل الكراء وجدولة الآليات.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-steel-200 text-start space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{lang === 'fr' ? 'Messagerie directe sécurisée' : 'تواصل ميداني فوري وموثوق'}</span>
              </div>
              <p className="text-[11px] text-steel-500 leading-normal">
                {lang === 'fr'
                  ? 'Discutez en temps réel des disponibilités, chauffeurs, et tarifs sans intermédiaire.'
                  : 'ناقش شروط الكراء وتوافر السائقين ومواعيد التوصيل للورش مباشرة مع الشركاء في كافة مدن المغرب.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
