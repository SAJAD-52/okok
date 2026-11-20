// ============================================================================
// JADIJCB: Supplier & International Importer Overview Dashboard (/supplier)
// Connects Machinery Dealers, Spare Parts Suppliers, and Import Companies
// directly with Equipment Owners launching urgent search & purchase campaigns.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Ship,
  Wrench,
  MessageSquare,
  ArrowUpRight,
  Globe,
  MapPin,
  Inbox,
  Plus,
  Truck,
  Building2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine } from '../types/database';
import {
  fetchOpenOwnerRequestsForSupplier,
  subscribeLocalDispatchEvents,
  SupplierOpenRequestItem,
} from '../lib/dispatchService';
import { getImportCountryLabel, getSupplierTypeOption } from '../data/supplierOptions';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { machineStore } from '../lib/machineStore';
import { formatDistanceKm } from '../lib/geoUtils';
import { formatPriceMAD } from '../data/rentalTerms';

export const SupplierDashboardPage: React.FC = () => {
  const { lang } = useLanguage();
  const { user, profile, isImpersonating } = useAuth();
  const navigate = useNavigate();

  const supplierId = isImpersonating ? profile?.id : user?.id || profile?.id;

  const [requests, setRequests] = useState<SupplierOpenRequestItem[]>([]);
  const [catalog, setCatalog] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const loadDashboard = useCallback(async () => {
    if (!supplierId) {
      setIsLoading(false);
      return;
    }

    setHasError(false);
    try {
      const [openReqs, catalogRes] = await Promise.all([
        fetchOpenOwnerRequestsForSupplier(profile || { id: supplierId }),
        isSupabaseConfigured
          ? supabase
              .from('machines')
              .select('*')
              .eq('owner_id', supplierId)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ]);

      setRequests(openReqs);

      if (catalogRes.data && catalogRes.data.length > 0) {
        setCatalog(catalogRes.data as Machine[]);
      } else {
        setCatalog(machineStore.getCachedMachines().filter((m) => m.owner_id === supplierId));
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, profile]);

  useEffect(() => {
    loadDashboard();
    const unsubLocal = subscribeLocalDispatchEvents(() => loadDashboard());
    window.addEventListener('jadijcb_machines_updated', loadDashboard);

    let channel: any = null;
    if (isSupabaseConfigured && supplierId) {
      channel = supabase
        .channel(`supplier_dash_${supplierId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_campaigns' }, loadDashboard)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dispatch_notifications', filter: `owner_id=eq.${supplierId}` },
          loadDashboard
        )
        .subscribe();
    }

    return () => {
      unsubLocal();
      window.removeEventListener('jadijcb_machines_updated', loadDashboard);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadDashboard, supplierId]);

  const supplierTypeOpt = getSupplierTypeOption(profile?.supplier_type);
  const spareReqCount = requests.filter((r) => r.campaign_type === 'spare_part').length;
  const purchaseReqCount = requests.filter((r) => r.campaign_type === 'machine_purchase').length;
  const importReqCount = requests.filter((r) => r.import_allowed || r.desired_condition === 'import').length;

  const isImporter =
    profile?.supplier_type === 'importer' ||
    profile?.supplier_type === 'all' ||
    (profile?.import_countries && profile.import_countries.length > 0);

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-ink truncate">
            {profile?.company_name || profile?.full_name || (lang === 'fr' ? 'Espace Fournisseur' : 'بوابة الموردين والاستيراد')}
          </h1>
          <p className="text-xs text-steel-500 font-bold mt-1 flex items-center gap-2 flex-wrap">
            <span>{lang === 'fr' ? supplierTypeOpt.shortFr : supplierTypeOpt.shortAr}</span>
            <span>·</span>
            <span>{profile?.city || 'المغرب'}</span>
            {profile?.delivers_nationwide !== false && (
              <>
                <span>·</span>
                <span>{lang === 'fr' ? 'Livraison tout le Maroc' : 'تغطية وطنية لكل المدن'}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/supplier/catalog')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] font-black whitespace-nowrap shrink-0 bg-white"
          >
            {lang === 'fr' ? 'Ajouter au catalogue' : 'إضافة آلية أو قطعة'}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/supplier/requests')}
            leftIcon={<Inbox className="w-4 h-4" />}
            className="min-h-[44px] font-black whitespace-nowrap shrink-0"
          >
            {lang === 'fr' ? 'Voir toutes les demandes' : 'تصفح طلبات الملاك'}
          </Button>
        </div>
      </div>

      {/* Importer / Specialization Banner */}
      {isImporter && (
        <div className="bg-ink text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white">
                {lang === 'fr'
                  ? 'Réseau Importation Internationale activé'
                  : 'ربط مباشر مع طلبات الاستيراد من الخارج'}
              </h2>
              <p className="text-xs text-steel-300 mt-0.5 leading-relaxed">
                {profile?.import_countries && profile.import_countries.length > 0
                  ? profile.import_countries.map((c) => getImportCountryLabel(c, lang)).join(' · ')
                  : lang === 'fr'
                  ? 'Europe, Chine, Turquie & Golfe — recevez les commandes d’import des propriétaires marocains.'
                  : 'أوروبا، الصين، تركيا والخليج — تصلك مباشرة حملات الملاك الباحثين عن استيراد آليات أو قطع نادرة.'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/supplier/requests?filter=import')}
            className="min-h-[44px] font-black whitespace-nowrap shrink-0"
          >
            {lang === 'fr' ? `${importReqCount} demande(s) import` : `${importReqCount} طلبات استيراد مفتوحة`}
          </Button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Campagnes ouvertes' : 'طلبات الملاك المفتوحة'}
          </span>
          <span className="text-2xl font-black text-ink font-mono tabular-nums block">
            {isLoading ? '—' : requests.length}
          </span>
        </div>

        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Pièces de rechange' : 'طلبات قطع الغيار'}
          </span>
          <span className="text-2xl font-black text-ink font-mono tabular-nums block">
            {isLoading ? '—' : spareReqCount}
          </span>
        </div>

        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Achat & Import engins' : 'طلبات شراء واستيراد آليات'}
          </span>
          <span className="text-2xl font-black text-ink font-mono tabular-nums block">
            {isLoading ? '—' : purchaseReqCount}
          </span>
        </div>

        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Articles publiés' : 'إعلانات الكتالوج المنشورة'}
          </span>
          <span className="text-2xl font-black text-ink font-mono tabular-nums block">
            {isLoading ? '—' : catalog.length}
          </span>
        </div>
      </div>

      {/* Live Requests Section */}
      <div className="bg-white border border-steel-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-steel-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-ink">
              {lang === 'fr'
                ? 'Dernières campagnes lancées par les propriétaires'
                : 'أحدث حملات البحث من مالكي الآليات'}
            </h2>
            <p className="text-xs text-steel-500 mt-0.5">
              {lang === 'fr'
                ? 'Répondez rapidement avec un devis prix et délai de livraison'
                : 'أرسل تسعيرتك ومدة التوفير لربح الصفقة مباشرة عبر المحادثة'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/supplier/requests')}
            className="text-xs font-black text-primary-dark hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{lang === 'fr' ? 'Tout voir' : 'عرض الكل'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {hasError ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm font-bold text-steel-600">
              {lang === 'fr' ? 'Erreur lors du chargement des demandes' : 'تعذر تحميل الطلبات حالياً'}
            </p>
            <Button variant="outline" size="sm" onClick={loadDashboard}>
              {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Inbox className="w-10 h-10 text-steel-300 mx-auto" />
            <p className="text-sm font-black text-ink">
              {lang === 'fr'
                ? 'Aucune campagne ouverte pour le moment'
                : 'لا توجد حملات بحث مفتوحة في هذه اللحظة'}
            </p>
            <p className="text-xs text-steel-500 max-w-md mx-auto">
              {lang === 'fr'
                ? 'Dès qu’un propriétaire lance une recherche de pièce ou d’engin, elle apparaîtra ici instantanément.'
                : 'بمجرد إطلاق أي مالك آلية لحملة بحث عن قطعة غيار أو شراء/استيراد آلية ستصلك فوراً هنا.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-steel-100">
            {requests.slice(0, 6).map((req) => {
              const isSpare = req.campaign_type === 'spare_part';
              return (
                <div
                  key={req.campaign_id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-steel-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
                      {isSpare ? (
                        <Wrench className="w-5 h-5" />
                      ) : req.import_allowed ? (
                        <Ship className="w-5 h-5" />
                      ) : (
                        <Truck className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-ink truncate">{req.machine_name}</h3>
                        {req.part_reference && (
                          <span dir="ltr" className="text-xs font-mono font-black text-primary-dark">
                            Réf {req.part_reference}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-steel-500 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{req.company_name}</span>
                        <span>·</span>
                        <span>{req.site_city || req.site_name}</span>
                        {req.distance_km != null && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">{formatDistanceKm(req.distance_km, lang)}</span>
                          </>
                        )}
                        {req.import_allowed && (
                          <>
                            <span>·</span>
                            <span className="text-primary-dark">
                              {lang === 'fr' ? 'Import accepté' : 'يقبل الاستيراد من الخارج'}
                            </span>
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/supplier/requests?campaign=${req.campaign_id}`)}
                      leftIcon={<MessageSquare className="w-4 h-4" />}
                      className="min-h-[44px] font-black whitespace-nowrap shrink-0"
                    >
                      {lang === 'fr' ? 'Envoyer un devis' : 'تقديم عرض سعر'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Quick Summary */}
      <div className="bg-white border border-steel-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-ink">
              {lang === 'fr' ? 'Votre catalogue & stock' : 'كتالوج الآليات وقطع الغيار الخاص بك'}
            </h3>
            <p className="text-xs text-steel-500 mt-0.5">
              {lang === 'fr'
                ? 'Publiez vos engins disponibles au Maroc, pièces détachées et offres d’importation.'
                : 'انشر قطع الغيار المتوفرة، الآليات المعروضة للبيع بالمغرب، أو عروض الاستيراد حسب الطلب.'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate('/supplier/catalog')}
          className="min-h-[44px] font-black whitespace-nowrap shrink-0"
        >
          {lang === 'fr' ? `Gérer (${catalog.length})` : `إدارة الكتالوج (${catalog.length})`}
        </Button>
      </div>
    </div>
  );
};

export default SupplierDashboardPage;
