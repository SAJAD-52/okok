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
} from 'lucide-react';
import { Booking, ContractorSite } from '../types/database';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RentalExtensionModal } from '../components/bookings/RentalExtensionModal';
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

  const companyTitle = profile?.company_name || profile?.full_name || (lang === 'fr' ? 'Entreprise BTP' : 'مقاولة البناء');

  return (
    <div className="space-y-6 text-start">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ink via-steel-900 to-steel-800 text-white p-6 sm:p-8 shadow-xl border border-steel-700">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-black">
            <HardHat className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Espace Professionnel Entreprise' : 'بوابة مقاولات البناء والأشغال الكبرى'}</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-white">
            {lang === 'fr' ? `Bienvenue, ${companyTitle}` : `مرحباً بك، ${companyTitle}`}
          </h1>

          <p className="text-xs sm:text-sm text-steel-300">
            {lang === 'fr'
              ? 'Localisez les engins de chantier les plus proches de vos projets en temps réel, réservez en direct et prolongez vos locations sans intermédiaire.'
              : 'حدد موقع ورش العمل على الخريطة لرصد أقرب الآليات المتاحة فوراً بنظام الرادار، مع إمكانية الحجز المباشر وطلب تمديد الكراء.'}
          </p>

          <div className="pt-3 flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/entreprise/map')}
              leftIcon={<MapPin className="w-4 h-4" />}
              className="font-black text-xs sm:text-sm shadow-md"
            >
              {lang === 'fr' ? 'Ouvrir le Radar InDrive Chantiers' : 'فتح رادار أقرب الآليات للورش'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate('/entreprise/bookings')}
              className="text-white border-steel-600 hover:bg-steel-800 text-xs font-bold"
            >
              {lang === 'fr' ? 'Mes locations actives' : 'متابعة حجوزاتي النشطة'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsProfileModalOpen(true)}
              leftIcon={<Building2 className="w-4 h-4 text-primary" />}
              className="text-white border-steel-600 hover:bg-steel-800 text-xs font-bold"
            >
              {lang === 'fr' ? 'Modifier mes informations' : 'تعديل معلومات المقاولة'}
            </Button>
          </div>
        </div>

        {/* Decorative Background Icons */}
        <div className="absolute end-6 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <HardHat className="w-56 h-56 text-primary" />
        </div>
      </div>

      {/* 4 Contractor KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active on Site */}
        <Card className="p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Engins sur chantier' : 'آليات تعمل بالورش حالياً'}
            </span>
            <span className="text-lg sm:text-xl font-black text-ink">{activeBookings.length}</span>
          </div>
        </Card>

        {/* KPI 2: Pending requests */}
        <Card className="p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Demandes en attente' : 'طلبات قيد المراجعة'}
            </span>
            <span className="text-lg sm:text-xl font-black text-ink">{pendingBookings.length}</span>
          </div>
        </Card>

        {/* KPI 3: Saved Job Sites */}
        <Card className="p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Chantiers enregistrés' : 'أوراش ومشاريع نشطة'}
            </span>
            <span className="text-lg sm:text-xl font-black text-ink">{savedSites.length}</span>
          </div>
        </Card>

        {/* KPI 4: Total Spent */}
        <Card className="p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Investissement locations' : 'إجمالي كراء الآليات'}
            </span>
            <span className="text-sm sm:text-base font-black text-ink truncate block">
              {totalSpent.toLocaleString('fr-FR')} MAD
            </span>
          </div>
        </Card>
      </div>

      {/* InDrive Interactive Radar Card Callout */}
      <Card className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-primary/40 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary text-ink flex items-center justify-center font-black shrink-0 shadow-sm">
            <MapPin className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-black text-ink">
              {lang === 'fr' ? 'Besoin d\'un engin urgent sur votre chantier ?' : 'هل تحتاج آلية أو شاحنة عاجلة لورشك الآن؟'}
            </h3>
            <p className="text-xs text-steel-600 mt-0.5">
              {lang === 'fr'
                ? 'Pointez votre chantier sur la carte et voyez immédiatement les engins disponibles avec la distance exacte et l\'estimation d\'arrivée.'
                : 'حدد موقع الورش على الخريطة، وسيرصد لك الرادار أقرب الآليات المتاحة مع المسافة بالكيلومتر ووقت الوصول التقديري.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => navigate('/entreprise/map')}
          className="whitespace-nowrap shrink-0 font-black text-xs sm:text-sm"
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {lang === 'fr' ? 'Chercher avec le Radar' : 'البحث برادار الخريطة 📍'}
        </Button>
      </Card>

      {/* Active Machines Currently On Site */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <span>{lang === 'fr' ? 'Engins actuellement actifs sur vos chantiers' : 'الآليات العاملة في أوراشك حالياً'}</span>
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/entreprise/bookings')}
            className="text-xs font-bold"
          >
            {lang === 'fr' ? 'Voir toutes les locations' : 'عرض كافة الحجوزات'}
          </Button>
        </div>

        {activeBookings.length === 0 ? (
          <Card className="p-8 text-center bg-white border border-steel-200 rounded-3xl space-y-3">
            <Truck className="w-10 h-10 text-steel-300 mx-auto" />
            <p className="text-xs text-steel-500">
              {lang === 'fr'
                ? 'Aucune machine n\'est actuellement en cours de location sur vos chantiers.'
                : 'لا توجد آليات تعمل في أوراشك حالياً. يمكنك تصفح السوق أو استخدام الرادار لكراء آلية فوراً.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/marketplace')}
            >
              {lang === 'fr' ? 'Parcourir le catalogue d\'engins' : 'تصفح سوق الآليات والمعدات'}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => {
              const machine = b.machine as any;
              return (
                <Card
                  key={b.id}
                  className="p-4 bg-white border border-steel-200 shadow-soft rounded-2xl flex flex-col justify-between space-y-3"
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-steel-100 shrink-0">
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
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          {lang === 'fr' ? 'En activité' : 'قيد العمل بالورش'}
                        </span>
                        <span className="text-xs font-black text-primary-dark">
                          {b.total_price.toLocaleString('fr-FR')} MAD
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-ink truncate">
                        {lang === 'fr' ? machine?.title_fr || machine?.brand : machine?.title_ar || machine?.brand}
                      </h4>
                      <p className="text-[11px] text-steel-500">
                        {machine?.brand} {machine?.model} · {machine?.city || 'المغرب'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-steel-100 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingForExtension(b);
                        setIsExtensionModalOpen(true);
                      }}
                      leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                      className="text-xs font-black flex-1 justify-center"
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
                      className="text-xs"
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

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default ContractorDashboardPage;
