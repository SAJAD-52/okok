// ============================================================================
// JADIJCB: Super Admin Master Control Tower (قمة هرم المنصة)
// Complete Oversight, Authority, and Impersonation for said.cpge24@gmail.com
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Building2,
  Phone,
  FileCheck,
  Calendar,
  AlertTriangle,
  ExternalLink,
  X,
  CreditCard,
  User,
  Users,
  Filter,
  Truck,
  CalendarCheck,
  Activity,
  Sparkles,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Trash2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth, SUPER_ADMIN_EMAIL } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { adminService, AdminAccountDetail, PlatformActivityLog } from '../lib/adminService';
import { bookingStore } from '../lib/bookingStore';
import { PaymentRecord, PaymentStatus, Machine, Booking, UserRole } from '../types/database';

type AdminTab = 'accounts' | 'machines' | 'bookings' | 'payments' | 'activity';

export const AdminPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, impersonateUser, impersonatedUser, stopImpersonating, isImpersonating } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('accounts');

  // Accounts state
  const [accounts, setAccounts] = useState<AdminAccountDetail[]>([]);
  const [searchAccountQuery, setSearchAccountQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminAccountDetail | null>(null);

  // Machinery fleet state
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [searchMachineQuery, setSearchMachineQuery] = useState('');

  // Bookings state
  const [allBookings, setAllBookings] = useState<Booking[]>([]);

  // Payments state
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Activity stream state
  const [activities, setActivities] = useState<PlatformActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all platform data
  const loadPlatformData = async () => {
    setIsLoading(true);
    try {
      // 1. Load accounts
      const userList = await adminService.getAllAccounts();
      setAccounts(userList);

      // 2. Load all machines across Morocco
      let machinesList: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data: mData } = await supabase.from('machines').select('*, profiles(full_name, company_name, phone)');
        if (mData) {
          machinesList = mData.map((m: any) => ({
            id: m.id,
            owner_id: m.owner_id,
            title_ar: m.title_ar,
            title_fr: m.title_fr,
            brand: m.brand,
            model: m.model,
            year: m.year,
            city: m.city,
            daily_rate: Number(m.daily_rate) || 2200,
            rate_daily: Number(m.daily_rate) || 2200,
            hourly_rate: Number(m.hourly_rate) || 350,
            sale_price: Number(m.sale_price) || 0,
            currency: 'MAD',
            with_operator: Boolean(m.with_operator),
            status: m.is_published ? 'available' : 'inactive',
            is_published: m.is_published,
            images: m.images || [],
            owner: m.profiles,
            created_at: m.created_at,
          } as Machine));
        }
      }
      setAllMachines(machinesList);

      // 3. Load all bookings & rentals
      let bookingsList: Booking[] = [];
      if (isSupabaseConfigured) {
        const { data: bData } = await supabase.from('bookings').select('*, machines(*)');
        if (bData) {
          bookingsList = bData.map((b: any) => ({
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
            with_operator: Boolean(b.with_operator ?? true),
            created_at: b.created_at,
            machine: b.machines,
          }));
        }
      }
      const cachedBookings = bookingStore.getCachedBookings();
      for (const cb of cachedBookings) {
        if (!bookingsList.some((b) => b.id === cb.id)) {
          bookingsList.push(cb);
        }
      }
      setAllBookings(bookingsList);

      // 4. Load payments
      if (isSupabaseConfigured) {
        const { data: pData } = await supabase
          .from('payments')
          .select('*, profiles(full_name, company_name, phone)')
          .order('created_at', { ascending: false });

        if (pData) {
          setPayments(
            pData.map((p: any) => ({
              id: p.id,
              user_id: p.user_id,
              amount: Number(p.amount),
              method: p.method,
              reference: p.reference,
              proof_url: p.proof_url,
              status: p.status,
              created_at: p.created_at,
              user_name: p.profiles?.full_name,
              company_name: p.profiles?.company_name,
              user_phone: p.profiles?.phone,
            }))
          );
        }
      }

      // 5. Load activity stream
      setActivities(adminService.getActivityLogs());
    } catch (e) {
      console.warn('Super Admin load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchAccountQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.full_name?.toLowerCase().includes(q) ||
        acc.company_name?.toLowerCase().includes(q) ||
        acc.phone?.includes(q) ||
        acc.city?.toLowerCase().includes(q) ||
        acc.ice_number?.includes(q);

      const matchesRole = filterRole === 'all' || acc.role === filterRole;

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'suspended' && acc.is_suspended) ||
        (filterStatus === 'active' && acc.subscription_status === 'active' && !acc.is_suspended) ||
        (filterStatus === 'trial' && acc.subscription_status === 'trial' && !acc.is_suspended);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, searchAccountQuery, filterRole, filterStatus]);

  // Filter machines
  const filteredMachines = useMemo(() => {
    return allMachines.filter((m) => {
      const q = searchMachineQuery.toLowerCase().trim();
      return (
        !q ||
        m.title_ar?.toLowerCase().includes(q) ||
        m.title_fr?.toLowerCase().includes(q) ||
        m.brand?.toLowerCase().includes(q) ||
        m.model?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q)
      );
    });
  }, [allMachines, searchMachineQuery]);

  // Account actions
  const handleToggleSuspend = async (acc: AdminAccountDetail) => {
    const isNowSuspended = await adminService.toggleSuspendUser(acc.id);
    toast.success(
      isNowSuspended
        ? `تم تجميد حساب ${acc.full_name} بنجاح.`
        : `تم إلغاء التجميد وإعادة تنشيط حساب ${acc.full_name}.`
    );
    loadPlatformData();
  };

  const handleGrantVip = async (acc: AdminAccountDetail) => {
    await adminService.grantVipSubscription(acc.id, 12);
    toast.success(`تم تفعيل اشتراك VIP سنوي غير محدود لحساب ${acc.full_name} 👑!`);
    loadPlatformData();
  };

  const handleExtendTrial = async (acc: AdminAccountDetail) => {
    await adminService.extendTrial(acc.id, 3);
    toast.success(`تم تمديد الفترة التجريبية 72 ساعة إضافية لحساب ${acc.full_name}.`);
    loadPlatformData();
  };

  const handleChangeRole = async (acc: AdminAccountDetail, newRole: UserRole) => {
    await adminService.changeUserRole(acc.id, newRole);
    toast.success(`تم تغيير صفة الحساب إلى: ${newRole === 'owner' ? 'مالك آليات' : 'مقاولة بناء'}`);
    loadPlatformData();
  };

  const handleDeleteAccount = async (acc: AdminAccountDetail) => {
    if (confirm(`هل أنت متأكد من حذف حساب ${acc.full_name} نهائياً من المنصة؟`)) {
      await adminService.deleteAccount(acc.id);
      toast.success('تم حذف الحساب بنجاح.');
      loadPlatformData();
    }
  };

  // Impersonate action (Super Admin capability)
  const handleImpersonate = (acc: AdminAccountDetail) => {
    impersonateUser(acc);
    toast.success(`أنت الآن تتصفح المنصة بصلاحية: ${acc.company_name || acc.full_name}`);
    if (acc.role === 'client' || acc.role === 'contractor') {
      navigate('/entreprise');
    } else {
      navigate('/app');
    }
  };

  // Payment actions
  const handleApprovePayment = async (id: string) => {
    setProcessingId(id);
    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('approve_payment', { payment_id: id, months: durationMonths });
      } catch (e) {
        console.warn('approve_payment warning:', e);
      }
    }
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'approved' as PaymentStatus } : p)));
    setProcessingId(null);
    toast.success('تمت الموافقة على التحويل البنكي وتمديد الاشتراك بنجاح!');
  };

  const handleRejectPayment = async (id: string) => {
    setProcessingId(id);
    if (isSupabaseConfigured) {
      try {
        await supabase.from('payments').update({ status: 'rejected' }).eq('id', id);
      } catch (e) {
        console.warn('reject payment warning:', e);
      }
    }
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'rejected' as PaymentStatus } : p)));
    setProcessingId(null);
    toast.error('تم رفض الوصل وإشعار المستخدم.');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* Top Super Admin Identity Command Banner */}
      <div className="bg-ink text-white border-b-2 border-primary py-3 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-primary uppercase tracking-wider">
                JADIJCB · SUPER ADMIN
              </span>
              <span className="px-2 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-bold border border-primary/30">
                {SUPER_ADMIN_EMAIL}
              </span>
            </div>
            <p className="text-[11px] text-steel-400">
              {lang === 'fr'
                ? 'Souveraineté totale & Supervision de tous les comptes marocains'
                : 'السلطة العليا والمراقبة المباشرة لكافة حسابات الملاك والمقاولات في المغرب'}
            </p>
          </div>
        </div>

        {/* Global Impersonation Warning Banner if currently active */}
        {isImpersonating && (
          <div className="flex items-center gap-2 bg-amber-500 text-ink px-3 py-1.5 rounded-xl font-black text-xs animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span>معاينة كـ: {impersonatedUser?.company_name || impersonatedUser?.full_name}</span>
            <button
              type="button"
              onClick={stopImpersonating}
              className="ms-2 underline text-[11px] cursor-pointer"
            >
              [إنهاء المعاينة والرجوع]
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadPlatformData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs text-steel-300 hover:text-white"
          >
            تحديث البيانات
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/app')}
            className="text-xs font-bold bg-steel-900 border-steel-700 text-steel-300 hover:text-white"
          >
            فضاء الملاك
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/entreprise')}
            className="text-xs font-bold bg-steel-900 border-steel-700 text-steel-300 hover:text-white"
          >
            بوابة المقاولات
          </Button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 text-start">
        {/* Top 4 Macro Platform KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 sm:p-5 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">إجمالي الحسابات المسجلة</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-ink font-mono">{accounts.length}</div>
            <span className="text-[10px] text-blue-600 font-bold block mt-1">ملاك آليات + مقاولات بناء</span>
          </Card>

          <Card className="p-4 sm:p-5 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">الآليات المعروضة بالمغرب</span>
              <div className="p-2 rounded-xl bg-amber-50 text-primary-dark">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-ink font-mono">{allMachines.length}</div>
            <span className="text-[10px] text-amber-600 font-bold block mt-1">جرافات، رافعات، شاحنات</span>
          </Card>

          <Card className="p-4 sm:p-5 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">عقود الكراء والعمليات</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">{allBookings.length}</div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">عقود نشطة ومكتملة بالأوراش</span>
          </Card>

          <Card className="p-4 sm:p-5 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">التحويلات بانتظار الاعتماد</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 font-mono">
              {payments.filter((p) => p.status === 'pending').length}
            </div>
            <span className="text-[10px] text-rose-600 font-bold block mt-1">وصولات وفاكاش وتحويلات RIB</span>
          </Card>
        </div>

        {/* Master Tab Bar Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6 border-b border-steel-200">
          {[
            { id: 'accounts', labelAr: '👥 مراقبة وسلطة على كل الحسابات', labelFr: 'Gestion des Comptes', icon: <Users className="w-4 h-4" /> },
            { id: 'machines', labelAr: '🚜 مراقبة أسطول الآليات وسوق المعدات', labelFr: 'Toutes les Machines', icon: <Truck className="w-4 h-4" /> },
            { id: 'bookings', labelAr: '📋 عقود الكراء والعمليات بالأوراش', labelFr: 'Réservations Chantiers', icon: <CalendarCheck className="w-4 h-4" /> },
            { id: 'payments', labelAr: '💳 تدقيق التحويلات والوصولات البنكية', labelFr: 'Validation des Paiements', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'activity', labelAr: '⚡ سجل الأنشطة المباشر للجميع', labelFr: 'Journal d\'Activité', icon: <Activity className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-ink text-primary shadow-md border-b-2 border-primary'
                  : 'bg-white text-steel-600 hover:text-ink hover:bg-steel-100 border border-steel-200'
              }`}
            >
              {tab.icon}
              <span>{lang === 'fr' ? tab.labelFr : tab.labelAr}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: ALL ACCOUNTS AUTHORITY */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <Card className="p-4 bg-white border border-steel-200 shadow-soft">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم، رقم الهاتف (06/07)، اسم المقاولة، المدينة، أو رقم الـ ICE..."
                    value={searchAccountQuery}
                    onChange={(e) => setSearchAccountQuery(e.target.value)}
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                  />
                  <Search className="w-4 h-4 text-steel-400 absolute start-3.5 top-3" />
                </div>

                {/* Role Filter */}
                <div className="flex items-center gap-1.5 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setFilterRole('all')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      filterRole === 'all' ? 'bg-ink text-white' : 'bg-steel-100 text-steel-600'
                    }`}
                  >
                    الكل ({accounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('owner')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      filterRole === 'owner' ? 'bg-amber-500 text-ink' : 'bg-steel-100 text-steel-600'
                    }`}
                  >
                    ملاك الآليات
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('client')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      filterRole === 'client' ? 'bg-blue-600 text-white' : 'bg-steel-100 text-steel-600'
                    }`}
                  >
                    المقاولات
                  </button>
                </div>
              </div>
            </Card>

            {/* Accounts Table / Cards */}
            <div className="space-y-3">
              {filteredAccounts.map((acc) => (
                <Card
                  key={acc.id}
                  className={`p-5 bg-white border transition-all ${
                    acc.is_suspended ? 'border-rose-300 bg-rose-50/20' : 'border-steel-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* User Identity info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-steel-100 border border-steel-200 flex items-center justify-center font-black text-ink text-sm shrink-0">
                        {acc.role === 'owner' ? '🚜' : '🏢'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-sm text-ink">{acc.full_name}</h3>
                          <Badge
                            variant={acc.role === 'owner' ? 'warning' : 'info'}
                            size="sm"
                            className="font-black"
                          >
                            {acc.role === 'owner' ? 'مالك آليات / مؤجر' : 'مقاولة بناء / زبون'}
                          </Badge>
                          {acc.is_suspended ? (
                            <Badge variant="danger" size="sm" className="font-bold">
                              ⛔ مجمد / معلق
                            </Badge>
                          ) : acc.subscription_status === 'active' ? (
                            <Badge variant="success" size="sm" className="font-bold">
                              👑 اشتراك VIP نشط
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" className="font-bold">
                              ⏳ تجربة 72H
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
                          {acc.company_name && (
                            <span className="font-bold text-steel-800 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-steel-400" />
                              {acc.company_name}
                            </span>
                          )}
                          <span className="font-mono font-bold text-ink" dir="ltr">
                            <Phone className="w-3.5 h-3.5 inline me-1 text-steel-400" />
                            {acc.phone}
                          </span>
                          {acc.city && (
                            <span className="flex items-center gap-1 text-steel-500">
                              <MapPin className="w-3.5 h-3.5" />
                              {acc.city}
                            </span>
                          )}
                          {acc.ice_number && (
                            <span className="font-mono text-[11px] text-steel-500">
                              ICE: {acc.ice_number}
                            </span>
                          )}
                        </div>

                        {/* What is this account doing right now? */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-steel-500 font-bold">
                          <span>الآليات المسجلة: <strong className="text-ink font-mono">{acc.machines_count}</strong></span>
                          <span>·</span>
                          <span>العمليات والحجوزات: <strong className="text-ink font-mono">{acc.bookings_count}</strong></span>
                          <span>·</span>
                          <span>حجم المعاملات: <strong className="text-emerald-700 font-mono">{acc.total_volume_mad.toLocaleString('fr-FR')} MAD</strong></span>
                          <span>·</span>
                          <span>آخر نشاط: <strong className="text-steel-700">{acc.last_active_at || 'نشط'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Authority Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-steel-100">
                      {/* Impersonate */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImpersonate(acc)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-primary" />}
                        className="text-xs font-black bg-amber-500/10 border-primary/40 hover:bg-amber-500/20 text-ink"
                        title="الدخول للمنصة والتصفح كما يراها هذا المستخدم تماماً"
                      >
                        معاينة كـ هذا الحساب 👁️
                      </Button>

                      {/* Grant VIP */}
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleGrantVip(acc)}
                        leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                        className="text-xs font-black"
                        title="تفعيل اشتراك سنوي معتمد بنقرة واحدة"
                      >
                        تفعيل VIP سنوي 👑
                      </Button>

                      {/* Extend Trial */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtendTrial(acc)}
                        className="text-xs font-bold"
                        title="تمديد 72 ساعة تجربة مجانية"
                      >
                        +3 أيام تجربة
                      </Button>

                      {/* Suspend / Unsuspend */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSuspend(acc)}
                        className={`text-xs font-bold ${
                          acc.is_suspended ? 'text-emerald-700 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        {acc.is_suspended ? 'إلغاء التجميد 🔓' : 'تجميد الحساب ⛔'}
                      </Button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc)}
                        className="p-2 rounded-xl text-steel-400 hover:text-danger hover:bg-rose-50 transition-colors cursor-pointer"
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ALL MACHINES FLEET */}
        {activeTab === 'machines' && (
          <div className="space-y-4">
            <Card className="p-4 bg-white border border-steel-200">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث في أسطول آليات المغرب (النوع، الماركة، المدينة)..."
                  value={searchMachineQuery}
                  onChange={(e) => setSearchMachineQuery(e.target.value)}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs font-bold bg-surface"
                />
                <Search className="w-4 h-4 text-steel-400 absolute start-3.5 top-3" />
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMachines.map((m) => (
                <Card key={m.id} className="p-4 bg-white border border-steel-200 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-steel-500">{m.brand} {m.model}</span>
                      <Badge variant={m.is_published ? 'success' : 'neutral'} size="sm">
                        {m.is_published ? 'معروضة بالسوق' : 'مسودة'}
                      </Badge>
                    </div>
                    <h4 className="font-black text-sm text-ink mb-1">{m.title_ar || m.title_fr}</h4>
                    <div className="flex items-center justify-between text-xs text-steel-600 mb-2">
                      <span>المدينة: <strong>{m.city}</strong></span>
                      <span className="font-mono font-black text-primary-dark">{m.daily_rate} MAD/j</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-steel-100 flex items-center justify-between">
                    <span className="text-[11px] text-steel-400">مالك: {m.owner?.company_name || m.owner?.full_name || 'مالك معتمد'}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/marketplace/${m.id}`)}
                      className="text-xs font-bold"
                    >
                      معاينة الإعلان ↗
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ALL LIVE BOOKINGS & CHANTIERS */}
        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {allBookings.map((b) => (
              <Card key={b.id} className="p-4 bg-white border border-steel-200 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-sm text-ink">
                        {b.machine?.title_ar || b.machine?.title_fr || 'آلية JCB'}
                      </span>
                      <Badge
                        variant={b.status === 'active' ? 'success' : b.status === 'pending' ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {b.status === 'active' ? 'نشطة بالورش' : b.status === 'pending' ? 'قيد التأكيد' : 'مكتملة'}
                      </Badge>
                    </div>
                    <div className="text-xs text-steel-600 flex flex-wrap gap-x-4">
                      <span>الزبون: <strong>{b.client_name || 'مقاول'}</strong> ({b.client_phone})</span>
                      <span className="font-mono" dir="ltr">{b.start_at?.slice(0, 10)} → {b.end_at?.slice(0, 10)}</span>
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-sm font-black text-emerald-700 font-mono">
                      {b.total_price.toLocaleString('fr-FR')} MAD
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 4: PAYMENTS & BANK TRANSFERS */}
        {activeTab === 'payments' && (
          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id} className="p-4 bg-white border border-steel-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-sm text-ink">{p.company_name || p.user_name}</span>
                    <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                      {p.status === 'approved' ? 'معتمد' : p.status === 'rejected' ? 'مرفوض' : 'بانتظار المراجعة'}
                    </Badge>
                  </div>
                  <div className="text-xs text-steel-600 flex gap-4">
                    <span>{p.method === 'rib' ? 'تحويل بنكي RIB' : 'وفاكاش Wafacash'}</span>
                    <span className="font-mono">المرجع: {p.reference}</span>
                    <span className="font-mono font-bold text-ink">{p.amount} MAD</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProofUrl(p.proof_url)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    معاينة الوصل
                  </Button>
                  {p.status === 'pending' && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprovePayment(p.id)}
                        className="text-xs font-black"
                      >
                        اعتماد وتفعيل
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRejectPayment(p.id)}
                        className="text-xs text-danger hover:bg-rose-50"
                      >
                        رفض
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 5: LIVE AUDIT ACTIVITY STREAM */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.map((act) => (
              <Card key={act.id} className="p-4 bg-white border border-steel-200 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-ink">{act.user_name} ({act.company_name})</span>
                    <span className="text-[10px] text-steel-400 font-mono">{act.timestamp}</span>
                  </div>
                  <p className="text-xs text-steel-700 mt-1">{act.details}</p>
                  <span className="text-[10px] text-steel-400 mt-0.5 block">{act.city} · {act.user_phone}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Proof Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="relative bg-white border border-steel-200 rounded-3xl max-w-xl w-full p-4 shadow-2xl overflow-hidden text-start">
            <div className="flex items-center justify-between pb-3 border-b border-steel-200 mb-3">
              <span className="text-xs font-black text-ink">وصل التحويل البنكي</span>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="w-8 h-8 rounded-lg bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={selectedProofUrl} alt="وصل الدفع" className="w-full h-auto object-contain max-h-[70vh] rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
