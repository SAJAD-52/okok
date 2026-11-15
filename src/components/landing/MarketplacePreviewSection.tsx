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
  Truck,
  Wrench,
  Radio,
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
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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
              images: m.images?.length ? m.images : [],
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

  const categoryQuickLinks = [
    {
      slug: 'loader',
      titleAr: 'جرافات وتراكتوبيل JCB',
      titleFr: 'Tractopelles & Chargeuses JCB',
      descAr: 'جرافات 3CX و4CX متوفرة بالكراء اليومي أو الشهري مع سائق معتمد في مختلف المدن.',
      descFr: 'Tractopelles 3CX/4CX prêtes à intervenir avec chauffeur qualifié et bras BRH.',
      icon: Truck,
      metaAr: 'كراء · بيع',
      metaFr: 'Location · Vente',
    },
    {
      slug: 'excavator',
      titleAr: 'حفارات مجنزرة ومدولبة',
      titleFr: 'Pelles hydrauliques & Mini-pelles',
      descAr: 'حفارات من 3 إلى 35 طن لأشغال الحفر، الأساسات، الصخور، وقنوات الصرف.',
      descFr: 'Pelles de 3 à 35 tonnes pour terrassement lourd, VRD et tranchées.',
      icon: Radio,
      metaAr: 'رادار قريب',
      metaFr: 'Radar GPS',
    },
    {
      slug: 'crane',
      titleAr: 'رافعات، شاحنات ومداحل',
      titleFr: 'Grues, Camions Bennes & Compacteurs',
      descAr: 'تجهيزات الطرق والبناء الكبرى متوفرة مع خيار النقل بـ Porte-Char إلى باب الورش.',
      descFr: 'Matériel de levage, transport bennes et compactage livrable par porte-char.',
      icon: MapPin,
      metaAr: '40 مدينة',
      metaFr: '40 villes',
    },
    {
      slug: 'spare_parts',
      titleAr: 'مستودع قطع الغيار الأصلية',
      titleFr: 'Pièces de rechange & Hydraulique',
      descAr: 'فلاتر، خراطيم هيدروليكية، جنازير، وأسنان الدلو بأثمنة واضحة وشحن سريع للورش.',
      descFr: 'Filtres, flexibles, chenilles et dents de godet expédiés directement sur site.',
      icon: Wrench,
      metaAr: 'شحن للورش',
      metaFr: 'Livraison site',
    },
  ];

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-white border-b border-steel-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-12 gap-4">
          <div className="max-w-2xl text-start">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
              {lang === 'fr' ? 'Catalogue & Radar National' : 'سوق الآليات وقطع الغيار بالمغرب'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
              {lang === 'fr'
                ? 'Engins et pièces disponibles immédiatement pour vos chantiers'
                : 'آليات ومعدات وقطع غيار جاهزة للانطلاق الفوري نحو ورشك'}
            </h2>
            <p className="text-xs sm:text-sm text-steel-600 mt-2 leading-relaxed">
              {lang === 'fr'
                ? 'Consultez les tarifs en Dirhams, la disponibilité du chauffeur et les garanties techniques.'
                : 'تصفح الأسعار بالدرهم، جاهزية السائق المعتمد، والتوصيل السريع إلى موقع عملك بدون عمولة.'}
            </p>
          </div>

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-bold text-ink hover:text-primary-dark transition-colors self-start md:self-auto shrink-0 pb-1 whitespace-nowrap"
          >
            <span>{lang === 'fr' ? 'Explorer tout le catalogue' : 'عرض كامل السوق والرادار'}</span>
            <ArrowIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Responsive Grid of Real Machines OR Category Directory */}
        {machines.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {machines.map((m) => {
              const cityName = m.city || getCityName(m.city_id, lang);
              const isSale = m.listing_mode === 'sale';
              const imgSrc = m.images?.[0];
              const isImgBroken = !imgSrc || failedImages[m.id];

              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-surface border border-steel-200/90 shadow-soft hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group text-start"
                >
                  {/* Image or Clean Fallback */}
                  <div className="relative aspect-[16/10] bg-ink overflow-hidden">
                    {!isImgBroken ? (
                      <img
                        src={imgSrc}
                        alt={lang === 'fr' ? m.title_fr : m.title_ar}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((prev) => ({ ...prev, [m.id]: true }))}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex flex-col items-center justify-center p-4 text-center">
                        <Truck className="w-10 h-10 text-primary mb-2" />
                        <span className="text-xs font-bold text-slate-300">
                          {m.brand} {m.model}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none" />

                    {/* Mode Label */}
                    <div className="absolute top-3 start-3">
                      <span className="px-2.5 py-1 rounded-md bg-ink/90 text-primary border border-primary/30 text-xs font-black">
                        {isSale
                          ? lang === 'fr'
                            ? 'À Vendre'
                            : 'للبيع'
                          : lang === 'fr'
                          ? 'Location'
                          : 'كراء'}
                      </span>
                    </div>

                    {/* City Overlay */}
                    <div className="absolute bottom-3 start-3 flex items-center gap-1.5 text-xs font-semibold text-white">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{cityName}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-steel-500 tracking-wider">
                        {m.brand} · {m.model} ({m.year})
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-ink mt-1 line-clamp-2 leading-snug">
                        {lang === 'fr' ? m.title_fr : m.title_ar}
                      </h3>
                    </div>

                    {/* Unboxed Addon Features */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-steel-600 font-medium my-3 pt-3 border-t border-steel-200/70">
                      {m.with_operator && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{lang === 'fr' ? 'Avec chauffeur' : 'مع سائق'}</span>
                        </span>
                      )}
                      {m.fuel_included && (
                        <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                          <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{lang === 'fr' ? 'Carburant inclus' : 'الوقود مشمول'}</span>
                        </span>
                      )}
                    </div>

                    {/* Price & Action */}
                    <div className="pt-3 border-t border-steel-200/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-steel-500 block font-medium">
                          {isSale
                            ? lang === 'fr'
                              ? 'Prix net'
                              : 'سعر البيع'
                            : lang === 'fr'
                            ? 'Tarif journalier'
                            : 'السعر اليومي'}
                        </span>
                        <div className="font-extrabold text-sm sm:text-base text-ink font-mono latin-nums">
                          {formatPriceMAD(isSale ? m.sale_price || 0 : m.rate_daily || 0)}
                          {!isSale && (
                            <span className="text-[11px] text-steel-500 font-normal">
                              {' '}
                              / {lang === 'fr' ? 'jour' : 'يوم'}
                            </span>
                          )}
                        </div>
                      </div>

                      <Link
                        to={`/marketplace/${m.id}`}
                        className="min-h-[40px] min-w-[40px] p-2.5 rounded-xl bg-ink text-primary hover:bg-steel-800 transition-colors shadow-sm flex items-center justify-center"
                        aria-label={lang === 'fr' ? 'Voir la fiche' : 'عرض التفاصيل'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categoryQuickLinks.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  to={`/marketplace?category=${cat.slug}`}
                  className="p-5 sm:p-6 rounded-2xl bg-surface border border-steel-200 shadow-soft hover:shadow-elevated hover:border-primary/60 transition-all flex flex-col justify-between text-start group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-ink text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-ink transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-steel-500">
                        {lang === 'fr' ? cat.metaFr : cat.metaAr}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-ink mb-2 leading-snug">
                      {lang === 'fr' ? cat.titleFr : cat.titleAr}
                    </h3>
                    <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
                      {lang === 'fr' ? cat.descFr : cat.descAr}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-steel-200/70 flex items-center justify-between text-xs font-bold text-ink group-hover:text-primary-dark">
                    <span>{lang === 'fr' ? 'Parcourir cette catégorie' : 'تصفح الآليات المتاحة'}</span>
                    <ArrowIcon className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Dual CTA Banners */}
        <div className="mt-10 sm:mt-12">
          <DualCtaRow />
        </div>
      </div>
    </section>
  );
};

export default MarketplacePreviewSection;
