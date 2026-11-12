// ============================================================================
// JADIJCB: Centralized Booking Management & Live Sync Store
// Keeps Supabase and local storage in perfect harmony across roles
// ============================================================================

import { Booking, BookingStatus } from '../types/database';
import { supabase } from './supabase';
import { machineStore } from './machineStore';
import { serverApi } from './serverApi';

const CACHE_KEY = 'jadijcb_cached_bookings';

export const bookingStore = {
  // Get all cached bookings (filtering out any fake/seed items)
  getCachedBookings(): Booking[] {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const list: Booking[] = JSON.parse(raw);
      return list.filter((b) => !b.id?.includes('seed') && !b.id?.includes('mock'));
    } catch {
      return [];
    }
  },

  // Fetch from server SQLite DB and update cache
  async fetchServerBookings(ownerId?: string): Promise<Booking[]> {
    try {
      const serverBookings = await serverApi.getBookings({ owner_id: ownerId });
      if (serverBookings && serverBookings.length > 0) {
        const current = this.getCachedBookings();
        const map = new Map<string, Booking>();
        // First current
        for (const b of current) {
          map.set(b.id, b);
        }
        // Then overwrite/merge with server records
        for (const sb of serverBookings) {
          map.set(sb.id, sb);
        }
        const updatedList = Array.from(map.values());
        localStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
        return serverBookings;
      }
    } catch (e) {
      console.warn('fetchServerBookings notice:', e);
    }
    return [];
  },

  // Clear all cached bookings
  clearAllBookings(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'wiped' } }));
    } catch (e) {
      console.warn('Could not clear cached bookings:', e);
    }
  },

  // Save a new booking (Server SQLite DB + Local Cache)
  saveBooking(booking: Booking): void {
    try {
      const current = this.getCachedBookings();
      // Remove any duplicate by id
      const filtered = current.filter((b) => b.id !== booking.id);
      filtered.unshift(booking);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));

      // Asynchronously persist to server SQLite DB (visible across all browsers and devices)
      serverApi.createBooking(booking).catch((err) => {
        console.warn('Could not persist booking to server SQLite DB:', err);
      });

      // Dispatch cross-tab storage event
      const eventPayload = { action: 'created', booking, ts: Date.now() };
      localStorage.setItem('jadijcb_last_booking_event', JSON.stringify(eventPayload));

      // Dispatch event for instant UI reactive update in current tab
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: eventPayload }));
      window.dispatchEvent(new CustomEvent('jadijcb_bookings_updated', { detail: eventPayload }));
    } catch (e) {
      console.warn('Could not cache booking locally:', e);
    }
  },

  // Update booking status
  updateBookingStatus(id: string, newStatus: BookingStatus, notes?: string): void {
    try {
      const current = this.getCachedBookings();
      const updated = current.map((b) => {
        if (b.id === id) {
          return {
            ...b,
            status: newStatus,
            notes: notes !== undefined ? notes : b.notes,
          };
        }
        return b;
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));

      // Asynchronously update on server SQLite DB
      serverApi.updateBookingStatus(id, newStatus, notes).catch((err) => {
        console.warn('Could not update booking status on server SQLite DB:', err);
      });

      const eventPayload = { action: 'updated', id, status: newStatus, ts: Date.now() };
      localStorage.setItem('jadijcb_last_booking_event', JSON.stringify(eventPayload));

      // Dispatch event
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: eventPayload }));
      window.dispatchEvent(new CustomEvent('jadijcb_bookings_updated', { detail: eventPayload }));
    } catch (e) {
      console.warn('Could not update cached booking:', e);
    }
  },

  // Merge Supabase bookings with local cache for Owner
  // Merge Supabase bookings with local cache for Owner
  mergeOwnerBookings(
    supabaseBookings: Booking[],
    ownerId?: string,
    ownerMachineIds: string[] = [],
    isSuperAdmin: boolean = false
  ): Booking[] {
    const cached = this.getCachedBookings();
    const allLocalMachines = machineStore.getCachedMachines();

    const matchingCached = cached.filter((b) => {
      if (isSuperAdmin && !ownerId) return false;
      if (!ownerId) return false;

      // 1. Direct owner ID match
      const isOwner =
        b.owner_id === ownerId ||
        b.owner_id === 'owner' ||
        b.owner_id === 'demo-owner';
      
      // 2. Machine fleet ownership match
      const isMachineOwner = Boolean(b.machine_id && ownerMachineIds.includes(b.machine_id));

      // 3. Embedded machine owner match
      const isEmbeddedMachineOwner = Boolean(
        b.machine && (b.machine.owner_id === ownerId || b.machine.owner?.id === ownerId)
      );

      // 4. Local machine lookup match
      const isLocalMachineMatch = Boolean(
        b.machine_id &&
          allLocalMachines.some(
            (m) => m.id === b.machine_id && (m.owner_id === ownerId || !m.owner_id)
          )
      );

      return isOwner || isMachineOwner || isEmbeddedMachineOwner || isLocalMachineMatch;
    });

    const map = new Map<string, Booking>();
    // First put Supabase bookings
    for (const b of supabaseBookings) {
      const resolvedMachine = b.machine || allLocalMachines.find((m) => m.id === b.machine_id);
      map.set(b.id, { ...b, machine: resolvedMachine });
    }
    // Then merge matching cached bookings (if newer or pending)
    for (const b of matchingCached) {
      const resolvedMachine = b.machine || allLocalMachines.find((m) => m.id === b.machine_id);
      if (!map.has(b.id)) {
        map.set(b.id, { ...b, machine: resolvedMachine });
      } else {
        // If cached has different status, preserve latest
        const existing = map.get(b.id)!;
        if (b.status !== existing.status) {
          map.set(b.id, { ...existing, status: b.status, machine: existing.machine || resolvedMachine });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.created_at || b.start_at || 0).getTime() -
        new Date(a.created_at || a.start_at || 0).getTime()
    );
  },

  // Merge Supabase bookings with local cache for Contractor
  mergeContractorBookings(supabaseBookings: Booking[], clientId: string, clientPhone?: string): Booking[] {
    const cached = this.getCachedBookings();
    const allLocalMachines = machineStore.getCachedMachines();
    const matchingCached = cached.filter((b) => {
      const isClient = b.client_id === clientId;
      const isPhone = clientPhone && b.client_phone === clientPhone;
      return isClient || isPhone;
    });

    const map = new Map<string, Booking>();
    for (const b of supabaseBookings) {
      const resolvedMachine = b.machine || allLocalMachines.find((m) => m.id === b.machine_id);
      map.set(b.id, { ...b, machine: resolvedMachine });
    }
    for (const b of matchingCached) {
      const resolvedMachine = b.machine || allLocalMachines.find((m) => m.id === b.machine_id);
      if (!map.has(b.id)) {
        map.set(b.id, { ...b, machine: resolvedMachine });
      } else {
        const existing = map.get(b.id)!;
        if (b.status !== existing.status) {
          map.set(b.id, { ...existing, status: b.status, machine: existing.machine || resolvedMachine });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  // Count pending bookings for owner
  getPendingCountForOwner(
    ownerId?: string,
    machineIds: string[] = [],
    isSuperAdmin: boolean = false
  ): number {
    const cached = this.getCachedBookings();
    const allLocalMachines = machineStore.getCachedMachines();

    return cached.filter((b) => {
      if (b.status !== 'pending') return false;
      if (isSuperAdmin && !ownerId) return false;
      if (!ownerId) return false;

      const isDirectOwner =
        b.owner_id === ownerId ||
        b.owner_id === 'owner' ||
        b.owner_id === 'demo-owner';
      const isMachineIdMatch = Boolean(b.machine_id && machineIds.includes(b.machine_id));
      const isEmbeddedMatch = Boolean(
        b.machine && (b.machine.owner_id === ownerId || b.machine.owner?.id === ownerId)
      );
      const isLocalMachineMatch = Boolean(
        b.machine_id &&
          allLocalMachines.some(
            (m) => m.id === b.machine_id && (m.owner_id === ownerId || !m.owner_id)
          )
      );
      return isDirectOwner || isMachineIdMatch || isEmbeddedMatch || isLocalMachineMatch;
    }).length;
  },
};
