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
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { TrialBanner } from '../dashboard/TrialBanner';
import { SoftLockModal } from '../dashboard/SoftLockModal';
import { PaymentProofModal } from '../dashboard/PaymentProofModal';
import { ProfileSettingsModal } from '../profile/ProfileSettingsModal';
import { Booking } from '../../types/database';
import { bookingStore } from '../../lib/bookingStore';
import { chatStore } from '../../lib/chatStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { toast } from '../ui/Toast';

export const DashboardLayout: React.FC = () => {
  const { t, isRTL, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout, isSuperAdmin, isImpersonating, stopImpersonating, impersonatedUser } = useAuth();
  const { isLocked, isTrial, formattedCountdown, isActive } = useSubscription();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [pendingBookingsCount, setPendingBookingsCount] = useState<number>(0);
  const [pendingBookingsList, setPendingBookingsList] = useState<Booking[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';
  const isChatRoute = location.pathname.includes('/messages');
  // Contractors (clients) renting machinery are NEVER blocked by owner trial soft-lock!
  const shouldShowLock = !isContractor && isLocked && !isChatRoute;

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    const updateUnread = async () => {
      if (!profile?.id) {
        setUnreadMessagesCount(0);
        return;
      }

      let count = chatStore.getTotalUnread(profile.id);

      if (isSupabaseConfigured) {
        try {
          const { data: convs } = await supabase
            .from('conversations')
            .select('id')
            .or(`participant_a.eq.${profile.id},participant_b.eq.${profile.id}`);

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
          }
        } catch {
          // Fallback to local store count
        }
      }

      setUnreadMessagesCount(count);
    };

    updateUnread();
    const interval = setInterval(updateUnread, 4000);
    window.addEventListener('jadijcb_chat_event', updateUnread);
    window.addEventListener('storage', updateUnread);

    return () => {
      clearInterval(interval);
      window.removeEventListener('jadijcb_chat_event', updateUnread);
      window.removeEventListener('storage', updateUnread);
    };
  }, [profile?.id]);

  // Sync pending bookings for owner notification badge with real-time updates
  useEffect(() => {
    if (!profile?.id || isContractor) return;

    let previousCount = -1;

    const checkPending = async () => {
      try {
        const cached = bookingStore.getCachedBookings().filter(
          (b) => (b.owner_id === profile.id || !b.owner_id) && b.status === 'pending'
        );
        let list = [...cached];

        if (isSupabaseConfigured) {
          const { data } = await supabase
            .from('bookings')
            .select('*, machines(*)')
            .eq('owner_id', profile.id)
            .eq('status', 'pending');

          if (data) {
            const mapped: Booking[] = data.map((b: any) => ({
              id: b.id,
              machine_id: b.machine_id,
              owner_id: b.owner_id,
              client_id: b.client_id,
              client_name: b.client_name,
              client_phone: b.client_phone,
              start_at: b.start_at,
              end_at: b.end_at,
              total_price: Number(b.total_price) || 0,
              status: b.status,
              notes: b.notes,
              created_at: b.created_at,
              machine: b.machines,
              with_operator: Boolean(b.with_operator ?? true),
            }));

            for (const m of mapped) {
              if (!list.some((item) => item.id === m.id)) {
                list.push(m);
              }
            }
          }
        }

        setPendingBookingsList(list);
        const count = list.length;
        setPendingBookingsCount(count);

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
        const c = bookingStore.getPendingCountForOwner(profile.id);
        setPendingBookingsCount(c);
      }
    };

    checkPending();

    // 1. In-tab custom event
    const handleEvent = () => checkPending();
    window.addEventListener('jadijcb_booking_event', handleEvent);

    // 2. Cross-tab storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jadijcb_cached_bookings' || e.key === 'jadijcb_last_booking_event') {
        checkPending();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Supabase Realtime channel subscription
    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('realtime_owner_bookings_' + profile.id)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings', filter: `owner_id=eq.${profile.id}` },
            () => checkPending()
          )
          .subscribe();
      } catch {
        // Ignore
      }
    }

    // 4. Fallback interval polling every 8s
    const timer = setInterval(checkPending, 8000);

    return () => {
      window.removeEventListener('jadijcb_booking_event', handleEvent);
      window.removeEventListener('storage', handleStorage);
      clearInterval(timer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [profile?.id, isContractor, lang]);

  const contractorNavigationItems = [
    {
      to: '/entreprise',
      exact: true,
      label: lang === 'fr' ? 'Tableau de bord' : 'لوحة المقاولة',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      to: '/entreprise/map',
      label: lang === 'fr' ? 'Radar Chantiers' : 'رادار الآليات (الخريطة)',
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      to: '/entreprise/bookings',
      label: lang === 'fr' ? 'Mes Locations' : 'حجوزاتي وتمديد الكراء',
      icon: <CalendarCheck className="w-5 h-5" />,
    },
    {
      to: '/entreprise/projects',
      label: lang === 'fr' ? 'Mes Chantiers' : 'أوراش ومشاريع المقاولة',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      to: '/entreprise/messages',
      label: t('nav.messages'),
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

  const navigationItems = isContractor ? contractorNavigationItems : ownerNavigationItems;

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const displayName = profile?.company_name || profile?.full_name || (isContractor ? 'مقاولة معتمدة' : 'مالك آليات معتمد');
  const roleLabel =
    profile?.role === 'owner'
      ? t('auth.role_owner')
      : profile?.role === 'admin'
      ? 'Super Admin'
      : (lang === 'fr' ? 'Entreprise / Client' : 'مقاولة بناء / زبون مستأجر');

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row relative">
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

          {/* Admin link (Always accessible to admin or preview) */}
          <div className="pt-4 mt-4 border-t border-steel-800">
            <NavLink
              to="/admin"
              className={({ isActive: isLinkActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isLinkActive
                    ? 'bg-steel-800 text-primary'
                    : 'text-steel-400 hover:text-white hover:bg-steel-800'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-start">{t('nav.admin')}</span>
            </NavLink>
          </div>
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

          {/* Subscription Mini Pill (Only for machinery owners) */}
          {isTrial && !isLocked && !isContractor && (
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
        {!isContractor && <TrialBanner onOpenPaymentModal={() => setIsPaymentModalOpen(true)} />}

        {/* Mobile & Tablet Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-steel-200/80 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Logo size="sm" />
            </div>
            <h1 className="hidden md:block text-base font-bold text-ink">
              {navigationItems.find((i) =>
                i.exact
                  ? location.pathname === i.to
                  : location.pathname.startsWith(i.to)
              )?.label || t('nav.dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isContractor ? (
              <NavLink
                to="/entreprise/map"
                className="text-xs font-black text-ink px-3 py-1.5 rounded-xl border border-primary/50 bg-primary hover:bg-primary-hover min-h-[44px] flex items-center gap-1.5 shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Radar Chantiers' : 'رادار الآليات للورش'}</span>
              </NavLink>
            ) : (
              <NavLink
                to="/marketplace"
                className="text-xs font-semibold text-steel-700 hover:text-ink px-3 py-1.5 rounded-lg border border-steel-200 bg-steel-50 hover:bg-steel-100 min-h-[44px] flex items-center"
              >
                {t('nav.marketplace')}
              </NavLink>
            )}

            {/* Profile Settings Quick Button with Avatar */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-2.5 py-1.5 text-xs font-bold text-steel-700 hover:text-ink hover:bg-steel-100 rounded-xl border border-steel-200 bg-white min-h-[44px] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
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
              <span className="hidden sm:inline">{lang === 'fr' ? 'Mon profil' : 'تعديل حسابي'}</span>
            </button>

            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
            {/* Notifications Button with Live Badge & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="p-2 text-steel-600 hover:text-ink hover:bg-steel-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {pendingBookingsCount > 0 && (
                  <span className="absolute top-1.5 end-1.5 px-1.5 py-0.2 rounded-full bg-primary text-ink text-[10px] font-black border border-white animate-pulse">
                    {pendingBookingsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute top-full end-0 mt-2 w-80 sm:w-96 bg-white border border-steel-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-start animate-fade-in">
                  <div className="bg-ink p-3.5 text-white flex items-center justify-between border-b border-primary">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold">
                        {lang === 'fr' ? 'Notifications & Demandes' : 'الإشعارات وطلبات الكراء'}
                      </span>
                    </div>
                    {pendingBookingsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black">
                        {pendingBookingsCount} {lang === 'fr' ? 'en attente' : 'قيد التأكيد'}
                      </span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2 space-y-2">
                    {pendingBookingsList.length === 0 ? (
                      <div className="p-6 text-center text-steel-400 text-xs">
                        <Check className="w-8 h-8 mx-auto mb-1 text-steel-300" />
                        <span>{lang === 'fr' ? 'Aucune nouvelle demande pour le moment.' : 'لا توجد طلبات حجز جديدة حالياً.'}</span>
                      </div>
                    ) : (
                      pendingBookingsList.map((pb) => (
                        <div
                          key={pb.id}
                          className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5 text-xs"
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
                            <span>{pb.client_name || 'زبون مقاولة'}</span>
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
                                navigate('/owner/bookings');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-primary text-ink font-bold text-[11px] hover:bg-primary-hover transition-colors cursor-pointer"
                            >
                              {lang === 'fr' ? 'Voir et Confirmer' : 'مراجعة وتأكيد'}
                            </button>
                            {pb.client_phone && (
                              <a
                                href={`tel:${pb.client_phone}`}
                                className="px-2.5 py-1 rounded-lg bg-white border border-steel-300 text-steel-700 font-bold text-[11px] hover:bg-steel-50 flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 border-t border-steel-100 bg-steel-50 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        navigate('/owner/bookings');
                      }}
                      className="text-xs text-primary-dark font-bold hover:underline cursor-pointer"
                    >
                      {lang === 'fr' ? 'Accéder au gestionnaire des réservations →' : 'الانتقال إلى سجل الحجوزات الكامل ←'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Inner Content (Blurred if shouldShowLock) */}
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all duration-300 ${
            shouldShowLock ? 'blur-sm pointer-events-none select-none' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Fixed, 44px+ touch targets, max 5 items: اليوم / الحجوزات / الآليات / الزبائن / المزيد) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 start-0 end-0 bg-white border-t border-steel-200 shadow-elevated z-40 px-2 py-1 flex items-center justify-around"
      >
        {isContractor ? (
          contractorNavigationItems.map((item) => {
            const isItemActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
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
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                  {item.label}
                </span>
              </NavLink>
            );
          })
        ) : (
          <>
            {/* 1. اليوم (Today) */}
            <NavLink
              to="/owner"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate">
                    {lang === 'fr' ? 'Aujourd\'hui' : 'اليوم'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 2. الحجوزات (Bookings) */}
            <NavLink
              to="/owner/bookings"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
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
                  <span className="text-[10px] mt-0.5 tracking-tight truncate">
                    {t('nav.bookings')}
                  </span>
                </>
              )}
            </NavLink>

            {/* 3. الآليات (Machines) */}
            <NavLink
              to="/owner/machines"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate">
                    {t('nav.machines')}
                  </span>
                </>
              )}
            </NavLink>

            {/* 4. الزبائن (Clients) */}
            <NavLink
              to="/owner/clients"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
                  isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary text-ink' : ''}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate">
                    {lang === 'fr' ? 'Clients' : 'الزبائن'}
                  </span>
                </>
              )}
            </NavLink>

            {/* 5. المزيد (More) */}
            {(() => {
              const isMoreActive =
                location.pathname.startsWith('/owner/analytics') ||
                location.pathname.startsWith('/owner/storefront') ||
                location.pathname.startsWith('/owner/settings/business') ||
                location.pathname.startsWith('/owner/messages') ||
                location.pathname.startsWith('/admin');

              return (
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(true)}
                  className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative cursor-pointer ${
                    isMoreActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-all relative ${isMoreActive ? 'bg-primary text-ink' : ''}`}>
                    <MoreHorizontal className="w-5 h-5" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight truncate">
                    {lang === 'fr' ? 'Plus' : 'المزيد'}
                  </span>
                </button>
              );
            })()}
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

              {/* Admin Console Link (if admin) */}
              {(profile?.role === 'admin' || isSuperAdmin) && (
                <NavLink
                  to="/admin"
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex items-center justify-between p-3 rounded-2xl text-xs font-bold bg-amber-50 border border-amber-200 text-ink hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <span>{t('nav.admin')}</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-steel-400" />
                </NavLink>
              )}

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
    </div>
  );
};

export default DashboardLayout;
