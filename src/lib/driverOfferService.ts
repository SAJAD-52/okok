// ============================================================================
// JADIJCB: Driver Job Offers, Owner Driver Search Campaigns & Applications
// Bridges Supabase driver_job_offers, notifications, Web Push VAPID, Express SSE,
// and BroadcastChannel so drivers receive live audio + mobile shade alerts
// even when outside the app or when the app is closed.
// ============================================================================

import { DriverDealContext, DriverJobOffer } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';
import { serverApi } from './serverApi';
import { sendWebPushToUsers } from './pushService';
import { getDriverMachineOption } from '../data/driverMachines';
import { chatStore } from './chatStore';

const LOCAL_DRIVER_OFFERS_KEY = 'jadijcb_driver_job_offers_cache';
const LOCAL_APPLIED_MAP_KEY = 'jadijcb_driver_applied_offers_v1';
const LOCAL_DRIVER_DEALS_KEY = 'jadijcb_driver_deals_cache_v1';
const DRIVER_DISPATCH_CHANNEL = 'jadijcb_driver_dispatch';

export const DRIVER_OFFER_MARKER = '\n#DRIVER_OFFER:';
export const DRIVER_DEAL_MARKER = '\n#DRIVER_DEAL:';

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

// Starter reference job offers so newly registered drivers immediately see the structured offer format
// alongside any live owner-launched urgent campaigns from Supabase.
const STARTER_DRIVER_OFFERS: DriverJobOffer[] = [
  {
    id: 'starter-offer-tractopelle-casa',
    owner_id: 'starter-owner-1',
    owner_name: 'شركة أطلس للأشغال العمومية',
    owner_company: 'Atlas Travaux & VRD',
    owner_phone: '+212661204080',
    machine_category: 'tractopelle',
    machine_label_ar: 'تراكتور بيل / كاسكاطور (JCB 3CX)',
    machine_label_fr: 'Tractopelle JCB 3CX',
    offered_salary: 350,
    salary_unit: 'day',
    city: 'الدار البيضاء',
    work_location_note: 'ورش التهيئة الطرقية · النواصر / بوسكورة',
    duration_label: 'شهرين قابل للتمديد',
    is_urgent: true,
    accommodation_included: true,
    meals_included: false,
    experience_required: '3_5',
    description_ar:
      'مطلوب سائق محترف متمرس في الحفر الدقيق وشبكات الماء والتطهير السائل على JCB 3CX. السكن متوفر قرب الورش والدفع أسبوعياً.',
    description_fr:
      'Conducteur expérimenté recherché pour tranchées et VRD sur JCB 3CX à Nouaceur. Logement assuré, paiement hebdomadaire.',
    status: 'open',
    is_demo: true,
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'starter-offer-pelle-tanger',
    owner_id: 'starter-owner-2',
    owner_name: 'مقاولة البوغاز للهندسة المدنية',
    owner_company: 'Boughaz Génie Civil',
    owner_phone: '+212662309010',
    machine_category: 'pelle_chenilles',
    machine_label_ar: 'حفارة مجنزرة (بوكلان 22 طن CAT 320)',
    machine_label_fr: 'Pelle sur chenilles 22T (CAT 320)',
    offered_salary: 8500,
    salary_unit: 'month',
    city: 'طنجة',
    work_location_note: 'المنطقة الصناعية طنجة أوتوموتيف سيتي',
    duration_label: 'عقد 6 أشهر (عمل مستمر)',
    is_urgent: true,
    accommodation_included: true,
    meals_included: true,
    experience_required: '6_10',
    description_ar:
      'عمل مستمر بورش تهيئة منطقة صناعية. أجر شهري مضمون + السكن والتغذية موفرة على حساب المقاولة.',
    description_fr:
      'Chantier terrassement industriel longue durée. Salaire mensuel fixe + logement et repas pris en charge.',
    status: 'open',
    is_demo: true,
    created_at: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
  {
    id: 'starter-offer-niveleuse-marrakech',
    owner_id: 'starter-owner-3',
    owner_name: 'مجموعة النخيل للطرق',
    owner_company: 'Palmeraie Routes SARL',
    owner_phone: '+212668112233',
    machine_category: 'niveleuse',
    machine_label_ar: 'نيفيلوز / ممهدة الطرق (Motor Grader)',
    machine_label_fr: 'Niveleuse (Grader CAT 140)',
    offered_salary: 500,
    salary_unit: 'day',
    city: 'مراكش',
    work_location_note: 'محور طريق تامنصورت · أشغال التسوية',
    duration_label: '45 يوماً',
    is_urgent: false,
    accommodation_included: true,
    meals_included: true,
    experience_required: '6_10',
    description_ar:
      'مطلوب سائق نيفيلوز محترف لضبط الميول والمستويات (Reglage fin) قبل وضع طبقة الزفت.',
    description_fr:
      'Chauffeur niveleuse confirmé exigé pour réglage de précision avant enrobé.',
    status: 'open',
    is_demo: true,
    created_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
  },
  {
    id: 'starter-offer-chargeuse-agadir',
    owner_id: 'starter-owner-4',
    owner_name: 'تعاونية ومقالع سوس',
    owner_company: 'Souss Agrégats',
    owner_phone: '+212664556677',
    machine_category: 'chargeuse',
    machine_label_ar: 'شارجور / جرافة على عجلات (Volvo L120)',
    machine_label_fr: 'Chargeuse sur pneus (Volvo L120)',
    offered_salary: 7000,
    salary_unit: 'month',
    city: 'أكادير',
    work_location_note: 'مقلع وتهيئة ضيعات فلاحية · أيت ملول',
    duration_label: '3 أشهر قابلة للتجديد',
    is_urgent: false,
    accommodation_included: false,
    meals_included: true,
    experience_required: '3_5',
    description_ar:
      'شحن الشاحنات وتسوية الأراضي الفلاحية بمنطقة سوس. توقيت نهاري منتظم.',
    description_fr:
      'Chargement camions et nivellement agricole en zone Souss. Horaires réguliers de jour.',
    status: 'open',
    is_demo: true,
    created_at: new Date(Date.now() - 1000 * 60 * 520).toISOString(),
  },
];

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

function getLocalCachedOffers(): DriverJobOffer[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_OFFERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCachedOffers(offers: DriverJobOffer[]) {
  try {
    localStorage.setItem(LOCAL_DRIVER_OFFERS_KEY, JSON.stringify(offers.slice(0, 80)));
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

  const newOffer: DriverJobOffer = {
    id: offerId,
    campaign_id: campaignId,
    owner_id: params.ownerId,
    owner_name: params.ownerName,
    owner_company: params.ownerCompany || params.ownerName,
    owner_phone: params.ownerPhone || '',
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
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .insert({
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
        })
        .select()
        .maybeSingle();

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
    url: '/driver/joboffer',
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
      url: '/driver/joboffer',
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

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        dbOffers = data
          .map(mapDbRowToDriverOffer)
          .filter((o) => o.status === 'open' && !localClosedIds.has(o.id));
      }

      if (driverId) {
        const { data: apps } = await supabase
          .from('driver_job_applications')
          .select('offer_id')
          .eq('driver_id', driverId);
        if (Array.isArray(apps)) {
          apps.forEach((a: any) => {
            if (a?.offer_id) dbAppliedIds.add(a.offer_id);
          });
        }
      }
    } catch {
      // ignore if table not migrated yet
    }
  }

  const localOffers = allLocalOffers.filter(
    (o) => o.status === 'open' && !localClosedIds.has(o.id)
  );
  const mergedMap = new Map<string, DriverJobOffer>();

  for (const offer of [...dbOffers, ...localOffers, ...STARTER_DRIVER_OFFERS]) {
    if (localClosedIds.has(offer.id)) continue;
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
    machine_category: offer.machine_category,
    machine_label_ar: offer.machine_label_ar,
    machine_label_fr: offer.machine_label_fr,
    offered_salary: offer.offered_salary,
    salary_unit: offer.salary_unit,
    duration_label: offer.duration_label || '',
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
} | null {
  const body = msg?.body || msg?.content || msg?.message || msg?.text || '';
  const data = parseJsonMarkerFromBody(body, DRIVER_DEAL_MARKER);
  if (!data?.offer_id) return null;
  return data as any;
}

export async function markOfferAcceptedAndClosed(params: {
  offerId: string;
  driverId: string;
  driverName?: string;
}): Promise<void> {
  const { offerId, driverId, driverName } = params;

  if (isSupabaseConfigured && offerId && !offerId.startsWith('starter-')) {
    try {
      await supabase.rpc('finalize_driver_job_deal', {
        p_offer_id: offerId,
        p_driver_id: driverId,
        p_driver_name: driverName || '',
      });
    } catch {
      // ignore if 20261116020000 migration has not been executed yet
    }

    try {
      await supabase
        .from('driver_job_offers')
        .update({ status: 'accepted' })
        .eq('id', offerId);
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
    existing.map((o) => (o.id === offerId ? { ...o, status: 'accepted' } : o))
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

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const offerPayload = parseDriverOfferMessageRow(msg);
      if (offerPayload?.offer_id) {
        if (!offerIdHint || offerPayload.offer_id === offerIdHint) {
          markerOfferMeta = offerPayload;
        }
      }
      const dealPayload = parseDriverDealMessageRow(msg);
      if (dealPayload?.offer_id) {
        const targetId: string = offerIdHint || markerOfferMeta?.offer_id || dealPayload.offer_id;
        if (dealPayload.offer_id === targetId) {
          if (!markerOfferMeta) {
            markerOfferMeta = { offer_id: dealPayload.offer_id };
          }
          if (dealPayload.owner_accepted) markerOwnerAccepted = true;
          if (dealPayload.driver_accepted) markerDriverAccepted = true;
          if (dealPayload.status) markerStatus = dealPayload.status;
          if (dealPayload.won_driver_name) markerDriverName = dealPayload.won_driver_name;
        }
      }
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
        // Auto-discover offer between this owner & driver
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
            const matchedOffer = ownerOffers.find((o: any) => o.id === driverApps[0].offer_id);
            if (matchedOffer) {
              dbOffer = mapDbRowToDriverOffer(matchedOffer);
              appRow = driverApps[0];
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

  return {
    offer_id: resolvedOfferId,
    owner_id: ownerId,
    driver_id: driverId,
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
      dbOffer?.offered_salary ?? markerOfferMeta?.offered_salary ?? localDeal?.offered_salary ?? 0
    ),
    salary_unit:
      dbOffer?.salary_unit || markerOfferMeta?.salary_unit || localDeal?.salary_unit || 'day',
    duration_label:
      dbOffer?.duration_label || markerOfferMeta?.duration_label || localDeal?.duration_label || '',
    owner_accepted: dealStatus === 'accepted' ? true : ownerAccepted,
    driver_accepted: dealStatus === 'accepted' ? true : driverAccepted,
    deal_status: dealStatus,
    won_driver_name: markerDriverName || appRow?.driver_name || localDeal?.won_driver_name,
  };
}

export async function acceptAndCloseDriverDealParty(params: {
  deal: DriverDealContext;
  partyRole: 'owner' | 'driver';
  currentUserId: string;
  currentUserName?: string;
  conversationId: string;
}): Promise<{ updatedDeal: DriverDealContext; finalized: boolean }> {
  const { deal, partyRole, currentUserId, currentUserName, conversationId } = params;

  const nextOwnerAccepted = partyRole === 'owner' ? true : deal.owner_accepted;
  const nextDriverAccepted = partyRole === 'driver' ? true : deal.driver_accepted;
  const finalized = nextOwnerAccepted && nextDriverAccepted;

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
  };

  const humanText = finalized
    ? `🤝 تم إغلاق الصفقة بنجاح! اتفق الطرفان على شروط العمل وتم إغلاق العرض (${updatedDeal.machine_label_ar}).`
    : partyRole === 'owner'
    ? `🤝 أكد المالك اتفاق شروط العمل وإغلاق الصفقة — في انتظار تأكيد السائق لإغلاق العرض نهائياً.`
    : `🤝 أكد السائق اتفاق شروط العمل وإغلاق الصفقة — في انتظار تأكيد المالك لإغلاق العرض نهائياً.`;

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
    });

    if (isSupabaseConfigured && recipientId && !recipientId.startsWith('starter-')) {
      const titleAr = `تم إغلاق صفقة العمل: ${updatedDeal.machine_label_ar} 🤝`;
      const titleFr = `Accord conducteur conclu : ${updatedDeal.machine_label_fr} 🤝`;
      const bodyAr = 'اتفق الطرفان على شروط العمل وتم إغلاق عرض العمل بنجاح.';
      const bodyFr = 'Les deux parties ont confirmé les conditions de travail. L’offre est clôturée.';

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
        url: recipientRole === 'driver' ? '/driver/messages' : '/owner/machines',
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

  const deal: DriverDealContext = {
    offer_id: offer.id,
    owner_id: ownerId,
    driver_id: driverId,
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
  };

  saveLocalDriverDeal(deal);

  await markOfferAcceptedAndClosed({
    offerId: offer.id,
    driverId,
    driverName,
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
    };
    await chatStore.sendMessage(
      conv.id,
      ownerId,
      `🤝 تم إغلاق الصفقة مع السائق (${driverName}) على شروط العمل وتم إغلاق العرض (${offer.machine_label_ar}).${DRIVER_DEAL_MARKER}${JSON.stringify(markerPayload)}`,
      driverId,
      { senderName: ownerName, recipientRole: 'driver' }
    );
  } catch {
    // ignore chat error
  }

  if (isSupabaseConfigured && driverId && !driverId.startsWith('starter-')) {
    const titleAr = `تم إغلاق صفقة العمل معك: ${offer.machine_label_ar} 🤝`;
    const titleFr = `Offre conclue avec vous : ${offer.machine_label_fr} 🤝`;
    const bodyAr = `أكد ${ownerName || offer.owner_name} الاتفاق على العمل وأغلق العرض باسمك.`;
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
      url: '/driver/messages',
    }).catch(() => {});
  }

  return deal;
}

