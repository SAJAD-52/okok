// ============================================================================
// JADIJCB: Public Machinery & Spare Parts Marketplace Catalog
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Map as MapIcon,
  RotateCcw,
  Truck,
  Wrench,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Tag,
  Search,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { MachineCard } from '../components/marketplace/MachineCard';
import { MarketplaceFilterBar } from '../components/marketplace/MarketplaceFilterBar';
import { MarketplaceMap } from '../components/marketplace/MarketplaceMap';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { useLanguage } from '../hooks/useLanguage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { machineStore } from '../lib/machineStore';
import { Machine } from '../types/database';

const PAGE_SIZE = 12;

export const MarketplacePage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [page, setPage] = useState(1);

  // Booking Modal State for Contractors & Mediating Owners
  const [selectedMachineForBooking, setSelectedMachineForBooking] = useState<Machine | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Read URL search params
  const sectionParam = searchParams.get('section') || (searchParams.get('category') === 'spare-parts' ? 'spare_parts' : 'all');
  const queryParam = searchParams.get('q') || searchParams.get('search') || '';
  const modeParam = searchParams.get('mode') || 'all';
  const categoryParam = searchParams.get('category') || '';
  const partTypeParam = searchParams.get('part_type') || '';
  const brandParam = searchParams.get('brand') || '';
  const cityParam = searchParams.get('city') || '';
  const maxPriceParam = Number(searchParams.get('max_price')) || null;
  const operatorParam = searchParams.get('operator') === 'true';
  const deliveryParam = searchParams.get('delivery') === 'true';
  const sortParam = searchParams.get('sort') || 'newest';

  const isSparePartsSection = sectionParam === 'spare_parts' || categoryParam === 'spare-parts';

  // Load from Supabase with range queries & merge machineStore
  const loadSupabaseMachines = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);

    let mapped: Machine[] = [];

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('machines')
          .select('*', { count: 'exact' })
          .eq('is_published', true);

        if (modeParam && modeParam !== 'all' && !isSparePartsSection) {
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
        if (!error && data) {
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
            images: m.images || [],
            specs: m.specs || {},
            views_count: m.views_count || 0,
            rating_avg: m.rating_avg || 0,
            reviews_count: m.reviews_count || 0,
            created_at: m.created_at,
            updated_at: m.created_at,
          }));
        }
      } catch (err) {
        console.warn('Marketplace load notice:', err);
      }
    }

    // Always merge real machines created by owners
    const finalMachines = machineStore.mergeMachines(mapped);
    setMachines(finalMachines);
    setIsLoading(false);
  }, [modeParam, categoryParam, cityParam, sortParam, page, isSparePartsSection]);

  useEffect(() => {
    loadSupabaseMachines();

    const handleUpdate = () => {
      loadSupabaseMachines();
    };
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
    };
  }, [loadSupabaseMachines]);

  // Section switcher
  const handleSectionSwitch = (newSection: 'all' | 'machines' | 'spare_parts') => {
    const next = new URLSearchParams(searchParams);
    next.set('section', newSection);
    if (newSection === 'spare_parts') {
      next.set('category', 'spare-parts');
      next.delete('mode'); // Parts are sale only, remove rent
      next.delete('operator');
    } else if (newSection === 'machines') {
      if (next.get('category') === 'spare-parts') {
        next.delete('category');
      }
      next.delete('part_type');
      next.delete('brand');
    } else {
      if (next.get('category') === 'spare-parts') {
        next.delete('category');
      }
      next.delete('part_type');
      next.delete('brand');
    }
    setSearchParams(next);
  };

  // Machinery vs Spare parts counts
  const sparePartsCount = useMemo(() => {
    return machines.filter((m) => m.category === 'spare-parts' || m.category_id === 'spare-parts').length;
  }, [machines]);

  const machineryCount = useMemo(() => {
    return machines.filter((m) => m.category !== 'spare-parts' && m.category_id !== 'spare-parts').length;
  }, [machines]);

  // Client-side filtering & sorting
  const filteredMachines = useMemo(() => {
    return machines.filter((item) => {
      const isItemSparePart = item.category === 'spare-parts' || item.category_id === 'spare-parts';

      // 1. Section filter
      if (isSparePartsSection) {
        if (!isItemSparePart) return false;
      } else if (sectionParam === 'machines') {
        if (isItemSparePart) return false;
      }

      // 2. Manual Name / Keyword Input Search
      if (queryParam.trim()) {
        const q = queryParam.trim().toLowerCase();
        const titleAr = (item.title_ar || '').toLowerCase();
        const titleFr = (item.title_fr || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const model = (item.model || '').toLowerCase();
        const descAr = (item.description_ar || '').toLowerCase();
        const descFr = (item.description_fr || '').toLowerCase();
        const city = (item.city || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();

        const match =
          titleAr.includes(q) ||
          titleFr.includes(q) ||
          brand.includes(q) ||
          model.includes(q) ||
          descAr.includes(q) ||
          descFr.includes(q) ||
          city.includes(q) ||
          cat.includes(q);

        if (!match) return false;
      }

      // 3. Mode filter (only for machinery, since spare parts are 100% sale)
      if (!isSparePartsSection) {
        if (modeParam === 'rent' && item.listing_mode === 'sale') return false;
        if (modeParam === 'sale' && item.listing_mode === 'rent') return false;
      }

      // 4. Category filter (standard equipment categories)
      if (!isSparePartsSection && categoryParam && categoryParam !== 'spare-parts') {
        if (item.category_id !== categoryParam && item.category !== categoryParam) {
          return false;
        }
      }

      // 5. Spare parts component type filter
      if (isSparePartsSection && partTypeParam) {
        const text = `${item.title_ar} ${item.title_fr} ${item.description_ar} ${item.description_fr}`.toLowerCase();
        if (partTypeParam === 'filters' && !text.includes('فلت') && !text.includes('filtr') && !text.includes('زيت') && !text.includes('huile')) {
          return false;
        }
        if (partTypeParam === 'hydraulic' && !text.includes('هيدروليك') && !text.includes('مضخ') && !text.includes('pomp') && !text.includes('hydraul') && !text.includes('vérin')) {
          return false;
        }
        if (partTypeParam === 'engine' && !text.includes('محرك') && !text.includes('moteur') && !text.includes('boîte') && !text.includes('transmission')) {
          return false;
        }
        if (partTypeParam === 'teeth' && !text.includes('سن') && !text.includes('dent') && !text.includes('كباش') && !text.includes('godet') && !text.includes('شفر')) {
          return false;
        }
        if (partTypeParam === 'tracks' && !text.includes('جنزير') && !text.includes('chenill') && !text.includes('عجل') && !text.includes('pneu') && !text.includes('rouleau')) {
          return false;
        }
        if (partTypeParam === 'electric' && !text.includes('كهرب') && !text.includes('électr') && !text.includes('démarreur') && !text.includes('دينامو') && !text.includes('batterie')) {
          return false;
        }
        if (partTypeParam === 'attachments' && !text.includes('brise') && !text.includes('كاسر') && !text.includes('brh') && !text.includes('tarière')) {
          return false;
        }
      }

      // 6. Compatible brand filter
      if (isSparePartsSection && brandParam) {
        const text = `${item.brand} ${item.model} ${item.title_ar} ${item.title_fr}`.toLowerCase();
        if (!text.includes(brandParam.toLowerCase())) {
          return false;
        }
      }

      // 7. City filter
      if (cityParam && !item.city?.toLowerCase().includes(cityParam.toLowerCase()) && item.city_id !== cityParam) {
        return false;
      }

      // 8. Max price
      if (maxPriceParam) {
        const itemPrice = item.listing_mode === 'sale' || isItemSparePart ? item.sale_price || 0 : item.rate_daily || 0;
        if (itemPrice > maxPriceParam) return false;
      }

      // 9. With operator (only relevant for machines)
      if (!isSparePartsSection && operatorParam && !item.with_operator) {
        return false;
      }

      // 10. Delivery available
      if (deliveryParam && !item.delivery_available) {
        return false;
      }

      return true;
    });
  }, [
    machines,
    isSparePartsSection,
    sectionParam,
    queryParam,
    modeParam,
    categoryParam,
    partTypeParam,
    brandParam,
    cityParam,
    maxPriceParam,
    operatorParam,
    deliveryParam,
  ]);

  const visibleMachines = filteredMachines;
  const hasMore = machines.length === page * PAGE_SIZE;

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
      <PublicHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header & Section Switcher */}
        <div className="space-y-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink">
                {isSparePartsSection
                  ? (lang === 'fr' ? 'Magasin des Pièces de Rechange BTP & Outillage' : 'سوق بيع قطع الغيار واللوازم الميكانيكية')
                  : t('marketplace.title')}
              </h1>
              <p className="text-xs sm:text-sm text-steel-500 mt-1">
                {isSparePartsSection
                  ? (lang === 'fr'
                      ? 'Toutes les pièces sont vendues directement pour vos chantiers (vente ferme, sans location)'
                      : 'بيع وتوريد مباشر لكافة قطع الغيار، الفلاتر، الهيدروليك وأسنان الجرافات لورشك بدون كراء')
                  : t('marketplace.subtitle')}
              </p>
            </div>

            {/* View Mode Toggle Button */}
            <div className="flex items-center bg-white p-1 rounded-2xl border border-steel-200 shadow-soft self-start sm:self-auto shrink-0">
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

          {/* Section Navigation Tabs: Machinery vs Dedicated Spare Parts */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-steel-100 rounded-2xl w-fit border border-steel-200">
            <button
              type="button"
              onClick={() => handleSectionSwitch('machines')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                sectionParam === 'machines' && !isSparePartsSection
                  ? 'bg-white text-ink shadow-sm ring-1 ring-steel-300'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              <Truck className="w-4 h-4 text-primary-dark" />
              <span>{lang === 'fr' ? 'Engins & Matériel BTP' : 'سوق الآليات والمعدات'}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-steel-200 text-steel-700">
                {machineryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionSwitch('spare_parts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                isSparePartsSection
                  ? 'bg-amber-500 text-ink shadow-sm ring-1 ring-amber-600'
                  : 'text-steel-700 hover:text-ink'
              }`}
            >
              <Wrench className="w-4 h-4 text-ink" />
              <span>{lang === 'fr' ? 'Pièces de Rechange' : 'قسم بيع قطع الغيار'}</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-ink text-primary">
                {lang === 'fr' ? 'Vente ferme' : 'بيع فقط'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-950">
                {sparePartsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionSwitch('all')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                sectionParam === 'all' && !isSparePartsSection
                  ? 'bg-white text-ink shadow-sm ring-1 ring-steel-300'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Tous les catalogues' : 'جميع العروض'}</span>
            </button>
          </div>

          {/* Spare Parts Dedicated Visual Banner */}
          {isSparePartsSection && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-steel-900 via-steel-800 to-steel-900 text-white border border-steel-700 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500 text-ink">
                      <Wrench className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      {lang === 'fr' ? 'Espace Pièces Détachées Certifiées' : 'قسم بيع وتوريد قطع الغيار المعتمدة'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {lang === 'fr'
                      ? 'Composants, pompes, moteurs et filtres neufs et d\'occasion'
                      : 'فلاتر أصلية، مضخات هيدروليكية، جنازير، أسنان كباش ومحركات مع توصيل للورش'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-steel-300">
                    {lang === 'fr'
                      ? 'Ici, toutes les pièces sont proposées à l\'achat direct (pas de location). Utilisez la recherche par nom ou référence pour trouver votre pièce.'
                      : 'في هذا القسم جميع القطع معروضة للبيع المباشر لورشك (تم استبعاد خيار الكراء لأن قطع الغيار تباع ولا تكرى).'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Vente unique sans location' : 'بيع وشراء فقط'}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Layout: Sticky Filter Sidebar on Left + Catalog/Map on Right */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sticky Desktop Filter Sidebar */}
          <MarketplaceFilterBar
            totalResults={filteredMachines.length}
            isSparePartsSection={isSparePartsSection}
          />

          {/* Catalog Container */}
          <div className="flex-1 w-full min-w-0">
            {isError ? (
              <div className="bg-white border border-red-200 rounded-3xl p-12 text-center shadow-soft">
                <AlertCircle className="w-16 h-16 text-danger mx-auto mb-3" />
                <h3 className="text-base font-black text-ink mb-1">
                  {lang === 'fr'
                    ? 'Erreur lors du chargement des annonces'
                    : 'حدث خطأ أثناء تحميل المعروضات'}
                </h3>
                <p className="text-xs text-steel-500 max-w-md mx-auto mb-6">
                  {lang === 'fr'
                    ? 'Impossible de récupérer la liste des matériels disponibles. Veuillez vérifier votre connexion.'
                    : 'تعذر الاتصال بقاعدة البيانات لجلب المعروضات المتاحة. يرجى إعادة المحاولة.'}
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
                    {isSparePartsSection ? (
                      <Wrench className="w-16 h-16 text-steel-300 mx-auto mb-3" />
                    ) : (
                      <Truck className="w-16 h-16 text-steel-300 mx-auto mb-3" />
                    )}
                    <h3 className="text-base font-black text-ink mb-1">
                      {isSparePartsSection
                        ? (lang === 'fr' ? 'Aucune pièce trouvée pour ces critères' : 'لم يتم العثور على قطع غيار تطابق هذا البحث')
                        : t('marketplace.empty_title')}
                    </h3>
                    <p className="text-xs text-steel-500 max-w-md mx-auto mb-6">
                      {isSparePartsSection
                        ? (lang === 'fr'
                            ? 'Essayez de rechercher par un mot-clé plus simple (ex: filtre, pompe, dent) ou effacez les filtres.'
                            : 'جرب البحث باسم يدوي آخر (مثل: فلتر، مضخة، أسنان) أو قم بإعادة تعيين فلاتر البحث.')
                        : t('marketplace.empty_desc')}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => {
                          const next = new URLSearchParams();
                          if (isSparePartsSection) {
                            next.set('section', 'spare_parts');
                            next.set('category', 'spare-parts');
                          }
                          setSearchParams(next);
                        }}
                        leftIcon={<RotateCcw className="w-4 h-4" />}
                        className="font-bold shadow-sm"
                      >
                        {t('marketplace.reset_filters')}
                      </Button>
                      {isSparePartsSection && (
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          onClick={() => handleSectionSwitch('machines')}
                        >
                          {lang === 'fr' ? 'Voir le parc des engins' : 'تصفح سوق الآليات'}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {visibleMachines.map((machine) => (
                        <MachineCard
                          key={machine.id}
                          machine={machine}
                          onBookClick={(m) => {
                            setSelectedMachineForBooking(m);
                            setIsBookingModalOpen(true);
                          }}
                        />
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
                            ? `Charger plus d'annonces (${filteredMachines.length - visibleMachines.length} restantes)`
                            : `تحميل المزيد من العروض (${filteredMachines.length - visibleMachines.length} متبقية)`}
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

      {/* Booking Modal for Contractors, Brokers, and Guests */}
      {isBookingModalOpen && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedMachineForBooking(null);
          }}
          machine={selectedMachineForBooking}
          machines={machines}
        />
      )}

      <Footer />
    </div>
  );
};

export default MarketplacePage;
