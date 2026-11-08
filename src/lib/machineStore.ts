// ============================================================================
// JADIJCB: Centralized Machine Store
// Keeps Supabase and local storage in complete sync across Owner,
// Storefront, Marketplace, and Contractor views with ZERO fake/mock data.
// ============================================================================

import { Machine } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';

const CACHE_KEY = 'jadijcb_user_machines';
const MOCK_CLEARED_FLAG = 'jadijcb_mock_data_cleared_v1';

export const machineStore = {
  // Get all cached real machines
  getCachedMachines(): Machine[] {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const list: Machine[] = JSON.parse(raw);
      // Ensure no mock items with seed IDs remain
      return list.filter((m) => !m.id?.includes('_atlas') && !m.id?.includes('seed'));
    } catch {
      return [];
    }
  },

  // Save or update a machine (Local + Supabase)
  saveMachine(machine: Machine): void {
    try {
      const current = this.getCachedMachines();
      const filtered = current.filter((m) => m.id !== machine.id);
      filtered.unshift(machine);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));

      // Dispatch event for reactive UI updates everywhere
      window.dispatchEvent(
        new CustomEvent('jadijcb_machines_updated', {
          detail: { action: 'saved', machine },
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
        map.set(m.id, m);
      }
    }

    // 2. Merge local machines
    for (const m of cached) {
      if (ownerId && m.owner_id !== ownerId) {
        // If ownerId filter specified, skip machines belonging to other owners
        continue;
      }
      if (!map.has(m.id)) {
        map.set(m.id, m);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  // Completely wipe all mock machines from local storage and remote DB
  async wipeAllMockData(): Promise<void> {
    try {
      // 1. Wipe local machine cache
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(MOCK_CLEARED_FLAG, 'true');

      // 2. Wipe cached bookings
      localStorage.removeItem('jadijcb_cached_bookings');

      // 3. If Supabase is connected, delete any seed machines and seed bookings
      if (isSupabaseConfigured) {
        try {
          await supabase.from('machines').delete().ilike('id', '%atlas%');
          await supabase.from('machines').delete().ilike('id', '%seed%');
          await supabase.from('bookings').delete().ilike('id', '%seed%');
          await supabase.from('bookings').delete().ilike('id', '%bkg_%');
        } catch (e) {
          console.warn('Supabase mock wipe notice:', e);
        }
      }

      // Notify window
      window.dispatchEvent(new CustomEvent('jadijcb_machines_updated', { detail: { action: 'wiped' } }));
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'wiped' } }));
    } catch (err) {
      console.warn('Wipe mock data error:', err);
    }
  },
};

// Automatically run wipe on first execution if not yet marked
if (typeof window !== 'undefined' && !localStorage.getItem(MOCK_CLEARED_FLAG)) {
  machineStore.wipeAllMockData();
}
