// ============================================================================
// JADIJCB: Machine Expenses, P&L and Fleet Costs Data Store
// ============================================================================

import { MachineExpense, ExpenseCategory } from '../types/database';
import { supabase } from './supabase';

const EXPENSES_CACHE_KEY = 'jadijcb_machine_expenses';

const SEED_EXPENSES: MachineExpense[] = [
  {
    id: 'exp_1',
    owner_id: 'default',
    machine_id: 'default',
    category: 'fuel',
    amount: 14500,
    date: '2026-11-01',
    title: 'تزويد كازوال 1200 لتر للورش',
    description: 'ديزل ممتاز لتشغيل الآليات في مشروع تهيئة بوزنيقة',
    vendor_name: 'محطة إفريقيا - بوزنيقة',
    receipt_number: 'FAC-2026-8812',
    downtime_hours: 0,
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_2',
    owner_id: 'default',
    machine_id: 'default',
    category: 'operator',
    amount: 9500,
    date: '2026-10-31',
    title: 'راتب وسلفة السائق (الشهر المنصرم)',
    description: 'أجرة السائق حسن مع مكافأة ساعات العمل الإضافية الميدانية',
    vendor_name: 'السائق: حسن التازي',
    receipt_number: 'REC-OCT-09',
    downtime_hours: 0,
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_3',
    owner_id: 'default',
    machine_id: 'default',
    category: 'preventive_service',
    amount: 4200,
    date: '2026-10-22',
    title: 'صيانة دورية: تبديل زيت وفلاتر هيدروليك (Vidange 500H)',
    description: 'تغيير زيت المحرك 15W40 وفلتر الزيت وفلتر الكازوال وفلتر الهواء',
    vendor_name: 'ورشة الأطلس للآليات الثقيلة - الدار البيضاء',
    receipt_number: 'BL-99120',
    downtime_hours: 4,
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_4',
    owner_id: 'default',
    machine_id: 'default',
    category: 'repair_breakdown',
    amount: 6800,
    date: '2026-10-14',
    title: 'إصلاح عطل أنبوب الضغط الهيدروليكي لذراع الحفر',
    description: 'انفجار أنبوب هيدروليكي عالي الضغط + تلحيم سنون الدلو المتآكلة',
    vendor_name: 'مؤسسة هيدروليك المغرب - عين السبع',
    receipt_number: 'FA-10492',
    downtime_hours: 8,
    created_at: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_5',
    owner_id: 'default',
    machine_id: 'default',
    category: 'transport',
    amount: 3500,
    date: '2026-09-28',
    title: 'نقل الآلية عبر شاحنة بورت-شار (Porte-char)',
    description: 'نقل الآلية من ورش بوسكورة إلى الورش الجديد بالرباط حي الرياض',
    vendor_name: 'شركة سوس للنقل الثقيل',
    receipt_number: 'BL-2026-44',
    downtime_hours: 3,
    created_at: new Date(Date.now() - 39 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_6',
    owner_id: 'default',
    machine_id: 'default',
    category: 'fuel',
    amount: 11800,
    date: '2026-09-15',
    title: 'كازوال ديزل لتشغيل الآلية (1000 لتر)',
    description: 'تزويد ميداني مباشر في موقع الورش بالرباط',
    vendor_name: 'محطة شل - تمارة',
    receipt_number: 'SH-0915',
    downtime_hours: 0,
    created_at: new Date(Date.now() - 52 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'exp_7',
    owner_id: 'default',
    machine_id: 'default',
    category: 'repair_breakdown',
    amount: 8200,
    date: '2026-08-20',
    title: 'تغيير بطاريات المحرك ودينامو الشحن',
    description: 'تركيب 2 بطاريات 120A ماركة Varta + فحص كهرباء المحرك',
    vendor_name: 'إلكتريك كازا للوزن الثقيل',
    receipt_number: 'FAC-0820',
    downtime_hours: 6,
    created_at: new Date(Date.now() - 78 * 24 * 3600 * 1000).toISOString(),
  },
];

export const expenseStore = {
  // Get all cached expenses
  getCachedExpenses(): MachineExpense[] {
    try {
      const raw = localStorage.getItem(EXPENSES_CACHE_KEY);
      if (!raw) {
        localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(SEED_EXPENSES));
        return SEED_EXPENSES;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(SEED_EXPENSES));
        return SEED_EXPENSES;
      }
      return parsed;
    } catch {
      return SEED_EXPENSES;
    }
  },

  // Save new expense
  async saveExpense(expense: MachineExpense): Promise<void> {
    try {
      // 1. Save to local storage
      const current = this.getCachedExpenses();
      const filtered = current.filter((e) => e.id !== expense.id);
      filtered.unshift(expense);
      localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(filtered));

      // 2. Try persisting to Supabase if configured
      try {
        await supabase.from('machine_expenses').insert({
          id: expense.id.startsWith('exp_') ? undefined : expense.id,
          owner_id: expense.owner_id,
          machine_id: expense.machine_id || null,
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
          title: expense.title,
          description: expense.description || '',
          receipt_number: expense.receipt_number || '',
          vendor_name: expense.vendor_name || '',
          downtime_hours: expense.downtime_hours || 0,
        });
      } catch (dbErr) {
        console.warn('Expense DB insert skipped/failed:', dbErr);
      }

      window.dispatchEvent(new CustomEvent('jadijcb_expense_event', { detail: { action: 'created', expense } }));
    } catch (e) {
      console.warn('Error saving expense:', e);
    }
  },

  // Delete expense
  async deleteExpense(id: string): Promise<void> {
    try {
      const current = this.getCachedExpenses();
      const updated = current.filter((e) => e.id !== id);
      localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(updated));

      try {
        await supabase.from('machine_expenses').delete().eq('id', id);
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent('jadijcb_expense_event', { detail: { action: 'deleted', id } }));
    } catch (e) {
      console.warn('Error deleting expense:', e);
    }
  },

  // Fetch and merge expenses for owner
  async getExpensesForOwner(ownerId?: string, machineId?: string): Promise<MachineExpense[]> {
    let dbExpenses: MachineExpense[] = [];
    if (ownerId) {
      try {
        let query = supabase.from('machine_expenses').select('*, machines(*)').eq('owner_id', ownerId);
        if (machineId && machineId !== 'all') {
          query = query.eq('machine_id', machineId);
        }
        const { data, error } = await query.order('date', { ascending: false });
        if (!error && data) {
          dbExpenses = data.map((d: any) => ({
            id: d.id,
            owner_id: d.owner_id,
            machine_id: d.machine_id,
            category: d.category as ExpenseCategory,
            amount: Number(d.amount) || 0,
            date: d.date,
            title: d.title,
            description: d.description,
            receipt_number: d.receipt_number,
            vendor_name: d.vendor_name,
            downtime_hours: Number(d.downtime_hours) || 0,
            created_at: d.created_at,
            machine: d.machines,
          }));
        }
      } catch {
        // ignore
      }
    }

    // Merge with local cached
    const cached = this.getCachedExpenses();
    const map = new Map<string, MachineExpense>();

    for (const d of dbExpenses) {
      map.set(d.id, d);
    }
    for (const c of cached) {
      if (!map.has(c.id)) {
        if (!machineId || machineId === 'all' || c.machine_id === machineId || c.machine_id === 'default') {
          map.set(c.id, c);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },
};
