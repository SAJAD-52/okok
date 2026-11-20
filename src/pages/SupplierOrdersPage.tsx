// ============================================================================
// JADIJCB: Supplier Customer Orders Section (/supplier/orders - "طلبات الزبناء")
// Displays all finalized purchase & spare-part deals agreed with equipment
// owners, showing item specs, linked machine photo, owner contact, price,
// customs/import terms, and quick Chat & Call buttons.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Wrench,
  Ship,
  Truck,
  Phone,
  MessageSquare,
  MapPin,
  FileCheck2,
  Building2,
  Coins,
  Inbox,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { SupplierOrderDealItem } from '../types/database';
import {
  fetchSupplierCompletedOrders,
  subscribeLocalDispatchEvents,
} from '../lib/dispatchService';
import { getImportCountryLabel } from '../data/supplierOptions';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type OrderFilter = 'all' | 'spare_part' | 'machine_purchase';

export const SupplierOrdersPage: React.FC = () => {
  const { lang } = useLanguage();
  const { user, profile, isImpersonating } = useAuth();
  const navigate = useNavigate();

  const supplierId = isImpersonating ? profile?.id : user?.id || profile?.id || '';

  const [orders, setOrders] = useState<SupplierOrderDealItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadOrders = useCallback(async () => {
    if (!supplierId) {
      setIsLoading(false);
      return;
    }
    try {
      const list = await fetchSupplierCompletedOrders(supplierId);
      setOrders(list);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    loadOrders();
    const unsub = subscribeLocalDispatchEvents(() => loadOrders());

    let rtChan: any = null;
    if (isSupabaseConfigured && supplierId) {
      try {
        rtChan = supabase
          .channel(`supplier_orders_${supplierId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'dispatch_campaigns' },
            loadOrders
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${supplierId}`,
            },
            loadOrders
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
  }, [loadOrders, supplierId]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.campaign_type !== filter) return false;
      if (!q) return true;
      const hay = [
        o.item_title,
        o.part_reference,
        o.desired_model,
        o.fleet_machine_title,
        o.owner_name,
        o.owner_city,
        o.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, filter, searchTerm]);

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Commandes Clients Validées' : 'طلبات الزبناء المنجزة'}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {lang === 'fr'
              ? 'Toutes vos ventes d’engins, pièces détachées et importations conclues avec les propriétaires'
              : 'سجل الصفقات والطلبات المغلقة مع مالكي الآليات بجميع تفاصيل التوريد والأسعار'}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => navigate('/supplier/requests')}
          className="min-h-[44px] font-black bg-white whitespace-nowrap shrink-0"
        >
          {lang === 'fr' ? 'Voir les nouvelles demandes' : 'الطلبات المفتوحة للملاك'}
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', ar: 'الكل', fr: 'Tout', count: orders.length },
            {
              id: 'spare_part',
              ar: 'قطع الغيار',
              fr: 'Pièces détachées',
              count: orders.filter((o) => o.campaign_type === 'spare_part').length,
            },
            {
              id: 'machine_purchase',
              ar: 'شراء / استيراد آليات',
              fr: 'Engins & Import',
              count: orders.filter((o) => o.campaign_type === 'machine_purchase').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as OrderFilter)}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-black border transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                filter === tab.id
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
                ? 'Rechercher client, pièce, référence...'
                : 'ابحث باسم الزبون، العنصر أو المرجع...'
            }
            className="w-full ps-9 pe-3 py-2.5 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-steel-200 rounded-2xl p-10 text-center space-y-3">
          <Inbox className="w-10 h-10 text-steel-300 mx-auto" />
          <h2 className="text-sm font-black text-ink">
            {lang === 'fr'
              ? 'Aucune commande client conclue pour le moment'
              : 'لا توجد طلبات زبناء منجزة حتى الآن'}
          </h2>
          <p className="text-xs text-steel-500 max-w-md mx-auto">
            {lang === 'fr'
              ? 'Dès que vous et un propriétaire acceptez les termes et clôturez un accord dans le chat, la commande apparaîtra ici.'
              : 'عندما تتفق مع أي مالك آلية في المحادثة وتغلقان الصفقة، ستظهر الطلبية كاملة هنا.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredOrders.map((order) => {
            const isSpare = order.campaign_type === 'spare_part';
            return (
              <div
                key={order.id || order.campaign_id}
                className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
              >
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
                        <span>{lang === 'fr' ? 'Commande confirmée' : 'صفقة مؤكدة'}</span>
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
                        {lang === 'fr' ? 'Pour l’engin :' : 'خاصة بالآلية :'}{' '}
                        <span className="text-ink">{order.fleet_machine_title}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-steel-600 font-bold">
                      <span className="inline-flex items-center gap-1 text-ink">
                        <Building2 className="w-3.5 h-3.5 text-primary-dark" />
                        <span>
                          {lang === 'fr' ? 'Client / Propriétaire :' : 'الزبون (المالك) :'}{' '}
                          {order.owner_name}
                        </span>
                      </span>

                      {order.owner_city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-steel-400" />
                          <span>{order.owner_city}</span>
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

                    {order.notes && <p className="text-xs text-steel-500 pt-1">{order.notes}</p>}
                  </div>
                </div>

                {/* Price & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0">
                  {order.agreed_price ? (
                    <div className="text-start lg:text-end">
                      <span className="text-[11px] font-bold text-steel-500 block">
                        {lang === 'fr' ? 'Montant convenu' : 'السعر المتفق عليه'}
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
                    {order.owner_phone && (
                      <a
                        href={`tel:${order.owner_phone}`}
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
                          `/supplier/messages?target=${encodeURIComponent(
                            order.owner_id
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupplierOrdersPage;
