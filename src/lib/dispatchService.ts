// ============================================================================
// JADIJCB: InDrive-Style Live Dispatch Campaign & Mutual Deal Service
// Matches contractors' site requests to owners whose machines fall within km radius
// Multi-channel guaranteed delivery + Web Push + Mutual Deal Finalization:
//   1. Supabase dispatch_campaigns / dispatch_notifications (with Realtime)
//   2. Supabase public.notifications (INSERT without .select() so RLS never blocks)
//   3. Supabase conversations + messages (guaranteed fallback + #DISPATCH_DEAL sync)
//   4. Express SQLite /api/notifications + Web Push VAPID + BroadcastChannel
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { calculateDistanceKm } from './geoUtils';
import { MOROCCAN_CITIES } from '../data/cities';
import {
  Booking,
  DispatchCampaign,
  DispatchDealContext,
  DispatchDealStatus,
  DispatchNotification,
  Machine,
} from '../types/database';
import { machineStore } from './machineStore';
import { bookingStore } from './bookingStore';
import { chatStore } from './chatStore';
import { serverApi } from './serverApi';
import { sendWebPushForDispatch } from './pushService';

const DISPATCH_CHANNEL_NAME = 'jadijcb_dispatch_channel';
const LOCAL_CAMPAIGNS_KEY = 'jadijcb_local_dispatch_campaigns';
const LOCAL_NOTIFS_KEY = 'jadijcb_local_dispatch_notifs';
export const DISPATCH_MSG_MARKER = '\n#DISPATCH_DATA:';
export const DISPATCH_DEAL_MARKER = '\n#DISPATCH_DEAL:';

export function stripDispatchMarker(raw?: string | null): string {
  if (!raw) return '';
  const dataIdx = raw.indexOf('#DISPATCH_DATA:');
  const dealIdx = raw.indexOf('#DISPATCH_DEAL:');
  let cutIdx = -1;
  if (dataIdx !== -1 && dealIdx !== -1) {
    cutIdx = Math.min(dataIdx, dealIdx);
  } else if (dataIdx !== -1) {
    cutIdx = dataIdx;
  } else if (dealIdx !== -1) {
    cutIdx = dealIdx;
  }
  if (cutIdx === -1) return raw;
  return raw.slice(0, cutIdx).trim();
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
  campaignId?: string;
  deal?: DispatchDealContext;
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

async function findOrCreateSupabaseConversation(
  userAId: string,
  userBId: string,
  machineId?: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !isUuid(userAId) || !isUuid(userBId)) return null;

  const machineUuid = isUuid(machineId) ? machineId : null;

  const findExistingConv = async () => {
    let q = supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_a.eq.${userAId},participant_b.eq.${userBId}),and(participant_a.eq.${userBId},participant_b.eq.${userAId})`
      );
    q = machineUuid ? q.eq('machine_id', machineUuid) : q.is('machine_id', null);
    const { data: rows } = await q.limit(1);
    if (rows && rows.length > 0) return rows[0].id as string;

    let qAlt = supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${userAId},participant_two.eq.${userBId}),and(participant_one.eq.${userBId},participant_two.eq.${userAId})`
      );
    qAlt = machineUuid ? qAlt.eq('machine_id', machineUuid) : qAlt.is('machine_id', null);
    const { data: altRows } = await qAlt.limit(1);
    if (altRows && altRows.length > 0) return altRows[0].id as string;
    return null;
  };

  let convId = await findExistingConv();
  if (convId) return convId;

  const insertConvPrimary: any = {
    participant_a: userAId,
    participant_b: userBId,
  };
  if (machineUuid) insertConvPrimary.machine_id = machineUuid;

  const { data: createdConv, error: convErr } = await supabase
    .from('conversations')
    .insert(insertConvPrimary)
    .select('id')
    .maybeSingle();

  if (!convErr && createdConv?.id) {
    return createdConv.id;
  }

  const insertConvFull: any = {
    ...insertConvPrimary,
    participant_one: userAId,
    participant_two: userBId,
  };
  const { data: createdAlt } = await supabase
    .from('conversations')
    .insert(insertConvFull)
    .select('id')
    .maybeSingle();

  return createdAlt?.id || (await findExistingConv());
}

async function insertSupabaseMessageAdaptive(
  convId: string,
  senderId: string,
  fullBody: string,
  fixedId?: string
): Promise<boolean> {
  const base: any = {
    conversation_id: convId,
    sender_id: senderId,
  };
  if (fixedId && isUuid(fixedId)) {
    base.id = fixedId;
  }

  const { error: bodyErr } = await supabase.from('messages').insert({
    ...base,
    body: fullBody,
  });

  let msgInserted = !bodyErr;

  if (!msgInserted) {
    const { error: contentErr } = await supabase.from('messages').insert({
      ...base,
      content: fullBody,
      body: fullBody,
    });
    if (!contentErr) {
      msgInserted = true;
    } else {
      const { error: contentOnlyErr } = await supabase.from('messages').insert({
        ...base,
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
  }
  return msgInserted;
}

async function sendFallbackDispatchMessage(params: {
  contractorId: string;
  ownerId: string;
  machineId?: string;
  notification: DispatchNotification;
  skipIfExistsInConv?: boolean;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !isUuid(params.contractorId) || !isUuid(params.ownerId)) {
    return false;
  }

  try {
    const convId = await findOrCreateSupabaseConversation(
      params.contractorId,
      params.ownerId,
      params.machineId
    );
    if (!convId) return false;

    if (params.skipIfExistsInConv) {
      const { data: existingMsgs } = await supabase
        .from('messages')
        .select('id, body, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(10);

      const alreadyHasCampaign = (existingMsgs || []).some((m: any) => {
        const txt = String(m.body || m.content || '');
        return txt.includes(params.notification.campaign_id);
      });
      if (alreadyHasCampaign) return true;
    }

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
      site_lat: params.notification.site_lat,
      site_lng: params.notification.site_lng,
      site_phone: params.notification.site_phone,
      distance_km: params.notification.distance_km,
      is_nationwide: params.notification.is_nationwide,
      radius_km: params.notification.radius_km,
      notes: params.notification.notes,
      contractor_accepted: Boolean(params.notification.contractor_accepted),
      owner_accepted: Boolean(params.notification.owner_accepted),
      deal_status: params.notification.deal_status || 'open',
    });

    const fullBody = `${readableHeader}${DISPATCH_MSG_MARKER}${encodedPayload}`;

    return await insertSupabaseMessageAdaptive(
      convId,
      params.contractorId,
      fullBody,
      params.notification.id
    );
  } catch (err) {
    console.warn('Dispatch chat fallback warning:', err);
  }
  return false;
}

export async function ensureDispatchConversationLinked(params: {
  contractorId: string;
  ownerId: string;
  notification: DispatchNotification;
}): Promise<void> {
  try {
    await sendFallbackDispatchMessage({
      contractorId: params.contractorId,
      ownerId: params.ownerId,
      machineId: params.notification.machine_id,
      notification: params.notification,
      skipIfExistsInConv: true,
    });
  } catch {
    // non-fatal
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
  const resolvedCampaignId = makeUuid();

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
    contractor_accepted: false,
    owner_accepted: false,
    deal_status: 'open',
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

  // Channel 2: Existing Supabase public.notifications table (no .select()!)
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

  // Channel 3: Guaranteed Supabase Realtime conversations + messages (carries site coords for deal acceptance)
  if (isSupabaseConfigured && preparedNotifs.length > 0) {
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

  // Channel 4: Express Server SQLite /api/notifications
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

  // Channel 5: Background OS Web Push VAPID (wakes closed/backgrounded phones in notification shade)
  if (preparedNotifs.length > 0) {
    sendWebPushForDispatch({
      ownerIds: Array.from(new Set(preparedNotifs.map((n) => n.owner_id))),
      title: 'فرصة جديدة 🎉',
      body: `«${params.companyName}» محتاجة «${params.machineName}» ديالك`,
      tag: resolvedCampaignId,
      url: '/owner/messages',
    }).catch(() => {});
  }

  const persistedToSupabase = dispatchNotifsSent || genericNotifsSent || chatFallbackSent;

  const finalCampaign: DispatchCampaign = {
    ...campaignPayload,
    created_at: now,
    notifications: preparedNotifs,
  };

  // Channel 6: Local persistence & BroadcastChannel
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
    site_lat: data.site_lat != null ? Number(data.site_lat) : undefined,
    site_lng: data.site_lng != null ? Number(data.site_lng) : undefined,
    site_phone: data.site_phone || '',
    distance_km: data.distance_km != null ? Number(data.distance_km) : null,
    is_nationwide: Boolean(data.is_nationwide),
    radius_km: data.radius_km != null ? Number(data.radius_km) : null,
    notes: data.notes || '',
    status: data.status || (row.is_read || row.read ? 'read' : 'sent'),
    is_read: Boolean(row.is_read || row.read),
    contractor_accepted: Boolean(data.contractor_accepted),
    owner_accepted: Boolean(data.owner_accepted),
    deal_status: (data.deal_status as DispatchDealStatus) || 'open',
    booking_id: data.booking_id || null,
    created_at: row.created_at || new Date().toISOString(),
  };
}

export function parseDispatchMessageRow(msg: any, ownerId: string): DispatchNotification | null {
  const rawBody = String(msg?.body || msg?.content || '');
  const idx = rawBody.indexOf('#DISPATCH_DATA:');
  if (idx === -1) return null;
  try {
    const afterMarker = rawBody.slice(idx + '#DISPATCH_DATA:'.length);
    const dealIdx = afterMarker.indexOf('#DISPATCH_DEAL:');
    const jsonPart = (dealIdx === -1 ? afterMarker : afterMarker.slice(0, dealIdx)).trim();
    const data = JSON.parse(jsonPart);
    if (!data || (data.owner_id && data.owner_id !== ownerId)) return null;
    if (data.deal_status === 'closed_other' || data.status === 'dismissed') return null;
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
      site_lat: data.site_lat != null ? Number(data.site_lat) : undefined,
      site_lng: data.site_lng != null ? Number(data.site_lng) : undefined,
      site_phone: data.site_phone || '',
      distance_km: data.distance_km != null ? Number(data.distance_km) : null,
      is_nationwide: Boolean(data.is_nationwide),
      radius_km: data.radius_km != null ? Number(data.radius_km) : null,
      notes: data.notes || '',
      status: isRead ? 'read' : 'sent',
      is_read: isRead,
      contractor_accepted: Boolean(data.contractor_accepted),
      owner_accepted: Boolean(data.owner_accepted),
      deal_status: (data.deal_status as DispatchDealStatus) || 'open',
      created_at: msg.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseDispatchDealMessageRow(msg: any): Partial<DispatchDealContext> | null {
  const rawBody = String(msg?.body || msg?.content || '');
  const idx = rawBody.indexOf('#DISPATCH_DEAL:');
  if (idx === -1) return null;
  try {
    const jsonPart = rawBody.slice(idx + '#DISPATCH_DEAL:'.length).trim();
    const data = JSON.parse(jsonPart);
    if (!data || !data.campaign_id) return null;
    return data as Partial<DispatchDealContext>;
  } catch {
    return null;
  }
}

export async function fetchOwnerDispatchNotifications(ownerId: string): Promise<DispatchNotification[]> {
  if (!ownerId) return [];

  const mergedByCampaign = new Map<string, DispatchNotification>();

  const mergeNotif = (item: DispatchNotification, preferIncoming: boolean) => {
    if (!item || item.status === 'dismissed' || item.deal_status === 'closed_other') return;
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
        .limit(20);

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
      if (c.contractor_id === contractorId) {
        const existing = campaignsMap.get(c.id);
        if (!existing) {
          campaignsMap.set(c.id, c);
        } else if (c.status === 'closed' && existing.status !== 'closed') {
          campaignsMap.set(c.id, { ...existing, ...c, notifications: existing.notifications || c.notifications });
        }
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
  updates: {
    status?: DispatchNotification['status'];
    is_read?: boolean;
    contractor_accepted?: boolean;
    owner_accepted?: boolean;
    deal_status?: DispatchDealStatus;
    booking_id?: string | null;
  },
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
      n.id === notificationId || (campaignId && n.campaign_id === campaignId && n.owner_id === notificationId)
        ? { ...n, ...updates }
        : n
    );
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'NOTIF_UPDATED' });
  } catch {
    // ignore
  }
}

export async function closeDispatchCampaign(
  campaignId: string,
  winner?: {
    won_owner_id?: string;
    won_machine_id?: string;
    won_machine_title?: string;
    booking_id?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const patchPayload: any = {
    status: 'closed',
    ...(winner?.won_owner_id ? { won_owner_id: winner.won_owner_id } : {}),
    ...(winner?.won_machine_id ? { won_machine_id: winner.won_machine_id } : {}),
    ...(winner?.won_machine_title ? { won_machine_title: winner.won_machine_title } : {}),
    ...(winner?.booking_id ? { booking_id: winner.booking_id } : {}),
    ...(winner ? { won_at: now } : {}),
  };

  if (isSupabaseConfigured && isUuid(campaignId)) {
    try {
      const { error } = await supabase
        .from('dispatch_campaigns')
        .update(patchPayload)
        .eq('id', campaignId);
      if (error) {
        await supabase.from('dispatch_campaigns').update({ status: 'closed' }).eq('id', campaignId);
      }
    } catch {
      // ignore if dispatch_campaigns table missing
    }
  }

  try {
    const local: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    const updated = local.map((c) =>
      c.id === campaignId
        ? {
            ...c,
            ...patchPayload,
            status: 'closed' as const,
          }
        : c
    );
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(updated));
    broadcastDispatchEvent({ type: 'CAMPAIGN_UPDATED', campaignId });
  } catch {
    // ignore
  }
}

export async function relocateMachineToSite(params: {
  machineId?: string;
  siteLat?: number;
  siteLng?: number;
  siteCity?: string;
}): Promise<void> {
  const { machineId, siteLat, siteLng, siteCity } = params;
  if (!machineId || siteLat == null || siteLng == null || !Number.isFinite(siteLat) || !Number.isFinite(siteLng)) {
    return;
  }

  // 1. Update local machineStore immediately
  try {
    const cached = machineStore.getCachedMachines();
    const existing = cached.find((m) => m.id === machineId);
    if (existing) {
      machineStore.saveMachine({
        ...existing,
        lat: siteLat,
        lng: siteLng,
        location_lat: siteLat,
        location_lng: siteLng,
        city: siteCity || existing.city,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }

  // 2. Update Express SQLite /api/machines/:id/location
  try {
    await fetch(`/api/machines/${encodeURIComponent(machineId)}/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: siteLat,
        lng: siteLng,
        city: siteCity || '',
      }),
    });
  } catch {
    // ignore
  }

  // 3. Update Supabase public.machines (adaptive across lat/lng vs location_lat/location_lng)
  if (isSupabaseConfigured && isUuid(machineId)) {
    try {
      const updatePayload: any = {
        lat: siteLat,
        lng: siteLng,
      };
      if (siteCity) updatePayload.city = siteCity;

      const { error } = await supabase
        .from('machines')
        .update(updatePayload)
        .eq('id', machineId);

      if (error) {
        const msg = error.message || '';
        if (msg.includes('lat') || msg.includes('lng')) {
          const altPayload: any = {
            location_lat: siteLat,
            location_lng: siteLng,
          };
          if (siteCity) altPayload.city = siteCity;
          await supabase.from('machines').update(altPayload).eq('id', machineId);
        }
      }
    } catch {
      // RLS may prevent non-owner from updating machines when contractor clicks 2nd;
      // Owner listener / RPC handles that cleanly.
    }
  }

  window.dispatchEvent(
    new CustomEvent('jadijcb_machines_updated', {
      detail: { action: 'relocated', machineId, siteLat, siteLng, siteCity },
    })
  );
}

export async function fetchDispatchContextForConversation(params: {
  currentUserId: string;
  otherUserId: string;
  machineId?: string | null;
  campaignIdHint?: string | null;
  messages?: any[];
}): Promise<DispatchDealContext | null> {
  const { currentUserId, otherUserId, machineId, campaignIdHint, messages = [] } = params;
  if (!currentUserId || !otherUserId) return null;

  let baseData: any = null;
  let latestDealMsg: Partial<DispatchDealContext> | null = null;

  // 1. Scan messages (most reliable cross-device channel shared by both participants)
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!latestDealMsg) {
      const parsedDeal = parseDispatchDealMessageRow(m);
      if (parsedDeal) {
        latestDealMsg = parsedDeal;
      }
    }
    if (!baseData) {
      const rawBody = String(m?.body || m?.content || '');
      const idx = rawBody.indexOf('#DISPATCH_DATA:');
      if (idx !== -1) {
        try {
          const after = rawBody.slice(idx + '#DISPATCH_DATA:'.length);
          const nextIdx = after.indexOf('#DISPATCH_DEAL:');
          const jsonPart = (nextIdx === -1 ? after : after.slice(0, nextIdx)).trim();
          const parsed = JSON.parse(jsonPart);
          if (parsed && parsed.campaign_id) {
            baseData = parsed;
          }
        } catch {
          // ignore parse error
        }
      }
    }
    if (baseData && latestDealMsg) break;
  }

  const campaignId = latestDealMsg?.campaign_id || baseData?.campaign_id || campaignIdHint || undefined;

  // 2. Check Supabase dispatch_notifications & dispatch_campaigns
  let dbNotif: any = null;
  let dbCampaign: any = null;

  if (isSupabaseConfigured && (isUuid(campaignId) || (isUuid(currentUserId) && isUuid(otherUserId)))) {
    try {
      if (isUuid(campaignId)) {
        let q = supabase
          .from('dispatch_notifications')
          .select('*')
          .eq('campaign_id', campaignId)
          .or(
            `and(owner_id.eq.${currentUserId},contractor_id.eq.${otherUserId}),and(owner_id.eq.${otherUserId},contractor_id.eq.${currentUserId})`
          );
        if (isUuid(machineId)) {
          q = q.eq('machine_id', machineId);
        }
        const { data } = await q.order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) dbNotif = data[0];
      } else if (isUuid(currentUserId) && isUuid(otherUserId)) {
        let q = supabase
          .from('dispatch_notifications')
          .select('*')
          .or(
            `and(owner_id.eq.${currentUserId},contractor_id.eq.${otherUserId}),and(owner_id.eq.${otherUserId},contractor_id.eq.${currentUserId})`
          );
        if (isUuid(machineId)) {
          q = q.eq('machine_id', machineId);
        }
        const { data } = await q.order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) dbNotif = data[0];
      }
    } catch {
      // ignore if table not present
    }

    const resolvedCampId = dbNotif?.campaign_id || campaignId;
    if (isUuid(resolvedCampId)) {
      try {
        const { data: campRow } = await supabase
          .from('dispatch_campaigns')
          .select('*')
          .eq('id', resolvedCampId)
          .maybeSingle();
        if (campRow) dbCampaign = campRow;
      } catch {
        // ignore
      }
    }
  }

  // 3. Local storage fallback check
  let localNotif: DispatchNotification | undefined;
  let localCamp: DispatchCampaign | undefined;
  try {
    const allLocalNotifs: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    localNotif = allLocalNotifs.find((n) => {
      if (campaignId && n.campaign_id !== campaignId) return false;
      const matchesUsers =
        (n.owner_id === currentUserId && n.contractor_id === otherUserId) ||
        (n.owner_id === otherUserId && n.contractor_id === currentUserId);
      if (!matchesUsers) return false;
      if (machineId && n.machine_id && n.machine_id !== machineId) return false;
      return true;
    });

    const targetCampId = campaignId || localNotif?.campaign_id;
    if (targetCampId) {
      const allLocalCamps: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
      localCamp = allLocalCamps.find((c) => c.id === targetCampId);
    }
  } catch {
    // ignore
  }

  const finalCampId =
    dbNotif?.campaign_id ||
    latestDealMsg?.campaign_id ||
    baseData?.campaign_id ||
    localNotif?.campaign_id ||
    campaignIdHint;

  if (!finalCampId) return null;

  const ownerId =
    dbNotif?.owner_id ||
    latestDealMsg?.owner_id ||
    baseData?.owner_id ||
    localNotif?.owner_id ||
    '';

  const contractorId =
    dbNotif?.contractor_id ||
    latestDealMsg?.contractor_id ||
    baseData?.contractor_id ||
    localNotif?.contractor_id ||
    dbCampaign?.contractor_id ||
    localCamp?.contractor_id ||
    '';

  if (!ownerId || !contractorId) return null;

  const contractorAccepted = Boolean(
    dbNotif?.contractor_accepted || latestDealMsg?.contractor_accepted || localNotif?.contractor_accepted
  );
  const ownerAccepted = Boolean(
    dbNotif?.owner_accepted || latestDealMsg?.owner_accepted || localNotif?.owner_accepted
  );

  let dealStatus: DispatchDealStatus =
    (latestDealMsg?.deal_status as DispatchDealStatus) ||
    (dbNotif?.deal_status as DispatchDealStatus) ||
    (localNotif?.deal_status as DispatchDealStatus) ||
    'open';

  if (contractorAccepted && ownerAccepted) {
    dealStatus = 'accepted';
  } else if (
    (dbCampaign?.status === 'closed' && dbCampaign?.won_owner_id && dbCampaign.won_owner_id !== ownerId) ||
    (localCamp?.status === 'closed' && localCamp?.won_owner_id && localCamp.won_owner_id !== ownerId) ||
    dbNotif?.status === 'dismissed'
  ) {
    dealStatus = 'closed_other';
  } else if (
    (dbCampaign?.status === 'closed' && dbCampaign?.won_owner_id === ownerId) ||
    (localCamp?.status === 'closed' && localCamp?.won_owner_id === ownerId)
  ) {
    dealStatus = 'accepted';
  } else if (dealStatus === 'open') {
    if (contractorAccepted && !ownerAccepted) dealStatus = 'pending_owner';
    else if (ownerAccepted && !contractorAccepted) dealStatus = 'pending_contractor';
  }

  return {
    campaign_id: finalCampId,
    notification_id: dbNotif?.id || latestDealMsg?.notification_id || baseData?.id || localNotif?.id,
    contractor_id: contractorId,
    owner_id: ownerId,
    machine_id:
      dbNotif?.machine_id ||
      latestDealMsg?.machine_id ||
      baseData?.machine_id ||
      localNotif?.machine_id ||
      machineId ||
      undefined,
    company_name:
      dbNotif?.company_name ||
      latestDealMsg?.company_name ||
      baseData?.company_name ||
      dbCampaign?.company_name ||
      localCamp?.company_name ||
      'مقاولة أشغال',
    machine_name:
      dbNotif?.machine_name ||
      latestDealMsg?.machine_name ||
      baseData?.machine_name ||
      dbCampaign?.machine_name ||
      localCamp?.machine_name ||
      'آلية بناء',
    matched_machine_title:
      dbNotif?.matched_machine_title ||
      latestDealMsg?.matched_machine_title ||
      baseData?.matched_machine_title ||
      localNotif?.matched_machine_title,
    site_id: dbCampaign?.site_id || localCamp?.site_id || latestDealMsg?.site_id || baseData?.site_id,
    site_name:
      dbNotif?.site_name ||
      dbCampaign?.site_name ||
      latestDealMsg?.site_name ||
      baseData?.site_name ||
      localCamp?.site_name ||
      'ورش البناء',
    site_city:
      dbNotif?.site_city ||
      dbCampaign?.site_city ||
      latestDealMsg?.site_city ||
      baseData?.site_city ||
      localCamp?.site_city ||
      '',
    site_lat:
      dbNotif?.site_lat ??
      dbCampaign?.site_lat ??
      latestDealMsg?.site_lat ??
      baseData?.site_lat ??
      localCamp?.site_lat,
    site_lng:
      dbNotif?.site_lng ??
      dbCampaign?.site_lng ??
      latestDealMsg?.site_lng ??
      baseData?.site_lng ??
      localCamp?.site_lng,
    site_phone:
      dbNotif?.site_phone ||
      dbCampaign?.site_phone ||
      latestDealMsg?.site_phone ||
      baseData?.site_phone ||
      localCamp?.site_phone ||
      '',
    notes:
      dbNotif?.notes ||
      dbCampaign?.notes ||
      latestDealMsg?.notes ||
      baseData?.notes ||
      localCamp?.notes ||
      '',
    contractor_accepted: contractorAccepted || dealStatus === 'accepted',
    owner_accepted: ownerAccepted || dealStatus === 'accepted',
    deal_status: dealStatus,
    booking_id:
      dbNotif?.booking_id ||
      dbCampaign?.booking_id ||
      latestDealMsg?.booking_id ||
      localCamp?.booking_id ||
      null,
  };
}

export async function acceptDispatchDealParty(params: {
  deal: DispatchDealContext;
  partyRole: 'contractor' | 'owner';
  currentUserId: string;
  conversationId: string;
}): Promise<{ updatedDeal: DispatchDealContext; finalized: boolean; bookingId?: string | null }> {
  const { deal, partyRole, currentUserId, conversationId } = params;

  // Refresh deal state from server/cache first so we catch if the other party just pressed accept!
  const latest =
    (await fetchDispatchContextForConversation({
      currentUserId,
      otherUserId: partyRole === 'contractor' ? deal.owner_id : deal.contractor_id,
      machineId: deal.machine_id,
      campaignIdHint: deal.campaign_id,
    })) || deal;

  if (latest.deal_status === 'closed_other' || latest.deal_status === 'accepted') {
    return {
      updatedDeal: latest,
      finalized: latest.deal_status === 'accepted',
      bookingId: latest.booking_id,
    };
  }

  const nextContractorAccepted = partyRole === 'contractor' ? true : Boolean(latest.contractor_accepted);
  const nextOwnerAccepted = partyRole === 'owner' ? true : Boolean(latest.owner_accepted);
  const bothAccepted = nextContractorAccepted && nextOwnerAccepted;

  let createdBookingId: string | null = latest.booking_id || null;

  if (!bothAccepted) {
    const partialStatus: DispatchDealStatus =
      partyRole === 'contractor' ? 'pending_owner' : 'pending_contractor';

    const updatedDeal: DispatchDealContext = {
      ...latest,
      contractor_accepted: nextContractorAccepted,
      owner_accepted: nextOwnerAccepted,
      deal_status: partialStatus,
    };

    if (latest.notification_id) {
      await updateDispatchNotificationStatus(
        latest.notification_id,
        {
          is_read: true,
          status: 'accepted',
          contractor_accepted: nextContractorAccepted,
          owner_accepted: nextOwnerAccepted,
          deal_status: partialStatus,
        },
        latest.campaign_id
      );
    }

    const partyPrompt =
      partyRole === 'contractor'
        ? `🤝 وافقت المقاولة على الصفقة! في انتظار ضغط المالك على زر «قبول الصفقة» لتثبيت الحجز ونقل موقع الآلية إلى الورش.`
        : `🤝 وافق مالك الآلية على الصفقة! في انتظار ضغط المقاولة على زر «قبول الصفقة» لتثبيت الحجز ونقل موقع الآلية إلى الورش.`;

    const serializedDeal = JSON.stringify(updatedDeal);
    const fullText = `${partyPrompt}${DISPATCH_DEAL_MARKER}${serializedDeal}`;

    await chatStore.sendMessage(
      conversationId,
      currentUserId,
      fullText,
      partyRole === 'contractor' ? latest.owner_id : latest.contractor_id
    );

    broadcastDispatchEvent({ type: 'DEAL_STEP_UPDATED', deal: updatedDeal });
    return { updatedDeal, finalized: false };
  }

  // ============================================================================
  // MUTUAL FINALIZATION (BOTH CONTRACTOR & OWNER ACCEPTED):
  //   1. Atomic RPC if deployed (creates booking, relocates machine, closes campaign & other notifs)
  //   2. Ensure booking exists in bookings DB + bookingStore (visible to Contractor & Owner)
  //   3. Relocate machine GPS/city to Contractor site
  //   4. Close campaign in contractor dashboard while keeping it visible
  //   5. Close all other offers & conversations for the same campaign_id
  // ============================================================================
  let machineObj: Partial<Machine> | undefined = machineStore
    .getCachedMachines()
    .find((m) => m.id === latest.machine_id);

  if (!machineObj && isSupabaseConfigured && isUuid(latest.machine_id)) {
    try {
      const { data: mRow } = await supabase
        .from('machines')
        .select('*')
        .eq('id', latest.machine_id)
        .maybeSingle();
      if (mRow) machineObj = mRow as Machine;
    } catch {
      // ignore
    }
  }

  const dailyRate = Number(machineObj?.rate_daily || machineObj?.daily_rate || 2000);
  const totalPrice = dailyRate * 7;

  let rpcSucceeded = false;
  if (isSupabaseConfigured && isUuid(latest.campaign_id)) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('accept_dispatch_deal', {
        p_campaign_id: latest.campaign_id,
        p_notification_id: isUuid(latest.notification_id) ? latest.notification_id : null,
        p_contractor_id: isUuid(latest.contractor_id) ? latest.contractor_id : currentUserId,
        p_owner_id: isUuid(latest.owner_id) ? latest.owner_id : currentUserId,
        p_machine_id: isUuid(latest.machine_id) ? latest.machine_id : null,
        p_site_name: latest.site_name || 'ورش أشغال',
        p_site_city: latest.site_city || '',
        p_site_lat: Number(latest.site_lat || 33.5731),
        p_site_lng: Number(latest.site_lng || -7.5898),
        p_company_name: latest.company_name || 'مقاولة أشغال',
        p_site_phone: latest.site_phone || '+212600000000',
        p_total_price: totalPrice,
        p_notes: latest.notes || '',
      });

      if (!rpcErr && rpcRes?.success) {
        rpcSucceeded = true;
        if (rpcRes.booking_id) createdBookingId = String(rpcRes.booking_id);
      }
    } catch {
      // Fallback below handles environments before SQL migration is applied
    }
  }

  const nowIso = new Date().toISOString();
  const endDateIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const resolvedBookingId = createdBookingId || makeUuid();

  // Direct booking fallback if RPC didn't create it yet
  if (!rpcSucceeded && isSupabaseConfigured && isUuid(latest.machine_id)) {
    const insertPayload: any = {
      id: resolvedBookingId,
      machine_id: latest.machine_id,
      owner_id: latest.owner_id,
      client_id: latest.contractor_id,
      client_name: latest.company_name || 'مقاولة أشغال',
      client_phone: latest.site_phone || '+212600000000',
      start_at: nowIso,
      end_at: endDateIso,
      total_price: totalPrice,
      status: 'active',
      site_address: `${latest.site_name}${latest.site_city ? ` · ${latest.site_city}` : ''}`,
      notes: `صفقة حملة بحث مباشر — الورش: ${latest.site_name}${latest.notes ? `\n${latest.notes}` : ''}`,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: bErr } = await supabase.from('bookings').insert(insertPayload);
      if (!bErr) {
        createdBookingId = resolvedBookingId;
        break;
      }
      const errMsg = bErr.message || '';
      if (errMsg.includes('BOOKING_CONFLICT')) {
        insertPayload.status = 'pending';
        continue;
      }
      const colMatch = errMsg.match(/Could not find the '([^']+)' column/i);
      if (colMatch && colMatch[1]) {
        delete insertPayload[colMatch[1]];
        continue;
      }
      break;
    }
  }

  // Always save to bookingStore + Express SQLite so Contractor & Owner UI refresh immediately
  const localBookingRecord: Booking = {
    id: createdBookingId || resolvedBookingId,
    machine_id: latest.machine_id || '',
    owner_id: latest.owner_id,
    client_id: latest.contractor_id,
    client_name: latest.company_name || 'مقاولة أشغال',
    client_phone: latest.site_phone || '+212600000000',
    start_at: nowIso,
    end_at: endDateIso,
    start_date: nowIso,
    end_date: endDateIso,
    total_price: totalPrice,
    with_operator: true,
    site_address: `${latest.site_name}${latest.site_city ? ` · ${latest.site_city}` : ''}`,
    status: 'active',
    notes: `صفقة حملة بحث مباشر — الورش: ${latest.site_name}${latest.notes ? `\n${latest.notes}` : ''}`,
    machine: machineObj,
    created_at: nowIso,
  };
  bookingStore.saveBooking(localBookingRecord);

  // Move machine to contractor's site in DB + local store
  await relocateMachineToSite({
    machineId: latest.machine_id,
    siteLat: latest.site_lat,
    siteLng: latest.site_lng,
    siteCity: latest.site_city || '',
  });

  // Close winning campaign (keeps visible in contractor dashboard)
  await closeDispatchCampaign(latest.campaign_id, {
    won_owner_id: latest.owner_id,
    won_machine_id: latest.machine_id,
    won_machine_title:
      latest.matched_machine_title ||
      machineObj?.title_ar ||
      machineObj?.title_fr ||
      latest.machine_name,
    booking_id: createdBookingId || resolvedBookingId,
  });

  // Mark winning notification accepted
  if (latest.notification_id) {
    await updateDispatchNotificationStatus(
      latest.notification_id,
      {
        is_read: true,
        status: 'accepted',
        contractor_accepted: true,
        owner_accepted: true,
        deal_status: 'accepted',
        booking_id: createdBookingId || resolvedBookingId,
      },
      latest.campaign_id
    );
  }

  // Close all OTHER notifications & conversations for this campaign
  try {
    const otherOwnerTargets: Array<{ owner_id: string; machine_id?: string }> = [];

    if (isSupabaseConfigured && isUuid(latest.campaign_id)) {
      const { data: otherNotifs } = await supabase
        .from('dispatch_notifications')
        .select('id, owner_id, machine_id')
        .eq('campaign_id', latest.campaign_id)
        .neq('owner_id', latest.owner_id);

      if (otherNotifs && otherNotifs.length > 0) {
        for (const o of otherNotifs as any[]) {
          otherOwnerTargets.push({ owner_id: o.owner_id, machine_id: o.machine_id });
        }
        await supabase
          .from('dispatch_notifications')
          .update({
            status: 'dismissed',
            deal_status: 'closed_other',
            is_read: true,
          })
          .eq('campaign_id', latest.campaign_id)
          .neq('owner_id', latest.owner_id);
      }
    }

    // Merge any other targets from local cache
    const localNotifs: DispatchNotification[] = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]');
    const updatedLocalNotifs = localNotifs.map((n) => {
      if (n.campaign_id !== latest.campaign_id) return n;
      if (n.owner_id === latest.owner_id) {
        return {
          ...n,
          status: 'accepted' as const,
          is_read: true,
          contractor_accepted: true,
          owner_accepted: true,
          deal_status: 'accepted' as const,
          booking_id: createdBookingId || resolvedBookingId,
        };
      }
      if (!otherOwnerTargets.some((t) => t.owner_id === n.owner_id)) {
        otherOwnerTargets.push({ owner_id: n.owner_id, machine_id: n.machine_id });
      }
      return {
        ...n,
        status: 'dismissed' as const,
        deal_status: 'closed_other' as const,
        is_read: true,
      };
    });
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updatedLocalNotifs));

    // Also inspect local campaigns cache
    const localCamps: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    const targetCamp = localCamps.find((c) => c.id === latest.campaign_id);
    if (targetCamp?.notifications) {
      for (const n of targetCamp.notifications) {
        if (
          n.owner_id !== latest.owner_id &&
          !otherOwnerTargets.some((t) => t.owner_id === n.owner_id)
        ) {
          otherOwnerTargets.push({ owner_id: n.owner_id, machine_id: n.machine_id });
        }
      }
    }

    // Post closure notice to every other conversation for this campaign
    if (isSupabaseConfigured && otherOwnerTargets.length > 0) {
      await Promise.allSettled(
        otherOwnerTargets.map(async (otherTarget) => {
          const otherConvId = await findOrCreateSupabaseConversation(
            latest.contractor_id,
            otherTarget.owner_id,
            otherTarget.machine_id
          );
          if (!otherConvId) return;

          const closedDealMeta: DispatchDealContext = {
            ...latest,
            owner_id: otherTarget.owner_id,
            machine_id: otherTarget.machine_id,
            deal_status: 'closed_other',
          };
          const closeMsg = `🔒 انتهت حملة البحث — تم الاتفاق وإغلاق الصفقة مع مالك آخر.${DISPATCH_DEAL_MARKER}${JSON.stringify(
            closedDealMeta
          )}`;
          await insertSupabaseMessageAdaptive(otherConvId, currentUserId, closeMsg);
        })
      );
    }
  } catch (closeErr) {
    console.warn('Closing other campaign conversations notice:', closeErr);
  }

  // Final confirmed deal context + message in the winning chat
  const finalizedDeal: DispatchDealContext = {
    ...latest,
    contractor_accepted: true,
    owner_accepted: true,
    deal_status: 'accepted',
    booking_id: createdBookingId || resolvedBookingId,
  };

  const confirmText = `✅🤝 تم قبول الصفقة من الطرفين! تم تأكيد الحجز في حجوزات الزبون وطلبات المالك، وتم تحديث موقع الآلية إلى ورش «${
    latest.site_name
  }».${DISPATCH_DEAL_MARKER}${JSON.stringify(finalizedDeal)}`;

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    confirmText,
    partyRole === 'contractor' ? latest.owner_id : latest.contractor_id
  );

  broadcastDispatchEvent({
    type: 'DEAL_ACCEPTED',
    campaignId: latest.campaign_id,
    deal: finalizedDeal,
  });

  return {
    updatedDeal: finalizedDeal,
    finalized: true,
    bookingId: createdBookingId || resolvedBookingId,
  };
}
