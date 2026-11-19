// ============================================================================
// JADIJCB: High-Reliability Server Database API Client
// Direct HTTP Bridge to Express + SQLite backend for Real-Time Synchronization
// ============================================================================

import { Booking, BookingStatus, Machine } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Tracks whether Express /api/* backend is actually running (false on Vercel static deploys)
let serverApiProbeState: 'unknown' | 'available' | 'unavailable' = 'unknown';

async function safeFetchApiJson(url: string, init?: RequestInit): Promise<any | null> {
  if (serverApiProbeState === 'unavailable') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      // Static host SPA rewrite (e.g. Vercel returning index.html for /api/*)
      serverApiProbeState = 'unavailable';
      return null;
    }
    if (res.status === 404) {
      serverApiProbeState = 'unavailable';
      return null;
    }
    serverApiProbeState = 'available';
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function isServerBackendAvailable(): Promise<boolean> {
  if (serverApiProbeState === 'available') return true;
  if (serverApiProbeState === 'unavailable') return false;
  const probe = await safeFetchApiJson(`${BASE_URL}/api/notifications?limit=1`);
  return Boolean(probe);
}

async function getAuthHeaders(withJson = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (withJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // ignore session lookup failure
    }
  }
  return headers;
}

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
    if (serverApiProbeState === 'unavailable') return [];
    try {
      const searchParams = new URLSearchParams();
      if (params?.owner_id) searchParams.set('owner_id', params.owner_id);
      if (params?.machine_id) searchParams.set('machine_id', params.machine_id);
      if (params?.client_id) searchParams.set('client_id', params.client_id);
      if (params?.status) searchParams.set('status', params.status);

      const res = await safeFetchApiJson(`${BASE_URL}/api/bookings?${searchParams.toString()}`, {
        headers: await getAuthHeaders(false),
      });
      if (!res || !res.ok) return [];
      return Array.isArray(res.data?.bookings) ? res.data.bookings : [];
    } catch {
      return [];
    }
  },

  // 2. Create Booking in Server SQLite DB
  async createBooking(booking: Booking): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: await getAuthHeaders(true),
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
        headers: await getAuthHeaders(true),
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
    role?: string;
  }): Promise<{ notifications: ServerNotification[]; unread_count: number }> {
    if (serverApiProbeState === 'unavailable') return { notifications: [], unread_count: 0 };
    try {
      const searchParams = new URLSearchParams();
      if (params?.user_id) searchParams.set('user_id', params.user_id);
      if (params?.unread_only) searchParams.set('unread_only', 'true');
      if (params?.role) searchParams.set('role', params.role);

      const res = await safeFetchApiJson(`${BASE_URL}/api/notifications?${searchParams.toString()}`, {
        headers: await getAuthHeaders(false),
      });
      if (!res || !res.ok) return { notifications: [], unread_count: 0 };
      return {
        notifications: Array.isArray(res.data?.notifications) ? res.data.notifications : [],
        unread_count: Number(res.data?.unread_count) || 0,
      };
    } catch {
      return { notifications: [], unread_count: 0 };
    }
  },

  // 5. Mark Notification Read
  async markNotificationRead(id: string): Promise<boolean> {
    if (serverApiProbeState === 'unavailable') return false;
    const res = await safeFetchApiJson(`${BASE_URL}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: await getAuthHeaders(false),
    });
    return Boolean(res?.ok);
  },

  // 6. Mark All Notifications Read
  async markAllNotificationsRead(user_id?: string): Promise<boolean> {
    if (serverApiProbeState === 'unavailable') return false;
    const res = await safeFetchApiJson(`${BASE_URL}/api/notifications/mark-all-read`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify({ user_id }),
    });
    return Boolean(res?.ok);
  },

  // 6b. Mark Chat Conversation Notifications Read
  async markConversationNotificationsRead(user_id: string, conversation_id: string): Promise<boolean> {
    if (serverApiProbeState === 'unavailable') return false;
    const res = await safeFetchApiJson(`${BASE_URL}/api/notifications/mark-conversation-read`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify({ user_id, conversation_id }),
    });
    return Boolean(res?.ok);
  },

  // 7. Save Machine to Server
  async saveMachine(machine: Machine): Promise<boolean> {
    if (serverApiProbeState === 'unavailable') return false;
    const res = await safeFetchApiJson(`${BASE_URL}/api/machines`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(machine),
    });
    return Boolean(res?.ok);
  },

  // 8. Get Machines from Server
  async getMachines(owner_id?: string): Promise<Machine[]> {
    if (serverApiProbeState === 'unavailable') return [];
    const searchParams = new URLSearchParams();
    if (owner_id) searchParams.set('owner_id', owner_id);
    const res = await safeFetchApiJson(`${BASE_URL}/api/machines?${searchParams.toString()}`, {
      headers: await getAuthHeaders(false),
    });
    if (!res || !res.ok) return [];
    return Array.isArray(res.data?.machines) ? res.data.machines : [];
  },

  // 9. Create Custom In-App Notification
  async createNotification(payload: {
    user_id: string;
    title_ar: string;
    title_fr: string;
    body_ar: string;
    body_fr: string;
    type?: string;
    data?: any;
  }): Promise<boolean> {
    if (serverApiProbeState === 'unavailable') return false;
    const res = await safeFetchApiJson(`${BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    });
    return Boolean(res?.ok);
  },

  // 10. Fetch Conversations from Server
  async getConversations(userId?: string): Promise<any[]> {
    if (serverApiProbeState === 'unavailable') return [];
    const searchParams = new URLSearchParams();
    if (userId) searchParams.set('user_id', userId);
    const res = await safeFetchApiJson(`${BASE_URL}/api/conversations?${searchParams.toString()}`, {
      headers: await getAuthHeaders(false),
    });
    if (!res || !res.ok) return [];
    return Array.isArray(res.data?.conversations) ? res.data.conversations : [];
  },

  // 11. Create or Get Conversation on Server
  async createConversation(payload: {
    id?: string;
    machine_id?: string;
    participant_a: string;
    participant_b: string;
    machine?: any;
    target_profile?: any;
  }): Promise<any | null> {
    if (serverApiProbeState === 'unavailable') return null;
    const res = await safeFetchApiJson(`${BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!res || !res.ok) return null;
    return res.data?.conversation || null;
  },

  // 12. Fetch Messages from Server
  async getMessages(conversationId: string): Promise<any[]> {
    if (serverApiProbeState === 'unavailable') return [];
    const res = await safeFetchApiJson(
      `${BASE_URL}/api/messages?conversation_id=${encodeURIComponent(conversationId)}`,
      { headers: await getAuthHeaders(false) }
    );
    if (!res || !res.ok) return [];
    return Array.isArray(res.data?.messages) ? res.data.messages : [];
  },

  // 13. Send Message on Server
  async sendMessage(payload: {
    id?: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    recipient_id?: string;
    sender_name?: string;
    recipient_role?: string;
  }): Promise<any | null> {
    if (serverApiProbeState === 'unavailable') return null;
    const res = await safeFetchApiJson(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!res || !res.ok) return null;
    return res.data?.message || null;
  },

  // 14. Owner-Only: Fetch Scraped Moroccan Public Works Tenders & Schedule Status
  async getPublicTenders(sector?: string): Promise<{
    success: boolean;
    tenders: any[];
    runs: any[];
    lastRun: any | null;
    nextMidnightAt?: string;
    error?: string;
    message_ar?: string;
    message_fr?: string;
  }> {
    try {
      const qs = sector && sector !== 'all' ? `?sector=${encodeURIComponent(sector)}` : '';
      const res = await fetch(`${BASE_URL}/api/tenders${qs}`, {
        headers: await getAuthHeaders(false),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        return { success: false, tenders: [], runs: [], lastRun: null, error: 'BACKEND_UNAVAILABLE' };
      }
      const data = await res.json();
      return {
        success: Boolean(res.ok && data?.success),
        tenders: Array.isArray(data?.tenders) ? data.tenders : [],
        runs: Array.isArray(data?.runs) ? data.runs : [],
        lastRun: data?.lastRun || null,
        nextMidnightAt: data?.nextMidnightAt,
        error: data?.error,
        message_ar: data?.message_ar,
        message_fr: data?.message_fr,
      };
    } catch (err: any) {
      return {
        success: false,
        tenders: [],
        runs: [],
        lastRun: null,
        error: err?.message || 'FETCH_ERROR',
      };
    }
  },

  // 15. Owner-Only: Trigger Immediate Live Moroccan Web & marchespublics.gov.ma Scan
  async triggerPublicTendersScan(params?: {
    sector?: string;
    region?: string;
  }): Promise<{
    success: boolean;
    tenders: any[];
    run?: any;
    newCount?: number;
    updatedCount?: number;
    nextMidnightAt?: string;
    error?: string;
    message_ar?: string;
    message_fr?: string;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75000);
    try {
      const res = await fetch(`${BASE_URL}/api/tenders/scan`, {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({
          sector: params?.sector || 'all',
          region: params?.region || 'all',
        }),
        signal: controller.signal,
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        return {
          success: false,
          tenders: [],
          error: 'BACKEND_UNAVAILABLE',
          message_ar: 'الخادم غير متصل حالياً.',
          message_fr: 'Serveur indisponible.',
        };
      }
      const data = await res.json();
      return {
        success: Boolean(res.ok && data?.success),
        tenders: Array.isArray(data?.tenders) ? data.tenders : [],
        run: data?.run,
        newCount: data?.newCount,
        updatedCount: data?.updatedCount,
        nextMidnightAt: data?.nextMidnightAt,
        error: data?.error,
        message_ar: data?.message_ar,
        message_fr: data?.message_fr,
      };
    } catch (err: any) {
      return {
        success: false,
        tenders: [],
        error: err?.name === 'AbortError' ? 'TIMEOUT' : err?.message || 'SCAN_ERROR',
        message_ar:
          err?.name === 'AbortError'
            ? 'استغرق مسح الويب المغربي وقتاً أطول من المعتاد، أعد المحاولة أو تفقد النتائج بعد قليل.'
            : 'تعذر الاتصال بخدمة مسح الصفقات العمومية.',
        message_fr:
          err?.name === 'AbortError'
            ? 'Le scan a pris plus de temps que prévu, veuillez réessayer.'
            : 'Erreur de connexion au service de scan.',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
