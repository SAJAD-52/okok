import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  MapPin,
  List,
  Map as MapIcon,
  RotateCcw,
  Star,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useLanguage } from '../hooks/useLanguage';
import { EQUIPMENT_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES } from '../data/cities';
import { MOCK_MACHINES } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';

// Lazy-loaded or conditional map rendering
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default leaflet marker icon in bundlers
const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const MarketplacePage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Search & Filters from URL or state
  const selectedCategory = searchParams.get('category') || '';
  const selectedCity = searchParams.get('city') || '';
  const filterOperator = searchParams.get('operator') === 'true';
  const sort = searchParams.get('sort') || 'newest';
  const maxPriceParam = Number(searchParams.get('maxPrice')) || 10000;
  const searchQuery = searchParams.get('q') || '';

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'false') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Filter machines
  const filteredMachines = useMemo(() => {
    return MOCK_MACHINES.filter((machine) => {
      if (selectedCategory && machine.category_id !== selectedCategory) {
        return false;
      }
      if (selectedCity && machine.city_id !== selectedCity) {
        return false;
      }
      if (filterOperator && !machine.with_operator) {
        return false;
      }
      if (machine.rate_daily > maxPriceParam) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = (lang === 'fr' ? machine.title_fr : machine.title_ar).toLowerCase();
        const brand = machine.brand.toLowerCase();
        const model = machine.model.toLowerCase();
        if (!title.includes(q) && !brand.includes(q) && !model.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sort === 'price_asc') return a.rate_daily - b.rate_daily;
      if (sort === 'price_desc') return b.rate_daily - a.rate_daily;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [selectedCategory, selectedCity, filterOperator, maxPriceParam, searchQuery, sort, lang]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicHeader />

      {/* Header Banner */}
      <section className="bg-ink text-white py-8 border-b border-steel-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-start">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
            {t('marketplace.title')}
          </h1>
          <p className="text-xs sm:text-sm text-steel-400 mt-1">
            {t('marketplace.subtitle')}
          </p>
        </div>
      </section>

      {/* Main Filter & Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col">
        {/* Controls Bar: Search, View Switcher & Sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-white p-3.5 rounded-2xl border border-steel-200 shadow-soft">
          {/* Text Search */}
          <div className="flex-1">
            <Input
              placeholder={lang === 'fr' ? 'Rechercher par modèle (JCB 3CX, CAT...)' : 'ابحث بالموديل (JCB 3CX, CAT...)'}
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              startIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Mobile Filter Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className="lg:hidden"
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Filtres' : 'تصفية'}
            </Button>

            {/* Sort Select */}
            <div className="w-44">
              <Select
                options={[
                  { value: 'newest', label: t('marketplace.sort_newest') },
                  { value: 'price_asc', label: t('marketplace.sort_price_asc') },
                  { value: 'price_desc', label: t('marketplace.sort_price_desc') },
                ]}
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
              />
            </div>

            {/* Grid / Map Switcher */}
            <div className="flex items-center p-1 bg-steel-100 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-steel-600 hover:text-ink'
                }`}
                aria-label={t('marketplace.view_list')}
                title={t('marketplace.view_list')}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`p-2 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  viewMode === 'map'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-steel-600 hover:text-ink'
                }`}
                aria-label={t('marketplace.view_map')}
                title={t('marketplace.view_map')}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Layout: Sidebar Filters + Products Grid / Map */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Desktop Filter Sidebar */}
          <aside
            className={`bg-white p-5 rounded-2xl border border-steel-200 shadow-soft text-start space-y-5 ${
              isFilterDrawerOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-steel-100">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                {lang === 'fr' ? 'Filtres de recherche' : 'خيارات التصفية'}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('marketplace.reset_filters')}</span>
              </button>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-2">
                {t('marketplace.filter_category')}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => updateParam('category', e.target.value)}
                className="w-full min-h-[44px] bg-surface border border-steel-200 rounded-xl px-3 text-xs font-medium text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('common.all')}</option>
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-2">
                {t('marketplace.filter_city')}
              </label>
              <select
                value={selectedCity}
                onChange={(e) => updateParam('city', e.target.value)}
                className="w-full min-h-[44px] bg-surface border border-steel-200 rounded-xl px-3 text-xs font-medium text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('common.all')}</option>
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-bold text-steel-700">
                  {t('marketplace.filter_price_max')}
                </span>
                <span className="font-bold font-mono text-ink latin-nums">
                  {formatPriceMAD(maxPriceParam, lang)}
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="10000"
                step="200"
                value={maxPriceParam}
                onChange={(e) => updateParam('maxPrice', e.target.value)}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-steel-100 space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs text-steel-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOperator}
                  onChange={(e) => updateParam('operator', String(e.target.checked))}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <span className="font-medium">{t('marketplace.filter_operator')}</span>
              </label>
            </div>
          </aside>

          {/* Results Area */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between text-xs text-steel-500 text-start">
              <span>
                <strong className="text-ink font-bold font-mono latin-nums">
                  {filteredMachines.length}
                </strong>{' '}
                {t('marketplace.results_count')}
              </span>
            </div>

            {/* View Mode: Map */}
            {viewMode === 'map' ? (
              <div className="w-full h-[540px] rounded-2xl overflow-hidden border border-steel-200 shadow-soft relative">
                <MapContainer
                  center={[31.7917, -7.0926]} // Center of Morocco
                  zoom={6}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filteredMachines.map((m) => (
                    <Marker
                      key={m.id}
                      position={[m.location_lat, m.location_lng]}
                      icon={customMarkerIcon}
                    >
                      <Popup>
                        <div className="text-start p-1 max-w-[200px]">
                          <p className="font-bold text-xs text-ink line-clamp-1">
                            {lang === 'fr' ? m.title_fr : m.title_ar}
                          </p>
                          <p className="text-[11px] font-bold text-primary-dark mt-1 font-mono latin-nums">
                            {formatPriceMAD(m.rate_daily, lang)} / {lang === 'fr' ? 'jour' : 'يوم'}
                          </p>
                          <button
                            onClick={() => navigate(`/marketplace/${m.id}`)}
                            className="mt-2 w-full py-1 text-center bg-primary text-ink font-bold text-[10px] rounded"
                          >
                            {t('marketplace.view_details')}
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            ) : (
              /* View Mode: Grid */
              <div>
                {filteredMachines.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-2xl border border-steel-200">
                    <p className="text-base font-bold text-ink">
                      {t('marketplace.empty_title')}
                    </p>
                    <p className="text-xs text-steel-500 mt-1">
                      {t('marketplace.empty_desc')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="mt-4"
                    >
                      {t('marketplace.reset_filters')}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredMachines.map((machine) => {
                      const city = MOROCCAN_CITIES.find((c) => c.id === machine.city_id);

                      return (
                        <Card
                          key={machine.id}
                          hoverEffect
                          className="p-0 overflow-hidden flex flex-col justify-between"
                        >
                          <div className="relative aspect-video w-full bg-steel-100">
                            <img
                              src={machine.images[0]}
                              alt={lang === 'fr' ? machine.title_fr : machine.title_ar}
                              className="w-full h-full object-cover"
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

                          <div className="p-5 flex-1 flex flex-col justify-between text-start">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs text-steel-500 mb-1.5">
                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>
                                  {city ? (lang === 'fr' ? city.name_fr : city.name_ar) : machine.city_id}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="latin-nums">{machine.year}</span>
                              </div>
                              <h3 className="text-sm font-bold text-ink line-clamp-2">
                                {lang === 'fr' ? machine.title_fr : machine.title_ar}
                              </h3>
                            </div>

                            <div className="pt-4 mt-4 border-t border-steel-100 flex items-center justify-between gap-2">
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MarketplacePage;
