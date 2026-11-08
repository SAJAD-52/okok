import React, { useState, useEffect } from 'react';
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
import { getCityName } from '../../data/cities';
import { formatPriceMAD } from '../../data/rentalTerms';
import { useLanguage } from '../../hooks/useLanguage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Machine } from '../../types/database';
import { machineStore } from '../../lib/machineStore';

export const MarketplacePreviewSection: React.FC = () => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPreviewMachines() {
      let mapped: Machine[] = [];

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('machines')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .limit(6);

          if (!error && data && data.length > 0) {
            mapped = data.map((m: any) => ({
              id: m.id,
              owner_id: m.owner_id,
              title_ar: m.title_ar,
              title_fr: m.title_fr,
              description_ar: m.description_ar,
              description_fr: m.description_fr,
              category: m.category,
              category_id: m.category,
              brand: m.brand,
              model: m.model,
              year: m.year,
              listing_mode: m.listing_mode,
              condition: m.condition || 'good',
              city: m.city,
              city_id: m.city,
              lat: m.lat,
              lng: m.lng,
              location_lat: m.lat,
              location_lng: m.lng,
              rate_hourly: Number(m.hourly_rate) || 0,
              rate_daily: Number(m.daily_rate) || 0,
              rate_weekly: Number(m.weekly_rate) || 0,
              sale_price: Number(m.sale_price) || 0,
              currency: 'MAD',
              with_operator: Boolean(m.with_operator),
              fuel_included: Boolean(m.fuel_included),
              delivery_available: Boolean(m.delivery_available),
              status: 'available',
              images: m.images?.length ? m.images : [
                'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80',
              ],
              specs: m.specs || {},
              views_count: m.views_count || 0,
              rating_avg: m.rating_avg || 0,
              reviews_count: m.reviews_count || 0,
              created_at: m.created_at,
              updated_at: m.created_at,
            }));
          }
        } catch (err) {
          console.warn('Preview machines load notice:', err);
        }
      }

      const merged = machineStore.mergeMachines(mapped);
      setMachines(merged.slice(0, 6));
      setIsLoading(false);
    }

    fetchPreviewMachines();

    const handleUpdate = () => {
      fetchPreviewMachines();
    };
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
    };
  }, []);

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
            <span>{lang === 'fr' ? 'Explorer tout le catalogue' : 'عرض كامل الحظيرة'}</span>
            <ArrowIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Horizontally Scrollable Cards Container */}
        {machines.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex gap-5 overflow-x-auto pb-6 pt-2 no-scrollbar scroll-smooth snap-x snap-mandatory"
          >
            {machines.map((m) => {
              const cityName = m.city || getCityName(m.city_id, lang);
              const isSale = m.listing_mode === 'sale';

              return (
                <div
                  key={m.id}
                  className="w-[280px] sm:w-[320px] shrink-0 snap-start rounded-2xl bg-surface border border-steel-200/90 shadow-soft hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group text-start"
                >
                  {/* Image & Badges */}
                  <div className="relative aspect-[16/10] bg-steel-900 overflow-hidden">
                    <img
                      src={m.images[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'}
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
                        <div className="font-extrabold text-sm text-ink font-mono latin-nums">
                          {formatPriceMAD(isSale ? m.sale_price || 0 : m.rate_daily || 0)}
                          {!isSale && (
                            <span className="text-[10px] text-steel-500 font-normal"> /jour</span>
                          )}
                        </div>
                      </div>

                      <Link
                        to={`/marketplace/${m.id}`}
                        className="p-2 rounded-xl bg-ink text-primary hover:bg-steel-800 transition-colors shadow-sm"
                        aria-label="Voir la fiche"
                      >
                        <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <div className="p-8 text-center bg-surface border border-steel-200 rounded-2xl">
            <p className="text-xs text-steel-500 mb-3">
              {lang === 'fr'
                ? 'Consultez les engins disponibles sur notre marketplace nationale.'
                : 'تصفح الآليات المتاحة في مختلف المدن المغربية عبر سوق JADIJCB.'}
            </p>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 text-xs font-bold bg-primary text-ink px-4 py-2 rounded-xl shadow-sm"
            >
              <span>{lang === 'fr' ? 'Accéder au catalogue' : 'فتح سوق الآليات'}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Dual CTA Banners */}
        <div className="mt-12">
          <DualCtaRow />
        </div>
      </div>
    </section>
  );
};

export default MarketplacePreviewSection;
