// ============================================================================
// JADIJCB: Global Real-Time Chat Message Alert Listener (Owners & Contractors)
// Plays audio chime + triggers phone notification drawer alert on incoming chat
// messages across Supabase Realtime, Express SQLite, and BroadcastChannel.
// ============================================================================

import React, { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  installAudioUnlocker,
  playChatMessageSound,
  showBrowserChatNotification,
} from '../../lib/opportunityAudio';
import {
  markPushKeySeenInSW,
  subscribeOwnerWebPush,
  syncServiceWorkerPushContext,
} from '../../lib/pushService';
import { chatStore, subscribeLocalChatEvents } from '../../lib/chatStore';
import { serverApi } from '../../lib/serverApi';
import { stripDispatchMarker } from '../../lib/dispatchService';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';

interface ChatAlertListenerProps {
  userId: string;
  userRole?: string;
  onNotificationsChanged?: () => void;
}

const SESSION_ALERTED_CHAT_KEY = 'jadijcb_session_alerted_chat_msgs';

function getAlertedChatIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_ALERTED_CHAT_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveAlertedChatId(id: string) {
  try {
    const set = getAlertedChatIds();
    set.add(id);
    sessionStorage.setItem(
      SESSION_ALERTED_CHAT_KEY,
      JSON.stringify(Array.from(set).slice(-200))
    );
  } catch {
    // ignore
  }
}

export const ChatAlertListener: React.FC<ChatAlertListenerProps> = ({
  userId,
  userRole = 'owner',
  onNotificationsChanged,
}) => {
  const { lang } = useLanguage();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  const alertedIdsRef = useRef<Set<string>>(getAlertedChatIds());
  const myConvIdsRef = useRef<Set<string>>(new Set());
  const senderNamesRef = useRef<Map<string, string>>(new Map());
  const sessionCutoffMsRef = useRef<number>(Date.now() - 15000);
  const onChangedRef = useRef(onNotificationsChanged);
  onChangedRef.current = onNotificationsChanged;

  const isContractor = userRole === 'client' || userRole === 'contractor';
  const messagesBaseRoute = isContractor ? '/entreprise/messages' : '/owner/messages';

  const resolveSenderName = useCallback(
    async (senderId?: string, hintName?: string): Promise<string> => {
      if (hintName && hintName.trim()) {
        if (senderId) senderNamesRef.current.set(senderId, hintName.trim());
        return hintName.trim();
      }
      if (!senderId) {
        return lang === 'fr' ? 'Nouveau message' : 'مستخدم JADIJCB';
      }
      const cached = senderNamesRef.current.get(senderId);
      if (cached) return cached;

      // Check local chatStore conversations
      try {
        const localConvs = await chatStore.getConversationsForUser(userId);
        const match = localConvs.find((c) => c.other_participant?.id === senderId);
        const localName =
          match?.other_participant?.company_name || match?.other_participant?.full_name;
        if (localName) {
          senderNamesRef.current.set(senderId, localName);
          return localName;
        }
      } catch {
        // ignore
      }

      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('full_name, company_name')
            .eq('id', senderId)
            .maybeSingle();
          const name = data?.company_name || data?.full_name;
          if (name) {
            senderNamesRef.current.set(senderId, name);
            return name;
          }
        } catch {
          // ignore
        }
      }

      return isContractor
        ? lang === 'fr'
          ? 'Propriétaire d’engin'
          : 'مالك الآلية'
        : lang === 'fr'
        ? 'Client / Entreprise'
        : 'مقاول / زبون';
    },
    [userId, isContractor, lang]
  );

  const triggerChatAlert = useCallback(
    async (params: {
      messageId: string;
      conversationId: string;
      senderId?: string;
      senderName?: string;
      rawBody: string;
    }) => {
      if (!params.messageId || !params.conversationId) return;
      if (params.senderId && params.senderId === userId) return;
      if (alertedIdsRef.current.has(params.messageId)) return;

      alertedIdsRef.current.add(params.messageId);
      saveAlertedChatId(params.messageId);
      markPushKeySeenInSW(params.messageId).catch(() => {});

      const cleanText = stripDispatchMarker(params.rawBody || '').trim();
      const preview =
        cleanText.length > 90
          ? cleanText.slice(0, 90) + '...'
          : cleanText || (lang === 'fr' ? 'Nouveau message reçu' : 'رسالة جديدة');

      const senderLabel = await resolveSenderName(params.senderId, params.senderName);
      const notifTitle =
        lang === 'fr'
          ? `Message de ${senderLabel} 💬`
          : `رسالة جديدة من ${senderLabel} 💬`;
      const targetUrl = `${messagesBaseRoute}?conv=${encodeURIComponent(
        params.conversationId
      )}`;

      // 1. Play crisp chat sound + mobile vibration in the receiver's app
      playChatMessageSound();

      // 2. Display OS / Mobile Notification Drawer alert (القائمة المنسدلة للهاتف)
      showBrowserChatNotification({
        title: notifTitle,
        body: preview,
        tag: `jadijcb-chat-${params.conversationId}`,
        url: targetUrl,
        messageId: params.messageId,
      }).catch(() => {});

      // 3. Refresh unread badges & notification list
      window.dispatchEvent(new CustomEvent('jadijcb_chat_unread_updated'));
      onChangedRef.current?.();

      // 4. Show in-app toast if user is not currently looking at this exact conversation
      const loc = locationRef.current;
      const isOnMessagesPage = loc.pathname.includes('/messages');
      let currentOpenConvId = '';
      try {
        const sp = new URLSearchParams(loc.search || window.location.search);
        currentOpenConvId = sp.get('conversationId') || sp.get('conv') || '';
      } catch {
        // ignore
      }
      const isViewingSameConv =
        isOnMessagesPage &&
        currentOpenConvId === params.conversationId &&
        document.visibilityState === 'visible';

      if (!isViewingSameConv) {
        toast.info(`${notifTitle}: ${preview}`, 5000);
      }
    },
    [userId, lang, messagesBaseRoute, resolveSenderName]
  );

  // Sync audio unlocker & SW push context / subscription for BOTH owners & contractors
  useEffect(() => {
    installAudioUnlocker();
  }, []);

  useEffect(() => {
    if (!userId) return;
    syncServiceWorkerPushContext(userId, userRole).catch(() => {});
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      subscribeOwnerWebPush(userId, userRole).catch(() => {});
    }
  }, [userId, userRole]);

  // Seed user's known conversation IDs so Realtime message inserts validate fast
  const refreshMyConversations = useCallback(async () => {
    if (!userId) return;
    try {
      const localConvs = await chatStore.getConversationsForUser(userId);
      localConvs.forEach((c) => {
        if (c.id) myConvIdsRef.current.add(c.id);
        if (c.other_participant?.id) {
          const name = c.other_participant.company_name || c.other_participant.full_name;
          if (name) senderNamesRef.current.set(c.other_participant.id, name);
        }
      });

      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('conversations')
          .select('id')
          .or(
            `participant_a.eq.${userId},participant_b.eq.${userId},participant_one.eq.${userId},participant_two.eq.${userId}`
          );
        if (Array.isArray(data)) {
          data.forEach((c: any) => {
            if (c?.id) myConvIdsRef.current.add(c.id);
          });
        }
      }
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refreshMyConversations();

    // 1. Same-browser BroadcastChannel listener
    const unsubBroadcast = subscribeLocalChatEvents((evt) => {
      if (
        evt.type === 'NEW_MESSAGE' &&
        evt.message &&
        evt.senderId !== userId &&
        (!evt.recipientId || evt.recipientId === userId)
      ) {
        myConvIdsRef.current.add(evt.conversationId);
        triggerChatAlert({
          messageId: evt.message.id,
          conversationId: evt.conversationId,
          senderId: evt.senderId,
          senderName: evt.senderName,
          rawBody: evt.message.body || evt.message.content || '',
        });
      }
    });

    // 2. Supabase Realtime listeners on messages, conversations, and notifications
    let rtChannel: any = null;
    if (isSupabaseConfigured) {
      rtChannel = supabase
        .channel(`global_chat_alerts_${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations' },
          (payload: any) => {
            const row = payload?.new;
            if (
              row?.id &&
              (row.participant_a === userId ||
                row.participant_b === userId ||
                row.participant_one === userId ||
                row.participant_two === userId)
            ) {
              myConvIdsRef.current.add(row.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload: any) => {
            const row = payload?.new;
            if (!row?.id || !row?.conversation_id) return;
            if (row.sender_id === userId) return;

            const rawText = String(row.content || row.body || row.message || row.text || '');
            // Raw InDrive dispatch launch messages are handled with celebratory sound in OpportunityAlertListener for owners
            if (!isContractor && rawText.includes('[JADIJCB_DISPATCH:')) {
              return;
            }

            // Confirm conversation belongs to current user
            let isMine = myConvIdsRef.current.has(row.conversation_id);
            if (!isMine) {
              try {
                const { data: convRow } = await supabase
                  .from('conversations')
                  .select('id, participant_a, participant_b, participant_one, participant_two')
                  .eq('id', row.conversation_id)
                  .maybeSingle();
                if (
                  convRow &&
                  (convRow.participant_a === userId ||
                    convRow.participant_b === userId ||
                    convRow.participant_one === userId ||
                    convRow.participant_two === userId)
                ) {
                  isMine = true;
                  myConvIdsRef.current.add(convRow.id);
                }
              } catch {
                // ignore
              }
            }

            if (!isMine) return;

            triggerChatAlert({
              messageId: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              rawBody: rawText,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            const row = payload?.new;
            if (!row || row.type !== 'chat_message') return;
            const data = row.data || {};
            if (data.sender_id === userId) return;

            const msgId = data.message_id || row.id;
            const convId = data.conversation_id;
            if (!convId) return;

            myConvIdsRef.current.add(convId);
            triggerChatAlert({
              messageId: msgId,
              conversationId: convId,
              senderId: data.sender_id,
              senderName: data.sender_name,
              rawBody: row.body_ar || row.body_fr || '',
            });
          }
        )
        .subscribe();
    }

    // 3. Fallback poll on Express SQLite /api/notifications (for local/SQLite messages or missed WS frames)
    const pollChatNotifications = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await serverApi.getNotifications({
          user_id: userId,
          role: userRole,
          unread_only: true,
        });
        const list = res.notifications || [];
        for (const n of list) {
          if (n.type !== 'chat_message' || n.is_read) continue;
          const createdMs = n.created_at ? new Date(n.created_at).getTime() : 0;
          if (createdMs && createdMs < sessionCutoffMsRef.current) continue;

          const data = n.data || {};
          if (data.sender_id === userId) continue;
          const msgId = data.message_id || n.id;
          const convId = data.conversation_id;
          if (!convId) continue;

          await triggerChatAlert({
            messageId: msgId,
            conversationId: convId,
            senderId: data.sender_id,
            senderName: data.sender_name,
            rawBody: n.body_ar || n.body_fr || '',
          });
        }
      } catch {
        // ignore fallback polling errors
      }
    };

    const pollInterval = setInterval(pollChatNotifications, 6000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncServiceWorkerPushContext(userId, userRole).catch(() => {});
        pollChatNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubBroadcast();
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
      if (rtChannel) {
        supabase.removeChannel(rtChannel);
      }
    };
  }, [userId, userRole, isContractor, refreshMyConversations, triggerChatAlert]);

  return null;
};

export default ChatAlertListener;
