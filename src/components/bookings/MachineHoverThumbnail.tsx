import React, { useMemo, useState } from 'react';
import { Truck, MapPin, Calendar, Tag, Banknote } from 'lucide-react';
import { Machine } from '../../types/database';
import { machineStore, resolveMachineRates } from '../../lib/machineStore';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { DRIVER_MACHINE_OPTIONS } from '../../data/driverMachines';
import { getCityById } from '../../data/cities';
import { useLanguage } from '../../hooks/useLanguage';

interface MachineHoverThumbnailProps {
  machine?: Partial<Machine> | null;
  machines?: Machine[];
  machineId?: string;
  size?: 'sm' | 'md';
}

export const MachineHoverThumbnail: React.FC<MachineHoverThumbnailProps> = ({
  machine,
  machines = [],
  machineId,
  size = 'md',
}) => {
  const { lang } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const resolvedMachine = useMemo(() => {
    const targetId = machineId || machine?.id;
    const fromPropList = targetId ? machines.find((m) => m.id === targetId) : undefined;
    const fromCache = targetId
      ? machineStore.getCachedMachines().find((m) => m.id === targetId)
      : undefined;

    const merged: Partial<Machine> = {
      ...(fromCache || {}),
      ...(fromPropList || {}),
      ...(machine || {}),
      images:
        (machine?.images && machine.images.length > 0 ? machine.images : undefined) ||
        (fromPropList?.images && fromPropList.images.length > 0 ? fromPropList.images : undefined) ||
        (fromCache?.images && fromCache.images.length > 0 ? fromCache.images : undefined) ||
        [],
    };

    return merged;
  }, [machine, machines, machineId]);

  const primaryImage = !imgError && resolvedMachine.images?.[0] ? resolvedMachine.images[0] : '';

  const machineTitle =
    (lang === 'fr' ? resolvedMachine.title_fr : resolvedMachine.title_ar) ||
    resolvedMachine.title_ar ||
    resolvedMachine.title_fr ||
    [resolvedMachine.brand, resolvedMachine.model].filter(Boolean).join(' ') ||
    (lang === 'fr' ? 'Engin JCB' : 'آلية أشغال');

  const categoryLabel = useMemo(() => {
    const rawCat = String(resolvedMachine.category || resolvedMachine.category_id || '').toLowerCase();
    if (!rawCat) return '';
    const eqCat = EQUIPMENT_CATEGORIES.find((c) => c.id === rawCat || c.slug === rawCat);
    if (eqCat) return lang === 'fr' ? eqCat.name_fr : eqCat.name_ar;
    const drvCat = DRIVER_MACHINE_OPTIONS.find((c) => c.id === rawCat);
    if (drvCat) return lang === 'fr' ? drvCat.labelFr : drvCat.labelAr;
    return rawCat;
  }, [resolvedMachine.category, resolvedMachine.category_id, lang]);

  const cityLabel = useMemo(() => {
    const rawCity = String(resolvedMachine.city || resolvedMachine.city_id || '').trim();
    if (!rawCity) return '';
    const found = getCityById(rawCity);
    if (found) return lang === 'fr' ? found.name_fr : found.name_ar;
    return rawCity;
  }, [resolvedMachine.city, resolvedMachine.city_id, lang]);

  const dailyRate = useMemo(() => {
    const rates = resolveMachineRates(resolvedMachine);
    return rates.rateDaily || 0;
  }, [resolvedMachine]);

  const brandModelYear = [
    resolvedMachine.brand,
    resolvedMachine.model,
    resolvedMachine.year ? String(resolvedMachine.year) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const boxClass = size === 'sm' ? 'w-11 h-11 rounded-xl' : 'w-12 h-12 rounded-2xl';

  return (
    <div
      className="relative shrink-0 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      {/* Compact Square Thumbnail */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsHovered((prev) => !prev);
        }}
        aria-label={machineTitle}
        className={`${boxClass} overflow-hidden border border-steel-200 bg-amber-500/10 text-primary-dark flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-110 group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/40 cursor-pointer relative`}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={machineTitle}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <Truck className="w-5 h-5" />
        )}
      </button>

      {/* Enlarged Floating Hover Card with Photo + Machine Details */}
      {isHovered && (
        <div
          role="tooltip"
          className="absolute top-full start-0 mt-2 w-64 sm:w-72 rounded-2xl bg-white border border-steel-200 shadow-2xl overflow-hidden z-50 pointer-events-none animate-fade-in text-start"
        >
          {/* Enlarged Machine Photo + Overlaid Name */}
          <div className="relative h-40 w-full bg-steel-900 overflow-hidden">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={machineTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-steel-800 to-ink text-primary/80 gap-1.5">
                <Truck className="w-10 h-10" />
                <span className="text-[10px] font-bold text-steel-300">
                  {lang === 'fr' ? 'Aucune photo disponible' : 'لا توجد صورة مرفوعة'}
                </span>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

            {categoryLabel && (
              <span className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black shadow-xs max-w-[85%] truncate">
                {categoryLabel}
              </span>
            )}

            <div className="absolute bottom-2.5 inset-x-3 text-white">
              <p className="font-black text-sm leading-snug line-clamp-1 drop-shadow-xs">
                {machineTitle}
              </p>
              {brandModelYear && (
                <p className="text-[11px] font-mono text-amber-200 truncate mt-0.5">
                  {brandModelYear}
                </p>
              )}
            </div>
          </div>

          {/* Distinguishing Machine Metadata */}
          <div className="p-3 bg-white space-y-1.5 text-[11px] text-steel-700">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {cityLabel && (
                <span className="inline-flex items-center gap-1 font-bold text-ink">
                  <MapPin className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                  <span>{cityLabel}</span>
                </span>
              )}
              {dailyRate > 0 && (
                <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {dailyRate.toLocaleString('fr-FR')} {lang === 'fr' ? 'MAD/jour' : 'د.م/يوم'}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] text-steel-500 pt-1 border-t border-steel-100">
              <span className="inline-flex items-center gap-1 truncate">
                <Tag className="w-3 h-3 text-steel-400 shrink-0" />
                <span>
                  {resolvedMachine.brand || resolvedMachine.model
                    ? `${resolvedMachine.brand || ''} ${resolvedMachine.model || ''}`.trim()
                    : machineTitle}
                </span>
              </span>
              {resolvedMachine.year && (
                <span className="inline-flex items-center gap-1 font-mono shrink-0">
                  <Calendar className="w-3 h-3 text-steel-400" />
                  <span>{resolvedMachine.year}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
