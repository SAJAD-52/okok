// ============================================================================
// JADIJCB: Bookings Management (List & Calendar Views + Live Rental Countdowns)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Plus,
  List,
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Phone,
  User,
  MapPin,
  Building2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Booking, BookingStatus, Machine } from '../types/database';
import { formatPriceMAD } from '../data/rentalTerms';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapDatabaseError } from '../lib/errorHelpers';

export const BookingsPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Ticking countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live bookings and owner machines
  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      // 1. Fetch bookings
      const { data: bData, error: bError } = await supabase
        .from('bookings')
        .select('*, machines(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (bError) {
        setIsError(true);
        toast.error(t(mapDatabaseError(bError)));
        return;
      }

      const mappedBookings: Booking[] = (bData || []).map((b: any) => ({
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
        machine: b.machines,
        with_operator: Boolean(b.with_operator ?? true),
      }));

      setBookings(mappedBookings);

      // 2. Fetch owner machines for manual booking creation
      const { data: mData } = await supabase
        .from('machines')
        .select('*')
        .eq('owner_id', user.id);

      if (mData) {
        const mappedMachines: Machine[] = mData.map((m: any) => ({
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
        setMachines(mappedMachines);
      }
    } catch (err: any) {
      setIsError(true);
      toast.error(t(mapDatabaseError(err)));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', id)
      .select('*, machines(*)')
      .single();

    if (error) {
      const errKey = mapDatabaseError(error);
      toast.error(t(errKey));
      return; // STOP! No optimistic state update, no success toast!
    }

    await loadData();

    toast.success(
      lang === 'fr'
        ? `Statut de réservation mis à jour : ${newStatus}`
        : 'تم تحديث حالة الحجز بنجاح'
    );
  };

  const handleBookingCreated = async () => {
    await loadData();
    setIsCreateModalOpen(false);
  };

  // Remaining Rental Countdown Calculator
  const getRemainingTime = (endTarget?: string) => {
    if (!endTarget) return null;
    const diff = new Date(endTarget).getTime() - now;
    if (diff <= 0) {
      return {
        isOverdue: true,
        text: lang === 'fr' ? 'Chantier terminé' : 'انتهى وقت الورش',
      };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (days > 0) {
      return {
        isOverdue: false,
        text: `${days}j ${pad(hours)}h ${pad(minutes)}m`,
      };
    }
    return {
      isOverdue: false,
      text: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    };
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">{t('bookings.status_pending')}</Badge>;
      case 'active':
        return <Badge variant="success">{t('bookings.status_active')}</Badge>;
      case 'completed':
        return <Badge variant="neutral">{t('bookings.status_completed')}</Badge>;
      case 'cancelled':
        return <Badge variant="danger">{t('bookings.status_cancelled')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {t('bookings.title')}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {lang === 'fr'
              ? 'Suivez les calendriers de location, les retours d\'engins et les contrats chantiers'
              : 'متابعة مواعيد الكراء، العد التنازلي للآليات قيد التشغيل ووصولات التسليم'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-steel-100 p-1 rounded-xl border border-steel-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
              title={t('bookings.list_view')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
              title={t('bookings.calendar_view')}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-black shadow-md min-h-[44px]"
          >
            {t('bookings.create_manual_booking')}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {['all', 'pending', 'active', 'completed', 'cancelled'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
              statusFilter === st
                ? 'bg-ink text-primary shadow-sm'
                : 'bg-white border border-steel-200 text-steel-600 hover:bg-steel-50'
            }`}
          >
            {st === 'all'
              ? t('bookings.tab_all')
              : st === 'pending'
              ? t('bookings.status_pending')
              : st === 'active'
              ? t('bookings.status_active')
              : st === 'completed'
              ? t('bookings.status_completed')
              : t('bookings.status_cancelled')}
            <span className="ms-1.5 opacity-70 font-mono">
              (
              {st === 'all'
                ? bookings.length
                : bookings.filter((b) => b.status === st).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Error state with retry */}
      {isError && (
        <Card className="p-8 text-center bg-red-50/50 border border-red-200">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">
            {lang === 'fr'
              ? 'Erreur lors du chargement des réservations'
              : 'حدث خطأ أثناء تحميل الحجوزات'}
          </h3>
          <p className="text-xs text-steel-500 mb-4">
            {lang === 'fr'
              ? 'Impossible de charger vos réservations. Veuillez réessayer.'
              : 'تعذر الاتصال بقاعدة البيانات. يرجى إعادة المحاولة.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="p-5 bg-white border border-steel-200 rounded-2xl">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-28 rounded-xl" />
                  <Skeleton className="h-9 w-24 rounded-xl" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bookings Content */}
      {!isLoading && !isError && (
        <>
          {viewMode === 'calendar' ? (
            /* Simple Calendar Overview Grid */
            <Card className="p-6 bg-white border border-steel-200">
              <div className="text-center py-6">
                <CalendarIcon className="w-12 h-12 text-steel-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-ink mb-1">
                  {lang === 'fr'
                    ? 'Vue calendrier des missions actives'
                    : 'جدول تشغيل الأسطول والمشاريع'}
                </h3>
                <p className="text-xs text-steel-500 max-w-md mx-auto mb-4">
                  {lang === 'fr'
                    ? `${bookings.length} réservations enregistrées sur votre parc`
                    : `تم تسجيل ${bookings.length} عقد كراء في سجلاتك`}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredBookings.map((b) => {
                  const endTarget = b.end_at || b.end_date;
                  const countdown = getRemainingTime(endTarget);

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-steel-200 bg-surface space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-ink truncate max-w-[170px]">
                          {b.machine?.title_ar || b.machine?.title_fr || 'Engin JADIJCB'}
                        </span>
                        {getStatusBadge(b.status)}
                      </div>

                      <div className="text-[11px] text-steel-500 space-y-0.5">
                        <p>
                          <span className="font-bold text-steel-700">
                            {b.client_name || 'Client'}
                          </span>
                        </p>
                        <p dir="ltr" className="font-mono text-start">
                          {b.start_at?.slice(0, 10)} → {b.end_at?.slice(0, 10)}
                        </p>
                      </div>

                      {countdown && b.status === 'active' && (
                        <div className="pt-2 border-t border-steel-200 flex items-center justify-between">
                          <span className="text-[10px] text-steel-500">
                            {t('bookings.time_left')}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              countdown.isOverdue
                                ? 'bg-red-100 text-danger'
                                : 'bg-ink text-primary'
                            }`}
                          >
                            {countdown.text}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* List View */
            <div className="space-y-3">
              {filteredBookings.length === 0 ? (
                <Card className="p-10 text-center bg-white border border-steel-200">
                  <CalendarCheck className="w-12 h-12 text-steel-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-ink mb-1">
                    {lang === 'fr'
                      ? 'Aucune réservation trouvée'
                      : 'لا توجد حجوزات في هذا التصنيف'}
                  </h3>
                  <p className="text-xs text-steel-500 mb-4">
                    {lang === 'fr'
                      ? 'Créez une réservation manuelle ou attendez les demandes des clients sur la marketplace'
                      : 'أضف حجزاً يدوياً أو انتظر استقبال طلبات المقاولين عبر السوق'}
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="font-bold"
                  >
                    {t('bookings.create_manual_booking')}
                  </Button>
                </Card>
              ) : (
                filteredBookings.map((b) => {
                  const endTarget = b.end_at || b.end_date;
                  const countdown = getRemainingTime(endTarget);

                  return (
                    <Card
                      key={b.id}
                      className="p-4 sm:p-5 bg-white border border-steel-200 hover:shadow-md transition-all rounded-2xl"
                    >
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        {/* Machine & Client Info */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center shrink-0 mt-0.5">
                            <Truck className="w-5 h-5" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-extrabold text-sm text-ink">
                                {b.machine?.title_ar || b.machine?.title_fr || 'Engin JADIJCB'}
                              </h3>
                              {getStatusBadge(b.status)}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600 mb-2">
                              <span className="flex items-center gap-1 font-bold text-ink">
                                <User className="w-3.5 h-3.5 text-steel-400" />
                                {b.client_name || 'Client anonyme'}
                              </span>

                              {b.client_phone && (
                                <a
                                  href={`tel:${b.client_phone}`}
                                  className="flex items-center gap-1 text-primary-dark hover:underline font-mono"
                                  dir="ltr"
                                >
                                  <Phone className="w-3 h-3" />
                                  {b.client_phone}
                                </a>
                              )}

                              {b.site_address && (
                                <span className="flex items-center gap-1 text-steel-500">
                                  <MapPin className="w-3.5 h-3.5 text-steel-400" />
                                  {b.site_address}
                                </span>
                              )}
                            </div>

                            {/* Dates & Period */}
                            <div className="text-xs text-steel-500 flex items-center gap-2">
                              <span className="font-medium">{t('bookings.dates')}:</span>
                              <span dir="ltr" className="font-mono text-steel-700 font-bold">
                                {b.start_at?.slice(0, 10)} → {b.end_at?.slice(0, 10)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Price, Countdown & Quick Status Actions */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-steel-100">
                          {/* Live Countdown if active */}
                          {countdown && (b.status === 'active' || b.status === 'confirmed') && (
                            <div className="text-start sm:text-end">
                              <span className="text-[10px] text-steel-500 block">
                                {t('bookings.time_left')}
                              </span>
                              <span
                                className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${
                                  countdown.isOverdue
                                    ? 'bg-red-100 text-danger'
                                    : 'bg-ink text-primary shadow-sm'
                                }`}
                              >
                                {countdown.text}
                              </span>
                            </div>
                          )}

                          {/* Total Price */}
                          <div className="text-start sm:text-end">
                            <span className="text-[10px] text-steel-500 block">
                              {t('bookings.total')}
                            </span>
                            <span className="text-base font-black text-ink font-mono latin-nums">
                              {formatPriceMAD(b.total_price)}
                            </span>
                          </div>

                          {/* Status Actions */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            {b.status === 'pending' && (
                              <>
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleStatusChange(b.id, 'active')}
                                  className="text-xs font-bold"
                                >
                                  {t('bookings.action_accept')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(b.id, 'cancelled')}
                                  className="text-xs text-danger hover:bg-red-50"
                                >
                                  {t('bookings.action_reject')}
                                </Button>
                              </>
                            )}

                            {b.status === 'active' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(b.id, 'completed')}
                                className="text-xs font-bold"
                              >
                                {t('bookings.action_complete')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Manual Booking Creation Modal */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        machines={machines}
        existingBookings={bookings}
        onBookingCreated={handleBookingCreated}
      />
    </div>
  );
};

export default BookingsPage;
