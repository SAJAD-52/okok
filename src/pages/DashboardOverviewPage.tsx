// ============================================================================
// JADIJCB: "اليوم" (Today) Operational Hub for Equipment Owners (/owner)
// Overdue Returns, Due Today/Tomorrow, Unpaid Dues, Idle Machines in 7 Days (WhatsApp),
// New Leads, First-Run Activation Checklist, and PWA Install Prompt
// ============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  TrendingUp,
  PlusCircle,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Bell,
  Check,
  Phone,
  CalendarCheck,
  Sparkles,
  ShieldCheck,
  Zap,
  User,
  Clock,
  ArrowRight,
  ArrowLeft,
  Share2,
  DollarSign,
  Download,
  Users,
  Building2,
  FileText,
  CheckCircle2,
  Send,
  ExternalLink,
  X,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RevenueChart, RevenuePoint } from '../components/dashboard/RevenueChart';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { ProfileSettingsModal } from '../components/profile/ProfileSettingsModal';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { Machine, Booking, Lead } from '../types/database';
import { bookingStore } from '../lib/bookingStore';
import { machineStore } from '../lib/machineStore';
import { paymentService } from '../lib/paymentService';
import { leadService } from '../lib/leadService';
import { businessService } from '../lib/businessService';
import { documentService } from '../lib/documentService';
import { serverApi } from '../lib/serverApi';
import { recordUserActivityThrottled, usePwaInstall } from '../lib/pwaHelper';

export const DashboardOverviewPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, user, isSuperAdmin } = useAuth();
  const { isInstallable, promptInstall } = usePwaInstall();

  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isCreateBookingModalOpen, setIsCreateBookingModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [hasBusinessProfile, setHasBusinessProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const userId = user?.id || profile?.id;

  // Throttled heartbeat activity ping
  useEffect(() => {
    if (userId) recordUserActivityThrottled(userId);
  }, [userId]);

  // Contractor redirect
  useEffect(() => {
    if (profile?.role === 'client' || profile?.role === 'contractor') {
      navigate('/entreprise', { replace: true });
    }
  }, [profile, navigate]);

  // Load live data
  const loadDashboardData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Machines
      let mList: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data: mData } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', userId);
        if (mData) {
          mList = mData.map((m: any) => ({
            id: m.id,
            owner_id: m.owner_id,
            title_ar: m.title_ar,
            title_fr: m.title_fr,
            brand: m.brand,
            model: m.model,
            daily_rate: Number(m.daily_rate) || 2000,
            status: m.is_published ? 'available' : 'inactive',
            images: m.images || [],
          } as Machine));
        }
      }
      const realMachines = machineStore.mergeMachines(mList, userId);
      setMachines(realMachines);

      // 2. Bookings (Matches owner_id OR machine ownership)
      let bList: Booking[] = [];
      const ownerMachineIds = realMachines.map((m) => m.id).filter(Boolean);

      // Load from Server SQLite Database (shared across all devices & users)
      try {
        const serverBookings = await serverApi.getBookings({ owner_id: userId });
        if (serverBookings && serverBookings.length > 0) {
          bList = serverBookings;
        }
      } catch (serverErr) {
        console.warn('Server SQLite bookings load notice:', serverErr);
      }

      if (isSupabaseConfigured) {
        try {
          let bQuery = supabase
            .from('bookings')
            .select('*, machines(*)')
            .order('start_at', { ascending: false });

          if (isSuperAdmin) {
            // Super Admin
          } else if (userId && ownerMachineIds.length > 0) {
            bQuery = bQuery.or(`owner_id.eq.${userId},machine_id.in.(${ownerMachineIds.join(',')})`);
          } else if (userId) {
            bQuery = bQuery.eq('owner_id', userId);
          }

          const { data: bData, error: bErr } = await bQuery;
          if (bErr) {
            if (userId) {
              const { data: fallback } = await supabase
                .from('bookings')
                .select('*, machines(*)')
                .eq('owner_id', userId);
              if (fallback) {
                bList = fallback.map((b: any) => ({
                  id: b.id,
                  machine_id: b.machine_id,
                  owner_id: b.owner_id,
                  client_name: b.client_name,
                  client_phone: b.client_phone,
                  start_at: b.start_at || b.start_date,
                  end_at: b.end_at || b.end_date,
                  total_price: Number(b.total_price) || 0,
                  deposit_amount: Number(b.deposit_amount) || 0,
                  status: b.status,
                  with_operator: Boolean(b.with_operator ?? true),
                  created_at: b.created_at,
                  machine: b.machines,
                }));
              }
            }
          } else if (bData) {
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
              status: b.status,
              with_operator: Boolean(b.with_operator ?? true),
              created_at: b.created_at,
              machine: b.machines,
            }));
          }
        } catch (e) {
          console.warn('Dashboard bookings load exception:', e);
        }
      }

      const mergedBookings = bookingStore.mergeOwnerBookings(
        bList,
        userId,
        ownerMachineIds,
        isSuperAdmin
      );
      setBookings(mergedBookings);

      // 3. Leads
      const loadedLeads = await leadService.getLeadsForOwner(userId);
      setLeads(loadedLeads);

      // 4. Documents count & activation
      const docs = await documentService.getDocumentsForOwner(userId);
      setDocsCount(docs.length);

      // 5. Business profile check
      const bp = await businessService.getProfile(userId);
      setHasBusinessProfile(Boolean(bp.ice || bp.company_name));
    } catch (err) {
      console.warn('Dashboard load notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSuperAdmin]);

  useEffect(() => {
    loadDashboardData();

    const handleUpdate = () => loadDashboardData();
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_leads_updated', handleUpdate);
    window.addEventListener('jadijcb_documents_updated', handleUpdate);
    window.addEventListener('jadijcb_business_profile_updated', handleUpdate);

    // Cross-tab storage updates
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'jadijcb_cached_bookings' ||
        e.key === 'jadijcb_last_booking_event' ||
        e.key === 'jadijcb_user_machines'
      ) {
        loadDashboardData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Periodic polling every 4 seconds to catch new bookings from other browsers
    const pollInterval = setInterval(() => {
      loadDashboardData();
    }, 4000);

    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_leads_updated', handleUpdate);
      window.removeEventListener('jadijcb_documents_updated', handleUpdate);
      window.removeEventListener('jadijcb_business_profile_updated', handleUpdate);
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [loadDashboardData]);

  // Pending incoming rental requests
  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'pending');
  }, [bookings]);

  const handleAcceptBooking = async (bookingId: string) => {
    bookingStore.updateBookingStatus(bookingId, 'active');
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'active' } : b))
    );
    if (isSupabaseConfigured) {
      try {
        await supabase.from('bookings').update({ status: 'active' }).eq('id', bookingId);
      } catch (err) {
        console.warn('Status update DB error:', err);
      }
    }
    toast.success(lang === 'fr' ? 'Réservation acceptée et activée !' : 'تم قبول وتأكيد الحجز بنجاح!');
  };

  const handleDeclineBooking = async (bookingId: string) => {
    bookingStore.updateBookingStatus(bookingId, 'cancelled');
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );
    if (isSupabaseConfigured) {
      try {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      } catch (err) {
        console.warn('Status update DB error:', err);
      }
    }
    toast.info(lang === 'fr' ? 'Demande de location refusée' : 'تم رفض وإلغاء طلب الحجز');
  };

  // Operational metrics for "اليوم"
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  // 1. Overdue Returns
  const overdueBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'active') return false;
      const end = new Date(b.end_at || b.end_date || '').getTime();
      return end < now.getTime();
    });
  }, [bookings, now]);

  // 2. Returns Due Today & Tomorrow
  const dueSoonBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'active') return false;
      const endStr = (b.end_at || b.end_date || '').slice(0, 10);
      return endStr === todayStr || endStr === tomorrowStr;
    });
  }, [bookings, todayStr, tomorrowStr]);

  // 3. Total Unpaid Balances
  const totalUnpaidDues = useMemo(() => {
    return bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => {
        const stats = paymentService.computeBookingPaymentStats(b, []);
        return sum + stats.balanceDue;
      }, 0);
  }, [bookings]);

  // 4. Idle Machines in next 7 days
  const idleMachines = useMemo(() => {
    return machines.filter((m) => {
      // Find if machine has any pending or active booking spanning between now and 7 days
      const hasBooking = bookings.some((b) => {
        if (b.machine_id !== m.id) return false;
        if (b.status === 'cancelled' || b.status === 'completed') return false;
        const bStart = new Date(b.start_at || b.start_date || '').getTime();
        const bEnd = new Date(b.end_at || b.end_date || '').getTime();
        return bStart < sevenDaysLater.getTime() && bEnd > now.getTime();
      });
      return !hasBooking;
    });
  }, [machines, bookings, now, sevenDaysLater]);

  // 5. Uncontacted new leads
  const uncontactedLeads = useMemo(() => {
    return leads.filter((l) => !l.is_contacted);
  }, [leads]);

  // First-run activation checklist calculation (5-minute path to value)
  const activationSteps = useMemo(() => {
    const step1 = hasBusinessProfile;
    const step2 = machines.length > 0;
    const step3 = bookings.length > 0;
    const step4 = docsCount > 0;

    const completedCount = [step1, step2, step3, step4].filter(Boolean).length;
    const percent = completedCount * 25;
    const isFullyActivated = Boolean(profile?.activation_at || completedCount === 4);

    return {
      step1,
      step2,
      step3,
      step4,
      completedCount,
      percent,
      isFullyActivated,
    };
  }, [hasBusinessProfile, machines.length, bookings.length, docsCount, profile?.activation_at]);

  // Revenue chart data
  const revenuePoints: RevenuePoint[] = useMemo(() => {
    const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نوفمبر', 'دجنبر'];
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const pts: RevenuePoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();

      const relevant = bookings.filter((b) => {
        if (b.status !== 'completed' && b.status !== 'active') return false;
        const bDate = new Date(b.start_at || b.created_at || Date.now());
        return bDate.getFullYear() === y && bDate.getMonth() === mIdx;
      });

      const revenue = relevant.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

      pts.push({
        month: monthsAr[mIdx],
        monthFr: monthsFr[mIdx],
        revenue,
        rentalsCount: relevant.length,
      });
    }
    return pts;
  }, [bookings, now]);

  const companyName = profile?.company_name || 'مقاولة كراء الآليات';
  const ownerName = profile?.full_name || 'المالك المعتمد';

  return (
    <div className="space-y-6 text-start">
      {/* Top Welcome Banner with Identity & Actions */}
      <div className="bg-ink text-white p-6 sm:p-7 rounded-3xl border border-steel-800 shadow-elevated relative overflow-hidden">
        <div className="absolute top-0 end-0 w-80 h-full bg-gradient-to-s from-primary/15 via-yellow-500/5 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-primary font-black uppercase tracking-wider">
                {companyName}
              </span>
              {activationSteps.isFullyActivated ? (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] font-black flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{lang === 'fr' ? 'Compte Activé' : 'حساب مهني مفعّل'}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                  {lang === 'fr' ? 'Configuration en cours' : 'قيد الإعداد الأولي'}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white">
              {lang === 'fr' ? `Bonjour, ${ownerName}` : `أهلاً بك، ${ownerName}`}
            </h1>
            <p className="text-xs text-steel-400 mt-1 max-w-xl">
              {lang === 'fr'
                ? 'Tableau de bord opérationnel "Aujourd\'hui" : Retours d\'engins, impayés, leads et disponibilité.'
                : 'شاشة العمليات اليومية: متابعة الإرجاعات، تحصيل الديون، طلبات الزبائن، والآليات الشاغرة.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            {isInstallable && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={promptInstall}
                leftIcon={<Download className="w-4 h-4 text-primary" />}
                className="w-full sm:w-auto font-bold text-xs text-white border-steel-700 hover:bg-steel-800 min-h-[44px]"
              >
                {lang === 'fr' ? 'Installer l\'App' : 'تثبيت التطبيق PWA'}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsProfileModalOpen(true)}
              leftIcon={<User className="w-4 h-4 text-primary" />}
              className="w-full sm:w-auto font-bold text-xs text-white border-steel-700 hover:bg-steel-800 min-h-[44px]"
            >
              {lang === 'fr' ? 'Modifier mes infos' : 'تعديل معلوماتي'}
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddMachineModalOpen(true)}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto font-black shadow-md min-h-[44px]"
            >
              {lang === 'fr' ? '+ Ajouter un engin' : '+ إضافة آلية'}
            </Button>
          </div>
        </div>
      </div>

      {/* First-Run Activation Progress Checklist (Shown prominently until fully active) */}
      {!activationSteps.isFullyActivated && (
        <Card className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-2 border-primary/50 shadow-soft rounded-3xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-ink">
                  {lang === 'fr'
                    ? 'Activez votre compte loueur professionnel en 5 minutes'
                    : 'فعّل حسابك المهني في 5 دقائق لتوليد أول عقد كراء'}
                </h3>
                <p className="text-[11px] text-steel-600">
                  {lang === 'fr'
                    ? 'Complétez les 4 étapes pour commencer à facturer et protéger vos chantiers'
                    : 'أكمل الخطوات الـ 4 لتأمين تعاملاتك وبدء استخلاص مداخيل أسطولك بأمان'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-ink">
                {activationSteps.percent}%
              </span>
              <div className="w-24 h-2 rounded-full bg-steel-200 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${activationSteps.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Step 1: Business Settings */}
            <Link
              to="/owner/settings/business"
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                activationSteps.step1
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-steel-200 hover:border-primary text-steel-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {activationSteps.step1 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Building2 className="w-4 h-4 text-primary-dark shrink-0" />
                )}
                <span className="font-bold">
                  {lang === 'fr' ? '1. Infos ICE & RIB' : '1. بيانات المقاولة والـ RIB'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-steel-400" />
            </Link>

            {/* Step 2: First Machine */}
            <button
              type="button"
              onClick={() => setIsAddMachineModalOpen(true)}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer text-start ${
                activationSteps.step2
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-steel-200 hover:border-primary text-steel-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {activationSteps.step2 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Truck className="w-4 h-4 text-primary-dark shrink-0" />
                )}
                <span className="font-bold">
                  {lang === 'fr' ? '2. Premier engin' : '2. إضافة أول آلية'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-steel-400" />
            </button>

            {/* Step 3: First Booking */}
            <button
              type="button"
              onClick={() => setIsCreateBookingModalOpen(true)}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer text-start ${
                activationSteps.step3
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-steel-200 hover:border-primary text-steel-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {activationSteps.step3 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <CalendarCheck className="w-4 h-4 text-primary-dark shrink-0" />
                )}
                <span className="font-bold">
                  {lang === 'fr' ? '3. Première location' : '3. تسجيل أول حجز'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-steel-400" />
            </button>

            {/* Step 4: First Contract */}
            <Link
              to="/owner/bookings"
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                activationSteps.step4
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-steel-200 hover:border-primary text-steel-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {activationSteps.step4 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-primary-dark shrink-0" />
                )}
                <span className="font-bold">
                  {lang === 'fr' ? '4. Générer le contrat' : '4. إصدار أول عقد'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-steel-400" />
            </Link>
          </div>
        </Card>
      )}

      {/* PENDING RENTAL REQUESTS HERO BANNER / SECTION */}
      {pendingBookings.length > 0 && (
        <Card className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/15 via-primary/10 to-white border-2 border-primary rounded-3xl shadow-elevated space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary text-ink flex items-center justify-center font-black shadow-sm shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-ink">
                    {lang === 'fr' ? 'Nouvelles demandes de location reçues' : 'طلبات الكراء الواردة (تتطلب قرارك)'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary text-ink text-xs font-black animate-pulse">
                    {pendingBookings.length} {lang === 'fr' ? 'en attente' : 'طلب جديد'}
                  </span>
                </div>
                <p className="text-xs text-steel-600 mt-0.5">
                  {lang === 'fr'
                    ? 'Des clients souhaitent louer vos engins. Confirmez ou contactez-les directement.'
                    : 'زبائن ومقاولات قدموا طلبات كراء لآلياتك. أكد الحجز فوراً أو تواصل معهم عبر الواتساب.'}
                </p>
              </div>
            </div>

            <Link
              to="/owner/bookings?tab=pending"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-primary hover:bg-black font-black text-xs transition-all shadow-xs self-start sm:self-auto"
            >
              <span>{lang === 'fr' ? 'Voir toutes les demandes' : 'إدارة كافة طلبات الكراء'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Cards of Pending Bookings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 bg-white rounded-2xl border border-steel-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center font-black shrink-0 border border-amber-200">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-ink truncate">
                          {b.machine?.title_ar || b.machine?.title_fr || 'آلية JCB'}
                        </h4>
                        <span className="text-[10px] text-steel-500 font-mono">
                          {b.machine?.brand} {b.machine?.model}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black shrink-0">
                      {lang === 'fr' ? 'En attente' : 'قيد التأكيد'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-steel-100 space-y-1.5 text-xs text-steel-700">
                    <div className="flex items-center justify-between">
                      <span className="text-steel-500 text-[11px] flex items-center gap-1">
                        <User className="w-3 h-3 text-steel-400" />
                        {lang === 'fr' ? 'Client :' : 'الزبون:'}
                      </span>
                      <span className="font-bold text-ink">{b.client_name || 'زبون مقاولة'}</span>
                    </div>

                    {b.client_phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-steel-500 text-[11px] flex items-center gap-1">
                          <Phone className="w-3 h-3 text-steel-400" />
                          {lang === 'fr' ? 'Téléphone :' : 'الهاتف:'}
                        </span>
                        <span className="font-mono font-bold text-steel-800" dir="ltr">
                          {b.client_phone}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-steel-500 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-steel-400" />
                        {lang === 'fr' ? 'Dates :' : 'الفترة:'}
                      </span>
                      <span className="font-mono text-[11px] text-steel-700" dir="ltr">
                        {b.start_at?.slice(0, 10)} → {b.end_at?.slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 font-bold">
                      <span className="text-steel-500 text-[11px]">
                        {lang === 'fr' ? 'Montant estimé :' : 'المبلغ المقدر:'}
                      </span>
                      <span className="font-mono font-black text-ink text-sm">
                        {Number(b.total_price).toLocaleString('fr-FR')} MAD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions: Accept, WhatsApp, Decline */}
                <div className="pt-2 border-t border-steel-100 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAcceptBooking(b.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Accepter' : 'قبول وتأكيد'}</span>
                  </button>

                  {b.client_phone && (
                    <a
                      href={`https://wa.me/${b.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `السلام عليكم ${b.client_name}، بخصوص طلب كراء الآلية (${b.machine?.title_ar || ''}) عبر منصة JADIJCB.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                      title="WhatsApp Client"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline font-bold">واتساب</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeclineBooking(b.id)}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                    title={lang === 'fr' ? 'Refuser' : 'رفض'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* "اليوم" Daily Operational Cards Grid (5 Cards with deep-links) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Pending Rental Requests (Demandes de location) */}
        <div
          onClick={() => navigate('/owner/bookings?tab=pending')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
            pendingBookings.length > 0
              ? 'bg-amber-50/80 border-primary ring-2 ring-primary/40'
              : 'bg-white border-steel-200 hover:border-steel-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Demandes de location' : 'طلبات الكراء الواردة'}
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                pendingBookings.length > 0
                  ? 'bg-primary text-ink animate-pulse shadow-sm'
                  : 'bg-steel-100 text-steel-500'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-3">
            <span
              className={`text-2xl font-black font-mono block ${
                pendingBookings.length > 0 ? 'text-amber-900 font-extrabold' : 'text-ink'
              }`}
            >
              {pendingBookings.length}
            </span>
            <span className="text-[11px] text-steel-500 mt-0.5 block">
              {pendingBookings.length > 0
                ? lang === 'fr'
                  ? 'Nouvelles demandes à confirmer'
                  : 'طلبات جديدة تتطلب التأكيد'
                : lang === 'fr'
                ? 'Aucune demande en attente'
                : 'لا توجد طلبات معلقة حالياً'}
            </span>
          </div>
        </div>

        {/* Card 2: Overdue Returns (Urgent Action) */}
        <div
          onClick={() => navigate('/owner/bookings?tab=active')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
            overdueBookings.length > 0
              ? 'bg-red-50 border-red-300 ring-1 ring-red-300'
              : 'bg-white border-steel-200 hover:border-steel-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Retours en retard' : 'إرجاعات متأخرة عن الموعد'}
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                overdueBookings.length > 0
                  ? 'bg-red-600 text-white animate-bounce'
                  : 'bg-steel-100 text-steel-500'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-3">
            <span
              className={`text-2xl font-black font-mono block ${
                overdueBookings.length > 0 ? 'text-red-700' : 'text-ink'
              }`}
            >
              {overdueBookings.length}
            </span>
            <span className="text-[11px] text-steel-500 mt-0.5 block">
              {overdueBookings.length > 0
                ? lang === 'fr'
                  ? 'À contacter d\'urgence'
                  : 'يتطلب التواصل للتمديد أو الاستلام'
                : lang === 'fr'
                ? 'Aucun retard constaté'
                : 'لا توجد آليات متأخرة حالياً'}
            </span>
          </div>
        </div>

        {/* Card 3: Returns Due Today & Tomorrow */}
        <div
          onClick={() => navigate('/owner/bookings?tab=active')}
          className="p-5 rounded-2xl border border-steel-200 bg-white hover:border-steel-300 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Retours aujourd\'hui & demain' : 'إرجاعات اليوم والغد'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-3">
            <span className="text-2xl font-black font-mono text-ink block">
              {dueSoonBookings.length}
            </span>
            <span className="text-[11px] text-steel-500 mt-0.5 block">
              {dueSoonBookings.length > 0
                ? lang === 'fr'
                  ? 'Engins prévus au retour'
                  : 'آليات متوقع وصولها أو تمديدها'
                : lang === 'fr'
                ? 'Aucun retour programmé'
                : 'لا توجد نهايات كراء قريبة'}
            </span>
          </div>
        </div>

        {/* Card 4: Unpaid Dues Total */}
        <div
          onClick={() => navigate('/owner/bookings?tab=dues')}
          className="p-5 rounded-2xl border border-steel-200 bg-white hover:border-steel-300 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Dettes & Dûs à recouvrer' : 'إجمالي الديون المعلقة'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-3">
            <span
              className={`text-2xl font-black font-mono block ${
                totalUnpaidDues > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {totalUnpaidDues.toLocaleString('fr-FR')} MAD
            </span>
            <span className="text-[11px] text-steel-500 mt-0.5 block">
              {totalUnpaidDues > 0
                ? lang === 'fr'
                  ? 'Cliquez pour envoyer des rappels WhatsApp'
                  : 'انقر لإرسال تذكير أداء بالواتساب'
                : lang === 'fr'
                ? 'Tous les loyers sont réglés'
                : 'كافة الحسابات مسددة بالكامل'}
            </span>
          </div>
        </div>

        {/* Card 5: New Leads Captured */}
        <div
          onClick={() => navigate('/owner/storefront')}
          className="p-5 rounded-2xl border border-steel-200 bg-white hover:border-steel-300 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Nouveaux leads reçus' : 'طلبات عروض أسعار جديدة'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-ink flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-3">
            <span className="text-2xl font-black font-mono text-ink block">
              {uncontactedLeads.length}
            </span>
            <span className="text-[11px] text-steel-500 mt-0.5 block">
              {uncontactedLeads.length > 0
                ? lang === 'fr'
                  ? 'Clients en attente de rappel'
                  : 'زبائن ينتظرون اتصالكم لتأكيد الكراء'
                : lang === 'fr'
                ? 'Aucun lead en attente'
                : 'لا توجد طلبات جديدة معلقة'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Left = Idle Machines WhatsApp Generator + Leads, Right = Storefront Live & Mini Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Machines Idle in Next 7 Days (One-Tap WhatsApp Share) */}
          <Card className="p-5 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary-dark" />
                <h3 className="font-black text-sm text-ink">
                  {lang === 'fr'
                    ? 'Engins disponibles dans les 7 prochains jours'
                    : 'آليات شاغرة خلال الـ 7 أيام القادمة (تسويق فوري بالواتساب)'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                {idleMachines.length} {lang === 'fr' ? 'disponibles' : 'شاغرة'}
              </span>
            </div>

            <p className="text-xs text-steel-500">
              {lang === 'fr'
                ? 'Ces engins n\'ont aucune réservation planifiée cette semaine. Partagez-les en un clic sur WhatsApp pour les mettre en location immédiatement.'
                : 'هذه الآليات لا ترتبط بأي حجز هذا الأسبوع. شاركها بنقرة واحدة عبر الواتساب في مجموعات المقاولين لتأجيرها فوراً.'}
            </p>

            {idleMachines.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">
                🎉 {lang === 'fr' ? 'Bravo ! Tout votre parc d\'engins est loué et opérationnel.' : 'ممتاز! كامل أسطول آلياتك يعمل حالياً في الأوراش دون أي توقف.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {idleMachines.map((m) => {
                  const storefrontSlug = localStorage.getItem('jadijcb_owner_storefront_slug') || 'store';
                  const publicMachineUrl = `https://jadijcb.ma/s/${storefrontSlug}`;
                  const rateStr = (m.daily_rate || 2000).toLocaleString('fr-FR');

                  const waText =
                    lang === 'fr'
                      ? `Bonjour,\n\nNotre engin *${m.title_ar} (${m.brand} ${m.model})* est immédiatement disponible pour location sur vos chantiers.\n\n• Tarif : ${rateStr} MAD/jour\n• Disponibilité : Immédiate\n• Voir notre vitrine : ${publicMachineUrl}\n\nContactez-nous pour réserver.`
                      : `السلام عليكم ورحمة الله،\n\nتتوفر لدينا آلية *${m.title_ar} (${m.brand} ${m.model})* جاهزة للكراء الفوري لخدمة أوراشكم.\n\n• السعر اليومي: ${rateStr} درهم/يوم\n• الجاهزية: فورية مع سائق معتمد\n• رابط متجرنا العام: ${publicMachineUrl}\n\nللحجز والاستفسار يرجى التواصل معنا مباشرة.`;

                  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl border border-steel-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-steel-50/50 hover:bg-white transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={m.images?.[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=200&q=80'}
                          alt={m.title_ar}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        <div>
                          <span className="font-black text-sm text-ink block">
                            {m.title_ar}
                          </span>
                          <span className="text-[11px] text-steel-500">
                            {m.brand} {m.model} · <strong className="font-mono text-ink">{rateStr} MAD/j</strong>
                          </span>
                        </div>
                      </div>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{lang === 'fr' ? 'Partager sur WhatsApp' : 'مشاركة فورية بالواتساب'}</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 6-Month Revenue & Bookings Trend */}
          <Card className="p-5 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-dark" />
                <h3 className="font-black text-sm text-ink">
                  {lang === 'fr' ? 'Évolution des revenus (6 derniers mois)' : 'تطور مداخيل الأسطول (آخر 6 أشهر)'}
                </h3>
              </div>
              <Link
                to="/owner/analytics"
                className="text-xs font-bold text-primary-dark hover:underline flex items-center gap-1"
              >
                <span>{lang === 'fr' ? 'Détails financiers' : 'التفاصيل المالية'}</span>
                {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </Link>
            </div>

            <RevenueChart data={revenuePoints} />
          </Card>
        </div>

        {/* Right Column (5 Cols): Quote Leads Inbox */}
        <div className="lg:col-span-5 space-y-6 sticky top-20">
          {/* New Leads Received from Storefront */}
          <Card className="p-5 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary-dark" />
                <h3 className="font-black text-sm text-ink">
                  {lang === 'fr' ? 'Demandes de devis du متجر' : 'طلبات الكراء الواردة من المتجر'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                {leads.length} {lang === 'fr' ? 'leads' : 'طلبات'}
              </span>
            </div>

            {leads.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-steel-50 border border-steel-200 text-[11px] text-steel-500">
                {lang === 'fr'
                  ? 'Aucune demande reçue pour le moment. Partagez votre lien de vitrine pour recevoir des demandes directes.'
                  : 'لم تتلقَ أي طلبات حتى الآن. انشر رابط متجرك في أوراش المقاولين لتلقي طلبات عروض أسعار مباشرة.'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {leads.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-xl border border-steel-200 bg-steel-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-ink">{l.client_name}</span>
                      <span className="text-[10px] text-steel-400 font-mono" dir="ltr">
                        {l.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-steel-600">
                      <span className="font-mono font-bold" dir="ltr">{l.client_phone}</span>
                      {l.city && <span>· {l.city}</span>}
                    </div>

                    {l.notes && (
                      <p className="text-[11px] text-steel-500 italic bg-white p-2 rounded-lg border border-steel-100">
                        "{l.notes}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-steel-200/60">
                      <a
                        href={`https://wa.me/${l.client_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${l.client_phone}`}
                        className="py-1.5 px-3 rounded-lg border border-steel-300 text-ink hover:bg-steel-50 font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Appel' : 'اتصال'}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      <MachineStepperModal
        isOpen={isAddMachineModalOpen}
        onClose={() => setIsAddMachineModalOpen(false)}
        onSave={async () => {
          await loadDashboardData();
          setIsAddMachineModalOpen(false);
        }}
      />

      <CreateBookingModal
        isOpen={isCreateBookingModalOpen}
        onClose={() => setIsCreateBookingModalOpen(false)}
        machines={machines}
        existingBookings={bookings}
        onBookingCreated={() => loadDashboardData()}
      />

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default DashboardOverviewPage;
