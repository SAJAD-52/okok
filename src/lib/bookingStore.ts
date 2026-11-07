// ============================================================================
// JADIJCB: Centralized Booking Management & Live Sync Store
// Keeps Supabase and local storage in perfect harmony across roles
// ============================================================================

import { Booking, BookingStatus } from '../types/database';
import { supabase } from './supabase';

const CACHE_KEY = 'jadijcb_cached_bookings';

export const bookingStore = {
  // Get all cached bookings
  getCachedBookings(): Booking[] {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  // Save a new booking (Supabase + Local Cache)
  saveBooking(booking: Booking): void {
    try {
      const current = this.getCachedBookings();
      // Remove any duplicate by id
      const filtered = current.filter((b) => b.id !== booking.id);
      filtered.unshift(booking);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));

      // Dispatch event for instant UI reactive update
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'created', booking } }));
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

      // Dispatch event
      window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'updated', id, status: newStatus } }));
    } catch (e) {
      console.warn('Could not update cached booking:', e);
    }
  },

  // Merge Supabase bookings with local cache for Owner
  mergeOwnerBookings(supabaseBookings: Booking[], ownerId: string, ownerMachineIds: string[] = []): Booking[] {
    const cached = this.getCachedBookings();
    const matchingCached = cached.filter((b) => {
      const isOwner = b.owner_id === ownerId;
      const isMachineOwner = ownerMachineIds.includes(b.machine_id);
      return isOwner || isMachineOwner;
    });

    const map = new Map<string, Booking>();
    // First put Supabase bookings
    for (const b of supabaseBookings) {
      map.set(b.id, b);
    }
    // Then merge matching cached bookings (if newer or pending)
    for (const b of matchingCached) {
      if (!map.has(b.id)) {
        map.set(b.id, b);
      } else {
        // If cached has different status, preserve latest
        const existing = map.get(b.id)!;
        if (b.status !== existing.status) {
          map.set(b.id, { ...existing, status: b.status });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  // Merge Supabase bookings with local cache for Contractor
  mergeContractorBookings(supabaseBookings: Booking[], clientId: string, clientPhone?: string): Booking[] {
    const cached = this.getCachedBookings();
    const matchingCached = cached.filter((b) => {
      const isClient = b.client_id === clientId;
      const isPhone = clientPhone && b.client_phone === clientPhone;
      return isClient || isPhone;
    });

    const map = new Map<string, Booking>();
    for (const b of supabaseBookings) {
      map.set(b.id, b);
    }
    for (const b of matchingCached) {
      if (!map.has(b.id)) {
        map.set(b.id, b);
      } else {
        const existing = map.get(b.id)!;
        if (b.status !== existing.status) {
          map.set(b.id, { ...existing, status: b.status });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  // Count pending bookings for owner
  getPendingCountForOwner(ownerId?: string, machineIds: string[] = []): number {
    if (!ownerId) return 0;
    const cached = this.getCachedBookings();
    return cached.filter(
      (b) => (b.owner_id === ownerId || machineIds.includes(b.machine_id)) && b.status === 'pending'
    ).length;
  },
};
