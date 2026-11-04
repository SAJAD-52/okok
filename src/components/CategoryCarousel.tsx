import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Tractor, 
  Boxes, 
  ShieldAlert, 
  Construction, 
  Truck, 
  RotateCw, 
  Layers, 
  Zap, 
  Package, 
  Grid, 
  Wrench,
  LucideIcon 
} from 'lucide-react';
import { MACHINERY_CATEGORIES } from '../data/categories';
import { useAppStore } from '../store/useAppStore';

const iconMap: Record<string, LucideIcon> = {
  Tractor,
  Boxes,
  ShieldAlert,
  Construction,
  Truck,
  RotateCw,
  Layers,
  Zap,
  Package,
  Grid,
  Wrench,
};

export const CategoryCarousel: React.FC = () => {
  const { t } = useTranslation();
  const { language, filters, setFilter } = useAppStore();

  const handleCategoryClick = (catId: string) => {
    if (filters.categoryId === catId) {
      setFilter('categoryId', '');
    } else {
      setFilter('categoryId', catId);
    }
  };

  return (
    <section className="py-8 bg-surface border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-ink">
              {t('categories_section.title')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-muted mt-1">
              {t('categories_section.subtitle')}
            </p>
          </div>
          {filters.categoryId && (
            <button
              onClick={() => setFilter('categoryId', '')}
              className="mt-2 sm:mt-0 text-xs font-bold text-danger hover:underline self-start sm:self-auto"
            >
              {language === 'ar' ? 'عرض جميع الفئات' : 'Voir toutes les catégories'}
            </button>
          )}
        </div>

        {/* Categories scrollable carousel */}
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth">
          {MACHINERY_CATEGORIES.map((cat) => {
            const IconComponent = iconMap[cat.iconName] || Tractor;
            const isSelected = filters.categoryId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`min-h-[44px] min-w-[130px] sm:min-w-[150px] p-3.5 rounded-2xl flex flex-col items-center text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  isSelected
                    ? 'bg-ink text-white shadow-lift ring-2 ring-primary scale-105'
                    : 'bg-white hover:bg-slate-50 text-ink border border-slate-200/80 hover:border-primary/50 shadow-soft'
                }`}
              >
                <div 
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2.5 transition-colors ${
                    isSelected ? 'bg-primary text-ink' : 'bg-surface text-slate-700'
                  }`}
                >
                  <IconComponent className="w-6 h-6 stroke-[2]" />
                </div>
                <span className="text-xs sm:text-sm font-bold line-clamp-1">
                  {language === 'ar' ? cat.nameAr : cat.nameFr}
                </span>
                <span className={`text-[10px] mt-1 font-sans ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                  {cat.count} {language === 'ar' ? 'آلية' : 'engins'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
