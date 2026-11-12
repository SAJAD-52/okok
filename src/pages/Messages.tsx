// ============================================================================
// JADIJCB: Real-Time Messages Page (Dual-Sided: Owners ↔ Contractors)
// 100% Real Supabase Architecture
// ZERO mock messages, ZERO reload loops, ZERO flickering
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Sparkles, Truck, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { ChatConversationItem, ChatParticipant } from '../types/chat';
import { Machine } from '../types/database';
import { chatStore } from '../lib/chatStore';
import { machineStore } from '../lib/machineStore';
import { ConversationList } from '../features/chat/ConversationList';
import { ChatThread } from '../features/chat/ChatThread';

export const Messages: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const currentUserId = user?.id || profile?.id || '';

  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initialParsedRef = useRef<boolean>(false);
  const activeConvIdRef = useRef<string | null>(null);

  // Keep activeConvIdRef in sync
  useEffect(() => {
    activeConvIdRef.current = activeConversation?.id || null;
  }, [activeConversation]);

  // 1. Fetch Conversations from Supabase (Batched, robust, no flickering)
  const loadConversations = useCallback(
    async (silent: boolean = false): Promise<ChatConversationItem[]> => {
      if (!currentUserId) {
        setIsLoading(false);
        return [];
      }

      if (!silent && !initialParsedRef.current) {
        setIsLoading(true);
      }

      try {
        let resultList: ChatConversationItem[] = [];

        if (isSupabaseConfigured) {
          // Supports both participant_a/b and participant_one/two
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('id, machine_id, participant_a, participant_b, participant_one, participant_two, last_message_at')
            .or(
              `participant_a.eq.${currentUserId},participant_b.eq.${currentUserId},participant_one.eq.${currentUserId},participant_two.eq.${currentUserId}`
            )
            .order('last_message_at', { ascending: false });

          if (!convError && convData && convData.length > 0) {
            // Collect other participants IDs
            const otherIds = Array.from(
              new Set(
                convData
                  .map((c: any) => {
                    const pA = c.participant_a || c.participant_one;
                    const pB = c.participant_b || c.participant_two;
                    return pA === currentUserId ? pB : pA;
                  })
                  .filter(Boolean)
              )
            );

            // Collect machine IDs
            const machineIds = Array.from(
              new Set(convData.map((c: any) => c.machine_id).filter(Boolean))
            );

            const convIds = convData.map((c: any) => c.id);

            // Parallel batch queries for profiles, machines, latest messages, and unread counts
            const [profilesRes, machinesRes, messagesRes, unreadRes] = await Promise.all([
              otherIds.length > 0
                ? supabase.from('profiles').select('*').in('id', otherIds)
                : Promise.resolve({ data: [] }),
              machineIds.length > 0
                ? supabase.from('machines').select('*').in('id', machineIds)
                : Promise.resolve({ data: [] }),
              convIds.length > 0
                ? supabase
                    .from('messages')
                    .select('conversation_id, content, body, created_at')
                    .in('conversation_id', convIds)
                    .order('created_at', { ascending: false })
                : Promise.resolve({ data: [] }),
              convIds.length > 0
                ? supabase
                    .from('messages')
                    .select('conversation_id')
                    .in('conversation_id', convIds)
                    .neq('sender_id', currentUserId)
                    .is('read_at', null)
                : Promise.resolve({ data: [] }),
            ]);

            const profilesMap = new Map<string, any>();
            (profilesRes.data || []).forEach((p: any) => profilesMap.set(p.id, p));

            const machinesMap = new Map<string, any>();
            (machinesRes.data || []).forEach((m: any) => machinesMap.set(m.id, m));

            const latestMessageMap = new Map<string, string>();
            (messagesRes.data || []).forEach((m: any) => {
              if (!latestMessageMap.has(m.conversation_id)) {
                latestMessageMap.set(m.conversation_id, m.content || m.body || '');
              }
            });

            const unreadCounts = new Map<string, number>();
            (unreadRes.data || []).forEach((m: any) => {
              unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) || 0) + 1);
            });

            resultList = convData.map((c: any) => {
              const pA = c.participant_a || c.participant_one;
              const pB = c.participant_b || c.participant_two;
              const otherId = pA === currentUserId ? pB : pA;

              const otherProfile = profilesMap.get(otherId);
              const machineData = c.machine_id ? machinesMap.get(c.machine_id) : undefined;
              const unreadCount = unreadCounts.get(c.id) || 0;
              const lastMsgText = latestMessageMap.get(c.id) || '';

              const otherParticipant: ChatParticipant = {
                id: otherId,
                phone: otherProfile?.phone || otherProfile?.phone_number || '',
                full_name:
                  otherProfile?.full_name ||
                  otherProfile?.company_name ||
                  (otherProfile?.role === 'owner' ? 'مالك الآلية' : 'مقاولة البناء'),
                company_name: otherProfile?.company_name,
                role: otherProfile?.role || 'owner',
                city: otherProfile?.city || 'المغرب',
                avatar_url: otherProfile?.avatar_url,
              };

              return {
                id: c.id,
                machine_id: c.machine_id,
                participant_a: pA,
                participant_b: pB,
                last_message_at: c.last_message_at || new Date().toISOString(),
                other_participant: otherParticipant,
                machine: machineData as Machine,
                unread_count: unreadCount,
                last_message: lastMsgText,
              };
            });
          }
        }

        // Offline fallback
        if (resultList.length === 0) {
          resultList = await chatStore.getConversationsForUser(currentUserId);
        } else {
          chatStore.setConversations(resultList);
        }

        setConversations(resultList);

        // Keep active conversation reference in sync if already selected
        if (activeConvIdRef.current) {
          const updatedActive = resultList.find((c) => c.id === activeConvIdRef.current);
          if (updatedActive) {
            setActiveConversation((prev) =>
              prev ? { ...prev, ...updatedActive, unread_count: 0 } : updatedActive
            );
          }
        }

        return resultList;
      } catch (err) {
        console.warn('Failed to load conversations:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId]
  );

  // 2. Initial Mount Setup (Runs strictly ONCE per userId, NEVER in a loop)
  useEffect(() => {
    let isMounted = true;

    async function initSelection() {
      if (!currentUserId) return;

      const loaded = await loadConversations(false);
      if (!isMounted) return;

      initialParsedRef.current = true;

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

      // 1. Direct conversation ID match
      if (urlConvId) {
        const found = loaded.find((c) => c.id === urlConvId);
        if (found) {
          setActiveConversation(found);
          return;
        }
      }

      // 2. Target user or machine context navigation
      if (targetUserId || urlMachineId) {
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

        if (urlMachineId && isSupabaseConfigured) {
          try {
            const { data: mData } = await supabase
              .from('machines')
              .select('*')
              .eq('id', urlMachineId)
              .maybeSingle();
            if (mData) {
              targetMachine = mData;
            }
          } catch (e) {
            console.warn('Machine fetch error:', e);
          }

          if (!targetMachine) {
            targetMachine = machineStore.getCachedMachines().find((m) => m.id === urlMachineId);
          }
        }

        const effectiveTargetId = targetUserId || targetMachine?.owner_id;

        if (effectiveTargetId && effectiveTargetId !== currentUserId) {
          if (isSupabaseConfigured) {
            try {
              const { data: pData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', effectiveTargetId)
                .maybeSingle();
              if (pData) {
                targetProfile = pData;
              }
            } catch (e) {
              console.warn('Profile fetch error:', e);
            }
          }

          const newConv = await chatStore.getOrCreateConversation(
            currentUserId,
            effectiveTargetId,
            targetMachine,
            targetProfile
          );

          if (isMounted) {
            setConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
            setActiveConversation(newConv);
          }
          return;
        }
      }

      // 3. Desktop default: select first conversation if none selected
      if (window.innerWidth >= 768 && loaded.length > 0 && !activeConversation) {
        setActiveConversation(loaded[0]);
      }
    }

    initSelection();

    // Re-sync silently only when tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadConversations(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUserId]);

  // 3. Supabase Realtime Subscriptions on Conversations & Messages
  useEffect(() => {
    if (!isSupabaseConfigured || !currentUserId) return;

    const channel = supabase
      .channel('chat:realtime_hub')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (
            row &&
            (row.participant_a === currentUserId ||
              row.participant_b === currentUserId ||
              row.participant_one === currentUserId ||
              row.participant_two === currentUserId)
          ) {
            loadConversations(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg?.conversation_id) return;

          // In-memory update of snippet and counter (instant, zero reload)
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === newMsg.conversation_id) {
                const isFromOther = newMsg.sender_id !== currentUserId;
                const isCurrentlyActive = activeConvIdRef.current === c.id;
                return {
                  ...c,
                  last_message: newMsg.content || newMsg.body || c.last_message,
                  last_message_at: newMsg.created_at || new Date().toISOString(),
                  unread_count:
                    isFromOther && !isCurrentlyActive
                      ? (c.unread_count || 0) + 1
                      : isCurrentlyActive
                      ? 0
                      : c.unread_count,
                };
              }
              return c;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations]);

  // Handle selecting conversation without triggering router reload loop
  const handleSelectConversation = (conv: ChatConversationItem) => {
    setActiveConversation(conv);
    chatStore.markAsRead(conv.id, currentUserId);

    // Update URL silently without React Router reload
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('conversationId', conv.id);
      newUrl.searchParams.delete('target');
      newUrl.searchParams.delete('target_user');
      newUrl.searchParams.delete('machine');
      newUrl.searchParams.delete('machine_id');
      window.history.replaceState({}, '', newUrl.toString());
    } catch {
      // Ignore
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const handleBackToList = () => {
    setActiveConversation(null);
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('conversationId');
      window.history.replaceState({}, '', newUrl.toString());
    } catch {
      // Ignore
    }
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
