import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  CalendarCheck,
  MessageSquare,
  Building2,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bell,
  Sparkles,
  Lock,
  MapPin,
  HardHat,
  Check,
  Phone,
  TrendingUp,
  X,
  User,
  Users,
  Briefcase,
  MoreHorizontal,
  Volume2,
  Globe,
  Navigation,
  AlertTriangle,
  Pause,
  Play,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { PWAInstallButton } from '../pwa/PWAInstallUI';
import { OpportunityAlertListener } from '../pwa/OpportunityAlertListener';
import { DriverOpportunityAlertListener } from '../pwa/DriverOpportunityAlertListener';
import { ChatAlertListener } from '../pwa/ChatAlertListener';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { TrialBanner } from '../dashboard/TrialBanner';
import { SoftLockModal } from '../dashboard/SoftLockModal';
import { PaymentProofModal } from '../dashboard/PaymentProofModal';
import { ProfileSettingsModal } from '../profile/ProfileSettingsModal';
import { Booking, DispatchNotification } from '../../types/database';
import { bookingStore } from '../../lib/bookingStore';
import { machineStore } from '../../lib/machineStore';
import { chatStore } from '../../lib/chatStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { toast } from '../ui/Toast';
import { serverApi, ServerNotification } from '../../lib/serverApi';
import {
  ensureDispatchConversationLinked,
  updateDispatchNotificationStatus,
} from '../../lib/dispatchService';
import {
  playChatMessageSound,
  playOpportunitySound,
  showBrowserChatNotification,
  unlockAudioContextNow,
} from '../../lib/opportunityAudio';
import { registerOwnerPushNotifications } from '../../lib/pushService';
import { formatDistanceKm } from '../../lib/geoUtils';
import { getClientSegmentOption } from '../../data/clientSegments';
import {
  cacheDriverOfferFromNotification,
  fetchDriverJobOffers,
  subscribeDriverJobOffers,
} from '../../lib/driverOfferService';

export const DashboardLayout: React.FC = () => {
  const { t, isRTL, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, logout, isSuperAdmin, isImpersonating, stopImpersonating, impersonatedUser } = useAuth();
  const { isLocked, isTrial, formattedCountdown, isActive } = useSubscription();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [pendingBookingsCount, setPendingBookingsCount] = useState<number>(0);
  const [driverOpenOffersCount, setDriverOpenOffersCount] = useState<number>(0);
  const [pendingBookingsList, setPendingBookingsList] = useState<Booking[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<ServerNotification[]>([]);
  const [opportunityNotifications, setOpportunityNotifications] = useState<DispatchNotification[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [isPushPromptDismissed, setIsPushPromptDismissed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';
  const isDriver = profile?.role === 'driver';
  const isChatRoute = location.pathname.includes('/messages');
  // Contractors and drivers are NEVER blocked by owner 72h trial soft-lock!
  const shouldShowLock = !isContractor && !isDriver && isLocked && !isChatRoute;

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    const updateUnread = async () => {
      if (!profile?.id || (isSuperAdmin && !isImpersonating)) {
        setUnreadMessagesCount(0);
        return;
      }

      let count = chatStore.getTotalUnread(profile.id);

      if (isSupabaseConfigured) {
        try {
          const { data: convs } = await supabase
            .from('conversations')
            .select('id')
            .or(
              `participant_a.eq.${profile.id},participant_b.eq.${profile.id},participant_one.eq.${profile.id},participant_two.eq.${profile.id}`
            );

          if (convs && convs.length > 0) {
            const convIds = convs.map((c: any) => c.id);
            const { count: dbCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .in('conversation_id', convIds)
              .neq('sender_id', profile.id)
              .is('read_at', null);

            if (typeof dbCount === 'number') {
              count = dbCount;
            }
          } else {
            count = 0;
          }
        } catch {
          // Fallback to local store count
        }
      } else {
        count = chatStore.getTotalUnread(profile.id);
      }

      setUnreadMessagesCount((prev) => (prev === count ? prev : count));
    };

    updateUnread();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') updateUnread();
    }, 60000);
    const onVisibleUnread = () => {
      if (document.visibilityState === 'visible') updateUnread();
    };
    const onChatUnreadEvent = () => {
      updateUnread();
    };
    document.addEventListener('visibilitychange', onVisibleUnread);
    window.addEventListener('storage', updateUnread);
    window.addEventListener('jadijcb_chat_unread_updated', onChatUnreadEvent);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibleUnread);
      window.removeEventListener('storage', updateUnread);
      window.removeEventListener('jadijcb_chat_unread_updated', onChatUnreadEvent);
    };
  }, [profile?.id, isSuperAdmin, isImpersonating]);

  // Sync system/chat notifications for BOTH owners and contractors
  const refreshSystemNotifications = React.useCallback(async () => {
    const activeId = profile?.id || user?.id;
    if (!activeId || (isSuperAdmin && !isImpersonating)) return;
    try {
      const merged: ServerNotification[] = [];
      const seenIds = new Set<string>();

      const notifRes = await serverApi.getNotifications({
        user_id: activeId,
        role: profile?.role || 'owner',
      });
      if (Array.isArray(notifRes.notifications)) {
        for (const n of notifRes.notifications) {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            merged.push(n);
          }
        }
      }

      if (isSupabaseConfigured) {
        try {
          const { data: sbNotifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', activeId)
            .order('created_at', { ascending: false })
            .limit(20);
          if (Array.isArray(sbNotifs)) {
            for (const r of sbNotifs as any[]) {
              const dedupKey = r.data?.message_id || r.id;
              const alreadyInServer = merged.some(
                (m) => m.id === r.id || (m.data?.message_id && m.data.message_id === dedupKey)
              );
              if (!alreadyInServer) {
                merged.push({
                  id: r.id,
                  user_id: r.user_id,
                  title_ar: r.title_ar || '',
                  title_fr: r.title_fr || '',
                  body_ar: r.body_ar || '',
                  body_fr: r.body_fr || '',
                  type: r.type || 'info',
                  is_read: Boolean(r.is_read),
                  read: Boolean(r.is_read),
                  data: r.data || {},
                  created_at: r.created_at,
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      merged.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSystemNotifications(merged.slice(0, 30));
    } catch {
      // ignore
    }
  }, [profile?.id, profile?.role, user?.id, isSuperAdmin, isImpersonating]);

  useEffect(() => {
    refreshSystemNotifications();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshSystemNotifications();
    }, 60000);
    window.addEventListener('jadijcb_chat_unread_updated', refreshSystemNotifications);

    const activeId = profile?.id || user?.id;
    let notifChannel: any = null;
    if (isSupabaseConfigured && activeId && !(isSuperAdmin && !isImpersonating)) {
      try {
        notifChannel = supabase
          .channel(`dashboard_notifs_${activeId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${activeId}`,
            },
            (payload: any) => {
              const row = payload?.new;
              refreshSystemNotifications();
              if (row?.type === 'booking_breakdown') {
                window.dispatchEvent(new CustomEvent('jadijcb_booking_event'));
                playOpportunitySound();
                const alertTitle =
                  lang === 'fr'
                    ? row.title_fr || '⚠️ Panne signalée sur un engin loué !'
                    : row.title_ar || '⚠️ تنبيه عطل جديد في آلية مستلمة!';
                const alertBody = lang === 'fr' ? row.body_fr : row.body_ar;
                toast.error(alertBody ? `${alertTitle} — ${alertBody}` : alertTitle);
                showBrowserChatNotification({
                  title: alertTitle,
                  body: alertBody || '',
                  tag: `breakdown_${row.id || Date.now()}`,
                  url: '/owner/bookings?tab=active',
                });
              } else if (
                row?.type === 'booking_breakdown_resolved' ||
                row?.type === 'booking_paused' ||
                row?.type === 'booking_resumed'
              ) {
                window.dispatchEvent(new CustomEvent('jadijcb_booking_event'));
                if (row.type === 'booking_paused' || row.type === 'booking_resumed') {
                  playChatMessageSound();
                  const title =
                    lang === 'fr'
                      ? row.title_fr ||
                        (row.type === 'booking_paused'
                          ? '⏸️ Location mise en pause'
                          : '▶️ Location reprise')
                      : row.title_ar ||
                        (row.type === 'booking_paused'
                          ? '⏸️ تم إيقاف عداد الحجز مؤقتاً'
                          : '▶️ تم استئناف الحجز');
                  const body = lang === 'fr' ? row.body_fr : row.body_ar;
                  toast.info(body ? `${title} — ${body}` : title);
                  showBrowserChatNotification({
                    title,
                    body: body || '',
                    tag: `pause_${row.id || Date.now()}`,
                    url: '/entreprise/bookings',
                  });
                }
              } else if (
                row?.type === 'driver_job_offer' ||
                row?.type === 'driver_deal_closed' ||
                row?.type === 'driver_work_ended' ||
                row?.type === 'driver_application'
              ) {
                if (row?.type === 'driver_job_offer') {
                  cacheDriverOfferFromNotification(row);
                }
                window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated'));
              }
            }
          )
          .subscribe();
      } catch {
        // Ignore realtime errors
      }
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('jadijcb_chat_unread_updated', refreshSystemNotifications);
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, [refreshSystemNotifications, profile?.id, user?.id, isSuperAdmin, isImpersonating, lang]);

  // Sync open driver job offers badge count
  useEffect(() => {
    if (!isDriver || !profile?.id) {
      setDriverOpenOffersCount(0);
      return;
    }

    const syncDriverBadge = async () => {
      try {
        const list = await fetchDriverJobOffers(profile.id);
        setDriverOpenOffersCount(list.filter((o) => o.status === 'open' && !o.has_applied).length);
      } catch {
        // ignore
      }
    };

    syncDriverBadge();
    const unsub = subscribeDriverJobOffers(profile.driver_machines || [], syncDriverBadge);
    return unsub;
  }, [isDriver, profile?.id, profile?.driver_machines]);

  // Sync pending bookings for owner notification badge with real-time updates
  useEffect(() => {
    if (!profile?.id || isContractor || isDriver || (isSuperAdmin && !isImpersonating)) return;

    let previousCount = -1;

    const checkPending = async () => {
      // Avoid interrupting the active chat experience with background booking polling
      if (location.pathname.includes('/messages')) return;

      try {
        let ownerMachineIds = machineStore
          .getCachedMachines()
          .filter((m) => m.owner_id === profile.id || !m.owner_id)
          .map((m) => m.id)
          .filter(Boolean);

        // Also fetch owner machine IDs from database to ensure fresh fleet list
        if (isSupabaseConfigured && profile.id) {
          try {
            const { data: dbMachs } = await supabase
              .from('machines')
              .select('id')
              .eq('owner_id', profile.id);
            if (dbMachs && dbMachs.length > 0) {
              const freshIds = dbMachs.map((m: any) => m.id).filter(Boolean);
              ownerMachineIds = Array.from(new Set([...ownerMachineIds, ...freshIds]));
            }
          } catch {
            // ignore
          }
        }

        let dbBookings: Booking[] = [];

        // 1. Fetch from Server SQLite DB (shared across all devices & users)
        try {
          const serverBookings = await serverApi.getBookings({
            owner_id: profile.id,
            status: 'pending',
          });
          if (serverBookings && serverBookings.length > 0) {
            dbBookings = serverBookings;
          }
        } catch (serverErr) {
          console.warn('Server SQLite pending load notice:', serverErr);
        }

        // 2. Fetch from Supabase (if configured)
        if (isSupabaseConfigured) {
          try {
            const fetchedMap = new Map<string, any>();

            const BOOKING_PENDING_COLS =
              'id, machine_id, owner_id, client_id, client_name, client_phone, start_at, end_at, total_price, status, notes, created_at, with_operator';
            let hadQueryError = false;

            if (isSuperAdmin) {
              // Super admin sees all pending bookings
              const { data: allData, error: allErr } = await supabase
                .from('bookings')
                .select(BOOKING_PENDING_COLS)
                .eq('status', 'pending')
                .limit(50);
              if (!allErr && allData) {
                for (const row of allData) fetchedMap.set(row.id, row);
              }
            } else {
              // 1. Pending bookings where user is directly the booking owner
              if (profile.id) {
                const { data: ownerData, error: ownerErr } = await supabase
                  .from('bookings')
                  .select(BOOKING_PENDING_COLS)
                  .eq('status', 'pending')
                  .eq('owner_id', profile.id)
                  .limit(50);
                if (ownerErr) hadQueryError = true;
                if (!ownerErr && ownerData) {
                  for (const row of ownerData) fetchedMap.set(row.id, row);
                }
              }

              // 2. Pending bookings for machines belonging to the owner's fleet
              if (ownerMachineIds.length > 0) {
                const { data: machineData, error: mErr } = await supabase
                  .from('bookings')
                  .select(BOOKING_PENDING_COLS)
                  .eq('status', 'pending')
                  .in('machine_id', ownerMachineIds)
                  .limit(50);
                if (mErr) hadQueryError = true;
                if (!mErr && machineData) {
                  for (const row of machineData) fetchedMap.set(row.id, row);
                }
              }

              // 3. Fallback only if queries errored
              if (hadQueryError && fetchedMap.size === 0) {
                const { data: rlsData, error: rlsErr } = await supabase
                  .from('bookings')
                  .select(BOOKING_PENDING_COLS)
                  .eq('status', 'pending')
                  .limit(50);
                if (!rlsErr && rlsData) {
                  for (const row of rlsData) fetchedMap.set(row.id, row);
                }
              }
            }

            if (fetchedMap.size > 0) {
              const mapped = Array.from(fetchedMap.values()).map((b: any) => ({
                id: b.id,
                machine_id: b.machine_id,
                owner_id: b.owner_id,
                client_id: b.client_id,
                client_name: b.client_name,
                client_phone: b.client_phone,
                start_at: b.start_at || b.start_date,
                end_at: b.end_at || b.end_date,
                total_price: Number(b.total_price) || 0,
                status: b.status,
                notes: b.notes,
                created_at: b.created_at,
                machine: b.machines,
                with_operator: Boolean(b.with_operator ?? true),
              }));
              dbBookings = [...dbBookings, ...mapped];
            }
          } catch (e) {
            console.warn('DB pending check warning:', e);
          }
        }

        const pendingList = dbBookings.filter((b) => b.status === 'pending');
        const count = pendingList.length;

        setPendingBookingsCount((prev) => (prev === count ? prev : count));
        setPendingBookingsList((prev) => {
          if (
            prev.length === count &&
            prev.every((b, i) => b.id === pendingList[i]?.id)
          ) {
            return prev;
          }
          return pendingList;
        });

        // Notify user if a new booking just arrived
        if (previousCount >= 0 && count > previousCount) {
          toast.info(
            lang === 'fr'
              ? '🚜 Nouvelle demande de location reçue ! Vérifiez vos notifications.'
              : '🚜 وصلك طلب كراء جديد الآن! اضغط على جرس الإشعارات لتأكيده.'
          );
        }
        previousCount = count;
      } catch {
        // Ignore background pending check errors
      }
    };

    checkPending();

    // 1. In-tab custom event
    const handleEvent = () => checkPending();
    window.addEventListener('jadijcb_booking_event', handleEvent);
    window.addEventListener('jadijcb_bookings_updated', handleEvent);

    // 2. Cross-tab storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jadijcb_cached_bookings' || e.key === 'jadijcb_last_booking_event') {
        checkPending();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Relaxed silent refresh (60s) only while tab is visible
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') checkPending();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkPending();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('jadijcb_booking_event', handleEvent);
      window.removeEventListener('jadijcb_bookings_updated', handleEvent);
      window.removeEventListener('storage', handleStorage);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile?.id, isContractor, isDriver, lang]);

  const contractorNavigationItems = [
    {
      to: '/entreprise',
      exact: true,
      label: lang === 'fr' ? 'Espace Client' : 'لوحة الزبون',
      mobileLabel: lang === 'fr' ? 'Accueil' : 'الرئيسية',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      to: '/entreprise/map',
      label: lang === 'fr' ? 'Radar Engins Proches' : 'رادار الآليات القريبة',
      mobileLabel: lang === 'fr' ? 'Radar' : 'الرادار',
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      to: '/entreprise/bookings',
      label: lang === 'fr' ? 'Mes Locations' : 'حجوزاتي وتمديد الكراء',
      mobileLabel: lang === 'fr' ? 'Locations' : 'حجوزاتي',
      icon: <CalendarCheck className="w-5 h-5" />,
    },
    {
      to: '/entreprise/projects',
      label: lang === 'fr' ? 'Sites & Projets' : 'مواقع العمل والمشاريع',
      mobileLabel: lang === 'fr' ? 'Sites' : 'مواقعي',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      to: '/entreprise/messages',
      label: t('nav.messages'),
      mobileLabel: t('nav.messages'),
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadMessagesCount,
    },
  ];

  const ownerNavigationItems = [
    {
      to: '/owner',
      exact: true,
      label: lang === 'fr' ? 'Aujourd\'hui' : 'اليوم',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/owner/bookings',
      label: t('nav.bookings'),
      icon: <CalendarCheck className="w-5 h-5" />,
      badge: pendingBookingsCount,
    },
    {
      to: '/owner/machines',
      label: t('nav.machines'),
      icon: <Truck className="w-5 h-5" />,
    },
    {
      to: '/owner/clients',
      label: lang === 'fr' ? 'Clients' : 'الزبائن',
      icon: <Users className="w-5 h-5" />,
    },
    {
      to: '/owner/drivers',
      label: lang === 'fr' ? 'Chauffeurs' : 'السائقون',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      to: '/owner/analytics',
      label: lang === 'fr' ? 'Finances & Rentabilité' : 'المالية والأرباح',
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      to: '/owner/storefront',
      label: t('nav.storefront'),
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      to: '/owner/settings/business',
      label: lang === 'fr' ? 'Profil Entreprise' : 'إعدادات المقاولة',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      to: '/owner/messages',
      label: t('nav.messages'),
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadMessagesCount,
    },
  ];

  const driverNavigationItems = [
    {
      to: '/driver',
      exact: true,
      label: lang === 'fr' ? 'Espace Conducteur' : 'لوحة السائق',
      mobileLabel: lang === 'fr' ? 'Accueil' : 'لوحتي',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      to: '/driver/joboffer',
      label: lang === 'fr' ? 'Offres d’emploi' : 'عروض العمل والطلبات',
      mobileLabel: lang === 'fr' ? 'Offres' : 'عروض العمل',
      icon: <Briefcase className="w-5 h-5" />,
      badge: driverOpenOffersCount,
    },
    {
      to: '/driver/messages',
      label: t('nav.messages'),
      mobileLabel: t('nav.messages'),
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadMessagesCount,
    },
  ];

  const navigationItems = isDriver
    ? driverNavigationItems
    : isContractor
    ? contractorNavigationItems
    : ownerNavigationItems;

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const clientSegOpt = getClientSegmentOption(profile?.client_segment);
  const displayName =
    profile?.company_name ||
    profile?.full_name ||
    (isDriver
      ? lang === 'fr'
        ? 'Conducteur JADIJCB'
        : 'سائق محترف JADIJCB'
      : isContractor
      ? lang === 'fr'
        ? 'Client JADIJCB'
        : 'زبون JADIJCB'
      : 'مالك آليات معتمد');
  const roleLabel =
    profile?.role === 'owner'
      ? t('auth.role_owner')
      : profile?.role === 'admin'
      ? 'Super Admin'
      : isDriver
      ? lang === 'fr'
        ? 'Conducteur d’engins'
        : 'سائق آليات الحفر'
      : profile?.client_segment
      ? lang === 'fr'
        ? clientSegOpt.labelFr
        : clientSegOpt.labelAr
      : lang === 'fr'
      ? 'Client / Locataire'
      : 'زبون / طالب آليات';

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row relative overflow-x-hidden">
      {/* Desktop Sidebar (Logical start-0) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-ink text-white border-e border-steel-800 shrink-0 sticky top-0 h-screen select-none z-30">
        {/* Brand Area */}
        <div className="p-6 border-b border-steel-800">
          <Logo variant="light" size="md" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const isItemActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isItemActive
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-steel-300 hover:text-white hover:bg-steel-800'
                }`}
              >
                <div className="relative shrink-0">
                  {item.icon}
                  {item.badge && item.badge > 0 && !isItemActive && (
                    <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className="flex-1 text-start">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isItemActive ? 'bg-ink text-primary' : 'bg-primary text-ink'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isItemActive && (
                  <span className="shrink-0 text-ink">
                    {isRTL ? (
                      <ChevronLeft className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Status, Subscription Badge & Language */}
        <div className="p-4 border-t border-steel-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-8 h-8 rounded-lg object-cover border border-primary/70 shrink-0 bg-steel-800"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-steel-800 flex items-center justify-center font-bold text-xs text-primary border border-steel-700 uppercase shrink-0">
                  {displayName.slice(0, 2)}
                </div>
              )}
              <div className="flex flex-col text-start min-w-0">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {displayName}
                </span>
                <span className="text-[10px] text-steel-400 truncate max-w-[120px]">
                  {roleLabel}
                </span>
              </div>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>

          {/* Edit Profile Button */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-steel-900 hover:bg-steel-800 border border-steel-700/80 text-[11px] font-bold text-steel-300 hover:text-white hover:border-primary transition-colors cursor-pointer w-full text-start"
          >
            <User className="w-3.5 h-3.5 text-primary" />
            <span>{lang === 'fr' ? 'Modifier mes informations' : 'تعديل معلوماتي الشخصية'}</span>
          </button>

          {/* Install Mobile App Button */}
          <PWAInstallButton variant="sidebar" />

          {/* Subscription Mini Pill (Only for machinery owners) */}
          {isTrial && !isLocked && !isContractor && !isDriver && (
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center justify-between p-2 rounded-xl bg-steel-900 border border-steel-700/80 text-[11px] hover:border-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('trial.status_trial')}</span>
              </div>
              <span className="font-mono text-white text-[10px] font-bold">
                {formattedCountdown}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-steel-400 hover:text-danger transition-colors py-2 px-1 min-h-[44px] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Super Admin Impersonation Active Banner */}
        {isImpersonating && (
          <div className="bg-amber-400 text-ink px-4 py-2.5 text-xs font-black flex flex-wrap items-center justify-between gap-2 shadow-md z-40 border-b-2 border-ink">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ink animate-ping" />
              <span>
                👑 {lang === 'fr' ? 'Super Admin actif' : 'وضع المشرف العام (Super Admin)'}:{' '}
                {lang === 'fr'
                  ? `Vous visualisez l'espace en tant que : ${impersonatedUser?.company_name || impersonatedUser?.full_name}`
                  : `أنت تتصفح المنصة حالياً بصلاحية حساب: ${impersonatedUser?.company_name || impersonatedUser?.full_name}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                stopImpersonating();
                navigate('/admin');
              }}
              className="px-3 py-1 rounded-xl bg-ink text-white font-bold hover:bg-steel-900 transition-colors text-[11px] cursor-pointer"
            >
              {lang === 'fr' ? 'Quitter la vue & Retourner au SuperAdmin ↩' : 'الرجوع إلى لوحة السوبر أدمن ↩'}
            </button>
          </div>
        )}

        {/* Trial Live Banner: only for machinery owners */}
        {!isContractor && !isDriver && (
          <TrialBanner onOpenPaymentModal={() => setIsPaymentModalOpen(true)} />
        )}

        {/* Mobile & Tablet Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-steel-200/80 px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 max-w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <div className="md:hidden shrink-0">
              <Logo size="sm" />
            </div>
            <h1 className="hidden md:block text-base font-bold text-ink truncate">
              {navigationItems.find((i) =>
                i.exact
                  ? location.pathname === i.to
                  : location.pathname.startsWith(i.to)
              )?.label || t('nav.dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isDriver ? (
              <NavLink
                to="/driver/joboffer"
                className="text-[11px] sm:text-xs font-black text-ink px-2.5 sm:px-3 py-1.5 rounded-xl border border-primary/50 bg-primary hover:bg-primary-hover min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap shrink-0"
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'fr' ? 'Offres d’emploi' : 'عروض العمل'}</span>
              </NavLink>
            ) : isContractor ? (
              <NavLink
                to="/entreprise/map"
                className="text-[11px] sm:text-xs font-black text-ink px-2.5 sm:px-3 py-1.5 rounded-xl border border-primary/50 bg-primary hover:bg-primary-hover min-h-[40px] sm:min-h-[44px] flex items-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">{lang === 'fr' ? 'Radar' : 'الرادار'}</span>
                <span className="hidden sm:inline">{lang === 'fr' ? 'Radar Engins' : 'رادار الآليات القريبة'}</span>
              </NavLink>
            ) : (
              <NavLink
                to="/marketplace"
                className="text-xs font-semibold text-steel-700 hover:text-ink px-2.5 sm:px-3 py-1.5 rounded-lg border border-steel-200 bg-steel-50 hover:bg-steel-100 min-h-[40px] sm:min-h-[44px] flex items-center whitespace-nowrap shrink-0"
              >
                {t('nav.marketplace')}
              </NavLink>
            )}

            {/* Profile Settings Quick Button with Avatar */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-2 sm:px-2.5 py-1.5 text-xs font-bold text-steel-700 hover:text-ink hover:bg-steel-100 rounded-xl border border-steel-200 bg-white min-h-[40px] sm:min-h-[44px] flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
              title={lang === 'fr' ? 'Modifier mes informations' : 'تعديل معلوماتي الشخصية'}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-5 h-5 rounded-full object-cover border border-primary shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-steel-100 text-ink text-[10px] font-bold flex items-center justify-center border border-steel-200 shrink-0">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline whitespace-nowrap">{lang === 'fr' ? 'Mon profil' : 'تعديل حسابي'}</span>
            </button>

            <div className="hidden sm:flex shrink-0">
              <PWAInstallButton variant="header-icon" />
            </div>

            <div className="md:hidden shrink-0">
              <LanguageSwitcher className="px-2! min-h-[40px]!" />
            </div>
              {/* Notifications Button with Live Badge & Dropdown */}
              {(() => {
                const generalSystemNotifs = systemNotifications.filter(
                  (n) => n.type !== 'dispatch_opportunity'
                );
                const unreadSystemCount = generalSystemNotifs.filter((n) => !n.is_read && !n.read).length;
                const unreadOppCount = opportunityNotifications.filter(
                  (n) => !n.is_read && n.status === 'sent'
                ).length;
                const totalAlertsCount = pendingBookingsCount + unreadSystemCount + unreadOppCount;

                return (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && 'Notification' in window) {
                          setNotifPermission(Notification.permission);
                        }
                        setIsNotificationsOpen((prev) => !prev);
                      }}
                      className="p-2 text-steel-600 hover:text-ink hover:bg-steel-100 rounded-lg min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center relative cursor-pointer"
                      aria-label="Notifications"
                    >
                      <Bell className="w-5 h-5" />
                      {totalAlertsCount > 0 && (
                        <span className="absolute top-1 end-1 px-1.5 py-0.2 rounded-full bg-primary text-ink text-[10px] font-black border border-white animate-pulse tabular-nums">
                          {totalAlertsCount}
                        </span>
                      )}
                    </button>

                    {/* Notifications Dropdown */}
                    {isNotificationsOpen && (
                      <div className="fixed sm:absolute top-16 sm:top-full inset-x-3 sm:inset-x-auto sm:end-0 mt-1 sm:mt-2 w-auto sm:w-96 bg-white border border-steel-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-start animate-fade-in">
                        <div className="bg-ink p-3.5 text-white flex items-center justify-between border-b border-primary">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold">
                              {lang === 'fr' ? 'Notifications & Opportunités' : 'الإشعارات والفرص المباشرة'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {totalAlertsCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black tabular-nums">
                                {totalAlertsCount} {lang === 'fr' ? 'nouveaux' : 'جديد'}
                              </span>
                            )}
                            {unreadSystemCount > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await serverApi.markAllNotificationsRead(profile?.id);
                                  setSystemNotifications((prev) =>
                                    prev.map((n) => ({ ...n, is_read: true, read: true }))
                                  );
                                }}
                                className="text-[10px] text-primary hover:underline cursor-pointer"
                              >
                                {lang === 'fr' ? 'Tout marquer lu' : 'قراءة الكل'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Enable or Test Mobile Audio & Push Alerts for Owners & Contractors */}
                        {typeof window !== 'undefined' && 'Notification' in window && (
                          notifPermission === 'default' ? (
                            <div className="p-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Volume2 className="w-4 h-4 text-primary-dark shrink-0" />
                                <span className="text-[11px] font-bold text-ink truncate">
                                  {lang === 'fr'
                                    ? 'Activer les notifications hors application'
                                    : 'فعّل إشعارات الهاتف حتى خارج التطبيق'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  unlockAudioContextNow();
                                  const targetUserId = profile?.id || user?.id || '';
                                  const targetRole = profile?.role || 'owner';
                                  const perm = await registerOwnerPushNotifications(
                                    targetUserId,
                                    targetRole,
                                    profile?.driver_machines
                                  );
                                  setNotifPermission(perm);
                                  if (perm === 'granted') {
                                    playChatMessageSound();
                                    showBrowserChatNotification({
                                      title: lang === 'fr' ? 'Notifications activées 🔔' : 'تم تفعيل إشعارات الهاتف 🔔',
                                      body:
                                        lang === 'fr'
                                          ? 'Les nouveaux messages apparaîtront ici avec sonnerie.'
                                          : 'ستصلك إشعارات الرسائل في القائمة المنسدلة للهاتف مع صوت تنبيه.',
                                      tag: 'jadijcb-test-notif',
                                      url: isDriver
                                        ? '/driver/messages'
                                        : isContractor
                                        ? '/entreprise/messages'
                                        : '/owner/messages',
                                    }).catch(() => {});
                                    toast.success(
                                      lang === 'fr'
                                        ? 'Notifications activées sur votre téléphone !'
                                        : 'تم تفعيل إشعارات الهاتف بنجاح! ستصلك الرسائل في شريط الإشعارات.'
                                    );
                                  } else if (perm === 'denied') {
                                    toast.error(
                                      lang === 'fr'
                                        ? 'Notifications bloquées par le navigateur.'
                                        : 'المتصفح منع الإشعارات، يرجى تفعيلها من إعدادات الموقع.'
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-primary text-ink text-[10px] font-black shrink-0 cursor-pointer"
                              >
                                {lang === 'fr' ? 'Activer' : 'تفعيل 🔔'}
                              </button>
                            </div>
                          ) : notifPermission === 'granted' ? (
                            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-emerald-800 truncate">
                                {lang === 'fr'
                                  ? 'Notifications mobiles actives ✓'
                                  : 'إشعارات الهاتف مفعّلة ✓'}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  unlockAudioContextNow();
                                  playChatMessageSound();
                                  const shown = await showBrowserChatNotification({
                                    title: lang === 'fr' ? 'Test notification JADIJCB 💬' : 'تجربة إشعار الرسائل JADIJCB 💬',
                                    body:
                                      lang === 'fr'
                                        ? 'Sonnerie et notification dans la barre mobile prêtes.'
                                        : 'الصوت وإشعار القائمة المنسدلة للهاتف يعملان بنجاح!',
                                    tag: 'jadijcb-test-notif',
                                    url: isDriver
                                      ? '/driver/messages'
                                      : isContractor
                                      ? '/entreprise/messages'
                                      : '/owner/messages',
                                  });
                                  if (shown) {
                                    toast.success(
                                      lang === 'fr'
                                        ? 'Notification test envoyée !'
                                        : 'تم إرسال إشعار تجريبي بصوت التنبيه إلى شريط الهاتف!'
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0 cursor-pointer hover:bg-emerald-700"
                              >
                                {lang === 'fr' ? 'Tester 🔔' : 'اختبار الإشعار 🔔'}
                              </button>
                            </div>
                          ) : (
                            <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 text-[10px] font-bold text-rose-700">
                              {lang === 'fr'
                                ? 'Notifications bloquées dans les paramètres du navigateur (autorisez-les pour les alertes hors-app).'
                                : 'إشعارات النظام محظورة في إعدادات المتصفح — اسمح بالإشعارات في إعدادات الموقع لتظهر في القائمة المنسدلة.'}
                            </div>
                          )
                        )}

                        <div className="max-h-80 overflow-y-auto p-2 space-y-2">
                          {opportunityNotifications.length === 0 &&
                          pendingBookingsList.length === 0 &&
                          generalSystemNotifs.length === 0 ? (
                            <div className="p-6 text-center text-steel-400 text-xs">
                              <Check className="w-8 h-8 mx-auto mb-1 text-steel-300" />
                              <span>
                                {lang === 'fr'
                                  ? 'Aucune nouvelle demande pour le moment.'
                                  : 'لا توجد طلبات أو فرص جديدة حالياً.'}
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* 0. Live InDrive Dispatch Opportunities */}
                              {opportunityNotifications.map((opp) => {
                                const isSpareOpp =
                                  opp.campaign_type === 'spare_part' || Boolean(opp.part_reference);
                                return (
                                <div
                                  key={opp.id}
                                  className={`p-3 rounded-xl border space-y-2 text-xs shadow-xs ${
                                    !opp.is_read && opp.status === 'sent'
                                      ? 'bg-ink text-white border-primary'
                                      : 'bg-amber-50/70 text-ink border-amber-200'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <img
                                      src="/assets/aistudio/image_010e3368.png"
                                      alt={isSpareOpp ? 'طلب قطعة غيار' : 'فرصة جديدة'}
                                      className="w-9 h-9 object-contain shrink-0 rounded-lg bg-white/10 p-0.5"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span
                                          className={`text-xs font-black ${
                                            !opp.is_read && opp.status === 'sent'
                                              ? 'text-primary'
                                              : 'text-primary-dark'
                                          }`}
                                        >
                                          {isSpareOpp ? 'طلب قطعة غيار 🔧' : 'فرصة جديدة'}
                                        </span>
                                        {opp.is_nationwide ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-85">
                                            <Globe className="w-3 h-3" />
                                            <span>{lang === 'fr' ? 'Maroc' : 'المغرب كاملاً'}</span>
                                          </span>
                                        ) : opp.distance_km != null ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black tabular-nums opacity-90">
                                            <Navigation className="w-3 h-3" />
                                            <span>{formatDistanceKm(opp.distance_km, lang)}</span>
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="font-black leading-snug mt-0.5 break-words">
                                        {isSpareOpp
                                          ? `«${opp.company_name}» يبحث عن Réf: ${opp.part_reference || opp.machine_name}`
                                          : `«${opp.company_name}» محتاجة «${opp.machine_name}» ديالك`}
                                      </p>
                                      <p className="text-[10px] opacity-75 truncate mt-0.5">
                                        {opp.site_name}
                                        {opp.site_city ? ` · ${opp.site_city}` : ''}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const ownerTargetId = profile?.id || user?.id || '';
                                        await Promise.allSettled([
                                          updateDispatchNotificationStatus(
                                            opp.id,
                                            {
                                              is_read: true,
                                              status: 'accepted',
                                            },
                                            opp.campaign_id
                                          ),
                                          ensureDispatchConversationLinked({
                                            contractorId: opp.contractor_id,
                                            ownerId: ownerTargetId,
                                            notification: opp,
                                          }),
                                        ]);
                                        setOpportunityNotifications((prev) =>
                                          prev.map((item) =>
                                            item.id === opp.id
                                              ? { ...item, is_read: true, status: 'accepted' }
                                              : item
                                          )
                                        );
                                        setIsNotificationsOpen(false);
                                        navigate(
                                          `/owner/messages?target=${opp.contractor_id}&machine=${opp.machine_id || ''}&campaign=${opp.campaign_id}`
                                        );
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-primary text-ink font-black text-[11px] hover:bg-primary-hover transition-colors cursor-pointer"
                                    >
                                      {isSpareOpp
                                        ? lang === 'fr'
                                          ? 'Disponible & Discuter'
                                          : 'متوفرة عندي — محادثة'
                                        : lang === 'fr'
                                        ? 'Accepter & Discuter'
                                        : 'موافقة ومحادثة المقاولة'}
                                    </button>
                                    {opp.site_phone && (
                                      <a
                                        href={`tel:${opp.site_phone}`}
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 flex items-center gap-1"
                                      >
                                        <Phone className="w-3 h-3" />
                                        <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                );
                              })}

                              {/* 1. Pending Bookings requiring action */}
                              {pendingBookingsList.map((pb) => (
                                <div
                                  key={pb.id}
                                  className="p-3 bg-amber-50/80 rounded-xl border border-amber-300 space-y-1.5 text-xs shadow-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-ink">
                                      {pb.machine?.title_ar || pb.machine?.title_fr || 'آلية JCB'}
                                    </span>
                                    <span className="text-primary-dark font-black font-mono">
                                      {pb.total_price.toLocaleString('fr-FR')} MAD
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-steel-600 flex items-center gap-2">
                                    <span className="font-bold">{pb.client_name || 'زبون مقاولة'}</span>
                                    {pb.client_phone && (
                                      <span dir="ltr" className="font-mono text-steel-500">
                                        ({pb.client_phone})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-steel-500 font-mono" dir="ltr">
                                    {pb.start_at?.slice(0, 10)} → {pb.end_at?.slice(0, 10)}
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsNotificationsOpen(false);
                                        navigate('/owner/bookings?tab=pending');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-primary text-ink font-bold text-[11px] hover:bg-primary-hover transition-colors cursor-pointer"
                                    >
                                      {lang === 'fr' ? 'Voir et Confirmer' : 'مراجعة وتأكيد'}
                                    </button>
                                    {pb.client_phone && (
                                      <a
                                        href={`https://wa.me/${pb.client_phone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded-lg bg-[#25D366] text-white font-bold text-[11px] hover:bg-[#20bd5a] flex items-center gap-1 cursor-pointer"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                        <span>{lang === 'fr' ? 'WhatsApp' : 'واتساب'}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {/* 2. System & Chat notifications */}
                              {generalSystemNotifs.map((notif) => {
                                const isChatNotif = notif.type === 'chat_message';
                                const isBreakdownNotif =
                                  notif.type === 'booking_breakdown' ||
                                  notif.type === 'booking_breakdown_resolved';
                                const isPauseNotif =
                                  notif.type === 'booking_paused' ||
                                  notif.type === 'booking_resumed';
                                const isDriverOfferNotif =
                                  notif.type === 'driver_job_offer' ||
                                  notif.type === 'driver_deal_closed' ||
                                  notif.type === 'driver_work_ended' ||
                                  notif.type === 'driver_application';
                                const chatConvId = notif.data?.conversation_id || '';
                                const targetOfferId = notif.data?.offer_id || '';
                                return (
                                  <div
                                    key={notif.id}
                                    onClick={async () => {
                                      if (!notif.is_read) {
                                        await serverApi.markNotificationRead(notif.id);
                                        if (isSupabaseConfigured) {
                                          Promise.resolve(
                                            supabase
                                              .from('notifications')
                                              .update({ is_read: true })
                                              .eq('id', notif.id)
                                          ).catch(() => {});
                                        }
                                        setSystemNotifications((prev) =>
                                          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read: true } : n))
                                        );
                                      }
                                      setIsNotificationsOpen(false);
                                      if (isChatNotif) {
                                        const baseMsgRoute = isDriver
                                          ? '/driver/messages'
                                          : isContractor
                                          ? '/entreprise/messages'
                                          : '/owner/messages';
                                        navigate(
                                          chatConvId
                                            ? `${baseMsgRoute}?conv=${encodeURIComponent(chatConvId)}`
                                            : baseMsgRoute
                                        );
                                      } else if (notif.type === 'driver_job_offer') {
                                        cacheDriverOfferFromNotification(notif);
                                        const targetUrl = targetOfferId
                                          ? `/driver/joboffer?offer=${encodeURIComponent(targetOfferId)}`
                                          : '/driver/joboffer';
                                        navigate(targetUrl);
                                      } else if (
                                        notif.type === 'driver_deal_closed' ||
                                        notif.type === 'driver_work_ended'
                                      ) {
                                        if (isDriver) {
                                          navigate(
                                            targetOfferId
                                              ? `/driver/joboffer?tab=agreed&offer=${encodeURIComponent(targetOfferId)}`
                                              : '/driver/joboffer?tab=agreed'
                                          );
                                        } else {
                                          navigate(
                                            targetOfferId
                                              ? `/owner/drivers?offer=${encodeURIComponent(targetOfferId)}`
                                              : '/owner/drivers'
                                          );
                                        }
                                      } else if (notif.type === 'driver_application') {
                                        navigate('/owner/machines');
                                      } else if (notif.type === 'booking_breakdown') {
                                        navigate('/owner/bookings?tab=active');
                                      } else if (
                                        notif.type === 'booking_breakdown_resolved' ||
                                        notif.type === 'booking_paused' ||
                                        notif.type === 'booking_resumed'
                                      ) {
                                        navigate('/entreprise/bookings');
                                      } else {
                                        navigate(
                                          isDriver
                                            ? '/driver/joboffer'
                                            : isContractor
                                            ? '/entreprise/bookings'
                                            : '/owner/bookings?tab=pending'
                                        );
                                      }
                                    }}
                                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                      !notif.is_read && notif.type === 'booking_breakdown'
                                        ? 'bg-rose-50 border-rose-300 font-medium'
                                        : !notif.is_read && notif.type === 'booking_paused'
                                        ? 'bg-amber-50 border-amber-300 font-medium'
                                        : !notif.is_read
                                        ? 'bg-primary/10 border-primary/40 font-medium'
                                        : 'bg-steel-50/70 border-steel-200 text-steel-600'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-ink font-bold mb-1 gap-2">
                                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                                        {isChatNotif && (
                                          <MessageSquare className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                                        )}
                                        {isDriverOfferNotif && (
                                          <HardHat className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                                        )}
                                        {isBreakdownNotif && (
                                          <AlertTriangle
                                            className={`w-3.5 h-3.5 shrink-0 ${
                                              notif.type === 'booking_breakdown'
                                                ? 'text-rose-600'
                                                : 'text-emerald-600'
                                            }`}
                                          />
                                        )}
                                        {isPauseNotif &&
                                          (notif.type === 'booking_paused' ? (
                                            <Pause className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          ) : (
                                            <Play className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          ))}
                                        <span className="truncate">
                                          {lang === 'fr' ? notif.title_fr : notif.title_ar}
                                        </span>
                                      </span>
                                      <span className="text-[10px] text-steel-400 font-mono shrink-0">
                                        {notif.created_at?.slice(11, 16) || ''}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-steel-600 line-clamp-2">
                                      {lang === 'fr' ? notif.body_fr : notif.body_ar}
                                    </p>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>

                        <div className="p-2 border-t border-steel-100 bg-steel-50 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              navigate(
                                isDriver
                                  ? '/driver/joboffer'
                                  : isContractor
                                  ? '/entreprise/messages'
                                  : '/owner/bookings?tab=pending'
                              );
                            }}
                            className="text-xs text-primary-dark font-bold hover:underline cursor-pointer"
                          >
                            {isDriver
                              ? lang === 'fr'
                                ? 'Voir les offres d’emploi →'
                                : 'الانتقال إلى عروض العمل ←'
                              : isContractor
                              ? lang === 'fr'
                                ? 'Ouvrir mes messages →'
                                : 'الانتقال إلى المحادثات ←'
                              : lang === 'fr'
                              ? 'Accéder au gestionnaire des réservations →'
                              : 'الانتقال إلى سجل الحجوزات الكامل ←'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        </header>

        {/* Prominent Top Bar to Enable Background Mobile Push Notifications */}
        {typeof window !== 'undefined' &&
          'Notification' in window &&
          notifPermission === 'default' &&
          !isPushPromptDismissed && (
            <div className="bg-amber-50 border-b border-amber-300 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs z-20">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
                  <Volume2 className="w-4 h-4" />
                </span>
                <p className="font-bold text-ink leading-snug">
                  {isDriver
                    ? lang === 'fr'
                      ? 'Activez les alertes pour recevoir instantanément les offres urgentes de conducteurs avec tarif et durée même hors application.'
                      : 'فعّل إشعارات الهاتف ليصلك صوت وتنبيه فوري بعروض العمل العاجلة (نوع الآلية، الثمن والمدة) فور إطلاقها حتى خارج التطبيق.'
                    : isContractor
                    ? lang === 'fr'
                      ? 'Activez les notifications pour recevoir les messages des propriétaires dans votre barre mobile même hors application.'
                      : 'فعّل إشعارات الهاتف لتصلك رسائل ملاك الآليات مع صوت تنبيه في القائمة المنسدلة حتى خارج التطبيق.'
                    : lang === 'fr'
                    ? 'Activez les notifications push pour recevoir les alertes de chantiers et messages même quand l’application est fermée.'
                    : 'فعّل إشعارات الهاتف لتصلك طلبات الأوراش والرسائل في القائمة المنسدلة حتى عندما يكون التطبيق مغلقاً.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const targetUserId = profile?.id || user?.id || '';
                    const targetRole = profile?.role || 'owner';
                    const perm = await registerOwnerPushNotifications(
                      targetUserId,
                      targetRole,
                      profile?.driver_machines
                    );
                    setNotifPermission(perm);
                    if (perm === 'granted') {
                      if (isContractor) {
                        playChatMessageSound();
                      } else {
                        playOpportunitySound();
                      }
                      toast.success(
                        lang === 'fr'
                          ? 'Notifications activées sur votre téléphone !'
                          : 'تم تفعيل إشعارات الهاتف بنجاح! ستصلك التنبيهات والرسائل في القائمة المنسدلة حتى خارج التطبيق.'
                      );
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-ink text-primary font-black text-xs hover:bg-steel-900 transition-colors cursor-pointer min-h-[38px]"
                >
                  {lang === 'fr' ? 'Activer les alertes 🔔' : 'تفعيل إشعارات الهاتف الآن 🔔'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPushPromptDismissed(true)}
                  className="p-1.5 rounded-lg text-steel-500 hover:text-ink hover:bg-amber-100 cursor-pointer"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        {/* Page Inner Content (Blurred if shouldShowLock) */}
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all duration-300 ${
            shouldShowLock ? 'blur-sm pointer-events-none select-none' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Fixed, 44px+ touch targets) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 start-0 end-0 bg-white border-t border-steel-200 shadow-elevated z-40 px-1 py-1 flex items-center justify-around overflow-hidden"
      >
        {isDriver ? (
          <>
            {driverNavigationItems.map((item) => {
              const isItemActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                    isItemActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                  }`}
                >
                  <div
                    className={`p-1 rounded-xl transition-all relative ${
                      isItemActive ? 'bg-primary text-ink' : ''
                    }`}
                  >
                    {item.icon}
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {item.mobileLabel || item.label}
                  </span>
                </NavLink>
              );
            })}

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] text-steel-400 hover:text-ink rounded-xl transition-colors cursor-pointer"
            >
              <div className="p-1 rounded-xl">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full">
                {lang === 'fr' ? 'Profil' : 'حسابي'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] text-danger hover:bg-rose-50/70 rounded-xl transition-colors cursor-pointer"
              aria-label={t('nav.logout')}
            >
              <div className="p-1 rounded-xl">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full">
                {lang === 'fr' ? 'Quitter' : 'خروج'}
              </span>
            </button>
          </>
        ) : isContractor ? (
          <>
            {contractorNavigationItems.map((item) => {
              const isItemActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                    isItemActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                  }`}
                >
                  <div
                    className={`p-1 rounded-xl transition-all relative ${
                      isItemActive ? 'bg-primary text-ink' : ''
                    }`}
                  >
                    {item.icon}
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {item.mobileLabel || item.label}
                  </span>
                </NavLink>
              );
            })}

            {/* Logout Button in Mobile Bottom Bar */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] text-danger hover:bg-rose-50/70 rounded-xl transition-colors cursor-pointer"
              aria-label={t('nav.logout')}
            >
              <div className="p-1 rounded-xl">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full">
                {lang === 'fr' ? 'Quitter' : 'خروج'}
              </span>
            </button>
          </>
        ) : (
          <>
            {/* 1. اليوم (Today) */}
            <NavLink
              to="/owner"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {lang === 'fr' ? 'Aujourd\'hui' : 'اليوم'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 2. الحجوزات (Bookings) */}
            <NavLink
              to="/owner/bookings"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all relative ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <CalendarCheck className="w-5 h-5" />
                    {pendingBookingsCount > 0 && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {t('nav.bookings')}
                  </span>
                </>
              )}
            </NavLink>

            {/* 3. الآليات (Machines) */}
            <NavLink
              to="/owner/machines"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {t('nav.machines')}
                  </span>
                </>
              )}
            </NavLink>

            {/* 4. الزبائن (Clients) */}
            <NavLink
              to="/owner/clients"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {lang === 'fr' ? 'Clients' : 'الزبائن'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 5. المزيد (More) */}
            {(() => {
              const isMoreActive =
                location.pathname.startsWith('/owner/drivers') ||
                location.pathname.startsWith('/owner/analytics') ||
                location.pathname.startsWith('/owner/storefront') ||
                location.pathname.startsWith('/owner/settings/business') ||
                location.pathname.startsWith('/owner/messages');

              return (
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(true)}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] transition-colors relative cursor-pointer ${
                    isMoreActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-all relative ${isMoreActive ? 'bg-primary text-ink' : ''}`}>
                    <MoreHorizontal className="w-5 h-5" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                    {lang === 'fr' ? 'Plus' : 'المزيد'}
                  </span>
                </button>
              );
            })()}

            {/* 6. خروج (Logout) */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[50px] text-danger hover:bg-rose-50/70 rounded-xl transition-colors cursor-pointer"
              aria-label={t('nav.logout')}
            >
              <div className="p-1 rounded-xl">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full">
                {lang === 'fr' ? 'Quitter' : 'خروج'}
              </span>
            </button>
          </>
        )}
      </nav>

      {/* Mobile "المزيد" (More) Bottom Sheet Drawer */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl border-t border-steel-200 shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto z-10 text-start animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-ink">
                  {lang === 'fr' ? 'Menu & Outils Entreprise' : 'المزيد من أدوات المقاولة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1 rounded-full text-steel-400 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {/* Agreed Drivers ("السائقون") */}
              <NavLink
                to="/owner/drivers"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-ink font-black' : 'bg-surface hover:bg-steel-100 text-steel-700'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <HardHat className="w-5 h-5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Chauffeurs' : 'السائقون'}</span>
                </div>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
              </NavLink>

              {/* Financial Economics */}
              <NavLink
                to="/owner/analytics"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-ink font-black' : 'bg-surface hover:bg-steel-100 text-steel-700'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Finances & Rentabilité' : 'المالية والأرباح والصيانة'}</span>
                </div>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
              </NavLink>

              {/* Public Storefront */}
              <NavLink
                to="/owner/storefront"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-ink font-black' : 'bg-surface hover:bg-steel-100 text-steel-700'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary-dark" />
                  <span>{t('nav.storefront')}</span>
                </div>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
              </NavLink>

              {/* Business Profile Settings */}
              <NavLink
                to="/owner/settings/business"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-ink font-black' : 'bg-surface hover:bg-steel-100 text-steel-700'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-primary-dark" />
                  <div>
                    <span className="block">{lang === 'fr' ? 'Profil Entreprise & Facturation' : 'إعدادات المقاولة والعقود والـ RIB'}</span>
                    <span className="text-[10px] text-steel-400 font-normal block">ICE, RC, IF, TVA 20%, Cachet</span>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
              </NavLink>

              {/* Messages */}
              <NavLink
                to="/owner/messages"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary text-ink font-black' : 'bg-surface hover:bg-steel-100 text-steel-700'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary-dark" />
                  <span>{t('nav.messages')}</span>
                </div>
                {unreadMessagesCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black">
                    {unreadMessagesCount}
                  </span>
                ) : (
                  <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
                )}
              </NavLink>

              {/* Personal Info Profile Modal */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold bg-surface hover:bg-steel-100 text-steel-700 transition-colors text-start cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Modifier mes informations' : 'تعديل معلوماتي الشخصية'}</span>
                </div>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
              </button>

              {/* Install App Button inside mobile More menu */}
              <PWAInstallButton
                variant="drawer"
                onAfterClick={() => setIsMoreMenuOpen(false)}
              />

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold text-danger hover:bg-rose-50 transition-colors text-start cursor-pointer pt-3 border-t border-steel-100"
              >
                <LogOut className="w-5 h-5" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Lock Modal Overlay (Non-dismissible when shouldShowLock is true) */}
      <SoftLockModal isLocked={shouldShowLock} />

      {/* Voluntary Payment Proof Modal (Dismissible, for activating before expiry) */}
      <PaymentProofModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        isDismissible={true}
      />

      {/* User Profile Personal Info Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Real-Time InDrive Opportunity Listener (Audio + Push + Celebration Popup for Owners) */}
      {!isContractor && !isDriver && (profile?.id || user?.id) && !(isSuperAdmin && !isImpersonating) && (
        <OpportunityAlertListener
          ownerId={profile?.id || user?.id || ''}
          onNotificationsSync={setOpportunityNotifications}
        />
      )}

      {/* Real-Time Driver Job Offer Listener (Audio + Push + Celebration Popup for Drivers) */}
      {isDriver && (profile?.id || user?.id) && !(isSuperAdmin && !isImpersonating) && (
        <DriverOpportunityAlertListener
          driverId={profile?.id || user?.id || ''}
          driverProfile={profile || null}
          onOffersSync={() => {
            fetchDriverJobOffers(profile?.id || user?.id || '').then((list) => {
              setDriverOpenOffersCount(list.filter((o) => !o.has_applied).length);
            });
          }}
        />
      )}

      {/* Global Real-Time Chat Message Sound & Mobile Notification Shade Listener (All Users) */}
      {(profile?.id || user?.id) && (
        <ChatAlertListener
          userId={profile?.id || user?.id || ''}
          userRole={profile?.role || 'owner'}
          onNotificationsChanged={refreshSystemNotifications}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
