// ============================================================================
// JADIJCB: Real-Time Owner Dispatch Opportunity Listener & Celebration Alert
// Listens across Supabase Realtime (dispatch_notifications, notifications,
// messages), Web Push VAPID SW sync, Express /api/notifications, BroadcastChannel,
// and visibility poll so live alerts arrive both inside & outside the app.
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
  ensureDispatchConversationLinked,
  fetchOwnerDispatchNotifications,
  parseDispatchDealMessageRow,
  parseDispatchMessageRow,
  relocateMachineToSite,
  subscribeLocalDispatchEvents,
  updateDispatchNotificationStatus,
} from '../../lib/dispatchService';
import {
  installAudioUnlocker,
  playOpportunitySound,
  showBrowserOpportunityNotification,
} from '../../lib/opportunityAudio';
import {
  markPushKeySeenInSW,
  subscribeOwnerWebPush,
  syncServiceWorkerPushContext,
} from '../../lib/pushService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useLanguage } from '../../hooks/useLanguage';
import { formatDistanceKm } from '../../lib/geoUtils';
import { Button } from '../ui/Button';

interface OpportunityAlertListenerProps {
  ownerId: string;
  userRole?: 'owner' | 'supplier';
  onNotificationsSync: (notifications: DispatchNotification[]) => void;
}

const SESSION_ALERTED_KEY = 'jadijcb_session_alerted_dispatch_keys';

function getSessionAlertedKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_ALERTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function addSessionAlertedKey(key: string) {
  try {
    const set = getSessionAlertedKeys();
    set.add(key);
    sessionStorage.setItem(SESSION_ALERTED_KEY, JSON.stringify(Array.from(set).slice(-120)));
  } catch {
    // ignore
  }
}

export const OpportunityAlertListener: React.FC<OpportunityAlertListenerProps> = ({
  ownerId,
  userRole = 'owner',
  onNotificationsSync,
}) => {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [activeAlert, setActiveAlert] = useState<DispatchNotification | null>(null);
  const alertedKeysRef = useRef<Set<string>>(getSessionAlertedKeys());
  const onSyncRef = useRef(onNotificationsSync);
  onSyncRef.current = onNotificationsSync;

  const triggerCelebrationAlert = useCallback((notif: DispatchNotification) => {
    if (!notif?.id) return;
    if (notif.status === 'dismissed' || notif.deal_status === 'closed_other') return;

    const alertKey = notif.campaign_id || notif.id;
    if (alertedKeysRef.current.has(alertKey) || alertedKeysRef.current.has(notif.id)) return;

    alertedKeysRef.current.add(alertKey);
    alertedKeysRef.current.add(notif.id);
    addSessionAlertedKey(alertKey);
    addSessionAlertedKey(notif.id);
    markPushKeySeenInSW(alertKey).catch(() => {});

    // 1. Play synthesized chime & vibrate phone
    playOpportunitySound();

    // 2. Native Browser / Mobile PWA notification shade alert
    const distLabel = notif.is_nationwide
      ? 'المغرب كاملاً 🇲🇦'
      : notif.distance_km != null
      ? `${Math.round(notif.distance_km)} كم من موقعك`
      : '';

    const isSpare = notif.campaign_type === 'spare_part' || Boolean(notif.part_reference);
    const isPurchase = notif.campaign_type === 'machine_purchase';
    const baseRoute = userRole === 'supplier' ? '/supplier' : '/owner';
    showBrowserOpportunityNotification({
      title: isSpare
        ? 'طلب قطعة غيار عاجل 🔧'
        : isPurchase
        ? 'طلب شراء / استيراد آلية 🚢'
        : 'فرصة جديدة 🎉',
      body: isSpare
        ? `«${notif.company_name}» يبحث عن Réf: ${notif.part_reference || notif.machine_name}${
            distLabel ? ` · ${distLabel}` : ''
          }`
        : isPurchase
        ? `«${notif.company_name}» يبحث عن شراء «${notif.machine_name}»${
            distLabel ? ` · ${distLabel}` : ''
          }`
        : `«${notif.company_name}» محتاجة «${notif.machine_name}» ديالك${
            distLabel ? ` · ${distLabel}` : ''
          }`,
      tag: alertKey,
      url:
        userRole === 'supplier'
          ? `/supplier/requests?campaign=${notif.campaign_id}`
          : `${baseRoute}/messages?target=${notif.contractor_id}&machine=${notif.machine_id || ''}&campaign=${notif.campaign_id}`,
    });

    // 3. In-app celebratory banner card
    setActiveAlert(notif);
  }, [userRole]);

  const syncInFlightRef = useRef(false);

  const syncFromSource = useCallback(
    async (notifyUnread: boolean) => {
      if (!ownerId || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
      const list = await fetchOwnerDispatchNotifications(ownerId);
      onSyncRef.current(list);

      // Dismiss open popup if that campaign was closed by another winner
      setActiveAlert((prev) => {
        if (!prev) return null;
        const stillOpen = list.find(
          (n) => n.campaign_id === prev.campaign_id && n.status !== 'dismissed' && n.deal_status !== 'closed_other'
        );
        return stillOpen ? prev : null;
      });

      if (notifyUnread) {
        const newestUnread = list.find((n) => {
          const key = n.campaign_id || n.id;
          return (
            !n.is_read &&
            n.status === 'sent' &&
            n.deal_status !== 'closed_other' &&
            !alertedKeysRef.current.has(key) &&
            !alertedKeysRef.current.has(n.id)
          );
        });
        if (newestUnread) {
          triggerCelebrationAlert(newestUnread);
        }
      }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [ownerId, triggerCelebrationAlert]
  );

  useEffect(() => {
    installAudioUnlocker();
  }, []);

  // Keep Service Worker push context & Web Push subscription synced for closed-app phone alerts
  useEffect(() => {
    if (!ownerId) return;
    syncServiceWorkerPushContext(ownerId, 'owner').catch(() => {});
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      subscribeOwnerWebPush(ownerId, 'owner').catch(() => {});
    }
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;

    // 1. Initial load
    syncFromSource(true);

    // 2. Same-browser BroadcastChannel listener
    const unsubscribeLocal = subscribeLocalDispatchEvents((detail) => {
      if (detail?.type === 'CAMPAIGN_LAUNCHED' && Array.isArray(detail.notifications)) {
        const mine = (detail.notifications as DispatchNotification[]).filter(
          (n) => n.owner_id === ownerId
        );
        if (mine.length > 0) {
          syncFromSource(false);
          triggerCelebrationAlert(mine[0]);
        }
      } else if (detail?.type === 'NOTIF_UPDATED' || detail?.type === 'DEAL_ACCEPTED' || detail?.type === 'CAMPAIGN_UPDATED') {
        syncFromSource(false);
      }
    });

    // 3. Cross-device Supabase Realtime listeners (dispatch_notifications, notifications, messages)
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      realtimeChannel = supabase
        .channel(`owner_dispatch_all_${ownerId}`)
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
          (payload: any) => {
            const updated = payload?.new as DispatchNotification | undefined;
            if (updated?.deal_status === 'closed_other' || updated?.status === 'dismissed') {
              setActiveAlert((prev) => (prev?.campaign_id === updated.campaign_id ? null : prev));
            }
            syncFromSource(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${ownerId}`,
          },
          (payload: any) => {
            const row = payload?.new;
            if (row?.type === 'dispatch_opportunity') {
              syncFromSource(true);
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
            const row = payload?.new;
            if (!row || row.sender_id === ownerId) return;

            // Check if mutual deal acceptance or closure just arrived
            const dealMsg = parseDispatchDealMessageRow(row);
            if (dealMsg) {
              const isSupplyDeal =
                dealMsg.campaign_type === 'spare_part' ||
                dealMsg.campaign_type === 'machine_purchase' ||
                Boolean(dealMsg.part_reference);
              if (dealMsg.deal_status === 'accepted' && dealMsg.owner_id === ownerId && !isSupplyDeal) {
                relocateMachineToSite({
                  machineId: dealMsg.machine_id,
                  siteLat: dealMsg.site_lat,
                  siteLng: dealMsg.site_lng,
                  siteCity: dealMsg.site_city,
                }).catch(() => {});
                window.dispatchEvent(new CustomEvent('jadijcb_bookings_updated'));
              } else if (dealMsg.deal_status === 'closed_other') {
                setActiveAlert((prev) =>
                  prev?.campaign_id === dealMsg.campaign_id ? null : prev
                );
              }
              syncFromSource(false);
              return;
            }

            const parsed = parseDispatchMessageRow(row, ownerId);
            if (parsed) {
              syncFromSource(false);
              triggerCelebrationAlert(parsed);
            }
          }
        )
        .subscribe();
    }

    // 4. Lightweight 90s fallback polling while tab is visible (Realtime handles instant push)
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromSource(true);
      }
    }, 90000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromSource(true);
        syncServiceWorkerPushContext(ownerId, 'owner').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeLocal();
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [ownerId, syncFromSource, triggerCelebrationAlert]);

  const handleDismiss = async () => {
    if (!activeAlert) return;
    const target = activeAlert;
    setActiveAlert(null);
    await updateDispatchNotificationStatus(
      target.id,
      { is_read: true, status: 'read' },
      target.campaign_id
    );
    syncFromSource(false);
  };

  const handleAcceptAndChat = async () => {
    if (!activeAlert) return;
    const alertTarget = activeAlert;
    setActiveAlert(null);
    await Promise.allSettled([
      updateDispatchNotificationStatus(
        alertTarget.id,
        { is_read: true, status: 'accepted' },
        alertTarget.campaign_id
      ),
      ensureDispatchConversationLinked({
        contractorId: alertTarget.contractor_id,
        ownerId,
        notification: alertTarget,
      }),
    ]);
    syncFromSource(false);
    if (userRole === 'supplier') {
      navigate(`/supplier/requests?campaign=${alertTarget.campaign_id}`);
      return;
    }
    navigate(
      `/owner/messages?target=${alertTarget.contractor_id}&machine=${alertTarget.machine_id || ''}&campaign=${alertTarget.campaign_id}`
    );
  };

  if (!activeAlert) return null;

  const isSpareAlert =
    activeAlert.campaign_type === 'spare_part' || Boolean(activeAlert.part_reference);
  const isPurchaseAlert = activeAlert.campaign_type === 'machine_purchase';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 md:bottom-6 inset-x-3 sm:inset-x-auto sm:end-6 sm:w-[420px] z-[70] animate-in slide-in-from-bottom duration-300"
    >
      <div className="bg-ink text-white rounded-3xl border-2 border-primary shadow-2xl overflow-hidden">
        {/* Top Celebratory Bar */}
        <div className="bg-primary text-ink px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black tracking-tight">
              {isSpareAlert
                ? lang === 'fr'
                  ? 'Demande urgente de pièce détachée'
                  : 'طلب مباشر لقطعة غيار'
                : isPurchaseAlert
                ? lang === 'fr'
                  ? 'Demande achat / importation d’engin'
                  : 'طلب شراء / استيراد آلية من مالك'
                : lang === 'fr'
                ? 'Opportunité Directe JADIJCB'
                : 'طلب مباشر قريب من آلياتك'}
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
              alt={isSpareAlert ? 'طلب قطعة غيار' : isPurchaseAlert ? 'طلب شراء آلية' : 'فرصة جديدة'}
              className="w-12 h-12 object-contain shrink-0 bg-white/10 rounded-2xl p-1.5 border border-primary/40"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-black text-primary leading-none">
                  {isSpareAlert
                    ? lang === 'fr'
                      ? 'Pièce recherchée 🔧'
                      : 'طلب قطعة غيار 🔧'
                    : isPurchaseAlert
                    ? lang === 'fr'
                      ? 'Achat / Import Engin 🚢'
                      : 'طلب شراء / استيراد 🚢'
                    : 'فرصة جديدة'}
                </h4>
                {activeAlert.part_reference && (
                  <span
                    dir="ltr"
                    className="inline-flex items-center px-2 py-0.5 rounded-lg bg-primary text-ink text-[10px] font-mono font-black"
                  >
                    Réf: {activeAlert.part_reference}
                  </span>
                )}
                {activeAlert.import_allowed && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/15 text-primary text-[10px] font-black">
                    {lang === 'fr' ? 'Import accepté' : 'يقبل الاستيراد'}
                  </span>
                )}
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
                {isSpareAlert
                  ? `«${activeAlert.company_name}» يبحث عن «${activeAlert.machine_name}»`
                  : isPurchaseAlert
                  ? `«${activeAlert.company_name}» يبحث عن شراء «${activeAlert.machine_name}»`
                  : `«${activeAlert.company_name}» محتاجة «${activeAlert.machine_name}» ديالك`}
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
                {isSpareAlert || isPurchaseAlert
                  ? lang === 'fr'
                    ? 'Votre profil/offre correspondant :'
                    : 'العنصر المطابق في حسابك:'
                  : lang === 'fr'
                  ? 'Votre engin correspondant :'
                  : 'آليتك المطابقة للطلب:'}{' '}
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
              {isSpareAlert || isPurchaseAlert
                ? lang === 'fr'
                  ? 'Envoyer un devis maintenant'
                  : 'تقديم عرض سعر ومراسلة المالك'
                : lang === 'fr'
                ? 'Accepter & Discuter'
                : 'أوافق على الكراء — محادثة الآن'}
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
