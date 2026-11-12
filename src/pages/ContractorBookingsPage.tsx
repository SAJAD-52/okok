// ============================================================================
// JADIJCB: Contractor Site Rentals & Bookings with Rental Extension Feature
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  Truck,
  Phone,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
  FileText,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Booking } from '../types/database';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RentalExtensionModal } from '../components/bookings/RentalExtensionModal';
import { bookingStore } from '../lib/bookingStore';

export const ContractorBookingsPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBookingForExtension, setSelectedBookingForExtension] = useState<Booking | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState<boolean>(false);
  const [now, setNow] = useState(Date.now());

  // Ticking countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadContractorBookings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsError(false);

    try {
      const userPhone = profile?.phone || user.user_metadata?.phone;
      let mapped: Booking[] = [];

      try {
        let query = supabase
          .from('bookings')
          .select('*');

        if (userPhone) {
          query = query.or(`client_id.eq.${user.id},client_phone.eq.${userPhone}`);
        } else {
          query = query.eq('client_id', user.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.warn('Contractor bookings load query warning:', error.message);
          // Try simpler query fallback
          const fallbackRes = await supabase
            .from('bookings')
            .select('*')
            .eq('client_id', user.id);
          if (fallbackRes.data) {
            mapped = fallbackRes.data.map((b: any) => ({
              id: b.id,
              machine_id: b.machine_id,
              owner_id: b.owner_id,
              client_id: b.client_id,
              client_name: b.client_name,
              client_phone: b.client_phone,
              start_at: b.start_at || b.start_date,
              end_at: b.end_at || b.end_date,
              start_date: b.start_date || b.start_at,
              end_date: b.end_date || b.end_at,
              total_price: Number(b.total_price) || 0,
              status: b.status,
              notes: b.notes,
              created_at: b.created_at,
              machine: b.machines || b.machine,
              with_operator: Boolean(b.with_operator ?? true),
            }));
          }
        } else if (data) {
          mapped = data.map((b: any) => ({
            id: b.id,
            machine_id: b.machine_id,
            owner_id: b.owner_id,
            client_id: b.client_id,
            client_name: b.client_name,
            client_phone: b.client_phone,
            start_at: b.start_at || b.start_date,
            end_at: b.end_at || b.end_date,
            start_date: b.start_date || b.start_at,
            end_date: b.end_date || b.end_at,
            total_price: Number(b.total_price) || 0,
            status: b.status,
            notes: b.notes,
            created_at: b.created_at,
            machine: b.machines || b.machine,
            with_operator: Boolean(b.with_operator ?? true),
          }));
        }
      } catch (qErr) {
        console.warn('Contractor Supabase query failed:', qErr);
      }

      // Supabase is the single source of truth (no stale local cache)
      setBookings(mapped);
    } catch (err) {
      console.warn('Contractor bookings load exception:', err);
      const userPhone = profile?.phone || user.user_metadata?.phone;
      const cached = bookingStore.mergeContractorBookings([], user.id, userPhone);
      setBookings(cached);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadContractorBookings();

    const handleEvent = () => loadContractorBookings();
    window.addEventListener('jadijcb_booking_event', handleEvent);
    // Auto-refresh so owner approval shows up without reloading the page
    const poll = setInterval(loadContractorBookings, 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadContractorBookings();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('jadijcb_booking_event', handleEvent);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadContractorBookings]);

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  // Calculate countdown
  const getCountdownString = (endAtStr: string) => {
    const end = new Date(endAtStr).getTime();
    const diff = end - now;
    if (diff <= 0) {
      return lang === 'fr' ? 'Terminé' : 'انتهت فترة الكراء';
    }
    const days = Math.floor(diff / (24 * 3600 * 1000));
    const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));

    if (days > 0) {
      return lang === 'fr'
        ? `Reste ${days}j ${hours}h`
        : `باقي ${days} يوم و ${hours} ساعة`;
    }
    return lang === 'fr'
      ? `Reste ${hours}h ${minutes}min`
      : `باقي ${hours} ساعة و ${minutes} دقيقة`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="success" className="text-[11px] font-black">
            {lang === 'fr' ? 'En cours sur chantier' : 'قيد التشغيل في الورش'}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="warning" className="text-[11px] font-black">
            {lang === 'fr' ? 'En attente de confirmation' : 'في انتظار موافقة المالك'}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="neutral" className="text-[11px] font-bold">
            {lang === 'fr' ? 'Chantier terminé' : 'مكتمل ومسترجع'}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="danger" className="text-[11px] font-bold">
            {lang === 'fr' ? 'Annulé' : 'ملغى'}
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Suivi des engins loués & Prolongations' : 'متابعة كراء الآليات وتمديد الحجوزات'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Gérez les engins affectés à vos chantiers, demandez des prolongations et communiquez avec les propriétaires.'
              : 'تابع الآليات العاملة في أوراشك حالياً، اطلب تمديد فترة العمل، وتواصل مباشرة مع أرباب الآليات.'}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => navigate('/entreprise/map')}
          leftIcon={<Search className="w-4 h-4" />}
          className="shrink-0"
        >
          {lang === 'fr' ? 'Chercher un engin proche' : 'ابحث عن أقرب آلية لورشك (الرادار)'}
        </Button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        {[
          { key: 'all', label: lang === 'fr' ? 'Toutes les locations' : 'جميع العمليات' },
          { key: 'active', label: lang === 'fr' ? 'En cours sur chantier' : 'نشطة بالورش حالياً' },
          { key: 'pending', label: lang === 'fr' ? 'En attente' : 'قيد التأكيد' },
          { key: 'completed', label: lang === 'fr' ? 'Terminées' : 'مكتملة' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === f.key
                ? 'bg-ink text-primary shadow-sm'
                : 'bg-white text-steel-600 border border-steel-200 hover:bg-steel-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center bg-white border border-steel-200 rounded-3xl space-y-3">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-sm font-black text-ink">
            {lang === 'fr' ? 'Erreur de chargement' : 'تعذر تحميل قائمة الحجوزات'}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={loadContractorBookings}>
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </Card>
      ) : filteredBookings.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-steel-200 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-primary-dark mx-auto flex items-center justify-center font-black">
            <Truck className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-ink">
              {lang === 'fr' ? 'Aucune machine louée pour le moment' : 'لا توجد آليات مؤجرة حالياً لأوراشك'}
            </h3>
            <p className="text-xs text-steel-500 mt-1">
              {lang === 'fr'
                ? 'Utilisez le radar interactif pour localiser les engins les plus proches de votre chantier.'
                : 'استخدم رادار الخريطة لتحديد موقع ورشك واكتشاف أقرب الآليات المتاحة مع أسعار التوصيل الفوري.'}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => navigate('/entreprise/map')}
            leftIcon={<Sparkles className="w-4 h-4 text-ink" />}
          >
            {lang === 'fr' ? 'Ouvrir le Radar Chantiers InDrive' : 'فتح رادار الأوراش وخريطة الآليات'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBookings.map((b) => {
            const machine = b.machine as any;
            const hasExtensionRequest = b.notes?.includes('[طلب تمديد');

            return (
              <Card
                key={b.id}
                className="p-5 bg-white border border-steel-200 shadow-soft rounded-3xl transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Machine & Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-steel-100 shrink-0">
                      <img
                        src={
                          machine?.images?.[0] ||
                          'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'
                        }
                        alt="Machine"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(b.status)}
                        {hasExtensionRequest && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            {lang === 'fr' ? 'Demande de prolongation en cours' : 'طلب تمديد قيد المراجعة'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-ink">
                        {lang === 'fr' ? machine?.title_fr || machine?.brand : machine?.title_ar || machine?.brand}
                      </h3>

                      <p className="text-xs text-steel-600">
                        {machine?.brand} {machine?.model} · {machine?.city || 'المغرب'}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-steel-500 pt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-steel-400" />
                          <span>
                            {new Date(b.start_at || b.start_date || '').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA')} ⬅️{' '}
                            {new Date(b.end_at || b.end_date || '').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA')}
                          </span>
                        </span>

                        <span className="font-black text-primary-dark">
                          {b.total_price.toLocaleString('fr-FR')} MAD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Countdown Box & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-steel-100">
                    {/* Active Rental Countdown */}
                    {b.status === 'active' && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-700 animate-pulse" />
                        <span>{getCountdownString(b.end_at || b.end_date || '')}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Request Extension Button */}
                      {(b.status === 'active' || b.status === 'pending') && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedBookingForExtension(b);
                            setIsExtensionModalOpen(true);
                          }}
                          leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                          className="font-black text-xs"
                        >
                          {lang === 'fr' ? 'Prolonger la location' : 'طلب تمديد مدة الكراء'}
                        </Button>
                      )}

                      {/* Chat with Owner */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/entreprise/messages?target=${b.owner_id}&machine=${b.machine_id}`)}
                        leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        {lang === 'fr' ? 'Contacter' : 'محادثة المالك'}
                      </Button>

                      {/* Call Phone */}
                      {b.client_phone && (
                        <a
                          href={`tel:${b.client_phone}`}
                          className="p-2 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-800 transition-colors"
                          title="اتصال"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Extension Notes details preview if requested */}
                {b.notes && (
                  <div className="mt-4 pt-3 border-t border-steel-100 text-[11px] text-steel-600 bg-steel-50/80 p-2.5 rounded-xl">
                    <span className="font-bold text-ink block mb-0.5">
                      {lang === 'fr' ? 'Notes du chantier & Suivi :' : 'ملاحظات وتفاصيل التمديد:'}
                    </span>
                    <p className="whitespace-pre-line">{b.notes}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Extension Modal */}
      <RentalExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => {
          setIsExtensionModalOpen(false);
          setSelectedBookingForExtension(null);
        }}
        booking={selectedBookingForExtension}
        onExtensionSubmitted={(updated: Booking) => {
          setBookings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }}
      />
    </div>
  );
};

export default ContractorBookingsPage;
