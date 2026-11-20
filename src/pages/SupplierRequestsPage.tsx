// ============================================================================
// JADIJCB: Supplier & International Importer Requests Exchange (/supplier/requests)
// Shows live Owner search campaigns for Spare Parts & Machinery Purchase/Import,
// with filtering and a structured Quote & Proposal modal that starts chat.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Wrench,
  Ship,
  Truck,
  Phone,
  MessageSquare,
  Send,
  X,
  Loader2,
  Inbox,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  fetchOpenOwnerRequestsForSupplier,
  sendSupplierQuoteToOwner,
  startSupplierChatWithOwner,
  subscribeLocalDispatchEvents,
  SupplierOpenRequestItem,
} from '../lib/dispatchService';
import {
  IMPORT_LEAD_TIMES,
  IMPORT_ORIGIN_COUNTRIES,
  getImportCountryLabel,
  resolveSupplierScopeFromProfile,
} from '../data/supplierOptions';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatDistanceKm } from '../lib/geoUtils';
import { formatPriceMAD } from '../data/rentalTerms';
import { RequestDetailsModal } from '../components/supplier/RequestDetailsModal';

type FilterTab = 'all' | 'spare_part' | 'machine_purchase' | 'import';

export const SupplierRequestsPage: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user, profile, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const supplierId = isImpersonating ? profile?.id : user?.id || profile?.id;

  const [requests, setRequests] = useState<SupplierOpenRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const initialFilter = (searchParams.get('filter') as FilterTab) || 'all';
  const [activeTab, setActiveTab] = useState<FilterTab>(
    ['all', 'spare_part', 'machine_purchase', 'import'].includes(initialFilter)
      ? initialFilter
      : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Preview ("ألق نظرة على الطلب") & Quote modal states
  const [previewRequest, setPreviewRequest] = useState<SupplierOpenRequestItem | null>(null);
  const [startingChatCampId, setStartingChatCampId] = useState<string | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<SupplierOpenRequestItem | null>(null);
  const [priceAmount, setPriceAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'MAD' | 'EUR'>('MAD');
  const [supplySource, setSupplySource] = useState<'morocco_stock' | 'import_order'>('morocco_stock');
  const [originCountryId, setOriginCountryId] = useState<string>('europe');
  const [leadTimeLabel, setLeadTimeLabel] = useState<string>('48 ساعة (توصيل بالمغرب)');
  const [warrantyLabel, setWarrantyLabel] = useState<string>('');
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [isSendingQuote, setIsSendingQuote] = useState<boolean>(false);

  const loadRequests = useCallback(async () => {
    if (!supplierId) {
      setIsLoading(false);
      return;
    }
    setHasError(false);
    try {
      const items = await fetchOpenOwnerRequestsForSupplier(profile || { id: supplierId });
      setRequests(items);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, profile]);

  useEffect(() => {
    loadRequests();
    const unsub = subscribeLocalDispatchEvents(() => loadRequests());

    let channel: any = null;
    if (isSupabaseConfigured && supplierId) {
      channel = supabase
        .channel(`supplier_requests_${supplierId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_campaigns' }, loadRequests)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dispatch_notifications', filter: `owner_id=eq.${supplierId}` },
          loadRequests
        )
        .subscribe();
    }

    return () => {
      unsub();
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadRequests, supplierId]);

  // Auto-open request preview modal if ?campaign= is provided
  useEffect(() => {
    const campId = searchParams.get('campaign');
    if (campId && requests.length > 0 && !previewRequest && !quoteTarget) {
      const found = requests.find((r) => r.campaign_id === campId);
      if (found) setPreviewRequest(found);
    }
  }, [searchParams, requests]);

  const handleStartDirectChat = async (req: SupplierOpenRequestItem) => {
    if (!supplierId || startingChatCampId) return;
    setStartingChatCampId(req.campaign_id);
    try {
      const supplierName =
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        (lang === 'fr' ? 'Fournisseur certifié' : 'مورد معتمد');
      const { conversationId } = await startSupplierChatWithOwner({
        supplierId,
        supplierName,
        request: req,
      });
      if (conversationId) {
        navigate(
          `/supplier/messages?conv=${encodeURIComponent(conversationId)}&campaign=${encodeURIComponent(
            req.campaign_id
          )}`
        );
      } else {
        navigate(
          `/supplier/messages?target=${encodeURIComponent(
            req.contractor_id
          )}&machine=${encodeURIComponent(req.matched_machine_id || '')}&campaign=${encodeURIComponent(
            req.campaign_id
          )}`
        );
      }
    } finally {
      setStartingChatCampId(null);
    }
  };

  const openQuoteModal = (req: SupplierOpenRequestItem) => {
    setQuoteTarget(req);
    setPriceAmount(req.budget_mad ? String(req.budget_mad) : '');
    setCurrency('MAD');
    const isImp =
      req.desired_condition === 'import' ||
      resolveSupplierScopeFromProfile(profile) === 'local_and_import' ||
      Boolean(req.preferred_origin);
    setSupplySource(isImp ? 'import_order' : 'morocco_stock');
    setOriginCountryId(
      req.preferred_origin || profile?.import_countries?.[0] || 'europe'
    );
    setLeadTimeLabel(
      isImp
        ? IMPORT_LEAD_TIMES[1][lang === 'fr' ? 'labelFr' : 'labelAr']
        : lang === 'fr'
        ? '24h - 48h (Disponible au Maroc)'
        : '24 إلى 48 ساعة (متوفر بالمغرب)'
    );
    setWarrantyLabel('');
    setQuoteNotes('');
  };

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return requests.filter((r) => {
      if (activeTab === 'spare_part' && r.campaign_type !== 'spare_part') return false;
      if (activeTab === 'machine_purchase' && r.campaign_type !== 'machine_purchase') return false;
      if (activeTab === 'import' && !r.import_allowed && r.desired_condition !== 'import') {
        return false;
      }
      if (!q) return true;
      const hay = `${r.machine_name} ${r.part_reference || ''} ${r.company_name} ${r.site_city || ''} ${r.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requests, activeTab, searchTerm]);

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteTarget || !supplierId) return;

    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(
        lang === 'fr' ? 'Veuillez saisir un prix valide' : 'يرجى إدخال ثمن صحيح للعرض'
      );
      return;
    }

    setIsSendingQuote(true);
    try {
      const originLabel =
        supplySource === 'import_order' ? getImportCountryLabel(originCountryId, lang) : undefined;
      const supplierName =
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        (lang === 'fr' ? 'Fournisseur certifié' : 'مورد معتمد');

      const res = await sendSupplierQuoteToOwner({
        supplierId,
        supplierName,
        request: quoteTarget,
        priceAmount: amount,
        currency,
        supplySource,
        originCountryLabel: originLabel,
        leadTimeLabel,
        warrantyLabel: warrantyLabel.trim() || undefined,
        notes: quoteNotes.trim() || undefined,
      });

      toast.success(
        lang === 'fr'
          ? 'Devis envoyé au propriétaire avec succès !'
          : 'تم إرسال عرض السعر إلى مالك الآلية بنجاح!'
      );
      const targetContractorId = quoteTarget.contractor_id;
      const targetMachineId = quoteTarget.matched_machine_id || '';
      const campId = quoteTarget.campaign_id;
      setQuoteTarget(null);
      if (res.conversationId || targetContractorId) {
        navigate(
          `/supplier/messages?target=${targetContractorId}&machine=${targetMachineId}&campaign=${campId}`
        );
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSendingQuote(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr'
              ? 'Bourse des demandes des propriétaires'
              : 'بورصة طلبات مالكي الآليات'}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {lang === 'fr'
              ? 'Campagnes en direct pour pièces détachées, achat d’engins et importation'
              : 'حملات بحث مباشرة لقطع الغيار وشراء أو استيراد الآليات الثقيلة'}
          </p>
        </div>
        <span className="text-xs font-black text-steel-700 font-mono tabular-nums">
          {filteredRequests.length} {lang === 'fr' ? 'demande(s)' : 'طلب متاح'}
        </span>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', ar: 'الكل', fr: 'Tout', count: requests.length },
            {
              id: 'spare_part',
              ar: 'قطع الغيار',
              fr: 'Pièces',
              count: requests.filter((r) => r.campaign_type === 'spare_part').length,
            },
            {
              id: 'machine_purchase',
              ar: 'شراء آليات',
              fr: 'Achat engins',
              count: requests.filter((r) => r.campaign_type === 'machine_purchase').length,
            },
            {
              id: 'import',
              ar: 'طلبات الاستيراد',
              fr: 'Import',
              count: requests.filter((r) => r.import_allowed || r.desired_condition === 'import').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FilterTab)}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-black border transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                activeTab === tab.id
                  ? 'bg-ink text-primary border-ink'
                  : 'bg-white text-steel-700 border-steel-200 hover:bg-steel-50'
              }`}
            >
              {lang === 'fr' ? tab.fr : tab.ar} ({tab.count})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-steel-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Référence, marque, ville...'
                : 'ابحث بالمرجع، الماركة أو المدينة...'
            }
            className="w-full ps-9 pe-3 py-2.5 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
        </div>
      </div>

      {/* Feed List */}
      {hasError ? (
        <div className="bg-white border border-steel-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-black text-ink">
            {lang === 'fr' ? 'Impossible de charger les demandes' : 'تعذر تحميل الطلبات'}
          </p>
          <Button variant="outline" size="sm" onClick={loadRequests}>
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-steel-200 rounded-2xl p-10 text-center space-y-3">
          <Inbox className="w-10 h-10 text-steel-300 mx-auto" />
          <h2 className="text-sm font-black text-ink">
            {lang === 'fr'
              ? 'Aucune demande ne correspond à ce filtre'
              : 'لا توجد طلبات مطابقة لهذا التصفية حالياً'}
          </h2>
          <p className="text-xs text-steel-500">
            {lang === 'fr'
              ? 'Essayez de réinitialiser les filtres pour afficher toutes les campagnes.'
              : 'جرب إزالة الفلتر أو البحث لعرض جميع حملات مالكي الآليات.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredRequests.map((req) => {
            const isSpare = req.campaign_type === 'spare_part';
            return (
              <div
                key={req.campaign_id}
                className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
                    {isSpare ? (
                      <Wrench className="w-5 h-5" />
                    ) : req.import_allowed ? (
                      <Ship className="w-5 h-5" />
                    ) : (
                      <Truck className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-steel-500">
                        {isSpare
                          ? lang === 'fr'
                            ? 'Pièce détachée'
                            : 'قطعة غيار'
                          : lang === 'fr'
                          ? 'Achat / Import engin'
                          : 'شراء / استيراد آلية'}
                      </span>
                      {req.is_targeted && (
                        <>
                          <span className="text-steel-300">·</span>
                          <span className="text-xs font-black text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{lang === 'fr' ? 'Correspond à votre profil' : 'مطابق لتخصصك'}</span>
                          </span>
                        </>
                      )}
                      {req.import_allowed && (
                        <>
                          <span className="text-steel-300">·</span>
                          <span className="text-xs font-black text-primary-dark">
                            {lang === 'fr' ? 'Import international accepté' : 'مفتوح للاستيراد من الخارج'}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-black text-ink">
                      {req.machine_name}
                      {req.part_reference && (
                        <span dir="ltr" className="ms-2 font-mono text-sm text-primary-dark">
                          Réf: {req.part_reference}
                        </span>
                      )}
                    </h3>

                    <p className="text-xs text-steel-600 font-bold flex items-center gap-1.5 flex-wrap">
                      <span>{req.company_name}</span>
                      <span>·</span>
                      <span>{req.site_city || req.site_name}</span>
                      {req.distance_km != null && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">{formatDistanceKm(req.distance_km, lang)}</span>
                        </>
                      )}
                      {req.preferred_origin && (
                        <>
                          <span>·</span>
                          <span>{getImportCountryLabel(req.preferred_origin, lang)}</span>
                        </>
                      )}
                      {req.budget_mad ? (
                        <>
                          <span>·</span>
                          <span dir="ltr" className="font-mono tabular-nums text-ink">
                            {formatPriceMAD(req.budget_mad)}
                          </span>
                        </>
                      ) : null}
                    </p>

                    {req.notes && (
                      <p className="text-xs text-steel-500 pt-1 line-clamp-2">{req.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {req.site_phone && (
                    <a
                      href={`tel:${req.site_phone}`}
                      className="min-h-[44px] px-3 rounded-xl bg-white border border-steel-300 text-ink font-black text-xs inline-flex items-center justify-center gap-1.5 hover:bg-steel-50 whitespace-nowrap shrink-0"
                    >
                      <Phone className="w-4 h-4 text-emerald-700" />
                      <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setPreviewRequest(req)}
                    leftIcon={<Eye className="w-4 h-4" />}
                    className="min-h-[44px] font-black whitespace-nowrap shrink-0 bg-white"
                  >
                    {lang === 'fr' ? 'Voir la demande' : 'ألق نظرة على الطلب'}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={startingChatCampId === req.campaign_id}
                    onClick={() => handleStartDirectChat(req)}
                    leftIcon={
                      startingChatCampId === req.campaign_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )
                    }
                    className="min-h-[44px] font-black whitespace-nowrap shrink-0"
                  >
                    {lang === 'fr' ? 'Démarrer le chat' : 'ابدأ محادثة'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Structured Quote Modal */}
      {quoteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-steel-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-ink text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black truncate">
                  {lang === 'fr' ? 'Préparer votre offre commerciale' : 'إرسال عرض سعر منظم للمالك'}
                </h2>
                <p className="text-xs text-steel-300 truncate mt-0.5">
                  {quoteTarget.company_name} · {quoteTarget.machine_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuoteTarget(null)}
                className="min-w-[44px] min-h-[44px] rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuote} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* Price & Currency */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Prix proposé :' : 'السعر المقترح :'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    dir="ltr"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="3500"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-black bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Devise :' : 'العملة :'}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'MAD' | 'EUR')}
                    className="w-full px-3 py-2.5 text-xs font-black bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    <option value="MAD">MAD (د.م)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* Supply Source: Morocco Stock vs International Import */}
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Disponibilité & Source :' : 'التوفر ومصدر التوريد :'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSupplySource('morocco_stock');
                      setLeadTimeLabel(
                        lang === 'fr' ? '24h - 48h (Disponible au Maroc)' : '24 إلى 48 ساعة (متوفر بالمغرب)'
                      );
                    }}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                      supplySource === 'morocco_stock'
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300'
                    }`}
                  >
                    {lang === 'fr' ? 'Stock au Maroc' : 'متوفر بالمغرب'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplySource('import_order');
                      setLeadTimeLabel(
                        IMPORT_LEAD_TIMES[1][lang === 'fr' ? 'labelFr' : 'labelAr']
                      );
                    }}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                      supplySource === 'import_order'
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300'
                    }`}
                  >
                    {lang === 'fr' ? 'Importation internationale' : 'استيراد من الخارج'}
                  </button>
                </div>
              </div>

              {supplySource === 'import_order' && (
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Pays d’origine :' : 'بلد / مصدر الاستيراد :'}
                  </label>
                  <select
                    value={originCountryId}
                    onChange={(e) => setOriginCountryId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    {IMPORT_ORIGIN_COUNTRIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.flag} {lang === 'fr' ? c.nameFr : c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lead Time */}
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Délai de livraison / expédition :' : 'مدة التسليم أو الشحن :'}
                </label>
                {supplySource === 'import_order' ? (
                  <select
                    value={leadTimeLabel}
                    onChange={(e) => setLeadTimeLabel(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    {IMPORT_LEAD_TIMES.map((lt) => {
                      const val = lang === 'fr' ? lt.labelFr : lt.labelAr;
                      return (
                        <option key={lt.id} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={leadTimeLabel}
                    onChange={(e) => setLeadTimeLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  />
                )}
              </div>

              {/* Warranty & Notes */}
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Garantie (optionnel) :' : 'الضمان / شروط الاستلام (اختياري) :'}
                </label>
                <input
                  type="text"
                  value={warrantyLabel}
                  onChange={(e) => setWarrantyLabel(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex: Garantie constructeur 6 mois / Original OEM'
                      : 'مثال: ضمان 6 أشهر / أصلية OEM أو فحص قبل الأداء'
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Détails complémentaires :' : 'ملاحظات وتفاصيل العرض :'}
                </label>
                <textarea
                  rows={2}
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex: Prix HT/TTC, frais de transport inclus vers votre ville...'
                      : 'مثال: الثمن يشمل التوصيل أو التعشير بميناء طنجة المتوسط...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setQuoteTarget(null)}
                  className="min-h-[44px]"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSendingQuote}
                  leftIcon={
                    isSendingQuote ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )
                  }
                  className="min-h-[44px] font-black"
                >
                  {isSendingQuote
                    ? lang === 'fr'
                      ? 'Envoi...'
                      : 'جاري الإرسال...'
                    : lang === 'fr'
                    ? 'Envoyer & ouvrir le chat'
                    : 'إرسال العرض وفتح المحادثة'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Details Preview Modal ("ألق نظرة على الطلب") */}
      <RequestDetailsModal
        isOpen={Boolean(previewRequest)}
        request={previewRequest}
        onClose={() => setPreviewRequest(null)}
        onOpenQuoteForm={(req) => {
          setPreviewRequest(null);
          openQuoteModal(req as SupplierOpenRequestItem);
        }}
      />
    </div>
  );
};

export default SupplierRequestsPage;
