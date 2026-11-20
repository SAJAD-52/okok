// ============================================================================
// JADIJCB: Supplier & Importer Catalog Page (/supplier/catalog)
// Lets suppliers manage: 1) Spare parts, 2) Machinery for sale in Morocco,
// and 3) International import-on-order listings.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Wrench,
  Truck,
  Ship,
  Trash2,
  Eye,
  EyeOff,
  X,
  Loader2,
  Package,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine } from '../types/database';
import { EQUIPMENT_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES } from '../data/cities';
import {
  IMPORT_DELIVERY_PORTS,
  IMPORT_LEAD_TIMES,
  IMPORT_ORIGIN_COUNTRIES,
  SUPPLIER_PART_CATEGORIES,
  getImportCountryLabel,
} from '../data/supplierOptions';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { machineStore } from '../lib/machineStore';
import { formatPriceMAD } from '../data/rentalTerms';

type CatalogItemType = 'spare_part' | 'machine_sale' | 'import_order';
type CatalogFilter = 'all' | CatalogItemType;

const MACHINERY_CATS = EQUIPMENT_CATEGORIES.filter((c) => c.id !== 'spare-parts');

export const SupplierCatalogPage: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user, profile, isImpersonating } = useAuth();

  const supplierId = isImpersonating ? profile?.id : user?.id || profile?.id;

  const [items, setItems] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>('all');

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [itemType, setItemType] = useState<CatalogItemType>('spare_part');
  const [titleAr, setTitleAr] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partType, setPartType] = useState('filters');
  const [machineCat, setMachineCat] = useState('excavator');
  const [year, setYear] = useState<number>(2023);
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [salePrice, setSalePrice] = useState<string>('');
  const [cityId, setCityId] = useState<string>('casablanca');
  const [importCountry, setImportCountry] = useState<string>('europe');
  const [importLeadTime, setImportLeadTime] = useState<string>(IMPORT_LEAD_TIMES[1].id);
  const [deliveryPort, setDeliveryPort] = useState<string>(IMPORT_DELIVERY_PORTS[0].id);
  const [descriptionAr, setDescriptionAr] = useState('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadCatalog = useCallback(async () => {
    if (!supplierId) {
      setIsLoading(false);
      return;
    }
    try {
      let rows: Machine[] = [];
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', supplierId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          rows = data as Machine[];
        }
      }
      if (rows.length === 0) {
        rows = machineStore.getCachedMachines().filter((m) => m.owner_id === supplierId);
      }
      setItems(rows);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const classifyItem = (m: Machine): CatalogItemType => {
    const cat = String(m.category || m.category_id || '').toLowerCase();
    if (cat === 'spare-parts') return 'spare_part';
    if ((m.specs as any)?.is_import_order) return 'import_order';
    return 'machine_sale';
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((m) => classifyItem(m) === activeFilter);
  }, [items, activeFilter]);

  const resetForm = (nextType: CatalogItemType = 'spare_part') => {
    setItemType(nextType);
    setTitleAr('');
    setBrand('');
    setModel('');
    setPartNumber('');
    setPartType('filters');
    setMachineCat('excavator');
    setYear(2023);
    setCondition(nextType === 'spare_part' ? 'new' : 'used');
    setSalePrice('');
    setCityId('casablanca');
    setImportCountry(profile?.import_countries?.[0] || 'europe');
    setImportLeadTime(profile?.import_lead_time || IMPORT_LEAD_TIMES[1].id);
    setDeliveryPort(IMPORT_DELIVERY_PORTS[0].id);
    setDescriptionAr('');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return;

    const cleanPrice = Number(salePrice);
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
      toast.error(lang === 'fr' ? 'Veuillez saisir un prix valide' : 'يرجى إدخال ثمن صحيح');
      return;
    }

    if (itemType === 'spare_part' && !partNumber.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir le numéro de référence (Réf)'
          : 'يرجى إدخال رقم المرجع (Réf)'
      );
      return;
    }

    setIsSaving(true);
    try {
      const cityObj = MOROCCAN_CITIES.find((c) => c.id === cityId) || MOROCCAN_CITIES[0];
      const isSpare = itemType === 'spare_part';
      const isImport = itemType === 'import_order';
      const catSlug = isSpare ? 'spare-parts' : machineCat;

      const resolvedTitle =
        titleAr.trim() ||
        (isSpare
          ? `${brand.trim()} ${partNumber.trim()}`.trim()
          : `${brand.trim()} ${model.trim()}`.trim()) ||
        (isSpare ? 'قطعة غيار' : 'آلية للبيع');

      const specsPayload: Record<string, any> = isSpare
        ? {
            part_number: partNumber.trim().toUpperCase(),
            part_type: partType,
            compatible_models: model.trim(),
          }
        : {
            is_import_order: isImport,
            import_country: isImport ? importCountry : undefined,
            import_lead_time: isImport ? importLeadTime : undefined,
            delivery_port: isImport ? deliveryPort : undefined,
          };

      const newRecord: Machine = {
        id: 'mac_' + Math.random().toString(36).substring(2, 9),
        owner_id: supplierId,
        title_ar: resolvedTitle,
        title_fr: resolvedTitle,
        description_ar: descriptionAr.trim() || resolvedTitle,
        description_fr: descriptionAr.trim() || resolvedTitle,
        category: catSlug,
        category_id: catSlug,
        brand: brand.trim() || 'OEM',
        model: isSpare ? partNumber.trim().toUpperCase() : model.trim() || 'Standard',
        year: isSpare ? new Date().getFullYear() : Number(year) || 2023,
        listing_mode: 'sale',
        condition,
        city: lang === 'fr' ? cityObj.name_fr : cityObj.name_ar,
        city_id: cityObj.id,
        lat: cityObj.lat,
        lng: cityObj.lng,
        location_lat: cityObj.lat,
        location_lng: cityObj.lng,
        rate_hourly: 0,
        rate_daily: 0,
        rate_weekly: 0,
        sale_price: cleanPrice,
        currency: 'MAD',
        with_operator: false,
        fuel_included: false,
        delivery_available: true,
        status: 'available',
        is_published: true,
        images: [],
        specs: specsPayload,
        views_count: 0,
        rating_avg: 5,
        reviews_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let savedRemote: Machine | null = null;
      if (isSupabaseConfigured && user?.id) {
        const dbPayload: any = {
          owner_id: supplierId,
          title_ar: newRecord.title_ar,
          title_fr: newRecord.title_fr,
          description_ar: newRecord.description_ar,
          description_fr: newRecord.description_fr,
          category: catSlug,
          brand: newRecord.brand,
          model: newRecord.model,
          year: newRecord.year,
          listing_mode: 'sale',
          condition: newRecord.condition,
          city: newRecord.city,
          lat: newRecord.lat,
          lng: newRecord.lng,
          hourly_rate: 0,
          daily_rate: 0,
          weekly_rate: 0,
          sale_price: cleanPrice,
          with_operator: false,
          fuel_included: false,
          delivery_available: true,
          images: [],
          specs: specsPayload,
          is_published: true,
        };

        for (let attempt = 0; attempt < 10; attempt++) {
          const { data, error } = await supabase
            .from('machines')
            .insert(dbPayload)
            .select()
            .maybeSingle();
          if (!error && data) {
            savedRemote = data as Machine;
            break;
          }
          const missingCol = error?.message?.match(/Could not find the '([^']+)' column/i);
          if (missingCol && missingCol[1]) {
            delete dbPayload[missingCol[1]];
            continue;
          }
          break;
        }
      }

      machineStore.saveMachine(savedRemote || newRecord);
      toast.success(lang === 'fr' ? 'Article ajouté au catalogue' : 'تمت إضافة العرض إلى كتالوجك');
      setIsModalOpen(false);
      await loadCatalog();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (m: Machine) => {
    const next = !m.is_published;
    if (isSupabaseConfigured) {
      await supabase.from('machines').update({ is_published: next }).eq('id', m.id);
    }
    machineStore.saveMachine({ ...m, is_published: next });
    setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, is_published: next } : it)));
    toast.success(
      next
        ? lang === 'fr'
          ? 'Article publié'
          : 'تم نشر الإعلان في السوق'
        : lang === 'fr'
        ? 'Article masqué'
        : 'تم إخفاء الإعلان مؤقتاً'
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(lang === 'fr' ? 'Supprimer cet article ?' : 'هل تريد حذف هذا الإعلان؟')) return;
    if (isSupabaseConfigured) {
      await supabase.from('machines').delete().eq('id', id);
    }
    machineStore.deleteMachine(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    toast.success(lang === 'fr' ? 'Supprimé' : 'تم الحذف');
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Catalogue Ventes & Import' : 'كتالوج الآليات، قطع الغيار وعروض الاستيراد'}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {lang === 'fr'
              ? 'Gérez vos pièces détachées, engins en stock et offres d’importation sur commande'
              : 'أضف مخزونك من قطع الغيار أو الآليات المتوفرة للبيع أو عروض الاستيراد حسب الطلب'}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            resetForm('spare_part');
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          className="min-h-[44px] font-black whitespace-nowrap shrink-0"
        >
          {lang === 'fr' ? 'Nouvel article / offre' : 'إضافة عرض جديد'}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', ar: 'الكل', fr: 'Tout', count: items.length },
          {
            id: 'spare_part',
            ar: 'قطع الغيار',
            fr: 'Pièces détachées',
            count: items.filter((m) => classifyItem(m) === 'spare_part').length,
          },
          {
            id: 'machine_sale',
            ar: 'آليات للبيع بالمغرب',
            fr: 'Engins en stock',
            count: items.filter((m) => classifyItem(m) === 'machine_sale').length,
          },
          {
            id: 'import_order',
            ar: 'استيراد من الخارج',
            fr: 'Import sur commande',
            count: items.filter((m) => classifyItem(m) === 'import_order').length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id as CatalogFilter)}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-black border transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              activeFilter === tab.id
                ? 'bg-ink text-primary border-ink'
                : 'bg-white text-steel-700 border-steel-200 hover:bg-steel-50'
            }`}
          >
            {lang === 'fr' ? tab.fr : tab.ar} ({tab.count})
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-steel-200 rounded-2xl p-10 text-center space-y-3">
          <Package className="w-10 h-10 text-steel-300 mx-auto" />
          <h2 className="text-sm font-black text-ink">
            {lang === 'fr' ? 'Votre catalogue est encore vide' : 'لا توجد عروض منشورة في الكتالوج بعد'}
          </h2>
          <p className="text-xs text-steel-500 max-w-md mx-auto">
            {lang === 'fr'
              ? 'Publiez vos pièces ou engins pour apparaître automatiquement dans les campagnes de recherche des propriétaires.'
              : 'أضف أول قطعة غيار أو آلية للبيع أو عرض استيراد لتظهر تلقائياً في حملات البحث التي يطلقها الملاك.'}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              resetForm('spare_part');
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] font-black"
          >
            {lang === 'fr' ? 'Ajouter maintenant' : 'أضف أول عرض الآن'}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((m) => {
            const kind = classifyItem(m);
            const specs = (m.specs || {}) as Record<string, any>;
            return (
              <div
                key={m.id}
                className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
                    {kind === 'spare_part' ? (
                      <Wrench className="w-5 h-5" />
                    ) : kind === 'import_order' ? (
                      <Ship className="w-5 h-5" />
                    ) : (
                      <Truck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-steel-500">
                        {kind === 'spare_part'
                          ? lang === 'fr'
                            ? 'Pièce détachée'
                            : 'قطعة غيار'
                          : kind === 'import_order'
                          ? lang === 'fr'
                            ? 'Import sur commande'
                            : 'استيراد من الخارج'
                          : lang === 'fr'
                          ? 'Vente au Maroc'
                          : 'بيع بالمغرب'}
                      </span>
                      <span
                        className={`text-[11px] font-black ${
                          m.is_published !== false ? 'text-emerald-700' : 'text-steel-400'
                        }`}
                      >
                        {m.is_published !== false
                          ? lang === 'fr'
                            ? 'Publié'
                            : 'منشور'
                          : lang === 'fr'
                          ? 'Masqué'
                          : 'مخفي'}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-ink truncate mt-0.5">{m.title_ar}</h3>

                    <p className="text-xs text-steel-500 font-bold mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{m.brand}</span>
                      {specs.part_number && (
                        <>
                          <span>·</span>
                          <span dir="ltr" className="font-mono text-primary-dark">
                            Réf {specs.part_number}
                          </span>
                        </>
                      )}
                      {specs.import_country && (
                        <>
                          <span>·</span>
                          <span>{getImportCountryLabel(specs.import_country, lang)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{m.city}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-steel-100 flex items-center justify-between gap-3">
                  <span dir="ltr" className="text-base font-black text-ink font-mono tabular-nums">
                    {m.sale_price ? formatPriceMAD(m.sale_price) : '—'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(m)}
                      className="min-w-[44px] min-h-[44px] rounded-xl border border-steel-200 text-steel-600 hover:bg-steel-50 flex items-center justify-center cursor-pointer"
                      title={m.is_published !== false ? 'إخفاء' : 'نشر'}
                    >
                      {m.is_published !== false ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="min-w-[44px] min-h-[44px] rounded-xl border border-steel-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Catalog Item Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-steel-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-ink text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <h2 className="text-sm sm:text-base font-black">
                {lang === 'fr' ? 'Ajouter au catalogue fournisseur' : 'إضافة عرض جديد في الكتالوج'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* Item Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'spare_part', ar: 'قطعة غيار', fr: 'Pièce détachée' },
                  { id: 'machine_sale', ar: 'آلية بالمغرب', fr: 'Engin Maroc' },
                  { id: 'import_order', ar: 'استيراد من الخارج', fr: 'Import' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setItemType(opt.id as CatalogItemType)}
                    className={`min-h-[44px] px-2.5 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                      itemType === opt.id
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300'
                    }`}
                  >
                    {lang === 'fr' ? opt.fr : opt.ar}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Titre de l’article :' : 'عنوان العرض :'}
                </label>
                <input
                  type="text"
                  required
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder={
                    itemType === 'spare_part'
                      ? 'مثال: مضخة هيدروليك JCB 3CX أصلية'
                      : 'مثال: حفارة CAT 320D بحالة ممتازة'
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                />
              </div>

              {itemType === 'spare_part' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-ink block mb-1.5">
                      {lang === 'fr' ? 'Référence (Réf) :' : 'رقم المرجع (Réf / OEM) :'}
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                      placeholder="320/08560"
                      className="w-full px-3.5 py-2.5 text-xs font-mono font-black uppercase bg-white border border-steel-300 rounded-xl min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-ink block mb-1.5">
                      {lang === 'fr' ? 'Catégorie de pièce :' : 'صنف القطعة :'}
                    </label>
                    <select
                      value={partType}
                      onChange={(e) => setPartType(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                    >
                      {SUPPLIER_PART_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {lang === 'fr' ? c.fr : c.ar}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-ink block mb-1.5">
                      {lang === 'fr' ? 'Catégorie d’engin :' : 'صنف الآلية :'}
                    </label>
                    <select
                      value={machineCat}
                      onChange={(e) => setMachineCat(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                    >
                      {MACHINERY_CATS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {lang === 'fr' ? c.name_fr : c.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-ink block mb-1.5">
                      {lang === 'fr' ? 'Année :' : 'سنة الصنع :'}
                    </label>
                    <input
                      type="number"
                      min={1990}
                      max={2030}
                      dir="ltr"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Marque :' : 'الماركة :'}
                  </label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="JCB, CAT, Komatsu..."
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {itemType === 'spare_part'
                      ? lang === 'fr'
                        ? 'Modèles compatibles :'
                        : 'الآليات المتوافقة :'
                      : lang === 'fr'
                      ? 'Modèle :'
                      : 'الموديل :'}
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="3CX, 320D..."
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              {itemType === 'import_order' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-steel-50 border border-steel-200">
                  <div>
                    <label className="text-[11px] font-black text-ink block mb-1">
                      {lang === 'fr' ? 'Origine :' : 'بلد الاستيراد :'}
                    </label>
                    <select
                      value={importCountry}
                      onChange={(e) => setImportCountry(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[42px]"
                    >
                      {IMPORT_ORIGIN_COUNTRIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.flag} {lang === 'fr' ? c.nameFr : c.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-ink block mb-1">
                      {lang === 'fr' ? 'Délai :' : 'مدة الشحن :'}
                    </label>
                    <select
                      value={importLeadTime}
                      onChange={(e) => setImportLeadTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[42px]"
                    >
                      {IMPORT_LEAD_TIMES.map((lt) => (
                        <option key={lt.id} value={lt.id}>
                          {lang === 'fr' ? lt.labelFr : lt.labelAr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-ink block mb-1">
                      {lang === 'fr' ? 'Port :' : 'ميناء التسليم :'}
                    </label>
                    <select
                      value={deliveryPort}
                      onChange={(e) => setDeliveryPort(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[42px]"
                    >
                      {IMPORT_DELIVERY_PORTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {lang === 'fr' ? p.labelFr : p.labelAr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Prix (MAD) :' : 'الثمن (درهم) :'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    dir="ltr"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="4500"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-black bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'État :' : 'الحالة :'}
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as 'new' | 'used')}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    <option value="new">{lang === 'fr' ? 'Neuf' : 'جديد'}</option>
                    <option value="used">{lang === 'fr' ? 'Occasion' : 'مستعمل'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Ville :' : 'المدينة :'}
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    {MOROCCAN_CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'fr' ? c.name_fr : c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Description :' : 'وصف مختصر :'}
                </label>
                <textarea
                  rows={2}
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px]"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  className="min-h-[44px] font-black"
                >
                  {isSaving
                    ? lang === 'fr'
                      ? 'Enregistrement...'
                      : 'جاري الحفظ...'
                    : lang === 'fr'
                    ? 'Publier'
                    : 'نشر في الكتالوج'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierCatalogPage;
