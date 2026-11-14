// ============================================================================
// JADIJCB: InDrive-Style Live Dispatch Campaign Service
// Matches contractors' site requests to owners whose machines fall within km radius
// Multi-channel delivery:
//   1. Supabase dispatch_campaigns / dispatch_notifications (with Realtime)
//   2. Supabase public.notifications (existing table fallback, cross-device)
//   3. Express SQLite /api/notifications (full-stack local/cloud server)
//   4. BroadcastChannel + localStorage (same-browser instant sync)
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { calculateDistanceKm } from './geoUtils';
import { MOROCCAN_CITIES } from '../data/cities';
import { DispatchCampaign, DispatchNotification, Machine } from '../types/database';
import { machineStore } from './machineStore';
import { serverApi } from './serverApi';

const DISPATCH_CHANNEL_NAME = 'jadijcb_dispatch_channel';
const LOCAL_CAMPAIGNS_KEY = 'jadijcb_local_dispatch_campaigns';
const LOCAL_NOTIFS_KEY = 'jadijcb_local_dispatch_notifs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): val is string {
  return Boolean(val && UUID_REGEX.test(val));
}

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
        .neq('is_published', false);

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

function broadcastDispatchEvent(payload: {
  type: string;
  notifications?: DispatchNotification[];
  campaign?: DispatchCampaign;
}) {
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
    const existingC: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    const filteredC = existingC.filter((c) => c.id !== campaign.id);
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify([campaign, ...filteredC].slice(0, 30)));

    const existingN: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    const newIds = new Set(notifications.map((n) => n.id));
    const filteredN = existingN.filter((n) => !newIds.has(n.id));
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify([...notifications, ...filteredN].slice(0, 100)));
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

  // Resolve real authenticated Supabase UID if present (required by RLS contractor_id = auth.uid())
  let authUid: string | null = isUuid(params.contractorId) ? params.contractorId : null;
  if (isSupabaseConfigured) {
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      if (isUuid(sessionData?.user?.id)) {
        authUid = sessionData.user.id;
      }
    } catch {
      // ignore
    }
  }

  const effectiveContractorId = authUid || params.contractorId;
  let persistedToSupabase = false;
  let resolvedCampaignId = fallbackCampaignId;
  let createdNotifs: DispatchNotification[] = [];

  const campaignPayload = {
    contractor_id: effectiveContractorId,
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

  // Channel 1: Dedicated Supabase dispatch_campaigns + dispatch_notifications tables
  if (isSupabaseConfigured && isUuid(effectiveContractorId)) {
    try {
      const { data: createdCamp, error: campErr } = await supabase
        .from('dispatch_campaigns')
        .insert(campaignPayload)
        .select('*')
        .single();

      if (!campErr && createdCamp) {
        resolvedCampaignId = createdCamp.id;
        persistedToSupabase = true;

        if (params.targets.length > 0) {
          const validTargets = params.targets.filter((t) => isUuid(t.owner_id));
          if (validTargets.length > 0) {
            const notifRows = validTargets.map((t) => ({
              campaign_id: createdCamp.id,
              owner_id: t.owner_id,
              contractor_id: effectiveContractorId,
              machine_id: isUuid(t.machine_id) ? t.machine_id : null,
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
            } else if (notifErr) {
              console.warn('dispatch_notifications insert notice:', notifErr.message);
            }
          }
        }
      } else if (campErr) {
        console.warn('dispatch_campaigns insert notice:', campErr.message);
      }
    } catch (err) {
      console.warn('Supabase dispatch_campaigns exception:', err);
    }
  }

  // Channel 2: Existing Supabase public.notifications table (Works cross-device even before SQL migration)
  if (isSupabaseConfigured && params.targets.length > 0) {
    try {
      const uuidTargets = params.targets.filter((t) => isUuid(t.owner_id));
      if (uuidTargets.length > 0) {
        const genericNotifs = uuidTargets.map((t) => {
          const distTextAr = params.isNationwide
            ? 'المغرب كاملاً'
            : `${Math.round(t.distance_km)} كم`;
          const distTextFr = params.isNationwide
            ? 'Tout le Maroc'
            : `${Math.round(t.distance_km)} km`;

          const dataPayload = {
            campaign_id: resolvedCampaignId,
            owner_id: t.owner_id,
            contractor_id: effectiveContractorId,
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
          };

          return {
            user_id: t.owner_id,
            title_ar: 'فرصة جديدة 🎉',
            title_fr: 'Nouvelle opportunité 🎉',
            body_ar: `«${params.companyName}» محتاجة «${params.machineName}» ديالك · ${distTextAr}`,
            body_fr: `«${params.companyName}» recherche «${params.machineName}» · ${distTextFr}`,
            type: 'dispatch_opportunity',
            data: dataPayload,
            is_read: false,
          };
        });

        const { data: insertedGeneric, error: genErr } = await supabase
          .from('notifications')
          .insert(genericNotifs)
          .select('*');

        if (!genErr && insertedGeneric) {
          persistedToSupabase = true;
          if (createdNotifs.length === 0) {
            createdNotifs = insertedGeneric.map((row: any) => ({
              id: row.id,
              campaign_id: row.data?.campaign_id || resolvedCampaignId,
              owner_id: row.user_id,
              contractor_id: row.data?.contractor_id || effectiveContractorId,
              machine_id: row.data?.machine_id || undefined,
              company_name: row.data?.company_name || params.companyName,
              machine_name: row.data?.machine_name || params.machineName,
              matched_machine_title: row.data?.matched_machine_title,
              site_name: row.data?.site_name || params.siteName,
              site_city: row.data?.site_city || params.siteCity || '',
              site_lat: row.data?.site_lat ?? params.siteLat,
              site_lng: row.data?.site_lng ?? params.siteLng,
              site_phone: row.data?.site_phone || params.sitePhone || '',
              distance_km: row.data?.distance_km ?? 0,
              is_nationwide: Boolean(row.data?.is_nationwide),
              radius_km: row.data?.radius_km ?? null,
              notes: row.data?.notes || '',
              status: 'sent',
              is_read: false,
              created_at: row.created_at || now,
            }));
          }
        } else if (genErr) {
          console.warn('Supabase generic notifications insert notice:', genErr.message);
        }
      }
    } catch (err) {
      console.warn('Supabase public.notifications dispatch warning:', err);
    }
  }

  // Channel 3: Express Server SQLite /api/notifications (full-stack server sync)
  if (params.targets.length > 0) {
    await Promise.allSettled(
      params.targets.map((t) =>
        serverApi.createNotification({
          user_id: t.owner_id,
          title_ar: 'فرصة جديدة 🎉',
          title_fr: 'Nouvelle opportunité 🎉',
          body_ar: `«${params.companyName}» محتاجة «${params.machineName}» ديالك`,
          body_fr: `«${params.companyName}» recherche «${params.machineName}»`,
          type: 'dispatch_opportunity',
          data: {
            campaign_id: resolvedCampaignId,
            owner_id: t.owner_id,
            contractor_id: effectiveContractorId,
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
          },
        })
      )
    );
  }

  // Build final notification list (guaranteeing in-memory objects even if offline)
  if (createdNotifs.length === 0 && params.targets.length > 0) {
    createdNotifs = params.targets.map((t, i) => ({
      id: `dn_${Date.now()}_${i}`,
      campaign_id: resolvedCampaignId,
      owner_id: t.owner_id,
      contractor_id: effectiveContractorId,
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
  }

  const finalCampaign: DispatchCampaign = {
    id: resolvedCampaignId,
    ...campaignPayload,
    created_at: now,
    notifications: createdNotifs,
  };

  // Channel 4: Local persistence & BroadcastChannel
  saveLocalCampaignFallback(finalCampaign, createdNotifs);
  broadcastDispatchEvent({
    type: 'CAMPAIGN_LAUNCHED',
    campaign: finalCampaign,
    notifications: createdNotifs,
  });

  return { campaign: finalCampaign, notifications: createdNotifs, persistedToSupabase };
}

function mapGenericNotificationToDispatch(row: any): DispatchNotification | null {
  const data = row?.data || {};
  if (!row) return null;
  if (row.type !== 'dispatch_opportunity' && !data.campaign_id) return null;

  return {
    id: row.id,
    campaign_id: data.campaign_id || row.id,
    owner_id: data.owner_id || row.user_id,
    contractor_id: data.contractor_id || '',
    machine_id: data.machine_id || undefined,
    company_name: data.company_name || 'مقاولة أشغال',
    machine_name: data.machine_name || 'آلية بناء',
    matched_machine_title: data.matched_machine_title || undefined,
    site_name: data.site_name || 'ورش بناء',
    site_city: data.site_city || '',
    site_lat: data.site_lat ?? undefined,
    site_lng: data.site_lng ?? undefined,
    site_phone: data.site_phone || '',
    distance_km: data.distance_km != null ? Number(data.distance_km) : null,
    is_nationwide: Boolean(data.is_nationwide),
    radius_km: data.radius_km != null ? Number(data.radius_km) : null,
    notes: data.notes || '',
    status: data.status || (row.is_read || row.read ? 'read' : 'sent'),
    is_read: Boolean(row.is_read || row.read),
    created_at: row.created_at || new Date().toISOString(),
  };
}

export async function fetchOwnerDispatchNotifications(ownerId: string): Promise<DispatchNotification[]> {
  if (!ownerId) return [];

  const mergedByCampaign = new Map<string, DispatchNotification>();

  const mergeNotif = (item: DispatchNotification, preferIncoming: boolean) => {
    if (!item || item.status === 'dismissed') return;
    const key = `${item.campaign_id || item.id}__${item.owner_id}`;
    const existing = mergedByCampaign.get(key);
    if (!existing) {
      mergedByCampaign.set(key, item);
    } else if (preferIncoming) {
      mergedByCampaign.set(key, {
        ...existing,
        ...item,
        is_read: existing.is_read || item.is_read,
        status: existing.status === 'accepted' ? 'accepted' : item.status,
      });
    }
  };

  if (isSupabaseConfigured && isUuid(ownerId)) {
    // 1. Dedicated dispatch_notifications table
    try {
      const { data, error } = await supabase
        .from('dispatch_notifications')
        .select('*')
        .eq('owner_id', ownerId)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        for (const row of data as DispatchNotification[]) {
          mergeNotif(row, true);
        }
      }
    } catch {
      // ignore if table not created yet
    }

    // 2. Existing public.notifications table fallback
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', ownerId)
        .eq('type', 'dispatch_opportunity')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        for (const row of data) {
          const mapped = mapGenericNotificationToDispatch(row);
          if (mapped) mergeNotif(mapped, false);
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Express SQLite /api/notifications fallback
  try {
    const serverRes = await serverApi.getNotifications({ user_id: ownerId });
    for (const sNotif of serverRes.notifications || []) {
      const mapped = mapGenericNotificationToDispatch(sNotif);
      if (mapped && mapped.owner_id === ownerId) {
        mergeNotif(mapped, false);
      }
    }
  } catch {
    // ignore
  }

  // 4. Local cache merge
  try {
    const local: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    for (const n of local) {
      if (n.owner_id === ownerId) {
        mergeNotif(n, false);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(mergedByCampaign.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function fetchContractorCampaigns(contractorId: string): Promise<DispatchCampaign[]> {
  if (!contractorId) return [];

  const campaignsMap = new Map<string, DispatchCampaign>();

  if (isSupabaseConfigured && isUuid(contractorId)) {
    try {
      const { data: camps, error } = await supabase
        .from('dispatch_campaigns')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && camps) {
        const campIds = camps.map((c: any) => c.id);
        const notifsByCamp = new Map<string, DispatchNotification[]>();

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

        for (const c of camps as DispatchCampaign[]) {
          campaignsMap.set(c.id, {
            ...c,
            notifications: notifsByCamp.get(c.id) || [],
          });
        }
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const local: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    for (const c of local) {
      if (c.contractor_id === contractorId && !campaignsMap.has(c.id)) {
        campaignsMap.set(c.id, c);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(campaignsMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateDispatchNotificationStatus(
  notificationId: string,
  updates: { status?: DispatchNotification['status']; is_read?: boolean },
  campaignId?: string
): Promise<void> {
  if (isSupabaseConfigured && isUuid(notificationId)) {
    try {
      await supabase
        .from('dispatch_notifications')
        .update(updates)
        .eq('id', notificationId);
    } catch {
      // ignore
    }

    try {
      await supabase
        .from('notifications')
        .update({ is_read: updates.is_read ?? true })
        .eq('id', notificationId);
    } catch {
      // ignore
    }
  }

  if (notificationId.startsWith('notif_')) {
    await serverApi.markNotificationRead(notificationId);
  }

  try {
    const local: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    const updated = local.map((n) =>
      n.id === notificationId || (campaignId && n.campaign_id === campaignId)
        ? { ...n, ...updates }
        : n
    );
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'NOTIF_UPDATED' });
  } catch {
    // ignore
  }
}

export async function closeDispatchCampaign(campaignId: string): Promise<void> {
  if (isSupabaseConfigured && isUuid(campaignId)) {
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
    const updated = local.map((c) => (c.id === campaignId ? { ...c, status: 'closed' as const } : c));
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'CAMPAIGN_UPDATED' });
  } catch {
    // ignore
  }
}
