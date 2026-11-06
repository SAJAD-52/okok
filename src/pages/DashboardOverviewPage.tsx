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
import { Machine, Booking } from '../types/database';

export const DashboardOverviewPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
      if (!isSupabaseConfigured || !userId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('*, machine:machines(*)')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((b: any) => ({
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
                onClick={() => navigate('/app/messages')}
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
                onClick={() => navigate('/app/messages')}
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
    </div>
  );
};

export default DashboardOverviewPage;
