import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Filter, 
  RotateCcw, 
  LayoutGrid, 
  Map as MapIcon, 
  UserCheck, 
  Truck, 
  CheckCircle,
  ArrowUpDown 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MOROCCAN_CITIES } from '../data/cities';

interface FilterBarProps {
  viewMode: 'grid' | 'map';
  setViewMode: (mode: 'grid' | 'map') => void;
  resultsCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  viewMode,
  setViewMode,
  resultsCount,
}) => {
  const { t, i18n } = useTranslation();
  const { language, filters, setFilter, resetFilters } = useAppStore();

  const brands = ['JCB', 'Caterpillar', 'Komatsu', 'Liebherr', 'Mercedes-Benz', 'Bomag', 'Atlas Copco'];

  return (
    <div className="bg-white border-y border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mb-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Top row: Results Count + Quick Toggles + View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm sm:text-base font-extrabold text-ink">
              {t('filters.results_count', { count: resultsCount })}
            </span>
            {(filters.categoryId || filters.cityId || filters.brand || filters.searchQuery || filters.type !== 'all' || filters.withOperatorOnly || filters.deliveryAvailableOnly) && (
              <button
                onClick={resetFilters}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-danger bg-danger/10 hover:bg-danger/20 rounded-xl transition-colors"
                title={t('filters.reset')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('filters.reset')}</span>
              </button>
            )}
          </div>

          {/* View Mode Toggle (Grid vs Map) */}
          <div className="flex items-center gap-2">
            <div className="bg-surface p-1 rounded-xl border border-slate-200 flex items-center">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
                  viewMode === 'grid'
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-slate-600 hover:text-ink'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">{t('filters.view_grid')}</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
                  viewMode === 'map'
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-slate-600 hover:text-ink'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('filters.view_map')}</span>
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilter('sortBy', e.target.value as any)}
                className="min-h-[44px] ps-8 pe-4 py-2 bg-surface text-ink text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="newest">{t('filters.sort_newest')}</option>
                <option value="price_asc">{t('filters.sort_price_asc')}</option>
                <option value="price_desc">{t('filters.sort_price_desc')}</option>
                <option value="rating">{t('filters.sort_rating')}</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bottom row: Filter Chips & Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {/* Brand Filter */}
          <select
            value={filters.brand}
            onChange={(e) => setFilter('brand', e.target.value)}
            className="min-h-[40px] px-3 py-1.5 bg-surface text-ink text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="">{t('filters.all_brands')}</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* City Filter */}
          <select
            value={filters.cityId}
            onChange={(e) => setFilter('cityId', e.target.value)}
            className="min-h-[40px] px-3 py-1.5 bg-surface text-ink text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="">{t('hero.all_cities')}</option>
            {MOROCCAN_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {language === 'ar' ? c.nameAr : c.nameFr}
              </option>
            ))}
          </select>

          {/* Checkbox Chip: With Operator */}
          <button
            type="button"
            onClick={() => setFilter('withOperatorOnly', !filters.withOperatorOnly)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              filters.withOperatorOnly
                ? 'bg-primary text-ink border-primary font-black shadow-sm'
                : 'bg-surface text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{t('filters.with_operator')}</span>
          </button>

          {/* Checkbox Chip: Delivery Available */}
          <button
            type="button"
            onClick={() => setFilter('deliveryAvailableOnly', !filters.deliveryAvailableOnly)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              filters.deliveryAvailableOnly
                ? 'bg-primary text-ink border-primary font-black shadow-sm'
                : 'bg-surface text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{t('filters.delivery_available')}</span>
          </button>

          {/* Checkbox Chip: Verified Owners Only */}
          <button
            type="button"
            onClick={() => setFilter('verifiedOwnersOnly', !filters.verifiedOwnersOnly)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              filters.verifiedOwnersOnly
                ? 'bg-primary text-ink border-primary font-black shadow-sm'
                : 'bg-surface text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-success" />
            <span>{t('filters.verified_only')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
