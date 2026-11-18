// ============================================================================
// JADIJCB: Real-Time Driver Urgent Job Offer Listener & Celebration Alert
// Mirrors OpportunityAlertListener behavior for registered drivers:
// Listens across Supabase Realtime (driver_job_offers & notifications),
// BroadcastChannel, Web Push SW sync, and 7s polling so urgent offers trigger
// audio chime, vibration, OS notification shade (even when app is closed),
// and the in-app celebratory card.
// ============================================================================

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Volume2,
  X,
  HardHat,
  Clock,
  Award,
  Home,
  Utensils,
  MessageSquare,
  Phone,
  Briefcase,
} from 'lucide-react';
import { DriverJobOffer, UserProfile } from '../../types/database';
import {
  applyToDriverJobOffer,
  buildDriverOfferMarkerSuffix,
  fetchDriverJobOffers,
  mapNotificationRowToDriverOffer,
  subscribeDriverJobOffers,
} from '../../lib/driverOfferService';
import { getDriverExperienceOption } from '../../data/driverMachines';
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
import { chatStore } from '../../lib/chatStore';
import { useLanguage } from '../../hooks/useLanguage';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

interface DriverOpportunityAlertListenerProps {
  driverId: string;
  driverProfile: UserProfile | null;
  onOffersSync?: () => void;
}

const DRIVER_ALERTED_KEY = 'jadijcb_session_alerted_driver_offers';

function getSessionAlertedOffers(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DRIVER_ALERTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function addSessionAlertedOffer(key: string) {
  try {
    const set = getSessionAlertedOffers();
    set.add(key);
    sessionStorage.setItem(DRIVER_ALERTED_KEY, JSON.stringify(Array.from(set).slice(-120)));
  } catch {
    // ignore
  }
}

export const DriverOpportunityAlertListener: React.FC<DriverOpportunityAlertListenerProps> = ({
  driverId,
  driverProfile,
  onOffersSync,
}) => {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [activeOffer, setActiveOffer] = useState<DriverJobOffer | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const alertedIdsRef = useRef<Set<string>>(getSessionAlertedOffers());
  const onSyncRef = useRef(onOffersSync);
  onSyncRef.current = onOffersSync;

  const driverMachines = useMemo(
    () => (Array.isArray(driverProfile?.driver_machines) ? driverProfile.driver_machines : []),
    [driverProfile?.driver_machines]
  );

  const triggerDriverAlert = useCallback(
    (offer: DriverJobOffer) => {
      if (!offer?.id || offer.status !== 'open' || offer.is_demo) return;
      if (offer.owner_id === driverId) return;

      const matchesMachine =
        driverMachines.length === 0 || driverMachines.includes(offer.machine_category);
      if (!matchesMachine) return;

      const alertKey = `driver-offer-${offer.id}`;
      if (alertedIdsRef.current.has(offer.id) || alertedIdsRef.current.has(alertKey)) return;

      alertedIdsRef.current.add(offer.id);
      alertedIdsRef.current.add(alertKey);
      addSessionAlertedOffer(offer.id);
      addSessionAlertedOffer(alertKey);
      markPushKeySeenInSW(alertKey).catch(() => {});
      markPushKeySeenInSW(offer.id).catch(() => {});

      // 1. Audio chime + vibration
      playOpportunitySound();

      // 2. Native browser / mobile PWA shade notification
      const salaryText =
        offer.offered_salary > 0
          ? `${offer.offered_salary.toLocaleString('fr-FR')} درهم/${
              offer.salary_unit === 'month' ? 'شهر' : 'يوم'
            }`
          : '';
      showBrowserOpportunityNotification({
        title: `فرصة عمل عاجلة لسائق: ${offer.machine_label_ar} 👷`,
        body: [salaryText, offer.duration_label, offer.owner_company || offer.owner_name]
          .filter(Boolean)
          .join(' · '),
        tag: alertKey,
        url: `/driver/joboffer?offer=${encodeURIComponent(offer.id)}`,
      }).catch(() => {});

      // 3. Celebratory in-app popup card
      setActiveOffer(offer);
    },
    [driverId, driverMachines]
  );

  const syncInFlightRef = useRef(false);

  const syncOffersAndCheckUnread = useCallback(
    async (notifyNew: boolean) => {
      if (!driverId || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
      onSyncRef.current?.();

      const offers = await fetchDriverJobOffers(driverId);

      // Dismiss popup if offer was closed
      setActiveOffer((prev) => {
        if (!prev) return null;
        const stillOpen = offers.find((o) => o.id === prev.id && o.status === 'open');
        return stillOpen ? prev : null;
      });

      if (notifyNew) {
        const recentThreshold = Date.now() - 1000 * 60 * 60 * 12; // last 12h
        const candidate = offers.find((o) => {
          if (o.is_demo || o.status !== 'open' || o.has_applied) return false;
          if (o.owner_id === driverId) return false;
          const matches =
            driverMachines.length === 0 || driverMachines.includes(o.machine_category);
          if (!matches) return false;
          if (new Date(o.created_at).getTime() < recentThreshold) return false;
          return (
            !alertedIdsRef.current.has(o.id) &&
            !alertedIdsRef.current.has(`driver-offer-${o.id}`)
          );
        });
        if (candidate) {
          triggerDriverAlert(candidate);
        }
      }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [driverId, driverMachines, triggerDriverAlert]
  );

  useEffect(() => {
    installAudioUnlocker();
  }, []);

  // Keep Service Worker push context & Web Push subscription synced for closed-app phone alerts
  useEffect(() => {
    if (!driverId) return;
    syncServiceWorkerPushContext(driverId, 'driver', driverMachines).catch(() => {});
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      subscribeOwnerWebPush(driverId, 'driver', driverMachines).catch(() => {});
    }
  }, [driverId, driverMachines]);

  useEffect(() => {
    if (!driverId) return;

    syncOffersAndCheckUnread(true);

    const unsubscribeOffers = subscribeDriverJobOffers(driverMachines, (incomingOffer) => {
      if (incomingOffer) {
        triggerDriverAlert(incomingOffer);
      }
      onSyncRef.current?.();
    });

    let notifChannel: any = null;
    if (isSupabaseConfigured) {
      try {
        notifChannel = supabase
          .channel(`driver_notifs_${driverId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${driverId}`,
            },
            (payload: any) => {
              const row = payload?.new;
              if (row?.type === 'driver_job_offer') {
                const mapped = mapNotificationRowToDriverOffer(row);
                if (mapped) {
                  triggerDriverAlert(mapped);
                }
                onSyncRef.current?.();
              }
            }
          )
          .subscribe();
      } catch {
        // ignore if realtime blocked
      }
    }

    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncOffersAndCheckUnread(true);
      }
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncOffersAndCheckUnread(true);
        syncServiceWorkerPushContext(driverId, 'driver', driverMachines).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeOffers();
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
    };
  }, [driverId, driverMachines, syncOffersAndCheckUnread, triggerDriverAlert]);

  const handleDismiss = () => {
    setActiveOffer(null);
  };

  const handleAcceptAndChat = async () => {
    if (!activeOffer) return;
    const target = activeOffer;
    setIsApplying(true);

    try {
      await applyToDriverJobOffer({
        offer: target,
        driverId,
        driverName: driverProfile?.full_name || 'سائق JADIJCB',
        driverPhone: driverProfile?.phone || '',
        driverCity: driverProfile?.city || 'المغرب',
        driverExperience: driverProfile?.driver_experience_years || '3_5',
      });

      if (target.owner_id && !target.owner_id.startsWith('starter-')) {
        const conv = await chatStore.getOrCreateConversation(driverId, target.owner_id, null, {
          id: target.owner_id,
          full_name: target.owner_name,
          company_name: target.owner_company,
          phone: target.owner_phone || '',
          role: 'owner',
        });

        const baseMsg =
          lang === 'fr'
            ? `Bonjour, je suis conducteur disponible pour votre offre (${target.machine_label_fr}).`
            : `السلام عليكم، أنا سائق محترف متاح للعمل على عرضكم الخاص بـ (${target.machine_label_ar}).`;

        await chatStore.sendMessage(
          conv.id,
          driverId,
          `${baseMsg}${buildDriverOfferMarkerSuffix(target, driverId)}`,
          target.owner_id,
          {
            senderName: driverProfile?.full_name || 'سائق',
            recipientRole: 'owner',
          }
        );

        setActiveOffer(null);
        navigate(
          `/driver/messages?conv=${encodeURIComponent(conv.id)}&offer=${encodeURIComponent(
            target.id
          )}`
        );
        return;
      }

      setActiveOffer(null);
      navigate(`/driver/joboffer?offer=${encodeURIComponent(target.id)}`);
    } catch {
      toast.info(
        lang === 'fr'
          ? 'Candidature enregistrée ! Retrouvez l’offre dans vos demandes.'
          : 'تم تسجيل اهتمامك بالعرض! يمكنك متابعة التفاصيل في قسم الطلبات.'
      );
      setActiveOffer(null);
      navigate(`/driver/joboffer?offer=${encodeURIComponent(target.id)}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (!activeOffer) return null;

  const expMeta = activeOffer.experience_required
    ? getDriverExperienceOption(activeOffer.experience_required)
    : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 md:bottom-6 inset-x-3 sm:inset-x-auto sm:end-6 sm:w-[430px] z-[70] animate-in slide-in-from-bottom duration-300"
    >
      <div className="bg-ink text-white rounded-3xl border-2 border-primary shadow-2xl overflow-hidden">
        {/* Top Celebratory Bar */}
        <div className="bg-primary text-ink px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="text-xs font-black tracking-tight">
              {lang === 'fr'
                ? 'Offre urgente pour conducteur'
                : 'عرض عمل عاجل يطابق تخصصك'}
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
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
              <HardHat className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-black text-primary leading-snug">
                  {lang === 'fr' ? 'Conducteur recherché' : 'مطلوب سائق الآن'}
                </h4>
                {activeOffer.offered_salary > 0 && (
                  <span
                    dir="ltr"
                    className="inline-flex items-center px-2.5 py-1 rounded-xl bg-primary text-ink text-xs font-black font-mono tabular-nums"
                  >
                    {activeOffer.offered_salary.toLocaleString('fr-FR')}{' '}
                    {lang === 'fr' ? 'MAD' : 'د.م'}/
                    {activeOffer.salary_unit === 'month'
                      ? lang === 'fr'
                        ? 'mois'
                        : 'شهر'
                      : lang === 'fr'
                      ? 'jour'
                      : 'يوم'}
                  </span>
                )}
              </div>

              <p className="text-sm font-black text-white leading-snug break-words">
                {lang === 'fr' ? activeOffer.machine_label_fr : activeOffer.machine_label_ar}
              </p>
              <p className="text-[11px] text-steel-300 font-bold truncate">
                {activeOffer.owner_company || activeOffer.owner_name}
              </p>
            </div>
          </div>

          {/* Offer Details Box */}
          <div className="bg-white/10 rounded-2xl p-3 space-y-2 text-xs border border-white/10">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-steel-200 font-bold">
              {activeOffer.duration_label && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{activeOffer.duration_label}</span>
                </span>
              )}
              {expMeta && (
                <span className="inline-flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{lang === 'fr' ? expMeta.shortFr : expMeta.shortAr}</span>
                </span>
              )}
            </div>

            {(activeOffer.accommodation_included || activeOffer.meals_included) && (
              <div className="flex flex-wrap gap-1.5">
                {activeOffer.accommodation_included && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-200">
                    <Home className="w-3 h-3" />
                    <span>{lang === 'fr' ? 'Logement assuré' : 'السكن متوفر'}</span>
                  </span>
                )}
                {activeOffer.meals_included && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-200">
                    <Utensils className="w-3 h-3" />
                    <span>{lang === 'fr' ? 'Repas inclus' : 'التغذية متوفرة'}</span>
                  </span>
                )}
              </div>
            )}

            {activeOffer.description_ar && (
              <p className="text-[11px] text-amber-200 leading-relaxed pt-1 border-t border-white/10">
                {activeOffer.description_ar}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isApplying}
              onClick={handleAcceptAndChat}
              leftIcon={<MessageSquare className="w-4 h-4" />}
              className="flex-1 justify-center font-black text-xs min-h-[44px]"
            >
              {lang === 'fr' ? 'Contacter le propriétaire' : 'تواصل مع المالك'}
            </Button>

            <button
              type="button"
              onClick={() => {
                const oid = activeOffer.id;
                setActiveOffer(null);
                navigate(`/driver/joboffer?offer=${encodeURIComponent(oid)}`);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs min-h-[44px] transition-colors shrink-0 cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-primary" />
              <span>{lang === 'fr' ? 'Voir l’offre' : 'عرض التفاصيل'}</span>
            </button>

            {activeOffer.owner_phone && (
              <a
                href={`tel:${activeOffer.owner_phone}`}
                onClick={handleDismiss}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs min-h-[44px] transition-colors shrink-0"
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

export default DriverOpportunityAlertListener;
