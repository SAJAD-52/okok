// ============================================================================
// JADIJCB: Driver Job Offers & Applications Service (/driver & /driver/joboffer)
// Bridges Supabase driver_job_offers (live owner dispatch campaigns) with
// instant BroadcastChannel / local persistence for immediate multi-tab updates.
// ============================================================================

import { DriverJobOffer } from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';
import { showBrowserOpportunityNotification, playOpportunitySound } from './opportunityAudio';

const LOCAL_DRIVER_OFFERS_KEY = 'jadijcb_driver_job_offers_cache';
const LOCAL_APPLIED_MAP_KEY = 'jadijcb_driver_applied_offers_v1';
const DRIVER_DISPATCH_CHANNEL = 'jadijcb_driver_dispatch';

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
    localStorage.setItem(LOCAL_DRIVER_OFFERS_KEY, JSON.stringify(offers.slice(0, 60)));
  } catch {
    // ignore
  }
}

export async function fetchDriverJobOffers(driverId?: string): Promise<DriverJobOffer[]> {
  const appliedMap = getAppliedMap(driverId);
  let dbOffers: DriverJobOffer[] = [];
  const dbAppliedIds = new Set<string>(Object.keys(appliedMap));

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_job_offers')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        dbOffers = data.map((row: any) => ({
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
          city: row.city || 'الدار البيضاء',
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
        }));
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

  const localOffers = getLocalCachedOffers();
  const mergedMap = new Map<string, DriverJobOffer>();

  for (const offer of [...dbOffers, ...localOffers, ...STARTER_DRIVER_OFFERS]) {
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
        await supabase.from('notifications').insert({
          user_id: offer.owner_id,
          title_ar: `سائق مهتم بعرض ${offer.machine_label_ar} 👷`,
          title_fr: `Conducteur intéressé · ${offer.machine_label_fr || offer.machine_label_ar} 👷`,
          body_ar: `${driverName} (${driverCity}) قدّم طلباً لقيادة الآلية في عرضك.`,
          body_fr: `${driverName} (${driverCity}) a postulé à votre offre de conducteur.`,
          type: 'driver_application',
          data: {
            offer_id: offer.id,
            driver_id: driverId,
            driver_phone: driverPhone,
          },
        });
      }
    } catch {
      // ignore if migration not yet applied
    }
  }

  window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated'));
  return { success: true };
}

/**
 * Foundation helper for upcoming urgent owner-launched driver hiring campaigns.
 * Stores offer, broadcasts via BroadcastChannel, and alerts matching drivers.
 */
export async function broadcastUrgentDriverOffer(offerInput: Omit<DriverJobOffer, 'id' | 'created_at' | 'status'>): Promise<DriverJobOffer> {
  const newOffer: DriverJobOffer = {
    ...offerInput,
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `drv_offer_${Date.now()}`,
    status: 'open',
    is_demo: false,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('driver_job_offers')
        .insert({
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

      if (data?.id) {
        newOffer.id = data.id;
        newOffer.created_at = data.created_at || newOffer.created_at;
      }
    } catch {
      // Fallback to local cache when table is not yet created
    }
  }

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

  window.dispatchEvent(new CustomEvent('jadijcb_driver_offers_updated', { detail: newOffer }));
  return newOffer;
}

export function subscribeDriverJobOffers(
  driverMachines: string[],
  onOffersChanged: (urgentOffer?: DriverJobOffer) => void
): () => void {
  const handleNewOfferNotification = (offer: DriverJobOffer) => {
    const matchesDriver =
      driverMachines.length === 0 || driverMachines.includes(offer.machine_category);
    if (matchesDriver && offer.is_urgent) {
      playOpportunitySound();
      showBrowserOpportunityNotification({
        title: `عرض عمل عاجل لسائق: ${offer.machine_label_ar} 👷`,
        body: `${offer.offered_salary.toLocaleString('fr-FR')} درهم/${
          offer.salary_unit === 'month' ? 'شهر' : 'يوم'
        } · ${offer.city} — ${offer.owner_company || offer.owner_name}`,
        tag: `driver-offer-${offer.id}`,
        url: '/driver/joboffer',
      }).catch(() => {});
    }
    onOffersChanged(offer);
  };

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
          handleNewOfferNotification(offer);
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
        .channel('driver_job_offers_live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'driver_job_offers' },
          (payload: any) => {
            const row = payload?.new;
            if (!row?.id || row.status !== 'open') return;
            const mapped: DriverJobOffer = {
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
              city: row.city || '',
              work_location_note: row.work_location_note || '',
              duration_label: row.duration_label || '',
              is_urgent: Boolean(row.is_urgent),
              accommodation_included: Boolean(row.accommodation_included),
              meals_included: Boolean(row.meals_included),
              experience_required: row.experience_required || '',
              description_ar: row.description_ar || '',
              description_fr: row.description_fr || '',
              status: row.status || 'open',
              created_at: row.created_at,
            };
            handleNewOfferNotification(mapped);
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
