// ============================================================================
// JADIJCB: Marketplace Filter Bar (Sticky Desktop & Mobile Bottom Sheet)
// ============================================================================

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Search,
  Check,
  Truck,
  Tag,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { MOROCCAN_CITIES } from '../../data/cities';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';

interface MarketplaceFilterBarProps {
  totalResults: number;
}

export const MarketplaceFilterBar: React.FC<MarketplaceFilterBarProps> = ({
  totalResults,
}) => {
  const { t, lang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Read current params
  const mode = searchParams.get('mode') || 'all'; // 'all' | 'rent' | 'sale'
  const category = searchParams.get('category') || '';
  const city = searchParams.get('city') || '';
  const maxPrice = Number(searchParams.get('max_price')) || (mode === 'sale' ? 1000000 : 15000);
  const condition = searchParams.get('condition') || '';
  const withOperator = searchParams.get('operator') === 'true';
  const delivery = searchParams.get('delivery') === 'true';
  const sort = searchParams.get('sort') || 'newest';

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || value === 'false') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams());
    setIsMobileDrawerOpen(false);
  };

  const activeFiltersCount = [
    mode !== 'all' ? 1 : 0,
    category ? 1 : 0,
    city ? 1 : 0,
    searchParams.has('max_price') ? 1 : 0,
    condition ? 1 : 0,
    withOperator ? 1 : 0,
    delivery ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const filterControls = (
    <div className="space-y-4 text-start">
      {/* Segmented Control: All / Rent / Buy */}
      <div>
        <label className="text-xs font-bold text-steel-700 block mb-1.5">
          {lang === 'fr' ? 'Type d\'offre :' : 'نوع العرض:'}
        </label>
        <div className="grid grid-cols-3 p-1 bg-steel-100 rounded-xl">
          <button
            type="button"
            onClick={() => updateParam('mode', 'all')}
            className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
              mode === 'all'
                ? 'bg-white text-ink shadow-sm'
                : 'text-steel-600 hover:text-ink'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            type="button"
            onClick={() => updateParam('mode', 'rent')}
            className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
              mode === 'rent'
                ? 'bg-primary text-ink shadow-sm'
                : 'text-steel-600 hover:text-ink'
            }`}
          >
            {lang === 'fr' ? 'Location' : 'كراء'}
          </button>
          <button
            type="button"
            onClick={() => updateParam('mode', 'sale')}
            className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
              mode === 'sale'
                ? 'bg-ink text-white shadow-sm'
                : 'text-steel-600 hover:text-ink'
            }`}
          >
            {lang === 'fr' ? 'Vente' : 'بيع'}
          </button>
        </div>
      </div>

      {/* Category Dropdown */}
      <div>
        <label className="text-xs font-bold text-steel-700 block mb-1">
          {t('marketplace.filter_category')}
        </label>
        <select
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
          className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t('common.all')}</option>
          {EQUIPMENT_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {lang === 'fr' ? cat.name_fr : cat.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* City Dropdown */}
      <div>
        <label className="text-xs font-bold text-steel-700 block mb-1">
          {t('marketplace.filter_city')}
        </label>
        <select
          value={city}
          onChange={(e) => updateParam('city', e.target.value)}
          className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t('common.all')}</option>
          {MOROCCAN_CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === 'fr' ? c.name_fr : c.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-steel-700 mb-1">
          <span>{mode === 'sale' ? (lang === 'fr' ? 'Budget max (MAD)' : 'أقصى سعر شراء') : t('marketplace.filter_price_max')}</span>
          <span className="font-mono font-black text-ink">
            {maxPrice.toLocaleString('fr-FR')} {t('common.mad')}
          </span>
        </div>
        <input
          type="range"
          min={mode === 'sale' ? 50000 : 500}
          max={mode === 'sale' ? 2000000 : 25000}
          step={mode === 'sale' ? 25000 : 250}
          value={maxPrice}
          onChange={(e) => updateParam('max_price', e.target.value)}
          className="w-full accent-primary cursor-pointer"
        />
      </div>

      {/* Condition (Shown especially for Sale) */}
      <div>
        <label className="text-xs font-bold text-steel-700 block mb-1.5">
          {t('machines.condition_label')}
        </label>
        <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => updateParam('condition', '')}
            className={`py-1.5 rounded-lg border min-h-[38px] cursor-pointer ${
              !condition ? 'border-primary bg-primary-100/50 text-ink' : 'border-steel-200 text-steel-600'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            type="button"
            onClick={() => updateParam('condition', 'new')}
            className={`py-1.5 rounded-lg border min-h-[38px] cursor-pointer ${
              condition === 'new' ? 'border-primary bg-primary-100/50 text-ink' : 'border-steel-200 text-steel-600'
            }`}
          >
            {t('machines.condition_new')}
          </button>
          <button
            type="button"
            onClick={() => updateParam('condition', 'good')}
            className={`py-1.5 rounded-lg border min-h-[38px] cursor-pointer ${
              condition === 'good' ? 'border-primary bg-primary-100/50 text-ink' : 'border-steel-200 text-steel-600'
            }`}
          >
            {t('machines.condition_used')}
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2 pt-2 border-t border-steel-200">
        <label className="flex items-center justify-between text-xs font-bold text-steel-700 cursor-pointer">
          <span>{t('marketplace.filter_operator')}</span>
          <input
            type="checkbox"
            checked={withOperator}
            onChange={(e) => updateParam('operator', e.target.checked ? 'true' : null)}
            className="w-5 h-5 accent-primary cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between text-xs font-bold text-steel-700 cursor-pointer">
          <span>{t('marketplace.filter_delivery')}</span>
          <input
            type="checkbox"
            checked={delivery}
            onChange={(e) => updateParam('delivery', e.target.checked ? 'true' : null)}
            className="w-5 h-5 accent-primary cursor-pointer"
          />
        </label>
      </div>

      {/* Sort By Dropdown */}
      <div>
        <label className="text-xs font-bold text-steel-700 block mb-1">
          {t('marketplace.sort_by')}
        </label>
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
        >
          <option value="newest">{t('marketplace.sort_newest')}</option>
          <option value="price_asc">{t('marketplace.sort_price_asc')}</option>
          <option value="price_desc">{t('marketplace.sort_price_desc')}</option>
          <option value="nearest">{lang === 'fr' ? 'Plus proches de mon chantier' : 'الأقرب إلى موقع الورش'}</option>
        </select>
      </div>

      {/* Reset CTA */}
      {activeFiltersCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetFilters}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          className="w-full justify-center text-xs font-bold"
        >
          {t('marketplace.reset_filters')}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar Filter Bar */}
      <div className="hidden lg:block w-72 shrink-0 sticky top-20 bg-white border border-steel-200 rounded-2xl p-5 shadow-soft">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-steel-200">
          <div className="flex items-center gap-2 font-black text-sm text-ink">
            <SlidersHorizontal className="w-4 h-4 text-primary-dark" />
            <span>{lang === 'fr' ? 'Filtres de recherche' : 'فلاتر البحث'}</span>
          </div>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-ink text-[11px] font-black flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {filterControls}
      </div>

      {/* Mobile Floating Bottom Sheet Bar */}
      <div className="lg:hidden fixed bottom-16 inset-x-4 z-40">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="w-full bg-ink text-white py-3.5 px-4 rounded-2xl shadow-elevated flex items-center justify-between font-bold text-xs border border-steel-700 cursor-pointer min-h-[48px]"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span>{lang === 'fr' ? 'Filtrer et trier' : 'تصفية وترتيب الآليات'}</span>
          </span>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black">
                {activeFiltersCount}
              </span>
            )}
            <span className="text-steel-400 font-mono">({totalResults})</span>
          </div>
        </button>
      </div>

      {/* Mobile Bottom Sheet Modal / Drawer */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-ink/75 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl border-t-2 border-primary">
            <div className="flex items-center justify-between pb-3 border-b border-steel-200">
              <div className="flex items-center gap-2 font-black text-sm text-ink">
                <SlidersHorizontal className="w-4 h-4 text-primary-dark" />
                <span>{lang === 'fr' ? 'Filtres de recherche' : 'فلاتر البحث'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-lg bg-steel-100 flex items-center justify-center text-steel-500 hover:text-ink cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {filterControls}

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="w-full justify-center font-black min-h-[48px]"
              >
                {lang === 'fr' ? `Afficher (${totalResults}) résultats` : `عرض النتائج (${totalResults})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MarketplaceFilterBar;
