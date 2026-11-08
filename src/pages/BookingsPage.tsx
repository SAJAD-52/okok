// ============================================================================
// JADIJCB: Owner Bookings & Contracts Hub (/owner/bookings)
// Calendar & List Views, Overlap Conflict Protection, One-Tap Status Transitions,
// Partial Payments & Dues Tracker with WhatsApp Reminders, and Document Generators
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Check,
  X,
  MessageSquare,
  Bell,
  CreditCard,
  FileText,
  FileCheck,
  Printer,
  ChevronRight,
  ChevronLeft,
  Banknote,
  Send,
} from 'lucide-react';
import { Booking, BookingStatus, Machine, BookingPayment } from '../types/database';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { RecordPaymentModal } from '../components/bookings/RecordPaymentModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { bookingStore } from '../lib/bookingStore';
import { paymentService } from '../lib/paymentService';
import { documentService } from '../lib/documentService';
import { businessService } from '../lib/businessService';
import { machineStore } from '../lib/machineStore';

type TabFilter = 'all' | 'pending' | 'active' | 'completed' | 'cancelled' | 'dues';

export const BookingsPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Selected Booking for Payment Recording
  const [paymentTargetBooking, setPaymentTargetBooking] = useState<{
    booking: Booking;
    balanceDue: number;
  } | null>(null);

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const ownerId = user?.id || profile?.id;

  const loadData = useCallback(async () => {
    if (!ownerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Load machines
      let mList: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data: mData } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', ownerId);
        if (mData) {
          mList = mData.map((m: any) => ({
            id: m.id,
            owner_id: m.owner_id,
            title_ar: m.title_ar,
            title_fr: m.title_fr,
            category: m.category,
            brand: m.brand,
            model: m.model,
            daily_rate: Number(m.daily_rate) || 2000,
            hourly_rate: Number(m.hourly_rate) || 350,
            status: m.is_published ? 'available' : 'inactive',
            images: m.images || [],
          } as Machine));
        }
      }
      const mergedMachines = machineStore.mergeMachines(mList, ownerId);
      setMachines(mergedMachines);

      // 2. Load bookings
      let bList: Booking[] = [];
      if (isSupabaseConfigured) {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*, machines(*)')
          .eq('owner_id', ownerId)
          .order('start_at', { ascending: false });

        if (bData) {
          bList = bData.map((b: any) => ({
            id: b.id,
            machine_id: b.machine_id,
            owner_id: b.owner_id,
            client_name: b.client_name,
            client_phone: b.client_phone,
            start_at: b.start_at || b.start_date,
            end_at: b.end_at || b.end_date,
            total_price: Number(b.total_price) || 0,
            deposit_amount: Number(b.deposit_amount) || 0,
            rate_type: b.rate_type || 'daily',
            status: b.status,
            notes: b.notes,
            created_at: b.created_at,
            machine: b.machines,
            with_operator: Boolean(b.with_operator),
          }));
        }
      }

      // Merge with local booking store
      const localCached = bookingStore.getCachedBookings().filter(
        (b) => b.owner_id === ownerId || !b.owner_id
      );
      const combinedMap = new Map<string, Booking>();
      for (const b of localCached) combinedMap.set(b.id, b);
      for (const b of bList) combinedMap.set(b.id, b);
      const mergedBookings = Array.from(combinedMap.values());
      setBookings(mergedBookings);

      // 3. Load payments
      const loadedPayments = await paymentService.getPaymentsForOwner(ownerId);
      setPayments(loadedPayments);
    } catch (err) {
      console.warn('Error loading bookings page data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_payments_updated', handleUpdate);
    window.addEventListener('jadijcb_machines_updated', handleUpdate);

    return () => {
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_payments_updated', handleUpdate);
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
    };
  }, [loadData]);

  // Status transitions
  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    bookingStore.updateBookingStatus(bookingId, newStatus);
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('bookings')
          .update({ status: newStatus })
          .eq('id', bookingId);
      } catch (err) {
        console.warn('Status update DB error:', err);
      }
    }

    toast.success(
      lang === 'fr'
        ? `Statut mis à jour : ${newStatus}`
        : newStatus === 'active'
        ? 'تم قبول وتفعيل الحجز بنجاح!'
        : newStatus === 'completed'
        ? 'تم إنهاء واستلام الآلية بنجاح!'
        : 'تم إلغاء الحجز.'
    );
  };

  // Generate Document Action (Contract, Invoice, Receipt)
  const handleGenerateDoc = async (booking: Booking, docType: 'contract' | 'invoice' | 'receipt') => {
    if (!ownerId) return;

    try {
      const bizProfile = await businessService.getProfile(ownerId);
      const stats = paymentService.computeBookingPaymentStats(booking, payments);

      const res = await documentService.generateDocument({
        ownerId,
        booking,
        type: docType,
        businessProfile: bizProfile,
        paidAmount: stats.paidAmount,
        balanceDue: stats.balanceDue,
      });

      if (res.success && res.document) {
        navigate(`/owner/documents/${res.document.id}`);
      } else {
        toast.error(res.error || 'Erreur lors de la génération du document');
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء إنشاء الوثيقة');
    }
  };

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    if (activeTab === 'dues') {
      // Dues: bookings that have balanceDue > 0 and not cancelled
      return bookings
        .filter((b) => b.status !== 'cancelled')
        .map((b) => {
          const stats = paymentService.computeBookingPaymentStats(b, payments);
          return { ...b, stats };
        })
        .filter((b) => b.stats.balanceDue > 0)
        .sort((a, b) => new Date(a.start_at || 0).getTime() - new Date(b.start_at || 0).getTime());
    }

    if (activeTab === 'all') return bookings;
    return bookings.filter((b) => b.status === activeTab);
  }, [bookings, activeTab, payments]);

  // Overall Dues stats
  const totalDuesAmount = useMemo(() => {
    return bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => {
        const stats = paymentService.computeBookingPaymentStats(b, payments);
        return sum + stats.balanceDue;
      }, 0);
  }, [bookings, payments]);

  // Calendar Helpers (Month Matrix)
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    for (let i = startOffset; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const endOffset = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= endOffset; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [calendarDate]);

  return (
    <div className="space-y-6 text-start">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
            <CalendarCheck className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Planning et gestion des locations' : 'إدارة الحجوزات والعقود'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Réservations et calendrier' : 'جدول الحجوزات والمستحقات'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Calendrier sans chevauchement, suivi des paiements, rappels WhatsApp et génération de contrats.'
              : 'حماية من تداخل المواعيد، متابعة الدفعات والمستحقات، وتوليد فوري للعقود والفواتير.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-steel-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
              }`}
              title={lang === 'fr' ? 'Vue liste' : 'عرض القائمة'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
              }`}
              title={lang === 'fr' ? 'Vue calendrier' : 'عرض التقويم'}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-black text-xs shadow-sm min-h-[44px]"
          >
            {lang === 'fr' ? 'Nouvelle réservation' : 'حجز كراء جديد'}
          </Button>
        </div>
      </div>

      {/* Tabs & Dues Tracker Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-steel-200 pb-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
          {[
            { id: 'all', label: lang === 'fr' ? 'Tous' : 'الكل', count: bookings.length },
            {
              id: 'pending',
              label: lang === 'fr' ? 'En attente' : 'قيد التأكيد',
              count: bookings.filter((b) => b.status === 'pending').length,
            },
            {
              id: 'active',
              label: lang === 'fr' ? 'En cours' : 'قيد التشغيل',
              count: bookings.filter((b) => b.status === 'active').length,
            },
            {
              id: 'completed',
              label: lang === 'fr' ? 'Terminées' : 'مكتملة',
              count: bookings.filter((b) => b.status === 'completed').length,
            },
            {
              id: 'dues',
              label: lang === 'fr' ? '⚠️ Dettes & Dûs' : '⚠️ المستحقات والديون',
              highlight: totalDuesAmount > 0,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabFilter)}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-ink text-primary font-black shadow-xs'
                  : tab.highlight
                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  : 'bg-white text-steel-600 hover:text-ink border border-steel-200'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-steel-200/60 text-[10px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Total Unpaid Dues Pill */}
        {totalDuesAmount > 0 && (
          <div className="px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 self-start sm:self-auto shrink-0 font-bold">
            <Banknote className="w-4 h-4 text-red-600" />
            <span>{lang === 'fr' ? 'Total des impayés :' : 'إجمالي الديون المعلقة:'}</span>
            <span className="font-mono font-black text-red-700">
              {totalDuesAmount.toLocaleString('fr-FR')} MAD
            </span>
          </div>
        )}
      </div>

      {/* Main View: Calendar or List */}
      {viewMode === 'calendar' ? (
        /* Calendar View */
        <Card className="p-6 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-4">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-ink">
              {calendarDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                }
                className="p-2 rounded-xl border border-steel-200 hover:bg-steel-50 text-steel-700 cursor-pointer"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-steel-200 hover:bg-steel-50 text-steel-700 cursor-pointer"
              >
                {lang === 'fr' ? 'Aujourd\'hui' : 'اليوم'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                }
                className="p-2 rounded-xl border border-steel-200 hover:bg-steel-50 text-steel-700 cursor-pointer"
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-bold text-steel-400 py-1.5 bg-steel-50 rounded-lg"
              >
                {d}
              </div>
            ))}

            {calendarDays.map((item, idx) => {
              const dayStr = item.date.toISOString().slice(0, 10);
              const isToday = dayStr === new Date().toISOString().slice(0, 10);

              // Find bookings that span this day
              const dayBookings = bookings.filter((b) => {
                if (b.status === 'cancelled') return false;
                const bStart = (b.start_at || b.start_date || '').slice(0, 10);
                const bEnd = (b.end_at || b.end_date || '').slice(0, 10);
                return dayStr >= bStart && dayStr <= bEnd;
              });

              return (
                <div
                  key={idx}
                  className={`min-h-[85px] sm:min-h-[100px] p-1.5 rounded-xl border flex flex-col justify-between transition-colors ${
                    isToday
                      ? 'border-primary bg-amber-50/40 ring-1 ring-primary'
                      : item.isCurrentMonth
                      ? 'border-steel-200 bg-white'
                      : 'border-steel-100 bg-steel-50/50 opacity-40'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span
                      className={`font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                        isToday ? 'bg-primary text-ink font-black' : 'text-steel-700'
                      }`}
                    >
                      {item.date.getDate()}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  {/* Day Bookings chips */}
                  <div className="space-y-1 mt-1 overflow-y-auto max-h-16">
                    {dayBookings.slice(0, 2).map((b) => (
                      <div
                        key={b.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate ${
                          b.status === 'active'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : b.status === 'completed'
                            ? 'bg-steel-100 text-steel-700'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                        title={`${b.machine?.title_ar || 'آلية'} - ${b.client_name}`}
                      >
                        {b.machine?.title_ar || 'آلية'}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <span className="text-[9px] text-steel-500 font-bold block text-center">
                        +{dayBookings.length - 2} {lang === 'fr' ? 'autres' : 'إضافية'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* List View */
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-steel-200 text-xs text-steel-400">
              {lang === 'fr' ? 'Chargement des réservations...' : 'جاري تحميل سجل الحجوزات...'}
            </div>
          ) : filteredBookings.length === 0 ? (
            <Card className="p-8 text-center bg-white border border-steel-200 rounded-2xl space-y-3">
              <CalendarCheck className="w-10 h-10 mx-auto text-steel-300" />
              <h3 className="text-sm font-bold text-ink">
                {lang === 'fr' ? 'Aucune réservation trouvée' : 'لا توجد حجوزات في هذا التبويب'}
              </h3>
              <p className="text-xs text-steel-500 max-w-sm mx-auto">
                {lang === 'fr'
                  ? 'Enregistrez vos locations avec protection automatique contre les chevauchements de dates.'
                  : 'سجل عمليات الكراء لأسطولك مع حماية تلقائية تمنع حجز نفس الآلية في فترات متعارضة.'}
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
                className="font-bold text-xs"
              >
                {lang === 'fr' ? 'Créer une réservation' : 'تسجيل حجز جديد'}
              </Button>
            </Card>
          ) : (
            filteredBookings.map((booking) => {
              const stats = paymentService.computeBookingPaymentStats(booking, payments);
              const isOverdue =
                booking.status === 'active' &&
                new Date(booking.end_at || booking.end_date || '').getTime() < Date.now();

              return (
                <div
                  key={booking.id}
                  className={`p-5 rounded-2xl border bg-white shadow-xs space-y-4 transition-all text-xs ${
                    isOverdue
                      ? 'border-red-300 ring-1 ring-red-300 bg-red-50/20'
                      : 'border-steel-200 hover:border-steel-300'
                  }`}
                >
                  {/* Top Bar: Machine Title, Status Badge, Payment Pill */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-primary-dark flex items-center justify-center font-black shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-sm text-ink">
                            {booking.machine?.title_ar || booking.machine?.title_fr || 'آلية JCB'}
                          </h3>
                          <Badge
                            variant={
                              booking.status === 'completed'
                                ? 'success'
                                : booking.status === 'active'
                                ? 'warning'
                                : booking.status === 'pending'
                                ? 'info'
                                : 'neutral'
                            }
                            className="text-[10px]"
                          >
                            {booking.status}
                          </Badge>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                              {lang === 'fr' ? 'RETOUR EN RETARD' : 'تأخر في الإرجاع'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-steel-500 text-[11px] mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-steel-800">
                            <User className="w-3.5 h-3.5 text-primary-dark" />
                            {booking.client_name || 'زبون مقاولة'}
                          </span>
                          {booking.client_phone && (
                            <span className="flex items-center gap-1 font-mono" dir="ltr">
                              <Phone className="w-3 h-3 text-steel-400" />
                              {booking.client_phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-mono text-steel-600" dir="ltr">
                            <Clock className="w-3 h-3 text-steel-400" />
                            {booking.start_at?.slice(0, 10)} → {booking.end_at?.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary Pill */}
                    <div className="flex items-center gap-3 self-start sm:self-auto bg-steel-50 p-2.5 rounded-xl border border-steel-200">
                      <div>
                        <span className="text-[10px] text-steel-400 block font-medium">
                          {lang === 'fr' ? 'Total' : 'المبلغ الإجمالي'}
                        </span>
                        <span className="font-mono font-bold text-ink">
                          {Number(booking.total_price).toLocaleString('fr-FR')} MAD
                        </span>
                      </div>

                      <div className="border-s border-steel-200 ps-3">
                        <span className="text-[10px] text-steel-400 block font-medium">
                          {lang === 'fr' ? 'Reste dû' : 'المتبقي'}
                        </span>
                        <span
                          className={`font-mono font-black ${
                            stats.balanceDue > 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {stats.balanceDue.toLocaleString('fr-FR')} MAD
                        </span>
                      </div>

                      <div className="border-s border-steel-200 ps-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            stats.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stats.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {stats.status === 'paid'
                            ? lang === 'fr' ? 'Payé 100%' : 'خالص 100%'
                            : stats.status === 'partial'
                            ? lang === 'fr' ? 'Partiel' : 'مؤدى جزئياً'
                            : lang === 'fr' ? 'Impayé' : 'غير مسدد'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational details snippet */}
                  <div className="flex items-center gap-4 text-[11px] text-steel-600 border-t border-steel-100 pt-2 flex-wrap">
                    <span>
                      {booking.with_operator
                        ? lang === 'fr' ? '✓ Avec chauffeur' : '✓ مع سائق'
                        : lang === 'fr' ? '✕ Sans chauffeur' : '✕ بدون سائق'}
                    </span>
                    {booking.deposit_amount && booking.deposit_amount > 0 ? (
                      <span className="font-mono">
                        {lang === 'fr' ? 'Garantie :' : 'ضمانة:'}{' '}
                        {booking.deposit_amount.toLocaleString('fr-FR')} MAD
                      </span>
                    ) : null}
                    {booking.notes && (
                      <span className="text-steel-500 truncate max-w-md">
                        {booking.notes}
                      </span>
                    )}
                  </div>

                  {/* Actions Bar: Status Buttons + Payment + Documents */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-steel-100">
                    {/* Left: Workflow Status Transitions */}
                    <div className="flex items-center gap-1.5">
                      {booking.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(booking.id, 'active')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Confirmer le départ' : 'تأكيد وبدء الكراء'}</span>
                        </button>
                      )}

                      {booking.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          className="px-3 py-1.5 rounded-xl bg-ink hover:bg-steel-800 text-primary font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Clôturer le retour' : 'تسليم الآلية وإنهاء الكراء'}</span>
                        </button>
                      )}

                      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(booking.id, 'cancelled')}
                          className="px-2.5 py-1.5 rounded-xl text-steel-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          {lang === 'fr' ? 'Annuler' : 'إلغاء الحجز'}
                        </button>
                      )}
                    </div>

                    {/* Right: Payment Logging & Documents */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Record payment button */}
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentTargetBooking({
                            booking,
                            balanceDue: stats.balanceDue,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl border border-steel-300 hover:border-primary text-ink hover:bg-amber-50/50 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Banknote className="w-3.5 h-3.5 text-primary-dark" />
                        <span>{lang === 'fr' ? 'Encaisser' : 'تسجيل أداء'}</span>
                      </button>

                      {/* WhatsApp Reminder if dues exist */}
                      {stats.balanceDue > 0 && booking.client_phone && (
                        <a
                          href={paymentService.buildWhatsAppReminderUrl({
                            clientPhone: booking.client_phone,
                            clientName: booking.client_name || 'الزبون',
                            machineName: booking.machine?.title_ar || 'الآلية',
                            totalAmount: Number(booking.total_price),
                            balanceDue: stats.balanceDue,
                            ownerCompanyName: profile?.company_name || 'مقاولة الكراء',
                            lang: lang === 'fr' ? 'fr' : 'ar',
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Rappel WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{lang === 'fr' ? 'Rappel solde' : 'تذكير بالرصيد'}</span>
                        </a>
                      )}

                      {/* Document Generators */}
                      <button
                        type="button"
                        onClick={() => handleGenerateDoc(booking, 'contract')}
                        className="px-2.5 py-1.5 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title={lang === 'fr' ? 'Contrat de location' : 'عقد كراء'}
                      >
                        <FileCheck className="w-3.5 h-3.5 text-steel-600" />
                        <span>{lang === 'fr' ? 'Contrat' : 'عقد'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateDoc(booking, 'invoice')}
                        className="px-2.5 py-1.5 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title={lang === 'fr' ? 'Facture' : 'فاتورة'}
                      >
                        <FileText className="w-3.5 h-3.5 text-steel-600" />
                        <span>{lang === 'fr' ? 'Facture' : 'فاتورة'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create Booking Stepper Modal */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        machines={machines}
        existingBookings={bookings}
        onBookingCreated={() => loadData()}
      />

      {/* Record Payment Modal */}
      {paymentTargetBooking && (
        <RecordPaymentModal
          isOpen={Boolean(paymentTargetBooking)}
          onClose={() => setPaymentTargetBooking(null)}
          booking={paymentTargetBooking.booking}
          balanceDue={paymentTargetBooking.balanceDue}
          onPaymentRecorded={() => loadData()}
        />
      )}
    </div>
  );
};

export default BookingsPage;
