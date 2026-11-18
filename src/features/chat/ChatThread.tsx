// ============================================================================
// JADIJCB: Chat Thread Component (WhatsApp-style + Mutual Dispatch Deal Bar)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ShieldCheck,
  Sparkles,
  Truck,
  Building2,
  MapPin,
  Handshake,
  Lock,
  CheckCircle2,
  CalendarCheck,
  Loader2,
  HardHat,
  Briefcase,
} from 'lucide-react';
import { ChatConversationItem } from '../../types/chat';
import { DispatchDealContext, DriverDealContext } from '../../types/database';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useChatRealtime } from './useChatRealtime';
import { ChatMachineContextCard } from './ChatMachineContextCard';
import { toast } from '../../components/ui/Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  acceptDispatchDealParty,
  fetchDispatchContextForConversation,
  relocateMachineToSite,
  stripDispatchMarker,
  subscribeLocalDispatchEvents,
} from '../../lib/dispatchService';
import {
  acceptAndCloseDriverDealParty,
  fetchDriverDealContextForConversation,
  markOfferAcceptedAndClosed,
  parseDriverOfferMessageRow,
} from '../../lib/driverOfferService';
import { machineStore } from '../../lib/machineStore';
import { unlockAudioContextNow } from '../../lib/opportunityAudio';

interface ChatThreadProps {
  conversation: ChatConversationItem;
  onBackToList?: () => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  conversation,
  onBackToList,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const currentUserId = user?.id || profile?.id || 'current-user-demo';

  const [inputMessage, setInputMessage] = useState('');
  const [dispatchDeal, setDispatchDeal] = useState<DispatchDealContext | null>(null);
  const [driverDeal, setDriverDeal] = useState<DriverDealContext | null>(null);
  const [isAcceptingDeal, setIsAcceptingDeal] = useState(false);
  const [isClosingDriverDeal, setIsClosingDriverDeal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const relocatedCampaignRef = useRef<string | null>(null);
  const syncedClosedOfferRef = useRef<string | null>(null);

  const {
    messages,
    isLoadingMessages,
    isPeerTyping,
    sendMessage,
    sendTypingStatus,
  } = useChatRealtime(conversation);

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';
  const isDriverChat =
    profile?.role === 'driver' || conversation.other_participant?.role === 'driver';
  const isSpareDeal = Boolean(
    dispatchDeal && (dispatchDeal.campaign_type === 'spare_part' || dispatchDeal.part_reference)
  );
  const partyRole: 'contractor' | 'owner' = dispatchDeal
    ? dispatchDeal.contractor_id === currentUserId
      ? 'contractor'
      : 'owner'
    : isContractor
    ? 'contractor'
    : 'owner';
  const isRequesterParty = partyRole === 'contractor';
  const driverPartyRole: 'owner' | 'driver' = driverDeal
    ? driverDeal.driver_id === currentUserId
      ? 'driver'
      : 'owner'
    : profile?.role === 'driver'
    ? 'driver'
    : 'owner';

  // Read optional campaign / driver offer hint from URL query params
  const campaignHint = (() => {
    try {
      return new URLSearchParams(window.location.search).get('campaign');
    } catch {
      return null;
    }
  })();
  const offerHint = (() => {
    try {
      return new URLSearchParams(window.location.search).get('offer');
    } catch {
      return null;
    }
  })();

  // Sync mutual dispatch deal context for this conversation
  useEffect(() => {
    let cancelled = false;

    const refreshDeal = async () => {
      if (!currentUserId || !conversation?.other_participant?.id) return;
      const ctx = await fetchDispatchContextForConversation({
        currentUserId,
        otherUserId: conversation.other_participant.id,
        machineId: conversation.machine_id || conversation.machine?.id,
        campaignIdHint: campaignHint,
        messages,
      });

      if (!cancelled) {
        setDispatchDeal(ctx);
        const ctxIsSpare = ctx?.campaign_type === 'spare_part' || Boolean(ctx?.part_reference);
        // When owner sees finalized machinery deal & contractor clicked 2nd, update machine location (never for spare parts!)
        if (
          ctx &&
          !ctxIsSpare &&
          ctx.deal_status === 'accepted' &&
          ctx.owner_id === currentUserId &&
          relocatedCampaignRef.current !== ctx.campaign_id
        ) {
          relocatedCampaignRef.current = ctx.campaign_id;
          relocateMachineToSite({
            machineId: ctx.machine_id,
            siteLat: ctx.site_lat,
            siteLng: ctx.site_lng,
            siteCity: ctx.site_city,
          }).catch(() => {});
        }
      }
    };

    refreshDeal();

    const unsubLocal = subscribeLocalDispatchEvents(() => {
      refreshDeal();
    });

    let rtChan: any = null;
    if (isSupabaseConfigured && currentUserId) {
      rtChan = supabase
        .channel(`chat_deal_sync_${conversation.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dispatch_notifications' },
          () => {
            refreshDeal();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'dispatch_campaigns' },
          () => {
            refreshDeal();
          }
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      unsubLocal();
      if (rtChan) supabase.removeChannel(rtChan);
    };
  }, [
    conversation.id,
    conversation.other_participant.id,
    conversation.machine_id,
    conversation.machine?.id,
    currentUserId,
    campaignHint,
    messages,
  ]);

  // Sync mutual driver job offer deal context ("إغلاق الصفقة")
  useEffect(() => {
    if (!isDriverChat || !currentUserId || !conversation?.other_participant?.id) {
      setDriverDeal(null);
      return;
    }

    let cancelled = false;

    const refreshDriverDeal = async () => {
      const ctx = await fetchDriverDealContextForConversation({
        currentUserId,
        otherUserId: conversation.other_participant.id,
        currentUserRole: profile?.role,
        otherUserRole: conversation.other_participant.role,
        offerIdHint: offerHint,
        messages,
      });

      if (!cancelled) {
        setDriverDeal(ctx);
        // Ensure Supabase offer row closes cleanly when owner views a finalized driver chat
        if (
          ctx &&
          ctx.deal_status === 'accepted' &&
          ctx.owner_id === currentUserId &&
          syncedClosedOfferRef.current !== ctx.offer_id
        ) {
          syncedClosedOfferRef.current = ctx.offer_id;
          markOfferAcceptedAndClosed({
            offerId: ctx.offer_id,
            driverId: ctx.driver_id,
            driverName: ctx.won_driver_name,
          }).catch(() => {});
        }
      }
    };

    refreshDriverDeal();

    const onLocalUpdated = () => refreshDriverDeal();
    window.addEventListener('jadijcb_driver_offers_updated', onLocalUpdated);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('jadijcb_driver_dispatch');
        bc.onmessage = () => refreshDriverDeal();
      }
    } catch {
      bc = null;
    }

    let rtDriverChan: any = null;
    if (isSupabaseConfigured) {
      try {
        rtDriverChan = supabase
          .channel(`chat_driver_deal_${conversation.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_job_offers' },
            () => refreshDriverDeal()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_job_applications' },
            () => refreshDriverDeal()
          )
          .subscribe();
      } catch {
        // ignore if table not migrated
      }
    }

    return () => {
      cancelled = true;
      window.removeEventListener('jadijcb_driver_offers_updated', onLocalUpdated);
      if (bc) bc.close();
      if (rtDriverChan) supabase.removeChannel(rtDriverChan);
    };
  }, [
    isDriverChat,
    conversation.id,
    conversation.other_participant.id,
    conversation.other_participant.role,
    profile?.role,
    currentUserId,
    offerHint,
    messages,
  ]);

  // Quick Moroccan Construction Phrases
  const quickChips = isDriverChat
    ? driverPartyRole === 'driver'
      ? [
          '🚜 لدي خبرة كاملة بهذه الآلية وجاهز للعمل',
          '💰 الأجرة وشروط العمل مناسبة لي جداً',
          '📍 أين يقع الورش ومتى موعد البداية؟',
          '🏠 هل السكن والتغذية متوفران قرب الورش؟',
        ]
      : [
          '👷 أهلاً بك، متى يمكنك الالتحاق بالورش؟',
          '📜 هل لديك رخصة السياقة وخبرة كافية بالآلية؟',
          '💰 الشروط والأجرة نهائية، هل تناسبك؟',
          '🤝 متفقون على الشروط، اضغط على إغلاق الصفقة',
        ]
    : isSpareDeal
    ? isRequesterParty
      ? [
          '🔧 هل القطعة مطابقة تماماً للمرجع Réf؟',
          '📦 هل القطعة جديدة أصلية أم مستعملة؟',
          '💰 ما هو السعر النهائي للقطعة؟',
          '🚚 هل يمكن إرسالها عبر الإرسالية اليوم؟',
        ]
      : [
          '✅ نعم، القطعة متوفرة لدينا ومطابقة للمرجع',
          '📦 القطعة جديدة أصلية وجاهزة للتسليم',
          '🚚 يمكننا شحنها فوراً عبر الإرسالية السريعة',
          '📍 يمكنكم استلامها مباشرة من متجرنا',
        ]
    : isContractor
    ? [
        '🚜 هل الآلية متوفرة هذا الأسبوع؟',
        '👷 هل تتوفر مع سائق معتمد؟',
        '⛽ هل السعر يشمل الكازوال والنقل للموقع؟',
        '📍 كم تكلفة الديباناج وسطحة النقل (Porte-char)؟',
        '⏱️ هل يمكن بدء العمل بعد غد صباحاً؟',
      ]
    : [
        '✅ وعليكم السلام، نعم الآلية جاهزة ومتوفرة فوراً',
        '👷 السائق متوفر ومؤهل مع بطاقة السلامة المهنية',
        '🚚 يمكننا توفير النقل عبر السطحة لموقع العمل',
        '📍 يرجى تزويدنا بموقع العمل ومدة الكراء بالضبط',
        '🤝 تم تأكيد الحجز وجدولة الآلية لكم',
      ];

  // Auto-scroll to bottom only when a new message actually arrives
  const lastMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const latestId = messages[messages.length - 1]?.id;
    if (latestId && latestId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = latestId;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const isChatClosedByOtherDeal = dispatchDeal?.deal_status === 'closed_other';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    unlockAudioContextNow();
    setInputMessage(e.target.value);
    sendTypingStatus(e.target.value.length > 0);
  };

  const handleSend = (textToSend?: string) => {
    unlockAudioContextNow();
    if (isChatClosedByOtherDeal) return;
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    sendMessage(text);
    setInputMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcceptDeal = async () => {
    if (!dispatchDeal || isAcceptingDeal) return;
    setIsAcceptingDeal(true);
    try {
      const res = await acceptDispatchDealParty({
        deal: dispatchDeal,
        partyRole,
        currentUserId,
        conversationId: conversation.id,
      });

      setDispatchDeal(res.updatedDeal);

      if (res.finalized) {
        toast.success(
          lang === 'fr'
            ? 'Accord confirmé ! Réservation créée, campagne clôturée et localisation de la machine mise à jour.'
            : 'تم قبول الصفقة بنجاح! تم تسجيل الحجز، إغلاق باقي العروض، وتحديث موقع الآلية إلى الورش.'
        );
      } else {
        toast.success(
          lang === 'fr'
            ? 'Votre confirmation est enregistrée. En attente de l’autre partie.'
            : 'تم تسجيل موافقتك! بمجرد ضغط الطرف الآخر على «قبول الصفقة» سيتم تثبيت الحجز.'
        );
      }
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de confirmer l’accord actuellement'
          : 'تعذر إتمام قبول الصفقة حالياً، يرجى المحاولة مرة أخرى'
      );
    } finally {
      setIsAcceptingDeal(false);
    }
  };

  const handleCloseDriverDeal = async () => {
    if (!driverDeal || isClosingDriverDeal) return;
    setIsClosingDriverDeal(true);
    try {
      const res = await acceptAndCloseDriverDealParty({
        deal: driverDeal,
        partyRole: driverPartyRole,
        currentUserId,
        currentUserName: profile?.full_name || '',
        currentUserPhone: profile?.phone || '',
        conversationId: conversation.id,
      });

      setDriverDeal(res.updatedDeal);

      if (res.finalized) {
        toast.success(
          lang === 'fr'
            ? 'Accord conclu ! L’offre d’emploi est désormais clôturée dans la liste.'
            : 'تم إغلاق الصفقة بنجاح! أُغلق عرض العمل تلقائياً في لائحة عروض العمل.'
        );
      } else {
        toast.success(
          lang === 'fr'
            ? 'Confirmation enregistrée ! Dès que l’autre partie clique sur «Clôturer l’accord», l’offre sera fermée.'
            : 'تم تسجيل موافقتك على شروط العمل! بمجرد ضغط الطرف الآخر على «إغلاق الصفقة» سيُغلق العرض نهائياً.'
        );
      }
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de clôturer l’accord pour le moment'
          : 'تعذر إتمام إغلاق الصفقة حالياً، يرجى المحاولة مرة أخرى'
      );
    } finally {
      setIsClosingDriverDeal(false);
    }
  };

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return t('chat.today');
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return t('chat.yesterday');
    }
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const other = conversation.other_participant;
  const hasCurrentPartyAccepted = Boolean(
    dispatchDeal &&
      (isRequesterParty ? dispatchDeal.contractor_accepted : dispatchDeal.owner_accepted)
  );
  const hasDriverPartyAccepted = Boolean(
    driverDeal &&
      (driverPartyRole === 'driver' ? driverDeal.driver_accepted : driverDeal.owner_accepted)
  );

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2]/30 dark:bg-ink relative overflow-hidden select-none">
      {/* 1. WhatsApp-like Header with Dual-Sided Indicators */}
      <header className="p-3.5 bg-white border-b border-steel-200 flex items-center justify-between gap-3 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back button on mobile */}
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="md:hidden p-1.5 -ms-1 rounded-xl text-steel-600 hover:text-ink hover:bg-steel-100 transition-colors cursor-pointer"
              aria-label={t('chat.back_to_list')}
            >
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
          )}

          {/* Peer Avatar with Role Icon */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-ink border border-primary/40 flex items-center justify-center font-black text-xs uppercase shadow-xs">
              {other.role === 'owner' ? (
                <Truck className="w-5 h-5 text-primary-dark" />
              ) : other.role === 'driver' ? (
                <HardHat className="w-5 h-5 text-primary-dark" />
              ) : (
                <Building2 className="w-5 h-5 text-primary-dark" />
              )}
            </div>
            <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          {/* Peer Info */}
          <div className="min-w-0 text-start">
            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-xs sm:text-sm text-ink truncate">
                {other.company_name || other.full_name}
              </h3>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>

            <p className="text-[11px] text-steel-500 truncate flex items-center gap-1.5">
              {isPeerTyping ? (
                <span className="text-emerald-700 font-bold animate-pulse">
                  {t('chat.typing')}
                </span>
              ) : (
                <>
                  <span className="font-bold text-steel-700">
                    {other.role === 'owner'
                      ? lang === 'fr'
                        ? "Propriétaire d'engins"
                        : 'مالك آليات ومعدات'
                      : other.role === 'driver'
                      ? lang === 'fr'
                        ? "Conducteur d'engins"
                        : 'سائق آليات ومعدات'
                      : lang === 'fr'
                      ? 'Client / Demandeur'
                      : 'زبون / صاحب موقع عمل'}
                  </span>
                  <span>·</span>
                  <span>{other.city || 'المغرب'}</span>
                  <span className="text-emerald-600 font-bold font-mono">● {t('chat.online')}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Phone Call */}
        {other.phone && (
          <a
            href={`tel:${other.phone}`}
            className="h-9 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-bold text-xs"
            title={other.phone}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'fr' ? 'Appeler' : 'اتصال هاتفي'}</span>
          </a>
        )}
      </header>

      {/* 2. Pinned Machine Context Card if Associated with this Chat */}
      {conversation.machine && <ChatMachineContextCard machine={conversation.machine} />}

      {/* 3. Message Thread Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-start">
        {messages.length === 0 && !isLoadingMessages && (
          <div className="p-8 text-center my-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-ink flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-6 h-6 text-primary-dark" />
            </div>
            <p className="text-xs text-steel-600 max-w-sm mx-auto leading-relaxed">
              {lang === 'fr'
                ? 'Démarrez la conversation en envoyant un message ou en choisissant une question rapide ci-dessous.'
                : 'ابدأ المحادثة بإرسال رسالة أو باختيار استفسار سريع من القائمة في الأسفل.'}
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isSender = msg.sender_id === currentUserId;
          const showDateSeparator =
            index === 0 ||
            new Date(msg.created_at).toDateString() !==
              new Date(messages[index - 1].created_at).toDateString();

          const isRead = Boolean(msg.read_at);
          const inlineOfferMeta = parseDriverOfferMessageRow(msg);
          const cachedInlineMachine = inlineOfferMeta?.machine_id
            ? machineStore.getCachedMachines().find((m) => m.id === inlineOfferMeta.machine_id)
            : undefined;
          const inlineThumb =
            inlineOfferMeta?.machine_image ||
            cachedInlineMachine?.images?.[0] ||
            (driverDeal && inlineOfferMeta?.offer_id === driverDeal.offer_id
              ? driverDeal.machine_image
              : '') ||
            '';
          const inlineMachineTitle =
            inlineOfferMeta?.machine_title ||
            cachedInlineMachine?.title_ar ||
            (lang === 'fr'
              ? inlineOfferMeta?.machine_label_fr
              : inlineOfferMeta?.machine_label_ar) ||
            '';
          const isInlineOfferAccepted = Boolean(
            driverDeal &&
              inlineOfferMeta?.offer_id === driverDeal.offer_id &&
              driverDeal.deal_status === 'accepted'
          );

          return (
            <React.Fragment key={msg.id}>
              {/* Date Separator Pill */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/80 border border-steel-200 text-steel-600 text-[10px] font-bold shadow-xs">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Compact Machine Thumbnail Card at start of each new driver campaign block */}
              {inlineOfferMeta && (
                <div className="flex justify-center my-2">
                  <div className="w-full max-w-md bg-white/95 border border-primary/40 rounded-2xl p-2.5 shadow-xs flex items-center gap-3">
                    {inlineThumb ? (
                      <img
                        src={inlineThumb}
                        alt={inlineMachineTitle}
                        className="w-12 h-12 rounded-xl object-cover border border-steel-200 shrink-0 bg-steel-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <HardHat className="w-5 h-5 text-primary-dark" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black text-primary-dark truncate">
                          {lang === 'fr' ? 'Nouvelle offre · Engin' : 'حملة بحث جديدة · الآلية'}
                        </span>
                        {isInlineOfferAccepted && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                            {lang === 'fr' ? 'Conclue' : 'متفق عليها'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black text-ink truncate mt-0.5">
                        {inlineMachineTitle}
                      </p>
                      <p className="text-[10px] text-steel-500 font-bold truncate mt-0.5">
                        {Number(inlineOfferMeta.offered_salary) > 0
                          ? `${Number(inlineOfferMeta.offered_salary).toLocaleString('fr-FR')} ${
                              lang === 'fr' ? 'MAD' : 'د.م'
                            }/${
                              inlineOfferMeta.salary_unit === 'month'
                                ? lang === 'fr'
                                  ? 'mois'
                                  : 'شهر'
                                : lang === 'fr'
                                ? 'jour'
                                : 'يوم'
                            }`
                          : ''}
                        {Number(inlineOfferMeta.offered_salary) > 0 && inlineOfferMeta.duration_label
                          ? ' · '
                          : ''}
                        {inlineOfferMeta.duration_label || ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Bubble Row */}
              <div className={`flex w-full ${isSender ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl shadow-xs text-start relative space-y-1 transition-all ${
                    isSender
                      ? 'bg-amber-100/95 text-ink border border-amber-300/80 rounded-ee-xs'
                      : 'bg-white text-ink border border-steel-200 rounded-es-xs'
                  }`}
                >
                  {/* Message Body */}
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text font-medium">
                    {stripDispatchMarker(
                      msg.body || (msg as any).content || (msg as any).message || (msg as any).text || ''
                    )}
                  </p>

                  {/* Metadata: Timestamp & Read Receipts */}
                  <div
                    className={`flex items-center gap-1 text-[10px] ${
                      isSender ? 'justify-end text-steel-600' : 'justify-start text-steel-400'
                    }`}
                  >
                    <span className="font-mono latin-nums">{formatTime(msg.created_at)}</span>

                    {/* Sender Receipts */}
                    {isSender && (
                      <span className="ms-0.5">
                        {msg.is_optimistic ? (
                          <Clock className="w-3 h-3 text-steel-400 animate-spin" />
                        ) : isRead ? (
                          <span title="Lu">
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                          </span>
                        ) : (
                          <span title="Délivré">
                            <CheckCheck className="w-3.5 h-3.5 text-steel-500" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Realtime Typing Indicator Bubble */}
        {isPeerTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-steel-200 px-4 py-2.5 rounded-2xl rounded-es-xs shadow-xs flex items-center gap-1.5 text-xs text-steel-600">
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ms-1 font-bold text-[11px] text-steel-500">{t('chat.typing')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Mutual "قبول الصفقة" Bar (Directly Below Messages for Dispatch Opportunities) */}
      {dispatchDeal && (
        <div className="shrink-0 z-10">
          {dispatchDeal.deal_status === 'closed_other' ? (
            <div className="px-3.5 py-3 bg-steel-100 border-t border-steel-300 flex items-center gap-2.5 text-xs text-steel-700 font-bold">
              <Lock className="w-4 h-4 text-steel-600 shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Campagne terminée : cette opportunité a été conclue avec un autre propriétaire.'
                  : 'تم إغلاق هذه المحادثة بعد اتفاق الزبون مع مالك آخر — انتهت حملة البحث.'}
              </span>
            </div>
          ) : dispatchDeal.deal_status === 'accepted' ? (
            <div className="px-3.5 py-2.5 bg-emerald-50 border-t-2 border-emerald-400 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0 text-emerald-900 font-black">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {isSpareDeal
                    ? lang === 'fr'
                      ? 'Accord confirmé ! Commande de pièce enregistrée.'
                      : 'تم قبول الصفقة من الطرفين! تم تأكيد طلب قطعة الغيار.'
                    : lang === 'fr'
                    ? 'Accord confirmé ! Réservation créée & engin localisé sur le site.'
                    : 'تم قبول الصفقة من الطرفين! الحجز مفعّل الآن وموقع الآلية تحوّل إلى موقع العمل.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(isContractor ? '/entreprise/bookings' : '/owner/bookings')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Voir la commande' : 'عرض الطلب في الحجوزات'}</span>
              </button>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 bg-ink text-white border-t-2 border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 space-y-1 text-start">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-primary truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {dispatchDeal.part_reference ? `Réf: ${dispatchDeal.part_reference} · ` : ''}
                    {dispatchDeal.site_name}
                    {dispatchDeal.site_city ? ` · ${dispatchDeal.site_city}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                      dispatchDeal.contractor_accepted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-white/10 text-steel-300'
                    }`}
                  >
                    {dispatchDeal.contractor_accepted ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>
                      {isSpareDeal
                        ? lang === 'fr'
                          ? 'Demandeur'
                          : 'موافقة الطالب'
                        : lang === 'fr'
                        ? 'Entreprise'
                        : 'موافقة الزبون'}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                      dispatchDeal.owner_accepted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-white/10 text-steel-300'
                    }`}
                  >
                    {dispatchDeal.owner_accepted ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>
                      {isSpareDeal
                        ? lang === 'fr'
                          ? 'Fournisseur'
                          : 'موافقة المورد'
                        : lang === 'fr'
                        ? 'Propriétaire'
                        : 'موافقة المالك'}
                    </span>
                  </span>
                </div>
              </div>

              {hasCurrentPartyAccepted ? (
                <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-primary/50 text-primary text-xs font-black flex items-center justify-center gap-1.5 shrink-0 min-h-[42px]">
                  <Clock className="w-4 h-4 animate-pulse shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Confirmé — En attente du partenaire'
                      : 'تمت موافقتك — في انتظار قبول الطرف الآخر'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAcceptDeal}
                  disabled={isAcceptingDeal}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0 min-h-[44px] disabled:opacity-60"
                >
                  {isAcceptingDeal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Handshake className="w-4 h-4" />
                  )}
                  <span>{lang === 'fr' ? 'Accepter l’accord' : 'قبول الصفقة'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4B. Mutual "إغلاق الصفقة" Bar for Driver Job Offers */}
      {driverDeal && !dispatchDeal && (
        <div className="shrink-0 z-10">
          {driverDeal.deal_status === 'accepted' ? (
            <div className="px-3.5 py-2.5 bg-emerald-50 border-t-2 border-emerald-400 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0 text-emerald-900 font-black">
                {driverDeal.machine_image ? (
                  <img
                    src={driverDeal.machine_image}
                    alt={driverDeal.machine_title || driverDeal.machine_label_ar}
                    className="w-9 h-9 rounded-lg object-cover border border-emerald-300 shrink-0"
                  />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="truncate block">
                    {lang === 'fr'
                      ? `Accord conclu : ${driverDeal.machine_title || driverDeal.machine_label_fr}`
                      : `تم الاتفاق على الصفقة (${driverDeal.machine_title || driverDeal.machine_label_ar}) 🤝`}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 truncate block">
                    {driverDeal.offered_salary > 0
                      ? `${driverDeal.offered_salary.toLocaleString('fr-FR')} ${
                          lang === 'fr' ? 'MAD' : 'د.م'
                        }/${
                          driverDeal.salary_unit === 'month'
                            ? lang === 'fr'
                              ? 'mois'
                              : 'شهر'
                            : lang === 'fr'
                            ? 'jour'
                            : 'يوم'
                        }`
                      : ''}
                    {driverDeal.duration_label ? ` · ${driverDeal.duration_label}` : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(profile?.role === 'driver' ? '/driver/joboffer' : '/owner/drivers')
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>
                  {profile?.role === 'driver'
                    ? lang === 'fr'
                      ? 'Voir mes missions'
                      : 'عروض العمل'
                    : lang === 'fr'
                    ? 'Voir dans Chauffeurs'
                    : 'قسم السائقون'}
                </span>
              </button>
            </div>
          ) : driverDeal.deal_status === 'closed' ? (
            <div className="px-3.5 py-2.5 bg-steel-100 border-t border-steel-300 flex items-center gap-2 text-xs text-steel-700 font-bold">
              <Lock className="w-4 h-4 text-steel-600 shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Cette offre d’emploi a été clôturée par le propriétaire.'
                  : 'تم إغلاق عرض العمل هذا وإزالته من لائحة عروض العمل.'}
              </span>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 bg-ink text-white border-t-2 border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 flex items-center gap-2.5 text-start">
                {driverDeal.machine_image ? (
                  <img
                    src={driverDeal.machine_image}
                    alt={driverDeal.machine_title || driverDeal.machine_label_ar}
                    className="w-10 h-10 rounded-xl object-cover border border-primary/40 shrink-0 bg-steel-800"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-primary/40 flex items-center justify-center shrink-0">
                    <HardHat className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-primary truncate">
                    <span className="truncate">
                      {driverDeal.machine_title ||
                        (lang === 'fr' ? driverDeal.machine_label_fr : driverDeal.machine_label_ar)}
                      {driverDeal.offered_salary > 0
                        ? ` · ${driverDeal.offered_salary.toLocaleString('fr-FR')} ${
                            lang === 'fr' ? 'MAD' : 'د.م'
                          }/${
                            driverDeal.salary_unit === 'month'
                              ? lang === 'fr'
                                ? 'mois'
                                : 'شهر'
                              : lang === 'fr'
                              ? 'jour'
                              : 'يوم'
                          }`
                        : ''}
                      {driverDeal.duration_label ? ` · ${driverDeal.duration_label}` : ''}
                    </span>
                  </div>

                <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                      driverDeal.owner_accepted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-white/10 text-steel-300'
                    }`}
                  >
                    {driverDeal.owner_accepted ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>{lang === 'fr' ? 'Propriétaire' : 'موافقة المالك'}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                      driverDeal.driver_accepted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-white/10 text-steel-300'
                    }`}
                  >
                    {driverDeal.driver_accepted ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>{lang === 'fr' ? 'Conducteur' : 'موافقة السائق'}</span>
                  </span>
                </div>
                </div>
              </div>

              {hasDriverPartyAccepted ? (
                <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-primary/50 text-primary text-xs font-black flex items-center justify-center gap-1.5 shrink-0 min-h-[42px]">
                  <Clock className="w-4 h-4 animate-pulse shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Confirmé — En attente du partenaire'
                      : 'تمت موافقتك — في انتظار تأكيد الطرف الآخر لإغلاق الصفقة'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseDriverDeal}
                  disabled={isClosingDriverDeal}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0 min-h-[44px] disabled:opacity-60"
                >
                  {isClosingDriverDeal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Handshake className="w-4 h-4" />
                  )}
                  <span>{lang === 'fr' ? 'Clôturer l’accord' : 'إغلاق الصفقة'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Interactive Quick Chips */}
      {!isChatClosedByOtherDeal && (
        <div className="px-3 pt-2 pb-1 bg-white border-t border-steel-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip)}
              className="px-2.5 py-1 rounded-xl bg-steel-50 hover:bg-amber-100 text-steel-700 hover:text-ink text-[11px] font-bold border border-steel-200 hover:border-primary/40 whitespace-nowrap transition-all cursor-pointer shadow-2xs"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* 6. WhatsApp-style Input Footer */}
      <footer className="p-3 bg-white border-t border-steel-200 shrink-0">
        {isChatClosedByOtherDeal ? (
          <div className="text-center text-xs text-steel-500 font-bold py-2">
            {lang === 'fr'
              ? 'Cette discussion est fermée car la campagne est clôturée.'
              : 'المحادثة مغلقة بعد انتهاء حملة البحث.'}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isDriverChat
                  ? driverPartyRole === 'driver'
                    ? lang === 'fr'
                      ? 'Écrivez au propriétaire au sujet des conditions...'
                      : 'اكتب رسالتك لمالك الآلية حول شروط العمل...'
                    : lang === 'fr'
                    ? 'Écrivez au conducteur pour fixer les conditions...'
                    : 'اكتب رسالتك للسائق لتحديد شروط العمل...'
                  : isContractor
                  ? lang === 'fr'
                    ? 'Écrivez votre message au propriétaire...'
                    : 'اكتب استفسارك لمالك الآلية هنا...'
                  : lang === 'fr'
                  ? 'Répondez au client...'
                  : 'اكتب ردك للزبون هنا...'
              }
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-surface border border-steel-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="w-11 h-11 rounded-2xl bg-primary hover:bg-primary-dark text-ink flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0 cursor-pointer"
              aria-label={t('chat.send')}
            >
              <Send className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </form>
        )}
      </footer>
    </div>
  );
};

export default ChatThread;
