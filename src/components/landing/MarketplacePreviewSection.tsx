import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  UserCheck, 
  Fuel, 
  ArrowLeft, 
  ArrowRight, 
  ChevronRight, 
  Tag 
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { MOCK_MACHINES } from '../../data/mockData';
import { getCityName } from '../../data/cities';
import { formatPriceMAD } from '../../data/rentalTerms';
import { useLanguage } from '../../hooks/useLanguage';

export const MarketplacePreviewSection: React.FC = () => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="py-16 sm:py-24 bg-white border-b border-steel-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="max-w-2xl text-start">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
              {lang === 'fr' ? 'Parc d\'engins en direct' : 'عينة من آليات السوق المتاحة اليوم'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
              {lang === 'fr'
                ? 'Engins disponibles immédiatement sur vos chantiers'
                : 'آليات جاهزة للانطلاق الفوري نحو أوراشكم بالمغرب'}
            </h2>
            <p className="text-xs sm:text-sm text-steel-600 mt-2">
              {lang === 'fr'
                ? 'Consultez les tarifs en Dirhams, la disponibilité du chauffeur et les garanties techniques.'
                : 'تصفح الأسعار اليومية بالدرهم، جاهزية السائق المعتمد، والتوصيل السريع إلى موقع عملك.'}
            </p>
          </div>

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-bold text-ink hover:text-primary-dark transition-colors self-start md:self-auto shrink-0 pb-1"
          >
            <span>{lang === 'fr' ? 'Explorer tout le catalogue (540+)' : 'عرض كامل الحظيرة (540+)'}</span>
            <ArrowIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Horizontally Scrollable Cards Container */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex gap-5 overflow-x-auto pb-6 pt-2 no-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          {MOCK_MACHINES.slice(0, 6).map((m) => {
            const cityName = getCityName(m.city_id, lang);
            const isSale = m.rate_daily === 0 && (m as any).sale_price;

            return (
              <div
                key={m.id}
                className="w-[280px] sm:w-[320px] shrink-0 snap-start rounded-2xl bg-surface border border-steel-200/90 shadow-soft hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group text-start"
              >
                {/* Image & Badges */}
                <div className="relative aspect-[16/10] bg-steel-900 overflow-hidden">
                  <img
                    src={m.images[0]}
                    alt={lang === 'fr' ? m.title_fr : m.title_ar}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {/* Mode Badge (Rent / Sale) */}
                  <div className="absolute top-3 start-3">
                    <span className="px-2.5 py-1 rounded-md bg-ink/90 text-primary border border-primary/30 text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                      {isSale
                        ? lang === 'fr' ? 'À Vendre' : 'للبيع'
                        : lang === 'fr' ? 'Location' : 'كراء'}
                    </span>
                  </div>

                  {/* City Overlay */}
                  <div className="absolute bottom-3 start-3 flex items-center gap-1.5 text-xs font-semibold text-white">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>{cityName}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-steel-500 tracking-wider">
                      {m.brand} · {m.model} ({m.year})
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1 line-clamp-2 leading-snug">
                      {lang === 'fr' ? m.title_fr : m.title_ar}
                    </h3>
                  </div>

                  {/* Addon features */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-steel-600 font-medium my-3 pt-3 border-t border-steel-200/60">
                    {m.with_operator && (
                      <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>{lang === 'fr' ? 'Avec chauffeur' : 'مع سائق'}</span>
                      </span>
                    )}
                    {m.fuel_included && (
                      <span className="inline-flex items-center gap-1 text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                        <Fuel className="w-3 h-3 text-blue-600" />
                        <span>{lang === 'fr' ? 'Carburant inclus' : 'الوقود مشمول'}</span>
                      </span>
                    )}
                  </div>

                  {/* Price & Action */}
                  <div className="pt-3 border-t border-steel-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-steel-400 block font-medium">
                        {isSale
                          ? lang === 'fr' ? 'Prix net' : 'سعر البيع'
                          : lang === 'fr' ? 'Tarif journalier' : 'السعر اليومي'}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-ink font-sans latin-nums">
                        {isSale
                          ? formatPriceMAD((m as any).sale_price || 0, lang)
                          : formatPriceMAD(m.rate_daily, lang)}
                      </span>
                    </div>

                    <Link
                      to={`/marketplace/${m.id}`}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-ink hover:bg-steel-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>{lang === 'fr' ? 'Réserver' : 'حجز الآن'}</span>
                      <ArrowIcon className="w-3 h-3 text-primary" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-12" />
      </div>
    </section>
  );
};

export default MarketplacePreviewSection;
