import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, ShieldCheck, Truck, Package, Clock, Phone, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const SparePartsSection: React.FC = () => {
  const { t } = useTranslation();
  const { language, setFilter, addToast } = useAppStore();

  const partCategories = [
    {
      id: 'filtration',
      nameAr: 'فلاتر الديزل والزيت والهيدروليك',
      nameFr: 'Filtration Moteur & Hydraulique',
      descAr: 'فلاتر أصلية JCB, CAT, Donaldson لكافة أنواع المحركات',
      descFr: 'Filtres certifiés d\'origine pour protection moteur',
      brands: 'JCB, CAT, Komatsu, Donaldson',
      count: 45,
    },
    {
      id: 'undercarriage',
      nameAr: 'الجنازير والسلاسل والبكرات (Train de roulement)',
      nameFr: 'Train de Roulement & Chenilles',
      descAr: 'سلاسل حديدية ومطاطية، بكرات توجيه، وتروس مسننة',
      descFr: 'Chenilles acier/caoutchouc, galets et barbotins',
      brands: 'Berco, ITR, JCB, Komatsu',
      count: 28,
    },
    {
      id: 'wear-parts',
      nameAr: 'أسنان ودلاء الحفر (Dents de godet & Lames)',
      nameFr: 'Dents de Godet & Lames d\'Usure',
      descAr: 'أسنان صلبة مقاومة للتآكل ومسامير التثبيت السريع',
      descFr: 'Dents renforcées, adaptateurs et lames biseautées',
      brands: 'Esco, MTG, Caterpillar, JCB',
      count: 38,
    },
    {
      id: 'hydraulics',
      nameAr: 'المضخات والخراطيم الهيدروليكية',
      nameFr: 'Hydraulique & Flexibles HP',
      descAr: 'مضخات رئيسية، صمامات، خراطيم الضغط العالي مع الكبس',
      descFr: 'Pompes à pistons, distributeurs et flexibles haute pression',
      brands: 'Rexroth, Kawasaki, Parker, Danfoss',
      count: 31,
    },
  ];

  const handleOrderParts = (partName: string) => {
    const text = language === 'ar'
      ? `السلام عليكم، أود الاستفسار وطلب عرض سعر لقطع الغيار: ${partName} عبر منصة JADIJCB`
      : `Bonjour, je souhaite un devis pour les pièces détachées : ${partName} via JADIJCB`;
    window.open(`https://wa.me/212661889900?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="py-8 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner */}
        <div className="bg-ink text-white rounded-3xl p-6 sm:p-10 border border-steel/60 shadow-lift relative overflow-hidden mb-10">
          <div className="absolute top-0 end-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30 mb-3">
              <Wrench className="w-4 h-4" />
              <span>{language === 'ar' ? 'مستودع قطع الغيار المعتمد بالمغرب' : 'Dépôt Pièces BTP Agréé Maroc'}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-3">
              {language === 'ar' ? 'قطع غيار أصلية وتوافقية لكافة آلياتك' : 'Pièces de Rechange d\'Origine & Adaptables'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
              {language === 'ar' 
                ? 'فلاتر، مسامير، جنازير، أسنان الجرافات، ومضخات هيدروليكية متوفرة للتسليم السريع في كافة أوراش المملكة خلال 24 إلى 48 ساعة.'
                : 'Livraison express sur chantier en 24h/48h partout au Maroc. Plus de 20 000 références en stock certifiées constructeur.'
              }
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-bold">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" />
                <span>{language === 'ar' ? 'توصيل عبر Amana / CTM لجميع المدن' : 'Livraison express partout au Maroc'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{language === 'ar' ? 'ضمان أصالة القطع 100%' : '100% Pièces Certifiées'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Parts Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {partCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-soft hover:shadow-lift transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-primary-dark bg-primary/15 px-2.5 py-1 rounded-lg">
                    {cat.brands}
                  </span>
                  <span className="text-xs text-slate-400 font-sans">
                    {cat.count} {language === 'ar' ? 'صنف متوفر' : 'références'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-ink mb-2">
                  {language === 'ar' ? cat.nameAr : cat.nameFr}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                  {language === 'ar' ? cat.descAr : cat.descFr}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'متوفر للشحن الفوري' : 'En stock immédiat'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOrderParts(cat.nameFr)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-ink hover:bg-ink-light text-primary font-bold text-xs flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{language === 'ar' ? 'طلب تسعيرة القطعة' : 'Commander / Devis'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
