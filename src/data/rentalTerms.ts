import { RentalTermType } from '../types/database';

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

export const formatPriceMAD = (amount: number, lang: 'ar' | 'fr' = 'ar'): string => {
  // Use Latin digits (0-9) as specified in design system rules
  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(amount);

  return lang === 'ar' ? `${formattedNumber} د.م` : `${formattedNumber} MAD`;
};
