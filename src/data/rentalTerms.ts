import { MachineUpsellOption, RentalTermType, VolumeDiscountTier } from '../types/database';

export interface RentalTermOption {
  type: RentalTermType;
  label_ar: string;
  label_fr: string;
  unit_ar: string;
  unit_fr: string;
}

export const RENTAL_TERMS: Record<RentalTermType, RentalTermOption> = {
  hourly: {
    type: 'hourly',
    label_ar: 'بالساعة',
    label_fr: 'Par heure',
    unit_ar: 'ساعة',
    unit_fr: 'heure',
  },
  daily: {
    type: 'daily',
    label_ar: 'باليوم',
    label_fr: 'Par jour',
    unit_ar: 'يوم',
    unit_fr: 'jour',
  },
  weekly: {
    type: 'weekly',
    label_ar: 'بالأسبوع',
    label_fr: 'Par semaine',
    unit_ar: 'أسبوع',
    unit_fr: 'semaine',
  },
  monthly: {
    type: 'monthly',
    label_ar: 'بالشهر',
    label_fr: 'Par mois',
    unit_ar: 'شهر',
    unit_fr: 'mois',
  },
  yearly: {
    type: 'yearly',
    label_ar: 'بالسنة',
    label_fr: 'Par an',
    unit_ar: 'سنة',
    unit_fr: 'an',
  },
};

export interface ServiceAddon {
  id: string;
  label_ar: string;
  label_fr: string;
  desc_ar: string;
  desc_fr: string;
  icon: string;
}

export const RENTAL_ADDONS: Record<string, ServiceAddon> = {
  operator: {
    id: 'operator',
    label_ar: 'مع سائق مؤهل',
    label_fr: 'Avec opérateur qualifié',
    desc_ar: 'سائق محترف ومؤمن يمتلك رخصة وتجربة ميدانية',
    desc_fr: 'Opérateur expérimenté avec permis de conduire engins et assurance',
    icon: 'UserCheck',
  },
  fuel: {
    id: 'fuel',
    label_ar: 'الوقود مشمول',
    label_fr: 'Carburant inclus',
    desc_ar: 'خزان وقود كامل ومصاريف الديزل مغطاة طيلة فترة العمل المحددة',
    desc_fr: 'Plein de carburant inclus pour les heures convenues',
    icon: 'Fuel',
  },
  delivery: {
    id: 'delivery',
    label_ar: 'التوصيل متوفر إلى الورش',
    label_fr: 'Livraison sur chantier disponible',
    desc_ar: 'نقل الآلية على شاحنة Porte-Char إلى موقع ورش البناء',
    desc_fr: 'Acheminement par porte-char directement sur le site du chantier',
    icon: 'Truck',
  },
};

export interface EffectiveTermRateResult {
  baseUnitRate: number;
  effectiveUnitRate: number;
  appliedTier: VolumeDiscountTier | null;
  savingsPerUnit: number;
  totalSavings: number;
  discountPercent: number;
  nextTier: VolumeDiscountTier | null;
  sortedTiersForTerm: VolumeDiscountTier[];
}

export const resolveEffectiveTermRate = (
  baseRate: number,
  term: RentalTermType,
  duration: number,
  tiers: VolumeDiscountTier[] = []
): EffectiveTermRateResult => {
  const safeBase = Math.max(0, Number(baseRate) || 0);
  const safeDuration = Math.max(1, Number(duration) || 1);

  const sortedTiersForTerm = (tiers || [])
    .filter(
      (t) =>
        t &&
        t.term === term &&
        Number(t.min_quantity) >= 2 &&
        Number(t.discounted_unit_price) > 0 &&
        (safeBase === 0 || Number(t.discounted_unit_price) < safeBase)
    )
    .map((t) => ({
      ...t,
      min_quantity: Math.max(2, Math.round(Number(t.min_quantity))),
      discounted_unit_price: Math.max(1, Number(t.discounted_unit_price)),
    }))
    .sort((a, b) => a.min_quantity - b.min_quantity);

  let appliedTier: VolumeDiscountTier | null = null;
  for (const tier of sortedTiersForTerm) {
    if (safeDuration >= tier.min_quantity) {
      appliedTier = tier;
    }
  }

  const nextTier = sortedTiersForTerm.find((t) => t.min_quantity > safeDuration) || null;
  const effectiveUnitRate = appliedTier ? appliedTier.discounted_unit_price : safeBase;
  const savingsPerUnit = Math.max(0, safeBase - effectiveUnitRate);
  const totalSavings = savingsPerUnit * safeDuration;
  const discountPercent =
    safeBase > 0 && savingsPerUnit > 0 ? Math.round((savingsPerUnit / safeBase) * 100) : 0;

  return {
    baseUnitRate: safeBase,
    effectiveUnitRate,
    appliedTier,
    savingsPerUnit,
    totalSavings,
    discountPercent,
    nextTier,
    sortedTiersForTerm,
  };
};

export const formatTermQuantityUnit = (
  term: RentalTermType,
  qty: number,
  lang: 'ar' | 'fr' = 'ar'
): string => {
  const n = Math.max(1, Number(qty) || 1);
  if (lang === 'fr') {
    switch (term) {
      case 'hourly':
        return n > 1 ? 'heures' : 'heure';
      case 'weekly':
        return n > 1 ? 'semaines' : 'semaine';
      case 'monthly':
        return 'mois';
      case 'yearly':
        return n > 1 ? 'ans' : 'an';
      default:
        return n > 1 ? 'jours' : 'jour';
    }
  }
  switch (term) {
    case 'hourly':
      return n >= 2 && n <= 10 ? 'ساعات' : 'ساعة';
    case 'weekly':
      return n >= 2 && n <= 10 ? 'أسابيع' : 'أسبوع';
    case 'monthly':
      return n >= 2 && n <= 10 ? 'أشهر' : 'شهر';
    case 'yearly':
      return n >= 2 && n <= 10 ? 'سنوات' : 'سنة';
    default:
      return n >= 2 && n <= 10 ? 'أيام' : 'يوم';
  }
};

export const getEquivalentDaysForTerm = (term: RentalTermType, duration: number): number => {
  const safeDuration = Math.max(1, Number(duration) || 1);
  switch (term) {
    case 'hourly':
      return Math.max(1, Math.ceil(safeDuration / 8));
    case 'daily':
      return safeDuration;
    case 'weekly':
      return safeDuration * 7;
    case 'monthly':
      return safeDuration * 30;
    case 'yearly':
      return safeDuration * 365;
    default:
      return safeDuration;
  }
};

export const calculateUpsellAmount = (
  upsell: MachineUpsellOption,
  term: RentalTermType,
  duration: number
): number => {
  const unitPrice = Math.max(0, Number(upsell.price) || 0);
  if (unitPrice <= 0) return 0;
  if (upsell.billing_type === 'one_time') return unitPrice;
  const days = getEquivalentDaysForTerm(term, duration);
  if (upsell.billing_type === 'per_month') {
    const months = Math.max(1, Math.ceil(days / 30));
    return unitPrice * months;
  }
  return unitPrice * days;
};

export const formatPriceMAD = (amount: number, lang: 'ar' | 'fr' = 'ar'): string => {
  // Use Latin digits (0-9) as specified in design system rules
  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(amount);

  return lang === 'ar' ? `${formattedNumber} د.م` : `${formattedNumber} MAD`;
};
