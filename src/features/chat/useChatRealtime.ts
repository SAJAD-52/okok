// ============================================================================
// JADIJCB: Real-Time Chat Hook with Supabase Realtime & Resilient Store
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ChatMessageItem, ChatConversationItem } from '../../types/chat';
import { useAuth } from '../../hooks/useAuth';
import { chatStore } from '../../lib/chatStore';

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
  const loadMessages = useCallback(async () => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    const convId = activeConversation.id;

    try {
      // 1. Load from chatStore local cache first (immediate UI render)
      const cached = await chatStore.getMessages(convId);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }

      // 2. Fetch fresh from Supabase if configured and valid UUID
      if (isSupabaseConfigured && !convId.startsWith('conv_seed_') && !convId.startsWith('conv_new_')) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped: ChatMessageItem[] = data.map((m: any) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            body: m.body || m.content || m.message || m.text || '',
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
      }

      // Mark as read in store
      chatStore.markAsRead(convId, currentUserId);
    } catch (err) {
      console.warn('Realtime messages load notice:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeConversation?.id, currentUserId]);

  useEffect(() => {
    loadMessages();

    // 1. Heartbeat poll every 2.5s to ensure messages arrive even if Realtime WebSockets are pending/unreplicated
    const pollTimer = setInterval(() => {
      loadMessages();
    }, 2500);

    // 2. Window custom event
    const handleChatEvent = () => {
      loadMessages();
    };
    window.addEventListener('jadijcb_chat_event', handleChatEvent);

    // 3. Cross-tab storage event
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'jadijcb_chat_messages' || e.key === 'jadijcb_chat_conversations') {
        loadMessages();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('jadijcb_chat_event', handleChatEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [loadMessages]);

  // 2. Setup Supabase Realtime Subscription & Presence for Active Conversation
  useEffect(() => {
    if (!activeConversation || !isSupabaseConfigured) return;

    const convId = activeConversation.id;

    // Realtime postgres_changes subscription on messages
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
          const bodyText =
            payload.new.body ||
            payload.new.content ||
            payload.new.message ||
            payload.new.text ||
            '';

          const newMsg: ChatMessageItem = {
            id: payload.new.id,
            conversation_id: payload.new.conversation_id,
            sender_id: payload.new.sender_id,
            body: bodyText,
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
            const exists = prev.some((m) => m.id === newMsg.id);
            if (exists) return prev;
            const filtered = prev.filter(
              (m) => !(m.is_optimistic && m.body === newMsg.body && m.sender_id === newMsg.sender_id)
            );
            return [...filtered, newMsg];
          });

          chatStore.markAsRead(convId, currentUserId);
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

    // Realtime Presence for Typing Indicator
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

  // 4. Send Message (Optimistic Send + chatStore + Supabase sync)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeConversation || !text.trim()) return;

      const trimmed = text.trim();
      const otherId = activeConversation.other_participant.id;

      // 1. Send via central chatStore (handles local sync, events, and DB persistence)
      const sentMsg = await chatStore.sendMessage(
        activeConversation.id,
        currentUserId,
        trimmed,
        otherId
      );

      // 2. Update local state
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      sendTypingStatus(false);
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
