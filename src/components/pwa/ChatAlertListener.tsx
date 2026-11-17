// ============================================================================
// JADIJCB: Global Real-Time Chat Message Alert Listener (Owners & Contractors)
// Multi-channel delivery: Express SSE + Supabase Realtime + BroadcastChannel +
// Direct Supabase & SQLite Unread Polling + Phone Notification Drawer + Sound
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, BellRing, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  installAudioUnlocker,
  playChatMessageSound,
  showBrowserChatNotification,
  unlockAudioContextNow,
} from '../../lib/opportunityAudio';
import {
  markPushKeySeenInSW,
  registerOwnerPushNotifications,
  subscribeOwnerWebPush,
  syncServiceWorkerPushContext,
} from '../../lib/pushService';
import { chatStore, subscribeLocalChatEvents } from '../../lib/chatStore';
import { serverApi, isServerBackendAvailable } from '../../lib/serverApi';
import { stripDispatchMarker } from '../../lib/dispatchService';
import { useLanguage } from '../../hooks/useLanguage';

interface ChatAlertListenerProps {
  userId: string;
  userRole?: string;
  onNotificationsChanged?: () => void;
}

interface FloatingChatBanner {
  messageId: string;
  conversationId: string;
  senderName: string;
  preview: string;
  targetUrl: string;
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
      JSON.stringify(Array.from(set).slice(-250))
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
  const navigate = useNavigate();
  const locationRef = useRef(location);
  locationRef.current = location;

  const [floatingBanner, setFloatingBanner] = useState<FloatingChatBanner | null>(null);
  const [permState, setPermState] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const alertedIdsRef = useRef<Set<string>>(getAlertedChatIds());
  const baselineDoneRef = useRef<boolean>(false);
  const myConvIdsRef = useRef<Set<string>>(new Set());
  const senderNamesRef = useRef<Map<string, string>>(new Map());
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangedRef = useRef(onNotificationsChanged);
  onChangedRef.current = onNotificationsChanged;

  const isContractor = userRole === 'client' || userRole === 'contractor';
  const isDriver = userRole === 'driver';
  const messagesBaseRoute = isDriver
    ? '/driver/messages'
    : isContractor
    ? '/entreprise/messages'
    : '/owner/messages';

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
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermState(Notification.permission);
        if (Notification.permission === 'granted') {
          showBrowserChatNotification({
            title: notifTitle,
            body: preview,
            tag: `jadijcb-chat-${params.conversationId}`,
            url: targetUrl,
            messageId: params.messageId,
          }).catch(() => {});
        }
      }

      // 3. Refresh unread badges & notification dropdown list
      window.dispatchEvent(new CustomEvent('jadijcb_chat_unread_updated'));
      onChangedRef.current?.();

      // 4. Show interactive floating banner when not actively reading that exact conversation
      const loc = locationRef.current;
      const isOnMessagesPage = loc.pathname.includes('/messages');
      let currentOpenConvId = '';
      try {
        const sp = new URLSearchParams(window.location.search || loc.search);
        currentOpenConvId = sp.get('conversationId') || sp.get('conv') || '';
      } catch {
        // ignore
      }
      const isViewingSameConv =
        isOnMessagesPage &&
        currentOpenConvId === params.conversationId &&
        document.visibilityState === 'visible';

      if (!isViewingSameConv) {
        setFloatingBanner({
          messageId: params.messageId,
          conversationId: params.conversationId,
          senderName: senderLabel,
          preview,
          targetUrl,
        });
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => {
          setFloatingBanner(null);
        }, 7000);
      }
    },
    [userId, lang, messagesBaseRoute, resolveSenderName]
  );

  // Unlock audio on user gestures
  useEffect(() => {
    installAudioUnlocker();
  }, []);

  // Keep Service Worker context & Web Push synced for both owners & contractors
  useEffect(() => {
    if (!userId) return;
    syncServiceWorkerPushContext(userId, userRole).catch(() => {});
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermState(Notification.permission);
      if (Notification.permission === 'granted') {
        subscribeOwnerWebPush(userId, userRole).catch(() => {});
      }
    }
  }, [userId, userRole]);

  const lastConvFetchAtRef = useRef<number>(0);
  const syncInFlightRef = useRef<boolean>(false);

  // Load & refresh user's conversation IDs (throttled to at most once every 60s)
  const refreshMyConversations = useCallback(async (force = false): Promise<string[]> => {
    if (!userId) return [];
    const now = Date.now();
    if (!force && myConvIdsRef.current.size > 0 && now - lastConvFetchAtRef.current < 60000) {
      return Array.from(myConvIdsRef.current);
    }
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
        lastConvFetchAtRef.current = now;
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
    return Array.from(myConvIdsRef.current);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    baselineDoneRef.current = false;

    const sessionStartMs = Date.now();

    // Helper: Poll unread chat notifications & messages from Express SQLite + Supabase
    const syncUnreadAndAlert = async (isInitialBaseline: boolean) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
      const convIds = await refreshMyConversations(isInitialBaseline);

      // A. Express SQLite /api/notifications (only if backend exists)
      try {
        const res = await serverApi.getNotifications({
          user_id: userId,
          role: userRole,
          unread_only: true,
        });
        for (const n of res.notifications || []) {
          if (n.type !== 'chat_message' || n.is_read) continue;
          const data = n.data || {};
          if (data.sender_id === userId) continue;
          const msgId = data.message_id || n.id;
          const convId = data.conversation_id;
          if (!convId) continue;

          const createdMs = n.created_at ? new Date(n.created_at).getTime() : 0;
          if (isInitialBaseline && createdMs < sessionStartMs - 15000) {
            alertedIdsRef.current.add(msgId);
            continue;
          }

          await triggerChatAlert({
            messageId: msgId,
            conversationId: convId,
            senderId: data.sender_id,
            senderName: data.sender_name,
            rawBody: n.body_ar || n.body_fr || '',
          });
        }
      } catch {
        // ignore Express fallback error on static deploys
      }

      // B. Supabase Direct Unread Notifications & Messages (guarantees alerts even if Realtime WS disconnected)
      if (isSupabaseConfigured) {
        try {
          const { data: sbNotifs } = await supabase
            .from('notifications')
            .select('id, title_ar, body_ar, body_fr, data, created_at')
            .eq('user_id', userId)
            .eq('type', 'chat_message')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(15);

          if (Array.isArray(sbNotifs)) {
            for (const r of sbNotifs as any[]) {
              const d = r.data || {};
              if (d.sender_id === userId) continue;
              const msgId = d.message_id || r.id;
              const convId = d.conversation_id;
              if (!convId) continue;

              const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;
              if (isInitialBaseline && createdMs < sessionStartMs - 15000) {
                alertedIdsRef.current.add(msgId);
                continue;
              }

              await triggerChatAlert({
                messageId: msgId,
                conversationId: convId,
                senderId: d.sender_id,
                senderName: d.sender_name,
                rawBody: r.body_ar || r.body_fr || '',
              });
            }
          }
        } catch {
          // ignore
        }

        if (convIds.length > 0) {
          try {
            const { data: unreadMsgs } = await supabase
              .from('messages')
              .select('id, conversation_id, sender_id, content, body, created_at')
              .in('conversation_id', convIds)
              .neq('sender_id', userId)
              .is('read_at', null)
              .order('created_at', { ascending: false })
              .limit(15);

            if (Array.isArray(unreadMsgs)) {
              for (const m of unreadMsgs as any[]) {
                const rawText = String(m.content || m.body || '');
                if (!isContractor && rawText.includes('[JADIJCB_DISPATCH:')) {
                  alertedIdsRef.current.add(m.id);
                  continue;
                }
                const createdMs = m.created_at ? new Date(m.created_at).getTime() : 0;
                if (isInitialBaseline && createdMs < sessionStartMs - 15000) {
                  alertedIdsRef.current.add(m.id);
                  continue;
                }

                await triggerChatAlert({
                  messageId: m.id,
                  conversationId: m.conversation_id,
                  senderId: m.sender_id,
                  rawBody: rawText,
                });
              }
            }
          } catch {
            // ignore
          }
        }
      }

      baselineDoneRef.current = true;
      } finally {
        syncInFlightRef.current = false;
      }
    };

    syncUnreadAndAlert(true);

    // 1. Express Server-Sent Events (SSE) — only if Express backend is actually running
    let sse: EventSource | null = null;
    let sseDisposed = false;
    (async () => {
      try {
        const backendAvailable = await isServerBackendAvailable();
        if (!backendAvailable || sseDisposed) return;

        let tokenParam = '';
        if (isSupabaseConfigured) {
          try {
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData?.session?.access_token) {
              tokenParam = `&token=${encodeURIComponent(sessData.session.access_token)}`;
            }
          } catch {}
        }
        if (sseDisposed) return;
        sse = new EventSource(
          `/api/events?user_id=${encodeURIComponent(userId)}${tokenParam}`
        );
        sse.addEventListener('chat_message', (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            if (!data?.conversation_id || data.sender_id === userId) return;
            myConvIdsRef.current.add(data.conversation_id);
            window.dispatchEvent(new CustomEvent('jadijcb_sse_chat_message', { detail: data }));
            triggerChatAlert({
              messageId: data.id || `sse_${Date.now()}`,
              conversationId: data.conversation_id,
              senderId: data.sender_id,
              senderName: data.sender_name,
              rawBody: data.body || data.preview || '',
            });
          } catch {
            // ignore malformed SSE frame
          }
        });
      } catch {
        sse = null;
      }
    })();

    // 2. Same-browser BroadcastChannel listener
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

    // 3. Supabase Realtime listeners on messages, conversations, and notifications
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
            if (!isContractor && rawText.includes('[JADIJCB_DISPATCH:')) {
              return;
            }

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

    // 4. Lightweight 30s fallback poll while visible (Realtime + Broadcast handle instant alerts)
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncUnreadAndAlert(false);
      }
    }, 30000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncServiceWorkerPushContext(userId, userRole).catch(() => {});
        syncUnreadAndAlert(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      sseDisposed = true;
      if (sse) sse.close();
      unsubBroadcast();
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
      if (rtChannel) {
        supabase.removeChannel(rtChannel);
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [userId, userRole, isContractor, refreshMyConversations, triggerChatAlert]);

  if (!floatingBanner) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-18 sm:top-20 inset-x-3 sm:inset-x-auto sm:end-6 sm:w-[390px] z-[75] animate-in slide-in-from-top duration-200"
    >
      <div className="bg-ink text-white rounded-2xl border-2 border-primary shadow-2xl overflow-hidden">
        <div className="p-3.5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 text-start">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-primary truncate">
                {lang === 'fr'
                  ? `Nouveau message · ${floatingBanner.senderName}`
                  : `رسالة جديدة من ${floatingBanner.senderName}`}
              </span>
              <button
                type="button"
                onClick={() => setFloatingBanner(null)}
                className="p-1 text-steel-400 hover:text-white rounded-lg cursor-pointer shrink-0"
                aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-steel-100 line-clamp-2 mt-0.5 leading-relaxed">
              {floatingBanner.preview}
            </p>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => {
                  unlockAudioContextNow();
                  const url = floatingBanner.targetUrl;
                  setFloatingBanner(null);
                  navigate(url);
                }}
                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-ink text-[11px] font-black transition-colors cursor-pointer"
              >
                {lang === 'fr' ? 'Répondre maintenant' : 'فتح المحادثة والرد 💬'}
              </button>

              {permState === 'default' && (
                <button
                  type="button"
                  onClick={async () => {
                    unlockAudioContextNow();
                    const perm = await registerOwnerPushNotifications(userId, userRole);
                    setPermState(perm);
                    window.dispatchEvent(new CustomEvent('jadijcb_notif_permission_changed', { detail: perm }));
                    if (perm === 'granted') {
                      playChatMessageSound();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <BellRing className="w-3 h-3 text-primary" />
                  <span>{lang === 'fr' ? 'Activer push' : 'تفعيل تنبيه الهاتف'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatAlertListener;
