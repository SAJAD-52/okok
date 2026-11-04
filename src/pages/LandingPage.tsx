import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Truck,
  PhoneCall,
  Star,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { EQUIPMENT_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES } from '../data/cities';
import { MOCK_MACHINES } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';

export const LandingPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedCity) params.set('city', selectedCity);
    navigate(`/marketplace?${params.toString()}`);
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-surface flex flex-col selection:bg-primary selection:text-ink">
      <PublicHeader />

      {/* Hero Section (Dark Industrial Ink with Subtle Safety Yellow Ambient Glow) */}
      <section className="relative bg-ink text-white overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-steel-800">
        {/* Ambient Grid & Glow */}
        <div className="absolute inset-0 bg-industrial-grid opacity-20 pointer-events-none" />
        <div className="absolute top-1/4 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Hero Trust Kicker */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-steel-900/90 border border-steel-700 text-xs font-semibold text-primary mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>{t('landing.hero_badge')}</span>
          </div>

          {/* Hero Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight max-w-4xl text-balance">
            {t('landing.hero_title')}
          </h1>

          <p className="mt-5 text-sm sm:text-base text-steel-300 max-w-2xl leading-relaxed text-balance">
            {t('landing.hero_subtitle')}
          </p>

          {/* Interactive B2B Search Strip */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-4xl mt-10 bg-white p-3 sm:p-4 rounded-2xl shadow-elevated border border-steel-200 text-ink grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            {/* Category Select */}
            <div className="sm:col-span-5 flex items-center border border-steel-200 rounded-xl px-3 bg-surface">
              <Layers className="w-4 h-4 text-steel-400 shrink-0 me-2" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full min-h-[44px] bg-transparent text-xs sm:text-sm font-medium text-ink focus:outline-none cursor-pointer"
                aria-label={t('landing.search_category_placeholder')}
              >
                <option value="">{t('landing.search_category_placeholder')}</option>
                {EQUIPMENT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {lang === 'fr' ? cat.name_fr : cat.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* City Select */}
            <div className="sm:col-span-4 flex items-center border border-steel-200 rounded-xl px-3 bg-surface">
              <MapPin className="w-4 h-4 text-steel-400 shrink-0 me-2" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full min-h-[44px] bg-transparent text-xs sm:text-sm font-medium text-ink focus:outline-none cursor-pointer"
                aria-label={t('landing.search_city_placeholder')}
              >
                <option value="">{t('landing.search_city_placeholder')}</option>
                {MOROCCAN_CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {lang === 'fr' ? city.name_fr : city.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <div className="sm:col-span-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full h-full min-h-[44px] justify-center"
                leftIcon={<Search className="w-4 h-4" />}
              >
                {t('landing.search_btn')}
              </Button>
            </div>
          </form>

          {/* Quick Category Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-xs text-steel-400">
            <span className="font-semibold text-steel-300">
              {lang === 'fr' ? 'Populaires :' : 'الأكثر طلباً:'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/marketplace?category=loader')}
              className="px-2.5 py-1 rounded-lg bg-steel-900/60 hover:bg-steel-800 text-steel-300 hover:text-primary transition-colors cursor-pointer"
            >
              JCB 3CX
            </button>
            <button
              type="button"
              onClick={() => navigate('/marketplace?category=excavator')}
              className="px-2.5 py-1 rounded-lg bg-steel-900/60 hover:bg-steel-800 text-steel-300 hover:text-primary transition-colors cursor-pointer"
            >
              {lang === 'fr' ? 'Pelle CAT 320' : 'حفارة كاتر بيلر'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/marketplace?category=truck')}
              className="px-2.5 py-1 rounded-lg bg-steel-900/60 hover:bg-steel-800 text-steel-300 hover:text-primary transition-colors cursor-pointer"
            >
              {lang === 'fr' ? 'Camion 8x4' : 'شاحنة قلاب 8x4'}
            </button>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <section className="bg-white border-b border-steel-200/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-xl bg-surface">
              <div className="text-2xl sm:text-3xl font-extrabold text-ink latin-nums font-mono">
                +1 250
              </div>
              <p className="text-xs text-steel-600 font-medium mt-1">
                {t('landing.kpi_machines')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface">
              <div className="text-2xl sm:text-3xl font-extrabold text-ink latin-nums font-mono">
                42
              </div>
              <p className="text-xs text-steel-600 font-medium mt-1">
                {t('landing.kpi_cities')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface">
              <div className="text-2xl sm:text-3xl font-extrabold text-ink latin-nums font-mono text-success">
                98.4%
              </div>
              <p className="text-xs text-steel-600 font-medium mt-1">
                {t('landing.kpi_rate')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface">
              <div className="text-2xl sm:text-3xl font-extrabold text-primary-dark latin-nums font-mono">
                24/7
              </div>
              <p className="text-xs text-steel-600 font-medium mt-1">
                {t('landing.kpi_support')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Machinery Categories Grid */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4 text-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">
                {t('landing.categories_title')}
              </h2>
              <p className="text-xs sm:text-sm text-steel-500 mt-1">
                {t('landing.categories_subtitle')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/marketplace')}
              rightIcon={<ArrowIcon className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Voir tout le catalogue' : 'عرض جميع الفئات'}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/marketplace?category=${cat.slug}`)}
                className="group p-5 bg-white rounded-2xl border border-steel-200/80 shadow-soft hover:shadow-elevated hover:border-primary/50 transition-all text-start flex flex-col justify-between min-h-[140px] cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-ink group-hover:bg-primary transition-colors">
                    <Truck className="w-5 h-5 text-ink" />
                  </div>
                  <span className="text-[11px] font-mono latin-nums font-bold text-steel-400">
                    {cat.badge_count}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-xs sm:text-sm font-bold text-ink group-hover:text-primary-dark transition-colors">
                    {lang === 'fr' ? cat.name_fr : cat.name_ar}
                  </h3>
                  <p className="text-[11px] text-steel-500 line-clamp-1 mt-0.5">
                    {lang === 'fr' ? cat.description_fr : cat.description_ar}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Equipment Showcase */}
      <section className="py-16 bg-white border-y border-steel-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4 text-start">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-dark mb-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                <span>{lang === 'fr' ? 'Disponibilité Immédiate' : 'جاهزة للتشغيل الفوري'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">
                {t('landing.featured_title')}
              </h2>
              <p className="text-xs sm:text-sm text-steel-500 mt-1">
                {t('landing.featured_subtitle')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/marketplace')}
              rightIcon={<ArrowIcon className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Explorer le parc' : 'تصفح كل الآليات'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_MACHINES.slice(0, 3).map((machine) => {
              const cityName = MOROCCAN_CITIES.find((c) => c.id === machine.city_id);

              return (
                <Card
                  key={machine.id}
                  hoverEffect
                  className="flex flex-col justify-between p-0 overflow-hidden"
                >
                  {/* Image & Badges */}
                  <div className="relative aspect-video w-full bg-steel-100 overflow-hidden">
                    <img
                      src={machine.images[0]}
                      alt={lang === 'fr' ? machine.title_fr : machine.title_ar}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 start-3 flex gap-1.5">
                      <Badge variant="primary" size="sm">
                        {machine.brand}
                      </Badge>
                      {machine.with_operator && (
                        <Badge variant="success" size="sm">
                          {t('marketplace.with_operator')}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute bottom-3 end-3 bg-ink/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold latin-nums">
                      {formatPriceMAD(machine.rate_daily, lang)} / {lang === 'fr' ? 'jour' : 'يوم'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between text-start">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-steel-500 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                          {cityName ? (lang === 'fr' ? cityName.name_fr : cityName.name_ar) : machine.city_id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="latin-nums">{machine.year}</span>
                      </div>
                      <h3 className="text-sm font-bold text-ink leading-snug line-clamp-2">
                        {lang === 'fr' ? machine.title_fr : machine.title_ar}
                      </h3>
                    </div>

                    <div className="pt-4 mt-4 border-t border-steel-100 flex items-center justify-between gap-3">
                      <div className="text-xs text-steel-600">
                        <span className="font-bold text-ink latin-nums font-mono">
                          {formatPriceMAD(machine.rate_hourly, lang)}
                        </span>{' '}
                        / {t('marketplace.per_hour')}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/marketplace/${machine.id}`)}
                      >
                        {t('marketplace.view_details')}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose JADIJCB Section */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">
              {t('landing.why_title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-start">
            <div className="p-6 bg-white rounded-2xl border border-steel-200/80 shadow-soft">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-ink flex items-center justify-center font-bold mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary-dark" />
              </div>
              <h3 className="text-base font-bold text-ink mb-2">
                {t('landing.why_verified_title')}
              </h3>
              <p className="text-xs text-steel-600 leading-relaxed">
                {t('landing.why_verified_desc')}
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-steel-200/80 shadow-soft">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-ink flex items-center justify-center font-bold mb-4">
                <span className="text-lg font-bold font-mono text-ink">MAD</span>
              </div>
              <h3 className="text-base font-bold text-ink mb-2">
                {t('landing.why_pricing_title')}
              </h3>
              <p className="text-xs text-steel-600 leading-relaxed">
                {t('landing.why_pricing_desc')}
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-steel-200/80 shadow-soft">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-ink flex items-center justify-center font-bold mb-4">
                <ShieldAlert className="w-6 h-6 text-primary-dark" />
              </div>
              <h3 className="text-base font-bold text-ink mb-2">
                {t('landing.why_contracts_title')}
              </h3>
              <p className="text-xs text-steel-600 leading-relaxed">
                {t('landing.why_contracts_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Equipment Owner CTA Section */}
      <section className="bg-ink text-white py-16 relative overflow-hidden border-t border-steel-800">
        <div className="absolute inset-0 bg-hazard-stripes opacity-5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center flex flex-col items-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold max-w-2xl text-balance">
            {t('landing.cta_title')}
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-steel-300 max-w-xl leading-relaxed text-balance">
            {t('landing.cta_desc')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto font-extrabold"
            >
              {t('landing.cta_btn')}
            </Button>
            <a
              href="https://wa.me/212661245588"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-steel-900 border border-steel-700 text-xs font-bold text-white hover:bg-steel-800 transition-colors min-h-[48px]"
            >
              <PhoneCall className="w-4 h-4 text-success" />
              <span>{t('landing.cta_call')}</span>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
