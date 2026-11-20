import { SupplierScope, SupplierType } from '../types/database';

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
    id: 'spare_parts',
    labelAr: 'مورد قطع غيار',
    labelFr: 'Fournisseur de pièces de rechange',
    shortAr: 'مورد قطع غيار',
    shortFr: 'Pièces de rechange',
    descAr: 'فلاتر، هيدروليك، محركات، جنازير، أسنان وزيوت للآليات',
    descFr: 'Filtres, hydraulique, moteurs, chenilles et pièces détachées',
  },
  {
    id: 'machinery_dealer',
    labelAr: 'مورد آليات',
    labelFr: 'Fournisseur d’engins',
    shortAr: 'مورد آليات',
    shortFr: 'Fournisseur d’engins',
    descAr: 'بيع الآليات الثقيلة ومعدات البناء والأشغال العمومية',
    descFr: 'Vente d’engins lourds et matériels BTP / agricoles',
  },
  {
    id: 'all',
    labelAr: 'مورد قطع غيار وآليات',
    labelFr: 'Fournisseur d’engins et pièces',
    shortAr: 'مورد قطع غيار وآليات',
    shortFr: 'Engins & pièces de rechange',
    descAr: 'توفير الآليات الثقيلة وقطع الغيار معاً لأساطيل الملاك',
    descFr: 'Vente d’engins lourds et pièces de rechange',
  },
];

export interface SupplierScopeOption {
  id: SupplierScope;
  labelAr: string;
  labelFr: string;
  descAr: string;
  descFr: string;
}

export const SUPPLIER_SUPPLY_SCOPES: SupplierScopeOption[] = [
  {
    id: 'local',
    labelAr: 'مورد محلي',
    labelFr: 'Fournisseur local (Maroc)',
    descAr: 'توفير الآليات أو قطع الغيار المتوفرة داخل المغرب',
    descFr: 'Stock et disponibilité au Maroc',
  },
  {
    id: 'local_and_import',
    labelAr: 'محلي مع إمكانية الاستيراد والتخليص الجمركي',
    labelFr: 'Local avec importation & dédouanement',
    descAr: 'توريد محلي بالإضافة إلى الاستيراد من الخارج والتعشير الجمركي',
    descFr: 'Stock local + importation internationale et dédouanement',
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
  { id: '7_15', labelAr: '7 إلى 15 يوماً (جوي / سريع)', labelFr: '7 à 15 jours (Express / Aérien)' },
  { id: '15_30', labelAr: '15 إلى 30 يوماً (شحن بحري)', labelFr: '15 à 30 jours (Maritime)' },
  { id: '30_45', labelAr: '30 إلى 45 يوماً (استيراد وتخليص جمركي)', labelFr: '30 à 45 jours (Import & Dédouanement)' },
  { id: '45_60', labelAr: '45 إلى 60 يوماً (تصنيع / طلب خاص)', labelFr: '45 à 60 jours (Commande spéciale)' },
];

export const IMPORT_SHIPPING_METHODS = [
  { id: 'sea_container', labelAr: 'شحن بحري (حاوية / سفينة Ro-Ro)', labelFr: 'Fret maritime (Conteneur / Ro-Ro)' },
  { id: 'air_express', labelAr: 'شحن جوي سريع (لقطع الغيار المستعجلة)', labelFr: 'Fret aérien express' },
  { id: 'land_intl', labelAr: 'نقل بري دولي (شاحنات من أوروبا)', labelFr: 'Transport routier international' },
  { id: 'ddp_customs', labelAr: 'شحن واستيراد شامل مع التخليص الجمركي', labelFr: 'Importation clé en main + dédouanement' },
];

export const IMPORT_DELIVERY_PORTS = [
  { id: 'tanger_med', labelAr: 'ميناء طنجة المتوسط (Tanger-Med)', labelFr: 'Port Tanger-Med' },
  { id: 'casablanca', labelAr: 'ميناء الدار البيضاء', labelFr: 'Port de Casablanca' },
  { id: 'agadir', labelAr: 'ميناء أكادير', labelFr: 'Port d’Agadir' },
  { id: 'nador', labelAr: 'ميناء الناظور', labelFr: 'Port de Nador' },
  { id: 'airport_cmn', labelAr: 'مطار محمد الخامس للشحن الجوي', labelFr: 'Aéroport Mohammed V (Fret aérien)' },
  { id: 'door_morocco', labelAr: 'تسليم بعد التعشير (يتم الاتفاق بالمحادثة)', labelFr: 'Remise après dédouanement (à convenir)' },
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
  if (id === 'importer') return SUPPLIER_TYPES[2]; // backwards compatibility -> مورد قطع غيار وآليات
  return SUPPLIER_TYPES.find((s) => s.id === id) || SUPPLIER_TYPES[2];
}

export function getSupplierScopeOption(id?: string): SupplierScopeOption {
  return SUPPLIER_SUPPLY_SCOPES.find((s) => s.id === id) || SUPPLIER_SUPPLY_SCOPES[0];
}

export function resolveSupplierScopeFromProfile(profile?: {
  supplier_scope?: SupplierScope;
  supplier_type?: SupplierType | string;
  import_countries?: string[];
  import_lead_time?: string;
} | null): SupplierScope {
  if (!profile) return 'local';
  if (profile.supplier_scope === 'local' || profile.supplier_scope === 'local_and_import') {
    return profile.supplier_scope;
  }
  if (
    profile.supplier_type === 'importer' ||
    (Array.isArray(profile.import_countries) && profile.import_countries.length > 0) ||
    Boolean(profile.import_lead_time)
  ) {
    return 'local_and_import';
  }
  return 'local';
}

export function getImportCountryLabel(id: string, lang: 'ar' | 'fr' = 'ar'): string {
  const found = IMPORT_ORIGIN_COUNTRIES.find((c) => c.id === id);
  if (!found) return id;
  return `${found.flag} ${lang === 'fr' ? found.nameFr : found.nameAr}`;
}

export function getImportLeadTimeLabel(id: string, lang: 'ar' | 'fr' = 'ar'): string {
  const found = IMPORT_LEAD_TIMES.find((l) => l.id === id);
  if (!found) return id;
  return lang === 'fr' ? found.labelFr : found.labelAr;
}

export function getImportShippingMethodLabel(id: string, lang: 'ar' | 'fr' = 'ar'): string {
  const found = IMPORT_SHIPPING_METHODS.find((m) => m.id === id);
  if (!found) return id;
  return lang === 'fr' ? found.labelFr : found.labelAr;
}

export function getImportPortLabel(id: string, lang: 'ar' | 'fr' = 'ar'): string {
  const found = IMPORT_DELIVERY_PORTS.find((p) => p.id === id);
  if (!found) return id;
  return lang === 'fr' ? found.labelFr : found.labelAr;
}

