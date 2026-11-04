import React from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MACHINERY_CATEGORIES } from '../data/categories';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const { language, setFilter } = useAppStore();

  const handleCategoryClick = (catId: string) => {
    setFilter('categoryId', catId);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleCityClick = (cityId: string) => {
    setFilter('cityId', cityId);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  return (
    <footer className="bg-ink-dark text-slate-300 border-t border-steel/60 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-ink font-black shadow-yellow-glow">
                <Truck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white font-sans">
                JADI<span className="text-primary">JCB</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t('footer.about')}
            </p>
            <div className="flex items-center gap-2 text-xs text-primary font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'ar' ? 'منصة مغربية 100% مطابقة لمعايير BTP' : 'Plateforme 100% Marocaine BTP'}</span>
            </div>
          </div>

          {/* Quick Categories */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('footer.categories')}
            </h4>
            <ul className="space-y-2 text-xs">
              {MACHINERY_CATEGORIES.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => handleCategoryClick(cat.id)}
                    className="hover:text-primary transition-colors text-start"
                  >
                    {language === 'ar' ? cat.nameAr : cat.nameFr}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Moroccan Cities */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('footer.cities')}
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                { id: 'casablanca', nameAr: 'الدار البيضاء الكبرى', nameFr: 'Grand Casablanca' },
                { id: 'tanger', nameAr: 'طنجة المتوسط', nameFr: 'Tanger Med' },
                { id: 'rabat', nameAr: 'الرباط وسلا', nameFr: 'Rabat - Salé' },
                { id: 'marrakech', nameAr: 'مراكش والجنوب', nameFr: 'Marrakech & Sud' },
                { id: 'agadir', nameAr: 'أكادير وسوس', nameFr: 'Agadir Souss' },
                { id: 'fes', nameAr: 'فاس ومكناس', nameFr: 'Fès - Meknès' },
              ].map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleCityClick(c.id)}
                    className="hover:text-primary transition-colors text-start"
                  >
                    {language === 'ar' ? c.nameAr : c.nameFr}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('footer.contact')}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <a 
                href="tel:+212522987654" 
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <span dir="ltr">{t('footer.phone')}</span>
              </a>
              <a 
                href="mailto:contact@jadijcb.ma" 
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{t('footer.email')}</span>
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{t('footer.address')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-steel/40 text-center text-xs text-slate-500 font-sans">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
};
