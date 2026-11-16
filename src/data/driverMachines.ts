// ============================================================================
// JADIJCB: Complete Catalog of Machinery Operated by Drivers in Morocco
// & Experience Levels for Operator Registration & Dispatch Matching
// ============================================================================

export type DriverMachineGroup =
  | 'earthmoving'
  | 'roadwork'
  | 'lifting'
  | 'transport_concrete'
  | 'drilling_agri';

export interface DriverMachineOption {
  id: string;
  group: DriverMachineGroup;
  labelAr: string;
  labelFr: string;
  commonTagAr?: string;
  commonTagFr?: string;
}

export interface DriverMachineGroupMeta {
  id: DriverMachineGroup;
  labelAr: string;
  labelFr: string;
}

export const DRIVER_MACHINE_GROUPS: DriverMachineGroupMeta[] = [
  {
    id: 'earthmoving',
    labelAr: 'آليات الحفر والجرف والأشغال الترابية',
    labelFr: 'Terrassement & Excavation',
  },
  {
    id: 'roadwork',
    labelAr: 'آليات الطرق والتهيئة والزفت',
    labelFr: 'Voirie, Compactage & Enrobés',
  },
  {
    id: 'lifting',
    labelAr: 'الرافعات والمناولة والعلو',
    labelFr: 'Levage & Manutention',
  },
  {
    id: 'transport_concrete',
    labelAr: 'النقل الثقيل وشاحنات الخرسانة',
    labelFr: 'Transport Lourd & Béton',
  },
  {
    id: 'drilling_agri',
    labelAr: 'الثقب والمقالع والآليات الفلاحية',
    labelFr: 'Forage, Carrières & Agriculture',
  },
];

export const DRIVER_MACHINE_OPTIONS: DriverMachineOption[] = [
  // Earthmoving & Excavation
  {
    id: 'pelle_chenilles',
    group: 'earthmoving',
    labelAr: 'حفارة مجنزرة (بوكلان شينيل)',
    labelFr: 'Pelle sur chenilles',
    commonTagAr: 'شائعة جداً',
    commonTagFr: 'Très demandé',
  },
  {
    id: 'pelle_pneus',
    group: 'earthmoving',
    labelAr: 'حفارة على عجلات (بوكلان بنو)',
    labelFr: 'Pelle sur pneus',
  },
  {
    id: 'tractopelle',
    group: 'earthmoving',
    labelAr: 'تراكتور بيل / كاسكاطور (JCB / Case)',
    labelFr: 'Tractopelle (3CX / 4CX)',
    commonTagAr: 'الأكثر طلباً',
    commonTagFr: 'Top demande',
  },
  {
    id: 'mini_pelle',
    group: 'earthmoving',
    labelAr: 'ميني بيل (حفارة صغيرة)',
    labelFr: 'Mini-pelle',
  },
  {
    id: 'chargeuse',
    group: 'earthmoving',
    labelAr: 'شارجور / جرافة على عجلات',
    labelFr: 'Chargeuse sur pneus',
    commonTagAr: 'شائعة جداً',
    commonTagFr: 'Très demandé',
  },
  {
    id: 'bobcat',
    group: 'earthmoving',
    labelAr: 'بوبكات / ميني شارجور',
    labelFr: 'Mini-chargeuse (Bobcat)',
  },
  {
    id: 'bulldozer',
    group: 'earthmoving',
    labelAr: 'بلدوزر (نيفا / D6-D9)',
    labelFr: 'Bulldozer',
  },

  // Roadwork & Compaction
  {
    id: 'niveleuse',
    group: 'roadwork',
    labelAr: 'نيفيلوز / ممهدة الطرق (Grader)',
    labelFr: 'Niveleuse (Grader)',
    commonTagAr: 'تخصص نادر',
    commonTagFr: 'Spécialité',
  },
  {
    id: 'compacteur',
    group: 'roadwork',
    labelAr: 'كومباكتور / مدحلة الطرق',
    labelFr: 'Compacteur / Rouleau',
  },
  {
    id: 'finisseur',
    group: 'roadwork',
    labelAr: 'فينيسور الأسفلت (آلة الزفت)',
    labelFr: "Finisseur d'enrobés",
  },
  {
    id: 'fraiseuse_route',
    group: 'roadwork',
    labelAr: 'فريزوز / آلة قشط الطريق',
    labelFr: 'Fraiseuse routière',
  },

  // Lifting & Handling
  {
    id: 'manitou',
    group: 'lifting',
    labelAr: 'تيليسكوبيك / مانيتو',
    labelFr: 'Chariot télescopique (Manitou)',
  },
  {
    id: 'chariot_elevateur',
    group: 'lifting',
    labelAr: 'شاريو / رافعة شوكية (كلارك)',
    labelFr: 'Chariot élévateur (Clark)',
  },
  {
    id: 'grue_mobile',
    group: 'lifting',
    labelAr: 'رافعة متحركة (كروة موبايل)',
    labelFr: 'Grue mobile',
  },
  {
    id: 'grue_tour',
    group: 'lifting',
    labelAr: 'رافعة برجية (كروة للأبراج)',
    labelFr: 'Grue à tour',
  },
  {
    id: 'camion_grue',
    group: 'lifting',
    labelAr: 'شاحنة برافعة (HIAB)',
    labelFr: 'Camion-grue (Bras de grue)',
  },

  // Heavy Transport & Concrete
  {
    id: 'camion_benne',
    group: 'transport_concrete',
    labelAr: 'شاحنة قلاب (6x4 / 8x4 / دومبير)',
    labelFr: 'Camion benne / Dumper',
  },
  {
    id: 'porte_char',
    group: 'transport_concrete',
    labelAr: 'رمورك / بورت شار (نقل الآليات)',
    labelFr: 'Semi-remorque / Porte-char',
  },
  {
    id: 'camion_toupie',
    group: 'transport_concrete',
    labelAr: 'تـوبـي / شاحنة خلط الإسمنت',
    labelFr: 'Camion toupie béton',
  },
  {
    id: 'pompe_beton',
    group: 'transport_concrete',
    labelAr: 'مضخة الخرسانة (بومب بيطون)',
    labelFr: 'Pompe à béton',
  },

  // Drilling, Quarries & Agriculture
  {
    id: 'foreuse',
    group: 'drilling_agri',
    labelAr: 'آلة حفر الآبار والثقب والأساسات',
    labelFr: 'Foreuse / Sondeuse',
  },
  {
    id: 'brise_roche_carriere',
    group: 'drilling_agri',
    labelAr: 'حفارة بمطرقة تكسير الصخور (BRH)',
    labelFr: 'Pelle avec Brise-Roche (BRH)',
  },
  {
    id: 'tracteur_agricole',
    group: 'drilling_agri',
    labelAr: 'جرار فلاحي وآلات الحرث',
    labelFr: 'Tracteur agricole',
  },
  {
    id: 'moissonneuse',
    group: 'drilling_agri',
    labelAr: 'آلة الحصاد والدراس الفلاحية',
    labelFr: 'Moissonneuse-batteuse',
  },
];

export interface ExperienceOption {
  id: string;
  labelAr: string;
  labelFr: string;
  shortAr: string;
  shortFr: string;
}

export const DRIVER_EXPERIENCE_LEVELS: ExperienceOption[] = [
  {
    id: 'lt_1',
    labelAr: 'أقل من سنة (مبتدئ)',
    labelFr: "Moins d'un an (Débutant)",
    shortAr: '< 1 سنة',
    shortFr: '< 1 an',
  },
  {
    id: '1_2',
    labelAr: 'من سنة إلى سنتين',
    labelFr: '1 à 2 ans',
    shortAr: '1-2 سنوات',
    shortFr: '1-2 ans',
  },
  {
    id: '3_5',
    labelAr: 'من 3 إلى 5 سنوات',
    labelFr: '3 à 5 ans',
    shortAr: '3-5 سنوات',
    shortFr: '3-5 ans',
  },
  {
    id: '6_10',
    labelAr: 'من 6 إلى 10 سنوات',
    labelFr: '6 à 10 ans',
    shortAr: '6-10 سنوات',
    shortFr: '6-10 ans',
  },
  {
    id: 'gt_10',
    labelAr: 'أكثر من 10 سنوات (سائق خبير)',
    labelFr: 'Plus de 10 ans (Expert)',
    shortAr: '+10 سنوات',
    shortFr: '+10 ans',
  },
];

export function getDriverMachineOption(id: string): DriverMachineOption {
  return (
    DRIVER_MACHINE_OPTIONS.find((m) => m.id === id) || {
      id,
      group: 'earthmoving',
      labelAr: id,
      labelFr: id,
    }
  );
}

export function getDriverExperienceOption(id?: string): ExperienceOption {
  return (
    DRIVER_EXPERIENCE_LEVELS.find((e) => e.id === id) || DRIVER_EXPERIENCE_LEVELS[2]
  );
}
