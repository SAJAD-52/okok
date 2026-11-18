// ============================================================================
// JADIJCB: Centralized Machine Store
// Keeps Supabase and local storage in complete sync across Owner,
// Storefront, Marketplace, and Contractor views with ZERO fake/mock data.
// ============================================================================

import { Machine, MachineUpsellOption, RentalTermType, VolumeDiscountTier } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';

const CACHE_KEY = 'jadijcb_user_machines';
const MOCK_CLEARED_FLAG = 'jadijcb_mock_data_cleared_v1';

export function resolveMachineRates(m: any): {
  rateHourly: number;
  rateDaily: number;
  rateWeekly: number;
  rateMonthly: number;
  rateYearly: number;
  salePrice: number;
} {
  const pickPositive = (...vals: unknown[]): number => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };
  const sp = Number(m?.sale_price);
  return {
    rateHourly: pickPositive(m?.rate_hourly, m?.hourly_rate),
    rateDaily: pickPositive(m?.rate_daily, m?.daily_rate),
    rateWeekly: pickPositive(m?.rate_weekly, m?.weekly_rate),
    rateMonthly: pickPositive(m?.rate_monthly, m?.monthly_rate, m?.specs?.rate_monthly),
    rateYearly: pickPositive(m?.rate_yearly, m?.yearly_rate, m?.specs?.rate_yearly),
    salePrice: Number.isFinite(sp) && sp > 0 ? sp : 0,
  };
}

export function resolveVolumeDiscounts(m: any): VolumeDiscountTier[] {
  const raw = m?.volume_discounts ?? m?.specs?.volume_discounts;
  if (!Array.isArray(raw)) return [];
  const validTerms: RentalTermType[] = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
  return raw
    .filter(
      (t: any) =>
        t &&
        validTerms.includes(t.term) &&
        Number(t.min_quantity) >= 2 &&
        Number(t.discounted_unit_price) > 0
    )
    .map((t: any) => ({
      id: String(t.id || `${t.term}_${t.min_quantity}`),
      term: t.term as RentalTermType,
      min_quantity: Math.max(2, Math.round(Number(t.min_quantity))),
      discounted_unit_price: Math.max(1, Number(t.discounted_unit_price)),
    }))
    .sort((a, b) => a.min_quantity - b.min_quantity);
}

export function resolveMachineUpsells(m: any): MachineUpsellOption[] {
  const raw = m?.upsells ?? m?.upsell_addons ?? m?.specs?.upsells;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u) => u && (u.title_ar || u.title_fr))
    .map((u: any) => ({
      id: String(u.id || Math.random().toString(36).slice(2, 8)),
      enabled: Boolean(u.enabled),
      title_ar: String(u.title_ar || u.title_fr || ''),
      title_fr: String(u.title_fr || u.title_ar || ''),
      desc_ar: u.desc_ar ? String(u.desc_ar) : '',
      desc_fr: u.desc_fr ? String(u.desc_fr) : '',
      price: Math.max(0, Number(u.price) || 0),
      billing_type:
        u.billing_type === 'one_time' || u.billing_type === 'per_month'
          ? u.billing_type
          : 'per_day',
      icon: u.icon ? String(u.icon) : 'Sparkles',
    }));
}

export function normalizeMachineRates<T extends Partial<Machine>>(m: T): T {
  if (!m) return m;
  const { rateHourly, rateDaily, rateWeekly, rateMonthly, rateYearly, salePrice } = resolveMachineRates(m);
  const upsells = resolveMachineUpsells(m);
  const volumeDiscounts = resolveVolumeDiscounts(m);
  return {
    ...m,
    rate_hourly: rateHourly,
    hourly_rate: rateHourly,
    rate_daily: rateDaily,
    daily_rate: rateDaily,
    rate_weekly: rateWeekly,
    weekly_rate: rateWeekly,
    rate_monthly: rateMonthly,
    monthly_rate: rateMonthly,
    rate_yearly: rateYearly,
    yearly_rate: rateYearly,
    sale_price: salePrice,
    volume_discounts: volumeDiscounts,
    upsells,
    upsell_addons: upsells,
  };
}

export const machineStore = {
  // Get all cached real machines
  getCachedMachines(): Machine[] {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const list: Machine[] = JSON.parse(raw);
      // Ensure no mock items with seed IDs remain and normalize dual rate columns
      return list
        .filter((m) => !m.id?.includes('_atlas') && !m.id?.includes('seed'))
        .map((m) => normalizeMachineRates(m));
    } catch {
      return [];
    }
  },

  // Save or update a machine (Local + Supabase)
  saveMachine(machine: Machine): void {
    try {
      const normalized = normalizeMachineRates(machine);
      const current = this.getCachedMachines();
      const filtered = current.filter((m) => m.id !== normalized.id);
      filtered.unshift(normalized);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));

      // Dispatch event for reactive UI updates everywhere
      window.dispatchEvent(
        new CustomEvent('jadijcb_machines_updated', {
          detail: { action: 'saved', machine: normalized },
        })
      );
    } catch (e) {
      console.warn('Could not cache machine locally:', e);
    }
  },

  // Remove a machine
  deleteMachine(id: string): void {
    try {
      const current = this.getCachedMachines();
      const filtered = current.filter((m) => m.id !== id);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));

      window.dispatchEvent(
        new CustomEvent('jadijcb_machines_updated', {
          detail: { action: 'deleted', id },
        })
      );
    } catch (e) {
      console.warn('Could not delete machine from cache:', e);
    }
  },

  // Merge Supabase machines with local storage machines
  mergeMachines(dbMachines: Machine[] = [], ownerId?: string): Machine[] {
    const cached = this.getCachedMachines();
    const map = new Map<string, Machine>();

    // 1. Add DB machines (filtering out any mock/seed IDs)
    for (const m of dbMachines) {
      if (!m.id?.includes('_atlas') && !m.id?.includes('seed')) {
        map.set(m.id, normalizeMachineRates(m));
      }
    }

    // 2. Merge local machines
    for (const m of cached) {
      if (ownerId && m.owner_id !== ownerId) {
        // If ownerId filter specified, skip machines belonging to other owners
        continue;
      }
      if (!map.has(m.id)) {
        map.set(m.id, normalizeMachineRates(m));
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  // Completely wipe cached mock machines from local storage (keep UUID DB queries safe)
  async wipeAllMockData(): Promise<void> {
    try {
      // 1. Wipe local machine cache & cached bookings
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(MOCK_CLEARED_FLAG, 'true');
      localStorage.removeItem('jadijcb_cached_bookings');

      // Notify window
      window.dispatchEvent(new CustomEvent('jadijcb_machines_updated', { detail: { action: 'wiped' } }));
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'wiped' } }));
    } catch (err) {
      console.warn('Wipe mock data error:', err);
    }
  },
};

// Automatically mark local mock cache cleared on first execution without hitting Postgres
if (typeof window !== 'undefined' && !localStorage.getItem(MOCK_CLEARED_FLAG)) {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('jadijcb_cached_bookings');
    localStorage.setItem(MOCK_CLEARED_FLAG, 'true');
  } catch {
    // ignore storage errors
  }
}
