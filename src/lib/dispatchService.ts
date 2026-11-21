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
  DispatchCampaignType,
  DispatchDealContext,
  DispatchDealStatus,
  DispatchNotification,
  Machine,
  SupplierOrderDealItem,
  SupplierType,
  UserProfile,
} from '../types/database';
import { machineStore } from './machineStore';
import { bookingStore } from './bookingStore';
import { chatStore } from './chatStore';
import { serverApi } from './serverApi';
import { sendWebPushForDispatch } from './pushService';

const DISPATCH_CHANNEL_NAME = 'jadijcb_dispatch_channel';
const LOCAL_CAMPAIGNS_KEY = 'jadijcb_local_dispatch_campaigns';
const LOCAL_NOTIFS_KEY = 'jadijcb_local_dispatch_notifs';
const LOCAL_SUPPLIER_ORDERS_KEY = 'jadijcb_supplier_orders';
export const DISPATCH_MSG_MARKER = '\n#DISPATCH_DATA:';
export const DISPATCH_DEAL_MARKER = '\n#DISPATCH_DEAL:';

export function stripDispatchMarker(raw?: string | null): string {
  if (!raw) return '';
  const markers = [
    '#DISPATCH_DATA:',
    '#DISPATCH_DEAL:',
    '#DRIVER_OFFER:',
    '#DRIVER_DEAL:',
    '#DRIVER_CONTRACT:',
    '#DRIVER_CONTRACT_AGREE:',
    '#DRIVER_WORK_END:',
  ];
  let cutIdx = -1;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx !== -1 && (cutIdx === -1 || idx < cutIdx)) {
      cutIdx = idx;
    }
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

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const LIGHTWEIGHT_MACHINE_COLS =
  'id,owner_id,title_ar,title_fr,description_ar,description_fr,category,brand,model,year,listing_mode,condition,city,lat,lng,specs,is_published';
const LIGHTWEIGHT_SUPPLIER_PROFILE_COLS =
  'id,role,full_name,company_name,city,supplier_type,supplier_scope,import_countries,import_lead_time,supplier_specialties,delivers_nationwide';

export interface MatchedOwnerTarget {
  owner_id: string;
  machine_id: string;
  matched_machine_title: string;
  machine_city: string;
  distance_km: number;
  exact_reference_match?: boolean;
  is_importer?: boolean;
  supplier_type?: SupplierType;
  import_countries?: string[];
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  loader: ['loader', 'loaders', 'backhoe-loaders', 'backhoe', 'tractopelle', 'chargeuse', 'bobcat', 'tracteur_agricole', 'moissonneuse', 'jcb'],
  excavator: ['excavator', 'excavators', 'pelle', 'pelleteuse', 'pelle_chenilles', 'pelle_pneus', 'mini_pelle', 'brise_roche_carriere', 'foreuse'],
  bulldozer: ['bulldozer', 'bulldozers', 'bouteur', 'niveleuse'],
  crane: ['crane', 'cranes', 'grue', 'grue_mobile', 'grue_tour', 'camion_grue'],
  truck: ['truck', 'trucks', 'camion', 'benne', 'camion_benne', 'porte_char'],
  'concrete-mixer': ['concrete-mixer', 'concrete', 'toupie', 'malaxeur', 'camion_toupie', 'pompe_beton'],
  compactor: ['compactor', 'compactors', 'compacteur', 'rouleau', 'finisseur', 'fraiseuse_route'],
  generator: ['generator', 'generators', 'groupe-electrogene'],
  forklift: ['forklift', 'forklifts', 'chariot', 'telescopique', 'manitou', 'chariot_elevateur'],
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

export function resolveMachineCoordinates(machine: any): { lat: number; lng: number } | null {
  const rawLat = Number(machine?.lat ?? machine?.location_lat);
  const rawLng = Number(machine?.lng ?? machine?.location_lng);
  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && rawLat !== 0 && rawLng !== 0) {
    return { lat: rawLat, lng: rawLng };
  }
  const cityText = String(machine?.city || machine?.city_id || '').toLowerCase();
  const city = MOROCCAN_CITIES.find(
    (c) =>
      c.id.toLowerCase() === cityText ||
      c.name_ar.toLowerCase() === cityText ||
      c.name_fr.toLowerCase() === cityText
  );
  if (city) return { lat: city.lat, lng: city.lng };
  return null;
}

export function normalizePartReference(raw?: string | null): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\s\-_/\\.]+/g, '')
    .trim();
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

    const coords = resolveMachineCoordinates(m);
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

export async function findMatchingSparePartSuppliersForCampaign(params: {
  originLat: number;
  originLng: number;
  partReference: string;
  partCategory?: string;
  machineBrand?: string;
  machineModel?: string;
  radiusKm: number | null;
  isNationwide: boolean;
  excludeOwnerId?: string;
}): Promise<MatchedOwnerTarget[]> {
  let rawMachines: any[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('machines')
          .select(LIGHTWEIGHT_MACHINE_COLS)
          .eq('category', 'spare-parts')
          .neq('is_published', false),
        5000,
        { data: null, error: null } as any
      );

      if (!error && data) {
        rawMachines = data;
      }
    } catch (err) {
      console.warn('Error querying spare-parts suppliers:', err);
    }
  }

  if (rawMachines.length === 0) {
    rawMachines = machineStore.getCachedMachines().filter((m) => m.is_published !== false);
  }

  const normQueryRef = normalizePartReference(params.partReference);
  const queryBrand = String(params.machineBrand || '').trim().toLowerCase();
  const queryModel = String(params.machineModel || '').trim().toLowerCase();
  const requestedPartCat = String(params.partCategory || 'all').toLowerCase();

  const bestBySupplier = new Map<string, MatchedOwnerTarget & { priorityScore: number }>();

  for (const m of rawMachines) {
    if (!m.owner_id || m.owner_id === params.excludeOwnerId) continue;
    const cat = String(m.category || m.category_id || '').toLowerCase();
    if (cat !== 'spare-parts') continue;

    const coords = resolveMachineCoordinates(m);
    if (!coords && !params.isNationwide) continue;

    const distKm = coords
      ? calculateDistanceKm(params.originLat, params.originLng, coords.lat, coords.lng)
      : 0;

    if (!params.isNationwide && params.radiusKm !== null && distKm > params.radiusKm) {
      continue;
    }

    const specs = (m.specs || {}) as Record<string, any>;
    const listingRefNorm = normalizePartReference(specs.part_number || m.model);
    const fullText = `${m.title_ar || ''} ${m.title_fr || ''} ${m.description_ar || ''} ${m.description_fr || ''} ${m.brand || ''} ${m.model || ''} ${specs.part_number || ''} ${specs.compatible_models || ''}`;
    const fullTextNorm = normalizePartReference(fullText);
    const fullTextLower = fullText.toLowerCase();

    const isExactRefMatch =
      normQueryRef.length >= 2 &&
      ((listingRefNorm && (listingRefNorm === normQueryRef || listingRefNorm.includes(normQueryRef) || normQueryRef.includes(listingRefNorm))) ||
        fullTextNorm.includes(normQueryRef));

    const listingPartType = String(specs.part_type || '').toLowerCase();
    const isCatMatch = requestedPartCat === 'all' || !listingPartType || listingPartType === requestedPartCat;
    const isBrandMatch =
      (queryBrand.length >= 2 && fullTextLower.includes(queryBrand)) ||
      (queryModel.length >= 2 && fullTextLower.includes(queryModel));

    // If a specific part category is selected, require either exact ref match, matching part category, or matching brand/model
    if (requestedPartCat !== 'all' && !isExactRefMatch && listingPartType && listingPartType !== requestedPartCat && !isBrandMatch) {
      continue;
    }

    const priorityScore = (isExactRefMatch ? 100 : 0) + (isBrandMatch ? 20 : 0) + (isCatMatch ? 5 : 0);
    const title = m.title_ar || m.title_fr || `${m.brand || ''} ${m.model || ''}`.trim() || 'قطعة غيار';

    const existing = bestBySupplier.get(m.owner_id);
    if (
      !existing ||
      priorityScore > existing.priorityScore ||
      (priorityScore === existing.priorityScore && distKm < existing.distance_km)
    ) {
      bestBySupplier.set(m.owner_id, {
        owner_id: m.owner_id,
        machine_id: m.id,
        matched_machine_title: title,
        machine_city: m.city || '',
        distance_km: distKm,
        exact_reference_match: Boolean(isExactRefMatch),
        priorityScore,
      });
    }
  }

  // Also include ALL registered supplier/importer profiles (prioritizing spare-parts/all specialists)
  if (isSupabaseConfigured) {
    try {
      let supplierProfiles: any[] = [];
      const { data: qData, error: qErr } = await withTimeout(
        supabase
          .from('profiles')
          .select(LIGHTWEIGHT_SUPPLIER_PROFILE_COLS)
          .eq('role', 'supplier'),
        5000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (!qErr && Array.isArray(qData)) {
        supplierProfiles = qData;
      } else {
        const { data: fallbackData } = await withTimeout(
          supabase
            .from('profiles')
            .select(LIGHTWEIGHT_SUPPLIER_PROFILE_COLS)
            .limit(200),
          5000,
          { data: [] } as any
        );
        supplierProfiles = (fallbackData || []).filter(
          (sp: any) => sp?.role === 'supplier' || sp?.role === 'dealer'
        );
      }

      for (const sp of supplierProfiles) {
        if (!sp?.id || sp.id === params.excludeOwnerId) continue;
        const sType = String(sp.supplier_type || 'all') as SupplierType;
        const isSpareSpecialist = sType !== 'machinery_dealer';

        const canImport =
          sp.supplier_scope === 'local_and_import' ||
          sType === 'importer' ||
          (Array.isArray(sp.import_countries) && sp.import_countries.length > 0) ||
          Boolean(sp.import_lead_time);

        const coords = resolveMachineCoordinates({ city: sp.city });
        const distKm = coords
          ? calculateDistanceKm(params.originLat, params.originLng, coords.lat, coords.lng)
          : 0;

        const existing = bestBySupplier.get(sp.id);
        const specsList = Array.isArray(sp.supplier_specialties)
          ? sp.supplier_specialties.join(' ').toLowerCase()
          : '';
        const brandMatch =
          (queryBrand.length >= 2 && specsList.includes(queryBrand)) ||
          (queryModel.length >= 2 && specsList.includes(queryModel));
        const profileScore =
          10 + (isSpareSpecialist ? 30 : 0) + (brandMatch ? 15 : 0) + (canImport ? 5 : 0);

        if (!existing || profileScore > existing.priorityScore) {
          bestBySupplier.set(sp.id, {
            owner_id: existing?.owner_id || sp.id,
            machine_id: existing?.machine_id || '',
            matched_machine_title:
              existing?.matched_machine_title ||
              sp.company_name ||
              sp.full_name ||
              'مورد قطع الغيار',
            machine_city: existing?.machine_city || sp.city || '',
            distance_km: existing?.distance_km ?? distKm,
            exact_reference_match: existing?.exact_reference_match || false,
            is_importer: canImport,
            supplier_type: sType,
            import_countries: Array.isArray(sp.import_countries) ? sp.import_countries : [],
            priorityScore: Math.max(existing?.priorityScore || 0, profileScore),
          });
        }
      }
    } catch (err) {
      console.warn('Error querying supplier profiles for spare parts:', err);
    }
  }

  return Array.from(bestBySupplier.values())
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.distance_km - b.distance_km;
    })
    .map(({ priorityScore: _score, ...rest }) => rest);
}

export async function findMatchingMachinerySuppliersForCampaign(params: {
  originLat: number;
  originLng: number;
  machineCategory: string;
  machineName: string;
  desiredCondition?: 'any' | 'new' | 'used' | 'import';
  importAllowed?: boolean;
  preferredOrigin?: string;
  radiusKm: number | null;
  isNationwide: boolean;
  excludeOwnerId?: string;
}): Promise<MatchedOwnerTarget[]> {
  let rawMachines: any[] = [];
  let supplierProfiles: any[] = [];

  if (isSupabaseConfigured) {
    try {
      const [{ data: mData }, pRes] = await Promise.all([
        withTimeout(
          supabase
            .from('machines')
            .select(LIGHTWEIGHT_MACHINE_COLS)
            .eq('listing_mode', 'sale')
            .neq('is_published', false),
          5000,
          { data: null } as any
        ),
        withTimeout(
          supabase
            .from('profiles')
            .select(LIGHTWEIGHT_SUPPLIER_PROFILE_COLS)
            .eq('role', 'supplier'),
          5000,
          { data: null, error: { message: 'timeout' } } as any
        ),
      ]);
      if (mData) rawMachines = mData;
      if (!pRes.error && pRes.data) {
        supplierProfiles = pRes.data;
      } else {
        const { data: fallbackP } = await withTimeout(
          supabase
            .from('profiles')
            .select(LIGHTWEIGHT_SUPPLIER_PROFILE_COLS)
            .limit(200),
          5000,
          { data: [] } as any
        );
        supplierProfiles = (fallbackP || []).filter(
          (sp: any) => sp?.role === 'supplier' || sp?.role === 'dealer'
        );
      }
    } catch (err) {
      console.warn('Error querying machinery suppliers:', err);
    }
  }

  if (rawMachines.length === 0) {
    rawMachines = machineStore.getCachedMachines().filter((m) => m.is_published !== false);
  }

  const bestBySupplier = new Map<string, MatchedOwnerTarget & { priorityScore: number }>();
  const queryLower = String(params.machineName || '').trim().toLowerCase();
  const preferredOriginLower = String(params.preferredOrigin || '').trim().toLowerCase();
  const allowImporters = params.importAllowed !== false;

  // 1. Match sale / import listings in machines table
  for (const m of rawMachines) {
    if (!m.owner_id || m.owner_id === params.excludeOwnerId) continue;
    const cat = String(m.category || m.category_id || '').toLowerCase();
    if (cat === 'spare-parts') continue;
    if (m.listing_mode !== 'sale') continue;
    if (!matchesRequestedMachine(m, params.machineCategory, params.machineName)) continue;

    const specs = (m.specs || {}) as Record<string, any>;
    const isImportListing = Boolean(specs.is_imported || specs.is_import_order);
    if (!allowImporters && isImportListing) continue;
    if (params.desiredCondition === 'import' && !isImportListing) continue;
    if (params.desiredCondition === 'new' && m.condition !== 'new') continue;
    if (params.desiredCondition === 'used' && m.condition === 'new') continue;

    const coords = resolveMachineCoordinates(m);
    const distKm = coords
      ? calculateDistanceKm(params.originLat, params.originLng, coords.lat, coords.lng)
      : 0;

    if (!params.isNationwide && !isImportListing && params.radiusKm !== null && distKm > params.radiusKm) {
      continue;
    }

    const originMatch =
      preferredOriginLower &&
      String(specs.import_country || '').toLowerCase() === preferredOriginLower;
    const titleMatch =
      queryLower.length >= 2 &&
      `${m.title_ar || ''} ${m.title_fr || ''} ${m.brand || ''} ${m.model || ''}`
        .toLowerCase()
        .includes(queryLower);

    const priorityScore = 30 + (titleMatch ? 25 : 0) + (originMatch ? 20 : 0) + (isImportListing ? 5 : 0);
    const title = m.title_ar || m.title_fr || `${m.brand || ''} ${m.model || ''}`.trim() || 'آلية للبيع';

    const existing = bestBySupplier.get(m.owner_id);
    if (!existing || priorityScore > existing.priorityScore) {
      bestBySupplier.set(m.owner_id, {
        owner_id: m.owner_id,
        machine_id: m.id,
        matched_machine_title: title,
        machine_city: m.city || '',
        distance_km: distKm,
        exact_reference_match: Boolean(titleMatch),
        is_importer: isImportListing,
        import_countries: specs.import_country ? [String(specs.import_country)] : [],
        priorityScore,
      });
    }
  }

  // 2. Match ALL registered suppliers, dealers & international import companies (rank specialists highest)
  for (const sp of supplierProfiles) {
    if (!sp?.id || sp.id === params.excludeOwnerId) continue;
    const sType = String(sp.supplier_type || 'all') as SupplierType;
    const isMachinerySpecialist = sType !== 'spare_parts';

    const importCountries: string[] = Array.isArray(sp.import_countries) ? sp.import_countries : [];
    const canImport =
      sp.supplier_scope === 'local_and_import' ||
      sType === 'importer' ||
      importCountries.length > 0 ||
      Boolean(sp.import_lead_time);

    const originMatch =
      preferredOriginLower &&
      importCountries.some((c) => String(c).toLowerCase() === preferredOriginLower);

    const coords = resolveMachineCoordinates({ city: sp.city });
    const distKm = coords
      ? calculateDistanceKm(params.originLat, params.originLng, coords.lat, coords.lng)
      : 0;

    const specsList = Array.isArray(sp.supplier_specialties) ? sp.supplier_specialties.join(' ').toLowerCase() : '';
    const specMatch =
      (queryLower.length >= 2 && specsList.includes(queryLower)) ||
      (params.machineCategory && params.machineCategory !== 'all' && specsList.includes(params.machineCategory.toLowerCase()));

    const priorityScore =
      10 +
      (isMachinerySpecialist ? 30 : 0) +
      (canImport ? 10 : 5) +
      (originMatch ? 25 : 0) +
      (specMatch ? 15 : 0);

    const existing = bestBySupplier.get(sp.id);
    if (!existing || priorityScore > existing.priorityScore) {
      bestBySupplier.set(sp.id, {
        owner_id: sp.id,
        machine_id: existing?.machine_id || '',
        matched_machine_title:
          existing?.matched_machine_title ||
          sp.company_name ||
          sp.full_name ||
          (canImport ? 'مورد ومستورد آليات' : 'مورد آليات'),
        machine_city: existing?.machine_city || sp.city || '',
        distance_km: existing?.distance_km ?? distKm,
        exact_reference_match: Boolean(existing?.exact_reference_match || originMatch),
        is_importer: canImport || existing?.is_importer,
        supplier_type: sType,
        import_countries: importCountries.length > 0 ? importCountries : existing?.import_countries || [],
        priorityScore: Math.max(existing?.priorityScore || 0, priorityScore),
      });
    }
  }

  return Array.from(bestBySupplier.values())
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.distance_km - b.distance_km;
    })
    .map(({ priorityScore: _score, ...rest }) => rest);
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

    const isSpare =
      params.notification.campaign_type === 'spare_part' || Boolean(params.notification.part_reference);
    const isPurchase = params.notification.campaign_type === 'machine_purchase';

    const readableHeader = isSpare
      ? `🔧 طلب قطعة غيار عاجل — «${params.notification.company_name}» يبحث عن Réf: ${
          params.notification.part_reference || params.notification.machine_name
        }${distText ? ` (${distText})` : ''}\n📍 ${params.notification.site_name}${
          params.notification.site_city ? ` · ${params.notification.site_city}` : ''
        }`
      : isPurchase
      ? `🚢 طلب شراء / استيراد آلية — «${params.notification.company_name}» يبحث عن «${
          params.notification.machine_name
        }»${
          params.notification.budget_mad
            ? ` (الميزانية: ${Number(params.notification.budget_mad).toLocaleString()} د.م)`
            : ''
        }${distText ? ` · ${distText}` : ''}\n📍 ${params.notification.site_name}${
          params.notification.site_city ? ` · ${params.notification.site_city}` : ''
        }`
      : `🎉 فرصة جديدة — «${params.notification.company_name}» محتاجة «${params.notification.machine_name}» ديالك${
          distText ? ` (${distText})` : ''
        }\n📍 ${params.notification.site_name}${
          params.notification.site_city ? ` · ${params.notification.site_city}` : ''
        }`;

    const encodedPayload = JSON.stringify({
      id: params.notification.id,
      campaign_id: params.notification.campaign_id,
      owner_id: params.ownerId,
      contractor_id: params.contractorId,
      machine_id: params.machineId || null,
      campaign_type:
        params.notification.campaign_type ||
        (isSpare ? 'spare_part' : isPurchase ? 'machine_purchase' : 'machine'),
      part_reference: params.notification.part_reference || '',
      part_category: params.notification.part_category || '',
      budget_mad: params.notification.budget_mad ?? null,
      import_allowed: params.notification.import_allowed ?? false,
      preferred_origin: params.notification.preferred_origin || '',
      desired_condition: params.notification.desired_condition || 'any',
      desired_model: params.notification.desired_model || '',
      customs_clearance: Boolean(params.notification.customs_clearance),
      has_fleet_machine: Boolean(params.notification.has_fleet_machine),
      fleet_machine_id: params.notification.fleet_machine_id || '',
      fleet_machine_title: params.notification.fleet_machine_title || '',
      fleet_machine_image: params.notification.fleet_machine_image || '',
      fleet_machine_brand: params.notification.fleet_machine_brand || '',
      fleet_machine_model: params.notification.fleet_machine_model || '',
      fleet_machine_year: params.notification.fleet_machine_year ?? null,
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
      contractor_terms_agreed: Boolean(params.notification.contractor_terms_agreed),
      owner_terms_agreed: Boolean(params.notification.owner_terms_agreed),
      agreed_price: params.notification.agreed_price ?? null,
      agreed_currency: params.notification.agreed_currency || 'MAD',
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
  campaignType?: DispatchCampaignType;
  partReference?: string;
  partCategory?: string;
  budgetMad?: number | null;
  importAllowed?: boolean;
  preferredOrigin?: string;
  desiredCondition?: 'any' | 'new' | 'used' | 'import';
  desiredModel?: string;
  customsClearance?: boolean;
  hasFleetMachine?: boolean;
  fleetMachineId?: string;
  fleetMachineTitle?: string;
  fleetMachineImage?: string;
  fleetMachineBrand?: string;
  fleetMachineModel?: string;
  fleetMachineYear?: number | null;
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
  const campaignType: DispatchCampaignType = params.campaignType || 'machine';
  const isSpare = campaignType === 'spare_part';
  const isPurchase = campaignType === 'machine_purchase';

  let authUid: string | null = isUuid(params.contractorId) ? params.contractorId : null;
  if (!authUid && isSupabaseConfigured) {
    try {
      const sessionRes = await withTimeout(
        supabase.auth.getSession(),
        2500,
        { data: { session: null } } as any
      );
      if (isUuid(sessionRes?.data?.session?.user?.id)) {
        authUid = sessionRes.data.session.user.id;
      }
    } catch {
      // ignore
    }
  }

  const effectiveContractorId = authUid || params.contractorId;
  let dispatchNotifsSent = false;
  let genericNotifsSent = false;
  let chatFallbackSent = false;

  // For supply campaigns (spare_part / machine_purchase), guarantee ALL suppliers are targeted even if UI scan hadn't finished
  let effectiveTargets: MatchedOwnerTarget[] = Array.isArray(params.targets) ? [...params.targets] : [];
  if ((isSpare || isPurchase) && effectiveTargets.length === 0) {
    try {
      effectiveTargets = await withTimeout(
        isPurchase
          ? findMatchingMachinerySuppliersForCampaign({
              originLat: params.siteLat,
              originLng: params.siteLng,
              machineCategory: params.machineCategory,
              machineName: params.machineName,
              desiredCondition: params.desiredCondition,
              importAllowed: params.importAllowed,
              preferredOrigin: params.preferredOrigin,
              radiusKm: params.radiusKm,
              isNationwide: params.isNationwide,
              excludeOwnerId: effectiveContractorId,
            })
          : findMatchingSparePartSuppliersForCampaign({
              originLat: params.siteLat,
              originLng: params.siteLng,
              partReference: params.partReference || params.machineName,
              partCategory: params.partCategory,
              machineBrand: params.fleetMachineBrand,
              machineModel: params.fleetMachineModel || params.desiredModel,
              radiusKm: params.radiusKm,
              isNationwide: params.isNationwide,
              excludeOwnerId: effectiveContractorId,
            }),
        5500,
        []
      );
    } catch {
      // ignore fallback scan failure
    }
  }

  const campaignPayload: any = {
    id: resolvedCampaignId,
    contractor_id: effectiveContractorId,
    company_name: params.companyName,
    campaign_type: campaignType,
    part_reference: params.partReference || '',
    part_category: params.partCategory || '',
    budget_mad: params.budgetMad ?? null,
    import_allowed: Boolean(params.importAllowed),
    preferred_origin: params.preferredOrigin || '',
    desired_condition: params.desiredCondition || 'any',
    desired_model: params.desiredModel || '',
    customs_clearance: Boolean(params.customsClearance),
    has_fleet_machine: Boolean(params.hasFleetMachine),
    fleet_machine_id: params.fleetMachineId || '',
    fleet_machine_title: params.fleetMachineTitle || '',
    fleet_machine_image: params.fleetMachineImage || '',
    fleet_machine_brand: params.fleetMachineBrand || '',
    fleet_machine_model: params.fleetMachineModel || '',
    fleet_machine_year: params.fleetMachineYear ?? null,
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
    matched_owners_count: effectiveTargets.length,
    status: 'active' as const,
  };

  const preparedNotifs: DispatchNotification[] = effectiveTargets.map((t) => ({
    id: makeUuid(),
    campaign_id: resolvedCampaignId,
    owner_id: t.owner_id,
    contractor_id: effectiveContractorId,
    machine_id: t.machine_id,
    campaign_type: campaignType,
    part_reference: params.partReference || '',
    part_category: params.partCategory || '',
    budget_mad: params.budgetMad ?? null,
    import_allowed: Boolean(params.importAllowed),
    preferred_origin: params.preferredOrigin || '',
    desired_condition: params.desiredCondition || 'any',
    desired_model: params.desiredModel || '',
    customs_clearance: Boolean(params.customsClearance),
    has_fleet_machine: Boolean(params.hasFleetMachine),
    fleet_machine_id: params.fleetMachineId || '',
    fleet_machine_title: params.fleetMachineTitle || '',
    fleet_machine_image: params.fleetMachineImage || '',
    fleet_machine_brand: params.fleetMachineBrand || '',
    fleet_machine_model: params.fleetMachineModel || '',
    fleet_machine_year: params.fleetMachineYear ?? null,
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
    contractor_terms_agreed: false,
    owner_terms_agreed: false,
    deal_status: 'open',
    created_at: now,
  }));

  const extractMissingColumnName = (msg?: string): string | null => {
    if (!msg) return null;
    const m1 = msg.match(/Could not find the '([^']+)' column/i);
    if (m1?.[1]) return m1[1];
    const m2 = msg.match(/column "([^"]+)" of relation/i);
    if (m2?.[1]) return m2[1];
    return null;
  };

  // Channel 1: Dedicated dispatch_campaigns + dispatch_notifications tables (adaptive for optional new columns)
  if (isSupabaseConfigured && isUuid(effectiveContractorId)) {
    try {
      const insertCampPayload = { ...campaignPayload };
      let campErr: any = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        const res = await withTimeout(
          supabase.from('dispatch_campaigns').insert(insertCampPayload),
          5000,
          { error: { message: 'timeout' } } as any
        );
        campErr = res.error;
        if (!campErr) break;
        const missingCol = extractMissingColumnName(campErr.message);
        if (missingCol && missingCol in insertCampPayload) {
          delete insertCampPayload[missingCol];
          continue;
        }
        break;
      }

      if (!campErr) {
        const validNotifs = preparedNotifs.filter((n) => isUuid(n.owner_id));
        if (validNotifs.length > 0) {
          let notifRows: Record<string, any>[] = validNotifs.map((n) => ({
            id: n.id,
            campaign_id: resolvedCampaignId,
            owner_id: n.owner_id,
            contractor_id: effectiveContractorId,
            machine_id: isUuid(n.machine_id) ? n.machine_id : null,
            campaign_type: campaignType,
            part_reference: params.partReference || '',
            part_category: params.partCategory || '',
            budget_mad: params.budgetMad ?? null,
            import_allowed: Boolean(params.importAllowed),
            preferred_origin: params.preferredOrigin || '',
            desired_condition: params.desiredCondition || 'any',
            desired_model: params.desiredModel || '',
            customs_clearance: Boolean(params.customsClearance),
            has_fleet_machine: Boolean(params.hasFleetMachine),
            fleet_machine_id: params.fleetMachineId || '',
            fleet_machine_title: params.fleetMachineTitle || '',
            fleet_machine_image: params.fleetMachineImage || '',
            fleet_machine_brand: params.fleetMachineBrand || '',
            fleet_machine_model: params.fleetMachineModel || '',
            fleet_machine_year: params.fleetMachineYear ?? null,
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

          let notifErr: any = null;
          for (let attempt = 0; attempt < 24; attempt++) {
            const res = await withTimeout(
              supabase.from('dispatch_notifications').insert(notifRows),
              5000,
              { error: { message: 'timeout' } } as any
            );
            notifErr = res.error;
            if (!notifErr) break;
            const missingCol = extractMissingColumnName(notifErr.message);
            if (missingCol) {
              notifRows = notifRows.map((row) => {
                const clone = { ...row };
                delete clone[missingCol];
                return clone;
              });
              continue;
            }
            break;
          }

          if (!notifErr) {
            dispatchNotifsSent = true;
          } else {
            console.warn('dispatch_notifications insert notice:', notifErr.message);
          }
        } else {
          dispatchNotifsSent = effectiveTargets.length === 0;
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
            title_ar: isSpare
              ? 'طلب قطعة غيار عاجل 🔧'
              : isPurchase
              ? 'طلب شراء / استيراد آلية 🚢'
              : 'فرصة جديدة 🎉',
            title_fr: isSpare
              ? 'Recherche pièce détachée 🔧'
              : isPurchase
              ? 'Demande achat / import engin 🚢'
              : 'Nouvelle opportunité 🎉',
            body_ar: isSpare
              ? `«${n.company_name}» يبحث عن قطعة الغيار Réf: ${params.partReference || n.machine_name} · ${distTextAr}`
              : isPurchase
              ? `«${n.company_name}» يبحث عن شراء «${n.machine_name}» · ${distTextAr}`
              : `«${n.company_name}» محتاجة «${n.machine_name}» ديالك · ${distTextAr}`,
            body_fr: isSpare
              ? `«${n.company_name}» recherche la pièce Réf: ${params.partReference || n.machine_name} · ${distTextFr}`
              : isPurchase
              ? `«${n.company_name}» cherche à acheter «${n.machine_name}» · ${distTextFr}`
              : `«${n.company_name}» recherche «${n.machine_name}» · ${distTextFr}`,
            type: 'dispatch_opportunity',
            data: {
              id: n.id,
              campaign_id: n.campaign_id,
              owner_id: n.owner_id,
              contractor_id: n.contractor_id,
              machine_id: n.machine_id || null,
              campaign_type: campaignType,
              part_reference: params.partReference || '',
              part_category: params.partCategory || '',
              budget_mad: params.budgetMad ?? null,
              import_allowed: Boolean(params.importAllowed),
              preferred_origin: params.preferredOrigin || '',
              desired_condition: params.desiredCondition || 'any',
              desired_model: params.desiredModel || '',
              customs_clearance: Boolean(params.customsClearance),
              has_fleet_machine: Boolean(params.hasFleetMachine),
              fleet_machine_id: params.fleetMachineId || '',
              fleet_machine_title: params.fleetMachineTitle || '',
              fleet_machine_image: params.fleetMachineImage || '',
              fleet_machine_brand: params.fleetMachineBrand || '',
              fleet_machine_model: params.fleetMachineModel || '',
              fleet_machine_year: params.fleetMachineYear ?? null,
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

        let adaptiveGenericRows: Record<string, any>[] = genericRows;
        let genErr: any = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const res = await withTimeout(
            supabase.from('notifications').insert(adaptiveGenericRows),
            4000,
            { error: { message: 'timeout' } } as any
          );
          genErr = res.error;
          if (!genErr) break;
          const missingCol = extractMissingColumnName(genErr.message);
          if (missingCol) {
            adaptiveGenericRows = adaptiveGenericRows.map((row) => {
              const clone = { ...row };
              delete clone[missingCol];
              return clone;
            });
            continue;
          }
          break;
        }

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

  // Channel 3: Conversations fallback (for equipment rental campaigns only; suppliers initiate chat manually via "ابدأ محادثة")
  if (isSupabaseConfigured && preparedNotifs.length > 0 && !isSpare && !isPurchase) {
    const results = await withTimeout(
      Promise.all(
        preparedNotifs.map((n) =>
          sendFallbackDispatchMessage({
            contractorId: effectiveContractorId,
            ownerId: n.owner_id,
            machineId: n.machine_id,
            notification: n,
          })
        )
      ),
      4500,
      [] as boolean[]
    );
    chatFallbackSent = results.some(Boolean);
  }

  // Channel 4: Express Server SQLite /api/notifications (non-blocking)
  if (preparedNotifs.length > 0) {
    void Promise.allSettled(
      preparedNotifs.map((n) =>
        serverApi.createNotification({
          user_id: n.owner_id,
          title_ar: isSpare
            ? 'طلب قطعة غيار عاجل 🔧'
            : isPurchase
            ? 'طلب شراء / استيراد آلية 🚢'
            : 'فرصة جديدة 🎉',
          title_fr: isSpare
            ? 'Recherche pièce détachée 🔧'
            : isPurchase
            ? 'Demande achat / import engin 🚢'
            : 'Nouvelle opportunité 🎉',
          body_ar: isSpare
            ? `«${n.company_name}» يبحث عن قطعة الغيار Réf: ${params.partReference || n.machine_name}`
            : isPurchase
            ? `«${n.company_name}» يبحث عن شراء «${n.machine_name}»`
            : `«${n.company_name}» محتاجة «${n.machine_name}» ديالك`,
          body_fr: isSpare
            ? `«${n.company_name}» recherche la pièce Réf: ${params.partReference || n.machine_name}`
            : isPurchase
            ? `«${n.company_name}» cherche à acheter «${n.machine_name}»`
            : `«${n.company_name}» recherche «${n.machine_name}»`,
          type: 'dispatch_opportunity',
          data: {
            id: n.id,
            campaign_id: n.campaign_id,
            owner_id: n.owner_id,
            contractor_id: n.contractor_id,
            machine_id: n.machine_id,
            campaign_type: campaignType,
            part_reference: params.partReference || '',
            part_category: params.partCategory || '',
            budget_mad: params.budgetMad ?? null,
            import_allowed: Boolean(params.importAllowed),
            preferred_origin: params.preferredOrigin || '',
            desired_condition: params.desiredCondition || 'any',
            desired_model: params.desiredModel || '',
            customs_clearance: Boolean(params.customsClearance),
            has_fleet_machine: Boolean(params.hasFleetMachine),
            fleet_machine_id: params.fleetMachineId || '',
            fleet_machine_title: params.fleetMachineTitle || '',
            fleet_machine_image: params.fleetMachineImage || '',
            fleet_machine_brand: params.fleetMachineBrand || '',
            fleet_machine_model: params.fleetMachineModel || '',
            fleet_machine_year: params.fleetMachineYear ?? null,
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

  // Channel 5: Background OS Web Push VAPID (non-blocking)
  if (preparedNotifs.length > 0) {
    sendWebPushForDispatch({
      ownerIds: Array.from(new Set(preparedNotifs.map((n) => n.owner_id))),
      title: isSpare
        ? 'طلب قطعة غيار عاجل 🔧'
        : isPurchase
        ? 'طلب شراء / استيراد آلية 🚢'
        : 'فرصة جديدة 🎉',
      body: isSpare
        ? `«${params.companyName}» يبحث عن Réf: ${params.partReference || params.machineName}`
        : isPurchase
        ? `«${params.companyName}» يبحث عن شراء «${params.machineName}»`
        : `«${params.companyName}» محتاجة «${params.machineName}» ديالك`,
      tag: resolvedCampaignId,
      url: isSpare || isPurchase ? '/supplier/requests' : '/owner/messages',
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
    campaign_type:
      data.campaign_type || (data.part_reference ? 'spare_part' : 'machine'),
    part_reference: data.part_reference || undefined,
    part_category: data.part_category || undefined,
    budget_mad: data.budget_mad ?? null,
    import_allowed: Boolean(data.import_allowed),
    preferred_origin: data.preferred_origin || undefined,
    desired_condition: data.desired_condition || undefined,
    desired_model: data.desired_model || undefined,
    customs_clearance: Boolean(data.customs_clearance),
    has_fleet_machine: Boolean(data.has_fleet_machine),
    fleet_machine_id: data.fleet_machine_id || undefined,
    fleet_machine_title: data.fleet_machine_title || undefined,
    fleet_machine_image: data.fleet_machine_image || undefined,
    fleet_machine_brand: data.fleet_machine_brand || undefined,
    fleet_machine_model: data.fleet_machine_model || undefined,
    fleet_machine_year: data.fleet_machine_year != null ? Number(data.fleet_machine_year) : null,
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
    contractor_terms_agreed: Boolean(data.contractor_terms_agreed),
    owner_terms_agreed: Boolean(data.owner_terms_agreed),
    agreed_price: data.agreed_price != null ? Number(data.agreed_price) : null,
    agreed_currency: data.agreed_currency || undefined,
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
      campaign_type:
        data.campaign_type || (data.part_reference ? 'spare_part' : 'machine'),
      part_reference: data.part_reference || undefined,
      part_category: data.part_category || undefined,
      budget_mad: data.budget_mad ?? null,
      import_allowed: Boolean(data.import_allowed),
      preferred_origin: data.preferred_origin || undefined,
      desired_condition: data.desired_condition || undefined,
      desired_model: data.desired_model || undefined,
      customs_clearance: Boolean(data.customs_clearance),
      has_fleet_machine: Boolean(data.has_fleet_machine),
      fleet_machine_id: data.fleet_machine_id || undefined,
      fleet_machine_title: data.fleet_machine_title || undefined,
      fleet_machine_image: data.fleet_machine_image || undefined,
      fleet_machine_brand: data.fleet_machine_brand || undefined,
      fleet_machine_model: data.fleet_machine_model || undefined,
      fleet_machine_year: data.fleet_machine_year != null ? Number(data.fleet_machine_year) : null,
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
      contractor_terms_agreed: Boolean(data.contractor_terms_agreed),
      owner_terms_agreed: Boolean(data.owner_terms_agreed),
      agreed_price: data.agreed_price != null ? Number(data.agreed_price) : null,
      agreed_currency: data.agreed_currency || undefined,
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
      const { data: msgRows, error: msgQueryErr } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, body, created_at')
        .neq('sender_id', ownerId)
        .or('body.ilike.%#DISPATCH_DATA:%,content.ilike.%#DISPATCH_DATA:%')
        .order('created_at', { ascending: false })
        .limit(15);

      if (!msgQueryErr && msgRows) {
        for (const m of msgRows) {
          const parsed = parseDispatchMessageRow(m, ownerId);
          if (parsed) mergeNotif(parsed, false);
        }
      } else if (msgQueryErr) {
        const { data: bodyOnlyRows } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, body, created_at')
          .neq('sender_id', ownerId)
          .ilike('body', '%#DISPATCH_DATA:%')
          .order('created_at', { ascending: false })
          .limit(15);
        for (const m of bodyOnlyRows || []) {
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
    contractor_terms_agreed?: boolean;
    owner_terms_agreed?: boolean;
    agreed_price?: number | null;
    agreed_currency?: 'MAD' | 'EUR';
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
  const contractorTermsAgreed = Boolean(
    dbNotif?.contractor_terms_agreed ||
      latestDealMsg?.contractor_terms_agreed ||
      localNotif?.contractor_terms_agreed ||
      contractorAccepted
  );
  const ownerTermsAgreed = Boolean(
    dbNotif?.owner_terms_agreed ||
      latestDealMsg?.owner_terms_agreed ||
      localNotif?.owner_terms_agreed ||
      ownerAccepted
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
    campaign_type:
      dbNotif?.campaign_type ||
      dbCampaign?.campaign_type ||
      latestDealMsg?.campaign_type ||
      baseData?.campaign_type ||
      localNotif?.campaign_type ||
      localCamp?.campaign_type ||
      (dbCampaign?.machine_category === 'spare-parts' || localCamp?.machine_category === 'spare-parts'
        ? 'spare_part'
        : 'machine'),
    part_reference:
      dbNotif?.part_reference ||
      dbCampaign?.part_reference ||
      latestDealMsg?.part_reference ||
      baseData?.part_reference ||
      localNotif?.part_reference ||
      localCamp?.part_reference ||
      undefined,
    part_category:
      dbNotif?.part_category ||
      dbCampaign?.part_category ||
      latestDealMsg?.part_category ||
      baseData?.part_category ||
      localNotif?.part_category ||
      localCamp?.part_category ||
      undefined,
    budget_mad:
      dbNotif?.budget_mad ??
      dbCampaign?.budget_mad ??
      latestDealMsg?.budget_mad ??
      baseData?.budget_mad ??
      localNotif?.budget_mad ??
      localCamp?.budget_mad ??
      null,
    import_allowed: Boolean(
      dbNotif?.import_allowed ??
      dbCampaign?.import_allowed ??
      latestDealMsg?.import_allowed ??
      baseData?.import_allowed ??
      localNotif?.import_allowed ??
      localCamp?.import_allowed
    ),
    preferred_origin:
      dbNotif?.preferred_origin ||
      dbCampaign?.preferred_origin ||
      latestDealMsg?.preferred_origin ||
      baseData?.preferred_origin ||
      localNotif?.preferred_origin ||
      localCamp?.preferred_origin ||
      undefined,
    desired_condition:
      dbNotif?.desired_condition ||
      dbCampaign?.desired_condition ||
      latestDealMsg?.desired_condition ||
      baseData?.desired_condition ||
      localNotif?.desired_condition ||
      localCamp?.desired_condition ||
      undefined,
    desired_model:
      dbNotif?.desired_model ||
      dbCampaign?.desired_model ||
      latestDealMsg?.desired_model ||
      baseData?.desired_model ||
      localNotif?.desired_model ||
      localCamp?.desired_model ||
      undefined,
    customs_clearance: Boolean(
      dbNotif?.customs_clearance ??
      dbCampaign?.customs_clearance ??
      latestDealMsg?.customs_clearance ??
      baseData?.customs_clearance ??
      localNotif?.customs_clearance ??
      localCamp?.customs_clearance
    ),
    has_fleet_machine: Boolean(
      dbNotif?.has_fleet_machine ??
      dbCampaign?.has_fleet_machine ??
      latestDealMsg?.has_fleet_machine ??
      baseData?.has_fleet_machine ??
      localNotif?.has_fleet_machine ??
      localCamp?.has_fleet_machine
    ),
    fleet_machine_id:
      dbNotif?.fleet_machine_id ||
      dbCampaign?.fleet_machine_id ||
      latestDealMsg?.fleet_machine_id ||
      baseData?.fleet_machine_id ||
      localNotif?.fleet_machine_id ||
      localCamp?.fleet_machine_id ||
      undefined,
    fleet_machine_title:
      dbNotif?.fleet_machine_title ||
      dbCampaign?.fleet_machine_title ||
      latestDealMsg?.fleet_machine_title ||
      baseData?.fleet_machine_title ||
      localNotif?.fleet_machine_title ||
      localCamp?.fleet_machine_title ||
      undefined,
    fleet_machine_image:
      dbNotif?.fleet_machine_image ||
      dbCampaign?.fleet_machine_image ||
      latestDealMsg?.fleet_machine_image ||
      baseData?.fleet_machine_image ||
      localNotif?.fleet_machine_image ||
      localCamp?.fleet_machine_image ||
      undefined,
    fleet_machine_brand:
      dbNotif?.fleet_machine_brand ||
      dbCampaign?.fleet_machine_brand ||
      latestDealMsg?.fleet_machine_brand ||
      baseData?.fleet_machine_brand ||
      localNotif?.fleet_machine_brand ||
      localCamp?.fleet_machine_brand ||
      undefined,
    fleet_machine_model:
      dbNotif?.fleet_machine_model ||
      dbCampaign?.fleet_machine_model ||
      latestDealMsg?.fleet_machine_model ||
      baseData?.fleet_machine_model ||
      localNotif?.fleet_machine_model ||
      localCamp?.fleet_machine_model ||
      undefined,
    fleet_machine_year:
      dbNotif?.fleet_machine_year ??
      dbCampaign?.fleet_machine_year ??
      latestDealMsg?.fleet_machine_year ??
      baseData?.fleet_machine_year ??
      localNotif?.fleet_machine_year ??
      localCamp?.fleet_machine_year ??
      null,
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
    contractor_terms_agreed: contractorTermsAgreed || dealStatus === 'accepted',
    owner_terms_agreed: ownerTermsAgreed || dealStatus === 'accepted',
    agreed_price:
      latestDealMsg?.agreed_price ??
      dbNotif?.agreed_price ??
      dbCampaign?.agreed_price ??
      baseData?.agreed_price ??
      localNotif?.agreed_price ??
      localCamp?.agreed_price ??
      null,
    agreed_currency:
      latestDealMsg?.agreed_currency ||
      dbNotif?.agreed_currency ||
      dbCampaign?.agreed_currency ||
      baseData?.agreed_currency ||
      localNotif?.agreed_currency ||
      'MAD',
    agreed_supply_source:
      latestDealMsg?.agreed_supply_source ||
      dbCampaign?.agreed_supply_source ||
      baseData?.agreed_supply_source ||
      undefined,
    won_supplier_name:
      latestDealMsg?.won_supplier_name ||
      dbCampaign?.won_supplier_name ||
      localCamp?.won_supplier_name ||
      undefined,
    won_supplier_phone:
      latestDealMsg?.won_supplier_phone ||
      dbCampaign?.won_supplier_phone ||
      localCamp?.won_supplier_phone ||
      undefined,
    won_supplier_city:
      latestDealMsg?.won_supplier_city ||
      dbCampaign?.won_supplier_city ||
      localCamp?.won_supplier_city ||
      undefined,
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

    const isSpareDealMsg =
      latest.campaign_type === 'spare_part' || Boolean(latest.part_reference);
    const isPurchaseDealMsg = latest.campaign_type === 'machine_purchase';

    const partyPrompt = isSpareDealMsg
      ? partyRole === 'contractor'
        ? `🤝 وافق طالب قطعة الغيار على العرض! في انتظار ضغط مورد القطعة على زر «قبول الصفقة» لتأكيد الطلب.`
        : `🤝 وافق مورد قطعة الغيار على الصفقة! في انتظار ضغط مالك الآلية على زر «قبول الصفقة» لتأكيد الطلب.`
      : isPurchaseDealMsg
      ? partyRole === 'contractor'
        ? `🤝 وافق المالك المشتري على عرض الشراء/الاستيراد! في انتظار تأكيد المورد على زر «قبول الصفقة».`
        : `🤝 وافق مورد الآليات / شركة الاستيراد على الصفقة! في انتظار ضغط المالك المشتري على زر «قبول الصفقة» لتأكيد الطلب.`
      : partyRole === 'contractor'
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
  //   3. Relocate machine GPS/city to Contractor site (only for rental deals)
  //   4. Close campaign in dashboard while keeping it visible
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

  const isSpareDeal =
    latest.campaign_type === 'spare_part' ||
    Boolean(latest.part_reference) ||
    String(machineObj?.category || '').toLowerCase() === 'spare-parts';
  const isPurchaseDeal = latest.campaign_type === 'machine_purchase';
  const isSupplyDeal = isSpareDeal || isPurchaseDeal;

  const dailyRate = Number(machineObj?.rate_daily || machineObj?.daily_rate || 2000);
  const totalPrice = isSupplyDeal
    ? Number(machineObj?.sale_price || latest.budget_mad || 0)
    : dailyRate * 7;

  let rpcSucceeded = false;
  if (isSupabaseConfigured && isUuid(latest.campaign_id)) {
    try {
      const rpcParams: Record<string, any> = {
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
        p_campaign_type: isSpareDeal ? 'spare_part' : isPurchaseDeal ? 'machine_purchase' : 'machine',
      };

      let { data: rpcRes, error: rpcErr } = await supabase.rpc('accept_dispatch_deal', rpcParams);
      if (rpcErr && rpcErr.message?.includes('p_campaign_type')) {
        delete rpcParams.p_campaign_type;
        const retryRes = await supabase.rpc('accept_dispatch_deal', rpcParams);
        rpcRes = retryRes.data;
        rpcErr = retryRes.error;
      }

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
  const dealNotePrefix = isSpareDeal
    ? `طلب قطعة غيار عبر البحث المباشر (${latest.part_reference || latest.machine_name}) — ${latest.site_name}`
    : isPurchaseDeal
    ? `طلب شراء / استيراد آلية (${latest.machine_name}) — ${latest.site_name}`
    : `صفقة حملة بحث مباشر — الورش: ${latest.site_name}`;

  // Direct booking fallback if RPC didn't create it yet (when machine_id exists)
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
      notes: `${dealNotePrefix}${latest.notes ? `\n${latest.notes}` : ''}`,
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

  // Always save to bookingStore + Express SQLite when machine_id exists (or rental)
  if (!isSupplyDeal || isUuid(latest.machine_id)) {
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
      with_operator: !isSupplyDeal,
      site_address: `${latest.site_name}${latest.site_city ? ` · ${latest.site_city}` : ''}`,
      status: 'active',
      notes: `${dealNotePrefix}${latest.notes ? `\n${latest.notes}` : ''}`,
      machine: machineObj,
      created_at: nowIso,
    };
    bookingStore.saveBooking(localBookingRecord);
  }

  // Move machine to contractor's site in DB + local store (ONLY for machinery rentals, NEVER for spare parts or purchase/import)
  if (!isSupplyDeal) {
    await relocateMachineToSite({
      machineId: latest.machine_id,
      siteLat: latest.site_lat,
      siteLng: latest.site_lng,
      siteCity: latest.site_city || '',
    });
  }

  // Close winning campaign (keeps visible in dashboard)
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

  const confirmText = isSpareDeal
    ? `✅🤝 تم قبول الصفقة من الطرفين! تم تأكيد طلب قطعة الغيار (${latest.part_reference || latest.machine_name}).${DISPATCH_DEAL_MARKER}${JSON.stringify(finalizedDeal)}`
    : isPurchaseDeal
    ? `✅🤝 تم قبول الصفقة من الطرفين! تم تأكيد طلب شراء / استيراد الآلية (${latest.machine_name}).${DISPATCH_DEAL_MARKER}${JSON.stringify(finalizedDeal)}`
    : `✅🤝 تم قبول الصفقة من الطرفين! تم تأكيد الحجز في حجوزات الزبون وطلبات المالك، وتم تحديث موقع الآلية إلى ورش «${
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

// ============================================================================
// SUPPLIER & INTERNATIONAL IMPORTER FEED + QUOTE HELPERS
// ============================================================================

export interface SupplierOpenRequestItem {
  campaign_id: string;
  notification_id?: string;
  contractor_id: string;
  company_name: string;
  campaign_type: DispatchCampaignType;
  machine_category: string;
  machine_name: string;
  part_reference?: string;
  part_category?: string;
  budget_mad?: number | null;
  import_allowed?: boolean;
  preferred_origin?: string;
  desired_condition?: 'any' | 'new' | 'used' | 'import';
  desired_model?: string;
  customs_clearance?: boolean;
  has_fleet_machine?: boolean;
  fleet_machine_id?: string;
  fleet_machine_title?: string;
  fleet_machine_image?: string;
  fleet_machine_brand?: string;
  fleet_machine_model?: string;
  fleet_machine_year?: number | null;
  site_name: string;
  site_city?: string;
  site_lat?: number;
  site_lng?: number;
  site_phone?: string;
  distance_km: number | null;
  is_nationwide: boolean;
  notes?: string;
  is_targeted: boolean;
  is_read: boolean;
  matched_machine_id?: string;
  created_at: string;
}

const SUPPLIER_SEEN_CAMPAIGNS_PREFIX = 'jadijcb_supplier_seen_campaigns_';

export function getSupplierSeenCampaignIds(supplierId: string): Set<string> {
  if (!supplierId) return new Set();
  try {
    const raw = localStorage.getItem(`${SUPPLIER_SEEN_CAMPAIGNS_PREFIX}${supplierId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function markSupplierCampaignSeen(supplierId: string, campaignId: string) {
  if (!supplierId || !campaignId) return;
  try {
    const set = getSupplierSeenCampaignIds(supplierId);
    if (!set.has(campaignId)) {
      set.add(campaignId);
      localStorage.setItem(
        `${SUPPLIER_SEEN_CAMPAIGNS_PREFIX}${supplierId}`,
        JSON.stringify(Array.from(set).slice(-200))
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jadijcb_dispatch_campaigns_updated'));
      }
    }
  } catch {
    // ignore
  }
}

export async function fetchOpenOwnerRequestsForSupplier(
  supplierProfile: Partial<UserProfile> | null
): Promise<SupplierOpenRequestItem[]> {
  if (!supplierProfile?.id) return [];

  const supplierId = supplierProfile.id;
  const seenCampaignIds = getSupplierSeenCampaignIds(supplierId);
  const supplierCoords = resolveMachineCoordinates({ city: supplierProfile.city });
  const byCampaign = new Map<string, SupplierOpenRequestItem>();

  const computeDistance = (lat?: number, lng?: number, city?: string): number | null => {
    const targetCoords =
      lat && lng && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : resolveMachineCoordinates({ city });
    if (!supplierCoords || !targetCoords) return null;
    return calculateDistanceKm(supplierCoords.lat, supplierCoords.lng, targetCoords.lat, targetCoords.lng);
  };

  // 1. Targeted dispatch notifications addressed directly to this supplier
  try {
    const targeted = await fetchOwnerDispatchNotifications(supplierId);
    for (const n of targeted) {
      const cType: DispatchCampaignType =
        n.campaign_type || (n.part_reference ? 'spare_part' : 'machine');
      if (cType !== 'spare_part' && cType !== 'machine_purchase') continue;
      if (n.contractor_id === supplierId) continue;

      byCampaign.set(n.campaign_id, {
        campaign_id: n.campaign_id,
        notification_id: n.id,
        contractor_id: n.contractor_id,
        company_name: n.company_name || 'مالك آليات',
        campaign_type: cType,
        machine_category: n.part_category || 'all',
        machine_name: n.machine_name,
        part_reference: n.part_reference,
        part_category: n.part_category,
        budget_mad: n.budget_mad ?? null,
        import_allowed: Boolean(n.import_allowed),
        preferred_origin: n.preferred_origin,
        desired_condition: n.desired_condition,
        desired_model: n.desired_model,
        customs_clearance: Boolean(n.customs_clearance),
        has_fleet_machine: Boolean(n.has_fleet_machine),
        fleet_machine_id: n.fleet_machine_id,
        fleet_machine_title: n.fleet_machine_title,
        fleet_machine_image: n.fleet_machine_image,
        fleet_machine_brand: n.fleet_machine_brand,
        fleet_machine_model: n.fleet_machine_model,
        fleet_machine_year: n.fleet_machine_year ?? null,
        site_name: n.site_name || n.site_city || 'المغرب',
        site_city: n.site_city || '',
        site_lat: n.site_lat,
        site_lng: n.site_lng,
        site_phone: n.site_phone || '',
        distance_km: n.distance_km ?? computeDistance(n.site_lat, n.site_lng, n.site_city),
        is_nationwide: Boolean(n.is_nationwide),
        notes: n.notes || '',
        is_targeted: true,
        is_read: Boolean(n.is_read) || seenCampaignIds.has(n.campaign_id),
        matched_machine_id: n.machine_id,
        created_at: n.created_at,
      });
    }
  } catch {
    // ignore
  }

  // 2. Open supply campaigns across Morocco (spare_part & machine_purchase)
  if (isSupabaseConfigured) {
    try {
      const { data: openCamps } = await supabase
        .from('dispatch_campaigns')
        .select('*')
        .eq('status', 'active')
        .in('campaign_type', ['spare_part', 'machine_purchase'])
        .order('created_at', { ascending: false })
        .limit(40);

      for (const c of (openCamps || []) as DispatchCampaign[]) {
        if (!c.id || c.contractor_id === supplierId) continue;
        const cType: DispatchCampaignType = c.campaign_type || 'spare_part';
        const existing = byCampaign.get(c.id);
        if (existing) {
          byCampaign.set(c.id, {
            ...existing,
            machine_category: c.machine_category || existing.machine_category,
            budget_mad: c.budget_mad ?? existing.budget_mad ?? null,
            import_allowed: Boolean(c.import_allowed ?? existing.import_allowed),
            preferred_origin: c.preferred_origin || existing.preferred_origin,
            desired_condition: c.desired_condition || existing.desired_condition,
            desired_model: c.desired_model || existing.desired_model,
            customs_clearance: Boolean(c.customs_clearance ?? existing.customs_clearance),
            has_fleet_machine: Boolean(c.has_fleet_machine ?? existing.has_fleet_machine),
            fleet_machine_id: c.fleet_machine_id || existing.fleet_machine_id,
            fleet_machine_title: c.fleet_machine_title || existing.fleet_machine_title,
            fleet_machine_image: c.fleet_machine_image || existing.fleet_machine_image,
            fleet_machine_brand: c.fleet_machine_brand || existing.fleet_machine_brand,
            fleet_machine_model: c.fleet_machine_model || existing.fleet_machine_model,
            fleet_machine_year: c.fleet_machine_year ?? existing.fleet_machine_year ?? null,
          });
          continue;
        }
        byCampaign.set(c.id, {
          campaign_id: c.id,
          contractor_id: c.contractor_id,
          company_name: c.company_name || 'مالك آليات',
          campaign_type: cType,
          machine_category: c.machine_category || 'all',
          machine_name: c.machine_name,
          part_reference: c.part_reference,
          part_category: c.part_category,
          budget_mad: c.budget_mad ?? null,
          import_allowed: Boolean(c.import_allowed),
          preferred_origin: c.preferred_origin,
          desired_condition: c.desired_condition,
          desired_model: c.desired_model,
          customs_clearance: Boolean(c.customs_clearance),
          has_fleet_machine: Boolean(c.has_fleet_machine),
          fleet_machine_id: c.fleet_machine_id,
          fleet_machine_title: c.fleet_machine_title,
          fleet_machine_image: c.fleet_machine_image,
          fleet_machine_brand: c.fleet_machine_brand,
          fleet_machine_model: c.fleet_machine_model,
          fleet_machine_year: c.fleet_machine_year ?? null,
          site_name: c.site_name || c.site_city || 'المغرب',
          site_city: c.site_city || '',
          site_lat: c.site_lat,
          site_lng: c.site_lng,
          site_phone: c.site_phone || '',
          distance_km: computeDistance(c.site_lat, c.site_lng, c.site_city),
          is_nationwide: Boolean(c.is_nationwide),
          notes: c.notes || '',
          is_targeted: false,
          is_read: seenCampaignIds.has(c.id),
          created_at: c.created_at,
        });
      }
    } catch (err) {
      console.warn('Open supplier campaigns query notice:', err);
    }
  }

  // 3. LocalStorage campaigns fallback
  try {
    const localCamps: DispatchCampaign[] = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]');
    for (const c of localCamps) {
      if (c.status !== 'active' || c.contractor_id === supplierId) continue;
      const cType: DispatchCampaignType =
        c.campaign_type ||
        (c.machine_category === 'spare-parts' || Boolean(c.part_reference) ? 'spare_part' : 'machine');
      if (cType !== 'spare_part' && cType !== 'machine_purchase') continue;
      if (byCampaign.has(c.id)) continue;

      byCampaign.set(c.id, {
        campaign_id: c.id,
        contractor_id: c.contractor_id,
        company_name: c.company_name || 'مالك آليات',
        campaign_type: cType,
        machine_category: c.machine_category || 'all',
        machine_name: c.machine_name,
        part_reference: c.part_reference,
        part_category: c.part_category,
        budget_mad: c.budget_mad ?? null,
        import_allowed: Boolean(c.import_allowed),
        preferred_origin: c.preferred_origin,
        desired_condition: c.desired_condition,
        desired_model: c.desired_model,
        customs_clearance: Boolean(c.customs_clearance),
        has_fleet_machine: Boolean(c.has_fleet_machine),
        fleet_machine_id: c.fleet_machine_id,
        fleet_machine_title: c.fleet_machine_title,
        fleet_machine_image: c.fleet_machine_image,
        fleet_machine_brand: c.fleet_machine_brand,
        fleet_machine_model: c.fleet_machine_model,
        fleet_machine_year: c.fleet_machine_year ?? null,
        site_name: c.site_name || c.site_city || 'المغرب',
        site_city: c.site_city || '',
        site_lat: c.site_lat,
        site_lng: c.site_lng,
        site_phone: c.site_phone || '',
        distance_km: computeDistance(c.site_lat, c.site_lng, c.site_city),
        is_nationwide: Boolean(c.is_nationwide),
        notes: c.notes || '',
        is_targeted: false,
        is_read: seenCampaignIds.has(c.id),
        created_at: c.created_at,
      });
    }
  } catch {
    // ignore
  }

  return Array.from(byCampaign.values()).sort((a, b) => {
    if (a.is_targeted !== b.is_targeted) return a.is_targeted ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function sendSupplierQuoteToOwner(params: {
  supplierId: string;
  supplierName: string;
  request: SupplierOpenRequestItem;
  priceAmount: number;
  currency: 'MAD' | 'EUR';
  supplySource: 'morocco_stock' | 'import_order';
  originCountryLabel?: string;
  leadTimeLabel: string;
  warrantyLabel?: string;
  notes?: string;
}): Promise<{ success: boolean; conversationId?: string }> {
  const { supplierId, supplierName, request } = params;
  if (!supplierId || !request.contractor_id) {
    return { success: false };
  }

  const priceFormatted = `${Number(params.priceAmount).toLocaleString()} ${params.currency === 'EUR' ? '€' : 'د.م'}`;
  const sourceLine =
    params.supplySource === 'import_order'
      ? `استيراد من الخارج (${params.originCountryLabel || 'أوروبا / آسيا'})`
      : 'متوفر في المغرب (تسليم فوري)';

  const quoteLines = [
    `💼 عرض سعر رسمي من «${supplierName}»`,
    `📦 الطلب: ${request.part_reference ? `Réf ${request.part_reference} · ` : ''}${request.machine_name}`,
    `💰 الثمن المقترح: ${priceFormatted}`,
    `🌍 التوفر والمصدر: ${sourceLine}`,
    `⏱️ مدة التسليم / الشحن: ${params.leadTimeLabel}`,
    params.warrantyLabel ? `🛡️ الضمان: ${params.warrantyLabel}` : '',
    params.notes ? `📝 تفاصيل العرض: ${params.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const dispatchPayload = JSON.stringify({
    id: request.notification_id || makeUuid(),
    campaign_id: request.campaign_id,
    owner_id: supplierId,
    contractor_id: request.contractor_id,
    machine_id: request.matched_machine_id || null,
    campaign_type: request.campaign_type,
    part_reference: request.part_reference || '',
    part_category: request.part_category || '',
    budget_mad: request.budget_mad ?? null,
    import_allowed: Boolean(request.import_allowed),
    preferred_origin: request.preferred_origin || '',
    desired_condition: request.desired_condition || 'any',
    desired_model: request.desired_model || '',
    customs_clearance: Boolean(request.customs_clearance),
    has_fleet_machine: Boolean(request.has_fleet_machine),
    fleet_machine_id: request.fleet_machine_id || '',
    fleet_machine_title: request.fleet_machine_title || '',
    fleet_machine_image: request.fleet_machine_image || '',
    fleet_machine_brand: request.fleet_machine_brand || '',
    fleet_machine_model: request.fleet_machine_model || '',
    fleet_machine_year: request.fleet_machine_year ?? null,
    company_name: request.company_name,
    machine_name: request.machine_name,
    matched_machine_title: supplierName,
    site_name: request.site_name,
    site_city: request.site_city || '',
    site_lat: request.site_lat,
    site_lng: request.site_lng,
    site_phone: request.site_phone || '',
    distance_km: request.distance_km,
    is_nationwide: request.is_nationwide,
    radius_km: null,
    notes: params.notes || request.notes || '',
    contractor_accepted: false,
    owner_accepted: false,
    contractor_terms_agreed: false,
    owner_terms_agreed: false,
    agreed_price: params.priceAmount,
    agreed_currency: params.currency,
    agreed_supply_source: params.supplySource,
    deal_status: 'open',
  });

  const fullMessage = `${quoteLines}${DISPATCH_MSG_MARKER}${dispatchPayload}`;

  let conversationId: string | null = null;
  let insertedViaSupabase = false;
  if (isSupabaseConfigured && isUuid(supplierId) && isUuid(request.contractor_id)) {
    conversationId = await findOrCreateSupabaseConversation(
      supplierId,
      request.contractor_id,
      request.matched_machine_id
    );
    if (conversationId) {
      insertedViaSupabase = await insertSupabaseMessageAdaptive(
        conversationId,
        supplierId,
        fullMessage
      );
    }
  }

  // Fallback local chatStore sync (only insert via chatStore if Supabase direct insert didn't happen)
  try {
    const localConv = await chatStore.getOrCreateConversation(
      supplierId,
      request.contractor_id,
      request.matched_machine_id ? { id: request.matched_machine_id } : null,
      {
        id: request.contractor_id,
        company_name: request.company_name,
        role: 'owner',
      }
    );
    if (!insertedViaSupabase) {
      await chatStore.sendMessage(
        localConv.id,
        supplierId,
        fullMessage,
        request.contractor_id,
        { senderName: supplierName, recipientRole: 'owner' }
      );
    }
    if (!conversationId) conversationId = localConv.id;
  } catch {
    // ignore
  }

  if (request.notification_id) {
    await updateDispatchNotificationStatus(
      request.notification_id,
      { status: 'read', is_read: true },
      request.campaign_id
    );
  }

  // Notify Owner via public.notifications + serverApi
  if (isSupabaseConfigured && isUuid(request.contractor_id)) {
    try {
      await supabase.from('notifications').insert({
        user_id: request.contractor_id,
        title_ar: `عرض سعر جديد من ${supplierName} 💼`,
        title_fr: `Nouveau devis de ${supplierName} 💼`,
        body_ar: `${request.machine_name} · ${priceFormatted} · ${params.leadTimeLabel}`,
        body_fr: `${request.machine_name} · ${priceFormatted} · ${params.leadTimeLabel}`,
        type: 'supplier_quote',
        data: {
          campaign_id: request.campaign_id,
          supplier_id: supplierId,
          price_amount: params.priceAmount,
          currency: params.currency,
        },
        is_read: false,
      });
    } catch {
      // ignore
    }
  }

  try {
    await serverApi.createNotification({
      user_id: request.contractor_id,
      title_ar: `عرض سعر جديد من ${supplierName} 💼`,
      title_fr: `Nouveau devis de ${supplierName} 💼`,
      body_ar: `${request.machine_name} · ${priceFormatted} · ${params.leadTimeLabel}`,
      body_fr: `${request.machine_name} · ${priceFormatted} · ${params.leadTimeLabel}`,
      type: 'supplier_quote',
      data: {
        campaign_id: request.campaign_id,
        supplier_id: supplierId,
      },
    });
  } catch {
    // ignore
  }

  return { success: Boolean(conversationId), conversationId: conversationId || undefined };
}

export async function startSupplierChatWithOwner(params: {
  supplierId: string;
  supplierName: string;
  request: {
    campaign_id: string;
    notification_id?: string;
    contractor_id: string;
    company_name: string;
    campaign_type?: DispatchCampaignType;
    machine_category?: string;
    machine_name: string;
    part_reference?: string;
    part_category?: string;
    budget_mad?: number | null;
    import_allowed?: boolean;
    preferred_origin?: string;
    desired_condition?: 'any' | 'new' | 'used' | 'import';
    desired_model?: string;
    customs_clearance?: boolean;
    has_fleet_machine?: boolean;
    fleet_machine_id?: string;
    fleet_machine_title?: string;
    fleet_machine_image?: string;
    fleet_machine_brand?: string;
    fleet_machine_model?: string;
    fleet_machine_year?: number | null;
    site_name: string;
    site_city?: string;
    site_lat?: number;
    site_lng?: number;
    site_phone?: string;
    distance_km?: number | null;
    is_nationwide?: boolean;
    notes?: string;
    matched_machine_id?: string;
    matched_machine_title?: string;
  };
}): Promise<{ conversationId?: string }> {
  const { supplierId, supplierName, request } = params;
  if (!supplierId || !request.contractor_id) return {};

  const notifObj: DispatchNotification = {
    id: request.notification_id || makeUuid(),
    campaign_id: request.campaign_id,
    owner_id: supplierId,
    contractor_id: request.contractor_id,
    machine_id: request.matched_machine_id,
    campaign_type: request.campaign_type || 'spare_part',
    part_reference: request.part_reference,
    part_category: request.part_category,
    budget_mad: request.budget_mad ?? null,
    import_allowed: Boolean(request.import_allowed),
    preferred_origin: request.preferred_origin,
    desired_condition: request.desired_condition,
    desired_model: request.desired_model,
    customs_clearance: Boolean(request.customs_clearance),
    has_fleet_machine: Boolean(request.has_fleet_machine),
    fleet_machine_id: request.fleet_machine_id,
    fleet_machine_title: request.fleet_machine_title,
    fleet_machine_image: request.fleet_machine_image,
    fleet_machine_brand: request.fleet_machine_brand,
    fleet_machine_model: request.fleet_machine_model,
    fleet_machine_year: request.fleet_machine_year ?? null,
    company_name: request.company_name,
    machine_name: request.machine_name,
    matched_machine_title: request.matched_machine_title || supplierName,
    site_name: request.site_name,
    site_city: request.site_city,
    site_lat: request.site_lat,
    site_lng: request.site_lng,
    site_phone: request.site_phone,
    distance_km: request.distance_km ?? null,
    is_nationwide: Boolean(request.is_nationwide),
    radius_km: null,
    notes: request.notes,
    status: 'accepted',
    is_read: true,
    created_at: new Date().toISOString(),
  };

  await Promise.allSettled([
    request.notification_id
      ? updateDispatchNotificationStatus(
          request.notification_id,
          { is_read: true, status: 'accepted' },
          request.campaign_id
        )
      : Promise.resolve(),
    ensureDispatchConversationLinked({
      contractorId: request.contractor_id,
      ownerId: supplierId,
      notification: notifObj,
    }),
  ]);

  let convId: string | undefined;
  try {
    const conv = await chatStore.getOrCreateConversation(
      supplierId,
      request.contractor_id,
      request.matched_machine_id ? { id: request.matched_machine_id } : null,
      {
        id: request.contractor_id,
        company_name: request.company_name,
        phone: request.site_phone,
        city: request.site_city,
        role: 'owner',
      }
    );
    convId = conv.id;
  } catch {
    // ignore
  }

  return { conversationId: convId };
}

function saveLocalSupplierOrder(order: SupplierOrderDealItem) {
  try {
    const existing: SupplierOrderDealItem[] = JSON.parse(
      localStorage.getItem(LOCAL_SUPPLIER_ORDERS_KEY) || '[]'
    );
    const filtered = existing.filter((o) => o.campaign_id !== order.campaign_id);
    localStorage.setItem(
      LOCAL_SUPPLIER_ORDERS_KEY,
      JSON.stringify([order, ...filtered].slice(0, 100))
    );
  } catch {
    // ignore
  }
}

async function persistSupplierOrderForBothSides(order: SupplierOrderDealItem): Promise<void> {
  saveLocalSupplierOrder(order);

  const recipients = Array.from(new Set([order.owner_id, order.supplier_id].filter(Boolean)));
  const itemSummary = order.part_reference
    ? `${order.item_title} (Réf: ${order.part_reference})`
    : order.item_title;

  if (isSupabaseConfigured) {
    await Promise.allSettled(
      recipients
        .filter((uid) => isUuid(uid))
        .map((uid) =>
          supabase.from('notifications').insert({
            user_id: uid,
            title_ar:
              order.campaign_type === 'spare_part'
                ? 'تم إغلاق صفقة قطعة غيار ✅'
                : 'تم إغلاق صفقة شراء / استيراد آلية ✅',
            title_fr:
              order.campaign_type === 'spare_part'
                ? 'Commande pièce clôturée ✅'
                : 'Commande engin clôturée ✅',
            body_ar: `${itemSummary}${order.agreed_price ? ` · ${order.agreed_price.toLocaleString()} ${order.agreed_currency === 'EUR' ? '€' : 'د.م'}` : ''}`,
            body_fr: `${itemSummary}${order.agreed_price ? ` · ${order.agreed_price.toLocaleString()} ${order.agreed_currency === 'EUR' ? '€' : 'MAD'}` : ''}`,
            type: 'supplier_order_closed',
            data: order,
            is_read: false,
          })
        )
    );
  }

  await Promise.allSettled(
    recipients.map((uid) =>
      serverApi.createNotification({
        user_id: uid,
        title_ar:
          order.campaign_type === 'spare_part'
            ? 'تم إغلاق صفقة قطعة غيار ✅'
            : 'تم إغلاق صفقة شراء / استيراد آلية ✅',
        title_fr:
          order.campaign_type === 'spare_part'
            ? 'Commande pièce clôturée ✅'
            : 'Commande engin clôturée ✅',
        body_ar: itemSummary,
        body_fr: itemSummary,
        type: 'supplier_order_closed',
        data: order as any,
      })
    )
  );
}

export async function agreeSupplyDealTermsParty(params: {
  deal: DispatchDealContext;
  partyRole: 'contractor' | 'owner';
  currentUserId: string;
  currentUserName?: string;
  conversationId: string;
  agreedPrice?: number | null;
  agreedCurrency?: 'MAD' | 'EUR';
}): Promise<{ updatedDeal: DispatchDealContext; bothAgreedTerms: boolean }> {
  const { deal, partyRole, currentUserId, conversationId } = params;

  const latest =
    (await fetchDispatchContextForConversation({
      currentUserId,
      otherUserId: partyRole === 'contractor' ? deal.owner_id : deal.contractor_id,
      machineId: deal.machine_id,
      campaignIdHint: deal.campaign_id,
    })) || deal;

  if (latest.deal_status === 'accepted' || latest.deal_status === 'closed_other') {
    return {
      updatedDeal: latest,
      bothAgreedTerms: Boolean(latest.contractor_terms_agreed && latest.owner_terms_agreed),
    };
  }

  const nextContractorTerms =
    partyRole === 'contractor' ? true : Boolean(latest.contractor_terms_agreed);
  const nextOwnerTerms = partyRole === 'owner' ? true : Boolean(latest.owner_terms_agreed);
  const bothAgreedTerms = nextContractorTerms && nextOwnerTerms;

  const updatedDeal: DispatchDealContext = {
    ...latest,
    contractor_terms_agreed: nextContractorTerms,
    owner_terms_agreed: nextOwnerTerms,
    agreed_price:
      params.agreedPrice != null && params.agreedPrice > 0
        ? params.agreedPrice
        : latest.agreed_price ?? null,
    agreed_currency: params.agreedCurrency || latest.agreed_currency || 'MAD',
  };

  if (latest.notification_id) {
    await updateDispatchNotificationStatus(
      latest.notification_id,
      {
        is_read: true,
        contractor_terms_agreed: nextContractorTerms,
        owner_terms_agreed: nextOwnerTerms,
        agreed_price: updatedDeal.agreed_price ?? null,
        agreed_currency: updatedDeal.agreed_currency,
      },
      latest.campaign_id
    );
  }

  const priceSuffix =
    updatedDeal.agreed_price && updatedDeal.agreed_price > 0
      ? ` (${Number(updatedDeal.agreed_price).toLocaleString()} ${
          updatedDeal.agreed_currency === 'EUR' ? '€' : 'د.م'
        })`
      : '';

  const textMsg = bothAgreedTerms
    ? `🤝 وافق الطرفان على الشروط المتفق عليها${priceSuffix}! يمكن الآن الضغط على «إغلاق الصفقة» لتسجيل الطلب في لوحتي التحكم.`
    : partyRole === 'contractor'
    ? `✅ وافق مالك الآلية على شروط المورد${priceSuffix} — في انتظار ضغط المورد على «أتفق على شروط الطرف الآخر».`
    : `✅ وافق المورد على شروط المالك${priceSuffix} — في انتظار ضغط المالك على «أتفق على شروط الطرف الآخر».`;

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    `${textMsg}${DISPATCH_DEAL_MARKER}${JSON.stringify(updatedDeal)}`,
    partyRole === 'contractor' ? latest.owner_id : latest.contractor_id,
    { senderName: params.currentUserName }
  );

  broadcastDispatchEvent({
    type: 'DEAL_STEP_UPDATED',
    campaignId: latest.campaign_id,
    deal: updatedDeal,
  });

  return { updatedDeal, bothAgreedTerms };
}

export async function closeSupplyDealParty(params: {
  deal: DispatchDealContext;
  partyRole: 'contractor' | 'owner';
  currentUserId: string;
  currentUserName?: string;
  currentUserPhone?: string;
  currentUserCity?: string;
  otherParticipant?: {
    id: string;
    full_name?: string;
    company_name?: string;
    phone?: string;
    city?: string;
  };
  conversationId: string;
  agreedPrice?: number | null;
  agreedCurrency?: 'MAD' | 'EUR';
}): Promise<{
  updatedDeal: DispatchDealContext;
  finalized: boolean;
  waitingForTerms?: boolean;
}> {
  const { deal, partyRole, currentUserId, conversationId, otherParticipant } = params;

  const latest =
    (await fetchDispatchContextForConversation({
      currentUserId,
      otherUserId: partyRole === 'contractor' ? deal.owner_id : deal.contractor_id,
      machineId: deal.machine_id,
      campaignIdHint: deal.campaign_id,
    })) || deal;

  if (latest.deal_status === 'accepted') {
    return { updatedDeal: latest, finalized: true };
  }
  if (latest.deal_status === 'closed_other') {
    return { updatedDeal: latest, finalized: false };
  }

  const bothTermsAgreed = Boolean(latest.contractor_terms_agreed && latest.owner_terms_agreed);
  if (!bothTermsAgreed) {
    return { updatedDeal: latest, finalized: false, waitingForTerms: true };
  }

  const supplierId = latest.owner_id;
  const ownerRequesterId = latest.contractor_id;
  const isSupplierParty = partyRole === 'owner';

  let supplierName =
    (isSupplierParty
      ? params.currentUserName
      : otherParticipant?.company_name || otherParticipant?.full_name) ||
    latest.won_supplier_name ||
    latest.matched_machine_title ||
    'مورد معتمد';
  let supplierPhone =
    (isSupplierParty ? params.currentUserPhone : otherParticipant?.phone) ||
    latest.won_supplier_phone ||
    '';
  let supplierCity =
    (isSupplierParty ? params.currentUserCity : otherParticipant?.city) ||
    latest.won_supplier_city ||
    '';

  let ownerName =
    (!isSupplierParty
      ? params.currentUserName
      : otherParticipant?.company_name || otherParticipant?.full_name) ||
    latest.company_name ||
    'مالك آليات';
  let ownerPhone =
    (!isSupplierParty ? params.currentUserPhone : otherParticipant?.phone) ||
    latest.site_phone ||
    '';
  let ownerCity =
    (!isSupplierParty ? params.currentUserCity : otherParticipant?.city) ||
    latest.site_city ||
    '';

  if (isSupabaseConfigured) {
    try {
      const idsToLoad = [supplierId, ownerRequesterId].filter((id) => isUuid(id));
      if (idsToLoad.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, phone, city')
          .in('id', idsToLoad);
        for (const p of profs || []) {
          if (p.id === supplierId) {
            supplierName = p.company_name || p.full_name || supplierName;
            supplierPhone = p.phone || supplierPhone;
            supplierCity = p.city || supplierCity;
          }
          if (p.id === ownerRequesterId) {
            ownerName = p.company_name || p.full_name || ownerName;
            ownerPhone = p.phone || ownerPhone;
            ownerCity = p.city || ownerCity;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const finalPrice =
    params.agreedPrice != null && params.agreedPrice > 0
      ? params.agreedPrice
      : latest.agreed_price ?? latest.budget_mad ?? null;
  const finalCurrency: 'MAD' | 'EUR' = params.agreedCurrency || latest.agreed_currency || 'MAD';
  const nowIso = new Date().toISOString();

  await closeDispatchCampaign(latest.campaign_id, {
    won_owner_id: supplierId,
    won_machine_id: latest.machine_id,
    won_machine_title: supplierName,
  });

  if (latest.notification_id) {
    await updateDispatchNotificationStatus(
      latest.notification_id,
      {
        is_read: true,
        status: 'accepted',
        contractor_accepted: true,
        owner_accepted: true,
        contractor_terms_agreed: true,
        owner_terms_agreed: true,
        agreed_price: finalPrice,
        agreed_currency: finalCurrency,
        deal_status: 'accepted',
      },
      latest.campaign_id
    );
  }

  // Dismiss competing notifications for the same campaign
  try {
    if (isSupabaseConfigured && isUuid(latest.campaign_id)) {
      await supabase
        .from('dispatch_notifications')
        .update({
          status: 'dismissed',
          deal_status: 'closed_other',
          is_read: true,
        })
        .eq('campaign_id', latest.campaign_id)
        .neq('owner_id', supplierId);
    }

    const localNotifs: DispatchNotification[] = JSON.parse(
      localStorage.getItem(LOCAL_NOTIFS_KEY) || '[]'
    );
    const updatedLocalNotifs = localNotifs.map((n) => {
      if (n.campaign_id !== latest.campaign_id) return n;
      if (n.owner_id === supplierId) {
        return {
          ...n,
          status: 'accepted' as const,
          is_read: true,
          contractor_accepted: true,
          owner_accepted: true,
          contractor_terms_agreed: true,
          owner_terms_agreed: true,
          agreed_price: finalPrice,
          agreed_currency: finalCurrency,
          deal_status: 'accepted' as const,
        };
      }
      return {
        ...n,
        status: 'dismissed' as const,
        deal_status: 'closed_other' as const,
        is_read: true,
      };
    });
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updatedLocalNotifs));

    const localCamps: DispatchCampaign[] = JSON.parse(
      localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]'
    );
    const updatedCamps = localCamps.map((c) =>
      c.id === latest.campaign_id
        ? {
            ...c,
            status: 'closed' as const,
            won_owner_id: supplierId,
            won_supplier_name: supplierName,
            won_supplier_phone: supplierPhone,
            won_supplier_city: supplierCity,
            agreed_price: finalPrice,
            agreed_currency: finalCurrency,
            agreed_supply_source: latest.agreed_supply_source,
            won_at: nowIso,
          }
        : c
    );
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(updatedCamps));
  } catch {
    // ignore
  }

  const orderItem: SupplierOrderDealItem = {
    id: makeUuid(),
    campaign_id: latest.campaign_id,
    campaign_type:
      latest.campaign_type === 'machine_purchase' ? 'machine_purchase' : 'spare_part',
    item_title: latest.machine_name,
    part_reference: latest.part_reference,
    part_category: latest.part_category,
    desired_model: latest.desired_model,
    desired_condition: latest.desired_condition,
    customs_clearance: Boolean(latest.customs_clearance),
    import_allowed: Boolean(latest.import_allowed),
    preferred_origin: latest.preferred_origin,
    fleet_machine_id: latest.fleet_machine_id,
    fleet_machine_title: latest.fleet_machine_title,
    fleet_machine_image: latest.fleet_machine_image,
    fleet_machine_brand: latest.fleet_machine_brand,
    fleet_machine_model: latest.fleet_machine_model,
    fleet_machine_year: latest.fleet_machine_year ?? null,
    owner_id: ownerRequesterId,
    owner_name: ownerName,
    owner_phone: ownerPhone,
    owner_city: ownerCity,
    supplier_id: supplierId,
    supplier_name: supplierName,
    supplier_phone: supplierPhone,
    supplier_city: supplierCity,
    agreed_price: finalPrice,
    agreed_currency: finalCurrency,
    agreed_supply_source:
      latest.agreed_supply_source || (latest.import_allowed ? 'import_order' : 'morocco_stock'),
    notes: latest.notes,
    closed_at: nowIso,
    created_at: nowIso,
  };

  await persistSupplierOrderForBothSides(orderItem);

  const finalizedDeal: DispatchDealContext = {
    ...latest,
    contractor_accepted: true,
    owner_accepted: true,
    contractor_terms_agreed: true,
    owner_terms_agreed: true,
    agreed_price: finalPrice,
    agreed_currency: finalCurrency,
    won_supplier_name: supplierName,
    won_supplier_phone: supplierPhone,
    won_supplier_city: supplierCity,
    deal_status: 'accepted',
  };

  const confirmText =
    orderItem.campaign_type === 'spare_part'
      ? `✅🤝 تم إغلاق الصفقة بنجاح! سُجل طلب قطعة الغيار (${latest.part_reference ? `Réf ${latest.part_reference} · ` : ''}${latest.machine_name}) في قسم «طلبات للموردين» للمالك و«طلبات الزبناء» للمورد.`
      : `✅🤝 تم إغلاق الصفقة بنجاح! سُجل طلب الآلية (${latest.machine_name}) في قسم «طلبات للموردين» للمالك و«طلبات الزبناء» للمورد.`;

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    `${confirmText}${DISPATCH_DEAL_MARKER}${JSON.stringify(finalizedDeal)}`,
    partyRole === 'contractor' ? supplierId : ownerRequesterId,
    { senderName: params.currentUserName }
  );

  broadcastDispatchEvent({
    type: 'DEAL_ACCEPTED',
    campaignId: latest.campaign_id,
    deal: finalizedDeal,
  });

  return { updatedDeal: finalizedDeal, finalized: true };
}

export async function fetchOwnerSupplyCampaigns(ownerId: string): Promise<DispatchCampaign[]> {
  if (!ownerId) return [];
  const all = await fetchContractorCampaigns(ownerId);
  const supplyOnly = all.filter(
    (c) => c.campaign_type === 'spare_part' || c.campaign_type === 'machine_purchase'
  );

  // Enrich from local notifications / orders if DB campaign lacked optional columns
  const orders = await fetchOwnerSupplierOrders(ownerId);
  const orderByCamp = new Map(orders.map((o) => [o.campaign_id, o]));

  let localCampsMap = new Map<string, DispatchCampaign>();
  try {
    const local: DispatchCampaign[] = JSON.parse(
      localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || '[]'
    );
    local.forEach((c) => localCampsMap.set(c.id, c));
  } catch {
    // ignore
  }

  return supplyOnly.map((c) => {
    const lc = localCampsMap.get(c.id);
    const ord = orderByCamp.get(c.id);
    return {
      ...lc,
      ...c,
      desired_model: c.desired_model || lc?.desired_model || ord?.desired_model,
      customs_clearance: c.customs_clearance ?? lc?.customs_clearance ?? ord?.customs_clearance,
      has_fleet_machine: c.has_fleet_machine ?? lc?.has_fleet_machine ?? Boolean(ord?.fleet_machine_id),
      fleet_machine_id: c.fleet_machine_id || lc?.fleet_machine_id || ord?.fleet_machine_id,
      fleet_machine_title: c.fleet_machine_title || lc?.fleet_machine_title || ord?.fleet_machine_title,
      fleet_machine_image: c.fleet_machine_image || lc?.fleet_machine_image || ord?.fleet_machine_image,
      fleet_machine_brand: c.fleet_machine_brand || lc?.fleet_machine_brand || ord?.fleet_machine_brand,
      fleet_machine_model: c.fleet_machine_model || lc?.fleet_machine_model || ord?.fleet_machine_model,
      fleet_machine_year: c.fleet_machine_year ?? lc?.fleet_machine_year ?? ord?.fleet_machine_year,
      won_supplier_name: c.won_supplier_name || lc?.won_supplier_name || ord?.supplier_name,
      won_supplier_phone: c.won_supplier_phone || lc?.won_supplier_phone || ord?.supplier_phone,
      won_supplier_city: c.won_supplier_city || lc?.won_supplier_city || ord?.supplier_city,
      agreed_price: c.agreed_price ?? lc?.agreed_price ?? ord?.agreed_price ?? null,
      agreed_currency: c.agreed_currency || lc?.agreed_currency || ord?.agreed_currency || 'MAD',
      status: ord ? 'closed' : c.status,
    };
  });
}

async function fetchClosedSupplierOrdersForUser(
  userId: string,
  roleFilter: 'owner' | 'supplier'
): Promise<SupplierOrderDealItem[]> {
  if (!userId) return [];
  const byCampaign = new Map<string, SupplierOrderDealItem>();

  const mergeOrder = (item: SupplierOrderDealItem) => {
    if (!item || !item.campaign_id) return;
    if (roleFilter === 'owner' && item.owner_id !== userId) return;
    if (roleFilter === 'supplier' && item.supplier_id !== userId) return;
    const existing = byCampaign.get(item.campaign_id);
    if (!existing) {
      byCampaign.set(item.campaign_id, item);
    } else {
      byCampaign.set(item.campaign_id, {
        ...existing,
        ...item,
        fleet_machine_image: item.fleet_machine_image || existing.fleet_machine_image,
        fleet_machine_title: item.fleet_machine_title || existing.fleet_machine_title,
        agreed_price: item.agreed_price ?? existing.agreed_price,
      });
    }
  };

  // 1. Supabase notifications (type = 'supplier_order_closed')
  if (isSupabaseConfigured && isUuid(userId)) {
    try {
      const { data: notifRows } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'supplier_order_closed')
        .order('created_at', { ascending: false })
        .limit(50);

      for (const r of notifRows || []) {
        if (r?.data?.campaign_id) {
          mergeOrder(r.data as SupplierOrderDealItem);
        }
      }
    } catch {
      // ignore
    }

    // Also pull closed supply campaigns directly in case notification was missed
    try {
      let campQ = supabase
        .from('dispatch_campaigns')
        .select('*')
        .eq('status', 'closed')
        .in('campaign_type', ['spare_part', 'machine_purchase'])
        .order('created_at', { ascending: false })
        .limit(40);

      campQ =
        roleFilter === 'owner'
          ? campQ.eq('contractor_id', userId)
          : campQ.eq('won_owner_id', userId);

      const { data: closedCamps } = await campQ;
      for (const c of (closedCamps || []) as DispatchCampaign[]) {
        if (!c.won_owner_id) continue;
        if (!byCampaign.has(c.id)) {
          mergeOrder({
            id: c.id,
            campaign_id: c.id,
            campaign_type:
              c.campaign_type === 'machine_purchase' ? 'machine_purchase' : 'spare_part',
            item_title: c.machine_name,
            part_reference: c.part_reference,
            part_category: c.part_category,
            desired_model: c.desired_model,
            desired_condition: c.desired_condition,
            customs_clearance: Boolean(c.customs_clearance),
            import_allowed: Boolean(c.import_allowed),
            preferred_origin: c.preferred_origin,
            fleet_machine_id: c.fleet_machine_id,
            fleet_machine_title: c.fleet_machine_title,
            fleet_machine_image: c.fleet_machine_image,
            fleet_machine_brand: c.fleet_machine_brand,
            fleet_machine_model: c.fleet_machine_model,
            fleet_machine_year: c.fleet_machine_year ?? null,
            owner_id: c.contractor_id,
            owner_name: c.company_name || 'مالك آليات',
            owner_phone: c.site_phone,
            owner_city: c.site_city,
            supplier_id: c.won_owner_id,
            supplier_name: c.won_supplier_name || c.won_machine_title || 'مورد معتمد',
            supplier_phone: c.won_supplier_phone || undefined,
            supplier_city: c.won_supplier_city || undefined,
            agreed_price: c.agreed_price ?? c.budget_mad ?? null,
            agreed_currency: c.agreed_currency || 'MAD',
            agreed_supply_source: c.agreed_supply_source,
            notes: c.notes,
            closed_at: c.won_at || c.created_at,
            created_at: c.created_at,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Express Server SQLite notifications fallback
  try {
    const serverRes = await serverApi.getNotifications({ user_id: userId });
    for (const s of serverRes.notifications || []) {
      if (s.type === 'supplier_order_closed' && s.data?.campaign_id) {
        mergeOrder(s.data as SupplierOrderDealItem);
      }
    }
  } catch {
    // ignore
  }

  // 3. LocalStorage fallback
  try {
    const localOrders: SupplierOrderDealItem[] = JSON.parse(
      localStorage.getItem(LOCAL_SUPPLIER_ORDERS_KEY) || '[]'
    );
    for (const o of localOrders) {
      mergeOrder(o);
    }
  } catch {
    // ignore
  }

  return Array.from(byCampaign.values()).sort(
    (a, b) =>
      new Date(b.closed_at || b.created_at).getTime() -
      new Date(a.closed_at || a.created_at).getTime()
  );
}

export async function fetchOwnerSupplierOrders(
  ownerId: string
): Promise<SupplierOrderDealItem[]> {
  return fetchClosedSupplierOrdersForUser(ownerId, 'owner');
}

export async function fetchSupplierCompletedOrders(
  supplierId: string
): Promise<SupplierOrderDealItem[]> {
  return fetchClosedSupplierOrdersForUser(supplierId, 'supplier');
}


