// ============================================================================
// JADIJCB: Mobile-First Multi-Select Checklist for Moroccan Heavy Machines
// Used in AuthPage (Driver Signup), OnboardingPage, and ProfileSettingsModal
// ============================================================================

import React, { useMemo, useState } from 'react';
import { CheckSquare, Square, Search, X } from 'lucide-react';
import {
  DRIVER_MACHINE_GROUPS,
  DRIVER_MACHINE_OPTIONS,
  DriverMachineGroup,
} from '../../data/driverMachines';
import { useLanguage } from '../../hooks/useLanguage';

interface DriverMachineChecklistProps {
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  compact?: boolean;
}

export const DriverMachineChecklist: React.FC<DriverMachineChecklistProps> = ({
  selectedIds,
  onChange,
  compact = false,
}) => {
  const { lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<'all' | DriverMachineGroup>('all');

  const filteredMachines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return DRIVER_MACHINE_OPTIONS.filter((item) => {
      if (activeGroup !== 'all' && item.group !== activeGroup) return false;
      if (!q) return true;
      return (
        item.labelAr.toLowerCase().includes(q) ||
        item.labelFr.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, activeGroup]);

  const toggleMachine = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((m) => m !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Selected Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-steel-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Rechercher un engin (JCB, Pelle, Grue...)'
                : 'ابحث عن آلية (JCB، بوكلان، نيفيلوز، شارجور...)'
            }
            className="w-full ps-9 pe-8 py-2.5 rounded-xl border border-steel-300 bg-white text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[42px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 -translate-y-1/2 end-2.5 text-steel-400 hover:text-ink cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-ink shrink-0 px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200 tabular-nums text-center">
          {lang === 'fr'
            ? `${selectedIds.length} sélectionné(s)`
            : `تم اختيار: ${selectedIds.length} آلية`}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveGroup('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[36px] ${
            activeGroup === 'all'
              ? 'bg-ink text-primary'
              : 'bg-white border border-steel-200 text-steel-600 hover:text-ink'
          }`}
        >
          {lang === 'fr'
            ? `Tout (${DRIVER_MACHINE_OPTIONS.length})`
            : `كل الآليات (${DRIVER_MACHINE_OPTIONS.length})`}
        </button>

        {DRIVER_MACHINE_GROUPS.map((grp) => (
          <button
            key={grp.id}
            type="button"
            onClick={() => setActiveGroup(grp.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[36px] ${
              activeGroup === grp.id
                ? 'bg-ink text-primary'
                : 'bg-white border border-steel-200 text-steel-600 hover:text-ink'
            }`}
          >
            {lang === 'fr' ? grp.labelFr : grp.labelAr}
          </button>
        ))}
      </div>

      {/* Scrollable Checklist Grid */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pe-1 ${
          compact ? 'max-h-60' : 'max-h-72'
        }`}
      >
        {filteredMachines.length === 0 ? (
          <div className="col-span-full py-6 text-center text-xs text-steel-500">
            {lang === 'fr'
              ? 'Aucun engin ne correspond à cette recherche.'
              : 'لا توجد آلية مطابقة لهذا البحث.'}
          </div>
        ) : (
          filteredMachines.map((machine) => {
            const isChecked = selectedIds.includes(machine.id);
            return (
              <button
                key={machine.id}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggleMachine(machine.id)}
                className={`p-2.5 rounded-xl border text-start transition-all min-h-[48px] flex items-center gap-2.5 cursor-pointer ${
                  isChecked
                    ? 'bg-amber-50/70 border-primary ring-1 ring-primary text-ink'
                    : 'bg-white border-steel-200 text-steel-700 hover:border-steel-300'
                }`}
              >
                <span
                  className={`shrink-0 ${
                    isChecked ? 'text-primary-dark' : 'text-steel-400'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-ink block leading-snug">
                    {lang === 'fr' ? machine.labelFr : machine.labelAr}
                  </span>
                  <span className="text-[10px] text-steel-500 block truncate">
                    {lang === 'fr' ? machine.labelAr : machine.labelFr}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DriverMachineChecklist;
