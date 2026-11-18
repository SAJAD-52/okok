import { EquipmentCategory } from '../types/database';
import { DRIVER_MACHINE_OPTIONS, inferDriverMachineCategory } from './driverMachines';

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  {
    id: 'excavator',
    slug: 'excavator',
    name_ar: 'حفارة (Pelle)',
    name_fr: 'Pelleteuse / Excavatrice',
    description_ar: 'حفارات هيدروليكية مجنزرة ومدولبة لجميع أعمال الحفر والأساسات والردم',
    description_fr: 'Pelleteuses hydrauliques sur chenilles ou pneus pour terrassement et tranchées',
    icon_name: 'Shovel',
    badge_count: 142,
  },
  {
    id: 'loader',
    slug: 'loader',
    name_ar: 'جرافة وشاحنة رافعة (JCB / Chargeuse)',
    name_fr: 'Tractopelle & Chargeuse (JCB)',
    description_ar: 'تراكتور بيل JCB ورافعات شوكية أمامية متعددة الاستخدامات مع بيل خلفي',
    description_fr: 'Tractopelles mixtes JCB 3CX/4CX et chargeuses sur pneus pour chantiers polyvalents',
    icon_name: 'Tractor',
    badge_count: 215,
  },
  {
    id: 'bulldozer',
    slug: 'bulldozer',
    name_ar: 'بلدوزر (Bulldozer)',
    name_fr: 'Bulldozer / Bouteur',
    description_ar: 'جرافات تسوية وتمهيد الأراضي والمسالك الوعرة وتجهيز المقالع',
    description_fr: 'Bouteurs puissants pour nivellement, décapage et pistes de carrières',
    icon_name: 'Hammer',
    badge_count: 64,
  },
  {
    id: 'crane',
    slug: 'crane',
    name_ar: 'رافعة (Grue)',
    name_fr: 'Grue Mobile & Grue à Tour',
    description_ar: 'رافعات متحركة على شاحنة ورافعات برجية للمشاريع الإنشائية الشاهقة',
    description_fr: 'Grues mobiles télescopiques et grues à tour pour chantiers de construction lourde',
    icon_name: 'Building2',
    badge_count: 53,
  },
  {
    id: 'truck',
    slug: 'truck',
    name_ar: 'شاحنة نقل وقلاب (Camion Benne)',
    name_fr: 'Camion Benne & Malaxeur',
    description_ar: 'شاحنات نقل الركام والرمال والأسفلت 6x4 و8x4 ونصف مقطورات',
    description_fr: 'Camions bennes 6x4, 8x4 et semi-remorques pour transport d\'agrégats et enrobés',
    icon_name: 'Truck',
    badge_count: 189,
  },
  {
    id: 'concrete-mixer',
    slug: 'concrete-mixer',
    name_ar: 'خلاطة إسمنت ومضخة (Malaxeur & Toupie)',
    name_fr: 'Toupie Béton & Pompe',
    description_ar: 'شاحنات خلط الخرسانة الجاهزة ومضخات ضخ الإسمنت للأدوار العليا',
    description_fr: 'Camions toupie et pompes à béton pour coulage rapide sur chantiers',
    icon_name: 'Boxes',
    badge_count: 48,
  },
  {
    id: 'compactor',
    slug: 'compactor',
    name_ar: 'مدحلة وضغاطة (Compacteur)',
    name_fr: 'Compacteur & Rouleau',
    description_ar: 'مداحل اهتزازية لدمج التربة والطبقات الإسفلتية للطرق والمطارات',
    description_fr: 'Rouleaux compacteurs tandem et monobille pour terrassement et voirie',
    icon_name: 'Layers',
    badge_count: 76,
  },
  {
    id: 'generator',
    slug: 'generator',
    name_ar: 'مولد كهربائي صناعي (Groupe Électrogène)',
    name_fr: 'Groupe Électrogène',
    description_ar: 'مولدات ديزل كاتمة للصوت من 20 إلى 1000 كيلو فولت أمبير لمواقع العمل',
    description_fr: 'Groupes électrogènes insonorisés de 20 kVA à 1000 kVA pour alimentation continue',
    icon_name: 'Zap',
    badge_count: 92,
  },
  {
    id: 'forklift',
    slug: 'forklift',
    name_ar: 'رافعة شوكية وتيليسكوبيك (Chariot & Télescopique)',
    name_fr: 'Chariot Élévateur & Télescopique',
    description_ar: 'شاريوهات رافعة للمستودعات ومعدات مناولة تلسكوبية مانسبو وجيه سي بي',
    description_fr: 'Chariots élévateurs tout-terrain et chariots télescopiques Manitou/JCB',
    icon_name: 'PackageCheck',
    badge_count: 110,
  },
  {
    id: 'scaffolding',
    slug: 'scaffolding',
    name_ar: 'سقالات وقوالب (Échafaudage & Coffrage)',
    name_fr: 'Échafaudage & Coffrage',
    description_ar: 'سقالات معدنية معتمدة، دعامات هيدروليكية، وقوالب خرسانية متينة',
    description_fr: 'Systèmes d\'échafaudages certifiés, étais de coffrage et banches métalliques',
    icon_name: 'Grid',
    badge_count: 85,
  },
  {
    id: 'spare-parts',
    slug: 'spare-parts',
    name_ar: 'قطع الغيار وملحقات (Pièces de Rechange)',
    name_fr: 'Pièces de Rechange & Filtres',
    description_ar: 'فلاتر، مضخات هيدروليكية، جنازير، أسنان جرافات ومحركات أصلية وجديدة',
    description_fr: 'Filtres, pompes hydrauliques, chenilles, dents de godet et composants moteurs',
    icon_name: 'Wrench',
    badge_count: 430,
  },
];

export const getCategoryById = (id: string): EquipmentCategory | undefined => {
  return EQUIPMENT_CATEGORIES.find(c => c.id === id || c.slug === id);
};

export const getCategoryName = (categoryId: string, lang: 'ar' | 'fr' = 'ar'): string => {
  const cat = getCategoryById(categoryId);
  if (cat) return lang === 'fr' ? cat.name_fr : cat.name_ar;
  const driverOpt = DRIVER_MACHINE_OPTIONS.find((opt) => opt.id === categoryId);
  if (driverOpt) return lang === 'fr' ? driverOpt.labelFr : driverOpt.labelAr;
  return categoryId;
};

const PARENT_TO_DRIVER_CATEGORIES: Record<string, string[]> = {
  excavator: ['excavator', 'pelle_chenilles', 'pelle_pneus', 'mini_pelle', 'brise_roche_carriere', 'foreuse'],
  loader: ['loader', 'tractopelle', 'chargeuse', 'bobcat', 'tracteur_agricole', 'moissonneuse'],
  bulldozer: ['bulldozer', 'niveleuse'],
  crane: ['crane', 'grue_mobile', 'grue_tour', 'camion_grue'],
  truck: ['truck', 'camion_benne', 'porte_char'],
  'concrete-mixer': ['concrete-mixer', 'camion_toupie', 'pompe_beton'],
  compactor: ['compactor', 'compacteur', 'finisseur', 'fraiseuse_route'],
  forklift: ['forklift', 'manitou', 'chariot_elevateur'],
  generator: ['generator'],
  scaffolding: ['scaffolding'],
  'spare-parts': ['spare-parts'],
};

export const matchesEquipmentCategoryFilter = (
  itemCategory: string | undefined,
  filterCategory: string
): boolean => {
  if (!filterCategory || filterCategory === 'all') return true;
  const normItem = String(itemCategory || '').toLowerCase();
  const normFilter = String(filterCategory || '').toLowerCase();
  if (normItem === normFilter) return true;
  const children = PARENT_TO_DRIVER_CATEGORIES[normFilter];
  return Boolean(children && children.includes(normItem));
};

export const normalizeOwnerCategoryId = (machine?: {
  category?: string;
  category_id?: string;
  title_ar?: string;
  title_fr?: string;
  brand?: string;
  model?: string;
} | null): string => {
  if (!machine) return 'tractopelle';
  const raw = String(machine.category_id || machine.category || '').toLowerCase();
  if (raw === 'generator' || raw === 'scaffolding' || raw === 'spare-parts') return raw;
  const exactDriver = DRIVER_MACHINE_OPTIONS.find((opt) => opt.id === raw);
  if (exactDriver) return exactDriver.id;
  return inferDriverMachineCategory(machine);
};

export interface MachineryCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameFr: string;
  name_ar: string;
  name_fr: string;
  descriptionAr: string;
  descriptionFr: string;
  iconName: string;
  icon_name: string;
  count: number;
  badge_count: number;
}

export const MACHINERY_CATEGORIES: MachineryCategory[] = EQUIPMENT_CATEGORIES.map((c) => ({
  ...c,
  nameAr: c.name_ar,
  nameFr: c.name_fr,
  descriptionAr: c.description_ar,
  descriptionFr: c.description_fr,
  iconName: c.icon_name,
  count: c.badge_count,
}));

