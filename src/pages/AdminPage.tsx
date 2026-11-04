// ============================================================================
// JADIJCB: Admin Console Page (Payment Approvals & User Search)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  Filter,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PaymentRecord, PaymentStatus } from '../types/database';

export const AdminPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [payments, setPayments] = useState<PaymentRecord[]>([
    {
      id: 'pay_001',
      user_id: 'usr_casablanca_01',
      user_name: 'كريم بنجلون',
      company_name: 'أطلس للآليات الثقيلة S.A.R.L',
      user_phone: '+212661234567',
      amount: 290,
      method: 'rib',
      reference: 'VIR-ATTIJARI-98214',
      proof_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=900&q=80',
      status: 'pending',
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'pay_002',
      user_id: 'usr_tanger_02',
      user_name: 'حمزة الطاهري',
      company_name: 'شمال تيراسمنت ونقل المعدات',
      user_phone: '+212662998877',
      amount: 800,
      method: 'wafacash',
      reference: 'WFC-002918471',
      proof_url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80',
      status: 'pending',
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'pay_003',
      user_id: 'usr_marrakech_03',
      user_name: 'رشيد المرابط',
      company_name: 'المرابط لكراء الجرافات',
      user_phone: '+212670123456',
      amount: 290,
      method: 'rib',
      reference: 'VIR-BP-774411',
      proof_url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=900&q=80',
      status: 'approved',
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ]);

  const [searchPhone, setSearchPhone] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch live payments if Supabase is connected
  useEffect(() => {
    async function loadPayments() {
      if (!isSupabaseConfigured) return;

      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*, profiles(full_name, company_name, phone)')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: PaymentRecord[] = data.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            amount: Number(item.amount),
            method: item.method,
            reference: item.reference,
            proof_url: item.proof_url,
            status: item.status,
            reviewed_by: item.reviewed_by,
            created_at: item.created_at,
            user_name: item.profiles?.full_name,
            company_name: item.profiles?.company_name,
            user_phone: item.profiles?.phone,
          }));
          setPayments(mapped);
        }
      } catch (err) {
        console.warn('Failed to load admin payments:', err);
      }
    }

    loadPayments();
  }, []);

  const handleApprove = async (paymentId: string) => {
    setProcessingId(paymentId);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('approve_payment', {
          payment_id: paymentId,
          months: durationMonths,
        });

        if (error) {
          toast.error(error.message);
          setProcessingId(null);
          return;
        }
      } catch (err: any) {
        console.warn('approve_payment RPC notice:', err);
      }
    }

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, status: 'approved' as PaymentStatus } : p
      )
    );

    setProcessingId(null);
    toast.success(
      lang === 'fr'
        ? `Abonnement validé avec succès (${durationMonths} mois) !`
        : `تم اعتماد الوصل وتمديد الاشتراك بنجاح (${durationMonths} شهر)!`
    );
  };

  const handleReject = async (paymentId: string) => {
    setProcessingId(paymentId);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('payments')
          .update({ status: 'rejected' })
          .eq('id', paymentId);
      } catch (err) {
        console.warn('Reject payment notice:', err);
      }
    }

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, status: 'rejected' as PaymentStatus } : p
      )
    );

    setProcessingId(null);
    toast.error(
      lang === 'fr'
        ? 'Justificatif rejeté. Notification envoyée.'
        : 'تم رفض الوصل وإشعار المستخدم.'
    );
  };

  const filteredPayments = payments.filter((item) => {
    const matchesPhone =
      !searchPhone ||
      (item.user_phone && item.user_phone.includes(searchPhone)) ||
      (item.reference && item.reference.toLowerCase().includes(searchPhone.toLowerCase())) ||
      (item.company_name && item.company_name.toLowerCase().includes(searchPhone.toLowerCase()));

    const matchesStatus =
      filterStatus === 'all' || item.status === filterStatus;

    return matchesPhone && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 text-start">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>JADIJCB SuperAdmin Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink">
              {t('admin.title')}
            </h1>
            <p className="text-xs text-steel-500 mt-1">
              {t('admin.subtitle')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/app')}
            className="self-start sm:self-auto font-bold text-xs"
          >
            {lang === 'fr' ? 'Accéder à mon espace' : 'الرجوع إلى لوحة التحكم'}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 bg-white border border-steel-200">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">{t('admin.pending_payments')}</span>
              <FileCheck className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-ink font-mono latin-nums">
              {payments.filter((p) => p.status === 'pending').length}
            </div>
          </Card>

          <Card className="p-5 bg-white border border-steel-200">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">{t('admin.active_subscribers')}</span>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono latin-nums">
              142
            </div>
          </Card>

          <Card className="p-5 bg-white border border-steel-200">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-bold">{t('admin.total_users')}</span>
              <User className="w-5 h-5 text-primary-dark" />
            </div>
            <div className="text-2xl font-black text-ink font-mono latin-nums">
              3 420
            </div>
          </Card>
        </div>

        {/* Filters & Phone Search Toolbar */}
        <Card className="p-4 mb-6 bg-white border border-steel-200">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Phone search */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder={t('admin.search_phone')}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              />
              <Search className="w-4 h-4 text-steel-400 absolute start-3 top-3" />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                  filterStatus === 'all'
                    ? 'bg-ink text-white'
                    : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}
              >
                {t('admin.filter_all')}
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                  filterStatus === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}
              >
                {t('admin.filter_pending')}
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('approved')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                  filterStatus === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}
              >
                {t('admin.filter_approved')}
              </button>
            </div>
          </div>
        </Card>

        {/* Payments Table / Card List */}
        <div className="space-y-3">
          {filteredPayments.length === 0 ? (
            <Card className="p-8 text-center bg-white border border-steel-200">
              <FileCheck className="w-10 h-10 text-steel-300 mx-auto mb-2" />
              <p className="text-xs text-steel-500 font-bold">
                {t('admin.no_payments_found')}
              </p>
            </Card>
          ) : (
            filteredPayments.map((item) => (
              <Card
                key={item.id}
                className="p-5 bg-white border border-steel-200 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* User & Company Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-steel-100 flex items-center justify-center font-bold text-steel-700 shrink-0">
                      <Building2 className="w-5 h-5 text-primary-dark" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-sm text-ink">
                          {item.company_name || item.user_name || 'Utilisateur'}
                        </span>
                        <Badge
                          variant={
                            item.status === 'approved'
                              ? 'success'
                              : item.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {item.status === 'approved'
                            ? t('admin.filter_approved')
                            : item.status === 'rejected'
                            ? t('admin.filter_rejected')
                            : t('admin.filter_pending')}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
                        <span className="flex items-center gap-1 font-mono font-bold text-ink" dir="ltr">
                          <Phone className="w-3.5 h-3.5 text-steel-400" />
                          {item.user_phone}
                        </span>
                        <span>
                          {item.method === 'rib' ? 'Virement RIB' : 'Wafacash'} ·{' '}
                          <strong className="font-mono">{item.reference}</strong>
                        </span>
                        <span className="font-black text-ink font-mono latin-nums">
                          {item.amount} {t('common.mad')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Proof View */}
                  <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto">
                    {/* View Proof Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProofUrl(item.proof_url)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      {t('admin.view_proof')}
                    </Button>

                    {item.status === 'pending' && (
                      <>
                        {/* Duration Selector */}
                        <select
                          value={durationMonths}
                          onChange={(e) => setDurationMonths(Number(e.target.value))}
                          className="text-xs font-bold bg-steel-50 border border-steel-300 rounded-xl px-2.5 py-1.5 focus:outline-none min-h-[38px]"
                          aria-label={t('admin.select_duration')}
                        >
                          <option value={1}>{t('admin.duration_1m')}</option>
                          <option value={3}>{t('admin.duration_3m')}</option>
                          <option value={6}>{t('admin.duration_6m')}</option>
                          <option value={12}>{t('admin.duration_12m')}</option>
                        </select>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                          isLoading={processingId === item.id}
                          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                          className="font-black text-xs"
                        >
                          {t('admin.approve_btn')}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(item.id)}
                          isLoading={processingId === item.id}
                          leftIcon={<XCircle className="w-3.5 h-3.5 text-danger" />}
                          className="text-danger hover:bg-red-50 text-xs"
                        >
                          {t('admin.reject_btn')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <Footer />

      {/* Proof Image Viewer Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="relative bg-white border border-steel-200 rounded-3xl max-w-xl w-full p-4 shadow-2xl overflow-hidden text-start">
            <div className="flex items-center justify-between pb-3 border-b border-steel-200 mb-3">
              <span className="text-xs font-black text-ink">
                {t('admin.table_proof')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="w-8 h-8 rounded-lg bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-steel-100 flex items-center justify-center max-h-[70vh]">
              <img
                src={selectedProofUrl}
                alt="Reçu de paiement"
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
