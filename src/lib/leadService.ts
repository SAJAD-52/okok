// ============================================================================
// JADIJCB: Lead Capture & Storefront Quotes Service (/owner/leads)
// Public quote requests, lead status, direct WhatsApp/Call and inbox
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { Lead } from '../types/database';

const LOCAL_LEADS_KEY = 'jadijcb_leads';

export const leadService = {
  getLocalLeads(ownerId?: string): Lead[] {
    try {
      const raw = localStorage.getItem(LOCAL_LEADS_KEY);
      if (raw) {
        const all: Lead[] = JSON.parse(raw);
        if (ownerId) return all.filter((l) => l.owner_id === ownerId);
        return all;
      }
    } catch {
      // Ignore
    }
    return [];
  },

  saveLocalLeads(leads: Lead[]) {
    try {
      localStorage.setItem(LOCAL_LEADS_KEY, JSON.stringify(leads));
      window.dispatchEvent(new CustomEvent('jadijcb_leads_updated', { detail: leads }));
    } catch {
      // Ignore
    }
  },

  async getLeadsForOwner(ownerId: string): Promise<Lead[]> {
    let leads = this.getLocalLeads(ownerId);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*, machines(*)')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const dbLeads: Lead[] = data.map((l: any) => ({
            id: l.id,
            owner_id: l.owner_id,
            machine_id: l.machine_id,
            client_name: l.client_name,
            client_phone: l.client_phone,
            city: l.city || '',
            rental_duration: l.rental_duration || '',
            start_date: l.start_date || '',
            notes: l.notes || '',
            is_contacted: Boolean(l.is_contacted),
            contacted_at: l.contacted_at,
            created_at: l.created_at,
            machine: l.machines,
          }));

          const map = new Map<string, Lead>();
          for (const l of leads) map.set(l.id, l);
          for (const l of dbLeads) map.set(l.id, l);
          leads = Array.from(map.values());

          const otherLeads = this.getLocalLeads().filter((l) => l.owner_id !== ownerId);
          this.saveLocalLeads([...otherLeads, ...leads]);
        }
      } catch (err) {
        console.warn('Failed to load leads from DB:', err);
      }
    }

    return leads;
  },

  async submitLead(leadData: Omit<Lead, 'id' | 'created_at' | 'is_contacted'>): Promise<{ success: boolean; error?: string }> {
    const newLead: Lead = {
      id: crypto.randomUUID(),
      owner_id: leadData.owner_id,
      machine_id: leadData.machine_id,
      client_name: leadData.client_name.trim(),
      client_phone: leadData.client_phone.trim(),
      city: leadData.city?.trim() || '',
      rental_duration: leadData.rental_duration?.trim() || '',
      start_date: leadData.start_date || '',
      notes: leadData.notes?.trim() || '',
      is_contacted: false,
      created_at: new Date().toISOString(),
    };

    const all = this.getLocalLeads();
    this.saveLocalLeads([newLead, ...all]);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('leads').insert({
          id: newLead.id,
          owner_id: newLead.owner_id,
          machine_id: newLead.machine_id || null,
          client_name: newLead.client_name,
          client_phone: newLead.client_phone,
          city: newLead.city,
          rental_duration: newLead.rental_duration,
          start_date: newLead.start_date ? newLead.start_date : null,
          notes: newLead.notes,
          is_contacted: false,
        });

        if (error) {
          console.warn('DB submitLead notice:', error.message);
        }
      } catch (err) {
        console.warn('submitLead DB error:', err);
      }
    }

    return { success: true };
  },

  async markContacted(leadId: string, isContacted: boolean): Promise<{ success: boolean; error?: string }> {
    const all = this.getLocalLeads();
    const updated = all.map((l) =>
      l.id === leadId
        ? { ...l, is_contacted: isContacted, contacted_at: isContacted ? new Date().toISOString() : undefined }
        : l
    );
    this.saveLocalLeads(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('leads')
          .update({
            is_contacted: isContacted,
            contacted_at: isContacted ? new Date().toISOString() : null,
          })
          .eq('id', leadId);
      } catch (err) {
        console.warn('markContacted error:', err);
      }
    }

    return { success: true };
  },

  async getOwnerLeads(ownerId: string): Promise<Lead[]> {
    return this.getLeadsForOwner(ownerId);
  },

  async toggleLeadContacted(leadId: string): Promise<Lead | null> {
    const all = this.getLocalLeads();
    const target = all.find((l) => l.id === leadId);
    const newState = target ? !target.is_contacted : true;
    await this.markContacted(leadId, newState);
    return target
      ? { ...target, is_contacted: newState, contacted_at: newState ? new Date().toISOString() : undefined }
      : null;
  },
};
