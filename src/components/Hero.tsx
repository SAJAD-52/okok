import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Layers, ShieldCheck, CheckCircle2, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MOROCCAN_CITIES } from '../data/cities';
import { MACHINERY_CATEGORIES } from '../data/categories';

export const Hero: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { language, filters, setFilter } = useAppStore();

  const [localQuery, setLocalQuery] = useState(filters.searchQuery);
  const [localCategory, setLocalCategory] = useState(filters.categoryId);
  const [localCity, setLocalCity] = useState(filters.cityId);
  const [localType, setLocalType] = useState(filters.type);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter('searchQuery', localQuery);
    setFilter('categoryId', localCategory);
    setFilter('cityId', localCity);
    setFilter('type', localType);
  };

  return (
    <div className="relative bg-ink text-white overflow-hidden border-b border-steel/60">
      {/* Background industrial grid & radial safety yellow glow */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#FFB400 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute -top-32 start-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/20 blur-[130px] rounded-full pointer-events-none" />

      {/* Top subtle hazard bar */}
      <div className="h-1.5 w-full bg-hazard-stripes opacity-80" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-16 sm:pb-16">
        {/* Moroccan B2B Marketplace Badge */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-steel/80 border border-primary/40 text-primary text-xs sm:text-sm font-bold shadow-soft">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>{t('hero.badge')}</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight sm:leading-tight">
            <span>{t('hero.title_part1')} </span>
            <span className="text-primary relative inline-block">
              {t('hero.title_part2')}
              <svg className="absolute -bottom-2 start-0 w-full h-2 text-primary/40" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
              </svg>
            </span>
            <br className="hidden sm:inline" />
            <span className="text-slate-100"> {t('hero.title_part3')}</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('hero.desc')}
          </p>
        </div>

        {/* Interactive Quick Search Engine Box */}
        <div className="mt-8 sm:mt-10 max-w-5xl mx-auto">
          <form 
            onSubmit={handleSearchSubmit}
            className="bg-steel/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-steel-light/50 shadow-lift"
          >
            {/* Offer Type Tabs (All / Rent / Sale) */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-steel-light/40">
              <button
                type="button"
                onClick={() => setLocalType('all')}
                className={`min-h-[44px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  localType === 'all'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-ink/50'
                }`}
              >
                {t('hero.all_types')}
              </button>
              <button
                type="button"
                onClick={() => setLocalType('rent')}
                className={`min-h-[44px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  localType === 'rent'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-ink/50'
                }`}
              >
                {t('hero.rent_only')}
              </button>
              <button
                type="button"
                onClick={() => setLocalType('sale')}
                className={`min-h-[44px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  localType === 'sale'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-ink/50'
                }`}
              >
                {t('hero.sale_only')}
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Keyword Query */}
              <div className="relative">
                <Search className="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder={t('hero.search_placeholder')}
                  className="w-full min-h-[44px] ps-10 pe-3 py-2.5 rounded-xl bg-ink/80 text-white placeholder-slate-400 text-xs sm:text-sm border border-steel/80 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Machinery Category Selector */}
              <div className="relative">
                <Layers className="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={localCategory}
                  onChange={(e) => setLocalCategory(e.target.value)}
                  className="w-full min-h-[44px] ps-10 pe-8 py-2.5 rounded-xl bg-ink/80 text-white text-xs sm:text-sm border border-steel/80 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer transition-all"
                >
                  <option value="">{t('hero.all_categories')}</option>
                  {MACHINERY_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-ink text-white">
                      {language === 'ar' ? cat.nameAr : cat.nameFr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Moroccan City Selector */}
              <div className="relative">
                <MapPin className="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={localCity}
                  onChange={(e) => setLocalCity(e.target.value)}
                  className="w-full min-h-[44px] ps-10 pe-8 py-2.5 rounded-xl bg-ink/80 text-white text-xs sm:text-sm border border-steel/80 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer transition-all"
                >
                  <option value="">{t('hero.all_cities')}</option>
                  {MOROCCAN_CITIES.map((city) => (
                    <option key={city.id} value={city.id} className="bg-ink text-white">
                      {language === 'ar' ? city.nameAr : city.nameFr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Search Submit Button */}
              <button
                type="submit"
                className="w-full min-h-[44px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-bold text-sm sm:text-base shadow-yellow-glow flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-ink focus:ring-primary"
              >
                <Search className="w-5 h-5 stroke-[2.5]" />
                <span>{t('hero.search_btn')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Real Moroccan Market Key Numbers */}
        <div className="mt-10 sm:mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-steel/40">
          <div className="text-center p-3 rounded-xl bg-steel/30 border border-steel/40">
            <div className="text-2xl sm:text-3xl font-black text-primary font-sans">540+</div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{t('hero.stat_machines')}</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-steel/30 border border-steel/40">
            <div className="text-2xl sm:text-3xl font-black text-primary font-sans">40</div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{t('hero.stat_cities')}</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-steel/30 border border-steel/40">
            <div className="text-2xl sm:text-3xl font-black text-primary font-sans">100%</div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{t('hero.stat_verified')}</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-steel/30 border border-steel/40">
            <div className="text-2xl sm:text-3xl font-black text-primary font-sans">99%</div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{t('hero.stat_satisfaction')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
