// ============================================================================
// JADIJCB: Driver Job Offers, Owner Driver Search Campaigns & Applications
// Bridges Supabase driver_job_offers, notifications, Web Push VAPID, Express SSE,
// and BroadcastChannel so drivers receive live audio + mobile shade alerts
// even when outside the app or when the app is closed.
// ============================================================================

import {
  DriverContractData,
  DriverDealContext,
  DriverJobOffer,
  WorkTerminationReason,
  WorkTerminationRecord,
} from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';
import { serverApi } from './serverApi';
import { sendWebPushToUsers } from './pushService';
import { getDriverMachineOption } from '../data/driverMachines';
import { chatStore } from './chatStore';
import { machineStore } from './machineStore';

const LOCAL_DRIVER_OFFERS_KEY = 'jadijcb_driver_job_offers_cache';
const LOCAL_APPLIED_MAP_KEY = 'jadijcb_driver_applied_offers_v1';
const LOCAL_DRIVER_DEALS_KEY = 'jadijcb_driver_deals_cache_v1';
const LOCAL_DRIVER_CONTRACTS_KEY = 'jadijcb_driver_contracts_cache_v1';
const LOCAL_WORK_TERMINATIONS_KEY = 'jadijcb_driver_work_end_v1';
const DRIVER_DISPATCH_CHANNEL = 'jadijcb_driver_dispatch';

export const DRIVER_OFFER_MARKER = '\n#DRIVER_OFFER:';
export const DRIVER_DEAL_MARKER = '\n#DRIVER_DEAL:';
export const DRIVER_CONTRACT_MARKER = '\n#DRIVER_CONTRACT:';
export const DRIVER_CONTRACT_AGREE_MARKER = '\n#DRIVER_CONTRACT_AGREE:';
export const DRIVER_WORK_END_MARKER = '\n#DRIVER_WORK_END:';

export interface MatchedDriverTarget {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  driver_experience_years?: string;
  driver_machines: string[];
}

export interface DriverJobApplicationItem {
  id: string;
  offer_id: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  driver_city: string;
  driver_experience: string;
  note?: string;
  status: string;
  created_at: string;
}

export interface OwnerDriverOfferWithApps extends DriverJobOffer {
  applications: DriverJobApplicationItem[];
}

export interface AgreedDriverDealItem {
  offer_id: string;
  owner_id: string;
  owner_name: string;
  owner_company: string;
  owner_phone: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  driver_city: string;
  driver_experience: string;
  machine_id?: string;
  machine_title: string;
  machine_image?: string;
  machine_category: string;
  machine_label_ar: string;
  machine_label_fr: string;
  offered_salary: number;
  salary_unit: 'day' | 'month';
  duration_label: string;
  city: string;
  agreed_at: string;
  contract?: DriverContractData | null;
  termination?: WorkTerminationRecord | null;
}

function getAppliedMap(driverId?: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_APPLIED_MAP_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    if (!driverId) return {};
    return all[driverId] || {};
  } catch {
    return {};
  }
}

function saveAppliedOffer(driverId: string, offerId: string) {
  try {
    const raw = localStorage.getItem(LOCAL_APPLIED_MAP_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    if (!all[driverId]) all[driverId] = {};
    all[driverId][offerId] = new Date().toISOString();
    localStorage.setItem(LOCAL_APPLIED_MAP_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

function isFakeOrDemoOffer(o?: Partial<DriverJobOffer> | null): boolean {
  if (!o) return true;
  if (o.is_demo) return true;
  if (o.id && o.id.startsWith('starter-')) return true;
  if (o.owner_id && o.owner_id.startsWith('starter-')) return true;
  return false;
}

function getLocalCachedOffers(): DriverJobOffer[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_OFFERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o: any) => !isFakeOrDemoOffer(o));
  } catch {
    return [];
  }
}

function saveLocalCachedOffers(offers: DriverJobOffer[]) {
  try {
    const clean = offers.filter((o) => !isFakeOrDemoOffer(o)).slice(0, 80);
    localStorage.setItem(LOCAL_DRIVER_OFFERS_KEY, JSON.stringify(clean));
  } catch {
    // ignore
  }
}

function mapDbRowToDriverOffer(row: any): DriverJobOffer {
  return {
    id: row.id,
    campaign_id: row.campaign_id || undefined,
    owner_id: row.owner_id,
    owner_name: row.owner_name || '',
    owner_company: row.owner_company || '',
    owner_phone: row.owner_phone || '',
    machine_id: row.machine_id || undefined,
    machine_title: row.machine_title || '',
    machine_image: row.machine_image || '',
    machine_category: row.machine_category,
    machine_label_ar: row.machine_label_ar,
    machine_label_fr: row.machine_label_fr || row.machine_label_ar,
    offered_salary: Number(row.offered_salary) || 0,
    salary_unit: row.salary_unit === 'month' ? 'month' : 'day',
    city: row.city || 'المغرب (جميع المدن)',
    work_location_note: row.work_location_note || '',
    duration_label: row.duration_label || '',
    is_urgent: Boolean(row.is_urgent),
    accommodation_included: Boolean(row.accommodation_included),
    meals_included: Boolean(row.meals_included),
    experience_required: row.experience_required || '',
    description_ar: row.description_ar || '',
    description_fr: row.description_fr || '',
    status: row.status || 'open',
    is_demo: false,
    won_driver_id: row.won_driver_id || undefined,
    won_driver_name: row.won_driver_name || undefined,
    won_driver_phone: row.won_driver_phone || undefined,
    agreed_at: row.agreed_at || undefined,
    contract_data: row.contract_data || null,
    created_at: row.created_at,
  };
}

/**
 * Finds all registered drivers across Morocco whose selected driver_machines include `machineCategory`
 * (no city/location filtering so the alert reaches every driver registered for that machine).
 */
export async function findMatchingDriversForOffer(
  machineCategory: string,
  excludeOwnerId?: string
): Promise<MatchedDriverTarget[]> {
  if (!machineCategory) return [];
  const results: MatchedDriverTarget[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, phone, phone_number, city, role, driver_machines, driver_experience_years, driver_available'
        )
        .contains('driver_machines', [machineCategory])
        .limit(200);

      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          if (!row?.id) continue;
          if (excludeOwnerId && row.id === excludeOwnerId) continue;
          if (row.driver_available === false) continue;
          const machines: string[] = Array.isArray(row.driver_machines) ? row.driver_machines : [];
          if (!machines.includes(machineCategory)) continue;
          results.push({
            id: row.id,
            full_name: row.full_name || 'سائق محترف',
            phone: row.phone || row.phone_number || '',
            city: row.city || 'المغرب',
            driver_experience_years: row.driver_experience_years || undefined,
            driver_machines: machines,
          });
        }
      }
    } catch {
      // Fallback if driver_machines column has not been migrated yet
    }
  }

  return results;
}

export async function launchDriverSearchCampaign(params: {
  ownerId: string;
  ownerName: string;
  ownerCompany?: string;
  ownerPhone?: string;
  machineId?: string;
  machineImage?: string;
  machineCategory: string;
  machineTitle?: string;
  offeredSalary: number;
  salaryUnit: 'day' | 'month';
  durationLabel: string;
  experienceRequired?: string;
  accommodationIncluded: boolean;
  mealsIncluded: boolean;
  isUrgent: boolean;
  descriptionAr?: string;
}): Promise<{
  offer: DriverJobOffer;
  matchedDrivers: MatchedDriverTarget[];
  persistedToSupabase: boolean;
}> {
  const machineMeta = getDriverMachineOption(params.machineCategory);
  const matchedDrivers = await findMatchingDriversForOffer(
    params.machineCategory,
    params.ownerId
  );

  const offerId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `drv_offer_${Date.now()}`;
  const campaignId = `drv_camp_${Date.now()}`;
  const now = new Date().toISOString();

  const labelAr = params.machineTitle
    ? `${machineMeta.labelAr} (${params.machineTitle})`
    : machineMeta.labelAr;
  const labelFr = params.machineTitle
    ? `${machineMeta.labelFr} (${params.machineTitle})`
    : machineMeta.labelFr;

  const isMachineUuid = Boolean(
    params.machineId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.machineId)
  );

  const newOffer: DriverJobOffer = {
    id: offerId,
    campaign_id: campaignId,
    owner_id: params.ownerId,
    owner_name: params.ownerName,
    owner_company: params.ownerCompany || params.ownerName,
    owner_phone: params.ownerPhone || '',
    machine_id: params.machineId || undefined,
    machine_title: params.machineTitle || labelAr,
    machine_image: params.machineImage || '',
    machine_category: params.machineCategory,
    machine_label_ar: labelAr,
    machine_label_fr: labelFr,
    offered_salary: Number(params.offeredSalary) || 0,
    salary_unit: params.salaryUnit,
    city: 'المغرب (جميع المدن)',
    work_location_note: '',
    duration_label: params.durationLabel.trim(),
    is_urgent: params.isUrgent,
    accommodation_included: params.accommodationIncluded,
    meals_included: params.mealsIncluded,
    experience_required: params.experienceRequired || '',
    description_ar: (params.descriptionAr || '').trim(),
    description_fr: (params.descriptionAr || '').trim(),
    status: 'open',
    is_demo: false,
    matched_drivers_count: matchedDrivers.length,
    created_at: now,
  };

  let persistedToSupabase = false;

  if (isSupabaseConfigured) {
    const baseInsert = {
      id: newOffer.id,
      campaign_id: newOffer.campaign_id,
      owner_id: newOffer.owner_id,
      owner_name: newOffer.owner_name,
      owner_company: newOffer.owner_company,
      owner_phone: newOffer.owner_phone,
      machine_category: newOffer.machine_category,
      machine_label_ar: newOffer.machine_label_ar,
      machine_label_fr: newOffer.machine_label_fr,
      offered_salary: newOffer.offered_salary,
      salary_unit: newOffer.salary_unit,
      city: newOffer.city,
      work_location_note: newOffer.work_location_note,
      duration_label: newOffer.duration_label,
      is_urgent: newOffer.is_urgent,
      accommodation_included: newOffer.accommodation_included,
      meals_included: newOffer.meals_included,
      experience_required: newOffer.experience_required,
      description_ar: newOffer.description_ar,
      description_fr: newOffer.description_fr,
      status: 'open',
    };

    try {
      const extendedInsert: Record<string, any> = {
        ...baseInsert,
        machine_title: newOffer.machine_title || '',
        machine_image: newOffer.machine_image || '',
      };
      if (isMachineUuid) {
        extendedInsert.machine_id = params.machineId;
      }

      let { data, error } = await supabase
        .from('driver_job_offers')
        .insert(extendedInsert)
        .select()
        .maybeSingle();

      // Fallback when remote DB has not applied machine_id/machine_image migration yet
      if (error) {
        const retry = await supabase
          .from('driver_job_offers')
          .insert(baseInsert)
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (!error) {
        persistedToSupabase = true;
        if (data?.id) {
          newOffer.id = data.id;
          newOffer.created_at = data.created_at || now;
        }
      }
    } catch {
      // Fallback to notifications + local cache if driver_job_offers table not migrated yet
    }
  }

  const salaryStr =
    newOffer.offered_salary > 0
      ? `${newOffer.offered_salary.toLocaleString('fr-FR')} درهم/${
          newOffer.salary_unit === 'month' ? 'شهر' : 'يوم'
        }`
      : 'حسب الاتفاق';
  const titleAr = `عرض عمل عاجل لسائق: ${machineMeta.labelAr} 👷`;
  const titleFr = `Offre urgente conducteur : ${machineMeta.labelFr} 👷`;
  const bodyAr = [
    `الأجر: ${salaryStr}`,
    newOffer.duration_label ? `المدة: ${newOffer.duration_label}` : '',
    newOffer.accommodation_included ? 'السكن متوفر' : '',
    `من طرف: ${newOffer.owner_company || newOffer.owner_name}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const bodyFr = [
    `Tarif : ${
      newOffer.offered_salary > 0
        ? `${newOffer.offered_salary.toLocaleString('fr-FR')} MAD/${
            newOffer.salary_unit === 'month' ? 'mois' : 'jour'
          }`
        : 'À négocier'
    }`,
    newOffer.duration_label ? `Durée : ${newOffer.duration_label}` : '',
    newOffer.accommodation_included ? 'Logement inclus' : '',
    newOffer.owner_company || newOffer.owner_name,
  ]
    .filter(Boolean)
    .join(' · ');

  const notifDataPayload = {
    offer_id: newOffer.id,
    campaign_id: newOffer.campaign_id,
    owner_id: newOffer.owner_id,
    owner_name: newOffer.owner_name,
    owner_company: newOffer.owner_company,
    owner_phone: newOffer.owner_phone,
    machine_id: newOffer.machine_id || '',
    machine_title: newOffer.machine_title || '',
    machine_image: newOffer.machine_image || '',
    machine_category: newOffer.machine_category,
    machine_label_ar: newOffer.machine_label_ar,
    machine_label_fr: newOffer.machine_label_fr,
    offered_salary: newOffer.offered_salary,
    salary_unit: newOffer.salary_unit,
    city: newOffer.city,
    duration_label: newOffer.duration_label,
    experience_required: newOffer.experience_required,
    accommodation_included: newOffer.accommodation_included,
    meals_included: newOffer.meals_included,
    description_ar: newOffer.description_ar,
    is_urgent: newOffer.is_urgent,
    db_persisted: persistedToSupabase,
    url: `/driver/joboffer?offer=${encodeURIComponent(newOffer.id)}`,
  };

  if (matchedDrivers.length > 0) {
    const matchedIds = matchedDrivers.map((d) => d.id);

    // 1. Supabase notifications insert for every matching driver
    if (isSupabaseConfigured) {
      const notifRows = matchedIds.map((driverId) => ({
        user_id: driverId,
        title_ar: titleAr,
        title_fr: titleFr,
        body_ar: bodyAr,
        body_fr: bodyFr,
        type: 'driver_job_offer',
        is_read: false,
        data: notifDataPayload,
      }));
      try {
        const { error: notifErr } = await supabase.from('notifications').insert(notifRows);
        if (!notifErr) {
          persistedToSupabase = true;
        }
      } catch {
        // ignore
      }
    }

    // 2. Express SQLite + SSE notifications for connected driver sessions
    Promise.allSettled(
      matchedIds.map((driverId) =>
        serverApi.createNotification({
          user_id: driverId,
          title_ar: titleAr,
          title_fr: titleFr,
          body_ar: bodyAr,
          body_fr: bodyFr,
          type: 'driver_job_offer',
          data: notifDataPayload,
        })
      )
    ).catch(() => {});

    // 3. Background OS Web Push VAPID (wakes closed/backgrounded driver phones)
    sendWebPushToUsers({
      userIds: matchedIds,
      id: newOffer.id,
      type: 'driver_job_offer',
      title: titleAr,
      body: bodyAr,
      tag: `driver-offer-${newOffer.id}`,
      url: `/driver/joboffer?offer=${encodeURIComponent(newOffer.id)}`,
    }).catch(() => {});
  }

  // 4. Local cache + BroadcastChannel instant sync across tabs
  const existing = getLocalCachedOffers();
  saveLocalCachedOffers([newOffer, ...existing.filter((o) => o.id !== newOffer.id)]);

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DRIVER_DISPATCH_CHANNEL);
      bc.postMessage({ type: 'NEW_DRIVER_OFFER', offer: newOffer });
      bc.close();
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated', { detail: newOffer }));
  }

  return { offer: newOffer, matchedDrivers, persistedToSupabase };
}

export async function fetchDriverJobOffers(driverId?: string): Promise<DriverJobOffer[]> {
  const appliedMap = getAppliedMap(driverId);
  let dbOffers: DriverJobOffer[] = [];
  let offersTableError = false;
  const dbAppliedIds = new Set<string>(Object.keys(appliedMap));

  const allLocalOffers = getLocalCachedOffers();
  const localClosedIds = new Set<string>(
    allLocalOffers
      .filter((o) => o.status === 'closed' || o.status === 'accepted')
      .map((o) => o.id)
  );
  for (const deal of Object.values(getLocalDriverDealsMap())) {
    if (deal.deal_status === 'accepted' || deal.deal_status === 'closed') {
      localClosedIds.add(deal.offer_id);
    }
  }

  const knownOfferIds = new Set<string>();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) {
        offersTableError = true;
      } else if (Array.isArray(data)) {
        for (const r of data) {
          const mapped = mapDbRowToDriverOffer(r);
          if (isFakeOrDemoOffer(mapped)) continue;
          knownOfferIds.add(mapped.id);
          if (mapped.status === 'open' && !localClosedIds.has(mapped.id)) {
            dbOffers.push(mapped);
          }
        }
      }

      if (driverId && !driverId.startsWith('driver-')) {
        const { data: apps } = await supabase
          .from('driver_job_applications')
          .select('offer_id')
          .eq('driver_id', driverId);
        const appliedOfferIds: string[] = [];
        if (Array.isArray(apps)) {
          apps.forEach((a: any) => {
            if (a?.offer_id) {
              dbAppliedIds.add(a.offer_id);
              appliedOfferIds.push(a.offer_id);
            }
          });
        }

        // Also check applied offers that may have been closed by another driver
        const missingApplied = appliedOfferIds.filter((id) => !knownOfferIds.has(id));
        if (missingApplied.length > 0 && !offersTableError) {
          const { data: closedAppliedRows } = await supabase
            .from('driver_job_offers')
            .select('*')
            .in('id', missingApplied);
          if (Array.isArray(closedAppliedRows)) {
            for (const row of closedAppliedRows) {
              const mapped = mapDbRowToDriverOffer(row);
              if (isFakeOrDemoOffer(mapped)) continue;
              knownOfferIds.add(mapped.id);
              if (mapped.won_driver_id === driverId && mapped.status === 'accepted') {
                // Already shown in "أعمالي المتفق عليها"
                localClosedIds.add(mapped.id);
              } else if (mapped.status !== 'open') {
                dbOffers.push(mapped);
              }
            }
          }
        }

        // Hydrate any real driver_job_offer notifications that didn't appear via driver_job_offers
        try {
          const notifOfferRows: any[] = [];
          const { data: sbNotifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', driverId)
            .eq('type', 'driver_job_offer')
            .order('created_at', { ascending: false })
            .limit(40);
          if (Array.isArray(sbNotifs)) notifOfferRows.push(...sbNotifs);

          const srvNotifs = await serverApi.getNotifications({ user_id: driverId, role: 'driver' });
          if (Array.isArray(srvNotifs?.notifications)) {
            for (const n of srvNotifs.notifications) {
              if (n.type === 'driver_job_offer') notifOfferRows.push(n);
            }
          }

          const missingFromDb: { offer: DriverJobOffer; dbPersisted?: boolean }[] = [];
          const seenNotifOfferIds = new Set<string>();
          for (const n of notifOfferRows) {
            const mapped = mapNotificationRowToDriverOffer(n);
            if (!mapped || isFakeOrDemoOffer(mapped)) continue;
            if (knownOfferIds.has(mapped.id) || seenNotifOfferIds.has(mapped.id)) continue;
            if (localClosedIds.has(mapped.id)) continue;
            seenNotifOfferIds.add(mapped.id);
            missingFromDb.push({
              offer: mapped,
              dbPersisted: n?.data?.db_persisted,
            });
          }

          if (missingFromDb.length > 0) {
            if (offersTableError) {
              missingFromDb.forEach((m) => dbOffers.push(m.offer));
            } else {
              const idsToCheck = missingFromDb.map((m) => m.offer.id);
              const { data: checkRows, error: checkErr } = await supabase
                .from('driver_job_offers')
                .select('id, status, won_driver_id, won_driver_name, agreed_at')
                .in('id', idsToCheck);
              const checkMap = new Map<string, any>();
              if (!checkErr && Array.isArray(checkRows)) {
                checkRows.forEach((r: any) => checkMap.set(r.id, r));
              }
              for (const m of missingFromDb) {
                const found = checkMap.get(m.offer.id);
                if (found) {
                  if (found.status === 'open') {
                    dbOffers.push(m.offer);
                  } else if (found.won_driver_id !== driverId) {
                    dbOffers.push({
                      ...m.offer,
                      status: found.status,
                      won_driver_id: found.won_driver_id,
                    });
                  }
                } else if (checkErr || m.dbPersisted === false) {
                  dbOffers.push(m.offer);
                }
                // If checkErr is null, found is absent, and dbPersisted !== false,
                // RLS hid it because another driver closed the deal -> omit from open feed.
              }
            }
          }
        } catch {
          // ignore notification hydration errors
        }
      }
    } catch {
      // ignore if table not migrated yet
    }
  }

  const localOffers = allLocalOffers.filter(
    (o) => !isFakeOrDemoOffer(o) && o.status === 'open' && !localClosedIds.has(o.id)
  );
  const mergedMap = new Map<string, DriverJobOffer>();

  for (const offer of [...dbOffers, ...localOffers]) {
    if (isFakeOrDemoOffer(offer)) continue;
    if (offer.status === 'open' && localClosedIds.has(offer.id)) continue;
    if (!mergedMap.has(offer.id)) {
      mergedMap.set(offer.id, {
        ...offer,
        has_applied: dbAppliedIds.has(offer.id) || Boolean(offer.has_applied),
      });
    }
  }

  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Resolves a single offer (from DB, local cache, or driver notifications) when a driver clicks
 * a notification — even if another driver already closed the deal.
 */
export async function fetchSingleDriverOfferById(
  offerId: string,
  driverId?: string
): Promise<DriverJobOffer | null> {
  if (!offerId || offerId.startsWith('starter-')) return null;

  const localMatch = getLocalCachedOffers().find((o) => o.id === offerId);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (!error && data?.id) {
        const mapped = mapDbRowToDriverOffer(data);
        return isFakeOrDemoOffer(mapped) ? null : mapped;
      }

      if (!error && !data && driverId) {
        // Check if the offer exists in driver's notifications (meaning RLS hid it after closure by another driver)
        const { data: notifRow } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', driverId)
          .eq('type', 'driver_job_offer')
          .contains('data', { offer_id: offerId })
          .limit(1)
          .maybeSingle();
        if (notifRow) {
          const fromNotif = mapNotificationRowToDriverOffer(notifRow);
          if (fromNotif && !isFakeOrDemoOffer(fromNotif)) {
            return {
              ...fromNotif,
              status: notifRow?.data?.db_persisted === false ? 'open' : 'closed',
            };
          }
        }
      }
    } catch {
      // fall through
    }
  }

  return localMatch || null;
}

/**
 * Live pre-chat guard: checks whether an offer is still open or already closed by another driver.
 */
export async function checkDriverOfferAvailability(
  offerId: string,
  driverId: string
): Promise<{ available: boolean; closedByOther?: boolean }> {
  if (!offerId || offerId.startsWith('drv_offer_')) {
    return { available: true };
  }

  const localOffers = getLocalCachedOffers();
  const localMatch = localOffers.find((o) => o.id === offerId);
  if (localMatch && (localMatch.status === 'closed' || (localMatch.status === 'accepted' && localMatch.won_driver_id !== driverId))) {
    return { available: false, closedByOther: true };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('id, status, won_driver_id')
        .eq('id', offerId)
        .maybeSingle();

      if (error) return { available: true };
      if (data) {
        if (data.status === 'open') return { available: true };
        if (data.status === 'accepted' && data.won_driver_id === driverId) {
          return { available: true };
        }
        return { available: false, closedByOther: true };
      }

      // Row returned null with no error: verify if table is active (RLS hid closed offer from non-winner)
      const { data: anyOpen } = await supabase
        .from('driver_job_offers')
        .select('id')
        .limit(1);
      if (Array.isArray(anyOpen) && anyOpen.length > 0) {
        return { available: false, closedByOther: true };
      }
    } catch {
      return { available: true };
    }
  }

  return { available: true };
}

export function cacheDriverOfferFromNotification(notifRow: any): DriverJobOffer | null {
  const mapped = mapNotificationRowToDriverOffer(notifRow);
  if (!mapped || isFakeOrDemoOffer(mapped)) return null;
  const existing = getLocalCachedOffers();
  if (!existing.some((o) => o.id === mapped.id)) {
    saveLocalCachedOffers([mapped, ...existing]);
  }
  return mapped;
}

export async function fetchOwnerDriverOffers(
  ownerId: string
): Promise<OwnerDriverOfferWithApps[]> {
  if (!ownerId) return [];
  const merged = new Map<string, OwnerDriverOfferWithApps>();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && Array.isArray(data)) {
        const offerIds = data.map((r: any) => r.id).filter(Boolean);
        let appsByOffer: Record<string, DriverJobApplicationItem[]> = {};

        if (offerIds.length > 0) {
          const { data: appRows } = await supabase
            .from('driver_job_applications')
            .select('*')
            .in('offer_id', offerIds)
            .order('created_at', { ascending: false });

          if (Array.isArray(appRows)) {
            appsByOffer = appRows.reduce((acc: Record<string, DriverJobApplicationItem[]>, a: any) => {
              const key = a.offer_id;
              if (!acc[key]) acc[key] = [];
              acc[key].push({
                id: a.id,
                offer_id: a.offer_id,
                driver_id: a.driver_id,
                driver_name: a.driver_name || 'سائق',
                driver_phone: a.driver_phone || '',
                driver_city: a.driver_city || '',
                driver_experience: a.driver_experience || '',
                note: a.note || '',
                status: a.status || 'pending',
                created_at: a.created_at,
              });
              return acc;
            }, {});
          }
        }

        for (const row of data) {
          const mapped = mapDbRowToDriverOffer(row);
          merged.set(mapped.id, {
            ...mapped,
            applications: appsByOffer[mapped.id] || [],
          });
        }
      }
    } catch {
      // ignore if table not migrated
    }
  }

  const localMine = getLocalCachedOffers().filter((o) => o.owner_id === ownerId);
  for (const o of localMine) {
    if (!merged.has(o.id)) {
      merged.set(o.id, { ...o, applications: [] });
    } else if (o.matched_drivers_count && !merged.get(o.id)!.matched_drivers_count) {
      merged.get(o.id)!.matched_drivers_count = o.matched_drivers_count;
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function closeDriverJobOffer(offerId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('driver_job_offers')
        .update({ status: 'closed' })
        .eq('id', offerId);
    } catch {
      // ignore
    }
  }

  const existing = getLocalCachedOffers();
  saveLocalCachedOffers(
    existing.map((o) => (o.id === offerId ? { ...o, status: 'closed' } : o))
  );

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DRIVER_DISPATCH_CHANNEL);
      bc.postMessage({ type: 'DRIVER_OFFER_CLOSED', offerId });
      bc.close();
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated'));
  }
}

export async function applyToDriverJobOffer(params: {
  offer: DriverJobOffer;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverCity: string;
  driverExperience: string;
  note?: string;
}): Promise<{ success: boolean }> {
  const { offer, driverId, driverName, driverPhone, driverCity, driverExperience, note } = params;

  saveAppliedOffer(driverId, offer.id);

  if (isSupabaseConfigured && !offer.is_demo) {
    try {
      await supabase.from('driver_job_applications').upsert(
        {
          offer_id: offer.id,
          driver_id: driverId,
          driver_name: driverName,
          driver_phone: driverPhone,
          driver_city: driverCity,
          driver_experience: driverExperience,
          note: note || '',
          status: 'pending',
        },
        { onConflict: 'offer_id,driver_id' }
      );

      // Notify the equipment owner when a driver expresses interest
      if (offer.owner_id && !offer.owner_id.startsWith('starter-')) {
        const titleAr = `سائق مهتم بعرض ${offer.machine_label_ar} 👷`;
        const titleFr = `Conducteur intéressé · ${offer.machine_label_fr || offer.machine_label_ar} 👷`;
        const bodyAr = `${driverName} (${driverCity}) قدّم طلباً لقيادة الآلية في عرضك.`;
        const bodyFr = `${driverName} (${driverCity}) a postulé à votre offre de conducteur.`;

        await supabase.from('notifications').insert({
          user_id: offer.owner_id,
          title_ar: titleAr,
          title_fr: titleFr,
          body_ar: bodyAr,
          body_fr: bodyFr,
          type: 'driver_application',
          data: {
            offer_id: offer.id,
            driver_id: driverId,
            driver_phone: driverPhone,
          },
        });

        sendWebPushToUsers({
          userIds: [offer.owner_id],
          id: `drv-app-${offer.id}-${driverId}`,
          type: 'driver_application',
          title: titleAr,
          body: bodyAr,
          tag: `drv-app-${offer.id}-${driverId}`,
          url: '/owner/machines',
        }).catch(() => {});
      }
    } catch {
      // ignore if migration not yet applied
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated'));
  }
  return { success: true };
}

export function mapNotificationRowToDriverOffer(row: any): DriverJobOffer | null {
  if (!row || row.type !== 'driver_job_offer') return null;
  const d = row.data || {};
  if (!d.offer_id && !row.id) return null;

  return {
    id: d.offer_id || row.id,
    campaign_id: d.campaign_id || undefined,
    owner_id: d.owner_id || '',
    owner_name: d.owner_name || 'مالك آليات',
    owner_company: d.owner_company || d.owner_name || '',
    owner_phone: d.owner_phone || '',
    machine_id: d.machine_id || undefined,
    machine_title: d.machine_title || '',
    machine_image: d.machine_image || '',
    machine_category: d.machine_category || 'tractopelle',
    machine_label_ar: d.machine_label_ar || row.title_ar || 'آلية بناء',
    machine_label_fr: d.machine_label_fr || d.machine_label_ar || 'Engin BTP',
    offered_salary: Number(d.offered_salary) || 0,
    salary_unit: d.salary_unit === 'month' ? 'month' : 'day',
    city: d.city || 'المغرب (جميع المدن)',
    work_location_note: '',
    duration_label: d.duration_label || '',
    is_urgent: d.is_urgent !== false,
    accommodation_included: Boolean(d.accommodation_included),
    meals_included: Boolean(d.meals_included),
    experience_required: d.experience_required || '',
    description_ar: d.description_ar || row.body_ar || '',
    description_fr: d.description_ar || row.body_fr || '',
    status: 'open',
    is_demo: false,
    created_at: row.created_at || new Date().toISOString(),
  };
}

export function subscribeDriverJobOffers(
  driverMachines: string[],
  onOffersChanged: (urgentOffer?: DriverJobOffer) => void
): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(DRIVER_DISPATCH_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'NEW_DRIVER_OFFER' && ev.data?.offer) {
          const offer = ev.data.offer as DriverJobOffer;
          const existing = getLocalCachedOffers();
          if (!existing.some((o) => o.id === offer.id)) {
            saveLocalCachedOffers([offer, ...existing]);
          }
          const matchesDriver =
            driverMachines.length === 0 || driverMachines.includes(offer.machine_category);
          onOffersChanged(matchesDriver ? offer : undefined);
        } else if (ev.data?.type === 'DRIVER_OFFER_CLOSED' && ev.data?.offerId) {
          const existing = getLocalCachedOffers();
          saveLocalCachedOffers(
            existing.map((o) => (o.id === ev.data.offerId ? { ...o, status: 'closed' } : o))
          );
          onOffersChanged();
        }
      };
    }
  } catch {
    bc = null;
  }

  const onLocalEvent = () => onOffersChanged();
  window.addEventListener('jadijcb_driver_offers_updated', onLocalEvent);

  let rtChannel: any = null;
  if (isSupabaseConfigured) {
    try {
      rtChannel = supabase
        .channel(`driver_job_offers_feed_${Math.random().toString(36).slice(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_job_offers' },
          (payload: any) => {
            if (payload?.eventType === 'INSERT') {
              const row = payload?.new;
              if (row?.id && row.status === 'open') {
                const mapped = mapDbRowToDriverOffer(row);
                const matchesDriver =
                  driverMachines.length === 0 ||
                  driverMachines.includes(mapped.machine_category);
                onOffersChanged(matchesDriver ? mapped : undefined);
                return;
              }
            }
            onOffersChanged();
          }
        )
        .subscribe();
    } catch {
      // ignore if realtime unavailable
    }
  }

  return () => {
    if (bc) bc.close();
    window.removeEventListener('jadijcb_driver_offers_updated', onLocalEvent);
    if (rtChannel) {
      supabase.removeChannel(rtChannel);
    }
  };
}

// ============================================================================
// Mutual Driver Deal Closure ("إغلاق الصفقة") Helpers
// ============================================================================

function getLocalDriverDealsMap(): Record<string, DriverDealContext> {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_DEALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalDriverDeal(deal: DriverDealContext) {
  try {
    const map = getLocalDriverDealsMap();
    const key = `${deal.offer_id}::${deal.driver_id}`;
    map[key] = deal;
    localStorage.setItem(LOCAL_DRIVER_DEALS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function buildDriverOfferMarkerSuffix(offer: DriverJobOffer, driverId: string): string {
  const payload = {
    offer_id: offer.id,
    owner_id: offer.owner_id,
    driver_id: driverId,
    machine_id: offer.machine_id || '',
    machine_title: offer.machine_title || offer.machine_label_ar || '',
    machine_image: offer.machine_image || '',
    machine_category: offer.machine_category,
    machine_label_ar: offer.machine_label_ar,
    machine_label_fr: offer.machine_label_fr,
    offered_salary: offer.offered_salary,
    salary_unit: offer.salary_unit,
    duration_label: offer.duration_label || '',
    city: offer.city || '',
  };
  return `${DRIVER_OFFER_MARKER}${JSON.stringify(payload)}`;
}

function parseJsonMarkerFromBody(body: string, marker: string): Record<string, any> | null {
  if (!body) return null;
  const trimmedMarker = marker.trimStart();
  const idx = body.indexOf(trimmedMarker);
  if (idx === -1) return null;
  const after = body.slice(idx + trimmedMarker.length).trim();
  const line = after.split('\n')[0];
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function parseDriverOfferMessageRow(msg: any): Partial<DriverDealContext> | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_OFFER_MARKER);
  if (!data?.offer_id) return null;
  return data as Partial<DriverDealContext>;
}

export function parseDriverDealMessageRow(msg: any): {
  offer_id: string;
  owner_id?: string;
  driver_id?: string;
  owner_accepted?: boolean;
  driver_accepted?: boolean;
  status?: DriverDealContext['deal_status'];
  won_driver_name?: string;
  won_driver_phone?: string;
} | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_DEAL_MARKER);
  if (!data?.offer_id) return null;
  return data as any;
}

function getLocalDriverContractsMap(): Record<string, DriverContractData> {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_CONTRACTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalDriverContract(contract: DriverContractData) {
  try {
    const map = getLocalDriverContractsMap();
    const key = `${contract.offer_id}::${contract.driver_id}`;
    map[key] = contract;
    localStorage.setItem(LOCAL_DRIVER_CONTRACTS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function parseDriverContractMessageRow(msg: any): DriverContractData | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_CONTRACT_MARKER);
  if (!data?.offer_id || !data?.contract_number) return null;
  return data as DriverContractData;
}

export function parseDriverContractAgreeMessageRow(msg: any): {
  offer_id: string;
  contract_number: string;
  version: number;
  party_role: 'owner' | 'driver';
  agreed_at: string;
} | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_CONTRACT_AGREE_MARKER);
  if (!data?.offer_id || !data?.contract_number) return null;
  return data as any;
}

function getLocalWorkTerminationsMap(): Record<string, WorkTerminationRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_WORK_TERMINATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalWorkTermination(offerId: string, driverId: string, record: WorkTerminationRecord) {
  try {
    const map = getLocalWorkTerminationsMap();
    map[`${offerId}::${driverId}`] = record;
    localStorage.setItem(LOCAL_WORK_TERMINATIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function parseDriverWorkEndMessageRow(
  msg: any
): (WorkTerminationRecord & { offer_id: string; driver_id?: string }) | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_WORK_END_MARKER);
  if (!data?.offer_id || !data?.work_status) return null;
  return data as any;
}

function mergeWorkTerminations(
  a?: WorkTerminationRecord | null,
  b?: WorkTerminationRecord | null
): WorkTerminationRecord | null {
  if (!a && !b) return null;
  if (!a) return b || null;
  if (!b) return a;
  if (a.work_status === 'ended' && b.work_status !== 'ended') return a;
  if (b.work_status === 'ended' && a.work_status !== 'ended') return b;
  const ownerConfirmed = Boolean(a.owner_confirmed || b.owner_confirmed);
  const driverConfirmed = Boolean(a.driver_confirmed || b.driver_confirmed);
  const status: WorkTerminationRecord['work_status'] =
    a.work_status === 'ended' ||
    b.work_status === 'ended' ||
    (ownerConfirmed && driverConfirmed)
      ? 'ended'
      : a.work_status === 'pending_end' || b.work_status === 'pending_end'
      ? 'pending_end'
      : 'active';
  return {
    ...a,
    ...b,
    work_status: status,
    owner_confirmed: ownerConfirmed,
    owner_confirmed_at: a.owner_confirmed_at || b.owner_confirmed_at,
    driver_confirmed: driverConfirmed,
    driver_confirmed_at: a.driver_confirmed_at || b.driver_confirmed_at,
    ended_at: a.ended_at || b.ended_at,
  };
}

function mergeDriverContracts(
  a?: DriverContractData | null,
  b?: DriverContractData | null
): DriverContractData | null {
  if (!a && !b) return null;
  if (!a) return b || null;
  if (!b) return a;
  const va = Number(a.version) || 1;
  const vb = Number(b.version) || 1;
  if (vb > va) {
    return {
      ...b,
      termination: mergeWorkTerminations(a.termination, b.termination),
    };
  }
  if (va > vb) {
    return {
      ...a,
      termination: mergeWorkTerminations(a.termination, b.termination),
    };
  }
  return {
    ...a,
    ...b,
    owner_agreed: Boolean(a.owner_agreed || b.owner_agreed),
    owner_agreed_at: a.owner_agreed_at || b.owner_agreed_at,
    driver_agreed: Boolean(a.driver_agreed || b.driver_agreed),
    driver_agreed_at: a.driver_agreed_at || b.driver_agreed_at,
    termination: mergeWorkTerminations(a.termination, b.termination),
  };
}

export function buildFallbackDriverContractFromDeal(
  deal: AgreedDriverDealItem
): DriverContractData {
  const year = new Date(deal.agreed_at || Date.now()).getFullYear();
  const suffix = (deal.offer_id || '0000').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '2026';
  return {
    contract_number: `CTR-DRV-${year}-${suffix}`,
    version: 1,
    offer_id: deal.offer_id,
    owner_id: deal.owner_id,
    owner_name: deal.owner_name || 'مالك الآلية',
    owner_company: deal.owner_company || deal.owner_name || '',
    owner_phone: deal.owner_phone || '',
    driver_id: deal.driver_id,
    driver_name: deal.driver_name || 'سائق مهني',
    driver_phone: deal.driver_phone || '',
    driver_city: deal.driver_city || deal.city || 'المغرب',
    machine_id: deal.machine_id,
    machine_title: deal.machine_title || deal.machine_label_ar,
    machine_image: deal.machine_image || '',
    machine_category: deal.machine_category,
    machine_label_ar: deal.machine_label_ar,
    machine_label_fr: deal.machine_label_fr,
    work_city: deal.city || 'المغرب',
    offered_salary: deal.offered_salary,
    salary_unit: deal.salary_unit,
    duration_label: deal.duration_label || 'حسب الاتفاق',
    payment_terms: deal.salary_unit === 'month' ? 'أداء شهري منتظم' : 'أداء أسبوعي منتظم',
    accommodation_included: false,
    meals_included: false,
    generated_by_id: deal.owner_id,
    generated_by_role: 'owner',
    generated_at: deal.agreed_at || new Date().toISOString(),
    owner_agreed: true,
    owner_agreed_at: deal.agreed_at,
    driver_agreed: true,
    driver_agreed_at: deal.agreed_at,
  };
}

export async function markOfferAcceptedAndClosed(params: {
  offerId: string;
  driverId: string;
  driverName?: string;
  driverPhone?: string;
}): Promise<void> {
  const { offerId, driverId, driverName, driverPhone } = params;
  const agreedAtIso = new Date().toISOString();

  if (isSupabaseConfigured && offerId && !offerId.startsWith('starter-')) {
    try {
      await supabase.rpc('finalize_driver_job_deal', {
        p_offer_id: offerId,
        p_driver_id: driverId,
        p_driver_name: driverName || '',
      });
    } catch {
      // ignore if migration has not been executed yet
    }

    try {
      const { error } = await supabase
        .from('driver_job_offers')
        .update({
          status: 'accepted',
          won_driver_id: driverId,
          won_driver_name: driverName || '',
          won_driver_phone: driverPhone || '',
          agreed_at: agreedAtIso,
        })
        .eq('id', offerId);

      if (error) {
        await supabase
          .from('driver_job_offers')
          .update({ status: 'accepted' })
          .eq('id', offerId);
      }
    } catch {
      // ignore if RLS restricts to owner only
    }

    try {
      await supabase
        .from('driver_job_applications')
        .update({ status: 'accepted' })
        .eq('offer_id', offerId)
        .eq('driver_id', driverId);
    } catch {
      // ignore
    }
  }

  const existing = getLocalCachedOffers();
  saveLocalCachedOffers(
    existing.map((o) =>
      o.id === offerId
        ? {
            ...o,
            status: 'accepted',
            won_driver_id: driverId,
            won_driver_name: driverName || o.won_driver_name,
            won_driver_phone: driverPhone || o.won_driver_phone,
            agreed_at: o.agreed_at || agreedAtIso,
          }
        : o
    )
  );

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DRIVER_DISPATCH_CHANNEL);
      bc.postMessage({ type: 'DRIVER_OFFER_CLOSED', offerId });
      bc.close();
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated', { detail: { offerId } }));
  }
}

export async function fetchDriverDealContextForConversation(params: {
  currentUserId: string;
  otherUserId: string;
  currentUserRole?: string;
  otherUserRole?: string;
  offerIdHint?: string | null;
  messages?: any[];
}): Promise<DriverDealContext | null> {
  const { currentUserId, otherUserId, currentUserRole, otherUserRole, offerIdHint, messages } =
    params;
  if (!currentUserId || !otherUserId) return null;

  const isDriverCurrent = currentUserRole === 'driver';
  const isDriverOther = otherUserRole === 'driver';
  if (!isDriverCurrent && !isDriverOther) return null;

  const driverId = isDriverCurrent ? currentUserId : otherUserId;
  const ownerId = isDriverCurrent ? otherUserId : currentUserId;

  let markerOfferMeta: Partial<DriverDealContext> | null = null;
  let markerOwnerAccepted = false;
  let markerDriverAccepted = false;
  let markerStatus: DriverDealContext['deal_status'] | null = null;
  let markerDriverName: string | undefined;
  let markerDriverPhone: string | undefined;
  const contractsByOffer = new Map<string, DriverContractData>();

  // Walk oldest -> newest so markerOfferMeta holds the LATEST offer introduced in this thread
  if (Array.isArray(messages)) {
    const dealStatesByOffer = new Map<
      string,
      { owner_accepted: boolean; driver_accepted: boolean; status?: DriverDealContext['deal_status']; won_driver_name?: string; won_driver_phone?: string }
    >();

    for (const msg of messages) {
      const offerPayload = parseDriverOfferMessageRow(msg);
      if (offerPayload?.offer_id) {
        if (!offerIdHint || offerPayload.offer_id === offerIdHint) {
          markerOfferMeta = offerPayload;
        }
      }
      const dealPayload = parseDriverDealMessageRow(msg);
      if (dealPayload?.offer_id) {
        const prev = dealStatesByOffer.get(dealPayload.offer_id) || {
          owner_accepted: false,
          driver_accepted: false,
        };
        if (dealPayload.owner_accepted) prev.owner_accepted = true;
        if (dealPayload.driver_accepted) prev.driver_accepted = true;
        if (dealPayload.status) prev.status = dealPayload.status;
        if (dealPayload.won_driver_name) prev.won_driver_name = dealPayload.won_driver_name;
        if (dealPayload.won_driver_phone) prev.won_driver_phone = dealPayload.won_driver_phone;
        dealStatesByOffer.set(dealPayload.offer_id, prev);
      }

      const contractPayload = parseDriverContractMessageRow(msg);
      if (contractPayload?.offer_id) {
        contractsByOffer.set(contractPayload.offer_id, contractPayload);
      }

      const agreePayload = parseDriverContractAgreeMessageRow(msg);
      if (agreePayload?.offer_id) {
        const existingC = contractsByOffer.get(agreePayload.offer_id);
        if (
          existingC &&
          existingC.contract_number === agreePayload.contract_number &&
          Number(existingC.version) === Number(agreePayload.version)
        ) {
          if (agreePayload.party_role === 'owner') {
            existingC.owner_agreed = true;
            existingC.owner_agreed_at = agreePayload.agreed_at || existingC.owner_agreed_at;
          } else {
            existingC.driver_agreed = true;
            existingC.driver_agreed_at = agreePayload.agreed_at || existingC.driver_agreed_at;
          }
        }
      }
    }

    const activeOfferIdForMarkers = offerIdHint || markerOfferMeta?.offer_id;
    if (activeOfferIdForMarkers) {
      const st = dealStatesByOffer.get(activeOfferIdForMarkers);
      if (st) {
        markerOwnerAccepted = st.owner_accepted;
        markerDriverAccepted = st.driver_accepted;
        markerStatus = st.status || null;
        markerDriverName = st.won_driver_name;
        markerDriverPhone = st.won_driver_phone;
      }
    } else if (dealStatesByOffer.size > 0) {
      const entries = Array.from(dealStatesByOffer.entries());
      const [lastOfferId, st] = entries[entries.length - 1];
      markerOfferMeta = { offer_id: lastOfferId };
      markerOwnerAccepted = st.owner_accepted;
      markerDriverAccepted = st.driver_accepted;
      markerStatus = st.status || null;
      markerDriverName = st.won_driver_name;
      markerDriverPhone = st.won_driver_phone;
    }
  }

  const candidateOfferId = offerIdHint || markerOfferMeta?.offer_id || null;
  let dbOffer: DriverJobOffer | null = null;
  let appRow: any = null;

  if (isSupabaseConfigured && !ownerId.startsWith('starter-')) {
    try {
      if (candidateOfferId && !candidateOfferId.startsWith('starter-')) {
        const { data } = await supabase
          .from('driver_job_offers')
          .select('*')
          .eq('id', candidateOfferId)
          .maybeSingle();
        if (data?.id) {
          dbOffer = mapDbRowToDriverOffer(data);
        }
      } else {
        // Auto-discover latest OPEN offer between this owner & driver first, then latest historical
        const { data: ownerOffers } = await supabase
          .from('driver_job_offers')
          .select('*')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .limit(15);

        if (Array.isArray(ownerOffers) && ownerOffers.length > 0) {
          const offerIds = ownerOffers.map((o: any) => o.id);
          const { data: driverApps } = await supabase
            .from('driver_job_applications')
            .select('*')
            .in('offer_id', offerIds)
            .eq('driver_id', driverId);

          if (Array.isArray(driverApps) && driverApps.length > 0) {
            // Prefer open offer the driver applied to, otherwise most recent applied offer
            const openApplied = ownerOffers.find(
              (o: any) => o.status === 'open' && driverApps.some((a: any) => a.offer_id === o.id)
            );
            const fallbackApplied = ownerOffers.find((o: any) =>
              driverApps.some((a: any) => a.offer_id === o.id)
            );
            const matchedOffer = openApplied || fallbackApplied;
            if (matchedOffer) {
              dbOffer = mapDbRowToDriverOffer(matchedOffer);
              appRow = driverApps.find((a: any) => a.offer_id === matchedOffer.id) || driverApps[0];
            }
          }
          if (!dbOffer) {
            const latestOpen = ownerOffers.find((o: any) => o.status === 'open') || ownerOffers[0];
            if (latestOpen) dbOffer = mapDbRowToDriverOffer(latestOpen);
          }
        }
      }

      if (dbOffer && !appRow && !dbOffer.is_demo) {
        const { data: appData } = await supabase
          .from('driver_job_applications')
          .select('*')
          .eq('offer_id', dbOffer.id)
          .eq('driver_id', driverId)
          .maybeSingle();
        if (appData) appRow = appData;
      }
    } catch {
      // ignore if schema not migrated yet
    }
  }

  // Fallback to local cached offers if DB didn't return one
  if (!dbOffer) {
    const localList = getLocalCachedOffers();
    dbOffer =
      (candidateOfferId
        ? localList.find((o) => o.id === candidateOfferId)
        : localList.find((o) => o.owner_id === ownerId && o.status === 'open') ||
          localList.find((o) => o.owner_id === ownerId)) || null;
  }

  const resolvedOfferId = dbOffer?.id || candidateOfferId;
  if (!resolvedOfferId) return null;

  const localDealsMap = getLocalDriverDealsMap();
  const localDeal = localDealsMap[`${resolvedOfferId}::${driverId}`];

  const resolvedMachineId =
    dbOffer?.machine_id || markerOfferMeta?.machine_id || localDeal?.machine_id || undefined;
  let resolvedMachineImage =
    dbOffer?.machine_image || markerOfferMeta?.machine_image || localDeal?.machine_image || '';
  let resolvedMachineTitle =
    dbOffer?.machine_title || markerOfferMeta?.machine_title || localDeal?.machine_title || '';

  if ((!resolvedMachineImage || !resolvedMachineTitle) && resolvedMachineId) {
    const cachedMachine = machineStore
      .getCachedMachines()
      .find((m) => m.id === resolvedMachineId);
    if (cachedMachine) {
      if (!resolvedMachineImage) resolvedMachineImage = cachedMachine.images?.[0] || '';
      if (!resolvedMachineTitle) {
        resolvedMachineTitle =
          cachedMachine.title_ar ||
          cachedMachine.title_fr ||
          `${cachedMachine.brand} ${cachedMachine.model}`.trim();
      }
    }
  }

  const ownerAccepted = Boolean(
    markerOwnerAccepted ||
      localDeal?.owner_accepted ||
      markerStatus === 'accepted' ||
      dbOffer?.status === 'accepted'
  );
  const driverAccepted = Boolean(
    markerDriverAccepted ||
      localDeal?.driver_accepted ||
      markerStatus === 'accepted' ||
      dbOffer?.status === 'accepted'
  );

  let dealStatus: DriverDealContext['deal_status'] = 'open';
  if (
    (ownerAccepted && driverAccepted) ||
    markerStatus === 'accepted' ||
    localDeal?.deal_status === 'accepted' ||
    dbOffer?.status === 'accepted' ||
    appRow?.status === 'accepted'
  ) {
    dealStatus = 'accepted';
  } else if (dbOffer?.status === 'closed' || localDeal?.deal_status === 'closed') {
    dealStatus = 'closed';
  } else if (ownerAccepted) {
    dealStatus = 'pending_driver';
  } else if (driverAccepted) {
    dealStatus = 'pending_owner';
  }

  const localContractsMap = getLocalDriverContractsMap();
  const markerContract = contractsByOffer.get(resolvedOfferId) || null;
  const localContract = localContractsMap[`${resolvedOfferId}::${driverId}`] || null;
  let resolvedContract = mergeDriverContracts(
    mergeDriverContracts(markerContract, localContract),
    dbOffer?.contract_data || null
  );
  if (resolvedContract) {
    if (!resolvedContract.machine_image && resolvedMachineImage) {
      resolvedContract = { ...resolvedContract, machine_image: resolvedMachineImage };
    }
    if (!resolvedContract.machine_title && resolvedMachineTitle) {
      resolvedContract = { ...resolvedContract, machine_title: resolvedMachineTitle };
    }
  }

  return {
    offer_id: resolvedOfferId,
    owner_id: ownerId,
    driver_id: driverId,
    machine_id: resolvedMachineId,
    machine_title: resolvedMachineTitle || resolvedContract?.machine_title || undefined,
    machine_image: resolvedMachineImage || resolvedContract?.machine_image || undefined,
    machine_category:
      dbOffer?.machine_category || markerOfferMeta?.machine_category || localDeal?.machine_category || 'tractopelle',
    machine_label_ar:
      dbOffer?.machine_label_ar ||
      markerOfferMeta?.machine_label_ar ||
      localDeal?.machine_label_ar ||
      'آلية أشغال عمومية',
    machine_label_fr:
      dbOffer?.machine_label_fr ||
      markerOfferMeta?.machine_label_fr ||
      localDeal?.machine_label_fr ||
      'Engin BTP',
    offered_salary: Number(
      resolvedContract?.offered_salary ??
        dbOffer?.offered_salary ??
        markerOfferMeta?.offered_salary ??
        localDeal?.offered_salary ??
        0
    ),
    salary_unit:
      resolvedContract?.salary_unit ||
      dbOffer?.salary_unit ||
      markerOfferMeta?.salary_unit ||
      localDeal?.salary_unit ||
      'day',
    duration_label:
      resolvedContract?.duration_label ||
      dbOffer?.duration_label ||
      markerOfferMeta?.duration_label ||
      localDeal?.duration_label ||
      '',
    work_city: resolvedContract?.work_city || dbOffer?.city || (markerOfferMeta as any)?.city || '',
    work_location_note: resolvedContract?.work_location_note || dbOffer?.work_location_note || '',
    accommodation_included:
      resolvedContract?.accommodation_included ?? Boolean(dbOffer?.accommodation_included),
    meals_included: resolvedContract?.meals_included ?? Boolean(dbOffer?.meals_included),
    owner_accepted: dealStatus === 'accepted' ? true : ownerAccepted,
    driver_accepted: dealStatus === 'accepted' ? true : driverAccepted,
    deal_status: dealStatus,
    won_driver_name:
      markerDriverName || dbOffer?.won_driver_name || appRow?.driver_name || localDeal?.won_driver_name,
    won_driver_phone:
      markerDriverPhone || dbOffer?.won_driver_phone || appRow?.driver_phone || localDeal?.won_driver_phone,
    agreed_at: dbOffer?.agreed_at || localDeal?.agreed_at,
    contract: resolvedContract,
  };
}

/**
 * Generates or updates a structured PDF work contract draft inside the conversation
 * so BOTH Owner & Driver review and agree on it before closing the deal ("إغلاق الصفقة").
 */
export async function generateAndSendDriverContract(params: {
  deal: DriverDealContext;
  contractInput: Omit<
    DriverContractData,
    | 'contract_number'
    | 'version'
    | 'offer_id'
    | 'owner_id'
    | 'driver_id'
    | 'generated_by_id'
    | 'generated_by_role'
    | 'generated_at'
    | 'owner_agreed'
    | 'owner_agreed_at'
    | 'driver_agreed'
    | 'driver_agreed_at'
  >;
  partyRole: 'owner' | 'driver';
  currentUserId: string;
  currentUserName?: string;
  conversationId: string;
}): Promise<DriverContractData> {
  const { deal, contractInput, partyRole, currentUserId, currentUserName, conversationId } = params;
  const nowIso = new Date().toISOString();
  const prevContract = deal.contract;
  const year = new Date().getFullYear();
  const randomCode = Math.floor(1000 + Math.random() * 9000);
  const contractNumber = prevContract?.contract_number || `CTR-DRV-${year}-${randomCode}`;
  const nextVersion = prevContract ? (Number(prevContract.version) || 1) + 1 : 1;

  const contract: DriverContractData = {
    ...contractInput,
    contract_number: contractNumber,
    version: nextVersion,
    offer_id: deal.offer_id,
    owner_id: deal.owner_id,
    driver_id: deal.driver_id,
    generated_by_id: currentUserId,
    generated_by_role: partyRole,
    generated_at: nowIso,
    owner_agreed: partyRole === 'owner',
    owner_agreed_at: partyRole === 'owner' ? nowIso : undefined,
    driver_agreed: partyRole === 'driver',
    driver_agreed_at: partyRole === 'driver' ? nowIso : undefined,
  };

  saveLocalDriverContract(contract);

  // Sync updated terms onto local deal & cached offer too
  const updatedDeal: DriverDealContext = {
    ...deal,
    offered_salary: contract.offered_salary,
    salary_unit: contract.salary_unit,
    duration_label: contract.duration_label,
    contract,
  };
  saveLocalDriverDeal(updatedDeal);

  const existingOffers = getLocalCachedOffers();
  saveLocalCachedOffers(
    existingOffers.map((o) =>
      o.id === deal.offer_id
        ? {
            ...o,
            offered_salary: contract.offered_salary,
            salary_unit: contract.salary_unit,
            duration_label: contract.duration_label,
            contract_data: contract,
          }
        : o
    )
  );

  if (isSupabaseConfigured && deal.offer_id && !deal.offer_id.startsWith('starter-')) {
    try {
      await supabase
        .from('driver_job_offers')
        .update({
          contract_data: contract,
          offered_salary: contract.offered_salary,
          salary_unit: contract.salary_unit,
          duration_label: contract.duration_label,
        })
        .eq('id', deal.offer_id);
    } catch {
      // ignore if contract_data column is not migrated yet; message stream preserves full JSON
    }
  }

  const unitLabel = contract.salary_unit === 'month' ? 'شهر' : 'يوم';
  const humanMsg = `📄 تم توليد عقد العمل (${contract.contract_number} · نسخة v${nextVersion}) للآلية: ${contract.machine_title} بأجر ${contract.offered_salary.toLocaleString('fr-FR')} د.م/${unitLabel} (${contract.duration_label}). يرجى مراجعة العقد والموافقة عليه قبل إغلاق الصفقة.`;

  const recipientId = partyRole === 'owner' ? deal.driver_id : deal.owner_id;
  const recipientRole = partyRole === 'owner' ? 'driver' : 'owner';

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    `${humanMsg}${DRIVER_CONTRACT_MARKER}${JSON.stringify(contract)}`,
    recipientId,
    {
      senderName: currentUserName,
      recipientRole,
    }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated', { detail: { offerId: deal.offer_id } }));
  }

  return contract;
}

/**
 * Records either party's explicit approval of the generated PDF contract terms
 * before unlocking mutual deal closure ("إغلاق الصفقة").
 */
export async function agreeToDriverContractParty(params: {
  deal: DriverDealContext;
  contract: DriverContractData;
  partyRole: 'owner' | 'driver';
  currentUserId: string;
  currentUserName?: string;
  conversationId: string;
}): Promise<DriverContractData> {
  const { deal, contract, partyRole, currentUserId, currentUserName, conversationId } = params;
  const nowIso = new Date().toISOString();

  const updatedContract: DriverContractData = {
    ...contract,
    owner_agreed: partyRole === 'owner' ? true : contract.owner_agreed,
    owner_agreed_at:
      partyRole === 'owner' ? contract.owner_agreed_at || nowIso : contract.owner_agreed_at,
    driver_agreed: partyRole === 'driver' ? true : contract.driver_agreed,
    driver_agreed_at:
      partyRole === 'driver' ? contract.driver_agreed_at || nowIso : contract.driver_agreed_at,
  };

  saveLocalDriverContract(updatedContract);
  saveLocalDriverDeal({ ...deal, contract: updatedContract });

  const existingOffers = getLocalCachedOffers();
  saveLocalCachedOffers(
    existingOffers.map((o) =>
      o.id === deal.offer_id ? { ...o, contract_data: updatedContract } : o
    )
  );

  if (isSupabaseConfigured && deal.offer_id && !deal.offer_id.startsWith('starter-')) {
    try {
      await supabase
        .from('driver_job_offers')
        .update({ contract_data: updatedContract })
        .eq('id', deal.offer_id);
    } catch {
      // ignore if column not migrated yet
    }
  }

  const bothAgreed = updatedContract.owner_agreed && updatedContract.driver_agreed;
  const humanMsg = bothAgreed
    ? `✅ وافق الطرفان على عقد العمل رقم ${updatedContract.contract_number}! يمكنكم الآن الضغط على «إغلاق الصفقة» لتثبيت العمل نهائياً.`
    : partyRole === 'owner'
    ? `✅ وافق المالك على بنود عقد العمل رقم ${updatedContract.contract_number} — في انتظار موافقة السائق على العقد.`
    : `✅ وافق السائق على بنود عقد العمل رقم ${updatedContract.contract_number} — في انتظار موافقة المالك على العقد.`;

  const recipientId = partyRole === 'owner' ? deal.driver_id : deal.owner_id;
  const recipientRole = partyRole === 'owner' ? 'driver' : 'owner';

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    `${humanMsg}${DRIVER_CONTRACT_AGREE_MARKER}${JSON.stringify({
      offer_id: deal.offer_id,
      contract_number: updatedContract.contract_number,
      version: updatedContract.version,
      party_role: partyRole,
      agreed_at: nowIso,
    })}`,
    recipientId,
    {
      senderName: currentUserName,
      recipientRole,
    }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated', { detail: { offerId: deal.offer_id } }));
  }

  return updatedContract;
}

const REASON_LABELS_AR: Record<WorkTerminationReason, string> = {
  completed_project: 'انتهاء الأشغال والمدة المتفق عليها (المادة 33)',
  mutual_agreement: 'إنهاء العمل بالتراضي وإبراء الذمة',
  driver_resignation: 'مغادرة طوعية / استقالة السائق (المادة 34)',
  owner_early_stop: 'توقف مبكر من طرف المالك / المقاولة',
};

/**
 * Initiates, confirms mutually, or performs documented unilateral termination
 * of a driver work agreement under Moroccan Labor Law safeguards.
 */
export async function submitWorkTerminationAction(params: {
  deal: AgreedDriverDealItem;
  partyRole: 'owner' | 'driver';
  currentUserId: string;
  currentUserName?: string;
  reason?: WorkTerminationReason;
  note?: string;
  forceUnilateral?: boolean;
}): Promise<WorkTerminationRecord> {
  const { deal, partyRole, currentUserId, currentUserName, reason, note, forceUnilateral } =
    params;
  const nowIso = new Date().toISOString();
  const prevTerm = deal.termination || deal.contract?.termination || null;

  const ownerConfirmed =
    partyRole === 'owner' ? true : Boolean(prevTerm?.owner_confirmed);
  const driverConfirmed =
    partyRole === 'driver' ? true : Boolean(prevTerm?.driver_confirmed);
  const isFinalEnded = Boolean(forceUnilateral || (ownerConfirmed && driverConfirmed));

  const nextTerm: WorkTerminationRecord = {
    work_status: isFinalEnded ? 'ended' : 'pending_end',
    reason: reason || prevTerm?.reason || 'completed_project',
    note: note !== undefined ? note : prevTerm?.note || '',
    initiated_by: prevTerm?.initiated_by || partyRole,
    initiated_at: prevTerm?.initiated_at || nowIso,
    owner_confirmed: ownerConfirmed,
    owner_confirmed_at:
      partyRole === 'owner' ? prevTerm?.owner_confirmed_at || nowIso : prevTerm?.owner_confirmed_at,
    driver_confirmed: driverConfirmed,
    driver_confirmed_at:
      partyRole === 'driver'
        ? prevTerm?.driver_confirmed_at || nowIso
        : prevTerm?.driver_confirmed_at,
    unilateral_close: Boolean(forceUnilateral && !(ownerConfirmed && driverConfirmed)),
    ended_at: isFinalEnded ? prevTerm?.ended_at || nowIso : undefined,
  };

  saveLocalWorkTermination(deal.offer_id, deal.driver_id, nextTerm);

  const baseContract = deal.contract || buildFallbackDriverContractFromDeal(deal);
  const updatedContract: DriverContractData = {
    ...baseContract,
    termination: nextTerm,
  };
  saveLocalDriverContract(updatedContract);

  const cachedOffers = getLocalCachedOffers();
  saveLocalCachedOffers(
    cachedOffers.map((o) =>
      o.id === deal.offer_id ? { ...o, contract_data: updatedContract } : o
    )
  );

  if (isSupabaseConfigured && deal.offer_id && !deal.offer_id.startsWith('starter-')) {
    try {
      await supabase
        .from('driver_job_offers')
        .update({ contract_data: updatedContract })
        .eq('id', deal.offer_id);
    } catch {
      // ignore if contract_data column is not migrated yet
    }
  }

  const peerId = partyRole === 'owner' ? deal.driver_id : deal.owner_id;
  const peerRole = partyRole === 'owner' ? 'driver' : 'owner';
  const reasonLabel = REASON_LABELS_AR[nextTerm.reason || 'completed_project'];

  try {
    if (peerId && !peerId.startsWith('starter-')) {
      const conv = await chatStore.getOrCreateConversation(currentUserId, peerId, null, {
        id: peerId,
        full_name: peerRole === 'driver' ? deal.driver_name : deal.owner_name,
        phone: peerRole === 'driver' ? deal.driver_phone : deal.owner_phone,
        role: peerRole,
      });
      const msgText = isFinalEnded
        ? nextTerm.unilateral_close
          ? `📋 تم تسجيل إنهاء العمل من طرف ${partyRole === 'owner' ? 'المالك' : 'السائق'} (${deal.machine_title}). السبب: ${reasonLabel}.`
          : `✅ تم تأكيد إنهاء العمل وتصفية الحساب بين الطرفين لآلية (${deal.machine_title}). السبب: ${reasonLabel}.`
        : `📋 طلب ${partyRole === 'owner' ? 'المالك' : 'السائق'} إنهاء العمل لآلية (${deal.machine_title}) — السبب: ${reasonLabel}. يرجى التأكيد لتثبيت نهاية المهمة وإبراء الذمة.`;

      await chatStore.sendMessage(
        conv.id,
        currentUserId,
        `${msgText}${DRIVER_WORK_END_MARKER}${JSON.stringify({
          offer_id: deal.offer_id,
          driver_id: deal.driver_id,
          ...nextTerm,
        })}`,
        peerId,
        { senderName: currentUserName, recipientRole: peerRole }
      );
    }
  } catch {
    // ignore chat sync failure
  }

  if (isSupabaseConfigured && peerId && !peerId.startsWith('starter-')) {
    const titleAr = isFinalEnded
      ? `تم إنهاء العمل وتصفية الحساب: ${deal.machine_title} ✅`
      : `طلب تأكيد إنهاء العمل: ${deal.machine_title} 📋`;
    const titleFr = isFinalEnded
      ? `Fin de mission confirmée : ${deal.machine_label_fr} ✅`
      : `Demande de fin de mission : ${deal.machine_label_fr} 📋`;
    const bodyAr = isFinalEnded
      ? `السبب: ${reasonLabel}`
      : `يرجى الدخول لتأكيد إنهاء المهمة وتثبيت إبراء الذمة.`;
    const bodyFr = `Motif : ${reasonLabel}`;

    supabase
      .from('notifications')
      .insert({
        user_id: peerId,
        title_ar: titleAr,
        title_fr: titleFr,
        body_ar: bodyAr,
        body_fr: bodyFr,
        type: 'driver_work_ended',
        data: { offer_id: deal.offer_id, work_status: nextTerm.work_status },
      })
      .then(() => {}, () => {});

    sendWebPushToUsers({
      userIds: [peerId],
      id: `drv-end-${deal.offer_id}-${nextTerm.work_status}`,
      type: 'driver_work_ended',
      title: titleAr,
      body: bodyAr,
      tag: `drv-end-${deal.offer_id}`,
      url: peerRole === 'driver' ? '/driver/joboffer' : '/owner/drivers',
    }).catch(() => {});
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DRIVER_DISPATCH_CHANNEL);
      bc.postMessage({ type: 'DRIVER_WORK_END_UPDATED', offerId: deal.offer_id });
      bc.close();
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('jadijcb_driver_offers_updated', { detail: { offerId: deal.offer_id } })
    );
  }

  return nextTerm;
}

export async function acceptAndCloseDriverDealParty(params: {
  deal: DriverDealContext;
  partyRole: 'owner' | 'driver';
  currentUserId: string;
  currentUserName?: string;
  currentUserPhone?: string;
  conversationId: string;
}): Promise<{ updatedDeal: DriverDealContext; finalized: boolean }> {
  const { deal, partyRole, currentUserId, currentUserName, currentUserPhone, conversationId } = params;

  const nextOwnerAccepted = partyRole === 'owner' ? true : deal.owner_accepted;
  const nextDriverAccepted = partyRole === 'driver' ? true : deal.driver_accepted;
  const finalized = nextOwnerAccepted && nextDriverAccepted;
  const agreedAt = finalized ? deal.agreed_at || new Date().toISOString() : deal.agreed_at;

  const updatedDeal: DriverDealContext = {
    ...deal,
    owner_accepted: nextOwnerAccepted,
    driver_accepted: nextDriverAccepted,
    deal_status: finalized
      ? 'accepted'
      : nextOwnerAccepted
      ? 'pending_driver'
      : 'pending_owner',
    won_driver_name:
      partyRole === 'driver' && currentUserName ? currentUserName : deal.won_driver_name,
    won_driver_phone:
      partyRole === 'driver' && currentUserPhone ? currentUserPhone : deal.won_driver_phone,
    agreed_at: agreedAt,
  };

  saveLocalDriverDeal(updatedDeal);

  const markerPayload = {
    offer_id: updatedDeal.offer_id,
    owner_id: updatedDeal.owner_id,
    driver_id: updatedDeal.driver_id,
    owner_accepted: updatedDeal.owner_accepted,
    driver_accepted: updatedDeal.driver_accepted,
    status: updatedDeal.deal_status,
    won_driver_name: updatedDeal.won_driver_name || '',
    won_driver_phone: updatedDeal.won_driver_phone || '',
  };

  const humanText = finalized
    ? `🤝 تم إغلاق الصفقة بنجاح! اتفق الطرفان على شروط العمل وتم تثبيت الاتفاق (${updatedDeal.machine_title || updatedDeal.machine_label_ar}).`
    : partyRole === 'owner'
    ? `🤝 أكد المالك اتفاق شروط العمل وإغلاق الصفقة — في انتظار تأكيد السائق لإتمام الاتفاق.`
    : `🤝 أكد السائق اتفاق شروط العمل وإغلاق الصفقة — في انتظار تأكيد المالك لإتمام الاتفاق.`;

  const recipientId = partyRole === 'owner' ? deal.driver_id : deal.owner_id;
  const recipientRole = partyRole === 'owner' ? 'driver' : 'owner';

  await chatStore.sendMessage(
    conversationId,
    currentUserId,
    `${humanText}${DRIVER_DEAL_MARKER}${JSON.stringify(markerPayload)}`,
    recipientId,
    {
      senderName: currentUserName,
      recipientRole,
    }
  );

  if (finalized) {
    await markOfferAcceptedAndClosed({
      offerId: updatedDeal.offer_id,
      driverId: updatedDeal.driver_id,
      driverName: updatedDeal.won_driver_name,
      driverPhone: updatedDeal.won_driver_phone,
    });

    if (isSupabaseConfigured && recipientId && !recipientId.startsWith('starter-')) {
      const titleAr = `تم إغلاق صفقة العمل: ${updatedDeal.machine_title || updatedDeal.machine_label_ar} 🤝`;
      const titleFr = `Accord conducteur conclu : ${updatedDeal.machine_label_fr} 🤝`;
      const bodyAr = 'اتفق الطرفان على شروط العمل وتم تسجيل الصفقة في قسم عروض العمل والسائقون.';
      const bodyFr = 'Les deux parties ont confirmé les conditions de travail.';

      supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          title_ar: titleAr,
          title_fr: titleFr,
          body_ar: bodyAr,
          body_fr: bodyFr,
          type: 'driver_deal_closed',
          data: { offer_id: updatedDeal.offer_id },
        })
        .then(() => {}, () => {});

      sendWebPushToUsers({
        userIds: [recipientId],
        id: `drv-deal-${updatedDeal.offer_id}`,
        type: 'driver_deal_closed',
        title: titleAr,
        body: bodyAr,
        tag: `drv-deal-${updatedDeal.offer_id}`,
        url: recipientRole === 'driver' ? '/driver/joboffer' : '/owner/drivers',
      }).catch(() => {});
    }
  }

  return { updatedDeal, finalized };
}

export async function finalizeDriverJobOfferDirect(params: {
  offer: DriverJobOffer;
  ownerId: string;
  ownerName?: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  driverCity?: string;
}): Promise<DriverDealContext> {
  const { offer, ownerId, ownerName, driverId, driverName, driverPhone, driverCity } = params;
  const agreedAt = new Date().toISOString();

  const deal: DriverDealContext = {
    offer_id: offer.id,
    owner_id: ownerId,
    driver_id: driverId,
    machine_id: offer.machine_id,
    machine_title: offer.machine_title || offer.machine_label_ar,
    machine_image: offer.machine_image,
    machine_category: offer.machine_category,
    machine_label_ar: offer.machine_label_ar,
    machine_label_fr: offer.machine_label_fr,
    offered_salary: offer.offered_salary,
    salary_unit: offer.salary_unit,
    duration_label: offer.duration_label || '',
    owner_accepted: true,
    driver_accepted: true,
    deal_status: 'accepted',
    won_driver_name: driverName,
    won_driver_phone: driverPhone,
    agreed_at: agreedAt,
  };

  saveLocalDriverDeal(deal);

  await markOfferAcceptedAndClosed({
    offerId: offer.id,
    driverId,
    driverName,
    driverPhone,
  });

  // Also log the deal closure message into their direct conversation so chat reflects it immediately
  try {
    const conv = await chatStore.getOrCreateConversation(ownerId, driverId, null, {
      id: driverId,
      full_name: driverName,
      phone: driverPhone || '',
      city: driverCity || '',
      role: 'driver',
    });
    const markerPayload = {
      offer_id: offer.id,
      owner_id: ownerId,
      driver_id: driverId,
      owner_accepted: true,
      driver_accepted: true,
      status: 'accepted',
      won_driver_name: driverName,
      won_driver_phone: driverPhone || '',
    };
    await chatStore.sendMessage(
      conv.id,
      ownerId,
      `🤝 تم إغلاق الصفقة مع السائق (${driverName}) على شروط العمل وتم تثبيت الاتفاق (${offer.machine_title || offer.machine_label_ar}).${DRIVER_DEAL_MARKER}${JSON.stringify(markerPayload)}`,
      driverId,
      { senderName: ownerName, recipientRole: 'driver' }
    );
  } catch {
    // ignore chat error
  }

  if (isSupabaseConfigured && driverId && !driverId.startsWith('starter-')) {
    const titleAr = `تم إغلاق صفقة العمل معك: ${offer.machine_title || offer.machine_label_ar} 🤝`;
    const titleFr = `Offre conclue avec vous : ${offer.machine_label_fr} 🤝`;
    const bodyAr = `أكد ${ownerName || offer.owner_name} الاتفاق على العمل وأدرجها في قسم عروض العمل.`;
    const bodyFr = `${ownerName || offer.owner_name} a validé l’accord de travail avec vous.`;

    supabase
      .from('notifications')
      .insert({
        user_id: driverId,
        title_ar: titleAr,
        title_fr: titleFr,
        body_ar: bodyAr,
        body_fr: bodyFr,
        type: 'driver_deal_closed',
        data: { offer_id: offer.id },
      })
      .then(() => {}, () => {});

    sendWebPushToUsers({
      userIds: [driverId],
      id: `drv-deal-${offer.id}`,
      type: 'driver_deal_closed',
      title: titleAr,
      body: bodyAr,
      tag: `drv-deal-${offer.id}`,
      url: '/driver/joboffer',
    }).catch(() => {});
  }

  return deal;
}

/**
 * Fetches all finalized/agreed driver deals for a specific DRIVER
 * so agreed jobs show prominently inside /driver/joboffer ("عروض العمل").
 */
export async function fetchDriverAgreedDeals(driverId: string): Promise<AgreedDriverDealItem[]> {
  if (!driverId) return [];
  const dealsMap = new Map<string, AgreedDriverDealItem>();
  const cachedOffers = getLocalCachedOffers();
  const cachedMachines = machineStore.getCachedMachines();

  // 1. Seed from local deal cache + local offer cache
  const localDeals = getLocalDriverDealsMap();
  for (const deal of Object.values(localDeals)) {
    if (deal.driver_id !== driverId || deal.deal_status !== 'accepted') continue;
    const matchedOffer = cachedOffers.find((o) => o.id === deal.offer_id);
    const matchedMachine = deal.machine_id
      ? cachedMachines.find((m) => m.id === deal.machine_id)
      : undefined;
    dealsMap.set(deal.offer_id, {
      offer_id: deal.offer_id,
      owner_id: deal.owner_id,
      owner_name: matchedOffer?.owner_name || 'مالك الآلية',
      owner_company: matchedOffer?.owner_company || matchedOffer?.owner_name || 'مالك الآلية',
      owner_phone: matchedOffer?.owner_phone || '',
      driver_id: driverId,
      driver_name: deal.won_driver_name || 'سائق محترف',
      driver_phone: deal.won_driver_phone || '',
      driver_city: matchedOffer?.city || 'المغرب',
      driver_experience: matchedOffer?.experience_required || '',
      machine_id: deal.machine_id || matchedOffer?.machine_id,
      machine_title:
        deal.machine_title ||
        matchedOffer?.machine_title ||
        matchedMachine?.title_ar ||
        deal.machine_label_ar,
      machine_image:
        deal.machine_image || matchedOffer?.machine_image || matchedMachine?.images?.[0] || '',
      machine_category: deal.machine_category,
      machine_label_ar: deal.machine_label_ar,
      machine_label_fr: deal.machine_label_fr,
      offered_salary: Number(deal.offered_salary) || 0,
      salary_unit: deal.salary_unit || 'day',
      duration_label: deal.duration_label || matchedOffer?.duration_label || '',
      city: matchedOffer?.city || 'المغرب (جميع المدن)',
      agreed_at: deal.agreed_at || matchedOffer?.agreed_at || matchedOffer?.created_at || new Date().toISOString(),
    });
  }

  for (const o of cachedOffers) {
    if (o.status === 'accepted' && o.won_driver_id === driverId && !dealsMap.has(o.id)) {
      const matchedMachine = o.machine_id ? cachedMachines.find((m) => m.id === o.machine_id) : undefined;
      dealsMap.set(o.id, {
        offer_id: o.id,
        owner_id: o.owner_id,
        owner_name: o.owner_name,
        owner_company: o.owner_company || o.owner_name,
        owner_phone: o.owner_phone || '',
        driver_id: driverId,
        driver_name: o.won_driver_name || 'سائق محترف',
        driver_phone: o.won_driver_phone || '',
        driver_city: o.city || 'المغرب',
        driver_experience: o.experience_required || '',
        machine_id: o.machine_id,
        machine_title: o.machine_title || matchedMachine?.title_ar || o.machine_label_ar,
        machine_image: o.machine_image || matchedMachine?.images?.[0] || '',
        machine_category: o.machine_category,
        machine_label_ar: o.machine_label_ar,
        machine_label_fr: o.machine_label_fr,
        offered_salary: Number(o.offered_salary) || 0,
        salary_unit: o.salary_unit,
        duration_label: o.duration_label || '',
        city: o.city || 'المغرب (جميع المدن)',
        agreed_at: o.agreed_at || o.created_at,
      });
    }
  }

  // 2. Query Supabase for authoritative accepted applications & offers
  if (isSupabaseConfigured && !driverId.startsWith('driver-')) {
    try {
      const { data: apps } = await supabase
        .from('driver_job_applications')
        .select('*')
        .eq('driver_id', driverId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      const appOfferIds = Array.isArray(apps) ? apps.map((a: any) => a.offer_id).filter(Boolean) : [];
      const dbOffersById = new Map<string, DriverJobOffer>();

      if (appOfferIds.length > 0) {
        const { data: offerRows } = await supabase
          .from('driver_job_offers')
          .select('*')
          .in('id', appOfferIds);
        if (Array.isArray(offerRows)) {
          offerRows.forEach((r: any) => dbOffersById.set(r.id, mapDbRowToDriverOffer(r)));
        }
      }

      try {
        const { data: wonRows } = await supabase
          .from('driver_job_offers')
          .select('*')
          .eq('won_driver_id', driverId)
          .eq('status', 'accepted');
        if (Array.isArray(wonRows)) {
          wonRows.forEach((r: any) => dbOffersById.set(r.id, mapDbRowToDriverOffer(r)));
        }
      } catch {
        // ignore if won_driver_id column not yet migrated
      }

      // Enrich missing machine thumbnails from Supabase machines table
      const missingImageMachineIds = Array.from(
        new Set(
          Array.from(dbOffersById.values())
            .filter((o) => o.machine_id && !o.machine_image)
            .map((o) => o.machine_id as string)
        )
      );
      const machineById = new Map<string, any>();
      if (missingImageMachineIds.length > 0) {
        const { data: mRows } = await supabase
          .from('machines')
          .select('id, title_ar, title_fr, brand, model, images')
          .in('id', missingImageMachineIds);
        (mRows || []).forEach((m: any) => machineById.set(m.id, m));
      }

      for (const offer of dbOffersById.values()) {
        const matchedApp = (apps || []).find((a: any) => a.offer_id === offer.id);
        const mInfo = offer.machine_id ? machineById.get(offer.machine_id) : undefined;
        const cachedM = offer.machine_id
          ? cachedMachines.find((m) => m.id === offer.machine_id)
          : undefined;
        const prev = dealsMap.get(offer.id);

        dealsMap.set(offer.id, {
          offer_id: offer.id,
          owner_id: offer.owner_id,
          owner_name: offer.owner_name || prev?.owner_name || 'مالك الآلية',
          owner_company: offer.owner_company || offer.owner_name || prev?.owner_company || 'مالك الآلية',
          owner_phone: offer.owner_phone || prev?.owner_phone || '',
          driver_id: driverId,
          driver_name:
            offer.won_driver_name || matchedApp?.driver_name || prev?.driver_name || 'سائق محترف',
          driver_phone:
            offer.won_driver_phone || matchedApp?.driver_phone || prev?.driver_phone || '',
          driver_city: matchedApp?.driver_city || offer.city || prev?.driver_city || 'المغرب',
          driver_experience:
            matchedApp?.driver_experience || offer.experience_required || prev?.driver_experience || '',
          machine_id: offer.machine_id || prev?.machine_id,
          machine_title:
            offer.machine_title ||
            mInfo?.title_ar ||
            cachedM?.title_ar ||
            prev?.machine_title ||
            offer.machine_label_ar,
          machine_image:
            offer.machine_image ||
            mInfo?.images?.[0] ||
            cachedM?.images?.[0] ||
            prev?.machine_image ||
            '',
          machine_category: offer.machine_category,
          machine_label_ar: offer.machine_label_ar,
          machine_label_fr: offer.machine_label_fr,
          offered_salary: Number(offer.offered_salary) || prev?.offered_salary || 0,
          salary_unit: offer.salary_unit || prev?.salary_unit || 'day',
          duration_label: offer.duration_label || prev?.duration_label || '',
          city: offer.city || 'المغرب (جميع المدن)',
          agreed_at: offer.agreed_at || matchedApp?.created_at || offer.created_at,
        });
      }
    } catch {
      // ignore Supabase errors & use local cache
    }
  }

  const localContractsMap = getLocalDriverContractsMap();
  const localTermsMap = getLocalWorkTerminationsMap();
  for (const [offerId, item] of dealsMap.entries()) {
    const localC = localContractsMap[`${offerId}::${driverId}`];
    if (localC) {
      item.contract = mergeDriverContracts(item.contract, localC);
    }
    const localT = localTermsMap[`${offerId}::${driverId}`];
    item.termination = mergeWorkTerminations(
      item.termination,
      mergeWorkTerminations(item.contract?.termination || null, localT || null)
    );
  }

  // Fallback cross-device contract & termination recovery from messages
  if (isSupabaseConfigured && !driverId.startsWith('driver-')) {
    try {
      const { data: cMsgs } = await supabase
        .from('messages')
        .select('body, content, created_at')
        .or('body.ilike.%#DRIVER_CONTRACT:%,body.ilike.%#DRIVER_WORK_END:%')
        .order('created_at', { ascending: true })
        .limit(80);
      if (Array.isArray(cMsgs)) {
        for (const msg of cMsgs) {
          const c = parseDriverContractMessageRow(msg);
          if (c?.offer_id && dealsMap.has(c.offer_id)) {
            const target = dealsMap.get(c.offer_id)!;
            target.contract = mergeDriverContracts(target.contract, {
              ...c,
              owner_agreed: true,
              driver_agreed: true,
            });
          }
          const wEnd = parseDriverWorkEndMessageRow(msg);
          if (wEnd?.offer_id && dealsMap.has(wEnd.offer_id)) {
            const target = dealsMap.get(wEnd.offer_id)!;
            target.termination = mergeWorkTerminations(target.termination, wEnd);
          }
        }
      }
    } catch {
      // ignore fallback query errors
    }
  }

  return Array.from(dealsMap.values())
    .map((item) => {
      const finalTerm = mergeWorkTerminations(
        item.termination,
        item.contract?.termination || null
      );
      const baseContract = item.contract || buildFallbackDriverContractFromDeal(item);
      return {
        ...item,
        termination: finalTerm,
        contract: {
          ...baseContract,
          termination: finalTerm,
        },
      };
    })
    .sort(
      (a, b) => new Date(b.agreed_at).getTime() - new Date(a.agreed_at).getTime()
    );
}

/**
 * Fetches all finalized/agreed driver deals for a specific OWNER
 * to populate the new "السائقون" (/owner/drivers) section with full deal details:
 * Machine, Driver, Duration, and Salary.
 */
export async function fetchOwnerAgreedDriverDeals(
  ownerId: string
): Promise<AgreedDriverDealItem[]> {
  if (!ownerId) return [];
  const dealsMap = new Map<string, AgreedDriverDealItem>();
  const cachedOffers = getLocalCachedOffers();
  const cachedMachines = machineStore.getCachedMachines();

  // 1. Seed from local cache
  const localDeals = getLocalDriverDealsMap();
  for (const deal of Object.values(localDeals)) {
    if (deal.owner_id !== ownerId || deal.deal_status !== 'accepted') continue;
    const matchedOffer = cachedOffers.find((o) => o.id === deal.offer_id);
    const matchedMachine = deal.machine_id
      ? cachedMachines.find((m) => m.id === deal.machine_id)
      : undefined;
    dealsMap.set(deal.offer_id, {
      offer_id: deal.offer_id,
      owner_id: ownerId,
      owner_name: matchedOffer?.owner_name || '',
      owner_company: matchedOffer?.owner_company || '',
      owner_phone: matchedOffer?.owner_phone || '',
      driver_id: deal.driver_id,
      driver_name: deal.won_driver_name || 'سائق معتمد',
      driver_phone: deal.won_driver_phone || '',
      driver_city: matchedOffer?.city || 'المغرب',
      driver_experience: matchedOffer?.experience_required || '',
      machine_id: deal.machine_id || matchedOffer?.machine_id,
      machine_title:
        deal.machine_title ||
        matchedOffer?.machine_title ||
        matchedMachine?.title_ar ||
        deal.machine_label_ar,
      machine_image:
        deal.machine_image || matchedOffer?.machine_image || matchedMachine?.images?.[0] || '',
      machine_category: deal.machine_category,
      machine_label_ar: deal.machine_label_ar,
      machine_label_fr: deal.machine_label_fr,
      offered_salary: Number(deal.offered_salary) || 0,
      salary_unit: deal.salary_unit || 'day',
      duration_label: deal.duration_label || matchedOffer?.duration_label || '',
      city: matchedOffer?.city || 'المغرب',
      agreed_at: deal.agreed_at || matchedOffer?.agreed_at || matchedOffer?.created_at || new Date().toISOString(),
    });
  }

  for (const o of cachedOffers) {
    if (o.owner_id === ownerId && o.status === 'accepted' && !dealsMap.has(o.id)) {
      const matchedMachine = o.machine_id ? cachedMachines.find((m) => m.id === o.machine_id) : undefined;
      dealsMap.set(o.id, {
        offer_id: o.id,
        owner_id: ownerId,
        owner_name: o.owner_name,
        owner_company: o.owner_company || o.owner_name,
        owner_phone: o.owner_phone || '',
        driver_id: o.won_driver_id || '',
        driver_name: o.won_driver_name || 'سائق معتمد',
        driver_phone: o.won_driver_phone || '',
        driver_city: o.city || 'المغرب',
        driver_experience: o.experience_required || '',
        machine_id: o.machine_id,
        machine_title: o.machine_title || matchedMachine?.title_ar || o.machine_label_ar,
        machine_image: o.machine_image || matchedMachine?.images?.[0] || '',
        machine_category: o.machine_category,
        machine_label_ar: o.machine_label_ar,
        machine_label_fr: o.machine_label_fr,
        offered_salary: Number(o.offered_salary) || 0,
        salary_unit: o.salary_unit,
        duration_label: o.duration_label || '',
        city: o.city || 'المغرب',
        agreed_at: o.agreed_at || o.created_at,
      });
    }
  }

  // 2. Query Supabase for owner's accepted offers + winning applications + driver profiles + machine photos
  if (isSupabaseConfigured) {
    try {
      const { data: offerRows } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(100);

      if (Array.isArray(offerRows) && offerRows.length > 0) {
        const offerIds = offerRows.map((r: any) => r.id).filter(Boolean);
        const { data: appRows } = await supabase
          .from('driver_job_applications')
          .select('*')
          .in('offer_id', offerIds);

        const driverIds = Array.from(
          new Set([
            ...offerRows.map((r: any) => r.won_driver_id).filter(Boolean),
            ...(appRows || []).filter((a: any) => a.status === 'accepted').map((a: any) => a.driver_id),
          ])
        );
        const profileMap = new Map<string, any>();
        if (driverIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, phone, phone_number, city, driver_experience_years')
            .in('id', driverIds);
          (profs || []).forEach((p: any) => profileMap.set(p.id, p));
        }

        const machineIds = Array.from(
          new Set(offerRows.map((r: any) => r.machine_id).filter(Boolean))
        );
        const machineMap = new Map<string, any>();
        if (machineIds.length > 0) {
          const { data: mRows } = await supabase
            .from('machines')
            .select('id, title_ar, title_fr, brand, model, images')
            .in('id', machineIds);
          (mRows || []).forEach((m: any) => machineMap.set(m.id, m));
        }

        for (const row of offerRows) {
          const offer = mapDbRowToDriverOffer(row);
          const appsForOffer = (appRows || []).filter((a: any) => a.offer_id === offer.id);
          const wonApp =
            appsForOffer.find((a: any) => a.status === 'accepted') || appsForOffer[0];
          const resolvedDriverId = offer.won_driver_id || wonApp?.driver_id || '';
          const prof = resolvedDriverId ? profileMap.get(resolvedDriverId) : undefined;
          const mInfo = offer.machine_id ? machineMap.get(offer.machine_id) : undefined;
          const cachedM = offer.machine_id
            ? cachedMachines.find((m) => m.id === offer.machine_id)
            : undefined;
          const prev = dealsMap.get(offer.id);

          dealsMap.set(offer.id, {
            offer_id: offer.id,
            owner_id: ownerId,
            owner_name: offer.owner_name,
            owner_company: offer.owner_company || offer.owner_name,
            owner_phone: offer.owner_phone || '',
            driver_id: resolvedDriverId || prev?.driver_id || '',
            driver_name:
              offer.won_driver_name ||
              wonApp?.driver_name ||
              prof?.full_name ||
              prev?.driver_name ||
              'سائق معتمد',
            driver_phone:
              offer.won_driver_phone ||
              wonApp?.driver_phone ||
              prof?.phone ||
              prof?.phone_number ||
              prev?.driver_phone ||
              '',
            driver_city:
              wonApp?.driver_city || prof?.city || prev?.driver_city || 'المغرب',
            driver_experience:
              wonApp?.driver_experience ||
              prof?.driver_experience_years ||
              offer.experience_required ||
              prev?.driver_experience ||
              '',
            machine_id: offer.machine_id || prev?.machine_id,
            machine_title:
              offer.machine_title ||
              mInfo?.title_ar ||
              cachedM?.title_ar ||
              prev?.machine_title ||
              offer.machine_label_ar,
            machine_image:
              offer.machine_image ||
              mInfo?.images?.[0] ||
              cachedM?.images?.[0] ||
              prev?.machine_image ||
              '',
            machine_category: offer.machine_category,
            machine_label_ar: offer.machine_label_ar,
            machine_label_fr: offer.machine_label_fr,
            offered_salary: Number(offer.offered_salary) || prev?.offered_salary || 0,
            salary_unit: offer.salary_unit,
            duration_label: offer.duration_label || prev?.duration_label || '',
            city: offer.city || 'المغرب',
            agreed_at: offer.agreed_at || wonApp?.created_at || offer.created_at,
            contract: mergeDriverContracts(offer.contract_data || null, prev?.contract || null),
          });
        }
      }
    } catch {
      // ignore & return local cache
    }
  }

  const localContractsMap = getLocalDriverContractsMap();
  const localTermsMap = getLocalWorkTerminationsMap();
  for (const item of dealsMap.values()) {
    const localC = localContractsMap[`${item.offer_id}::${item.driver_id}`];
    if (localC) {
      item.contract = mergeDriverContracts(item.contract, localC);
    }
    const localT = localTermsMap[`${item.offer_id}::${item.driver_id}`];
    item.termination = mergeWorkTerminations(
      item.termination,
      mergeWorkTerminations(item.contract?.termination || null, localT || null)
    );
  }

  if (isSupabaseConfigured) {
    try {
      const { data: cMsgs } = await supabase
        .from('messages')
        .select('body, content, created_at')
        .or('body.ilike.%#DRIVER_CONTRACT:%,body.ilike.%#DRIVER_WORK_END:%')
        .order('created_at', { ascending: true })
        .limit(80);
      if (Array.isArray(cMsgs)) {
        for (const msg of cMsgs) {
          const c = parseDriverContractMessageRow(msg);
          if (c?.offer_id && dealsMap.has(c.offer_id)) {
            const target = dealsMap.get(c.offer_id)!;
            target.contract = mergeDriverContracts(target.contract, {
              ...c,
              owner_agreed: true,
              driver_agreed: true,
            });
          }
          const wEnd = parseDriverWorkEndMessageRow(msg);
          if (wEnd?.offer_id && dealsMap.has(wEnd.offer_id)) {
            const target = dealsMap.get(wEnd.offer_id)!;
            target.termination = mergeWorkTerminations(target.termination, wEnd);
          }
        }
      }
    } catch {
      // ignore fallback query errors
    }
  }

  return Array.from(dealsMap.values())
    .map((item) => {
      const finalTerm = mergeWorkTerminations(
        item.termination,
        item.contract?.termination || null
      );
      const baseContract = item.contract || buildFallbackDriverContractFromDeal(item);
      return {
        ...item,
        termination: finalTerm,
        contract: {
          ...baseContract,
          termination: finalTerm,
        },
      };
    })
    .sort(
      (a, b) => new Date(b.agreed_at).getTime() - new Date(a.agreed_at).getTime()
    );
}


