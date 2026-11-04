import { MoroccanCity } from '../types/database';

const RAW_CITIES = [
  { id: 'casablanca', name_ar: 'الدار البيضاء', name_fr: 'Casablanca', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.5731, lng: -7.5898, is_major: true },
  { id: 'rabat', name_ar: 'الرباط', name_fr: 'Rabat', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 34.0209, lng: -6.8416, is_major: true },
  { id: 'tangier', name_ar: 'طنجة', name_fr: 'Tanger', region_ar: 'طنجة - تطوان - الحسيمة', region_fr: 'Tanger-Tétouan-Al Hoceïma', lat: 35.7595, lng: -5.8340, is_major: true },
  { id: 'marrakech', name_ar: 'مراكش', name_fr: 'Marrakech', region_ar: 'مراكش - آسفي', region_fr: 'Marrakech-Safi', lat: 31.6295, lng: -7.9811, is_major: true },
  { id: 'fes', name_ar: 'فاس', name_fr: 'Fès', region_ar: 'فاس - مكناس', region_fr: 'Fès-Meknès', lat: 34.0331, lng: -5.0003, is_major: true },
  { id: 'agadir', name_ar: 'أكادير', name_fr: 'Agadir', region_ar: 'سوس - ماسة', region_fr: 'Souss-Massa', lat: 30.4278, lng: -9.5981, is_major: true },
  { id: 'meknes', name_ar: 'مكناس', name_fr: 'Meknès', region_ar: 'فاس - مكناس', region_fr: 'Fès-Meknès', lat: 33.8731, lng: -5.5407, is_major: true },
  { id: 'oujda', name_ar: 'وجدة', name_fr: 'Oujda', region_ar: 'الشرق', region_fr: 'L\'Oriental', lat: 34.6867, lng: -1.9114, is_major: true },
  { id: 'kenitra', name_ar: 'القنيطرة', name_fr: 'Kénitra', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 34.2610, lng: -6.5802, is_major: true },
  { id: 'tetouan', name_ar: 'تطوان', name_fr: 'Tétouan', region_ar: 'طنجة - تطوان - الحسيمة', region_fr: 'Tanger-Tétouan-Al Hoceïma', lat: 35.5889, lng: -5.3626, is_major: true },
  { id: 'safi', name_ar: 'آسفي', name_fr: 'Safi', region_ar: 'مراكش - آسفي', region_fr: 'Marrakech-Safi', lat: 32.2994, lng: -9.2372, is_major: true },
  { id: 'sale', name_ar: 'سلا', name_fr: 'Salé', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 34.0531, lng: -6.7985, is_major: true },
  { id: 'temara', name_ar: 'تمارة', name_fr: 'Témara', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 33.9267, lng: -6.9122, is_major: true },
  { id: 'mohammedia', name_ar: 'المحمدية', name_fr: 'Mohammédia', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.6866, lng: -7.3830, is_major: true },
  { id: 'el-jadida', name_ar: 'الجديدة', name_fr: 'El Jadida', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.2316, lng: -8.5007, is_major: true },
  { id: 'nador', name_ar: 'الناظور', name_fr: 'Nador', region_ar: 'الشرق', region_fr: 'L\'Oriental', lat: 35.1688, lng: -2.9335, is_major: true },
  { id: 'beni-mellal', name_ar: 'بني ملال', name_fr: 'Béni Mellal', region_ar: 'بني ملال - خنيفرة', region_fr: 'Béni Mellal-Khénifra', lat: 32.3394, lng: -6.3608, is_major: true },
  { id: 'taza', name_ar: 'تازة', name_fr: 'Taza', region_ar: 'فاس - مكناس', region_fr: 'Fès-Meknès', lat: 34.2133, lng: -4.0103, is_major: true },
  { id: 'khouribga', name_ar: 'خريبكة', name_fr: 'Khouribga', region_ar: 'بني ملال - خنيفرة', region_fr: 'Béni Mellal-Khénifra', lat: 32.8811, lng: -6.9063, is_major: true },
  { id: 'settat', name_ar: 'سطات', name_fr: 'Settat', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.0010, lng: -7.6166, is_major: true },
  { id: 'berrechid', name_ar: 'برشيد', name_fr: 'Berrechid', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.2655, lng: -7.5875, is_major: true },
  { id: 'laayoune', name_ar: 'العيون', name_fr: 'Laâyoune', region_ar: 'العيون - الساقية الحمراء', region_fr: 'Laâyoune-Sakia El Hamra', lat: 27.1253, lng: -13.1625, is_major: true },
  { id: 'dakhla', name_ar: 'الداخلة', name_fr: 'Dakhla', region_ar: 'الداخلة - وادي الذهب', region_fr: 'Dakhla-Oued Ed-Dahab', lat: 23.6848, lng: -15.9570, is_major: true },
  { id: 'ouarzazate', name_ar: 'ورزازات', name_fr: 'Ouarzazate', region_ar: 'درعة - تافيلالت', region_fr: 'Drâa-Tafilalet', lat: 30.9189, lng: -6.8934, is_major: true },
  { id: 'errachidia', name_ar: 'الرشيدية', name_fr: 'Errachidia', region_ar: 'درعة - تافيلالت', region_fr: 'Drâa-Tafilalet', lat: 31.9315, lng: -4.4266, is_major: true },
  { id: 'al-hoceima', name_ar: 'الحسيمة', name_fr: 'Al Hoceïma', region_ar: 'طنجة - تطوان - الحسيمة', region_fr: 'Tanger-Tétouan-Al Hoceïma', lat: 35.2472, lng: -3.9322, is_major: true },
  { id: 'khemisset', name_ar: 'الخميسات', name_fr: 'Khémisset', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 33.8240, lng: -6.0663, is_major: true },
  { id: 'larache', name_ar: 'العرائش', name_fr: 'Larache', region_ar: 'طنجة - تطوان - الحسيمة', region_fr: 'Tanger-Tétouan-Al Hoceïma', lat: 35.1932, lng: -6.1557, is_major: true },
  { id: 'guelmim', name_ar: 'كلميم', name_fr: 'Guelmim', region_ar: 'كلميم - واد نون', region_fr: 'Guelmim-Oued Noun', lat: 28.9870, lng: -10.0574, is_major: true },
  { id: 'khenifra', name_ar: 'خنيفرة', name_fr: 'Khénifra', region_ar: 'بني ملال - خنيفرة', region_fr: 'Béni Mellal-Khénifra', lat: 32.9395, lng: -5.6676, is_major: true },
  { id: 'taroudant', name_ar: 'تارودانت', name_fr: 'Taroudant', region_ar: 'سوس - ماسة', region_fr: 'Souss-Massa', lat: 30.4703, lng: -8.8770, is_major: true },
  { id: 'essaouira', name_ar: 'الصويرة', name_fr: 'Essaouira', region_ar: 'مراكش - آسفي', region_fr: 'Marrakech-Safi', lat: 31.5085, lng: -9.7595, is_major: true },
  { id: 'fquih-ben-salah', name_ar: 'الفقيه بن صالح', name_fr: 'Fquih Ben Salah', region_ar: 'بني ملال - خنيفرة', region_fr: 'Béni Mellal-Khénifra', lat: 32.5009, lng: -6.7038, is_major: false },
  { id: 'berkane', name_ar: 'بركان', name_fr: 'Berkane', region_ar: 'الشرق', region_fr: 'L\'Oriental', lat: 34.9200, lng: -2.3200, is_major: false },
  { id: 'sidi-kacem', name_ar: 'سيدي قاسم', name_fr: 'Sidi Kacem', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 34.2215, lng: -5.7078, is_major: false },
  { id: 'sidi-slimane', name_ar: 'سيدي سليمان', name_fr: 'Sidi Slimane', region_ar: 'الرباط - سلا - القنيطرة', region_fr: 'Rabat-Salé-Kénitra', lat: 34.2600, lng: -5.9200, is_major: false },
  { id: 'midelt', name_ar: 'ميدلت', name_fr: 'Midelt', region_ar: 'درعة - تافيلالت', region_fr: 'Drâa-Tafilalet', lat: 32.6855, lng: -4.7338, is_major: false },
  { id: 'tinghir', name_ar: 'تنغير', name_fr: 'Tinghir', region_ar: 'درعة - تافيلالت', region_fr: 'Drâa-Tafilalet', lat: 31.5147, lng: -5.5328, is_major: false },
  { id: 'chefchaouen', name_ar: 'شفشاون', name_fr: 'Chefchaouen', region_ar: 'طنجة - تطوان - الحسيمة', region_fr: 'Tanger-Tétouan-Al Hoceïma', lat: 35.1687, lng: -5.2636, is_major: false },
  { id: 'tiznit', name_ar: 'تيزنيت', name_fr: 'Tiznit', region_ar: 'سوس - ماسة', region_fr: 'Souss-Massa', lat: 29.6974, lng: -9.7316, is_major: false },
  { id: 'tan-tan', name_ar: 'طانطان', name_fr: 'Tan-Tan', region_ar: 'كلميم - واد نون', region_fr: 'Guelmim-Oued Noun', lat: 28.4380, lng: -11.1032, is_major: false },
  { id: 'bouskoura', name_ar: 'بوسكورة', name_fr: 'Bouskoura', region_ar: 'الدار البيضاء - سطات', region_fr: 'Casablanca-Settat', lat: 33.4497, lng: -7.6492, is_major: true }
];

export const MOROCCAN_CITIES: MoroccanCity[] = RAW_CITIES.map((city) => ({
  ...city,
  nameAr: city.name_ar,
  nameFr: city.name_fr,
  regionAr: city.region_ar,
  regionFr: city.region_fr,
  isMajor: city.is_major,
}));

export const getCityById = (id: string): MoroccanCity | undefined => {
  return MOROCCAN_CITIES.find(city => city.id === id);
};

export const getCityName = (cityId: string, lang: 'ar' | 'fr' = 'ar'): string => {
  const city = getCityById(cityId);
  if (!city) return cityId;
  return lang === 'fr' ? (city.nameFr || city.name_fr) : (city.nameAr || city.name_ar);
};
