// ============================================================================
// JADIJCB: Public Owner Storefront Page (/s/:slug)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  ShieldCheck,
  Phone,
  MessageCircle,
  Truck,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { MachineCard } from '../components/marketplace/MachineCard';
import { useLanguage } from '../hooks/useLanguage';
import { Machine } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  const [filterMode, setFilterMode] = useState<'all' | 'rent' | 'sale'>('all');
  const [storefrontData, setStorefrontData] = useState<any>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const loadStorefront = useCallback(async () => {
    if (!isSupabaseConfigured || !slug) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      const { data: sfData, error: sfError } = await supabase
        .from('storefronts')
        .select('*, profiles(*)')
        .eq('slug', slug)
        .maybeSingle();

      if (sfError) {
        setIsError(true);
        return;
      }

      if (sfData) {
        setStorefrontData(sfData);

        // Fetch published machines for this storefront's owner
        const { data: mData, error: mError } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', sfData.owner_id)
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (!mError && mData) {
          const mapped: Machine[] = mData.map((m: any) => ({
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
            images: m.images || [],
            specs: m.specs || {},
            views_count: m.views_count || 0,
            rating_avg: m.rating_avg || 0,
            reviews_count: m.reviews_count || 0,
            created_at: m.created_at,
            updated_at: m.created_at,
          }));
          setMachines(mapped);
        }
      } else {
        // Fallback for default demo slug
        setStorefrontData({
          slug,
          about_ar: 'شركة متخصصة في كراء وبيع آليات الأشغال العمومية والترابية بالمغرب.',
          about_fr: 'Entreprise spécialisée dans la location et vente d\'engins BTP au Maroc.',
          theme_color: '#FFB400',
          banner_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1600&q=80',
          profiles: {
            company_name: 'Atlas Terrassement & Travaux S.A.R.L.',
            city: 'Casablanca',
            phone: '+212661234567',
            ice_number: '001928471000032',
          },
        });
      }
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadStorefront();
  }, [loadStorefront]);

  const company = {
    name: storefrontData?.profiles?.company_name || 'Partenaire JADIJCB',
    city: storefrontData?.profiles?.city || 'Maroc',
    ice: storefrontData?.profiles?.ice_number || '001928471000032',
    phone: storefrontData?.whatsapp || storefrontData?.profiles?.phone || '+212661234567',
    whatsapp: storefrontData?.whatsapp || storefrontData?.profiles?.phone || '+212661234567',
    banner:
      storefrontData?.banner_url ||
      'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1600&q=80',
    about_ar:
      storefrontData?.about_ar ||
      'شركة متخصصة في كراء وبيع آليات الأشغال الكبرى مع سائقين معتمدين بالمغرب.',
    about_fr:
      storefrontData?.about_fr ||
      'Entreprise spécialisée dans la mise à disposition d\'engins lourds de chantier au Maroc.',
    theme_color: storefrontData?.theme_color || '#FFB400',
  };

  const filteredMachines = machines.filter((m) => {
    if (filterMode === 'rent') return m.listing_mode === 'rent';
    if (filterMode === 'sale') return m.listing_mode === 'sale';
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 pb-16">
          <Skeleton className="h-64 w-full" />
          <div className="max-w-7xl mx-auto px-4 -mt-16 space-y-6">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 max-w-md mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-3" />
          <h2 className="text-xl font-black text-ink mb-2">
            {lang === 'fr' ? 'Vitrine introuvable' : 'تعذر تحميل المتجر'}
          </h2>
          <p className="text-xs text-steel-500 mb-6">
            {lang === 'fr'
              ? 'Impossible d\'accéder à la vitrine demandée.'
              : 'يرجى التحقق من الرابط أو إعادة المحاولة.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={loadStorefront}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
      <PublicHeader />

      <main className="flex-1 pb-16">
        {/* Full-width Branded Banner */}
        <div className="relative h-48 sm:h-64 lg:h-80 w-full overflow-hidden bg-ink">
          <img
            src={company.banner}
            alt={company.name}
            className="w-full h-full object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        </div>

        {/* Company Identity Header Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20 relative z-10 text-start">
          <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Logo & Company Name */}
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white flex items-center justify-center font-black text-ink text-2xl shadow-xl shrink-0"
                  style={{ backgroundColor: company.theme_color }}
                >
                  {company.name.slice(0, 2).toUpperCase()}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-ink">
                      {company.name}
                    </h1>
                    <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t('storefront.ice_verified')}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-steel-400" />
                      {company.city}
                    </span>
                    <span className="text-steel-400">·</span>
                    <span className="font-mono text-steel-500">ICE : {company.ice}</span>
                  </div>
                </div>
              </div>

              {/* Direct Actions: Phone + WhatsApp */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <a
                  href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${company.phone}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 bg-ink hover:bg-steel-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
                >
                  <Phone className="w-4 h-4 text-primary" />
                  <span>{t('machine_detail.call_phone')}</span>
                </a>
              </div>
            </div>
          </Card>
        </div>

        {/* Company About Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <Card className="p-6 sm:p-7 bg-white border border-steel-200 shadow-soft rounded-2xl">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider mb-2">
              {t('storefront.about_company')}
            </h2>
            <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
              {lang === 'fr' ? company.about_fr : company.about_ar}
            </p>
          </Card>
        </div>

        {/* Fleet Catalog Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink">
                {lang === 'fr' ? 'Engins au catalogue' : 'أسطول الآليات والمعدات المعروضة'}
              </h2>
              <p className="text-xs text-steel-500 mt-0.5">
                {filteredMachines.length}{' '}
                {lang === 'fr' ? 'engins disponibles actuellement' : 'آلية متاحة حالياً'}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-steel-200 shadow-soft self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-ink text-primary shadow-sm'
                    : 'text-steel-600 hover:text-ink'
                }`}
              >
                {t('machines.filter_all')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('rent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'rent'
                    ? 'bg-ink text-primary shadow-sm'
                    : 'text-steel-600 hover:text-ink'
                }`}
              >
                {t('machines.filter_rent')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('sale')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'sale'
                    ? 'bg-ink text-primary shadow-sm'
                    : 'text-steel-600 hover:text-ink'
                }`}
              >
                {t('machines.filter_sale')}
              </button>
            </div>
          </div>

          {/* Catalog Grid */}
          {filteredMachines.length === 0 ? (
            <Card className="p-12 text-center bg-white border border-steel-200 rounded-2xl">
              <Truck className="w-12 h-12 text-steel-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink mb-1">
                {lang === 'fr' ? 'Aucun engin disponible' : 'لا توجد معروضات حالياً'}
              </h3>
              <p className="text-xs text-steel-500 mb-4">
                {lang === 'fr'
                  ? 'Ce partenaire n\'a pas d\'engins publiés correspondant à ce filtre.'
                  : 'لا تتوفر آليات معروضة في هذا التصنيف حالياً.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/marketplace')}
              >
                {t('nav.marketplace')}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMachines.map((machine) => (
                <MachineCard key={machine.id} machine={machine} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PublicStorefrontPage;
