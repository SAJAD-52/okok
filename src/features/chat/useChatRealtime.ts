// ============================================================================
// JADIJCB: Real-Time Chat Hook with Supabase Realtime & Presence
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ChatMessageItem, ChatConversationItem } from '../../types/chat';
import { useAuth } from '../../hooks/useAuth';

export function useChatRealtime(activeConversation: ChatConversationItem | null) {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || profile?.id || 'current-user-demo';

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  // 1. Load Initial Messages for Active Conversation
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    async function fetchMessages() {
      const currentConv = activeConversation;
      if (!currentConv) return;

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', currentConv.id)
            .order('created_at', { ascending: true });

          if (!error && data && isMounted) {
            const mapped: ChatMessageItem[] = data.map((m: any) => ({
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              body: m.body || m.content || '',
              read_at: m.read_at,
              created_at: m.created_at,
            }));
            setMessages(mapped);

            // Mark incoming unread messages as read
            const unreadIds = data
              .filter((m: any) => m.sender_id !== currentUserId && !m.read_at)
              .map((m: any) => m.id);

            if (unreadIds.length > 0) {
              await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', unreadIds);
            }
          }
        } catch (err) {
          console.warn('Realtime messages load notice:', err);
        } finally {
          if (isMounted) setIsLoadingMessages(false);
        }
      } else {
        // High fidelity demo seed messages
        const initialSeed: ChatMessageItem[] = [
          {
            id: 'demo_msg_1',
            conversation_id: currentConv.id,
            sender_id: currentConv.other_participant.id,
            body: 'السلام عليكم ورحمة الله، بخصوص الآلية المعروضة للكراء في الدار البيضاء، هل تتوفر مع سائق معتمد للأسبوع القادم؟',
            read_at: new Date(Date.now() - 3600 * 1000).toISOString(),
            created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          },
          {
            id: 'demo_msg_2',
            conversation_id: currentConv.id,
            sender_id: currentUserId,
            body: 'وعليكم السلام، نعم أخي الآلية جاهزة وسائقنا معتمد ويتوفر على رخصة السياقة المهنية وبطاقة السلامة. متى تاريخ انطلاق الورش؟',
            read_at: new Date(Date.now() - 1800 * 1000).toISOString(),
            created_at: new Date(Date.now() - 1800 * 1000).toISOString(),
          },
          {
            id: 'demo_msg_3',
            conversation_id: currentConv.id,
            sender_id: currentConv.other_participant.id,
            body: 'ممتاز! نود بدء العمل يوم الإثنين بورش سيدي معروف لمدة أسبوعين. هل السعر يشمل نقل الآلية إلى الورش؟',
            read_at: null,
            created_at: new Date(Date.now() - 600 * 1000).toISOString(),
          },
        ];
        setMessages(initialSeed);
        setIsLoadingMessages(false);
      }
    }

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [activeConversation?.id, currentUserId]);

  // 2. Setup Supabase Realtime Subscription & Presence for Active Conversation
  useEffect(() => {
    if (!activeConversation || !isSupabaseConfigured) return;

    const convId = activeConversation.id;

    // A. Realtime postgres_changes subscription on messages
    const messageChannel = supabase
      .channel(`chat:conv:${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        async (payload: any) => {
          const newMsg: ChatMessageItem = {
            id: payload.new.id,
            conversation_id: payload.new.conversation_id,
            sender_id: payload.new.sender_id,
            body: payload.new.body,
            read_at: payload.new.read_at,
            created_at: payload.new.created_at,
          };

          // Mark as read immediately if it's from the other participant
          if (newMsg.sender_id !== currentUserId) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
            newMsg.read_at = new Date().toISOString();
          }

          setMessages((prev) => {
            // Avoid duplicate if optimistic insert
            const exists = prev.some((m) => m.id === newMsg.id);
            if (exists) return prev;
            // Remove matching optimistic message
            const filtered = prev.filter(
              (m) => !(m.is_optimistic && m.body === newMsg.body && m.sender_id === newMsg.sender_id)
            );
            return [...filtered, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload: any) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m
            )
          );
        }
      )
      .subscribe();

    channelRef.current = messageChannel;

    // B. Realtime Presence for Typing Indicator
    const presenceChannel = supabase.channel(`presence:conv:${convId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let peerIsTyping = false;

        Object.keys(state).forEach((key) => {
          if (key !== currentUserId) {
            const userStates = state[key] as any[];
            if (userStates?.some((u) => u.isTyping)) {
              peerIsTyping = true;
            }
          }
        });

        setIsPeerTyping(peerIsTyping);
      })
      .subscribe();

    presenceChannelRef.current = presenceChannel;

    // Cleanup channels on unmount or conversation change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [activeConversation?.id, currentUserId]);

  // 3. Broadcast Typing Indicator via Presence
  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (presenceChannelRef.current && isSupabaseConfigured) {
        presenceChannelRef.current.track({
          isTyping,
          user_id: currentUserId,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          if (presenceChannelRef.current && isSupabaseConfigured) {
            presenceChannelRef.current.track({
              isTyping: false,
              user_id: currentUserId,
            });
          }
        }, 3000);
      }
    },
    [currentUserId]
  );

  // 4. Send Message (Optimistic Send)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeConversation || !text.trim()) return;

      const trimmed = text.trim();
      const optimisticId = 'opt_' + Date.now();

      const optimisticMsg: ChatMessageItem = {
        id: optimisticId,
        conversation_id: activeConversation.id,
        sender_id: currentUserId,
        body: trimmed,
        read_at: null,
        created_at: new Date().toISOString(),
        is_optimistic: true,
      };

      // 1. Optimistic UI update
      setMessages((prev) => [...prev, optimisticMsg]);
      sendTypingStatus(false);

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('messages')
            .insert({
              conversation_id: activeConversation.id,
              sender_id: currentUserId,
              body: trimmed,
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to send message:', error);
            // Rollback optimistic
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            return;
          }

          if (data) {
            // Update conversation last_message_at
            await supabase
              .from('conversations')
              .update({ last_message_at: new Date().toISOString() })
              .eq('id', activeConversation.id);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId ? { ...m, id: data.id, is_optimistic: false } : m
              )
            );
          }
        } catch (err) {
          console.error('Send message exception:', err);
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
      } else {
        // Demo sandbox: simulate peer reply after 2 seconds
        setTimeout(() => {
          const peerReply: ChatMessageItem = {
            id: 'sim_reply_' + Date.now(),
            conversation_id: activeConversation.id,
            sender_id: activeConversation.other_participant.id,
            body: 'تمام أخي، سنتواصل معكم هاتفياً لترتيب العقد ووصول السائق في الموعد المحدد.',
            read_at: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, peerReply]);
        }, 2200);
      }
    },
    [activeConversation, currentUserId, sendTypingStatus]
  );

  return {
    messages,
    isLoadingMessages,
    isPeerTyping,
    sendMessage,
    sendTypingStatus,
  };
}

export default useChatRealtime;
