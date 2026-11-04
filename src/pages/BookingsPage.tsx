// ============================================================================
// JADIJCB: Bookings Management (List & Calendar Views + Live Rental Countdowns)
// ============================================================================

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Booking, BookingStatus, Machine } from '../types/database';
import { MOCK_BOOKINGS, MOCK_MACHINES } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const BookingsPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [machines, setMachines] = useState<Machine[]>(MOCK_MACHINES);
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

  // Fetch live bookings if Supabase connected
  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured || !user?.id) return;

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, machines(*)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: Booking[] = data.map((b: any) => ({
            id: b.id,
            machine_id: b.machine_id,
            owner_id: b.owner_id,
            client_id: b.client_id,
            client_name: b.client_name,
            client_phone: b.client_phone,
            start_at: b.start_at,
            end_at: b.end_at,
            total_price: Number(b.total_price),
            status: b.status,
            notes: b.notes,
            created_at: b.created_at,
            machine: b.machines,
            with_operator: true,
          }));
          setBookings(mapped);
        }
      } catch (err) {
        console.warn('Booking load notice:', err);
      }
    }

    loadData();
  }, [user]);

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('bookings')
          .update({ status: newStatus })
          .eq('id', id);
      } catch (err) {
        console.warn('Status change warning:', err);
      }
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );

    toast.success(
      lang === 'fr'
        ? `Statut de réservation mis à jour : ${newStatus}`
        : 'تم تحديث حالة الحجز بنجاح'
    );
  };

  const handleBookingCreated = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
  };

  const formatCountdown = (endDateStr?: string) => {
    if (!endDateStr) return '';
    const diff = new Date(endDateStr).getTime() - now;
    if (diff <= 0) {
      return lang === 'fr' ? 'Mission terminée' : 'انتهى وقت الكراء';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (days > 0) {
      return `${days}j ${pad(hours)}h ${pad(minutes)}m`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const filteredBookings = bookings.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  return (
    <div className="space-y-6 text-start">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {t('bookings.title')}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Supervisez vos missions de location en cours, contrats et retours d\'engins'
              : 'متابعة عقود الكراء النشطة، المواعيد، وتواريخ إرجاع الآليات'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex p-1 bg-steel-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[38px] ${
                viewMode === 'list'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
              title={t('bookings.list_view')}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bookings.list_view')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[38px] ${
                viewMode === 'calendar'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
              title={t('bookings.calendar_view')}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bookings.calendar_view')}</span>
            </button>
          </div>

          <Button
            type="button"
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['all', 'pending', 'active', 'completed', 'cancelled'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer ${
              statusFilter === st
                ? 'bg-ink text-white shadow-sm'
                : 'bg-white text-steel-600 hover:bg-steel-100 border border-steel-200'
            }`}
          >
            {st === 'all'
              ? t('bookings.tab_all')
              : st === 'pending'
              ? t('bookings.tab_pending')
              : st === 'active'
              ? t('bookings.tab_active')
              : st === 'completed'
              ? t('bookings.tab_completed')
              : t('bookings.tab_cancelled')}
          </button>
        ))}
      </div>

      {/* VIEW: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <Card className="p-6 bg-white border border-steel-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-steel-200">
            <h3 className="text-sm font-black text-ink flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary-dark" />
              <span>{lang === 'fr' ? 'Planning de rotation du parc (Mars 2026)' : 'جدول تشغيل الأسطول (مارس 2026)'}</span>
            </h3>
            <span className="text-xs text-steel-500 font-bold">
              {filteredBookings.length} {lang === 'fr' ? 'missions' : 'حجوزات'}
            </span>
          </div>

          {/* Simple Month Calendar Matrix */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-steel-500 mb-2">
            <div>{lang === 'fr' ? 'Lun' : 'الإثنين'}</div>
            <div>{lang === 'fr' ? 'Mar' : 'الثلاثاء'}</div>
            <div>{lang === 'fr' ? 'Mer' : 'الأربعاء'}</div>
            <div>{lang === 'fr' ? 'Jeu' : 'الخميس'}</div>
            <div>{lang === 'fr' ? 'Ven' : 'الجمعة'}</div>
            <div>{lang === 'fr' ? 'Sam' : 'السبت'}</div>
            <div>{lang === 'fr' ? 'Dim' : 'الأحد'}</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(31)].map((_, i) => {
              const day = i + 1;
              const hasBooking = day >= 3 && day <= 15;
              const isToday = day === 4;

              return (
                <div
                  key={day}
                  className={`min-h-[64px] p-1.5 rounded-xl border text-start flex flex-col justify-between transition-colors ${
                    isToday
                      ? 'border-primary bg-amber-50/70 font-black'
                      : hasBooking
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-steel-100 bg-surface'
                  }`}
                >
                  <span className={`text-[10px] font-mono ${isToday ? 'text-primary-dark font-black' : 'text-steel-600'}`}>
                    {day}
                  </span>
                  {hasBooking && (
                    <div className="text-[9px] font-bold p-1 rounded bg-ink text-primary truncate leading-tight">
                      JCB 3CX (SNTL)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* VIEW: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredBookings.length === 0 ? (
            <Card className="p-10 text-center bg-white border border-steel-200">
              <CalendarCheck className="w-10 h-10 text-steel-300 mx-auto mb-2" />
              <p className="text-xs text-steel-500 font-bold">
                {lang === 'fr'
                  ? 'Aucune réservation dans cette catégorie'
                  : 'لا توجد طلبات كراء في هذا التصنيف'}
              </p>
            </Card>
          ) : (
            filteredBookings.map((b) => {
              const isCountdownActive = b.status === 'active' || b.status === 'confirmed';
              const countdown = isCountdownActive ? formatCountdown(b.end_at || b.end_date) : '';

              return (
                <Card
                  key={b.id}
                  className="p-5 bg-white border border-steel-200 hover:shadow-md transition-all rounded-2xl"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Machine & Client Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold mt-0.5">
                        <Truck className="w-5 h-5 text-primary-dark" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="font-black text-sm text-ink">
                            {b.machine?.title_ar || b.machine?.title_fr || 'Caterpillar 320D'}
                          </h3>
                          <Badge
                            variant={
                              b.status === 'active'
                                ? 'success'
                                : b.status === 'completed'
                                ? 'neutral'
                                : b.status === 'cancelled'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {b.status === 'active'
                              ? t('bookings.status_active')
                              : b.status === 'completed'
                              ? t('bookings.status_completed')
                              : b.status === 'cancelled'
                              ? t('bookings.status_cancelled')
                              : t('bookings.status_pending')}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600 mb-1.5">
                          <span className="flex items-center gap-1 font-bold text-ink">
                            <Building2 className="w-3.5 h-3.5 text-steel-400" />
                            {b.client_name || 'Société BTP Casablanca'}
                          </span>
                          {b.client_phone && (
                            <span className="flex items-center gap-1 font-mono" dir="ltr">
                              <Phone className="w-3.5 h-3.5 text-steel-400" />
                              {b.client_phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-steel-400" />
                            {b.site_address || 'Casablanca - Sidi Maârouf'}
                          </span>
                        </div>

                        {/* Dates & Active Countdown */}
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="text-steel-500 font-medium font-mono text-[11px]" dir="ltr">
                            {new Date(b.start_at || b.start_date || '').toLocaleDateString('fr-FR')} →{' '}
                            {new Date(b.end_at || b.end_date || '').toLocaleDateString('fr-FR')}
                          </span>

                          {isCountdownActive && countdown && (
                            <span className="flex items-center gap-1.5 bg-ink text-primary px-2.5 py-0.5 rounded-md font-mono text-[11px] font-black">
                              <Clock className="w-3 h-3 text-yellow-400 animate-pulse" />
                              <span>{t('bookings.time_left')} {countdown}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Price & Status Transition Actions */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-steel-100">
                      <div className="text-start lg:text-end">
                        <span className="text-[10px] text-steel-400 block font-bold">
                          {t('bookings.total')}
                        </span>
                        <span className="font-mono font-black text-base text-ink">
                          {formatPriceMAD(b.total_price, lang)}
                        </span>
                      </div>

                      {/* Status Flow Buttons */}
                      <div className="flex items-center gap-1.5">
                        {b.status === 'pending' && (
                          <>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleStatusChange(b.id, 'active')}
                              leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                              className="font-bold text-xs"
                            >
                              {t('bookings.action_accept')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(b.id, 'cancelled')}
                              leftIcon={<XCircle className="w-3.5 h-3.5 text-danger" />}
                              className="text-danger hover:bg-red-50 text-xs"
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
                            leftIcon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
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

      {/* Manual Booking Creator Modal */}
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
