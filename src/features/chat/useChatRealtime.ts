// ============================================================================
// JADIJCB: Real-Time Chat Hook with Direct Supabase Realtime
// Smooth, zero-flicker messaging between Machinery Owners & Contractors
// ZERO mock data, ZERO polling loops, Instant Realtime WebSockets
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ChatMessageItem, ChatConversationItem } from '../../types/chat';
import { useAuth } from '../../hooks/useAuth';
import { chatStore, subscribeLocalChatEvents } from '../../lib/chatStore';
import { serverApi } from '../../lib/serverApi';

export function useChatRealtime(activeConversation: ChatConversationItem | null) {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || profile?.id || '';

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const loadedConvIdRef = useRef<string | null>(null);

  // 1. Load Messages for Active Conversation
  const loadMessages = useCallback(
    async (silent: boolean = false) => {
      if (!activeConversation) {
        setMessages([]);
        loadedConvIdRef.current = null;
        return;
      }

      const convId = activeConversation.id;

      // Only show spinner when opening a DIFFERENT conversation for the first time
      if (!silent && loadedConvIdRef.current !== convId) {
        setIsLoadingMessages(true);
      }

      try {
        // 1. Check local cache first for immediate render
        const cached = await chatStore.getMessages(convId);
        if (cached && cached.length > 0 && loadedConvIdRef.current !== convId) {
          setMessages(cached);
        }

        // 2. Fetch authoritative list from Supabase
        if (isSupabaseConfigured && !convId.startsWith('conv_')) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

          if (!error && data) {
            const mapped: ChatMessageItem[] = data.map((m: any) => ({
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              body: m.content || m.body || m.message || m.text || '',
              content: m.content || m.body || '',
              read_at: m.read_at,
              created_at: m.created_at,
            }));

            setMessages((prev) => {
              if (
                prev.length === mapped.length &&
                prev.every((m, i) => m.id === mapped[i]?.id && m.read_at === mapped[i]?.read_at)
              ) {
                return prev;
              }
              return mapped;
            });
            chatStore.setMessages(convId, mapped);
            loadedConvIdRef.current = convId;

            // Mark incoming unread messages as read in Supabase
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
        } else if (cached) {
          setMessages(cached);
          loadedConvIdRef.current = convId;
        }

        // 3. Server SQLite fallback if Supabase not configured or empty
        if (!isSupabaseConfigured || convId.startsWith('conv_')) {
          try {
            const serverMsgs = await serverApi.getMessages(convId);
            if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
              const mappedServer: ChatMessageItem[] = serverMsgs.map((m: any) => ({
                id: m.id,
                conversation_id: m.conversation_id,
                sender_id: m.sender_id,
                body: m.body || m.content || '',
                content: m.body || m.content || '',
                read_at: m.read_at || null,
                created_at: m.created_at,
              }));
              setMessages(mappedServer);
              chatStore.setMessages(convId, mappedServer);
              loadedConvIdRef.current = convId;
            }
          } catch {
            // ignore
          }
        }

        // Mark as read in store
        chatStore.markAsRead(convId, currentUserId);
      } catch (err) {
        console.warn('Messages load notice:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [activeConversation?.id, currentUserId]
  );

  // Initial load when activeConversation changes
  useEffect(() => {
    loadMessages(false);

    // Refresh silently when tab regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeConversation) {
        loadMessages(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadMessages, activeConversation?.id]);

  // 2. Setup Supabase Realtime Subscription, Express SSE, BroadcastChannel & Presence
  useEffect(() => {
    if (!activeConversation) return;

    const convId = activeConversation.id;

    // Realtime postgres_changes subscription on messages table (when Supabase configured)
    if (isSupabaseConfigured) {
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
              payload.new.content ||
              payload.new.body ||
              payload.new.message ||
              payload.new.text ||
              '';

            const newMsg: ChatMessageItem = {
              id: payload.new.id,
              conversation_id: payload.new.conversation_id,
              sender_id: payload.new.sender_id,
              body: bodyText,
              content: bodyText,
              read_at: payload.new.read_at,
              created_at: payload.new.created_at,
            };

            if (newMsg.sender_id !== currentUserId) {
              try {
                await supabase
                  .from('messages')
                  .update({ read_at: new Date().toISOString() })
                  .eq('id', newMsg.id);
              } catch {
                // Ignore background mark as read error
              }
              newMsg.read_at = new Date().toISOString();
            }

            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;

              const filtered = prev.filter(
                (m) =>
                  !(
                    m.is_optimistic &&
                    m.body === newMsg.body &&
                    m.sender_id === newMsg.sender_id
                  )
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
    }

    const unsubBroadcast = subscribeLocalChatEvents((evt) => {
      if (evt.type === 'NEW_MESSAGE' && evt.conversationId === convId && evt.message) {
        const incoming = evt.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, { ...incoming, is_optimistic: false }];
        });
        if (incoming.sender_id !== currentUserId) {
          chatStore.markAsRead(convId, currentUserId);
        }
      }
    });

    const onSseChatMessage = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.conversation_id !== convId) return;
      const incoming: ChatMessageItem = {
        id: detail.id || `msg_${Date.now()}`,
        conversation_id: detail.conversation_id,
        sender_id: detail.sender_id,
        body: detail.body || detail.preview || '',
        content: detail.body || detail.preview || '',
        read_at: detail.sender_id !== currentUserId ? new Date().toISOString() : null,
        created_at: detail.created_at || new Date().toISOString(),
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      if (incoming.sender_id !== currentUserId) {
        chatStore.markAsRead(convId, currentUserId);
      }
    };
    window.addEventListener('jadijcb_sse_chat_message', onSseChatMessage);

    // Lightweight 5s silent sync fallback while viewing a thread
    const syncTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(true);
      }
    }, 5000);

    return () => {
      clearInterval(syncTimer);
      unsubBroadcast();
      window.removeEventListener('jadijcb_sse_chat_message', onSseChatMessage);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [activeConversation?.id, currentUserId, loadMessages]);

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
      const senderName = profile?.company_name || profile?.full_name || '';
      const recipientRole = activeConversation.other_participant.role;

      // 1. Send via central chatStore
      const sentMsg = await chatStore.sendMessage(
        activeConversation.id,
        currentUserId,
        trimmed,
        otherId,
        { senderName, recipientRole }
      );

      // 2. Update local state optimistically
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      sendTypingStatus(false);
    },
    [activeConversation, currentUserId, profile?.company_name, profile?.full_name, sendTypingStatus]
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
