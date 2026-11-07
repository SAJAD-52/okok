// ============================================================================
// JADIJCB: Owner Dashboard Home (Desktop Split View / Mobile Stacked)
// Fully Powered by TanStack Query & Supabase Real Database Reads
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  TrendingUp,
  PlusCircle,
  MessageSquare,
  Layers,
  AlertCircle,
  RotateCcw,
  Bell,
  Check,
  Phone,
  CalendarCheck,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RevenueChart, RevenuePoint } from '../components/dashboard/RevenueChart';
import { UpcomingReturnsList } from '../components/dashboard/UpcomingReturnsList';
import { StorefrontLiveCard } from '../components/dashboard/StorefrontLiveCard';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { PaymentProofModal } from '../components/dashboard/PaymentProofModal';
import { platformSettingsStore, PlatformSettings } from '../lib/platformSettings';
import { Machine, Booking } from '../types/database';
import { bookingStore } from '../lib/bookingStore';
import { toast } from '../components/ui/Toast';

export const DashboardOverviewPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => platformSettingsStore.getSettings());

  React.useEffect(() => {
    const handleUpdate = () => {
      setPlatformSettings(platformSettingsStore.getSettings());
    };
    window.addEventListener('jadijcb_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    platformSettingsStore.pullFromRemote().then(setPlatformSettings);
    return () => {
      window.removeEventListener('jadijcb_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const userId = user?.id || profile?.id;

  // Auto-redirect contractors to their dedicated /entreprise portal
  React.useEffect(() => {
    if (profile?.role === 'client' || profile?.role === 'contractor') {
      navigate('/entreprise', { replace: true });
    }
  }, [profile, navigate]);

  // 1. TanStack Query: Machines for this owner
  const {
    data: machines = [],
    isLoading: isLoadingMachines,
    isError: isMachinesError,
    refetch: refetchMachines,
  } = useQuery<Machine[]>({
    queryKey: ['owner_machines', userId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !userId) return [];
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        owner_id: m.owner_id,
        title_ar: m.title_ar,
        title_fr: m.title_fr,
        description_ar: m.description_ar,
        description_fr: m.description_fr,
        category: m.category,
        category_id: m.category,
        brand: m.brand,
        model: m.model,
        year: m.year,
        listing_mode: m.listing_mode,
        condition: m.condition || 'good',
        city: m.city,
        city_id: m.city,
        lat: m.lat,
        lng: m.lng,
        location_lat: m.lat,
        location_lng: m.lng,
        rate_hourly: Number(m.hourly_rate) || 0,
        rate_daily: Number(m.daily_rate) || 0,
        rate_weekly: Number(m.weekly_rate) || 0,
        hourly_rate: Number(m.hourly_rate) || 0,
        daily_rate: Number(m.daily_rate) || 0,
        weekly_rate: Number(m.weekly_rate) || 0,
        sale_price: Number(m.sale_price) || 0,
        currency: 'MAD',
        with_operator: Boolean(m.with_operator),
        fuel_included: Boolean(m.fuel_included),
        delivery_available: Boolean(m.delivery_available),
        status: m.is_published ? 'available' : 'inactive',
        is_published: m.is_published,
        images: m.images || [],
        specs: m.specs || {},
        views_count: m.views_count || 0,
        rating_avg: m.rating_avg || 0,
        reviews_count: m.reviews_count || 0,
        created_at: m.created_at,
        updated_at: m.created_at,
      }));
    },
    enabled: Boolean(userId),
  });

  // 2. TanStack Query: Bookings for this owner
  const {
    data: bookings = [],
    isLoading: isLoadingBookings,
    isError: isBookingsError,
    refetch: refetchBookings,
  } = useQuery<Booking[]>({
    queryKey: ['owner_bookings', userId],
    queryFn: async () => {
      let mapped: Booking[] = [];
      if (isSupabaseConfigured && userId) {
        try {
          const { data, error } = await supabase
            .from('bookings')
            .select('*, machine:machines(*)')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

          if (data) {
            mapped = data.map((b: any) => ({
              id: b.id,
              machine_id: b.machine_id,
              owner_id: b.owner_id,
              client_id: b.client_id,
              client_name: b.client_name,
              client_phone: b.client_phone,
              start_at: b.start_at,
              end_at: b.end_at,
              start_date: b.start_at,
              end_date: b.end_at,
              total_price: Number(b.total_price) || 0,
              status: b.status,
              notes: b.notes,
              created_at: b.created_at,
              machine: b.machine || b.machines,
              with_operator: Boolean(b.with_operator ?? true),
            }));
          }
        } catch (e) {
          console.warn('Dashboard bookings query warning:', e);
        }
      }

      // Merge with bookingStore local cache
      const machineIds = machines.map((m) => m.id);
      return bookingStore.mergeOwnerBookings(mapped, userId || '', machineIds);
    },
    enabled: Boolean(userId),
  });

  // 3. TanStack Query: Unread messages (messages where sender != me and read_at is null in user's conversations)
  const {
    data: unreadCount = 0,
    isLoading: isLoadingUnread,
  } = useQuery<number>({
    queryKey: ['owner_unread_messages', userId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !userId) return 0;
      // Step A: get conversation IDs where user is participant
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

      if (convError || !convs || convs.length === 0) return 0;

      const convIds = convs.map((c: any) => c.id);
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .is('read_at', null);

      if (countError) return 0;
      return count || 0;
    },
    enabled: Boolean(userId),
  });

  // Computed metrics
  const activeBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.status === 'active' || b.status === 'confirmed'
    );
  }, [bookings]);

  const publishedCount = useMemo(() => {
    return machines.filter((m) => m.is_published !== false).length;
  }, [machines]);

  // Monthly revenue for the last 6 months (sum total_price of active/completed bookings)
  const { currentMonthRevenue, monthlyRevenuePoints } = useMemo(() => {
    const now = new Date();
    const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نوفمبر', 'دجنبر'];
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const points: RevenuePoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();

      // Find bookings in this month that are completed or active
      const relevant = bookings.filter((b) => {
        if (b.status !== 'completed' && b.status !== 'active') return false;
        const bDate = new Date(b.created_at || b.start_at || Date.now());
        return bDate.getFullYear() === year && bDate.getMonth() === monthIdx;
      });

      const revenue = relevant.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

      points.push({
        month: monthsAr[monthIdx],
        monthFr: monthsFr[monthIdx],
        revenue,
        rentalsCount: relevant.length,
      });
    }

    const currentRevenue = points[points.length - 1]?.revenue || 0;

    return {
      currentMonthRevenue: currentRevenue,
      monthlyRevenuePoints: points,
    };
  }, [bookings]);

  const companyName = profile?.company_name || 'Atlas Terrassement & Travaux S.A.R.L.';
  const ownerName = profile?.full_name || 'كريم بنجلون';

  const handleMachineCreated = () => {
    refetchMachines();
  };

  const pendingBookings = useMemo(() => bookings.filter((b) => b.status === 'pending'), [bookings]);

  const handleAcceptBooking = async (id: string) => {
    bookingStore.updateBookingStatus(id, 'active');
    try {
      await supabase.from('bookings').update({ status: 'active' }).eq('id', id);
    } catch (e) {
      console.warn('DB status update error:', e);
    }
    refetchBookings();
    toast.success(lang === 'fr' ? 'Réservation acceptée et planifiée !' : 'تم قبول وتأكيد الحجز بنجاح!');
  };

  const isGlobalLoading = isLoadingMachines || isLoadingBookings;

  return (
    <div className="space-y-6 text-start">
      {/* Top Welcome Industrial Banner */}
      <div className="bg-ink text-white p-6 sm:p-7 rounded-3xl border border-steel-800 shadow-elevated relative overflow-hidden">
        <div className="absolute top-0 end-0 w-80 h-full bg-gradient-to-s from-primary/10 via-yellow-500/5 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-black uppercase tracking-wider">
                {companyName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {t('dashboard.welcome')}، {ownerName}
            </h1>
            <p className="text-xs text-steel-400 mt-1 max-w-xl">
              {t('dashboard.overview_title')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto font-black shadow-md min-h-[44px]"
            >
              {t('dashboard.quick_add_machine')}
            </Button>
          </div>
        </div>
      </div>

      {/* PRO Lead Magnet & Subscription Value Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-transparent border-2 border-primary/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-primary text-ink font-black">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-ink">
              خطة المالك الاحترافية (JADIJCB PRO)
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              مدة تجريبية {platformSettings.trial_duration_hours} ساعة مجاناً
            </span>
          </div>
          <h2 className="text-base font-black text-ink">
            عرض غير محدود لأسطولك واستقبال مباشر لطلبات المقاولات في مدينتك
          </h2>
          <p className="text-xs text-steel-600 max-w-2xl leading-relaxed">
            💡 <strong>العائد الأكبر في السوق المغربي:</strong> عملية كراء واحدة لآلية واحدة بمبلغ 2,200 درهم تغطي اشتراكك لأكثر من 10 أشهر كاملة! عمولة 0% وتواصل مباشر مع مديري الأوراش.
          </p>
        </div>

        <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0">
          <div className="text-start md:text-end font-mono">
            <span className="text-2xl font-black text-ink">{platformSettings.monthly_price_mad}</span>
            <span className="text-xs font-bold text-steel-500 ms-1">د.م / شهر</span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsUpgradeModalOpen(true)}
            className="font-black text-xs shadow-md whitespace-nowrap"
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            تفعيل الاشتراك وإرسال الوصل
          </Button>
        </div>
      </div>

      {/* Urgent Pending Rental Bookings Alert Banner */}
      {pendingBookings.length > 0 && (
        <Card className="p-5 bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-2 border-primary rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-ink">
                  {lang === 'fr'
                    ? `Vous avez ${pendingBookings.length} nouvelle(s) demande(s) de réservation en attente !`
                    : `لديك ${pendingBookings.length} طلب كراء جديد بانتظار التأكيد والموافقة!`}
                </h3>
                <span className="text-xs text-steel-600">
                  {lang === 'fr'
                    ? 'Validez les demandes pour planifier vos engins ou contactez les clients.'
                    : 'قم بمراجعة طلبات المقاولين الواردة والتأكيد أو الاتصال المباشر بالزبون.'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/owner/bookings?status=pending')}
              className="text-xs font-bold shrink-0 bg-white"
            >
              {lang === 'fr' ? 'Gérer les réservations →' : 'إدارة الحجوزات ←'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-primary/20">
            {pendingBookings.map((pb) => (
              <div
                key={pb.id}
                className="p-3.5 bg-white rounded-xl border border-steel-200 shadow-sm flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-ink">
                      {pb.machine?.title_ar || pb.machine?.title_fr || 'آلية JCB'}
                    </span>
                    <span className="font-black text-xs text-primary-dark font-mono">
                      {pb.total_price.toLocaleString('fr-FR')} MAD
                    </span>
                  </div>
                  <div className="text-xs text-steel-600 mt-1 flex items-center gap-2">
                    <span className="font-bold text-steel-800">{pb.client_name || 'زبون مقاولة'}</span>
                    {pb.client_phone && (
                      <span dir="ltr" className="font-mono text-steel-500">
                        ({pb.client_phone})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-steel-500 font-mono mt-0.5" dir="ltr">
                    {pb.start_at?.slice(0, 10)} → {pb.end_at?.slice(0, 10)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-steel-100">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleAcceptBooking(pb.id)}
                    className="text-xs font-black"
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    {lang === 'fr' ? 'Confirmer' : 'تأكيد الحجز'}
                  </Button>
                  {pb.client_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/owner/messages?target=${pb.client_id}&machine=${pb.machine_id}`)}
                      className="text-xs font-bold text-steel-700"
                      leftIcon={<MessageSquare className="w-3.5 h-3.5 text-primary" />}
                    >
                      {lang === 'fr' ? 'Chatter' : 'محادثة'}
                    </Button>
                  )}
                  {pb.client_phone && (
                    <a
                      href={`tel:${pb.client_phone}`}
                      className="px-2.5 py-1.5 rounded-xl border border-steel-200 bg-white hover:bg-steel-50 text-xs font-bold text-steel-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error state if data fetch fails */}
      {(isMachinesError || isBookingsError) && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-danger flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'fr'
                ? 'Erreur lors du chargement des indicateurs. Veuillez réessayer.'
                : 'حدث خطأ أثناء تحميل المؤشرات. يرجى إعادة المحاولة.'}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              refetchMachines();
              refetchBookings();
            }}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </div>
      )}

      {/* KPI Cards Row (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Monthly Revenue */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_monthly_revenue')}</span>
            <div className="p-2 rounded-xl bg-amber-50 text-primary-dark">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {isGlobalLoading ? (
            <Skeleton className="h-8 w-24 my-1" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
              {currentMonthRevenue.toLocaleString('fr-FR')}{' '}
              <span className="text-xs font-bold text-steel-500">{t('common.mad')}</span>
            </div>
          )}
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            {lang === 'fr' ? 'Missions actives et clôturées' : 'عقود الكراء النشطة والمكتملة'}
          </span>
        </Card>

        {/* KPI 2: Active Rentals */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_active_rentals')}</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          {isGlobalLoading ? (
            <Skeleton className="h-8 w-12 my-1" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
              {activeBookings.length}
            </div>
          )}
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            {lang === 'fr' ? 'En rotation active sur chantier' : 'تعمل حالياً في الأوراش'}
          </span>
        </Card>

        {/* KPI 3: Machines Listed */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_fleet_size')}</span>
            <div className="p-2 rounded-xl bg-steel-100 text-steel-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          {isGlobalLoading ? (
            <Skeleton className="h-8 w-12 my-1" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
              {publishedCount}
            </div>
          )}
          <span className="text-[10px] text-steel-500 font-bold mt-1 block">
            {publishedCount} {lang === 'fr' ? 'visibles sur la marketplace' : 'معروضة للعموم'}
          </span>
        </Card>

        {/* KPI 4: Unread Messages */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_unread_messages')}</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          {isLoadingUnread ? (
            <Skeleton className="h-8 w-12 my-1" />
          ) : (
            <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
              {unreadCount}
            </div>
          )}
          <span className="text-[10px] text-blue-600 font-bold mt-1 block">
            {lang === 'fr' ? 'Messages non lus' : 'رسائل غير مقروءة'}
          </span>
        </Card>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 6-Month Revenue Line Chart with Real Dynamic Data */}
          <RevenueChart data={monthlyRevenuePoints} />

          {/* Upcoming Returns List with Live Ticking Countdown Timers */}
          <UpcomingReturnsList bookings={activeBookings} />

          {/* Messages Quick Access */}
          <div className="p-5 bg-white border border-steel-200 rounded-2xl shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-ink">
                  {t('dashboard.recent_inquiries_title')}
                </h3>
                <p className="text-[11px] text-steel-500">
                  {lang === 'fr'
                    ? 'Contacts directs de conducteurs de travaux et chefs de chantier'
                    : 'اتصالات مباشرة من مسؤولي المشاريع ومديري الأوراش'}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/owner/messages')}
                className="text-xs font-bold text-steel-600"
              >
                {lang === 'fr' ? 'Voir tous' : 'عرض الكل'}
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-steel-200 bg-surface text-center">
              <p className="text-xs text-steel-500 mb-3">
                {lang === 'fr'
                  ? 'Gérez vos conversations en direct avec les clients et loueurs partenaires.'
                  : 'تابع محادثاتك الفورية مع المقاولين وملاك الآليات الشركاء.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/owner/messages')}
                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
              >
                {t('nav.messages')}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols on desktop): Live Storefront Preview */}
        <div className="lg:col-span-4 sticky top-20">
          <StorefrontLiveCard publishedCount={publishedCount} />
        </div>
      </div>

      {/* Stepper Modal */}
      <MachineStepperModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleMachineCreated}
      />

      {/* Upgrade / Payment Proof Modal */}
      <PaymentProofModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
};

export default DashboardOverviewPage;
