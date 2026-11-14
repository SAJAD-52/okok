// ============================================================================
// JADIJCB: InDrive-Style Live Dispatch Campaign Service
// Matches contractors' site requests to owners whose machines fall within km radius
// Multi-channel guaranteed delivery:
//   1. Supabase dispatch_campaigns / dispatch_notifications (with Realtime)
//   2. Supabase public.notifications (INSERT without .select() so RLS never blocks)
//   3. Supabase conversations + messages (guaranteed fallback if neither table exists)
//   4. Express SQLite /api/notifications + BroadcastChannel
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
export const DISPATCH_MSG_MARKER = '\n#DISPATCH_DATA:';

export function stripDispatchMarker(raw?: string | null): string {
  if (!raw) return '';
  const idx = raw.indexOf('#DISPATCH_DATA:');
  if (idx === -1) return raw;
  return raw.slice(0, idx).trim();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): val is string {
  return Boolean(val && UUID_REGEX.test(val));
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

async function sendFallbackDispatchMessage(params: {
  contractorId: string;
  ownerId: string;
  machineId?: string;
  notification: DispatchNotification;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !isUuid(params.contractorId) || !isUuid(params.ownerId)) {
    return false;
  }

  try {
    const machineUuid = isUuid(params.machineId) ? params.machineId : null;
    let convId: string | null = null;

    const findExistingConv = async () => {
      let q = supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_a.eq.${params.contractorId},participant_b.eq.${params.ownerId}),and(participant_a.eq.${params.ownerId},participant_b.eq.${params.contractorId})`
        );
      q = machineUuid ? q.eq('machine_id', machineUuid) : q.is('machine_id', null);
      const { data: rows } = await q.limit(1);
      if (rows && rows.length > 0) return rows[0].id as string;

      // Also check participant_one / participant_two if that schema variant exists
      let qAlt = supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_one.eq.${params.contractorId},participant_two.eq.${params.ownerId}),and(participant_one.eq.${params.ownerId},participant_two.eq.${params.contractorId})`
        );
      qAlt = machineUuid ? qAlt.eq('machine_id', machineUuid) : qAlt.is('machine_id', null);
      const { data: altRows } = await qAlt.limit(1);
      if (altRows && altRows.length > 0) return altRows[0].id as string;
      return null;
    };

    convId = await findExistingConv();

    if (!convId) {
      const insertConvPrimary: any = {
        participant_a: params.contractorId,
        participant_b: params.ownerId,
      };
      if (machineUuid) insertConvPrimary.machine_id = machineUuid;

      const { data: createdConv, error: convErr } = await supabase
        .from('conversations')
        .insert(insertConvPrimary)
        .select('id')
        .maybeSingle();

      if (!convErr && createdConv?.id) {
        convId = createdConv.id;
      } else {
        // Retry with participant_one/participant_two included, or re-fetch if unique conflict
        const insertConvFull: any = {
          ...insertConvPrimary,
          participant_one: params.contractorId,
          participant_two: params.ownerId,
        };
        const { data: createdAlt } = await supabase
          .from('conversations')
          .insert(insertConvFull)
          .select('id')
          .maybeSingle();

        convId = createdAlt?.id || (await findExistingConv());
      }
    }

    if (!convId) return false;

    const distText = params.notification.is_nationwide
      ? 'المغرب كاملاً'
      : params.notification.distance_km != null
      ? `${Math.round(params.notification.distance_km)} كم`
      : '';

    const readableHeader = `🎉 فرصة جديدة — «${params.notification.company_name}» محتاجة «${params.notification.machine_name}» ديالك${
      distText ? ` (${distText})` : ''
    }\n📍 ${params.notification.site_name}${params.notification.site_city ? ` · ${params.notification.site_city}` : ''}`;

    const encodedPayload = JSON.stringify({
      id: params.notification.id,
      campaign_id: params.notification.campaign_id,
      owner_id: params.ownerId,
      contractor_id: params.contractorId,
      machine_id: params.machineId || null,
      company_name: params.notification.company_name,
      machine_name: params.notification.machine_name,
      matched_machine_title: params.notification.matched_machine_title,
      site_name: params.notification.site_name,
      site_city: params.notification.site_city,
      site_phone: params.notification.site_phone,
      distance_km: params.notification.distance_km,
      is_nationwide: params.notification.is_nationwide,
      radius_km: params.notification.radius_km,
      notes: params.notification.notes,
    });

    const fullBody = `${readableHeader}${DISPATCH_MSG_MARKER}${encodedPayload}`;

    // init_schema.sql uses column `body` (without `content`), so insert with `body` first.
    let msgInserted = false;
    const { error: bodyErr } = await supabase.from('messages').insert({
      id: params.notification.id,
      conversation_id: convId,
      sender_id: params.contractorId,
      body: fullBody,
    });

    if (!bodyErr) {
      msgInserted = true;
    } else {
      // Fallback for schemas that expect `content` column instead of or alongside `body`
      const { error: contentErr } = await supabase.from('messages').insert({
        id: params.notification.id,
        conversation_id: convId,
        sender_id: params.contractorId,
        content: fullBody,
        body: fullBody,
      });
      if (!contentErr) {
        msgInserted = true;
      } else {
        const { error: contentOnlyErr } = await supabase.from('messages').insert({
          id: params.notification.id,
          conversation_id: convId,
          sender_id: params.contractorId,
          content: fullBody,
        });
        msgInserted = !contentOnlyErr;
      }
    }

    if (msgInserted) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', convId);
      return true;
    }
  } catch (err) {
    console.warn('Dispatch chat fallback warning:', err);
  }
  return false;
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
  const resolvedCampaignId = makeUuid();

  // Resolve active Supabase auth user UID (needed for RLS policies)
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
  let dispatchNotifsSent = false;
  let genericNotifsSent = false;
  let chatFallbackSent = false;

  const campaignPayload = {
    id: resolvedCampaignId,
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

  // Pre-build notification objects with valid UUIDs
  const preparedNotifs: DispatchNotification[] = params.targets.map((t) => ({
    id: makeUuid(),
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

  // Channel 1: Dedicated dispatch_campaigns + dispatch_notifications tables
  if (isSupabaseConfigured && isUuid(effectiveContractorId)) {
    try {
      const { error: campErr } = await supabase
        .from('dispatch_campaigns')
        .insert(campaignPayload);

      if (!campErr) {
        const validNotifs = preparedNotifs.filter((n) => isUuid(n.owner_id));
        if (validNotifs.length > 0) {
          const notifRows = validNotifs.map((n) => ({
            id: n.id,
            campaign_id: resolvedCampaignId,
            owner_id: n.owner_id,
            contractor_id: effectiveContractorId,
            machine_id: isUuid(n.machine_id) ? n.machine_id : null,
            company_name: n.company_name,
            machine_name: n.machine_name,
            matched_machine_title: n.matched_machine_title || '',
            site_name: n.site_name,
            site_city: n.site_city || '',
            site_lat: n.site_lat,
            site_lng: n.site_lng,
            site_phone: n.site_phone || '',
            distance_km: n.distance_km,
            is_nationwide: n.is_nationwide,
            radius_km: n.radius_km,
            notes: n.notes || '',
            status: 'sent',
            is_read: false,
          }));

          const { error: notifErr } = await supabase
            .from('dispatch_notifications')
            .insert(notifRows);

          if (!notifErr) {
            dispatchNotifsSent = true;
          } else {
            console.warn('dispatch_notifications insert notice:', notifErr.message);
          }
        } else {
          dispatchNotifsSent = params.targets.length === 0;
        }
      } else {
        console.warn('dispatch_campaigns insert notice:', campErr.message);
      }
    } catch (err) {
      console.warn('Supabase dispatch_campaigns exception:', err);
    }
  }

  // Channel 2: Existing Supabase public.notifications table
  // IMPORTANT: Do NOT chain .select() here! SELECT RLS checks (auth.uid() = user_id)
  // which blocks contractor from reading the owner's inserted row and would roll back the INSERT!
  if (isSupabaseConfigured && preparedNotifs.length > 0) {
    try {
      const uuidNotifs = preparedNotifs.filter((n) => isUuid(n.owner_id));
      if (uuidNotifs.length > 0) {
        const genericRows = uuidNotifs.map((n) => {
          const distTextAr = n.is_nationwide
            ? 'المغرب كاملاً'
            : `${Math.round(n.distance_km || 0)} كم`;
          const distTextFr = n.is_nationwide
            ? 'Tout le Maroc'
            : `${Math.round(n.distance_km || 0)} km`;

          return {
            id: n.id,
            user_id: n.owner_id,
            title_ar: 'فرصة جديدة 🎉',
            title_fr: 'Nouvelle opportunité 🎉',
            body_ar: `«${n.company_name}» محتاجة «${n.machine_name}» ديالك · ${distTextAr}`,
            body_fr: `«${n.company_name}» recherche «${n.machine_name}» · ${distTextFr}`,
            type: 'dispatch_opportunity',
            data: {
              id: n.id,
              campaign_id: n.campaign_id,
              owner_id: n.owner_id,
              contractor_id: n.contractor_id,
              machine_id: n.machine_id || null,
              company_name: n.company_name,
              machine_name: n.machine_name,
              matched_machine_title: n.matched_machine_title,
              site_name: n.site_name,
              site_city: n.site_city || '',
              site_lat: n.site_lat,
              site_lng: n.site_lng,
              site_phone: n.site_phone || '',
              distance_km: n.distance_km,
              is_nationwide: n.is_nationwide,
              radius_km: n.radius_km,
              notes: n.notes || '',
              status: 'sent',
            },
            is_read: false,
          };
        });

        const { error: genErr } = await supabase
          .from('notifications')
          .insert(genericRows);

        if (!genErr) {
          genericNotifsSent = true;
        } else {
          console.warn('Supabase notifications insert notice:', genErr.message);
        }
      }
    } catch (err) {
      console.warn('Supabase public.notifications dispatch warning:', err);
    }
  }

  // Channel 3: Guaranteed Supabase Realtime fallback via conversations + messages
  // Runs whenever dedicated dispatch_notifications wasn't persisted (init_schema.sql has Realtime on messages by default)
  if (isSupabaseConfigured && !dispatchNotifsSent && preparedNotifs.length > 0) {
    const results = await Promise.all(
      preparedNotifs.map((n) =>
        sendFallbackDispatchMessage({
          contractorId: effectiveContractorId,
          ownerId: n.owner_id,
          machineId: n.machine_id,
          notification: n,
        })
      )
    );
    chatFallbackSent = results.some(Boolean);
  }

  // Channel 4: Express Server SQLite /api/notifications (full-stack server sync)
  if (preparedNotifs.length > 0) {
    await Promise.allSettled(
      preparedNotifs.map((n) =>
        serverApi.createNotification({
          user_id: n.owner_id,
          title_ar: 'فرصة جديدة 🎉',
          title_fr: 'Nouvelle opportunité 🎉',
          body_ar: `«${n.company_name}» محتاجة «${n.machine_name}» ديالك`,
          body_fr: `«${n.company_name}» recherche «${n.machine_name}»`,
          type: 'dispatch_opportunity',
          data: {
            id: n.id,
            campaign_id: n.campaign_id,
            owner_id: n.owner_id,
            contractor_id: n.contractor_id,
            machine_id: n.machine_id,
            company_name: n.company_name,
            machine_name: n.machine_name,
            matched_machine_title: n.matched_machine_title,
            site_name: n.site_name,
            site_city: n.site_city || '',
            site_lat: n.site_lat,
            site_lng: n.site_lng,
            site_phone: n.site_phone || '',
            distance_km: n.distance_km,
            is_nationwide: n.is_nationwide,
            radius_km: n.radius_km,
            notes: n.notes || '',
            status: 'sent',
          },
        })
      )
    );
  }

  const persistedToSupabase = dispatchNotifsSent || genericNotifsSent || chatFallbackSent;

  const finalCampaign: DispatchCampaign = {
    ...campaignPayload,
    created_at: now,
    notifications: preparedNotifs,
  };

  // Channel 5: Local persistence & BroadcastChannel
  saveLocalCampaignFallback(finalCampaign, preparedNotifs);
  broadcastDispatchEvent({
    type: 'CAMPAIGN_LAUNCHED',
    campaign: finalCampaign,
    notifications: preparedNotifs,
  });

  return { campaign: finalCampaign, notifications: preparedNotifs, persistedToSupabase };
}

function mapGenericNotificationToDispatch(row: any): DispatchNotification | null {
  const data = row?.data || {};
  if (!row) return null;
  if (row.type !== 'dispatch_opportunity' && !data.campaign_id) return null;

  return {
    id: data.id || row.id,
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

export function parseDispatchMessageRow(msg: any, ownerId: string): DispatchNotification | null {
  const rawBody = String(msg?.body || msg?.content || '');
  const idx = rawBody.indexOf(DISPATCH_MSG_MARKER);
  if (idx === -1) return null;
  try {
    const jsonPart = rawBody.slice(idx + DISPATCH_MSG_MARKER.length).trim();
    const data = JSON.parse(jsonPart);
    if (!data || (data.owner_id && data.owner_id !== ownerId)) return null;
    const isRead = Boolean(msg.read_at);
    return {
      id: data.id || msg.id,
      campaign_id: data.campaign_id || msg.id,
      owner_id: ownerId,
      contractor_id: data.contractor_id || msg.sender_id || '',
      machine_id: data.machine_id || undefined,
      company_name: data.company_name || 'مقاولة أشغال',
      machine_name: data.machine_name || 'آلية بناء',
      matched_machine_title: data.matched_machine_title || undefined,
      site_name: data.site_name || 'ورش بناء',
      site_city: data.site_city || '',
      site_phone: data.site_phone || '',
      distance_km: data.distance_km != null ? Number(data.distance_km) : null,
      is_nationwide: Boolean(data.is_nationwide),
      radius_km: data.radius_km != null ? Number(data.radius_km) : null,
      notes: data.notes || '',
      status: isRead ? 'read' : 'sent',
      is_read: isRead,
      created_at: msg.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
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

    // 2. Existing public.notifications table
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

    // 3. Fallback: recent incoming messages containing DISPATCH_MSG_MARKER (column-agnostic)
    try {
      const { data: msgRows } = await supabase
        .from('messages')
        .select('*')
        .neq('sender_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(40);

      if (msgRows) {
        for (const m of msgRows) {
          const parsed = parseDispatchMessageRow(m, ownerId);
          if (parsed) mergeNotif(parsed, false);
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Express SQLite /api/notifications
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

  // 5. Local cache merge
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

    if (updates.is_read) {
      try {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId);
      } catch {
        // ignore
      }
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
