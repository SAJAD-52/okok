import { SupplierType } from '../types/database';

export interface SupplierTypeOption {
  id: SupplierType;
  labelAr: string;
  labelFr: string;
  shortAr: string;
  shortFr: string;
  descAr: string;
  descFr: string;
}

export const SUPPLIER_TYPES: SupplierTypeOption[] = [
  {
    id: 'all',
    labelAr: 'شامل: آليات + قطع غيار + استيراد',
    labelFr: 'Complet : Engins + Pièces + Import',
    shortAr: 'مورد ومستورد شامل',
    shortFr: 'Fournisseur & Importateur complet',
    descAr: 'بيع الآليات الثقيلة، قطع الغيار، وخدمات الاستيراد حسب الطلب',
    descFr: 'Vente d’engins, pièces de rechange et importation sur commande',
  },
  {
    id: 'spare_parts',
    labelAr: 'مورد ومحل قطع الغيار',
    labelFr: 'Fournisseur de Pièces de Rechange',
    shortAr: 'مورد قطع غيار',
    shortFr: 'Pièces de rechange',
    descAr: 'فلاتر، هيدروليك، محركات، جنازير، أسنان وزيوت للآليات',
    descFr: 'Filtres, hydraulique, moteurs, chenilles, dents et lubrifiants',
  },
  {
    id: 'machinery_dealer',
    labelAr: 'مورد وبائع الآليات الثقيلة (المغرب)',
    labelFr: 'Vendeur / Concessionnaire d’Engins (Maroc)',
    shortAr: 'بائع آليات بالمغرب',
    shortFr: 'Vendeur d’engins (Maroc)',
    descAr: 'بيع آليات جديدة ومستعملة متوفرة في المعرض أو الحظيرة بالمغرب',
    descFr: 'Vente d’engins neufs et d’occasion disponibles en stock au Maroc',
  },
  {
    id: 'importer',
    labelAr: 'شركة استيراد من الخارج (آليات وقطع غيار)',
    labelFr: 'Société d’Importation Internationale (Engins & Pièces)',
    shortAr: 'شركة استيراد من الخارج',
    shortFr: 'Importateur international',
    descAr: 'استيراد الآليات الثقيلة وقطع الغيار من أوروبا، الصين، تركيا والخليج مع الشحن والتخليص الجمركي',
    descFr: 'Importation d’engins et pièces depuis l’Europe, la Chine, la Turquie ou le Golfe avec fret & dédouanement',
  },
];

export interface ImportCountryOption {
  id: string;
  nameAr: string;
  nameFr: string;
  flag: string;
}

export const IMPORT_ORIGIN_COUNTRIES: ImportCountryOption[] = [
  { id: 'europe', nameAr: 'أوروبا (فرنسا، ألمانيا، إيطاليا، إسبانيا)', nameFr: 'Europe (FR, DE, IT, ES)', flag: '🇪🇺' },
  { id: 'china', nameAr: 'الصين (مصانع وموردو المعدات)', nameFr: 'Chine', flag: '🇨🇳' },
  { id: 'turkey', nameAr: 'تركيا', nameFr: 'Turquie', flag: '🇹🇷' },
  { id: 'uae', nameAr: 'الإمارات والخليج', nameFr: 'Émirats & Golfe', flag: '🇦🇪' },
  { id: 'uk', nameAr: 'المملكة المتحدة (JCB / UK)', nameFr: 'Royaume-Uni', flag: '🇬🇧' },
  { id: 'japan', nameAr: 'اليابان (Komatsu / Hitachi / Kubota)', nameFr: 'Japon', flag: '🇯🇵' },
  { id: 'usa', nameAr: 'أمريكا الشمالية (CAT)', nameFr: 'Amérique du Nord', flag: '🇺🇸' },
];

export const IMPORT_LEAD_TIMES = [
  { id: '7_15', labelAr: '7 إلى 15 يوما (جوي / سريع)', labelFr: '7 à 15 jours (Express / Aérien)' },
  { id: '15_30', labelAr: '15 إلى 30 يوما (شحن بحري)', labelFr: '15 à 30 jours (Maritime)' },
  { id: '30_45', labelAr: '30 إلى 45 يوما (استيراد وتعشير)', labelFr: '30 à 45 jours (Import & Dédouanement)' },
  { id: '45_60', labelAr: '45 إلى 60 يوما (تصنيع / طلب خاص)', labelFr: '45 à 60 jours (Commande spéciale)' },
];

export const IMPORT_DELIVERY_PORTS = [
  { id: 'tanger_med', labelAr: 'ميناء طنجة المتوسط (Tanger-Med)', labelFr: 'Port Tanger-Med' },
  { id: 'casablanca', labelAr: 'ميناء الدار البيضاء', labelFr: 'Port de Casablanca' },
  { id: 'agadir', labelAr: 'ميناء أكادير', labelFr: 'Port d’Agadir' },
  { id: 'nador', labelAr: 'ميناء الناظور', labelFr: 'Port de Nador' },
  { id: 'door_morocco', labelAr: 'تسليم مباشر لورش المالك بالمغرب (DDP)', labelFr: 'Livraison directe Maroc (DDP)' },
];

export const SUPPLIER_PART_CATEGORIES = [
  { value: 'all', ar: 'جميع أصناف قطع الغيار', fr: 'Toutes catégories de pièces' },
  { value: 'filters', ar: 'فلاتر وزيوت وتشحيم', fr: 'Filtres & Lubrifiants' },
  { value: 'hydraulic', ar: 'هيدروليك، مضخات وخراطيم', fr: 'Hydraulique (Pompes, Vérins, Flexibles)' },
  { value: 'engine', ar: 'محركات وناقل الحركة', fr: 'Moteurs & Boîtes de vitesse' },
  { value: 'teeth', ar: 'أسنان وشفرات كباش', fr: 'Dents, Lames de godet' },
  { value: 'tracks', ar: 'جنازير وعجلات', fr: 'Chenilles & Galets' },
  { value: 'electric', ar: 'كهرباء وبطاريات', fr: 'Électricité & Batteries' },
  { value: 'attachments', ar: 'كواسر ومرفقات هيدروليكية', fr: 'Brise-roche (BRH) & Équipements' },
  { value: 'other', ar: 'مستلزمات أخرى', fr: 'Autres composants' },
];

export function getSupplierTypeOption(id?: string): SupplierTypeOption {
  return SUPPLIER_TYPES.find((s) => s.id === id) || SUPPLIER_TYPES[0];
}

export function getImportCountryLabel(id: string, lang: 'ar' | 'fr' = 'ar'): string {
  const found = IMPORT_ORIGIN_COUNTRIES.find((c) => c.id === id);
  if (!found) return id;
  return `${found.flag} ${lang === 'fr' ? found.nameFr : found.nameAr}`;
}
