// ============================================================================
// JADIJCB: Public Machinery Marketplace Catalog
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Map as MapIcon,
  RotateCcw,
  Truck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { MachineCard } from '../components/marketplace/MachineCard';
import { MarketplaceFilterBar } from '../components/marketplace/MarketplaceFilterBar';
import { MarketplaceMap } from '../components/marketplace/MarketplaceMap';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../hooks/useLanguage';
import { Machine } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const PAGE_SIZE = 12;

export const MarketplacePage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [page, setPage] = useState(1);

  // Read URL search params
  const modeParam = searchParams.get('mode') || 'all';
  const categoryParam = searchParams.get('category') || '';
  const cityParam = searchParams.get('city') || '';
  const maxPriceParam = Number(searchParams.get('max_price')) || null;
  const conditionParam = searchParams.get('condition') || '';
  const operatorParam = searchParams.get('operator') === 'true';
  const deliveryParam = searchParams.get('delivery') === 'true';
  const sortParam = searchParams.get('sort') || 'newest';

  // Load from Supabase with range queries
  const loadSupabaseMachines = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      let query = supabase
        .from('machines')
        .select('*', { count: 'exact' })
        .eq('is_published', true);

      if (modeParam && modeParam !== 'all') {
        query = query.eq('listing_mode', modeParam);
      }
      if (categoryParam) {
        query = query.eq('category', categoryParam);
      }
      if (cityParam) {
        query = query.ilike('city', `%${cityParam}%`);
      }

      // Ordering
      if (sortParam === 'price_asc') {
        query = query.order('daily_rate', { ascending: true, nullsFirst: false });
      } else if (sortParam === 'price_desc') {
        query = query.order('daily_rate', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = 0;
      const to = page * PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) {
        setIsError(true);
        return;
      }

      if (data) {
        const mapped: Machine[] = data.map((m: any) => ({
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
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [modeParam, categoryParam, cityParam, sortParam, page]);

  useEffect(() => {
    loadSupabaseMachines();
  }, [loadSupabaseMachines]);

  // Client-side filtering & sorting
  const filteredMachines = useMemo(() => {
    return machines.filter((item) => {
      // Mode filter
      if (modeParam === 'rent' && item.listing_mode === 'sale') return false;
      if (modeParam === 'sale' && item.listing_mode === 'rent') return false;

      // Category filter
      if (categoryParam && item.category_id !== categoryParam && item.category !== categoryParam) {
        return false;
      }

      // City filter
      if (cityParam && !item.city?.toLowerCase().includes(cityParam.toLowerCase()) && item.city_id !== cityParam) {
        return false;
      }

      // Max price
      if (maxPriceParam) {
        const itemPrice = item.listing_mode === 'sale' ? item.sale_price || 0 : item.rate_daily || 0;
        if (itemPrice > maxPriceParam) return false;
      }

      // Condition
      if (conditionParam && item.condition !== conditionParam) {
        return false;
      }

      // With operator
      if (operatorParam && !item.with_operator) {
        return false;
      }

      // Delivery available
      if (deliveryParam && !item.delivery_available) {
        return false;
      }

      return true;
    });
  }, [machines, modeParam, categoryParam, cityParam, maxPriceParam, conditionParam, operatorParam, deliveryParam]);

  const visibleMachines = filteredMachines;
  const hasMore = machines.length === page * PAGE_SIZE;

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
      <PublicHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header Bar with View Toggle and Results Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink">
              {t('marketplace.title')}
            </h1>
            <p className="text-xs sm:text-sm text-steel-500 mt-1">
              {t('marketplace.subtitle')}
            </p>
          </div>

          {/* View Mode Toggle Button */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-steel-200 shadow-soft self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-ink text-primary shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t('marketplace.view_list')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-ink text-primary shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>{t('marketplace.view_map')}</span>
            </button>
          </div>
        </div>

        {/* Content Layout: Sticky Filter Sidebar on Left + Catalog/Map on Right */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sticky Desktop Filter Sidebar */}
          <MarketplaceFilterBar totalResults={filteredMachines.length} />

          {/* Catalog Container */}
          <div className="flex-1 w-full min-w-0">
            {isError ? (
              <div className="bg-white border border-red-200 rounded-3xl p-12 text-center shadow-soft">
                <AlertCircle className="w-16 h-16 text-danger mx-auto mb-3" />
                <h3 className="text-base font-black text-ink mb-1">
                  {lang === 'fr'
                    ? 'Erreur lors du chargement des engins'
                    : 'حدث خطأ أثناء تحميل آليات السوق'}
                </h3>
                <p className="text-xs text-steel-500 max-w-md mx-auto mb-6">
                  {lang === 'fr'
                    ? 'Impossible de récupérer la liste des engins disponibles. Veuillez vérifier votre connexion.'
                    : 'تعذر الاتصال بقاعدة البيانات لجلب الآليات المتاحة. يرجى إعادة المحاولة.'}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={loadSupabaseMachines}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  className="font-bold shadow-sm"
                >
                  {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
                </Button>
              </div>
            ) : viewMode === 'map' ? (
              /* Map View */
              <MarketplaceMap machines={filteredMachines} />
            ) : (
              /* Grid View */
              <>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="rounded-2xl border border-steel-200 bg-white p-4 space-y-3">
                        <Skeleton className="h-44 w-full rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : visibleMachines.length === 0 ? (
                  /* Empty State */
                  <div className="bg-white border border-steel-200 rounded-3xl p-12 text-center shadow-soft">
                    <Truck className="w-16 h-16 text-steel-300 mx-auto mb-3" />
                    <h3 className="text-base font-black text-ink mb-1">
                      {t('marketplace.empty_title')}
                    </h3>
                    <p className="text-xs text-steel-500 max-w-md mx-auto mb-6">
                      {t('marketplace.empty_desc')}
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setSearchParams(new URLSearchParams())}
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                      className="font-bold shadow-sm"
                    >
                      {t('marketplace.reset_filters')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {visibleMachines.map((machine) => (
                        <MachineCard key={machine.id} machine={machine} />
                      ))}
                    </div>

                    {/* Pagination / Load More */}
                    {hasMore && (
                      <div className="text-center pt-8">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => setPage((p) => p + 1)}
                          className="font-bold min-h-[48px] px-8 text-xs"
                          rightIcon={<ChevronDown className="w-4 h-4" />}
                        >
                          {lang === 'fr'
                            ? `Charger plus d'engins (${filteredMachines.length - visibleMachines.length} restants)`
                            : `تحميل المزيد من الآليات (${filteredMachines.length - visibleMachines.length} متبقية)`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketplacePage;
