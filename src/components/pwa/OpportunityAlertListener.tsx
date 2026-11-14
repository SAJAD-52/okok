// ============================================================================
// JADIJCB: Real-Time Owner Dispatch Opportunity Listener & Celebration Alert
// Listens via Supabase Realtime + BroadcastChannel for contractor dispatch
// campaigns inside the owner's km radius, plays celebration sound, triggers
// mobile/PWA notification, and displays an instant action card.
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  MessageSquare,
  Phone,
  X,
  Globe,
  Navigation,
  Volume2,
} from 'lucide-react';
import { DispatchNotification } from '../../types/database';
import {
  fetchOwnerDispatchNotifications,
  subscribeLocalDispatchEvents,
  updateDispatchNotificationStatus,
} from '../../lib/dispatchService';
import {
  installAudioUnlocker,
  playOpportunitySound,
  showBrowserOpportunityNotification,
} from '../../lib/opportunityAudio';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useLanguage } from '../../hooks/useLanguage';
import { formatDistanceKm } from '../../lib/geoUtils';
import { Button } from '../ui/Button';

interface OpportunityAlertListenerProps {
  ownerId: string;
  onNotificationsSync: (notifications: DispatchNotification[]) => void;
}

const SESSION_ALERTED_KEY = 'jadijcb_session_alerted_dispatch_ids';

function getSessionAlertedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_ALERTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function addSessionAlertedId(id: string) {
  try {
    const set = getSessionAlertedIds();
    set.add(id);
    sessionStorage.setItem(SESSION_ALERTED_KEY, JSON.stringify(Array.from(set).slice(-100)));
  } catch {
    // ignore
  }
}

export const OpportunityAlertListener: React.FC<OpportunityAlertListenerProps> = ({
  ownerId,
  onNotificationsSync,
}) => {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [activeAlert, setActiveAlert] = useState<DispatchNotification | null>(null);
  const alertedIdsRef = useRef<Set<string>>(getSessionAlertedIds());
  const onSyncRef = useRef(onNotificationsSync);
  onSyncRef.current = onNotificationsSync;

  const triggerCelebrationAlert = useCallback((notif: DispatchNotification) => {
    if (!notif?.id || alertedIdsRef.current.has(notif.id)) return;
    alertedIdsRef.current.add(notif.id);
    addSessionAlertedId(notif.id);

    // 1. Play synthesized chime & vibrate phone
    playOpportunitySound();

    // 2. Native Browser / Mobile PWA notification
    const distLabel = notif.is_nationwide
      ? 'المغرب كاملاً 🇲🇦'
      : notif.distance_km != null
      ? `${Math.round(notif.distance_km)} كم من موقعك`
      : '';

    showBrowserOpportunityNotification({
      title: 'فرصة جديدة 🎉',
      body: `«${notif.company_name}» محتاجة «${notif.machine_name}» ديالك${
        distLabel ? ` · ${distLabel}` : ''
      }`,
      tag: notif.id,
      url: `/owner/messages?target=${notif.contractor_id}&machine=${notif.machine_id || ''}`,
    });

    // 3. In-app celebratory banner card
    setActiveAlert(notif);
  }, []);

  const syncFromSource = useCallback(
    async (notifyUnreadFirstTime: boolean) => {
      if (!ownerId) return;
      const list = await fetchOwnerDispatchNotifications(ownerId);
      onSyncRef.current(list);

      if (notifyUnreadFirstTime) {
        const newestUnread = list.find(
          (n) => !n.is_read && n.status === 'sent' && !alertedIdsRef.current.has(n.id)
        );
        if (newestUnread) {
          triggerCelebrationAlert(newestUnread);
        }
      }
    },
    [ownerId, triggerCelebrationAlert]
  );

  useEffect(() => {
    installAudioUnlocker();
  }, []);

  useEffect(() => {
    if (!ownerId) return;

    // Initial load
    syncFromSource(true);

    // Same-browser / local BroadcastChannel listener
    const unsubscribeLocal = subscribeLocalDispatchEvents((detail) => {
      if (detail?.type === 'CAMPAIGN_LAUNCHED' && Array.isArray(detail.notifications)) {
        const mine = (detail.notifications as DispatchNotification[]).filter(
          (n) => n.owner_id === ownerId
        );
        if (mine.length > 0) {
          syncFromSource(false);
          triggerCelebrationAlert(mine[0]);
        }
      } else if (detail?.type === 'NOTIF_UPDATED') {
        syncFromSource(false);
      }
    });

    // Cross-device Supabase Realtime listener
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      realtimeChannel = supabase
        .channel(`owner_dispatch_${ownerId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'dispatch_notifications',
            filter: `owner_id=eq.${ownerId}`,
          },
          (payload: any) => {
            const incoming = payload?.new as DispatchNotification | undefined;
            if (incoming) {
              syncFromSource(false);
              triggerCelebrationAlert(incoming);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'dispatch_notifications',
            filter: `owner_id=eq.${ownerId}`,
          },
          () => {
            syncFromSource(false);
          }
        )
        .subscribe();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromSource(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeLocal();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [ownerId, syncFromSource, triggerCelebrationAlert]);

  const handleDismiss = async () => {
    if (!activeAlert) return;
    const currentId = activeAlert.id;
    setActiveAlert(null);
    await updateDispatchNotificationStatus(currentId, { is_read: true, status: 'read' });
    syncFromSource(false);
  };

  const handleAcceptAndChat = async () => {
    if (!activeAlert) return;
    const alertTarget = activeAlert;
    setActiveAlert(null);
    await updateDispatchNotificationStatus(alertTarget.id, {
      is_read: true,
      status: 'accepted',
    });
    syncFromSource(false);
    navigate(
      `/owner/messages?target=${alertTarget.contractor_id}&machine=${alertTarget.machine_id || ''}`
    );
  };

  if (!activeAlert) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 md:bottom-6 inset-x-3 sm:inset-x-auto sm:end-6 sm:w-[420px] z-50 animate-in slide-in-from-bottom duration-300"
    >
      <div className="bg-ink text-white rounded-3xl border-2 border-primary shadow-2xl overflow-hidden">
        {/* Top Celebratory Bar */}
        <div className="bg-primary text-ink px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="text-xs font-black tracking-tight">
              {lang === 'fr' ? 'Opportunité Directe JADIJCB' : 'طلب مباشر قريب من آلياتك'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
            aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Alert Body */}
        <div className="p-4 space-y-3 text-start">
          <div className="flex items-start gap-3">
            <img
              src="/assets/aistudio/image_010e3368.png"
              alt="فرصة جديدة"
              className="w-12 h-12 object-contain shrink-0 bg-white/10 rounded-2xl p-1.5 border border-primary/40"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-black text-primary leading-none">فرصة جديدة</h4>
                {activeAlert.is_nationwide ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/15 text-[10px] font-bold text-white">
                    <Globe className="w-3 h-3 text-primary" />
                    <span>{lang === 'fr' ? 'Tout le Maroc' : 'المغرب كاملاً'}</span>
                  </span>
                ) : activeAlert.distance_km != null ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-black text-emerald-300 tabular-nums">
                    <Navigation className="w-3 h-3" />
                    <span>
                      {lang === 'fr' ? 'À' : 'على بعد'}{' '}
                      {formatDistanceKm(activeAlert.distance_km, lang)}
                    </span>
                  </span>
                ) : null}
              </div>

              <p className="text-sm font-black text-white leading-snug break-words">
                «{activeAlert.company_name}» محتاجة «{activeAlert.machine_name}» ديالك
              </p>
            </div>
          </div>

          {/* Site & Matched Machine Info */}
          <div className="bg-white/10 rounded-2xl p-3 space-y-1.5 text-xs border border-white/10">
            <div className="flex items-center gap-1.5 text-steel-200 font-bold">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">
                {activeAlert.site_name}
                {activeAlert.site_city ? ` · ${activeAlert.site_city}` : ''}
              </span>
            </div>
            {activeAlert.matched_machine_title && (
              <p className="text-[11px] text-steel-300">
                {lang === 'fr' ? 'Votre engin correspondant :' : 'آليتك المطابقة للطلب:'}{' '}
                <span className="text-white font-bold">{activeAlert.matched_machine_title}</span>
              </p>
            )}
            {activeAlert.notes && (
              <p className="text-[11px] text-amber-200 leading-relaxed pt-1 border-t border-white/10">
                {activeAlert.notes}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAcceptAndChat}
              leftIcon={<MessageSquare className="w-4 h-4" />}
              className="flex-1 justify-center font-black text-xs min-h-[44px]"
            >
              {lang === 'fr' ? 'Accepter & Discuter' : 'أوافق على الكراء — محادثة الآن'}
            </Button>

            {activeAlert.site_phone && (
              <a
                href={`tel:${activeAlert.site_phone}`}
                onClick={handleDismiss}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs min-h-[44px] transition-colors shrink-0"
              >
                <Phone className="w-4 h-4 text-primary" />
                <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunityAlertListener;
