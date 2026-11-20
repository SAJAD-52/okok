// ============================================================================
// JADIJCB: Owner Suppliers & Procurement Section (/owner/suppliers - "طلبات للموردين")
// Displays:
//   1. Top "حملة بحث جديدة" CTA opening the guided SupplierSearchCampaignModal
//   2. Completed Purchase & Spare-Part Orders finalized with suppliers/importers
//   3. Open & historical Owner search campaigns sent to suppliers/importers
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Truck,
  Wrench,
  Ship,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  MapPin,
  FileCheck2,
  Hash,
  Building2,
  Lock,
  ShoppingBag,
  Globe,
  Coins,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { DispatchCampaign, SupplierOrderDealItem } from '../types/database';
import {
  closeDispatchCampaign,
  fetchOwnerSupplierOrders,
  fetchOwnerSupplyCampaigns,
  subscribeLocalDispatchEvents,
} from '../lib/dispatchService';
import { getImportCountryLabel } from '../data/supplierOptions';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupplierSearchCampaignModal } from '../components/machines/SupplierSearchCampaignModal';

type ViewFilter = 'all' | 'orders' | 'campaigns';

export const OwnerSuppliersPage: React.FC = () => {
  const { lang } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const ownerId = user?.id || profile?.id || '';

  const [orders, setOrders] = useState<SupplierOrderDealItem[]>([]);
  const [campaigns, setCampaigns] = useState<DispatchCampaign[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<ViewFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!ownerId) {
      setIsLoading(false);
      return;
    }
    try {
      const [fetchedOrders, fetchedCampaigns] = await Promise.all([
        fetchOwnerSupplierOrders(ownerId),
        fetchOwnerSupplyCampaigns(ownerId),
      ]);
      setOrders(fetchedOrders);
      setCampaigns(fetchedCampaigns);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadData();
    const unsub = subscribeLocalDispatchEvents(() => loadData());

    let rtChan: any = null;
    if (isSupabaseConfigured && ownerId) {
      try {
        rtChan = supabase
          .channel(`owner_suppliers_${ownerId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'dispatch_campaigns' },
            loadData
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${ownerId}` },
            loadData
          )
          .subscribe();
      } catch {
        // ignore
      }
    }

    return () => {
      unsub();
      if (rtChan) supabase.removeChannel(rtChan);
    };
  }, [loadData, ownerId]);

  const handleCloseCampaign = async (campaignId: string) => {
    await closeDispatchCampaign(campaignId);
    toast.success(
      lang === 'fr' ? 'Campagne clôturée avec succès' : 'تم إغلاق حملة البحث بنجاح'
    );
    loadData();
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (!q) return true;
      const hay = [
        o.item_title,
        o.part_reference,
        o.desired_model,
        o.fleet_machine_title,
        o.supplier_name,
        o.supplier_city,
        o.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, searchQuery]);

  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (!q) return true;
      const hay = [
        c.machine_name,
        c.part_reference,
        c.desired_model,
        c.fleet_machine_title,
        c.site_city,
        c.won_supplier_name,
        c.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [campaigns, searchQuery]);

  const openCampaignsCount = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6 text-start">
      {/* Header + Primary "حملة بحث جديدة" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Commandes & Recherches Fournisseurs' : 'طلبات للموردين'}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {lang === 'fr'
              ? 'Lancez vos campagnes de recherche d’engins ou pièces et suivez vos commandes validées'
              : 'أطلق حملات البحث عن الآليات أو قطع الغيار وتتبع طلبات الشراء المنجزة مع الموردين والمستوردين'}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => setIsNewCampaignOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="min-h-[44px] font-black whitespace-nowrap shrink-0"
        >
          {lang === 'fr' ? 'Nouvelle campagne de recherche' : 'حملة بحث جديدة'}
        </Button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Commandes finalisées' : 'طلبات الشراء المنجزة'}
          </span>
          <span className="text-2xl font-black text-emerald-700 font-mono tabular-nums block">
            {isLoading ? '—' : orders.length}
          </span>
        </div>

        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Campagnes ouvertes' : 'حملات بحث مفتوحة'}
          </span>
          <span className="text-2xl font-black text-primary-dark font-mono tabular-nums block">
            {isLoading ? '—' : openCampaignsCount}
          </span>
        </div>

        <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold text-steel-500 block">
            {lang === 'fr' ? 'Total des campagnes' : 'إجمالي الحملات المطلقة'}
          </span>
          <span className="text-2xl font-black text-ink font-mono tabular-nums block">
            {isLoading ? '—' : campaigns.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', ar: 'الكل', fr: 'Tout', count: orders.length + campaigns.length },
            {
              id: 'orders',
              ar: 'طلبات الشراء المنجزة',
              fr: 'Commandes validées',
              count: orders.length,
            },
            {
              id: 'campaigns',
              ar: 'حملات البحث',
              fr: 'Campagnes lancées',
              count: campaigns.length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as ViewFilter)}
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

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-steel-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Rechercher pièce, engin, fournisseur...'
                : 'ابحث بالعنصر، المرجع أو اسم المورد...'
            }
            className="w-full ps-9 pe-3 py-2.5 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ================================================================ */}
          {/* SECTION 1: Completed Purchase Orders with Suppliers              */}
          {/* ================================================================ */}
          {(activeFilter === 'all' || activeFilter === 'orders') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-black text-ink flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-700" />
                  <span>
                    {lang === 'fr'
                      ? 'Commandes conclues avec les fournisseurs'
                      : 'طلبات الشراء المنجزة مع الموردين'}
                  </span>
                </h2>
                <span className="text-xs font-mono font-black text-steel-500 tabular-nums">
                  {filteredOrders.length}
                </span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white border border-steel-200 rounded-2xl p-8 text-center space-y-2">
                  <CheckCircle2 className="w-9 h-9 text-steel-300 mx-auto" />
                  <p className="text-sm font-black text-ink">
                    {lang === 'fr'
                      ? 'Aucune commande finalisée pour le moment'
                      : 'لا توجد طلبات شراء منجزة مع الموردين بعد'}
                  </p>
                  <p className="text-xs text-steel-500 max-w-md mx-auto">
                    {lang === 'fr'
                      ? 'Une fois que vous et le fournisseur validez l’accord dans le chat, la transaction s’affichera ici avec tous ses détails.'
                      : 'عندما تتفق مع المورد في المحادثة وتضغطان على «إغلاق الصفقة»، سيظهر الطلب المنجز هنا بجميع تفاصيله.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {filteredOrders.map((order) => {
                    const isSpare = order.campaign_type === 'spare_part';
                    return (
                      <div
                        key={order.id || order.campaign_id}
                        className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          {/* Item & Thumbnail */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            {order.fleet_machine_image ? (
                              <img
                                src={order.fleet_machine_image}
                                alt={order.fleet_machine_title || order.item_title}
                                className="w-14 h-14 rounded-xl object-cover border border-steel-200 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                                {isSpare ? (
                                  <Wrench className="w-5 h-5" />
                                ) : order.import_allowed ? (
                                  <Ship className="w-5 h-5" />
                                ) : (
                                  <Truck className="w-5 h-5" />
                                )}
                              </div>
                            )}

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{lang === 'fr' ? 'Affaire conclue' : 'صفقة منجزة'}</span>
                                </span>
                                <span className="text-steel-300">·</span>
                                <span className="text-xs font-black text-steel-500">
                                  {isSpare
                                    ? lang === 'fr'
                                      ? 'Pièce détachée'
                                      : 'قطعة غيار'
                                    : lang === 'fr'
                                    ? 'Achat / Import engin'
                                    : 'شراء / استيراد آلية'}
                                </span>
                                <span className="text-steel-300">·</span>
                                <span className="text-[11px] font-mono text-steel-400" dir="ltr">
                                  {new Date(order.closed_at || order.created_at).toLocaleDateString(
                                    lang === 'fr' ? 'fr-FR' : 'ar-MA'
                                  )}
                                </span>
                              </div>

                              <h3 className="text-base font-black text-ink">
                                {order.item_title}
                                {order.part_reference && (
                                  <span dir="ltr" className="ms-2 font-mono text-sm text-primary-dark">
                                    Réf: {order.part_reference}
                                  </span>
                                )}
                              </h3>

                              {order.fleet_machine_title && (
                                <p className="text-xs text-steel-600 font-bold">
                                  {lang === 'fr' ? 'Engin associé :' : 'الآلية المعنية في الأسطول :'}{' '}
                                  <span className="text-ink">{order.fleet_machine_title}</span>
                                </p>
                              )}

                              {/* Transaction Key Details */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-steel-600 font-bold">
                                <span className="inline-flex items-center gap-1 text-ink">
                                  <Building2 className="w-3.5 h-3.5 text-primary-dark" />
                                  <span>
                                    {lang === 'fr' ? 'Fournisseur :' : 'المورد :'} {order.supplier_name}
                                  </span>
                                </span>

                                {order.supplier_city && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-steel-400" />
                                    <span>{order.supplier_city}</span>
                                  </span>
                                )}

                                {order.desired_model && (
                                  <span>
                                    {lang === 'fr' ? 'Modèle :' : 'الموديل :'} {order.desired_model}
                                  </span>
                                )}

                                {!isSpare && (
                                  <span className="inline-flex items-center gap-1">
                                    <FileCheck2 className="w-3.5 h-3.5 text-steel-400" />
                                    <span>
                                      {order.customs_clearance
                                        ? lang === 'fr'
                                          ? 'Dédouané'
                                          : 'مع الديوانة'
                                        : lang === 'fr'
                                        ? 'Hors douane'
                                        : 'بدون ديوانة'}
                                    </span>
                                  </span>
                                )}

                                {order.preferred_origin && (
                                  <span>{getImportCountryLabel(order.preferred_origin, lang)}</span>
                                )}
                              </div>

                              {order.notes && (
                                <p className="text-xs text-steel-500 pt-1">{order.notes}</p>
                              )}
                            </div>
                          </div>

                          {/* Price & Actions */}
                          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0">
                            {order.agreed_price ? (
                              <div className="text-start lg:text-end">
                                <span className="text-[11px] font-bold text-steel-500 block">
                                  {lang === 'fr' ? 'Montant convenu' : 'الثمن المتفق عليه'}
                                </span>
                                <span
                                  dir="ltr"
                                  className="text-base font-black text-emerald-700 font-mono tabular-nums inline-flex items-center gap-1"
                                >
                                  <Coins className="w-4 h-4" />
                                  <span>
                                    {Number(order.agreed_price).toLocaleString('fr-FR')}{' '}
                                    {order.agreed_currency === 'EUR' ? '€' : 'MAD'}
                                  </span>
                                </span>
                              </div>
                            ) : null}

                            <div className="flex items-center gap-2">
                              {order.supplier_phone && (
                                <a
                                  href={`tel:${order.supplier_phone}`}
                                  className="min-h-[44px] px-3.5 rounded-xl bg-white border border-steel-300 text-ink font-black text-xs inline-flex items-center gap-1.5 hover:bg-steel-50"
                                >
                                  <Phone className="w-4 h-4 text-emerald-700" />
                                  <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                                </a>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/owner/messages?target=${encodeURIComponent(
                                      order.supplier_id
                                    )}&campaign=${encodeURIComponent(order.campaign_id)}`
                                  )
                                }
                                leftIcon={<MessageSquare className="w-4 h-4" />}
                                className="min-h-[44px] font-black bg-white"
                              >
                                {lang === 'fr' ? 'Discussion' : 'المحادثة'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================================================================ */}
          {/* SECTION 2: Search Campaigns Launched by Owner                    */}
          {/* ================================================================ */}
          {(activeFilter === 'all' || activeFilter === 'campaigns') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-black text-ink flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary-dark" />
                  <span>
                    {lang === 'fr'
                      ? 'Vos campagnes de recherche envoyées'
                      : 'حملات البحث المطلقة للموردين'}
                  </span>
                </h2>
                <span className="text-xs font-mono font-black text-steel-500 tabular-nums">
                  {filteredCampaigns.length}
                </span>
              </div>

              {filteredCampaigns.length === 0 ? (
                <div className="bg-white border border-steel-200 rounded-2xl p-8 text-center space-y-3">
                  <ShoppingBag className="w-9 h-9 text-steel-300 mx-auto" />
                  <p className="text-sm font-black text-ink">
                    {lang === 'fr'
                      ? 'Aucune campagne de recherche lancée'
                      : 'لم تطلق أي حملة بحث للموردين بعد'}
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setIsNewCampaignOpen(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="min-h-[44px] font-black"
                  >
                    {lang === 'fr' ? 'Lancer une recherche' : 'حملة بحث جديدة'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredCampaigns.map((camp) => {
                    const isSpare = camp.campaign_type === 'spare_part';
                    const isActive = camp.status === 'active';
                    return (
                      <div
                        key={camp.id}
                        className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          {camp.fleet_machine_image ? (
                            <img
                              src={camp.fleet_machine_image}
                              alt={camp.fleet_machine_title || camp.machine_name}
                              className="w-12 h-12 rounded-xl object-cover border border-steel-200 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
                              {isSpare ? (
                                <Wrench className="w-5 h-5" />
                              ) : camp.import_allowed ? (
                                <Ship className="w-5 h-5" />
                              ) : (
                                <Truck className="w-5 h-5" />
                              )}
                            </div>
                          )}

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-black ${
                                  isActive ? 'text-primary-dark' : 'text-steel-500'
                                }`}
                              >
                                {isActive ? (
                                  <Clock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isActive
                                    ? lang === 'fr'
                                      ? 'Ouverte aux fournisseurs'
                                      : 'مفتوحة للموردين'
                                    : lang === 'fr'
                                    ? 'Clôturée'
                                    : 'مغلقة'}
                                </span>
                              </span>
                              <span className="text-steel-300">·</span>
                              <span className="text-xs font-bold text-steel-500">
                                {isSpare
                                  ? lang === 'fr'
                                    ? 'Pièce détachée'
                                    : 'قطعة غيار'
                                  : lang === 'fr'
                                  ? 'Achat / Import engin'
                                  : 'شراء / استيراد آلية'}
                              </span>
                              <span className="text-steel-300">·</span>
                              <span className="text-[11px] text-steel-500 font-bold tabular-nums">
                                {camp.matched_owners_count}{' '}
                                {lang === 'fr' ? 'notifié(s)' : 'مورد تم إشعاره'}
                              </span>
                            </div>

                            <h3 className="text-sm sm:text-base font-black text-ink">
                              {camp.machine_name}
                              {camp.part_reference && (
                                <span dir="ltr" className="ms-2 font-mono text-xs text-primary-dark inline-flex items-center gap-0.5">
                                  <Hash className="w-3 h-3" />
                                  {camp.part_reference}
                                </span>
                              )}
                            </h3>

                            <p className="text-xs text-steel-500 font-bold flex items-center gap-2 flex-wrap">
                              <span>{camp.site_city || camp.site_name}</span>
                              {camp.desired_model && <span>· {camp.desired_model}</span>}
                              {!isSpare && camp.customs_clearance !== undefined && (
                                <span>
                                  · {camp.customs_clearance ? 'مع الديوانة' : 'بدون ديوانة'}
                                </span>
                              )}
                              {camp.fleet_machine_title && (
                                <span>· للآلية: {camp.fleet_machine_title}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleCloseCampaign(camp.id)}
                              className="min-h-[44px] font-black bg-white"
                            >
                              {lang === 'fr' ? 'Clôturer la campagne' : 'إغلاق الحملة'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/owner/messages')}
                            leftIcon={<MessageSquare className="w-4 h-4" />}
                            className="min-h-[44px] font-black bg-white"
                          >
                            {lang === 'fr' ? 'Messages' : 'المحادثات'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Guided Search Campaign Wizard Modal */}
      <SupplierSearchCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onCampaignLaunched={() => {
          loadData();
        }}
      />
    </div>
  );
};

export default OwnerSuppliersPage;
