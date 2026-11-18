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
  KeyRound,
  MessageCircle,
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
import { adminService, AdminAccountDetail, PlatformOverviewMetrics } from '../lib/adminService';
import { bookingStore } from '../lib/bookingStore';
import { platformSettingsStore, PlatformSettings } from '../lib/platformSettings';
import { adminResetUserPassword, adminIssueWhatsAppOtp } from '../lib/whatsappOtpService';
import { PaymentRecord, PaymentStatus, Machine, Booking, UserRole } from '../types/database';

type AdminTab = 'accounts' | 'machines' | 'bookings' | 'payments' | 'settings';

export const AdminPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, impersonateUser, impersonatedUser, stopImpersonating, isImpersonating } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('accounts');

  // Accounts state & KPIs
  const [accounts, setAccounts] = useState<AdminAccountDetail[]>([]);
  const [metrics, setMetrics] = useState<PlatformOverviewMetrics | null>(null);
  const [searchAccountQuery, setSearchAccountQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trial' | 'suspended' | 'never_activated' | 'inactive_7d'>('all');
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Platform dynamic payment & subscription settings
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(() => platformSettingsStore.getSettings());
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Admin Password Reset & Free OTP Modal state
  const [resetPasswordTarget, setResetPasswordTarget] = useState<AdminAccountDetail | null>(null);
  const [adminResetTab, setAdminResetTab] = useState<'otp' | 'direct'>('otp');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [adminPasswordSaved, setAdminPasswordSaved] = useState<boolean>(false);
  const [adminIssuedOtp, setAdminIssuedOtp] = useState<string>('');

  // Account action loading & Delete Confirmation Modal state
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<AdminAccountDetail | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  useEffect(() => {
    platformSettingsStore.pullFromRemote().then((s) => {
      setSettingsForm(s);
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updated = await platformSettingsStore.updateSettings(settingsForm);
      setSettingsForm(updated);
      toast.success('✅ تم حفظ ومزامنة إعدادات الدفع في قاعدة البيانات بنجاح! ستظهر فوراً لجميع الملاك.');
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء حفظ الإعدادات في قاعدة البيانات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Load all platform data
  const loadPlatformData = async () => {
    setIsLoading(true);
    try {
      // 1. Load accounts & platform overview KPIs
      const [userList, ovMetrics] = await Promise.all([
        adminService.getAllAccounts(),
        adminService.getOverviewMetrics(),
      ]);
      setAccounts(userList);
      setMetrics(ovMetrics);

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

      let matchesStatus = true;
      if (filterStatus === 'suspended') {
        matchesStatus = Boolean(acc.is_suspended);
      } else if (filterStatus === 'active') {
        matchesStatus = acc.subscription_status === 'active' && !acc.is_suspended;
      } else if (filterStatus === 'trial') {
        matchesStatus = acc.subscription_status === 'trial' && !acc.is_suspended;
      } else if (filterStatus === 'never_activated') {
        matchesStatus = !acc.activation_at;
      } else if (filterStatus === 'inactive_7d') {
        if (!acc.last_active_at) {
          matchesStatus = true;
        } else {
          const lastActiveDate = new Date(acc.last_active_at).getTime();
          const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
          matchesStatus = isNaN(lastActiveDate) || lastActiveDate < sevenDaysAgo;
        }
      }

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
    if (acc.role === 'admin' || acc.id === user?.id) {
      toast.error('لا يمكن تجميد حساب المشرف العام.');
      return;
    }
    setProcessingAccountId(acc.id);
    try {
      const isNowSuspended = await adminService.toggleSuspendUser(acc.id, acc.is_suspended);
      setAccounts((prev) =>
        prev.map((item) =>
          item.id === acc.id
            ? {
                ...item,
                is_suspended: isNowSuspended,
                subscription_status: isNowSuspended ? 'suspended' : 'active',
              }
            : item
        )
      );
      toast.success(
        isNowSuspended
          ? `⛔ تم تجميد حساب ${acc.full_name} بنجاح وإيقاف دخوله للمنصة.`
          : `🔓 تم إلغاء التجميد وإعادة تنشيط حساب ${acc.full_name}.`
      );
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تغيير حالة تجميد الحساب، يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleGrantVip = async (acc: AdminAccountDetail) => {
    setProcessingAccountId(acc.id);
    try {
      await adminService.grantVipSubscription(acc.id, 12);
      toast.success(`تم تفعيل اشتراك VIP سنوي غير محدود لحساب ${acc.full_name} 👑!`);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تفعيل اشتراك VIP.');
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleExtendTrial = async (acc: AdminAccountDetail) => {
    setProcessingAccountId(acc.id);
    try {
      await adminService.extendTrial(acc.id, 3);
      toast.success(`تم تمديد الفترة التجريبية 72 ساعة إضافية لحساب ${acc.full_name}.`);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تمديد الفترة التجريبية.');
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleChangeRole = async (acc: AdminAccountDetail, newRole: UserRole) => {
    setProcessingAccountId(acc.id);
    try {
      await adminService.changeUserRole(acc.id, newRole);
      toast.success(
        `تم تغيير صفة الحساب إلى: ${
          newRole === 'owner' ? 'مالك آليات' : newRole === 'driver' ? 'سائق آليات' : 'زبون / مقاولة'
        }`
      );
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تغيير صفة الحساب.');
    } finally {
      setProcessingAccountId(null);
    }
  };

  const handleOpenDeleteAccount = (acc: AdminAccountDetail) => {
    if (acc.role === 'admin' || acc.id === user?.id) {
      toast.error('لا يمكن حذف حساب المشرف العام.');
      return;
    }
    setDeleteAccountTarget(acc);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteAccountTarget) return;
    setIsDeletingAccount(true);
    setProcessingAccountId(deleteAccountTarget.id);
    try {
      await adminService.deleteAccount(deleteAccountTarget.id);
      setAccounts((prev) => prev.filter((item) => item.id !== deleteAccountTarget.id));
      toast.success(`تم حذف حساب ${deleteAccountTarget.full_name} نهائياً من المنصة.`);
      setDeleteAccountTarget(null);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err?.message || 'تعذر حذف الحساب من قاعدة البيانات.');
    } finally {
      setIsDeletingAccount(false);
      setProcessingAccountId(null);
    }
  };

  const generateQuickPassword = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    return `JCB-${num}`;
  };

  const handleOpenResetPassword = (acc: AdminAccountDetail) => {
    setResetPasswordTarget(acc);
    setAdminResetTab('otp');
    setAdminNewPassword(generateQuickPassword());
    setAdminPasswordSaved(false);
    setAdminIssuedOtp('');
  };

  const handleIssueAdminFreeOtp = async () => {
    if (!resetPasswordTarget) return;
    setIsResettingPassword(true);
    try {
      const res = await adminIssueWhatsAppOtp(resetPasswordTarget.id);
      if (!res.success || !res.code) {
        toast.error(res.error || 'تعذر توليد الكود (تأكد من تشغيل migration SQL في Supabase)');
        return;
      }
      setAdminIssuedOtp(res.code);
      toast.success(`✅ تم توليد كود التفعيل (${res.code}) لمدة 30 دقيقة!`);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleConfirmAdminPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget) return;
    const cleanPass = adminNewPassword.trim();
    if (cleanPass.length < 8) {
      toast.error('كلمة السر يجب أن لا تقل عن 8 أحرف');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await adminResetUserPassword(resetPasswordTarget.id, cleanPass);
      if (!res.success) {
        toast.error(res.error || 'تعذر تحديث كلمة السر (تأكد من تشغيل migration SQL في Supabase)');
        return;
      }
      setAdminPasswordSaved(true);
      toast.success(`✅ تم تغيير كلمة السر لحساب ${resetPasswordTarget.full_name} بنجاح!`);
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Impersonate action (Super Admin capability)
  const handleImpersonate = (acc: AdminAccountDetail) => {
    impersonateUser(acc);
    toast.success(`أنت الآن تتصفح المنصة بصلاحية: ${acc.company_name || acc.full_name}`);
    if (acc.role === 'driver') {
      navigate('/driver');
    } else if (acc.role === 'client' || acc.role === 'contractor') {
      navigate('/entreprise');
    } else {
      navigate('/owner');
    }
  };

  // Preview signed receipt URL from private payment-proofs bucket
  const handlePreviewProof = async (proofUrl: string) => {
    if (!proofUrl) return;
    if (
      proofUrl.startsWith('http://') ||
      proofUrl.startsWith('https://') ||
      proofUrl.startsWith('data:') ||
      proofUrl.startsWith('blob:')
    ) {
      setSelectedProofUrl(proofUrl);
      return;
    }
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(proofUrl, 3600);
        if (!error && data?.signedUrl) {
          setSelectedProofUrl(data.signedUrl);
          return;
        }
      } catch (err) {
        console.warn('Could not generate signed URL for receipt:', err);
      }
      const { data: pubData } = supabase.storage.from('payment-proofs').getPublicUrl(proofUrl);
      setSelectedProofUrl(pubData?.publicUrl || proofUrl);
    } else {
      setSelectedProofUrl(proofUrl);
    }
  };

  // Payment actions
  const handleApprovePayment = async (id: string) => {
    setProcessingId(id);
    let success = false;
    let errMsg = '';

    if (isSupabaseConfigured) {
      try {
        const { error: rpcErr } = await supabase.rpc('approve_payment', {
          payment_id: id,
          months: durationMonths,
        });
        if (!rpcErr) {
          success = true;
        } else {
          console.warn('approve_payment RPC notice, attempting direct update:', rpcErr);
          const { error: pErr } = await supabase
            .from('payments')
            .update({ status: 'approved' })
            .eq('id', id);
          const pRecord = payments.find((p) => p.id === id);
          if (!pErr && pRecord?.user_id) {
            const targetDate = new Date();
            targetDate.setMonth(targetDate.getMonth() + durationMonths);
            const { error: profErr } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'active',
                subscription_ends_at: targetDate.toISOString(),
              })
              .eq('id', pRecord.user_id);

            if (!profErr) {
              success = true;
            } else {
              errMsg = profErr.message;
            }
          } else if (pErr) {
            errMsg = pErr.message;
          }
        }
      } catch (e: any) {
        errMsg = e.message || 'Error approving payment';
      }
    } else {
      success = true;
    }

    setProcessingId(null);
    if (success) {
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'approved' as PaymentStatus } : p))
      );
      toast.success(
        lang === 'fr'
          ? 'Paiement approuvé et abonnement activé !'
          : 'تمت الموافقة على التحويل البنكي وتمديد الاشتراك بنجاح!'
      );
    } else {
      toast.error(
        errMsg || (lang === 'fr' ? 'Échec de la validation' : 'تعذر اعتماد الدفعة في قاعدة البيانات')
      );
    }
  };

  const handleRejectPayment = async (id: string) => {
    setProcessingId(id);
    let success = false;
    let errMsg = '';

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('payments')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (!error) {
          success = true;
        } else {
          errMsg = error.message;
        }
      } catch (e: any) {
        errMsg = e.message || 'Error rejecting payment';
      }
    } else {
      success = true;
    }

    setProcessingId(null);
    if (success) {
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'rejected' as PaymentStatus } : p))
      );
      toast.error(lang === 'fr' ? 'Reçu rejeté' : 'تم رفض الوصل وإشعار المستخدم.');
    } else {
      toast.error(errMsg || (lang === 'fr' ? 'Échec du rejet' : 'تعذر تحديث حالة الوصل'));
    }
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
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 text-start">
        {/* Top 5 Macro Platform Real KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
          <Card className="p-4 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-1.5">
              <span className="text-xs font-bold">إجمالي الحسابات</span>
              <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-ink font-mono">{metrics?.total_accounts ?? accounts.length}</div>
            <span className="text-[10px] text-blue-600 font-bold block mt-0.5">ملاك آليات + مقاولات</span>
          </Card>

          <Card className="p-4 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-1.5">
              <span className="text-xs font-bold">نسبة التفعيل (Activation)</span>
              <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {metrics?.activation_rate_pct ?? 0}%
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
              {metrics?.activated_accounts ?? 0} مالك حقق أول قيمة
            </span>
          </Card>

          <Card className="p-4 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-1.5">
              <span className="text-xs font-bold">وثائق أُصدرت هذا الأسبوع</span>
              <div className="p-1.5 rounded-xl bg-purple-50 text-purple-600">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700 font-mono">{metrics?.docs_this_week ?? 0}</div>
            <span className="text-[10px] text-purple-600 font-bold block mt-0.5">عقود وفواتير ووصولات رسمية</span>
          </Card>

          <Card className="p-4 bg-white border border-steel-200 shadow-soft">
            <div className="flex items-center justify-between text-steel-500 mb-1.5">
              <span className="text-xs font-bold">حجوزات هذا الأسبوع</span>
              <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 font-mono">{metrics?.bookings_this_week ?? 0}</div>
            <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
              حجم: {(metrics?.total_volume_mad ?? 0).toLocaleString('fr-FR')} MAD
            </span>
          </Card>

          <Card className="p-4 bg-white border border-steel-200 shadow-soft col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-steel-500 mb-1.5">
              <span className="text-xs font-bold">الآليات بالأسطول</span>
              <div className="p-1.5 rounded-xl bg-ink text-primary">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-ink font-mono">{metrics?.total_machines ?? allMachines.length}</div>
            <span className="text-[10px] text-steel-500 font-bold block mt-0.5">معروضة للكراء الميداني</span>
          </Card>
        </div>

        {/* Master Tab Bar Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6 border-b border-steel-200">
          {[
            { id: 'accounts', labelAr: '👥 مراقبة وسلطة على كل الحسابات', labelFr: 'Gestion des Comptes', icon: <Users className="w-4 h-4" /> },
            { id: 'machines', labelAr: '🚜 مراقبة أسطول الآليات وسوق المعدات', labelFr: 'Toutes les Machines', icon: <Truck className="w-4 h-4" /> },
            { id: 'bookings', labelAr: '📋 عقود الكراء والعمليات بالأوراش', labelFr: 'Réservations Chantiers', icon: <CalendarCheck className="w-4 h-4" /> },
            { id: 'payments', labelAr: '💳 تدقيق التحويلات والوصولات البنكية', labelFr: 'Validation des Paiements', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'settings', labelAr: '⚙️ إعدادات الدفع والاشتراك (RIB/CIN)', labelFr: 'Paramètres RIB & Tarif', icon: <CreditCard className="w-4 h-4" /> },
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
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم، رقم الهاتف (06/07)، اسم المقاولة، المدينة، أو رقم الـ ICE..."
                    value={searchAccountQuery}
                    onChange={(e) => setSearchAccountQuery(e.target.value)}
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface min-h-[44px]"
                  />
                  <Search className="w-4 h-4 text-steel-400 absolute start-3.5 top-3.5" />
                </div>

                {/* Filter Chips Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-steel-100">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('all');
                      setFilterStatus('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterRole === 'all' && filterStatus === 'all'
                        ? 'bg-ink text-white shadow-xs'
                        : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                    }`}
                  >
                    الكل ({accounts.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('owner');
                      setFilterStatus('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterRole === 'owner' && filterStatus === 'all'
                        ? 'bg-amber-500 text-ink shadow-xs'
                        : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                    }`}
                  >
                    🚜 ملاك الآليات ({accounts.filter((a) => a.role === 'owner').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('client');
                      setFilterStatus('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterRole === 'client' && filterStatus === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                    }`}
                  >
                    🏢 الزبناء والمقاولات ({accounts.filter((a) => a.role === 'client' || a.role === 'contractor').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('driver');
                      setFilterStatus('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterRole === 'driver' && filterStatus === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                    }`}
                  >
                    👷‍♂️ السائقون ({accounts.filter((a) => a.role === 'driver').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('all');
                      setFilterStatus('never_activated');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterStatus === 'never_activated'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    ⚠️ لم يتم التفعيل (Never Activated) ({accounts.filter((a) => !a.activation_at).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('all');
                      setFilterStatus('suspended');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterStatus === 'suspended'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    ⛔ حسابات مجمدة ({accounts.filter((a) => a.is_suspended).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole('all');
                      setFilterStatus('inactive_7d');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterStatus === 'inactive_7d'
                        ? 'bg-steel-800 text-white shadow-xs'
                        : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                    }`}
                  >
                    💤 غير نشط 7+ أيام ({
                      accounts.filter((a) => {
                        if (!a.last_active_at) return true;
                        const date = new Date(a.last_active_at).getTime();
                        return isNaN(date) || date < Date.now() - 7 * 24 * 3600 * 1000;
                      }).length
                    })
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
                        {acc.role === 'owner' ? '🚜' : acc.role === 'driver' ? '👷‍♂️' : '🏢'}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-sm text-ink">{acc.full_name}</h3>
                          <Badge
                            variant={acc.role === 'owner' ? 'warning' : acc.role === 'driver' ? 'success' : 'info'}
                            size="sm"
                            className="font-black"
                          >
                            {acc.role === 'owner'
                              ? 'مالك آليات / مؤجر'
                              : acc.role === 'driver'
                              ? 'سائق آليات ومعدات'
                              : 'زبون / مقاولة'}
                          </Badge>
                          {acc.is_suspended ? (
                            <Badge variant="danger" size="sm" className="font-bold">
                              ⛔ مجمد
                            </Badge>
                          ) : acc.subscription_status === 'active' ? (
                            <Badge variant="success" size="sm" className="font-bold">
                              👑 اشتراك VIP
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" className="font-bold">
                              ⏳ تجربة 72H
                            </Badge>
                          )}

                          {/* Activation Status Badge */}
                          {acc.activation_at ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                              ✓ مفعل (أول قيمة)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                              ⚠️ لم يكتمل التفعيل
                            </span>
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

                        {/* Real Database Metrics per Account */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-steel-500 font-bold">
                          <span>الآليات: <strong className="text-ink font-mono">{acc.machines_count}</strong></span>
                          <span>·</span>
                          <span>الحجوزات: <strong className="text-ink font-mono">{acc.bookings_count}</strong></span>
                          <span>·</span>
                          <span>الوثائق الصادرة: <strong className="text-purple-700 font-mono">{acc.documents_count}</strong></span>
                          <span>·</span>
                          <span>إجمالي الفوترة: <strong className="text-emerald-700 font-mono">{acc.total_volume_mad.toLocaleString('fr-FR')} MAD</strong></span>
                          <span>·</span>
                          <span>آخر نشاط: <strong className="text-steel-700">{acc.last_active_at ? acc.last_active_at.slice(0, 16).replace('T', ' ') : 'لم ينشط بعد'}</strong></span>
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

                      {/* Reset Password */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenResetPassword(acc)}
                        leftIcon={<KeyRound className="w-3.5 h-3.5 text-emerald-700" />}
                        className="text-xs font-bold border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                        title="إعادة تعيين كلمة السر وإرسالها عبر واتساب"
                      >
                        كلمة السر
                      </Button>

                      {/* Suspend / Unsuspend */}
                      {acc.role !== 'admin' && acc.id !== user?.id && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={processingAccountId === acc.id}
                            isLoading={processingAccountId === acc.id}
                            onClick={() => handleToggleSuspend(acc)}
                            className={`text-xs font-bold ${
                              acc.is_suspended
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                                : 'text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            {acc.is_suspended ? 'إلغاء التجميد 🔓' : 'تجميد الحساب ⛔'}
                          </Button>

                          {/* Delete */}
                          <button
                            type="button"
                            disabled={processingAccountId === acc.id}
                            onClick={() => handleOpenDeleteAccount(acc)}
                            className="p-2 rounded-xl text-steel-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="حذف الحساب نهائياً"
                            aria-label="حذف الحساب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
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
                    onClick={() => handlePreviewProof(p.proof_url)}
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

        {/* TAB: SETTINGS & PAYMENT CREDENTIALS (SUPER ADMIN AUTHORITY) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-transparent border border-primary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary text-ink font-black">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-ink">
                    إعدادات الدفع، الـ RIB، والاشتراك الشهري للملاك
                  </h2>
                </div>
                <p className="text-xs text-steel-600 mt-1 max-w-2xl">
                  تعديل بياناتك البنكية، رقم البطاقة الوطنية (CIN)، واسمك، ورقم الواتساب، وسعر الاشتراك (200 درهم). أي تغيير تحفظه ينعكس مباشرة وفورياً على نافذة الدفع والـ Pop-up التي تظهر للملاك عند انتهاء مدتهم التجريبية (72 ساعة).
                </p>
              </div>
              <Badge variant="warning" className="text-xs font-mono font-bold shrink-0">
                مزامنة فورية حية
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Settings Form */}
              <Card className="lg:col-span-7 p-6 bg-white border border-steel-200 shadow-soft">
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  {(!settingsForm.rib_number?.trim() || !settingsForm.whatsapp_number?.trim()) && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        تنبيه قبل الإطلاق: لم يتم بعد إدخال رقم الـ RIB الحقيقي أو رقم واتساب الدعم. أدخل بياناتك الفعلية واضغط حفظ لتظهر لجميع الملاك في المنصة.
                      </span>
                    </div>
                  )}

                  <h3 className="text-sm font-extrabold text-ink border-b border-steel-100 pb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary-dark" />
                    <span>بيانات الحساب البنكي والهوية الوطنية (الظاهرة للملاك)</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Monthly Price */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        سعر الاشتراك الشهري (درهم مغربي)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settingsForm.monthly_price_mad}
                          onChange={(e) => setSettingsForm({ ...settingsForm, monthly_price_mad: Number(e.target.value) || 0 })}
                          required
                          min={0}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                        <span className="absolute end-3 top-2.5 text-xs font-bold text-steel-500">
                          د.م / شهر
                        </span>
                      </div>
                      <p className="text-[10px] text-steel-500 mt-0.5">المبلغ المحدد الحالي هو 200 درهم شهرياً.</p>
                    </div>

                    {/* Trial Duration */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        مدة الفترة التجريبية المجانية (بالساعات)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settingsForm.trial_duration_hours}
                          onChange={(e) => setSettingsForm({ ...settingsForm, trial_duration_hours: Number(e.target.value) || 0 })}
                          required
                          min={1}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                        <span className="absolute end-3 top-2.5 text-xs font-bold text-steel-500">
                          ساعة
                        </span>
                      </div>
                      <p className="text-[10px] text-steel-500 mt-0.5">72 ساعة (3 أيام) لتجربة جميع ميزات المنصة.</p>
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block text-xs font-bold text-steel-700 mb-1">
                      اسم المؤسسة البنكية
                    </label>
                    <input
                      type="text"
                      value={settingsForm.bank_name}
                      onChange={(e) => setSettingsForm({ ...settingsForm, bank_name: e.target.value })}
                      placeholder="مثال: Attijariwafa Bank (التجاري وفا بنك) أو CIH Bank"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                    />
                  </div>

                  {/* RIB Number */}
                  <div>
                    <label className="block text-xs font-bold text-steel-700 mb-1">
                      رقم الـ RIB البنكي (24 رقماً)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.rib_number}
                      onChange={(e) => setSettingsForm({ ...settingsForm, rib_number: e.target.value })}
                      placeholder="أدخل رقم الـ RIB البنكي الحقيقي (24 رقماً)"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-xs font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                    />
                    <p className="text-[10px] text-steel-500 mt-0.5">
                      يُنسخ بنقرة واحدة من قبل المالك عند التحويل من تطبيقه البنكي (CIH Mobile, Attijari Mobile, إلخ).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Account Holder Name */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        الاسم الكامل لصاحب الحساب البنكي
                      </label>
                      <input
                        type="text"
                        value={settingsForm.account_holder_name}
                        onChange={(e) => setSettingsForm({ ...settingsForm, account_holder_name: e.target.value })}
                        placeholder="الاسم العائلي والشخصي"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                      />
                    </div>

                    {/* National ID (CIN) */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        رقم البطاقة الوطنية للتعريف (CIN)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.cin_number}
                        onChange={(e) => setSettingsForm({ ...settingsForm, cin_number: e.target.value.toUpperCase() })}
                        placeholder="رقم البطاقة الوطنية (اختياري لوكالات الكاش)"
                        dir="ltr"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* WhatsApp Helpline */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        رقم الواتساب المباشر لاستقبال وصولات الدفع
                      </label>
                      <input
                        type="text"
                        value={settingsForm.whatsapp_number}
                        onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })}
                        placeholder="+2126XXXXXXXX"
                        required
                        dir="ltr"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                      />
                      <p className="text-[10px] text-steel-500 mt-0.5">
                        يفتح محادثة واتساب فورية مباشرة مع المالك مرفقة ببيانات حسابه.
                      </p>
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-xs font-bold text-steel-700 mb-1">
                        المدينة
                      </label>
                      <input
                        type="text"
                        value={settingsForm.city}
                        onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                        placeholder="Casablanca (الدار البيضاء)"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-steel-100 flex items-center justify-end gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isSavingSettings}
                      leftIcon={<CheckCircle className="w-4 h-4" />}
                      className="font-black px-6 shadow-md"
                    >
                      {isSavingSettings ? 'جاري الحفظ والمزامنة...' : 'حفظ وتطبيق فوراً على جميع الملاك'}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Live Preview Panel (How Owners See It) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-ink flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-primary-dark" />
                    <span>معاينة حية: كيف تظهر النافذة للمالك (Pop-up)</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    معاينة متطابقة 100%
                  </span>
                </div>

                <div className="border-2 border-primary/50 rounded-3xl p-5 bg-white shadow-xl space-y-4 text-start">
                  {/* Mini Pop-up Header */}
                  <div className="p-3 bg-ink text-white rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-danger/20 border border-danger text-danger flex items-center justify-center font-black shrink-0">
                      <Lock className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black">انتهاء المدة التجريبية</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary text-ink font-bold">
                          {settingsForm.trial_duration_hours}h
                        </span>
                      </div>
                      <p className="text-[10px] text-steel-400">
                        قم بتفعيل اشتراكك الشهري لمتابعة استقبال طلبات كراء الآليات
                      </p>
                    </div>
                  </div>

                  {/* Plan Price Highlight */}
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-primary/40 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-ink">اشتراك المالك الاحترافي</span>
                      <p className="text-[10px] text-steel-600">وصول كامل لطلبات الأوراش والمقاولات</p>
                    </div>
                    <div className="text-end font-mono">
                      <span className="text-xl font-black text-ink">{settingsForm.monthly_price_mad}</span>
                      <span className="text-[10px] font-bold text-steel-600 ms-1">د.م / شهر</span>
                    </div>
                  </div>

                  {/* Live RIB Display */}
                  <div className="p-3 rounded-xl bg-surface border border-steel-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-ink">
                      <span>التحويل البنكي المباشر (Virement)</span>
                      <span className="text-[10px] text-steel-500 font-normal">{settingsForm.bank_name}</span>
                    </div>
                    <div className="text-[11px] text-steel-600">
                      المستفيد: <strong>{settingsForm.account_holder_name}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-steel-300 font-mono text-[11px] font-bold flex items-center justify-between">
                      <span className="truncate">{settingsForm.rib_number}</span>
                      <span className="text-[10px] text-primary-dark font-sans px-1.5 py-0.5 bg-primary/10 rounded font-bold shrink-0 ms-1">
                        نسخ RIB
                      </span>
                    </div>
                  </div>

                  {/* Live CIN & Cash */}
                  <div className="p-3 rounded-xl bg-surface border border-steel-200 text-xs space-y-1">
                    <span className="font-extrabold text-ink block text-[11px]">التحويل النقدي (Wafacash / Cash Plus)</span>
                    <div className="text-[11px] text-steel-700">
                      المستفيد: <strong>{settingsForm.account_holder_name}</strong>
                    </div>
                    <div className="text-[11px] text-steel-700">
                      رقم البطاقة الوطنية (CIN): <strong className="font-mono">{settingsForm.cin_number}</strong>
                    </div>
                    <div className="text-[11px] text-steel-700">
                      المدينة: <strong>{settingsForm.city}</strong>
                    </div>
                  </div>

                  {/* ROI Pitch */}
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-bold">
                    💡 عملية كراء واحدة لآلية بـ 2,200 درهم تغطي اشتراكك لأكثر من 10 أشهر!
                  </div>

                  {/* WhatsApp Support CTA */}
                  <div className="p-3 rounded-xl bg-emerald-600 text-white text-center font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                    <Phone className="w-4 h-4" />
                    <span>تأكيد الوصل فوراً عبر واتساب ({settingsForm.whatsapp_number})</span>
                  </div>
                </div>
              </div>
            </div>
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

      {/* Admin Free WhatsApp OTP & Password Reset Modal */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="relative bg-white border border-steel-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-start">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink">
                    مساعدة الحساب (واتساب مجاني 100%)
                  </h3>
                  <p className="text-[11px] text-steel-500">
                    {resetPasswordTarget.full_name} · <span dir="ltr" className="font-mono">{resetPasswordTarget.phone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordTarget(null)}
                className="w-8 h-8 rounded-lg bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2 Free Options Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-steel-100 rounded-xl mt-4">
              <button
                type="button"
                onClick={() => setAdminResetTab('otp')}
                className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  adminResetTab === 'otp' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                }`}
              >
                كود 6 أرقام (مجاناً)
              </button>
              <button
                type="button"
                onClick={() => setAdminResetTab('direct')}
                className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  adminResetTab === 'direct' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                }`}
              >
                كلمة سر جديدة مباشرة
              </button>
            </div>

            {adminResetTab === 'otp' ? (
              <div className="pt-4 space-y-4">
                <p className="text-xs text-steel-600 leading-relaxed">
                  ولّد كود تفعيل من 6 أرقام (صالح 30 دقيقة) وأرسله للزبون في محادثة واتساب مجاناً ليضع كلمة سره بنفسه.
                </p>

                {adminIssuedOtp ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                      <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                        كود إعادة التعيين الجاهز (صالح 30 دقيقة)
                      </span>
                      <span className="text-2xl font-mono font-black tracking-[0.35em] text-ink" dir="ltr">
                        {adminIssuedOtp}
                      </span>
                    </div>
                    {(() => {
                      const waDigits = (resetPasswordTarget.phone || '').replace(/\D/g, '');
                      const waMsg = `مرحباً ${resetPasswordTarget.full_name || ''}،\n🔐 كود إعادة تعيين كلمة المرور لحسابك في منصة JADIJCB هو: *${adminIssuedOtp}*\nادخل إلى "نسيت كلمة المرور؟" واكتب هذا الكود لتعيين كلمة سر جديدة (صالح لمدة 30 دقيقة).`;
                      return (
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(waMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-colors min-h-[46px]"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>إرسال الكود للزبون عبر واتساب</span>
                        </a>
                      );
                    })()}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    isLoading={isResettingPassword}
                    onClick={handleIssueAdminFreeOtp}
                    leftIcon={<KeyRound className="w-4 h-4" />}
                    className="w-full justify-center font-black min-h-[46px]"
                  >
                    توليد كود 6 أرقام الآن
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleConfirmAdminPasswordReset} className="pt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-steel-700">
                      كلمة السر الجديدة (8 أحرف على الأقل)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminNewPassword(generateQuickPassword());
                        setAdminPasswordSaved(false);
                      }}
                      className="text-[11px] font-bold text-primary-dark hover:underline cursor-pointer"
                    >
                      توليد كلمة سر عشوائية
                    </button>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={adminNewPassword}
                    onChange={(e) => {
                      setAdminNewPassword(e.target.value);
                      setAdminPasswordSaved(false);
                    }}
                    placeholder="JCB-123456"
                    className="w-full px-3.5 py-3 rounded-xl border border-steel-300 font-mono text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                    required
                  />
                </div>

                {adminPasswordSaved ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                      ✅ تم تحديث كلمة السر في قاعدة البيانات بنجاح!
                    </div>
                    {(() => {
                      const waDigits = (resetPasswordTarget.phone || '').replace(/\D/g, '');
                      const waMsg = `مرحباً ${resetPasswordTarget.full_name || ''}،\nتم إعادة تعيين كلمة المرور لحسابك في منصة JADIJCB:\n📱 رقم الدخول: ${resetPasswordTarget.phone}\n🔑 كلمة السر الجديدة: ${adminNewPassword.trim()}\nيمكنك تسجيل الدخول الآن وتغييرها في أي وقت.`;
                      return (
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(waMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-colors min-h-[46px]"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>إرسال كلمة السر للزبون عبر واتساب</span>
                        </a>
                      );
                    })()}
                  </div>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isResettingPassword}
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                    className="w-full justify-center font-black min-h-[46px]"
                  >
                    حفظ كلمة السر الجديدة الآن
                  </Button>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Permanent Account Deletion Confirmation Modal */}
      {deleteAccountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="relative bg-white border border-rose-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-start">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink">تأكيد حذف الحساب نهائياً</h3>
                  <p className="text-[11px] text-steel-500">
                    هذا الإجراء لا يمكن التراجع عنه
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setDeleteAccountTarget(null)}
                className="w-8 h-8 rounded-lg bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3.5 rounded-2xl bg-steel-50 border border-steel-200 space-y-1">
                <div className="text-sm font-black text-ink">{deleteAccountTarget.full_name}</div>
                {deleteAccountTarget.company_name && (
                  <div className="text-xs font-bold text-steel-700">{deleteAccountTarget.company_name}</div>
                )}
                <div className="text-xs font-mono font-bold text-steel-600" dir="ltr">
                  {deleteAccountTarget.phone}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 leading-relaxed">
                سيتم حذف الحساب نهائياً من قاعدة البيانات مع جميع آلياته ووثائقه وبيانات تسجيل الدخول. إذا كنت تريد إيقافه مؤقتاً فقط يمكنك استخدام زر «تجميد الحساب».
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-steel-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeletingAccount}
                onClick={() => setDeleteAccountTarget(null)}
                className="font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isDeletingAccount}
                disabled={isDeletingAccount}
                onClick={handleConfirmDeleteAccount}
                leftIcon={<Trash2 className="w-4 h-4" />}
                className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600 font-black"
              >
                نعم، حذف الحساب نهائياً
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
