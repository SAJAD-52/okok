import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useLanguage } from '../../hooks/useLanguage';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { MOROCCAN_CITIES } from '../../data/cities';

export const Footer: React.FC = () => {
  const { t, lang } = useLanguage();
  const majorCities = MOROCCAN_CITIES.filter((c) => c.is_major).slice(0, 8);
  const featuredCategories = EQUIPMENT_CATEGORIES.slice(0, 6);

  return (
    <footer className="bg-ink text-white border-t border-steel/30 pt-14 pb-20 md:pb-12 text-start">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-steel-800">
          {/* Brand Info & Mission */}
          <div className="lg:col-span-2 flex flex-col gap-4 pe-4">
            <Logo variant="light" size="lg" />
            <p className="text-xs text-steel-400 leading-relaxed max-w-sm mt-1">
              {t('landing.hero_subtitle')}
            </p>

            <div className="flex flex-col gap-2 mt-2 text-xs text-steel-300">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>Zone Industrielle Sidi Maârouf, Casablanca, Maroc</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span dir="ltr" className="latin-nums font-mono font-medium">+212 (0) 522 98 44 20</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span>contact@jadijcb.ma</span>
              </div>
            </div>

            <div className="mt-3">
              <LanguageSwitcher variant="dark" />
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-4">
              {t('landing.categories_title')}
            </h4>
            <ul className="space-y-2 text-xs text-steel-400">
              {featuredCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/marketplace?category=${cat.slug}`}
                    className="hover:text-white transition-colors"
                  >
                    {lang === 'fr' ? cat.name_fr : cat.name_ar}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hubs / Cities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-4">
              {lang === 'fr' ? 'Chantiers par ville' : 'المدن والمشاريع'}
            </h4>
            <ul className="space-y-2 text-xs text-steel-400">
              {majorCities.map((city) => (
                <li key={city.id}>
                  <Link
                    to={`/marketplace?city=${city.id}`}
                    className="hover:text-white transition-colors"
                  >
                    {lang === 'fr' ? city.name_fr : city.name_ar}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-4">
              {lang === 'fr' ? 'Sécurité & Légal' : 'الأمان والضمانات'}
            </h4>
            <div className="flex flex-col gap-3 text-xs text-steel-400">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="leading-tight">
                  {lang === 'fr'
                    ? 'Contrats B2B certifiés conformes au Code de Commerce marocain.'
                    : 'عقود كراء رقمية مطابقة لمدونة التجارة المغربية.'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-steel-900 border border-steel-800 text-[11px] leading-relaxed">
                <span className="text-primary font-bold block mb-0.5">
                  ICE : 003294821000045
                </span>
                <span>Registre de Commerce : Casablanca N° 584920</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-steel-500">
          <p>© {new Date().getFullYear()} JADIJCB Maroc S.A.R.L. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <span className="text-steel-400">الدار البيضاء · طنجة · مراكش · الرباط · أكادير</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
