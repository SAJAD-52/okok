// ============================================================================
// JADIJCB: Machine Economics, Maintenance & Fleet Accounting (/owner/analytics)
// Revenue, Collected Cash vs Receivables, Expenses, True Profit Margin %,
// Utilization %, Maintenance Alerts, Category Breakdown, Ledger & CSV Export
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
  PlusCircle,
  Clock,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Download,
  UserCheck,
  Percent,
  Wallet,
  RotateCcw,
  Activity,
  FileSpreadsheet,
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
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  Machine,
  Booking,
  MachineExpense,
  BookingPayment,
  ExpenseCategory,
} from '../types/database';
import { bookingStore } from '../lib/bookingStore';
import { expenseStore } from '../lib/expenseStore';
import { machineStore } from '../lib/machineStore';
import { paymentService } from '../lib/paymentService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AddExpenseModal } from '../components/analytics/AddExpenseModal';

type PeriodFilter = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';
type ChartKind = 'area' | 'bar';
type LedgerTab = 'expenses' | 'bookings';

const CATEGORY_META: Record<
  ExpenseCategory,
  { labelAr: string; labelFr: string; color: string; bgClass: string; textClass: string }
> = {
  fuel: {
    labelAr: 'وقود وكازوال',
    labelFr: 'Carburant / Gasoil',
    color: '#D97706',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-800',
  },
  operator: {
    labelAr: 'أجرة وسلفة السائق',
    labelFr: 'Opérateur / Chauffeur',
    color: '#2563EB',
    bgClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-800',
  },
  preventive_service: {
    labelAr: 'صيانة دورية (Vidange)',
    labelFr: 'Entretien périodique',
    color: '#059669',
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-800',
  },
  repair_breakdown: {
    labelAr: 'إصلاح أعطال وقطع غيار',
    labelFr: 'Pannes & Pièces',
    color: '#DC2626',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
  },
  transport: {
    labelAr: 'نقل وديباناج (Porte-char)',
    labelFr: 'Transport / Porte-char',
    color: '#7C3AED',
    bgClass: 'bg-purple-50 border-purple-200',
    textClass: 'text-purple-800',
  },
  insurance_tech: {
    labelAr: 'تأمين وفحص تقني',
    labelFr: 'Assurance & Visite',
    color: '#0D9488',
    bgClass: 'bg-teal-50 border-teal-200',
    textClass: 'text-teal-800',
  },
  other: {
    labelAr: 'مصاريف تشغيل أخرى',
    labelFr: 'Autres charges',
    color: '#64748B',
    bgClass: 'bg-steel-100 border-steel-200',
    textClass: 'text-steel-700',
  },
};

const parseSafeDate = (val?: string | null): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMAD = (value: number): string => `${Math.round(value).toLocaleString('fr-FR')} MAD`;

export const AnalyticsPage: React.FC = () => {
  const { lang, isRTL } = useLanguage();
  const { user, profile, isSuperAdmin, isImpersonating } = useAuth();

  const [period, setPeriod] = useState<PeriodFilter>('this_month');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('all');
  const [chartKind, setChartKind] = useState<ChartKind>('area');
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('bookings');
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<MachineExpense[]>([]);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Expense / Maintenance Modal
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [targetMachineForExpense, setTargetMachineForExpense] = useState<string | undefined>(undefined);

  const ownerId = isImpersonating
    ? profile?.id
    : isSuperAdmin
    ? profile?.id || user?.id
    : user?.id || profile?.id;

  const getMachineDisplayName = useCallback(
    (m?: Partial<Machine> | null): string => {
      if (!m) return lang === 'fr' ? 'Engin' : 'آلية';
      return (lang === 'fr' ? m.title_fr || m.title_ar : m.title_ar || m.title_fr) || `${m.brand || ''} ${m.model || ''}`.trim() || (lang === 'fr' ? 'Engin' : 'آلية');
    },
    [lang]
  );

  const loadData = useCallback(async () => {
    if (!ownerId) {
      setMachines([]);
      setBookings([]);
      setExpenses([]);
      setPayments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Load Owner Machines
      let mList: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data: mData } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', ownerId);
        if (mData) {
          mList = mData.map(
            (m: any) =>
              ({
                id: m.id,
                owner_id: m.owner_id,
                title_ar: m.title_ar,
                title_fr: m.title_fr,
                brand: m.brand || '',
                model: m.model || '',
                year: m.year || new Date().getFullYear(),
                listing_mode: m.listing_mode || 'rent',
                condition: m.condition || 'good',
                city: m.city || '',
                city_id: m.city_id || '',
                daily_rate: Number(m.daily_rate || m.rate_daily) || 0,
                rate_daily: Number(m.rate_daily || m.daily_rate) || 0,
                rate_hourly: Number(m.rate_hourly || m.hourly_rate) || 0,
                rate_weekly: Number(m.rate_weekly || m.weekly_rate) || 0,
                sale_price: Number(m.sale_price) || 0,
                status: m.is_published === false ? 'inactive' : m.status || 'available',
                is_published: m.is_published ?? true,
                images: m.images || [],
                created_at: m.created_at,
              } as Machine)
          );
        }
      }
      const realMachines = machineStore.mergeMachines(mList, ownerId);
      setMachines(realMachines);
      const ownerMachineIds = realMachines.map((m) => m.id).filter(Boolean);

      // 2. Load Owner Bookings (owner_id OR fleet machine ownership + local cache fallback)
      const fetchedMap = new Map<string, Booking>();

      if (isSupabaseConfigured) {
        const { data: ownerData, error: ownerErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('owner_id', ownerId)
          .order('start_at', { ascending: false });

        if (!ownerErr && ownerData) {
          for (const row of ownerData) {
            fetchedMap.set(row.id, {
              id: row.id,
              machine_id: row.machine_id,
              owner_id: row.owner_id,
              client_id: row.client_id,
              client_name: row.client_name,
              client_phone: row.client_phone,
              start_at: row.start_at || row.start_date,
              end_at: row.end_at || row.end_date,
              total_price: Number(row.total_price) || 0,
              deposit_amount: Number(row.deposit_amount) || 0,
              rate_type: row.rate_type || 'daily',
              status: row.status,
              with_operator: Boolean(row.with_operator ?? true),
              notes: row.notes,
              created_at: row.created_at,
              machine: realMachines.find((m) => m.id === row.machine_id),
            });
          }
        }

        if (ownerMachineIds.length > 0) {
          const { data: machineData, error: mErr } = await supabase
            .from('bookings')
            .select('*')
            .in('machine_id', ownerMachineIds)
            .order('start_at', { ascending: false });

          if (!mErr && machineData) {
            for (const row of machineData) {
              if (!fetchedMap.has(row.id)) {
                fetchedMap.set(row.id, {
                  id: row.id,
                  machine_id: row.machine_id,
                  owner_id: row.owner_id,
                  client_id: row.client_id,
                  client_name: row.client_name,
                  client_phone: row.client_phone,
                  start_at: row.start_at || row.start_date,
                  end_at: row.end_at || row.end_date,
                  total_price: Number(row.total_price) || 0,
                  deposit_amount: Number(row.deposit_amount) || 0,
                  rate_type: row.rate_type || 'daily',
                  status: row.status,
                  with_operator: Boolean(row.with_operator ?? true),
                  notes: row.notes,
                  created_at: row.created_at,
                  machine: realMachines.find((m) => m.id === row.machine_id),
                });
              }
            }
          }
        }
      }

      // Only fallback to bookingStore cache if Supabase isn't configured or returned nothing locally created
      if (!isSupabaseConfigured) {
        const localBookings = bookingStore.mergeOwnerBookings([], ownerId, ownerMachineIds, false);
        for (const lb of localBookings) {
          if (!fetchedMap.has(lb.id)) fetchedMap.set(lb.id, lb);
        }
      }

      setBookings(
        Array.from(fetchedMap.values()).sort(
          (a, b) =>
            (parseSafeDate(b.start_at || b.start_date || b.created_at)?.getTime() || 0) -
            (parseSafeDate(a.start_at || a.start_date || a.created_at)?.getTime() || 0)
        )
      );

      // 3. Load Expenses & Maintenance from Supabase + owner cache
      const loadedExpenses = await expenseStore.getExpensesForOwner(ownerId);
      setExpenses(loadedExpenses);

      // 4. Load Payments
      const loadedPayments = await paymentService.getPaymentsForOwner(ownerId);
      setPayments(loadedPayments);
    } catch (err) {
      console.warn('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_bookings_updated', handleUpdate);
    window.addEventListener('jadijcb_expense_event', handleUpdate);
    window.addEventListener('jadijcb_expenses_updated', handleUpdate);
    window.addEventListener('jadijcb_payments_updated', handleUpdate);

    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_bookings_updated', handleUpdate);
      window.removeEventListener('jadijcb_expense_event', handleUpdate);
      window.removeEventListener('jadijcb_expenses_updated', handleUpdate);
      window.removeEventListener('jadijcb_payments_updated', handleUpdate);
    };
  }, [loadData]);

  // Reset filter safely if selected machine no longer exists
  useEffect(() => {
    if (
      selectedMachineFilter !== 'all' &&
      machines.length > 0 &&
      !machines.some((m) => m.id === selectedMachineFilter)
    ) {
      setSelectedMachineFilter('all');
    }
  }, [machines, selectedMachineFilter]);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineFilter) || null,
    [machines, selectedMachineFilter]
  );

  // Date Range Filtering
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const { startDate, endDate, prevStartDate, prevEndDate, daysInPeriod } = useMemo(() => {
    let s = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    let e = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    let ps = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    let pe = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    if (period === 'last_month') {
      s = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      e = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      ps = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
      pe = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59, 999);
    } else if (period === 'last_3_months') {
      s = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
      e = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      ps = new Date(currentYear, currentMonth - 5, 1, 0, 0, 0, 0);
      pe = new Date(currentYear, currentMonth - 2, 0, 23, 59, 59, 999);
    } else if (period === 'this_year') {
      s = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      e = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      ps = new Date(currentYear - 1, 0, 1, 0, 0, 0, 0);
      pe = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
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

  // Machine-Filtered Master Lists (drives ALL KPIs, Charts, Category Breakdown, & Ledger)
  const machineFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      if (selectedMachineFilter !== 'all' && b.machine_id !== selectedMachineFilter) return false;
      return true;
    });
  }, [bookings, selectedMachineFilter]);

  const machineFilteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedMachineFilter !== 'all') {
        return e.machine_id === selectedMachineFilter;
      }
      return true;
    });
  }, [expenses, selectedMachineFilter]);

  // Period-Filtered Bookings & Expenses
  const periodBookings = useMemo(() => {
    return machineFilteredBookings.filter((b) => {
      const bDate = parseSafeDate(b.start_at || b.start_date || b.created_at);
      if (!bDate) return false;
      return bDate >= startDate && bDate <= endDate;
    });
  }, [machineFilteredBookings, startDate, endDate]);

  const prevPeriodBookings = useMemo(() => {
    return machineFilteredBookings.filter((b) => {
      const bDate = parseSafeDate(b.start_at || b.start_date || b.created_at);
      if (!bDate) return false;
      return bDate >= prevStartDate && bDate <= prevEndDate;
    });
  }, [machineFilteredBookings, prevStartDate, prevEndDate]);

  const periodExpenses = useMemo(() => {
    return machineFilteredExpenses.filter((e) => {
      const eDate = parseSafeDate(e.date || e.created_at);
      if (!eDate) return false;
      return eDate >= startDate && eDate <= endDate;
    });
  }, [machineFilteredExpenses, startDate, endDate]);

  const prevPeriodExpenses = useMemo(() => {
    return machineFilteredExpenses.filter((e) => {
      const eDate = parseSafeDate(e.date || e.created_at);
      if (!eDate) return false;
      return eDate >= prevStartDate && eDate <= prevEndDate;
    });
  }, [machineFilteredExpenses, prevStartDate, prevEndDate]);

  // Core Financial KPIs
  const {
    totalRevenue,
    prevRevenue,
    totalExpense,
    prevExpense,
    netProfit,
    netMarginPct,
    expenseRatioPct,
    revenueGrowthPct,
    expenseGrowthPct,
    totalCollected,
    totalReceivables,
    collectionRatePct,
    totalBookedDays,
    totalDowntimeHours,
    fleetUtilizationPct,
    avgBookingValue,
    avgDailyYield,
    generalFleetExpensesTotal,
  } = useMemo(() => {
    const rev = periodBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const pRev = prevPeriodBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

    const exp = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pExp = prevPeriodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const net = rev - exp;
    const margin =
      rev > 0 ? Math.round((net / rev) * 1000) / 10 : exp > 0 ? -100 : 0;
    const expRatio = rev > 0 ? Math.round((exp / rev) * 1000) / 10 : 0;

    const revGrowth = pRev > 0 ? Math.round(((rev - pRev) / pRev) * 100) : null;
    const expGrowth = pExp > 0 ? Math.round(((exp - pExp) / pExp) * 100) : null;

    let collected = 0;
    let bookedDays = 0;

    for (const b of periodBookings) {
      const stats = paymentService.computeBookingPaymentStats(b, payments);
      collected += Math.min(Number(b.total_price) || 0, stats.paidAmount);

      const bStart = parseSafeDate(b.start_at || b.start_date)?.getTime() || 0;
      const bEnd = parseSafeDate(b.end_at || b.end_date)?.getTime() || 0;
      if (bEnd > bStart) {
        bookedDays += Math.max(1, Math.ceil((bEnd - bStart) / (1000 * 3600 * 24)));
      } else {
        bookedDays += 1;
      }
    }

    const receivables = Math.max(0, rev - collected);
    const collRate = rev > 0 ? Math.round((collected / rev) * 100) : 0;

    const downtime = periodExpenses.reduce((sum, e) => sum + (Number(e.downtime_hours) || 0), 0);
    const activeMachinesScope = selectedMachineFilter === 'all' ? Math.max(1, machines.length) : 1;
    const utilization = Math.min(100, Math.round((bookedDays / (daysInPeriod * activeMachinesScope)) * 100));

    const avgTicket = periodBookings.length > 0 ? Math.round(rev / periodBookings.length) : 0;
    const dailyYield = bookedDays > 0 ? Math.round(rev / bookedDays) : 0;

    const generalExp = periodExpenses
      .filter((e) => !e.machine_id)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return {
      totalRevenue: rev,
      prevRevenue: pRev,
      totalExpense: exp,
      prevExpense: pExp,
      netProfit: net,
      netMarginPct: margin,
      expenseRatioPct: expRatio,
      revenueGrowthPct: revGrowth,
      expenseGrowthPct: expGrowth,
      totalCollected: collected,
      totalReceivables: receivables,
      collectionRatePct: collRate,
      totalBookedDays: bookedDays,
      totalDowntimeHours: downtime,
      fleetUtilizationPct: utilization,
      avgBookingValue: avgTicket,
      avgDailyYield: dailyYield,
      generalFleetExpensesTotal: generalExp,
    };
  }, [
    periodBookings,
    prevPeriodBookings,
    periodExpenses,
    prevPeriodExpenses,
    payments,
    machines.length,
    selectedMachineFilter,
    daysInPeriod,
  ]);

  // Expense Category Breakdown (Filtered strictly by selectedMachineFilter + period)
  const expenseCategoryBreakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, { category: ExpenseCategory; amount: number; count: number }>();

    for (const e of periodExpenses) {
      const cat = (e.category && CATEGORY_META[e.category] ? e.category : 'other') as ExpenseCategory;
      const existing = map.get(cat) || { category: cat, amount: 0, count: 0 };
      existing.amount += Number(e.amount) || 0;
      existing.count += 1;
      map.set(cat, existing);
    }

    return Array.from(map.values())
      .map((item) => {
        const meta = CATEGORY_META[item.category];
        return {
          ...item,
          name: lang === 'fr' ? meta.labelFr : meta.labelAr,
          color: meta.color,
          sharePct: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [periodExpenses, totalExpense, lang]);

  // Monthly Chart Data (STRICTLY filtered by selectedMachineFilter!)
  const chartData = useMemo(() => {
    const monthsAr = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليوز',
      'غشت',
      'شتنبر',
      'أكتوبر',
      'نوفمبر',
      'دجنبر',
    ];
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const data: { name: string; revenue: number; expenses: number; profit: number }[] = [];

    if (period === 'this_year') {
      for (let mIdx = 0; mIdx < 12; mIdx++) {
        const mBookings = machineFilteredBookings.filter((b) => {
          const bDate = parseSafeDate(b.start_at || b.start_date || b.created_at);
          return bDate !== null && bDate.getFullYear() === currentYear && bDate.getMonth() === mIdx;
        });

        const mExpenses = machineFilteredExpenses.filter((e) => {
          const eDate = parseSafeDate(e.date || e.created_at);
          return eDate !== null && eDate.getFullYear() === currentYear && eDate.getMonth() === mIdx;
        });

        const rev = mBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
        const exp = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        data.push({
          name: lang === 'fr' ? monthsFr[mIdx] : monthsAr[mIdx],
          revenue: rev,
          expenses: exp,
          profit: rev - exp,
        });
      }
      return data;
    }

    // 6-month window ending at selected period's end month
    const anchorMonth = period === 'last_month' ? currentMonth - 1 : currentMonth;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, anchorMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();

      const mBookings = machineFilteredBookings.filter((b) => {
        const bDate = parseSafeDate(b.start_at || b.start_date || b.created_at);
        return bDate !== null && bDate.getFullYear() === y && bDate.getMonth() === mIdx;
      });

      const mExpenses = machineFilteredExpenses.filter((e) => {
        const eDate = parseSafeDate(e.date || e.created_at);
        return eDate !== null && eDate.getFullYear() === y && eDate.getMonth() === mIdx;
      });

      const rev = mBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
      const exp = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      data.push({
        name: lang === 'fr' ? monthsFr[mIdx] : monthsAr[mIdx],
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      });
    }

    return data;
  }, [machineFilteredBookings, machineFilteredExpenses, currentYear, currentMonth, period, lang]);

  const chartHasAnyActivity = useMemo(
    () => chartData.some((pt) => pt.revenue > 0 || pt.expenses > 0),
    [chartData]
  );

  // Per-Machine Economics Leaderboard (computes full period P&L for every machine in fleet)
  const machineEconomics = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    return machines
      .map((m) => {
        const mBookings = bookings.filter((b) => {
          if (b.status === 'cancelled' || b.machine_id !== m.id) return false;
          const bDate = parseSafeDate(b.start_at || b.start_date || b.created_at);
          return bDate !== null && bDate.getTime() >= startMs && bDate.getTime() <= endMs;
        });

        const mExpenses = expenses.filter((e) => {
          if (e.machine_id !== m.id) return false;
          const eDate = parseSafeDate(e.date || e.created_at);
          return eDate !== null && eDate.getTime() >= startMs && eDate.getTime() <= endMs;
        });

        const mRevenue = mBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
        const mExpense = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const mNet = mRevenue - mExpense;
        const mMarginPct =
          mRevenue > 0 ? Math.round((mNet / mRevenue) * 1000) / 10 : mExpense > 0 ? -100 : 0;

        let mCollected = 0;
        let bookedDays = 0;
        for (const b of mBookings) {
          const stats = paymentService.computeBookingPaymentStats(b, payments);
          mCollected += Math.min(Number(b.total_price) || 0, stats.paidAmount);

          const bStart = parseSafeDate(b.start_at || b.start_date)?.getTime() || 0;
          const bEnd = parseSafeDate(b.end_at || b.end_date)?.getTime() || 0;
          if (bEnd > bStart) {
            bookedDays += Math.max(1, Math.ceil((bEnd - bStart) / (1000 * 3600 * 24)));
          } else {
            bookedDays += 1;
          }
        }

        const utilizationPct = Math.min(100, Math.round((bookedDays / daysInPeriod) * 100));
        const downtimeHours = mExpenses.reduce((sum, e) => sum + (Number(e.downtime_hours) || 0), 0);

        const maintenanceExpenses = expenses
          .filter((e) => e.machine_id === m.id && Boolean(e.next_due_date))
          .sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime());

        const todayFloor = Date.now() - 24 * 3600 * 1000;
        const nextDue =
          maintenanceExpenses.find((e) => new Date(e.next_due_date!).getTime() >= todayFloor)?.next_due_date ||
          maintenanceExpenses[maintenanceExpenses.length - 1]?.next_due_date;
        const isOverdue = nextDue ? new Date(nextDue).getTime() < todayFloor : false;

        return {
          machine: m,
          revenue: mRevenue,
          collected: mCollected,
          expense: mExpense,
          netProfit: mNet,
          marginPct: mMarginPct,
          bookedDays,
          utilizationPct,
          downtimeHours,
          nextDueDate: nextDue,
          isOverdue,
          bookingsCount: mBookings.length,
          expensesCount: mExpenses.length,
        };
      })
      .sort((a, b) => b.netProfit - a.netProfit || b.revenue - a.revenue);
  }, [machines, bookings, expenses, payments, startDate, endDate, daysInPeriod]);

  // Delete expense handler
  const handleDeleteExpense = async (id: string) => {
    await expenseStore.deleteExpense(id);
    setConfirmDeleteExpenseId(null);
    toast.success(lang === 'fr' ? 'Dépense supprimée' : 'تم حذف المصروف بنجاح');
    loadData();
  };

  // Pure JavaScript Client-Side CSV Export (scoped to active filter!)
  const handleExportCSV = () => {
    const sanitize = (text: any) => `"${String(text ?? '').replace(/"/g, '""')}"`;

    let csv = '\uFEFF';
    csv += `--- RAPPORT FINANCIER JADIJCB (${selectedMachine ? getMachineDisplayName(selectedMachine) : 'PARC COMPLET'}) ---\n`;
    csv += `Periode,${startDate.toISOString().slice(0, 10)},${endDate.toISOString().slice(0, 10)}\n`;
    csv += `Chiffre d'affaires (MAD),${totalRevenue}\n`;
    csv += `Encaissements (MAD),${totalCollected}\n`;
    csv += `Creances clients (MAD),${totalReceivables}\n`;
    csv += `Charges & Maintenance (MAD),${totalExpense}\n`;
    csv += `Benefice Net (MAD),${netProfit}\n`;
    csv += `Marge Nette (%),${netMarginPct}%\n\n`;

    csv += '--- REGISTRE DES LOCATIONS & RESERVATIONS ---\n';
    csv += 'ID,Date Debut,Date Fin,Machine,Client,Telephone,Montant Total (MAD),Statut\n';
    for (const b of periodBookings) {
      const mObj = machines.find((m) => m.id === b.machine_id) || b.machine;
      csv +=
        [
          sanitize(b.id),
          sanitize((b.start_at || b.start_date || '').slice(0, 10)),
          sanitize((b.end_at || b.end_date || '').slice(0, 10)),
          sanitize(getMachineDisplayName(mObj)),
          sanitize(b.client_name),
          sanitize(b.client_phone),
          b.total_price || 0,
          sanitize(b.status),
        ].join(',') + '\n';
    }

    csv += '\n--- REGISTRE DES DEPENSES & MAINTENANCE ---\n';
    csv += 'ID Depense,Date,Machine,Categorie,Designation,Fournisseur,Montant (MAD),Arret (h),Heures/Km\n';
    for (const e of periodExpenses) {
      const mObj = machines.find((m) => m.id === e.machine_id) || e.machine;
      csv +=
        [
          sanitize(e.id),
          sanitize(e.date),
          sanitize(e.machine_id ? getMachineDisplayName(mObj) : 'Parc General'),
          sanitize(e.category),
          sanitize(e.title),
          sanitize(e.vendor_name),
          e.amount || 0,
          e.downtime_hours || 0,
          e.hours_or_km || 0,
        ].join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scopeSlug = selectedMachine ? selectedMachine.id.slice(0, 8) : 'parc';
    link.setAttribute('download', `jadijcb_comptabilite_${scopeSlug}_${new Date().toISOString().slice(0, 10)}.csv`);
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

  const periodRangeLabel = `${startDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA')} — ${endDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA')}`;

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
              ? 'Analysez le chiffre d\'affaires, les encaissements, les coûts d\'entretien et le profit net par machine.'
              : 'تحليل شامل للمداخيل، المبالغ المحصلة، تكاليف الصيانة والوقود، ونسبة تشغيل كل آلية بدقة.'}
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
              setTargetMachineForExpense(selectedMachineFilter !== 'all' ? selectedMachineFilter : undefined);
              setIsAddExpenseModalOpen(true);
            }}
            leftIcon={<PlusCircle className="w-4 h-4" />}
            className="font-black text-xs shadow-sm min-h-[44px]"
          >
            {lang === 'fr' ? 'Saisir une charge / entretien' : 'تسجيل صيانة ومصروف'}
          </Button>
        </div>
      </div>

      {/* Period & Machine Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-steel-200">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold pb-1 lg:pb-0">
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
              className={`px-3.5 py-2 min-h-[40px] rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                period === p.id
                  ? 'bg-ink text-primary font-black'
                  : 'bg-steel-50 text-steel-600 hover:text-ink hover:bg-steel-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Machine dropdown filter + Reset */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:flex-initial min-w-[240px]">
            <Truck className={`w-4 h-4 text-primary-dark absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
            <select
              aria-label={lang === 'fr' ? 'Filtrer par engin' : 'تصفية حسب الآلية'}
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              className={`w-full min-h-[42px] py-2 text-xs font-bold rounded-xl border border-steel-300 bg-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer ${
                isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            >
              <option value="all">
                {lang === 'fr'
                  ? `Tous les engins du parc (${machines.length})`
                  : `جميع آليات الأسطول (${machines.length})`}
              </option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMachineDisplayName(m)}
                  {m.brand || m.model ? ` — ${[m.brand, m.model].filter(Boolean).join(' ')}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedMachineFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedMachineFilter('all')}
              className="inline-flex items-center gap-1.5 px-3 min-h-[42px] rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Tout le parc' : 'كل الأسطول'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Scope Indicator Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-steel-50 border border-steel-200 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={selectedMachine ? 'primary' : 'neutral'} size="sm">
            {selectedMachine
              ? lang === 'fr'
                ? 'Analyse ciblée par engin'
                : 'تحليل مخصص لآلية واحدة'
              : lang === 'fr'
              ? 'Vue consolidée du parc'
              : 'تحليل شامل للأسطول'}
          </Badge>
          <span className="font-black text-ink">
            {selectedMachine
              ? `${getMachineDisplayName(selectedMachine)} (${[selectedMachine.brand, selectedMachine.model, selectedMachine.year].filter(Boolean).join(' ')})`
              : lang === 'fr'
              ? `${machines.length} engin(s) enregistrés`
              : `${machines.length} آليات مسجلة في الأسطول`}
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold text-steel-500" dir="ltr">
          {periodRangeLabel}
        </span>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* 4-Card Executive Financial KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* 1. Total Revenue */}
            <div className="p-5 rounded-2xl bg-white border border-steel-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-steel-500">
                  {lang === 'fr' ? 'Chiffre d\'affaires brut' : 'إجمالي المداخيل (الحجوزات)'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-primary/20 text-ink flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-black font-mono tabular-nums text-ink block" dir="ltr">
                {formatMAD(totalRevenue)}
              </span>
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold pt-0.5">
                {revenueGrowthPct !== null ? (
                  <span
                    className={`flex items-center gap-0.5 font-mono tabular-nums ${
                      revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {revenueGrowthPct >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {revenueGrowthPct >= 0 ? `+${revenueGrowthPct}%` : `${revenueGrowthPct}%`}
                    <span className="text-steel-400 font-sans font-medium ms-1">
                      {lang === 'fr' ? 'vs période préc.' : 'عن السابقة'}
                    </span>
                  </span>
                ) : (
                  <span className="text-steel-400 font-medium">
                    {periodBookings.length}{' '}
                    {lang === 'fr' ? 'location(s) sur la période' : 'حجزاً في هذه الفترة'}
                  </span>
                )}
                {avgBookingValue > 0 && (
                  <span className="text-steel-500 font-mono tabular-nums" dir="ltr">
                    Ø {avgBookingValue.toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Cash Collected & Receivables */}
            <div className="p-5 rounded-2xl bg-white border border-steel-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-steel-500">
                  {lang === 'fr' ? 'Encaissements & Créances' : 'التحصيل والمستحقات المتبقية'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-black font-mono tabular-nums text-ink block" dir="ltr">
                {formatMAD(totalCollected)}
              </span>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 rounded-full bg-steel-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${collectionRatePct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-blue-700 font-mono tabular-nums">
                    {collectionRatePct}% {lang === 'fr' ? 'encaissé' : 'محصّل'}
                  </span>
                  <span className="text-amber-700 font-mono tabular-nums" dir="ltr">
                    {lang === 'fr' ? 'Reste:' : 'الباقي:'} {totalReceivables.toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Total Expenses */}
            <div className="p-5 rounded-2xl bg-white border border-steel-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-steel-500">
                  {lang === 'fr' ? 'Charges & Maintenance' : 'المصاريف وتكاليف الصيانة'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-black font-mono tabular-nums text-red-600 block" dir="ltr">
                {formatMAD(totalExpense)}
              </span>
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-steel-500 font-medium">
                  {periodExpenses.length}{' '}
                  {lang === 'fr' ? 'opération(s)' : 'عملية'}
                  {expenseGrowthPct !== null && (
                    <span className={`ms-1.5 font-mono ${expenseGrowthPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ({expenseGrowthPct > 0 ? `+${expenseGrowthPct}%` : `${expenseGrowthPct}%`})
                    </span>
                  )}
                </span>
                {totalRevenue > 0 && (
                  <span className="text-red-700 font-mono tabular-nums">
                    {expenseRatioPct}% {lang === 'fr' ? 'du CA' : 'من المداخيل'}
                  </span>
                )}
              </div>
            </div>

            {/* 4. Net Profit & Real Margin % */}
            <div
              className={`p-5 rounded-2xl border space-y-2.5 ${
                netProfit >= 0
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-red-50/50 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink">
                  {lang === 'fr' ? 'Bénéfice Net d\'exploitation' : 'الربح الصافي المستخلص'}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl text-white flex items-center justify-center ${
                    netProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                >
                  {netProfit >= 0 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </div>
              </div>
              <span
                className={`text-2xl font-black font-mono tabular-nums block ${
                  netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {formatMAD(netProfit)}
              </span>
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span
                  className={`flex items-center gap-1 font-mono tabular-nums ${
                    netMarginPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  {netMarginPct > 0 ? `+${netMarginPct}%` : `${netMarginPct}%`}
                  <span className="font-sans text-steel-600 font-semibold ms-0.5">
                    {lang === 'fr' ? 'Marge nette' : 'هامش الربح الصافي'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Operational Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="px-4 py-3 rounded-xl bg-white border border-steel-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-steel-500 block">
                  {lang === 'fr' ? 'Taux d\'occupation' : 'معدل التشغيل'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-ink">
                  {fleetUtilizationPct}%
                </span>
              </div>
              <Activity className="w-4 h-4 text-primary-dark" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-white border border-steel-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-steel-500 block">
                  {lang === 'fr' ? 'Jours loués cumulés' : 'أيام الكراء الفعلية'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-ink">
                  {totalBookedDays} {lang === 'fr' ? 'j' : 'يوم'}
                </span>
              </div>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-white border border-steel-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-steel-500 block">
                  {lang === 'fr' ? 'Rendement / jour loué' : 'متوسط العائد / يوم'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-emerald-700" dir="ltr">
                  {formatMAD(avgDailyYield)}
                </span>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-white border border-steel-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-steel-500 block">
                  {lang === 'fr' ? 'Temps d\'arrêt (pannes)' : 'ساعات توقف الأعطال'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-ink">
                  {totalDowntimeHours}h
                </span>
              </div>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          {/* Charts Grid: Monthly Comparison + Expense Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Monthly Revenue vs Expenses vs Profit Chart (2 cols) */}
            <Card className="lg:col-span-2 p-6 bg-white border border-steel-200 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary-dark shrink-0" />
                  <div>
                    <h3 className="font-black text-sm text-ink">
                      {lang === 'fr'
                        ? 'Comparatif mensuel : Revenus, Charges et Profit Net'
                        : 'المقارنة الشهرية : المداخيل، المصاريف، وصافي الربح'}
                    </h3>
                    <p className="text-[11px] text-steel-500">
                      {selectedMachine
                        ? `${getMachineDisplayName(selectedMachine)} — ${period === 'this_year' ? (lang === 'fr' ? '12 mois' : '12 شهراً') : (lang === 'fr' ? '6 derniers mois' : 'آخر 6 أشهر')}`
                        : lang === 'fr'
                        ? `Parc consolidé — ${period === 'this_year' ? '12 mois' : '6 derniers mois'}`
                        : `إجمالي الأسطول — ${period === 'this_year' ? '12 شهراً' : 'آخر 6 أشهر'}`}
                    </p>
                  </div>
                </div>

                {/* Area / Bar Switcher */}
                <div className="inline-flex bg-steel-100 p-1 rounded-xl text-[11px] font-bold self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setChartKind('area')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      chartKind === 'area' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                    }`}
                  >
                    {lang === 'fr' ? 'Courbe' : 'منحنى'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartKind('bar')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      chartKind === 'bar' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                    }`}
                  >
                    {lang === 'fr' ? 'Barres' : 'أعمدة'}
                  </button>
                </div>
              </div>

              {!chartHasAnyActivity ? (
                <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center bg-steel-50/70 rounded-xl border border-dashed border-steel-200 p-6 space-y-3">
                  <BarChart3 className="w-8 h-8 text-steel-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-ink">
                      {lang === 'fr'
                        ? 'Aucune donnée financière sur cette fenêtre pour la sélection'
                        : 'لا توجد مداخيل أو مصاريف مسجلة لهذا الاختيار خلال هذه الأشهر'}
                    </p>
                    <p className="text-xs text-steel-500">
                      {selectedMachine
                        ? lang === 'fr'
                          ? 'Ajoutez un entretien/carburant pour cet engin ou revenez à la vue globale.'
                          : 'يمكنك تسجيل مصروف صيانة/وقود لهذه الآلية أو العودة لعرض جميع الآليات.'
                        : lang === 'fr'
                        ? 'Les graphiques se mettront à jour automatiquement dès vos premières réservations ou charges.'
                        : 'سيظهر المبيان تلقائياً بمجرد وجود حجوزات أو مصاريف مسجلة.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setTargetMachineForExpense(
                          selectedMachineFilter !== 'all' ? selectedMachineFilter : undefined
                        );
                        setIsAddExpenseModalOpen(true);
                      }}
                      className="text-xs font-bold"
                    >
                      {lang === 'fr' ? '+ Ajouter une dépense' : '+ تسجيل مصروف'}
                    </Button>
                    {selectedMachineFilter !== 'all' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedMachineFilter('all')}
                        className="text-xs font-bold"
                      >
                        {lang === 'fr' ? 'Voir tout le parc' : 'عرض الأسطول بالكامل'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-64 sm:h-72 w-full pt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartKind === 'area' ? (
                      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFB400" stopOpacity={0.55} />
                            <stop offset="95%" stopColor="#FFB400" stopOpacity={0.04} />
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
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
                          stroke="#D97706"
                          strokeWidth={2.5}
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
                        <Area
                          type="monotone"
                          dataKey="profit"
                          name={lang === 'fr' ? 'Profit net' : 'صافي الربح'}
                          stroke="#10B981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorProfit)"
                        />
                      </AreaChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip
                          formatter={(val: any) => [`${Number(val).toLocaleString('fr-FR')} MAD`]}
                          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar
                          dataKey="revenue"
                          name={lang === 'fr' ? 'Revenus' : 'المداخيل'}
                          fill="#FFB400"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="expenses"
                          name={lang === 'fr' ? 'Dépenses' : 'المصاريف'}
                          fill="#EF4444"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name={lang === 'fr' ? 'Profit net' : 'صافي الربح'}
                          fill="#10B981"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Expense Breakdown by Category (1 col) */}
            <Card className="p-6 bg-white border border-steel-200 rounded-2xl space-y-4 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-primary-dark shrink-0" />
                  <h3 className="font-black text-sm text-ink">
                    {lang === 'fr' ? 'Répartition des charges' : 'توزيع المصاريف حسب الفئة'}
                  </h3>
                </div>
                <p className="text-[11px] text-steel-500">
                  {lang === 'fr'
                    ? 'Ventilation réelle des coûts sur la période'
                    : 'نسب تكاليف الصيانة والوقود والسائقين في الفترة المحددة'}
                </p>
              </div>

              {expenseCategoryBreakdown.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8 bg-steel-50/70 rounded-xl border border-dashed border-steel-200 px-4 space-y-2.5">
                  <Wrench className="w-7 h-7 text-steel-400" />
                  <p className="text-xs font-bold text-steel-600">
                    {lang === 'fr'
                      ? 'Aucune dépense enregistrée sur cette période.'
                      : 'لا توجد مصاريف مسجلة في هذه الفترة.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTargetMachineForExpense(
                        selectedMachineFilter !== 'all' ? selectedMachineFilter : undefined
                      );
                      setIsAddExpenseModalOpen(true);
                    }}
                    className="text-xs font-bold"
                  >
                    {lang === 'fr' ? '+ Saisir un coût' : '+ إضافة مصروف'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="h-44 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCategoryBreakdown}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {expenseCategoryBreakdown.map((entry) => (
                            <Cell key={entry.category} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [`${Number(val).toLocaleString('fr-FR')} MAD`]}
                          contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5">
                    {expenseCategoryBreakdown.map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-bold text-ink truncate">{cat.name}</span>
                          </div>
                          <span className="font-mono tabular-nums font-black text-ink shrink-0" dir="ltr">
                            {cat.amount.toLocaleString('fr-FR')} ({cat.sharePct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-steel-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${cat.sharePct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Per-Machine Economics Leaderboard / Cards */}
          <Card className="p-6 bg-white border border-steel-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-steel-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-dark" />
                <div>
                  <h3 className="font-black text-sm text-ink">
                    {lang === 'fr' ? 'Rentabilité individuelle par engin' : 'الربحية ومعدل الاستغلال لكل آلية'}
                  </h3>
                  <p className="text-[11px] text-steel-500">
                    {lang === 'fr'
                      ? 'Cliquez sur une fiche pour filtrer tout le tableau de bord sur cet engin'
                      : 'انقر على أي آلية لتصفية المبيان وكافة المؤشرات حسب هذه الآلية فقط'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-steel-500">
                {selectedMachineFilter === 'all' && generalFleetExpensesTotal > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-steel-100 text-steel-700 font-mono text-[11px]">
                    {lang === 'fr' ? 'Charges générales:' : 'مصاريف عامة:'}{' '}
                    {formatMAD(generalFleetExpensesTotal)}
                  </span>
                )}
                <span>
                  {machineEconomics.length} {lang === 'fr' ? 'engins analysés' : 'آليات'}
                </span>
              </div>
            </div>

            {machineEconomics.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-steel-500">
                {lang === 'fr'
                  ? 'Aucune machine enregistrée dans votre parc.'
                  : 'لا توجد آليات مسجلة في أسطولك حالياً.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {machineEconomics.map((item) => {
                  const m = item.machine;
                  const isProfitPositive = item.netProfit >= 0;
                  const isSelectedCard = selectedMachineFilter === m.id;

                  return (
                    <div
                      key={m.id}
                      onClick={() =>
                        setSelectedMachineFilter((prev) => (prev === m.id ? 'all' : m.id))
                      }
                      className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 text-xs ${
                        isSelectedCard
                          ? 'border-primary bg-amber-50/30 ring-2 ring-primary/30'
                          : 'border-steel-200 bg-white hover:border-steel-300'
                      }`}
                    >
                      {/* Header: Machine Image + Title + Add Expense Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              m.images?.[0] ||
                              'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=200&q=80'
                            }
                            alt={getMachineDisplayName(m)}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 bg-steel-100"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-ink truncate">
                                {getMachineDisplayName(m)}
                              </h4>
                              {isSelectedCard && (
                                <Badge variant="primary" size="sm">
                                  {lang === 'fr' ? 'Sélectionné' : 'محددة'}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-steel-500 block truncate">
                              {[m.brand, m.model, m.year].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetMachineForExpense(m.id);
                            setIsAddExpenseModalOpen(true);
                          }}
                          className="p-2 min-w-[36px] min-h-[36px] rounded-xl border border-steel-200 hover:border-primary text-steel-600 hover:text-ink hover:bg-steel-50 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                          title={lang === 'fr' ? 'Ajouter une dépense' : 'تسجيل مصروف لهذه الآلية'}
                        >
                          <PlusCircle className="w-4 h-4 text-primary-dark" />
                        </button>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl bg-steel-50 border border-steel-200 text-center">
                        <div>
                          <span className="text-[10px] text-steel-500 block font-medium">
                            {lang === 'fr' ? 'Revenu' : 'المداخيل'}
                          </span>
                          <span className="font-mono tabular-nums font-bold text-ink text-xs block mt-0.5" dir="ltr">
                            {item.revenue.toLocaleString('fr-FR')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-steel-500 block font-medium">
                            {lang === 'fr' ? 'Charges' : 'المصاريف'}
                          </span>
                          <span className="font-mono tabular-nums font-bold text-red-600 text-xs block mt-0.5" dir="ltr">
                            {item.expense.toLocaleString('fr-FR')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-steel-500 block font-medium">
                            {lang === 'fr' ? 'Net (MAD)' : 'الصافي'}
                          </span>
                          <span
                            className={`font-mono tabular-nums font-black text-xs block mt-0.5 ${
                              isProfitPositive ? 'text-emerald-700' : 'text-red-700'
                            }`}
                            dir="ltr"
                          >
                            {item.netProfit.toLocaleString('fr-FR')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-steel-500 block font-medium">
                            {lang === 'fr' ? 'Marge' : 'الهامش'}
                          </span>
                          <span
                            className={`font-mono tabular-nums font-black text-xs block mt-0.5 ${
                              item.marginPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                            dir="ltr"
                          >
                            {item.marginPct}%
                          </span>
                        </div>
                      </div>

                      {/* Utilization & Activity Footer */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-steel-600">
                            {lang === 'fr'
                              ? `Utilisation (${item.bookedDays} j • ${item.bookingsCount} rés.)`
                              : `معدل الاستغلال (${item.bookedDays} يوم • ${item.bookingsCount} حجوزات)`}
                          </span>
                          <span className="font-mono tabular-nums text-primary-dark">
                            {item.utilizationPct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-steel-200 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${item.utilizationPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Next Maintenance Alert */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {item.nextDueDate ? (
                          <div
                            className={`flex-1 flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg border font-medium ${
                              item.isOverdue
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            <span className="flex items-center gap-1 font-bold">
                              <Wrench className="w-3 h-3" />
                              <span>
                                {item.isOverdue
                                  ? lang === 'fr'
                                    ? 'Révision en retard :'
                                    : 'صيانة متأخرة:'
                                  : lang === 'fr'
                                  ? 'Prochaine révision :'
                                  : 'الصيانة القادمة:'}
                              </span>
                            </span>
                            <span className="font-mono font-bold">{item.nextDueDate}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-steel-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>
                              {item.downtimeHours > 0
                                ? lang === 'fr'
                                  ? `Arrêt enregistré : ${item.downtimeHours}h`
                                  : `توقف مسجل: ${item.downtimeHours} ساعة`
                                : lang === 'fr'
                                ? 'Aucune échéance en retard'
                                : 'لا توجد صيانة متأخرة'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Detailed Financial Ledger (Filtered strictly by selectedMachineFilter + period) */}
          <Card className="p-6 bg-white border border-steel-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-steel-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary-dark" />
                <div>
                  <h3 className="font-black text-sm text-ink">
                    {lang === 'fr'
                      ? 'Journal détaillé des opérations'
                      : 'السجل المالي التفصيلي للحجوزات والمصاريف'}
                  </h3>
                  <p className="text-[11px] text-steel-500">
                    {selectedMachine
                      ? lang === 'fr'
                        ? `Filtré sur : ${getMachineDisplayName(selectedMachine)}`
                        : `يعرض فقط عمليات الآلية : ${getMachineDisplayName(selectedMachine)}`
                      : lang === 'fr'
                      ? 'Toutes les opérations de la période sélectionnée'
                      : 'كافة الحجوزات والمصاريف المسجلة في الفترة المحددة'}
                  </p>
                </div>
              </div>

              <div className="inline-flex bg-steel-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setLedgerTab('bookings')}
                  className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                    ledgerTab === 'bookings' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                  }`}
                >
                  {lang === 'fr' ? 'Locations' : 'الحجوزات'} ({periodBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTab('expenses')}
                  className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                    ledgerTab === 'expenses' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                  }`}
                >
                  {lang === 'fr' ? 'Charges & Entretien' : 'المصاريف والصيانة'} ({periodExpenses.length})
                </button>
              </div>
            </div>

            {ledgerTab === 'bookings' ? (
              periodBookings.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-steel-500">
                  {lang === 'fr'
                    ? 'Aucune location enregistrée pour ce filtre.'
                    : 'لا توجد حجوزات مطابقة لهذا الاختيار في هذه الفترة.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-steel-200 text-steel-500">
                        <th className="py-2.5 px-3 font-bold text-start">
                          {lang === 'fr' ? 'Engin' : 'الآلية'}
                        </th>
                        <th className="py-2.5 px-3 font-bold text-start">
                          {lang === 'fr' ? 'Client' : 'الزبون'}
                        </th>
                        <th className="py-2.5 px-3 font-bold text-start">
                          {lang === 'fr' ? 'Dates' : 'الفترة'}
                        </th>
                        <th className="py-2.5 px-3 font-bold text-start">
                          {lang === 'fr' ? 'Statut' : 'الحالة'}
                        </th>
                        <th className="py-2.5 px-3 font-bold text-end">
                          {lang === 'fr' ? 'Total' : 'المبلغ'}
                        </th>
                        <th className="py-2.5 px-3 font-bold text-end">
                          {lang === 'fr' ? 'Encaissé' : 'المحصّل'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-100">
                      {periodBookings.map((b) => {
                        const mObj = machines.find((m) => m.id === b.machine_id) || b.machine;
                        const pStats = paymentService.computeBookingPaymentStats(b, payments);
                        const statusVariant =
                          b.status === 'completed' || b.status === 'confirmed' || b.status === 'active'
                            ? 'success'
                            : 'warning';
                        const statusLabel =
                          lang === 'fr'
                            ? b.status
                            : b.status === 'completed'
                            ? 'مكتمل'
                            : b.status === 'active'
                            ? 'جاري'
                            : b.status === 'confirmed'
                            ? 'مؤكد'
                            : 'قيد الانتظار';

                        return (
                          <tr key={b.id} className="hover:bg-steel-50/60">
                            <td className="py-3 px-3 font-bold text-ink">
                              {getMachineDisplayName(mObj)}
                            </td>
                            <td className="py-3 px-3 text-steel-700 font-medium">
                              {b.client_name || (lang === 'fr' ? 'Client' : 'زبون')}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-steel-500" dir="ltr">
                              {(b.start_at || b.start_date || '').slice(0, 10)} →{' '}
                              {(b.end_at || b.end_date || '').slice(0, 10)}
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant={statusVariant} size="sm">
                                {statusLabel}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums font-black text-ink text-end" dir="ltr">
                              {formatMAD(Number(b.total_price) || 0)}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums font-bold text-emerald-700 text-end" dir="ltr">
                              {formatMAD(pStats.paidAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : periodExpenses.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs font-bold text-steel-500">
                  {lang === 'fr'
                    ? 'Aucune charge ou maintenance enregistrée pour ce filtre.'
                    : 'لا توجد مصاريف أو عمليات صيانة مسجلة لهذا الاختيار في هذه الفترة.'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetMachineForExpense(
                      selectedMachineFilter !== 'all' ? selectedMachineFilter : undefined
                    );
                    setIsAddExpenseModalOpen(true);
                  }}
                  className="text-xs font-bold"
                >
                  {lang === 'fr' ? '+ Enregistrer une dépense' : '+ تسجيل مصروف جديد'}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-steel-200 text-steel-500">
                      <th className="py-2.5 px-3 font-bold text-start">
                        {lang === 'fr' ? 'Date' : 'التاريخ'}
                      </th>
                      <th className="py-2.5 px-3 font-bold text-start">
                        {lang === 'fr' ? 'Engin' : 'الآلية'}
                      </th>
                      <th className="py-2.5 px-3 font-bold text-start">
                        {lang === 'fr' ? 'Catégorie' : 'الفئة'}
                      </th>
                      <th className="py-2.5 px-3 font-bold text-start">
                        {lang === 'fr' ? 'Désignation' : 'البيان'}
                      </th>
                      <th className="py-2.5 px-3 font-bold text-end">
                        {lang === 'fr' ? 'Montant' : 'المبلغ'}
                      </th>
                      <th className="py-2.5 px-3 font-bold text-end">
                        {lang === 'fr' ? 'Action' : 'إجراء'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel-100">
                    {periodExpenses.map((e) => {
                      const mObj = machines.find((m) => m.id === e.machine_id) || e.machine;
                      const catMeta = CATEGORY_META[e.category] || CATEGORY_META.other;
                      const isConfirming = confirmDeleteExpenseId === e.id;

                      return (
                        <tr key={e.id} className="hover:bg-steel-50/60">
                          <td className="py-3 px-3 font-mono tabular-nums text-steel-500" dir="ltr">
                            {e.date}
                          </td>
                          <td className="py-3 px-3 font-bold text-ink">
                            {e.machine_id
                              ? getMachineDisplayName(mObj)
                              : lang === 'fr'
                              ? 'Parc général'
                              : 'مصاريف عامة للأسطول'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${catMeta.bgClass} ${catMeta.textClass}`}
                            >
                              {lang === 'fr' ? catMeta.labelFr : catMeta.labelAr}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-ink block">{e.title}</span>
                            {(e.vendor_name || e.receipt_number || (e.downtime_hours ?? 0) > 0) && (
                              <span className="text-[11px] text-steel-500 block">
                                {[
                                  e.vendor_name,
                                  e.receipt_number ? `#${e.receipt_number}` : '',
                                  (e.downtime_hours ?? 0) > 0 ? `${e.downtime_hours}h` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-black text-red-600 text-end" dir="ltr">
                            {formatMAD(Number(e.amount) || 0)}
                          </td>
                          <td className="py-3 px-3 text-end">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(e.id)}
                                  className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  {lang === 'fr' ? 'Confirmer' : 'حذف'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteExpenseId(null)}
                                  className="px-2 py-1 rounded-lg bg-steel-200 text-steel-700 text-[11px] font-bold cursor-pointer"
                                >
                                  {lang === 'fr' ? 'Non' : 'إلغاء'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteExpenseId(e.id)}
                                className="p-1.5 rounded-lg text-steel-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title={lang === 'fr' ? 'Supprimer' : 'حذف المصروف'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

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
