// ============================================================================
// JADIJCB: Clients Directory Service (/app/clients & /owner/clients)
// Per-Owner Directory, Total Billed, Unpaid Balance, Rental History & Search
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { Client, Booking, BookingPayment } from '../types/database';
import { paymentService } from './paymentService';

const LOCAL_CLIENTS_KEY = 'jadijcb_owner_clients';

export function normalizeClientPhoneKey(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export function doesBookingMatchClient(booking: Booking, client: Pick<Client, 'id' | 'name' | 'phone'> & { linked_profile_id?: string }): boolean {
  if (booking.client_ref_id && booking.client_ref_id === client.id) return true;
  if (client.linked_profile_id && booking.client_id && booking.client_id === client.linked_profile_id) {
    return true;
  }
  const bPhone = normalizeClientPhoneKey(booking.client_phone);
  const cPhone = normalizeClientPhoneKey(client.phone);
  if (bPhone && cPhone && bPhone === cPhone) return true;
  if (
    booking.client_name &&
    client.name &&
    booking.client_name.trim().toLowerCase() === client.name.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export const clientService = {
  getLocalClients(ownerId: string): Client[] {
    try {
      const raw = localStorage.getItem(`${LOCAL_CLIENTS_KEY}_${ownerId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return [];
  },

  saveLocalClients(ownerId: string, clients: Client[], emitEvent: boolean = true) {
    try {
      localStorage.setItem(`${LOCAL_CLIENTS_KEY}_${ownerId}`, JSON.stringify(clients));
      if (emitEvent) {
        window.dispatchEvent(new CustomEvent('jadijcb_clients_updated', { detail: { ownerId, clients } }));
      }
    } catch {
      // Ignore
    }
  },

  async getClients(
    ownerId: string,
    bookings: Booking[] = [],
    payments: BookingPayment[] = []
  ): Promise<Client[]> {
    let clients: Client[] = this.getLocalClients(ownerId);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('owner_id', ownerId)
          .order('name', { ascending: true });

        if (!error && data) {
          const dbClients: Client[] = data.map((c: any) => ({
            id: c.id,
            owner_id: c.owner_id,
            name: c.name,
            phone: c.phone,
            cin_or_ice: c.cin_or_ice || '',
            city: c.city || 'Casablanca',
            notes: c.notes || '',
            created_at: c.created_at,
            updated_at: c.updated_at,
          }));

          // Merge local & DB
          const map = new Map<string, Client>();
          for (const c of clients) map.set(c.id, c);
          for (const c of dbClients) map.set(c.id, c);
          clients = Array.from(map.values());
          this.saveLocalClients(ownerId, clients, false);
        }
      } catch (err) {
        console.warn('Failed to load clients from DB:', err);
      }
    }

    // Compute live metrics from bookings + payments (excluding cancelled bookings from financial dues)
    return clients.map((client) => {
      const clientBookings = bookings.filter((b) => doesBookingMatchClient(b, client));
      const billableBookings = clientBookings.filter((b) => b.status !== 'cancelled');

      let totalBilled = 0;
      let totalPaid = 0;

      for (const b of billableBookings) {
        const price = Number(b.total_price) || 0;
        const stats = paymentService.computeBookingPaymentStats(b, payments);
        const paid = Math.max(stats.paidAmount, Number(b.paid_amount) || 0);
        totalBilled += price;
        totalPaid += Math.min(price > 0 ? price : paid, paid);
      }

      const unpaidBalance = Math.max(0, totalBilled - totalPaid);

      return {
        ...client,
        total_billed: totalBilled,
        unpaid_balance: unpaidBalance,
        rentals_count: clientBookings.length,
      };
    });
  },

  async createClient(ownerId: string, clientData: Omit<Client, 'id' | 'created_at' | 'owner_id'>): Promise<{ success: boolean; client?: Client; error?: string }> {
    const newClient: Client = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      name: clientData.name.trim(),
      phone: clientData.phone.trim(),
      cin_or_ice: clientData.cin_or_ice?.trim() || '',
      city: clientData.city?.trim() || 'Casablanca',
      notes: clientData.notes?.trim() || '',
      total_billed: 0,
      unpaid_balance: 0,
      rentals_count: 0,
      created_at: new Date().toISOString(),
    };

    const current = this.getLocalClients(ownerId);
    this.saveLocalClients(ownerId, [newClient, ...current]);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            id: newClient.id,
            owner_id: ownerId,
            name: newClient.name,
            phone: newClient.phone,
            cin_or_ice: newClient.cin_or_ice,
            city: newClient.city,
            notes: newClient.notes,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('DB client insert notice:', error.message);
        } else if (data) {
          newClient.id = data.id;
        }
      } catch (err) {
        console.warn('createClient DB error:', err);
      }
    }

    return { success: true, client: newClient };
  },

  async updateClient(ownerId: string, id: string, updates: Partial<Client>): Promise<{ success: boolean; error?: string }> {
    const current = this.getLocalClients(ownerId);
    const updated = current.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
    this.saveLocalClients(ownerId, updated);

    if (isSupabaseConfigured && ownerId) {
      try {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.phone) payload.phone = updates.phone;
        if (updates.cin_or_ice !== undefined) payload.cin_or_ice = updates.cin_or_ice;
        if (updates.city) payload.city = updates.city;
        if (updates.notes !== undefined) payload.notes = updates.notes;
        payload.updated_at = new Date().toISOString();

        await supabase.from('clients').update(payload).eq('id', id).eq('owner_id', ownerId);
      } catch (err) {
        console.warn('updateClient DB error:', err);
      }
    }

    return { success: true };
  },

  async deleteClient(ownerId: string, id: string): Promise<{ success: boolean; error?: string }> {
    const current = this.getLocalClients(ownerId);
    const filtered = current.filter((c) => c.id !== id);
    this.saveLocalClients(ownerId, filtered);

    if (isSupabaseConfigured && ownerId) {
      try {
        await supabase.from('clients').delete().eq('id', id).eq('owner_id', ownerId);
      } catch (err) {
        console.warn('deleteClient DB error:', err);
      }
    }

    return { success: true };
  },
};
