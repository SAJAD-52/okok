// ============================================================================
// JADIJCB: InDrive-Style Live Dispatch Campaign Service
// Matches contractors' site requests to owners whose machines fall within km radius
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { calculateDistanceKm } from './geoUtils';
import { MOROCCAN_CITIES } from '../data/cities';
import { DispatchCampaign, DispatchNotification, Machine } from '../types/database';
import { machineStore } from './machineStore';

const DISPATCH_CHANNEL_NAME = 'jadijcb_dispatch_channel';
const LOCAL_CAMPAIGNS_KEY = 'jadijcb_local_dispatch_campaigns';
const LOCAL_NOTIFS_KEY = 'jadijcb_local_dispatch_notifs';

export interface MatchedOwnerTarget {
  owner_id: string;
  machine_id: string;
  matched_machine_title: string;
  machine_city: string;
  distance_km: number;
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  loader: ['loader', 'loaders', 'backhoe-loaders', 'backhoe', 'tractopelle', 'jcb'],
  excavator: ['excavator', 'excavators', 'pelle', 'pelleteuse'],
  bulldozer: ['bulldozer', 'bulldozers', 'bouteur'],
  crane: ['crane', 'cranes', 'grue'],
  truck: ['truck', 'trucks', 'camion', 'benne'],
  'concrete-mixer': ['concrete-mixer', 'concrete', 'toupie', 'malaxeur'],
  compactor: ['compactor', 'compactors', 'compacteur', 'rouleau'],
  generator: ['generator', 'generators', 'groupe-electrogene'],
  forklift: ['forklift', 'forklifts', 'chariot', 'telescopique', 'manitou'],
  scaffolding: ['scaffolding', 'echafaudage', 'coffrage'],
};

function matchesRequestedMachine(
  machine: Partial<Machine>,
  requestedCategory: string,
  requestedName: string
): boolean {
  const cat = String(machine.category || machine.category_id || '').toLowerCase();
  if (cat === 'spare-parts') return false;

  // If contractor selected "all" machinery
  if (!requestedCategory || requestedCategory === 'all') {
    if (!requestedName.trim()) return true;
    const text = `${machine.title_ar || ''} ${machine.title_fr || ''} ${machine.brand || ''} ${machine.model || ''} ${cat}`.toLowerCase();
    const tokens = requestedName
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    return tokens.length === 0 || tokens.some((tok) => text.includes(tok));
  }

  const aliases = CATEGORY_ALIASES[requestedCategory] || [requestedCategory.toLowerCase()];
  if (aliases.some((alias) => cat === alias || cat.includes(alias))) {
    return true;
  }

  // Also check title/brand match if user typed specific keyword like JCB / 3CX
  const text = `${machine.title_ar || ''} ${machine.title_fr || ''} ${machine.brand || ''} ${machine.model || ''}`.toLowerCase();
  if (requestedName.trim()) {
    const tokens = requestedName
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (tokens.some((tok) => text.includes(tok))) return true;
  }

  return false;
}

function resolveMachineCoords(machine: any): { lat: number; lng: number } | null {
  const rawLat = Number(machine.lat ?? machine.location_lat);
  const rawLng = Number(machine.lng ?? machine.location_lng);
  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && rawLat !== 0 && rawLng !== 0) {
    return { lat: rawLat, lng: rawLng };
  }
  const cityText = String(machine.city || machine.city_id || '').toLowerCase();
  const city = MOROCCAN_CITIES.find(
    (c) =>
      c.id.toLowerCase() === cityText ||
      c.name_ar.toLowerCase() === cityText ||
      c.name_fr.toLowerCase() === cityText
  );
  if (city) return { lat: city.lat, lng: city.lng };
  return null;
}

export async function findMatchingOwnersForCampaign(params: {
  siteLat: number;
  siteLng: number;
  machineCategory: string;
  machineName: string;
  radiusKm: number | null;
  isNationwide: boolean;
  excludeOwnerId?: string;
}): Promise<MatchedOwnerTarget[]> {
  let rawMachines: any[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('is_published', true);

      if (!error && data) {
        rawMachines = data;
      }
    } catch (err) {
      console.warn('Error querying machines for dispatch matching:', err);
    }
  }

  if (rawMachines.length === 0) {
    rawMachines = machineStore.getCachedMachines().filter((m) => m.is_published !== false);
  }

  // Deduplicate by owner_id, picking the closest matching machine per owner
  const closestByOwner = new Map<string, MatchedOwnerTarget>();

  for (const m of rawMachines) {
    if (!m.owner_id || m.owner_id === params.excludeOwnerId) continue;
    if (!matchesRequestedMachine(m, params.machineCategory, params.machineName)) continue;

    const coords = resolveMachineCoords(m);
    if (!coords && !params.isNationwide) continue;

    const distKm = coords
      ? calculateDistanceKm(params.siteLat, params.siteLng, coords.lat, coords.lng)
      : 0;

    if (!params.isNationwide && params.radiusKm !== null && distKm > params.radiusKm) {
      continue;
    }

    const title = m.title_ar || m.title_fr || `${m.brand || ''} ${m.model || ''}`.trim() || 'آلية';
    const existing = closestByOwner.get(m.owner_id);
    if (!existing || distKm < existing.distance_km) {
      closestByOwner.set(m.owner_id, {
        owner_id: m.owner_id,
        machine_id: m.id,
        matched_machine_title: title,
        machine_city: m.city || '',
        distance_km: distKm,
      });
    }
  }

  return Array.from(closestByOwner.values()).sort((a, b) => a.distance_km - b.distance_km);
}

function broadcastDispatchEvent(payload: { type: string; notifications?: DispatchNotification[]; campaign?: DispatchCampaign }) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(DISPATCH_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
    window.dispatchEvent(new CustomEvent('jadijcb_dispatch_updated', { detail: payload }));
  } catch {
    // Ignore channel errors
  }
}

export function subscribeLocalDispatchEvents(callback: (detail: any) => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(DISPATCH_CHANNEL_NAME);
      ch.onmessage = (e) => callback(e.data);
    }
  } catch {
    // ignore
  }
  const onWin = (e: Event) => callback((e as CustomEvent).detail);
  window.addEventListener('jadijcb_dispatch_updated', onWin);

  return () => {
    try {
      ch?.close();
    } catch {
      // ignore
    }
    window.removeEventListener('jadijcb_dispatch_updated', onWin);
  };
}

function saveLocalCampaignFallback(campaign: DispatchCampaign, notifications: DispatchNotification[]) {
  try {
    const existingC = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify([campaign, ...existingC].slice(0, 30)));

    const existingN = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify([...notifications, ...existingN].slice(0, 100)));
  } catch {
    // ignore
  }
}

export async function launchDispatchCampaign(params: {
  contractorId: string;
  companyName: string;
  siteId?: string;
  siteName: string;
  siteCity?: string;
  siteLat: number;
  siteLng: number;
  sitePhone?: string;
  machineCategory: string;
  machineName: string;
  radiusKm: number | null;
  isNationwide: boolean;
  notes?: string;
  targets: MatchedOwnerTarget[];
}): Promise<{ campaign: DispatchCampaign; notifications: DispatchNotification[]; persistedToSupabase: boolean }> {
  const now = new Date().toISOString();
  const fallbackCampaignId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const campaignPayload = {
    contractor_id: params.contractorId,
    company_name: params.companyName,
    site_id: params.siteId || null,
    site_name: params.siteName,
    site_city: params.siteCity || '',
    site_lat: params.siteLat,
    site_lng: params.siteLng,
    site_phone: params.sitePhone || '',
    machine_category: params.machineCategory,
    machine_name: params.machineName,
    radius_km: params.isNationwide ? null : params.radiusKm,
    is_nationwide: params.isNationwide,
    notes: params.notes || '',
    matched_owners_count: params.targets.length,
    status: 'active' as const,
  };

  if (isSupabaseConfigured) {
    try {
      const { data: createdCamp, error: campErr } = await supabase
        .from('dispatch_campaigns')
        .insert(campaignPayload)
        .select('*')
        .single();

      if (!campErr && createdCamp) {
        let createdNotifs: DispatchNotification[] = [];
        if (params.targets.length > 0) {
          const notifRows = params.targets.map((t) => ({
            campaign_id: createdCamp.id,
            owner_id: t.owner_id,
            contractor_id: params.contractorId,
            machine_id: t.machine_id || null,
            company_name: params.companyName,
            machine_name: params.machineName,
            matched_machine_title: t.matched_machine_title,
            site_name: params.siteName,
            site_city: params.siteCity || '',
            site_lat: params.siteLat,
            site_lng: params.siteLng,
            site_phone: params.sitePhone || '',
            distance_km: t.distance_km,
            is_nationwide: params.isNationwide,
            radius_km: params.isNationwide ? null : params.radiusKm,
            notes: params.notes || '',
            status: 'sent',
            is_read: false,
          }));

          const { data: insertedNotifs, error: notifErr } = await supabase
            .from('dispatch_notifications')
            .insert(notifRows)
            .select('*');

          if (!notifErr && insertedNotifs) {
            createdNotifs = insertedNotifs as DispatchNotification[];
          }
        }

        const fullCampaign: DispatchCampaign = {
          ...(createdCamp as DispatchCampaign),
          notifications: createdNotifs,
        };

        broadcastDispatchEvent({
          type: 'CAMPAIGN_LAUNCHED',
          campaign: fullCampaign,
          notifications: createdNotifs,
        });

        return { campaign: fullCampaign, notifications: createdNotifs, persistedToSupabase: true };
      }

      console.warn('Supabase dispatch_campaigns insert notice:', campErr?.message);
    } catch (err) {
      console.warn('Supabase dispatch_campaigns exception:', err);
    }
  }

  // Fallback local persistence (only if migration not yet applied remotely)
  const localCampaign: DispatchCampaign = {
    id: fallbackCampaignId,
    ...campaignPayload,
    created_at: now,
    notifications: [],
  };

  const localNotifs: DispatchNotification[] = params.targets.map((t, i) => ({
    id: `dn_${Date.now()}_${i}`,
    campaign_id: fallbackCampaignId,
    owner_id: t.owner_id,
    contractor_id: params.contractorId,
    machine_id: t.machine_id,
    company_name: params.companyName,
    machine_name: params.machineName,
    matched_machine_title: t.matched_machine_title,
    site_name: params.siteName,
    site_city: params.siteCity || '',
    site_lat: params.siteLat,
    site_lng: params.siteLng,
    site_phone: params.sitePhone || '',
    distance_km: t.distance_km,
    is_nationwide: params.isNationwide,
    radius_km: params.isNationwide ? null : params.radiusKm,
    notes: params.notes || '',
    status: 'sent',
    is_read: false,
    created_at: now,
  }));

  localCampaign.notifications = localNotifs;
  saveLocalCampaignFallback(localCampaign, localNotifs);
  broadcastDispatchEvent({
    type: 'CAMPAIGN_LAUNCHED',
    campaign: localCampaign,
    notifications: localNotifs,
  });

  return { campaign: localCampaign, notifications: localNotifs, persistedToSupabase: false };
}

export async function fetchOwnerDispatchNotifications(ownerId: string): Promise<DispatchNotification[]> {
  if (!ownerId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('dispatch_notifications')
        .select('*')
        .eq('owner_id', ownerId)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        return data as DispatchNotification[];
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const local: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    return local.filter((n) => n.owner_id === ownerId && n.status !== 'dismissed');
  } catch {
    return [];
  }
}

export async function fetchContractorCampaigns(contractorId: string): Promise<DispatchCampaign[]> {
  if (!contractorId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data: camps, error } = await supabase
        .from('dispatch_campaigns')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && camps) {
        const campIds = camps.map((c: any) => c.id);
        let notifsByCamp = new Map<string, DispatchNotification[]>();

        if (campIds.length > 0) {
          const { data: notifs } = await supabase
            .from('dispatch_notifications')
            .select('*')
            .in('campaign_id', campIds)
            .order('created_at', { ascending: false });

          if (notifs) {
            for (const n of notifs as DispatchNotification[]) {
              const list = notifsByCamp.get(n.campaign_id) || [];
              list.push(n);
              notifsByCamp.set(n.campaign_id, list);
            }
          }
        }

        return (camps as DispatchCampaign[]).map((c) => ({
          ...c,
          notifications: notifsByCamp.get(c.id) || [],
        }));
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const local: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    return local.filter((c) => c.contractor_id === contractorId);
  } catch {
    return [];
  }
}

export async function updateDispatchNotificationStatus(
  notificationId: string,
  updates: { status?: DispatchNotification['status']; is_read?: boolean }
): Promise<void> {
  if (isSupabaseConfigured && !notificationId.startsWith('dn_')) {
    try {
      await supabase
        .from('dispatch_notifications')
        .update(updates)
        .eq('id', notificationId);
    } catch {
      // Ignore
    }
  }

  try {
    const local: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    const updated = local.map((n) => (n.id === notificationId ? { ...n, ...updates } : n));
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'NOTIF_UPDATED' });
  } catch {
    // ignore
  }
}

export async function closeDispatchCampaign(campaignId: string): Promise<void> {
  if (isSupabaseConfigured && !campaignId.startsWith('cmp_')) {
    try {
      await supabase
        .from('dispatch_campaigns')
        .update({ status: 'closed' })
        .eq('id', campaignId);
    } catch {
      // ignore
    }
  }

  try {
    const local: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    const updated = local.map((c) => (c.id === campaignId ? { ...c, status: 'closed' } : c));
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'CAMPAIGN_UPDATED' });
  } catch {
    // ignore
  }
}
