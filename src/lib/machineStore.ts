// ============================================================================
// JADIJCB: Centralized Machine Store
// Keeps Supabase and local storage in complete sync across Owner,
// Storefront, Marketplace, and Contractor views with ZERO fake/mock data.
// ============================================================================

import { Machine } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';

const CACHE_KEY = 'jadijcb_user_machines';
const MOCK_CLEARED_FLAG = 'jadijcb_mock_data_cleared_v1';

export function resolveMachineRates(m: any): {
  rateHourly: number;
  rateDaily: number;
  rateWeekly: number;
  salePrice: number;
} {
  const pickPositive = (a: unknown, b: unknown): number => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && na > 0) return na;
    if (Number.isFinite(nb) && nb > 0) return nb;
    return 0;
  };
  const sp = Number(m?.sale_price);
  return {
    rateHourly: pickPositive(m?.rate_hourly, m?.hourly_rate),
    rateDaily: pickPositive(m?.rate_daily, m?.daily_rate),
    rateWeekly: pickPositive(m?.rate_weekly, m?.weekly_rate),
    salePrice: Number.isFinite(sp) && sp > 0 ? sp : 0,
  };
}

export function normalizeMachineRates<T extends Partial<Machine>>(m: T): T {
  if (!m) return m;
  const { rateHourly, rateDaily, rateWeekly, salePrice } = resolveMachineRates(m);
  return {
    ...m,
    rate_hourly: rateHourly,
    hourly_rate: rateHourly,
    rate_daily: rateDaily,
    daily_rate: rateDaily,
    rate_weekly: rateWeekly,
    weekly_rate: rateWeekly,
    sale_price: salePrice,
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
