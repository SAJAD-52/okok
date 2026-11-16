// ============================================================================
// JADIJCB: Machine Expenses, P&L and Fleet Costs Data Store
// Zero fake/mock seed data — reads strictly from Supabase + owner cache
// ============================================================================

import { MachineExpense, ExpenseCategory } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';

const EXPENSES_CACHE_KEY = 'jadijcb_machine_expenses';
const LEGACY_SEED_IDS = new Set(['exp_1', 'exp_2', 'exp_3', 'exp_4', 'exp_5', 'exp_6', 'exp_7']);

const isFakeSeedExpense = (e: Partial<MachineExpense> | null | undefined): boolean => {
  if (!e) return true;
  if (e.id && (LEGACY_SEED_IDS.has(e.id) || e.id.includes('seed') || e.id.includes('mock'))) {
    return true;
  }
  if (e.owner_id === 'default' || e.machine_id === 'default') {
    return true;
  }
  return false;
};

const emitExpenseEvents = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('jadijcb_expense_event', { detail }));
  window.dispatchEvent(new CustomEvent('jadijcb_expenses_updated', { detail }));
};

export const expenseStore = {
  // Get all cached real expenses (never re-seeding fake mock rows)
  getCachedExpenses(ownerId?: string): MachineExpense[] {
    try {
      const raw = localStorage.getItem(EXPENSES_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const cleaned = parsed.filter((e) => !isFakeSeedExpense(e)) as MachineExpense[];
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(cleaned));
      }

      if (ownerId) {
        return cleaned.filter((e) => e.owner_id === ownerId);
      }
      return cleaned;
    } catch {
      return [];
    }
  },

  // Save new expense (Local Cache + Supabase DB)
  async saveExpense(expense: MachineExpense): Promise<{ success: boolean; error?: string }> {
    try {
      const normalized: MachineExpense = {
        ...expense,
        machine_id: expense.machine_id && expense.machine_id !== 'general' ? expense.machine_id : '',
        amount: Number(expense.amount) || 0,
        downtime_hours: Number(expense.downtime_hours) || 0,
        hours_or_km: expense.hours_or_km !== undefined ? Number(expense.hours_or_km) : undefined,
      };

      // 1. Save locally for instant reactive feedback / offline resilience
      const current = this.getCachedExpenses();
      const filtered = current.filter((e) => e.id !== normalized.id);
      filtered.unshift(normalized);
      localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(filtered));

      // 2. Persist to Supabase if configured
      if (isSupabaseConfigured && normalized.owner_id && normalized.owner_id !== 'default_owner') {
        const payload: Record<string, unknown> = {
          id: normalized.id,
          owner_id: normalized.owner_id,
          machine_id: normalized.machine_id || null,
          category: normalized.category,
          amount: normalized.amount,
          date: normalized.date,
          title: normalized.title,
          description: normalized.description || '',
          receipt_number: normalized.receipt_number || '',
          vendor_name: normalized.vendor_name || '',
          downtime_hours: normalized.downtime_hours || 0,
          hours_or_km: normalized.hours_or_km ?? 0,
          next_due_date: normalized.next_due_date || null,
          expense_type: normalized.expense_type || 'expense',
        };

        const { error } = await supabase.from('machine_expenses').insert(payload);
        if (error) {
          console.warn('Expense DB insert error:', error.message);
          emitExpenseEvents({ action: 'created', expense: normalized });
          return { success: true, error: error.message };
        }
      }

      emitExpenseEvents({ action: 'created', expense: normalized });
      return { success: true };
    } catch (e: any) {
      console.warn('Error saving expense:', e);
      return { success: false, error: e?.message || 'Error saving expense' };
    }
  },

  // Delete expense
  async deleteExpense(id: string): Promise<void> {
    try {
      const current = this.getCachedExpenses();
      const updated = current.filter((e) => e.id !== id);
      localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(updated));

      if (isSupabaseConfigured) {
        try {
          await supabase.from('machine_expenses').delete().eq('id', id);
        } catch (dbErr) {
          console.warn('Expense DB delete skipped/failed:', dbErr);
        }
      }

      emitExpenseEvents({ action: 'deleted', id });
    } catch (e) {
      console.warn('Error deleting expense:', e);
    }
  },

  // Fetch and merge expenses for owner (Supabase primary + owner-scoped cache fallback)
  async getExpensesForOwner(ownerId?: string, machineId?: string): Promise<MachineExpense[]> {
    let dbExpenses: MachineExpense[] = [];
    let dbFetchSucceeded = false;

    if (isSupabaseConfigured && ownerId) {
      try {
        let query = supabase.from('machine_expenses').select('*, machines(*)').eq('owner_id', ownerId);
        if (machineId && machineId !== 'all') {
          query = query.eq('machine_id', machineId);
        }
        const { data, error } = await query.order('date', { ascending: false });
        if (!error && data) {
          dbFetchSucceeded = true;
          dbExpenses = data.map((d: any) => ({
            id: d.id,
            owner_id: d.owner_id,
            machine_id: d.machine_id || '',
            category: (d.category || 'other') as ExpenseCategory,
            amount: Number(d.amount) || 0,
            date: d.date,
            title: d.title,
            description: d.description || '',
            receipt_number: d.receipt_number || '',
            vendor_name: d.vendor_name || '',
            downtime_hours: Number(d.downtime_hours) || 0,
            hours_or_km: d.hours_or_km !== null && d.hours_or_km !== undefined ? Number(d.hours_or_km) : undefined,
            next_due_date: d.next_due_date || undefined,
            expense_type: d.expense_type || 'expense',
            created_at: d.created_at,
            machine: d.machines || undefined,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch machine_expenses from Supabase:', err);
      }
    }

    const cached = this.getCachedExpenses(ownerId);
    const map = new Map<string, MachineExpense>();

    for (const d of dbExpenses) {
      map.set(d.id, d);
    }

    // Only merge cached records belonging to this owner (or offline unsynced records)
    for (const c of cached) {
      if (!map.has(c.id)) {
        if (dbFetchSucceeded) {
          // If fetching all expenses for owner succeeded, keep only if created very recently (< 10s fallback) or offline;
          // otherwise treat DB as authoritative so deletions from another device sync cleanly.
          const ageMs = Date.now() - new Date(c.created_at || 0).getTime();
          if (ageMs > 15000 && (!machineId || machineId === 'all')) {
            continue;
          }
        }
        if (!machineId || machineId === 'all' || c.machine_id === machineId) {
          map.set(c.id, c);
        }
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Sync cache for full owner list
    if (dbFetchSucceeded && (!machineId || machineId === 'all') && ownerId) {
      try {
        const otherOwners = this.getCachedExpenses().filter((e) => e.owner_id !== ownerId);
        localStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify([...merged, ...otherOwners]));
      } catch {
        // ignore storage quota errors
      }
    }

    return merged;
  },

  async addExpense(expense: MachineExpense): Promise<{ success: boolean; error?: string }> {
    return this.saveExpense(expense);
  },

  getExpenses(ownerId?: string, machineId?: string): MachineExpense[] {
    const list = this.getCachedExpenses(ownerId);
    return list.filter((e) => {
      const matchMachine = !machineId || machineId === 'all' || e.machine_id === machineId;
      return matchMachine;
    });
  },
};
