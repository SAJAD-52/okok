// ============================================================================
// JADIJCB: High-Reliability Server Database API Client
// Direct HTTP Bridge to Express + SQLite backend for Real-Time Synchronization
// ============================================================================

import { Booking, BookingStatus, Machine } from '../types/database';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export interface ServerNotification {
  id: string;
  user_id?: string;
  title_ar: string;
  title_fr: string;
  body_ar: string;
  body_fr: string;
  type: string;
  is_read: boolean;
  read: boolean;
  data: any;
  created_at: string;
}

export const serverApi = {
  // 1. Fetch Bookings from Server SQLite DB
  async getBookings(params?: {
    owner_id?: string;
    machine_id?: string;
    client_id?: string;
    status?: string;
  }): Promise<Booking[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.owner_id) searchParams.set('owner_id', params.owner_id);
      if (params?.machine_id) searchParams.set('machine_id', params.machine_id);
      if (params?.client_id) searchParams.set('client_id', params.client_id);
      if (params?.status) searchParams.set('status', params.status);

      const res = await fetch(`${BASE_URL}/api/bookings?${searchParams.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.bookings) ? data.bookings : [];
    } catch (err) {
      console.warn('Server API getBookings notice:', err);
      return [];
    }
  },

  // 2. Create Booking in Server SQLite DB
  async createBooking(booking: Booking): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || data.message_ar || 'Booking creation failed' };
      }

      return { success: true, booking: data.booking };
    } catch (err: any) {
      console.warn('Server API createBooking notice:', err);
      return { success: false, error: err.message };
    }
  },

  // 3. Update Booking Status (Accept / Decline / Cancel)
  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    notes?: string
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Status update failed' };
      }

      return { success: true, booking: data.booking };
    } catch (err: any) {
      console.warn('Server API updateBookingStatus notice:', err);
      return { success: false, error: err.message };
    }
  },

  // 4. Fetch Notifications from Server SQLite DB
  async getNotifications(params?: {
    user_id?: string;
    unread_only?: boolean;
  }): Promise<{ notifications: ServerNotification[]; unread_count: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.user_id) searchParams.set('user_id', params.user_id);
      if (params?.unread_only) searchParams.set('unread_only', 'true');

      const res = await fetch(`${BASE_URL}/api/notifications?${searchParams.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        unread_count: Number(data.unread_count) || 0,
      };
    } catch (err) {
      console.warn('Server API getNotifications notice:', err);
      return { notifications: [], unread_count: 0 };
    }
  },

  // 5. Mark Notification Read
  async markNotificationRead(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 6. Mark All Notifications Read
  async markAllNotificationsRead(user_id?: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 7. Save Machine to Server
  async saveMachine(machine: Machine): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machine),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 8. Get Machines from Server
  async getMachines(owner_id?: string): Promise<Machine[]> {
    try {
      const searchParams = new URLSearchParams();
      if (owner_id) searchParams.set('owner_id', owner_id);

      const res = await fetch(`${BASE_URL}/api/machines?${searchParams.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.machines) ? data.machines : [];
    } catch {
      return [];
    }
  },
};
