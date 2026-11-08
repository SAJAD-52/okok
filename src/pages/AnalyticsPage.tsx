// ============================================================================
// JADIJCB: Machine Economics, Maintenance & Fleet Accounting (/owner/analytics)
// Revenue, Expenses, Net Profit, Utilization %, Next Maintenance Due,
// Month vs Previous Month, 6-Month Chart, and Client-Side CSV Export for Accountant
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  Fuel,
  Wrench,
  AlertTriangle,
  Receipt,
  Calendar,
  Filter,
  PlusCircle,
  Clock,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building,
  Download,
  Gauge,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine, Booking, MachineExpense, BookingPayment, ExpenseCategory } from '../types/database';
import { bookingStore } from '../lib/bookingStore';
import { expenseStore } from '../lib/expenseStore';
import { machineStore } from '../lib/machineStore';
import { paymentService } from '../lib/paymentService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AddExpenseModal } from '../components/analytics/AddExpenseModal';

type PeriodFilter = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

export const AnalyticsPage: React.FC = () => {
  const { lang, t, isRTL } = useLanguage();
  const { user, profile } = useAuth();

  const [period, setPeriod] = useState<PeriodFilter>('this_month');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('all');

  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<MachineExpense[]>([]);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Expense / Maintenance Modal
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [targetMachineForExpense, setTargetMachineForExpense] = useState<string | undefined>(undefined);

  const userId = user?.id || profile?.id;

  const loadData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Machines
      let mList: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data: mData } = await supabase.from('machines').select('*').eq('owner_id', userId);
        if (mData) {
          mList = mData.map((m: any) => ({
            id: m.id,
            owner_id: m.owner_id,
            title_ar: m.title_ar,
            title_fr: m.title_fr,
            brand: m.brand,
            model: m.model,
            daily_rate: Number(m.daily_rate) || 2000,
            images: m.images || [],
          } as Machine));
        }
      }
      const realMachines = machineStore.mergeMachines(mList, userId);
      setMachines(realMachines);

      // 2. Bookings
      let bList: Booking[] = [];
      if (isSupabaseConfigured) {
        const { data: bData } = await supabase.from('bookings').select('*').eq('owner_id', userId);
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
            status: b.status,
            with_operator: Boolean(b.with_operator ?? true),
            created_at: b.created_at,
          }));
        }
      }
      const localCached = bookingStore.getCachedBookings().filter((b) => b.owner_id === userId || !b.owner_id);
      const bMap = new Map<string, Booking>();
      for (const b of localCached) bMap.set(b.id, b);
      for (const b of bList) bMap.set(b.id, b);
      setBookings(Array.from(bMap.values()));

      // 3. Expenses & Maintenance
      const loadedExpenses = await expenseStore.getExpenses(userId);
      setExpenses(loadedExpenses);

      // 4. Payments
      const loadedPayments = await paymentService.getPaymentsForOwner(userId);
      setPayments(loadedPayments);
    } catch (err) {
      console.warn('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_expenses_updated', handleUpdate);
    window.addEventListener('jadijcb_payments_updated', handleUpdate);

    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_expenses_updated', handleUpdate);
      window.removeEventListener('jadijcb_payments_updated', handleUpdate);
    };
  }, [loadData]);

  // Date Range Filtering
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const { startDate, endDate, prevStartDate, prevEndDate, daysInPeriod } = useMemo(() => {
    let s = new Date(currentYear, currentMonth, 1);
    let e = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    let ps = new Date(currentYear, currentMonth - 1, 1);
    let pe = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    if (period === 'last_month') {
      s = new Date(currentYear, currentMonth - 1, 1);
      e = new Date(currentYear, currentMonth, 0, 23, 59, 59);
      ps = new Date(currentYear, currentMonth - 2, 1);
      pe = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59);
    } else if (period === 'last_3_months') {
      s = new Date(currentYear, currentMonth - 2, 1);
      e = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      ps = new Date(currentYear, currentMonth - 5, 1);
      pe = new Date(currentYear, currentMonth - 2, 0, 23, 59, 59);
    } else if (period === 'this_year') {
      s = new Date(currentYear, 0, 1);
      e = new Date(currentYear, 11, 31, 23, 59, 59);
      ps = new Date(currentYear - 1, 0, 1);
      pe = new Date(currentYear - 1, 11, 31, 23, 59, 59);
    }

    const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)));
    return {
      startDate: s,
      endDate: e,
      prevStartDate: ps,
      prevEndDate: pe,
      daysInPeriod: diffDays,
    };
  }, [period, currentYear, currentMonth]);

  // Filtered Bookings & Expenses for current period
  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      if (selectedMachineFilter !== 'all' && b.machine_id !== selectedMachineFilter) return false;
      const bDate = new Date(b.start_at || b.created_at || Date.now());
      return bDate >= startDate && bDate <= endDate;
    });
  }, [bookings, startDate, endDate, selectedMachineFilter]);

  const prevPeriodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      if (selectedMachineFilter !== 'all' && b.machine_id !== selectedMachineFilter) return false;
      const bDate = new Date(b.start_at || b.created_at || Date.now());
      return bDate >= prevStartDate && bDate <= prevEndDate;
    });
  }, [bookings, prevStartDate, prevEndDate, selectedMachineFilter]);

  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedMachineFilter !== 'all' && e.machine_id && e.machine_id !== selectedMachineFilter) {
        return false;
      }
      const eDate = new Date(e.date);
      return eDate >= startDate && eDate <= endDate;
    });
  }, [expenses, startDate, endDate, selectedMachineFilter]);

  const prevPeriodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedMachineFilter !== 'all' && e.machine_id && e.machine_id !== selectedMachineFilter) {
        return false;
      }
      const eDate = new Date(e.date);
      return eDate >= prevStartDate && eDate <= prevEndDate;
    });
  }, [expenses, prevStartDate, prevEndDate, selectedMachineFilter]);

  // Totals for current period
  const totalRevenue = useMemo(() => {
    return periodBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
  }, [periodBookings]);

  const prevRevenue = useMemo(() => {
    return prevPeriodBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
  }, [prevPeriodBookings]);

  const totalExpense = useMemo(() => {
    return periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [periodExpenses]);

  const prevExpense = useMemo(() => {
    return prevPeriodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [prevPeriodExpenses]);

  const netProfit = totalRevenue - totalExpense;
  const prevNetProfit = prevRevenue - prevExpense;

  // Comparison Percentages
  const revenueGrowthPct = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const profitGrowthPct = prevNetProfit > 0 ? Math.round(((netProfit - prevNetProfit) / prevNetProfit) * 100) : 0;

  // Per-Machine Economics Dashboard
  const machineEconomics = useMemo(() => {
    return machines.map((m) => {
      const mBookings = periodBookings.filter((b) => b.machine_id === m.id);
      const mExpenses = periodExpenses.filter((e) => e.machine_id === m.id);

      // Revenue: sum of payments if any, else booking total
      const mRevenue = mBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
      const mExpense = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const mNet = mRevenue - mExpense;

      // Calculate days booked
      let bookedDays = 0;
      for (const b of mBookings) {
        const bStart = new Date(b.start_at || b.start_date || '').getTime();
        const bEnd = new Date(b.end_at || b.end_date || '').getTime();
        if (bEnd > bStart) {
          bookedDays += Math.max(1, Math.ceil((bEnd - bStart) / (1000 * 3600 * 24)));
        }
      }
      const utilizationPct = Math.min(100, Math.round((bookedDays / daysInPeriod) * 100));

      // Next maintenance due
      const maintenanceExpenses = expenses.filter(
        (e) => e.machine_id === m.id && e.next_due_date
      );
      maintenanceExpenses.sort(
        (a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime()
      );
      const nextDue = maintenanceExpenses.find(
        (e) => new Date(e.next_due_date!).getTime() >= Date.now() - 24 * 3600 * 1000
      )?.next_due_date;

      return {
        machine: m,
        revenue: mRevenue,
        expense: mExpense,
        netProfit: mNet,
        bookedDays,
        utilizationPct,
        nextDueDate: nextDue,
        bookingsCount: mBookings.length,
        expensesCount: mExpenses.length,
      };
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [machines, periodBookings, periodExpenses, daysInPeriod, expenses]);

  // 6-Month Chart Data
  const chartData = useMemo(() => {
    const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نوفمبر', 'دجنبر'];
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();

      const mBookings = bookings.filter((b) => {
        if (b.status === 'cancelled') return false;
        const bDate = new Date(b.start_at || b.created_at || Date.now());
        return bDate.getFullYear() === y && bDate.getMonth() === mIdx;
      });

      const mExpenses = expenses.filter((e) => {
        const eDate = new Date(e.date);
        return eDate.getFullYear() === y && eDate.getMonth() === mIdx;
      });

      const rev = mBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
      const exp = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const profit = rev - exp;

      data.push({
        name: lang === 'fr' ? monthsFr[mIdx] : monthsAr[mIdx],
        revenue: rev,
        expenses: exp,
        profit: Math.max(0, profit),
      });
    }
    return data;
  }, [bookings, expenses, currentYear, currentMonth, lang]);

  // Pure JavaScript Client-Side CSV Export for Accountant (No external library)
  const handleExportCSV = () => {
    const sanitize = (text: any) => `"${String(text || '').replace(/"/g, '""')}"`;

    // 1. Bookings CSV Section
    let csv = '\uFEFF'; // UTF-8 BOM for Moroccan Excel Arabic/French support
    csv += '--- REGISTRE DES LOCATIONS & RESERVATIONS (JADIJCB) ---\n';
    csv += 'ID,Date Debut,Date Fin,Machine,Client,Telephone,Montant Total (MAD),Statut\n';
    for (const b of bookings) {
      csv += [
        sanitize(b.id),
        sanitize(b.start_at?.slice(0, 10)),
        sanitize(b.end_at?.slice(0, 10)),
        sanitize(b.machine?.title_ar || b.machine?.title_fr || 'Engin'),
        sanitize(b.client_name),
        sanitize(b.client_phone),
        b.total_price || 0,
        sanitize(b.status),
      ].join(',') + '\n';
    }

    csv += '\n--- REGISTRE DES PAIEMENTS RECUS ---\n';
    csv += 'ID Paiement,ID Reservation,Date Paiement,Montant (MAD),Mode de Paiement,Note\n';
    for (const p of payments) {
      csv += [
        sanitize(p.id),
        sanitize(p.booking_id),
        sanitize(p.payment_date),
        p.amount || 0,
        sanitize(p.method),
        sanitize(p.note),
      ].join(',') + '\n';
    }

    csv += '\n--- REGISTRE DES DEPENSES & MAINTENANCE ---\n';
    csv += 'ID Depense,Date,Machine,Categorie,Designation,Fournisseur,Montant (MAD),Heures/Km\n';
    for (const e of expenses) {
      csv += [
        sanitize(e.id),
        sanitize(e.date),
        sanitize(e.machine?.title_ar || 'Parc General'),
        sanitize(e.category),
        sanitize(e.title),
        sanitize(e.vendor_name),
        e.amount || 0,
        e.hours_or_km || 0,
      ].join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jadijcb_comptabilite_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      lang === 'fr'
        ? 'Export comptable CSV généré avec succès !'
        : 'تم تصدير ملف المحاسبة (CSV) بنجاح للمحاسب!'
    );
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Intelligence financière & Rentabilité' : 'المحاسبة والربحية الصافية'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Économie du parc & Entretien des engins' : 'مداخيل ومصاريف وصيانة الأسطول'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Analysez le chiffre d\'affaires, les coûts d\'entretien et le profit net par machine.'
              : 'تحليل تكاليف الصيانة الدورية، الوقود، نسبة تشغيل كل آلية والربح الصافي المستخلص.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
            className="text-xs font-bold border-steel-300 min-h-[44px]"
          >
            {lang === 'fr' ? 'Export Comptable (CSV)' : 'تصدير للمحاسب (CSV)'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setTargetMachineForExpense(undefined);
              setIsAddExpenseModalOpen(true);
            }}
            leftIcon={<PlusCircle className="w-4 h-4" />}
            className="font-black text-xs shadow-sm min-h-[44px]"
          >
            {lang === 'fr' ? '+ Saisir une charge / entretien' : '+ تسجيل صيانة ومصروف'}
          </Button>
        </div>
      </div>

      {/* Period & Machine Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-steel-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          {[
            { id: 'this_month', label: lang === 'fr' ? 'Ce mois' : 'هذا الشهر' },
            { id: 'last_month', label: lang === 'fr' ? 'Mois dernier' : 'الشهر الماضي' },
            { id: 'last_3_months', label: lang === 'fr' ? '3 derniers mois' : 'آخر 3 أشهر' },
            { id: 'this_year', label: lang === 'fr' ? 'Cette année' : 'كامل السنة' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id as PeriodFilter)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                period === p.id
                  ? 'bg-ink text-primary font-black shadow-xs'
                  : 'bg-steel-50 text-steel-600 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Machine dropdown filter */}
        <select
          value={selectedMachineFilter}
          onChange={(e) => setSelectedMachineFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-steel-300 bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{lang === 'fr' ? 'Tous les engins du parc' : 'جميع آليات الأسطول'}</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title_ar} - {m.brand}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards: Revenue vs Expenses vs Net Profit with Growth % */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-steel-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-500">
              {lang === 'fr' ? 'Chiffre d\'affaires brut' : 'إجمالي المداخيل (الكراء)'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-ink flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-ink block">
            {totalRevenue.toLocaleString('fr-FR')} MAD
          </span>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            {revenueGrowthPct >= 0 ? (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{revenueGrowthPct}%
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> {revenueGrowthPct}%
              </span>
            )}
            <span className="text-steel-400">
              {lang === 'fr' ? 'vs période précédente' : 'مقارنة بالفترة السابقة'}
            </span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-5 rounded-2xl bg-white border border-steel-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-500">
              {lang === 'fr' ? 'Charges & Maintenance' : 'المصاريف وتكاليف الصيانة'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-red-600 block">
            {totalExpense.toLocaleString('fr-FR')} MAD
          </span>
          <div className="text-[11px] text-steel-400 font-medium">
            {periodExpenses.length} {lang === 'fr' ? 'opérations enregistrées' : 'عملية صيانة وتشغيل'}
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-5 rounded-2xl bg-white border-2 border-primary/40 shadow-xs space-y-2 bg-gradient-to-br from-amber-500/10 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-ink">
              {lang === 'fr' ? 'Bénéfice Net d\'exploitation' : 'الربح الصافي المستخلص'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-emerald-700 block">
            {netProfit.toLocaleString('fr-FR')} MAD
          </span>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            {profitGrowthPct >= 0 ? (
              <span className="text-emerald-700 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{profitGrowthPct}%
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> {profitGrowthPct}%
              </span>
            )}
            <span className="text-steel-500">
              {lang === 'fr' ? 'Marge nette' : 'هامش الربح الصافي'}
            </span>
          </div>
        </div>
      </div>

      {/* 6-Month Evolution Area Chart */}
      <Card className="p-6 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-dark" />
            <h3 className="font-black text-sm text-ink">
              {lang === 'fr' ? 'Comparatif mensuel : Revenus, Charges et Profit Net' : 'المقارنة الشهرية : المداخيل، المصاريف، وصافي الربح'}
            </h3>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB400" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#FFB400" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toLocaleString('fr-FR')} MAD`]}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                name={lang === 'fr' ? 'Revenus' : 'المداخيل'}
                stroke="#FFB400"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRev)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name={lang === 'fr' ? 'Dépenses' : 'المصاريف'}
                stroke="#EF4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-Machine Economics Table / Cards */}
      <Card className="p-6 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-steel-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-dark" />
            <div>
              <h3 className="font-black text-sm text-ink">
                {lang === 'fr' ? 'Rentabilité individuelle par engin' : 'الربحية ومعدل الاستغلال لكل آلية'}
              </h3>
              <p className="text-[11px] text-steel-500">
                {lang === 'fr'
                  ? 'Revenu brut, coût de maintenance, profit net et taux d\'utilisation calculés'
                  : 'مقارنة المداخيل بتكاليف الصيانة وتحديد الآليات الأكثر ربحية في الأسطول'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-steel-500">
            {machineEconomics.length} {lang === 'fr' ? 'engins analysés' : 'آليات'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machineEconomics.map((item) => {
            const m = item.machine;
            const isProfitPositive = item.netProfit >= 0;

            return (
              <div
                key={m.id}
                className="p-4 rounded-2xl border border-steel-200 bg-white hover:border-steel-300 shadow-xs space-y-3 text-xs"
              >
                {/* Header: Machine Image + Title + Add Expense Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={m.images?.[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=200&q=80'}
                      alt={m.title_ar}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div>
                      <h4 className="font-black text-sm text-ink truncate max-w-[190px]">
                        {m.title_ar}
                      </h4>
                      <span className="text-[11px] text-steel-500">
                        {m.brand} {m.model}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetMachineForExpense(m.id);
                      setIsAddExpenseModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg border border-steel-200 hover:border-primary text-steel-600 hover:text-ink hover:bg-steel-50 transition-colors cursor-pointer"
                    title={lang === 'fr' ? 'Ajouter une dépense' : 'تسجيل مصروف لهذه الآلية'}
                  >
                    <PlusCircle className="w-4 h-4 text-primary-dark" />
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-steel-50 border border-steel-200 text-center">
                  <div>
                    <span className="text-[10px] text-steel-400 block font-medium">
                      {lang === 'fr' ? 'Revenu' : 'المداخيل'}
                    </span>
                    <span className="font-mono font-bold text-ink text-xs block mt-0.5">
                      {item.revenue.toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-steel-400 block font-medium">
                      {lang === 'fr' ? 'Charges' : 'المصاريف'}
                    </span>
                    <span className="font-mono font-bold text-red-600 text-xs block mt-0.5">
                      {item.expense.toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-steel-400 block font-medium">
                      {lang === 'fr' ? 'Net (MAD)' : 'الصافي'}
                    </span>
                    <span
                      className={`font-mono font-black text-xs block mt-0.5 ${
                        isProfitPositive ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {item.netProfit.toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-steel-600">
                      {lang === 'fr' ? 'Taux d\'utilisation' : 'معدل الاستغلال والتشغيل'}
                    </span>
                    <span className="font-mono text-primary-dark">{item.utilizationPct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-steel-200 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${item.utilizationPct}%` }}
                    />
                  </div>
                </div>

                {/* Next Maintenance Alert */}
                {item.nextDueDate ? (
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                    <span className="flex items-center gap-1 font-bold">
                      <Wrench className="w-3 h-3 text-amber-600" />
                      <span>{lang === 'fr' ? 'Prochaine révision :' : 'الصيانة القادمة:'}</span>
                    </span>
                    <span className="font-mono font-bold">{item.nextDueDate}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-steel-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>{lang === 'fr' ? 'Entretiens à jour' : 'الصيانة الدورية محدثة'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        machines={machines}
        defaultMachineId={targetMachineForExpense}
        onExpenseAdded={() => loadData()}
      />
    </div>
  );
};

export default AnalyticsPage;
