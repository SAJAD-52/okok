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
import { machineStore, resolveMachineRates } from '../lib/machineStore';
import { MOROCCAN_CITIES, getCityById } from '../data/cities';
import { calculateDistanceKm } from '../lib/geoUtils';
import { Machine } from '../types/database';

const PAGE_SIZE = 8;
let marketplaceOwnerJoinSupported = true;

export const MarketplacePage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [totalRemoteCount, setTotalRemoteCount] = useState<number>(0);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');
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

  // Reset pagination when primary remote query filters change
  useEffect(() => {
    setPage(1);
  }, [sectionParam, modeParam, categoryParam, cityParam, sortParam]);

  // Request user geolocation lazily only when sorting by nearest
  useEffect(() => {
    if (sortParam !== 'nearest' || userCoords) return;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          const fallbackCity = getCityById(cityParam) || getCityById('casablanca');
          if (fallbackCity) setUserCoords({ lat: fallbackCity.lat, lng: fallbackCity.lng });
        },
        { timeout: 4000, maximumAge: 300000 }
      );
    }
  }, [sortParam, userCoords, cityParam]);

  const mapSupabaseMachine = useCallback((m: any): Machine => {
    const rawCity = String(m.city || '').trim();
    const matchedCity = MOROCCAN_CITIES.find(
      (c) =>
        c.id.toLowerCase() === rawCity.toLowerCase() ||
        c.name_ar === rawCity ||
        c.name_fr.toLowerCase() === rawCity.toLowerCase()
    );
    return {
      id: m.id,
      owner_id: m.owner_id,
      owner: m.profiles || undefined,
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
      city_id: matchedCity?.id || m.city,
      lat: m.lat ?? matchedCity?.lat,
      lng: m.lng ?? matchedCity?.lng,
      location_lat: m.lat ?? matchedCity?.lat,
      location_lng: m.lng ?? matchedCity?.lng,
      ...(() => {
        const rates = resolveMachineRates(m);
        return {
          rate_hourly: rates.rateHourly,
          rate_daily: rates.rateDaily,
          rate_weekly: rates.rateWeekly,
          hourly_rate: rates.rateHourly,
          daily_rate: rates.rateDaily,
          weekly_rate: rates.rateWeekly,
          sale_price: rates.salePrice,
        };
      })(),
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
    };
  }, []);

  // Load from Supabase with range queries & merge machineStore
  const loadSupabaseMachines = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);

    let mapped: Machine[] = [];
    let remoteCount = 0;

    try {
      if (isSupabaseConfigured) {
        const buildQuery = (withOwnerJoin: boolean) => {
          const selectStr = withOwnerJoin
            ? '*, profiles:owner_id(full_name, company_name, phone, city)'
            : '*';
          let query = supabase
            .from('machines')
            .select(selectStr, { count: 'estimated' })
            .eq('is_published', true);

          if (isSparePartsSection) {
            query = query.eq('category', 'spare-parts');
          } else {
            if (modeParam && modeParam !== 'all') {
              query = query.eq('listing_mode', modeParam);
            }
            if (categoryParam) {
              query = query.eq('category', categoryParam);
            }
          }

          if (cityParam) {
            const cityObj = getCityById(cityParam);
            if (cityObj) {
              query = query.or(
                `city.ilike.%${cityObj.id}%,city.ilike.%${cityObj.name_ar}%,city.ilike.%${cityObj.name_fr}%`
              );
            } else {
              query = query.ilike('city', `%${cityParam}%`);
            }
          }

          if (sortParam === 'price_asc') {
            const orderCol = isSparePartsSection || modeParam === 'sale' ? 'sale_price' : 'daily_rate';
            query = query.order(orderCol, { ascending: true, nullsFirst: false });
          } else if (sortParam === 'price_desc') {
            const orderCol = isSparePartsSection || modeParam === 'sale' ? 'sale_price' : 'daily_rate';
            query = query.order(orderCol, { ascending: false, nullsFirst: false });
          } else {
            query = query.order('created_at', { ascending: false });
          }

          const from = 0;
          const to = page * PAGE_SIZE - 1;
          return query.range(from, to);
        };

        let { data, count, error } = await buildQuery(marketplaceOwnerJoinSupported);
        if (error && marketplaceOwnerJoinSupported) {
          // Remember FK join isn't available so future queries don't trigger 400s
          marketplaceOwnerJoinSupported = false;
          const fallback = await buildQuery(false);
          data = fallback.data;
          count = fallback.count;
          error = fallback.error;
        }

        if (error) {
          console.warn('Marketplace query failed:', error.message);
          setErrorDetail(error.message || error.code || 'Unknown error');
          const cachedFallback = machineStore.mergeMachines([]);
          if (cachedFallback.length > 0) {
            setMachines(cachedFallback);
            setTotalRemoteCount(cachedFallback.length);
            return;
          }
          setIsError(true);
          return;
        }

        if (data) {
          setErrorDetail('');
          mapped = data.map(mapSupabaseMachine);
          remoteCount = typeof count === 'number' ? count : data.length;
        }
      }

      // Merge real locally saved machines when Supabase doesn't already include them
      const finalMachines = machineStore.mergeMachines(mapped);
      setMachines(finalMachines);
      setTotalRemoteCount(Math.max(remoteCount, finalMachines.length));
    } catch (err: any) {
      console.warn('Marketplace load error:', err);
      setErrorDetail(err?.message || 'Network exception');
      const cachedFallback = machineStore.mergeMachines([]);
      if (cachedFallback.length > 0) {
        setMachines(cachedFallback);
        setTotalRemoteCount(cachedFallback.length);
      } else {
        setIsError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [modeParam, categoryParam, cityParam, sortParam, page, isSparePartsSection, mapSupabaseMachine]);

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

      // 7. City filter (matches slug ID, Arabic name, and French name)
      if (cityParam) {
        const cityObj = getCityById(cityParam);
        const itemCityLower = (item.city || '').toLowerCase();
        const itemCityIdLower = (item.city_id || '').toLowerCase();
        const paramLower = cityParam.toLowerCase();
        const matchesCity = cityObj
          ? itemCityIdLower === cityObj.id ||
            itemCityLower.includes(cityObj.id) ||
            itemCityLower.includes(cityObj.name_ar.toLowerCase()) ||
            itemCityLower.includes(cityObj.name_fr.toLowerCase())
          : itemCityLower.includes(paramLower) || itemCityIdLower === paramLower;
        if (!matchesCity) {
          return false;
        }
      }

      // 8. Max price
      if (maxPriceParam) {
        const rates = resolveMachineRates(item);
        const itemPrice = item.listing_mode === 'sale' || isItemSparePart ? rates.salePrice : rates.rateDaily;
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
    }).sort((a, b) => {
      const priceOf = (item: Machine) => {
        const isPart = item.category === 'spare-parts' || item.category_id === 'spare-parts';
        const rates = resolveMachineRates(item);
        return item.listing_mode === 'sale' || isPart ? rates.salePrice : rates.rateDaily;
      };

      if (sortParam === 'price_asc') {
        const pa = priceOf(a) || Number.MAX_SAFE_INTEGER;
        const pb = priceOf(b) || Number.MAX_SAFE_INTEGER;
        return pa - pb;
      }
      if (sortParam === 'price_desc') {
        return priceOf(b) - priceOf(a);
      }
      if (sortParam === 'nearest') {
        const origin = userCoords || { lat: 33.5731, lng: -7.5898 };
        const da = calculateDistanceKm(origin.lat, origin.lng, a.lat || a.location_lat || 33.5731, a.lng || a.location_lng || -7.5898);
        const db = calculateDistanceKm(origin.lat, origin.lng, b.lat || b.location_lat || 33.5731, b.lng || b.location_lng || -7.5898);
        return da - db;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
    sortParam,
    userCoords,
  ]);

  const visibleMachines = filteredMachines;
  const remainingRemote = Math.max(0, totalRemoteCount - page * PAGE_SIZE);
  const hasMore = remainingRemote > 0;

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
                <p className="text-xs text-steel-500 max-w-md mx-auto mb-3">
                  {lang === 'fr'
                    ? 'Impossible de récupérer la liste des matériels disponibles. Veuillez vérifier votre connexion.'
                    : 'تعذر الاتصال بقاعدة البيانات لجلب المعروضات المتاحة. يرجى إعادة المحاولة.'}
                </p>
                {errorDetail && (
                  <div className="mb-5">
                    <p dir="ltr" className="text-[11px] font-mono text-red-700/80 bg-red-50 inline-block px-3 py-1 rounded-lg max-w-md break-all">
                      {errorDetail}
                    </p>
                  </div>
                )}
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
                            ? `Charger plus d'annonces (${remainingRemote} restantes)`
                            : `تحميل المزيد من العروض (${remainingRemote} متبقية)`}
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
