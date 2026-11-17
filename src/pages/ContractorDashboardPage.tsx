// ============================================================================
// JADIJCB: Contractor Portal Dashboard Overview (/entreprise)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  MapPin,
  Truck,
  CalendarCheck,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Search,
  PlusCircle,
  Building2,
  FileCheck2,
  Phone,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { Booking, ContractorSite } from '../types/database';
import { getClientSegmentOption } from '../data/clientSegments';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RentalExtensionModal } from '../components/bookings/RentalExtensionModal';
import { ReportBreakdownModal } from '../components/bookings/ReportBreakdownModal';
import { ProfileSettingsModal } from '../components/profile/ProfileSettingsModal';

export const ContractorDashboardPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [savedSites, setSavedSites] = useState<ContractorSite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedBookingForExtension, setSelectedBookingForExtension] = useState<Booking | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState<boolean>(false);
  const [selectedBookingForBreakdown, setSelectedBookingForBreakdown] = useState<Booking | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // Load contractor saved sites
    try {
      const stored = localStorage.getItem('jadijcb_contractor_sites');
      if (stored) {
        setSavedSites(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }

    async function loadData() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        const userPhone = profile?.phone || user.user_metadata?.phone;
        let query = supabase.from('bookings').select('*, machines(*)');

        if (userPhone) {
          query = query.or(`client_id.eq.${user.id},client_phone.eq.${userPhone}`);
        } else {
          query = query.eq('client_id', user.id);
        }

        const { data, error } = await query;
        if (!error && data) {
          const mapped: Booking[] = data.map((b: any) => ({
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

          const active = mapped.filter((b) => b.status === 'active');
          const pending = mapped.filter((b) => b.status === 'pending');
          const spent = mapped.reduce((acc, curr) => acc + (curr.total_price || 0), 0);

          setActiveBookings(active);
          setPendingBookings(pending);
          setTotalSpent(spent);
        }
      } catch (err) {
        console.warn('Contractor dashboard data load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user, profile]);

  const segmentOpt = getClientSegmentOption(profile?.client_segment);
  const clientSegmentBadge = profile?.client_segment
    ? lang === 'fr'
      ? segmentOpt.labelFr
      : segmentOpt.labelAr
    : lang === 'fr'
    ? 'Espace Client & Projets'
    : 'بوابة الزبون ومواقع العمل';

  const companyTitle =
    profile?.company_name ||
    profile?.full_name ||
    (lang === 'fr' ? 'Cher client' : 'عزيزي الزبون');

  return (
    <div className="space-y-5 sm:space-y-6 text-start max-w-full overflow-x-hidden">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-ink via-steel-900 to-steel-800 text-white p-4 sm:p-8 shadow-xl border border-steel-700">
        <div className="relative z-10 max-w-2xl space-y-2.5 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-[11px] sm:text-xs font-black max-w-full">
            <HardHat className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{clientSegmentBadge}</span>
          </div>

          <h1 className="text-lg sm:text-3xl font-black text-white leading-snug break-words">
            {lang === 'fr' ? `Bienvenue, ${companyTitle}` : `مرحباً بك، ${companyTitle}`}
          </h1>

          <p className="text-xs sm:text-sm text-steel-300 leading-relaxed">
            {lang === 'fr'
              ? 'Que ce soit pour un chantier BTP, une ferme agricole ou un terrain privé, localisez les engins les plus proches, réservez en direct et suivez vos locations sans intermédiaire.'
              : 'سواء لورش بناء، ضيعة فلاحية أو بقعة أرضية، حدد موقع عملك على الخريطة لرصد أقرب الآليات المتاحة فوراً، تصفح السوق، واحجز مباشرة مع الملاك.'}
          </p>

          <div className="pt-2 sm:pt-3 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 sm:flex-wrap">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/entreprise/projects?addSite=1')}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto justify-center font-black text-xs sm:text-sm shadow-md"
            >
              {lang === 'fr' ? 'Ajouter un site de travail' : 'إضافة موقع للعمل'}
            </Button>

            <Button
              type="button"
              variant="dark-outline"
              size="md"
              onClick={() => navigate('/marketplace')}
              leftIcon={<Compass className="w-4 h-4 text-primary" />}
              className="w-full sm:w-auto justify-center text-xs font-bold"
            >
              {lang === 'fr' ? 'Marché des engins' : 'الدخول لسوق الآليات'}
            </Button>

            <Button
              type="button"
              variant="dark-outline"
              size="md"
              onClick={() => navigate('/entreprise/map')}
              leftIcon={<MapPin className="w-4 h-4 text-primary" />}
              className="w-full sm:w-auto justify-center text-xs font-bold"
            >
              {lang === 'fr' ? 'Radar engins proches' : 'رادار أقرب الآليات'}
            </Button>

            <Button
              type="button"
              variant="dark-outline"
              size="md"
              onClick={() => setIsProfileModalOpen(true)}
              leftIcon={<Building2 className="w-4 h-4 text-primary" />}
              className="w-full sm:w-auto justify-center text-xs font-bold"
            >
              {lang === 'fr' ? 'Modifier mes informations' : 'تعديل معلوماتي'}
            </Button>
          </div>
        </div>

        {/* Decorative Background Icons */}
        <div className="absolute end-6 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <HardHat className="w-56 h-56 text-primary" />
        </div>
      </div>

      {/* 4 Contractor KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Active on Site */}
        <Card className="p-3 sm:p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-steel-500 block leading-tight line-clamp-2">
              {lang === 'fr' ? 'Engins en service' : 'آليات تعمل بمواقعك حالياً'}
            </span>
            <span className="text-base sm:text-xl font-black text-ink tabular-nums mt-0.5 block">
              {activeBookings.length}
            </span>
          </div>
        </Card>

        {/* KPI 2: Pending requests */}
        <Card className="p-3 sm:p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-steel-500 block leading-tight line-clamp-2">
              {lang === 'fr' ? 'Demandes en attente' : 'طلبات قيد المراجعة'}
            </span>
            <span className="text-base sm:text-xl font-black text-ink tabular-nums mt-0.5 block">
              {pendingBookings.length}
            </span>
          </div>
        </Card>

        {/* KPI 3: Saved Job Sites */}
        <Card className="p-3 sm:p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-steel-500 block leading-tight line-clamp-2">
              {lang === 'fr' ? 'Sites enregistrés' : 'مواقع عمل مسجلة'}
            </span>
            <span className="text-base sm:text-xl font-black text-ink tabular-nums mt-0.5 block">
              {savedSites.length}
            </span>
          </div>
        </Card>

        {/* KPI 4: Total Spent */}
        <Card className="p-3 sm:p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-steel-500 block leading-tight line-clamp-2">
              {lang === 'fr' ? 'Investissement locations' : 'إجمالي كراء الآليات'}
            </span>
            <span className="text-xs sm:text-base font-black text-ink tabular-nums truncate mt-0.5 block">
              {totalSpent.toLocaleString('fr-FR')} MAD
            </span>
          </div>
        </Card>
      </div>

      {/* InDrive Interactive Radar Card Callout */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-primary/40 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-5">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary text-ink flex items-center justify-center font-black shrink-0 shadow-sm">
            <MapPin className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-black text-ink leading-snug">
              {lang === 'fr' ? 'Besoin d\'un engin urgent pour vos travaux ?' : 'هل تحتاج آلية أو شاحنة عاجلة لموقع عملك الآن؟'}
            </h3>
            <p className="text-xs text-steel-600 mt-1 leading-relaxed">
              {lang === 'fr'
                ? 'Pointez votre terrain, ferme ou chantier sur la carte et voyez immédiatement les engins disponibles avec la distance exacte et l\'estimation d\'arrivée.'
                : 'حدد موقع أرضك، ضيعتك أو ورشك على الخريطة، وسيرصد لك الرادار أقرب الآليات المتاحة مع المسافة بالكيلومتر ووقت الوصول التقديري.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => navigate('/entreprise/map')}
          className="w-full md:w-auto justify-center whitespace-nowrap shrink-0 font-black text-xs sm:text-sm"
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {lang === 'fr' ? 'Chercher avec le Radar' : 'البحث برادار الخريطة 📍'}
        </Button>
      </Card>

      {/* Active Machines Currently On Site */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2 min-w-0">
            <Truck className="w-5 h-5 text-primary shrink-0" />
            <span className="leading-snug">
              {lang === 'fr' ? 'Engins actuellement actifs sur vos sites' : 'الآليات العاملة في مواقعك حالياً'}
            </span>
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/entreprise/bookings')}
            className="w-full sm:w-auto justify-center text-xs font-bold shrink-0"
          >
            {lang === 'fr' ? 'Voir toutes les locations' : 'عرض كافة الحجوزات'}
          </Button>
        </div>

        {activeBookings.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center bg-white border border-steel-200 rounded-2xl sm:rounded-3xl space-y-3">
            <Truck className="w-10 h-10 text-steel-300 mx-auto" />
            <p className="text-xs text-steel-500 leading-relaxed">
              {lang === 'fr'
                ? 'Aucune machine n\'est actuellement en cours de location sur vos sites.'
                : 'لا توجد آليات تعمل في مواقعك حالياً. يمكنك تصفح السوق أو إضافة موقع للعمل والبحث عبر الرادار.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/marketplace')}
              className="w-full sm:w-auto justify-center"
            >
              {lang === 'fr' ? 'Parcourir le catalogue d\'engins' : 'تصفح سوق الآليات والمعدات'}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {activeBookings.map((b) => {
              const machine = b.machine as any;
              return (
                <Card
                  key={b.id}
                  className="p-3.5 sm:p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex flex-col justify-between space-y-3 min-w-0 overflow-hidden"
                >
                  <div className="flex gap-3 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-steel-100 shrink-0">
                      <img
                        src={
                          machine?.images?.[0] ||
                          'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'
                        }
                        alt="Machine"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">
                          {lang === 'fr' ? 'En activité' : 'قيد العمل بالموقع'}
                        </span>
                        <span className="text-xs font-black text-primary-dark tabular-nums shrink-0">
                          {b.total_price.toLocaleString('fr-FR')} MAD
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-ink truncate">
                        {lang === 'fr' ? machine?.title_fr || machine?.brand : machine?.title_ar || machine?.brand}
                      </h4>
                      <p className="text-[11px] text-steel-500 truncate">
                        {machine?.brand} {machine?.model} · {machine?.city || 'المغرب'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-steel-100 flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingForBreakdown(b);
                        setIsBreakdownModalOpen(true);
                      }}
                      leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                      className="text-xs font-black border-rose-300 text-rose-700 bg-rose-50/70 hover:bg-rose-100 px-3!"
                    >
                      {lang === 'fr' ? 'Panne' : 'إبلاغ عن عطل'}
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingForExtension(b);
                        setIsExtensionModalOpen(true);
                      }}
                      leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                      className="text-xs font-black flex-1 justify-center px-3!"
                    >
                      {lang === 'fr' ? 'Prolonger le contrat' : 'طلب تمديد الكراء'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/entreprise/messages?target=${b.owner_id}&machine=${b.machine_id}`)
                      }
                      leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                      className="text-xs shrink-0 px-3!"
                    >
                      {lang === 'fr' ? 'Chat' : 'المحادثة'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Extension Modal */}
      <RentalExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => {
          setIsExtensionModalOpen(false);
          setSelectedBookingForExtension(null);
        }}
        booking={selectedBookingForExtension}
        onExtensionSubmitted={() => {
          setIsExtensionModalOpen(false);
        }}
      />

      {/* Breakdown Modal */}
      <ReportBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => {
          setIsBreakdownModalOpen(false);
          setSelectedBookingForBreakdown(null);
        }}
        booking={selectedBookingForBreakdown}
        onBreakdownReported={(updated) => {
          setActiveBookings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }}
      />

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default ContractorDashboardPage;
