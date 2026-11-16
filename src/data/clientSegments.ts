// ============================================================================
// JADIJCB: Client Categories / Segments (مقاولة، فلاح، مهني، فرد، تعاونية...)
// Inclusive segmentation for every renter/buyer in Morocco
// ============================================================================

import { ClientSegment } from '../types/database';

export interface ClientSegmentOption {
  id: ClientSegment;
  labelAr: string;
  labelFr: string;
  shortDescAr: string;
  shortDescFr: string;
  requiresCompanyDetails: boolean;
}

export const CLIENT_SEGMENTS: ClientSegmentOption[] = [
  {
    id: 'company',
    labelAr: 'مقاولة / شركة',
    labelFr: 'Entreprise / Société',
    shortDescAr: 'بناء، أشغال عمومية أو خدمات',
    shortDescFr: 'BTP, travaux publics ou services',
    requiresCompanyDetails: true,
  },
  {
    id: 'farmer',
    labelAr: 'فلاح / ضيعة فلاحية',
    labelFr: 'Agriculteur / Ferme',
    shortDescAr: 'استصلاح أرض، تسوية أو سقي',
    shortDescFr: 'Aménagement agricole ou terrain',
    requiresCompanyDetails: false,
  },
  {
    id: 'artisan',
    labelAr: 'مهني / حرفي',
    labelFr: 'Professionnel / Artisan',
    shortDescAr: 'معلم، مقاول ذاتي أو طوبوغراف',
    shortDescFr: 'Auto-entrepreneur ou maître d\'œuvre',
    requiresCompanyDetails: false,
  },
  {
    id: 'individual',
    labelAr: 'فرد (استعمال خاص)',
    labelFr: 'Particulier',
    shortDescAr: 'حفر بقعة أرضية أو بناء منزل',
    shortDescFr: 'Terrain privé, fondations ou maison',
    requiresCompanyDetails: false,
  },
  {
    id: 'cooperative',
    labelAr: 'تعاونية / جمعية',
    labelFr: 'Coopérative / Association',
    shortDescAr: 'مشاريع قروية أو فلاحية جماعية',
    shortDescFr: 'Projets collectifs ou ruraux',
    requiresCompanyDetails: false,
  },
  {
    id: 'developer',
    labelAr: 'منعش عقاري / مستثمر',
    labelFr: 'Promoteur / Investisseur',
    shortDescAr: 'تجزئة أرضية أو مشروع عقاري',
    shortDescFr: 'Lotissement ou projet immobilier',
    requiresCompanyDetails: false,
  },
  {
    id: 'other',
    labelAr: 'آخر',
    labelFr: 'Autre',
    shortDescAr: 'نشاط أو حاجة ميدانية أخرى',
    shortDescFr: 'Autre besoin ou activité',
    requiresCompanyDetails: false,
  },
];

export function getClientSegmentOption(segment?: ClientSegment | string | null): ClientSegmentOption {
  return CLIENT_SEGMENTS.find((s) => s.id === segment) || CLIENT_SEGMENTS[0];
}
