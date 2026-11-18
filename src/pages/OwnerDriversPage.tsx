// ============================================================================
// JADIJCB: Owner Agreed Drivers Section (/owner/drivers - "السائقون")
// Displays all finalized/agreed driver deals for the equipment owner with
// full details: Machine (thumbnail + title), Driver (name, phone, city),
// Duration, and Agreed Salary, plus quick chat & call actions.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  Search,
  Phone,
  MessageSquare,
  Handshake,
  Clock,
  MapPin,
  Calendar,
  Truck,
  CheckCircle2,
  Coins,
  UserCheck,
  FileText,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import {
  AgreedDriverDealItem,
  buildFallbackDriverContractFromDeal,
  fetchOwnerAgreedDriverDeals,
} from '../lib/driverOfferService';
import { getDriverExperienceOption } from '../data/driverMachines';
import { chatStore } from '../lib/chatStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DriverContractModal } from '../components/driver/DriverContractModal';

export const OwnerDriversPage: React.FC = () => {
  const { lang } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [deals, setDeals] = useState<AgreedDriverDealItem[]>([]);
  const [selectedDealForContract, setSelectedDealForContract] =
    useState<AgreedDriverDealItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const ownerId = user?.id || profile?.id || '';

  const loadDeals = useCallback(async () => {
    if (!ownerId) {
      setIsLoading(false);
      return;
    }
    try {
      const list = await fetchOwnerAgreedDriverDeals(ownerId);
      setDeals(list);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadDeals();

    const onLocalUpdated = () => loadDeals();
    window.addEventListener('jadijcb_driver_offers_updated', onLocalUpdated);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('jadijcb_driver_dispatch');
        bc.onmessage = () => loadDeals();
      }
    } catch {
      bc = null;
    }

    let rtChan: any = null;
    if (isSupabaseConfigured && ownerId) {
      try {
        rtChan = supabase
          .channel(`owner_drivers_deals_${ownerId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_job_offers' },
            () => loadDeals()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'driver_job_applications' },
            () => loadDeals()
          )
          .subscribe();
      } catch {
        // ignore if tables are not migrated yet
      }
    }

    return () => {
      window.removeEventListener('jadijcb_driver_offers_updated', onLocalUpdated);
      if (bc) bc.close();
      if (rtChan) supabase.removeChannel(rtChan);
    };
  }, [loadDeals, ownerId]);

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const hay = [
        d.driver_name,
        d.driver_phone,
        d.driver_city,
        d.machine_title,
        d.machine_label_ar,
        d.machine_label_fr,
        d.duration_label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [deals, searchQuery]);

  const handleOpenDriverChat = async (deal: AgreedDriverDealItem) => {
    if (!ownerId || !deal.driver_id) return;
    try {
      const conv = await chatStore.getOrCreateConversation(
        ownerId,
        deal.driver_id,
        null,
        {
          id: deal.driver_id,
          full_name: deal.driver_name,
          phone: deal.driver_phone,
          city: deal.driver_city,
          role: 'driver',
        }
      );
      navigate(
        `/owner/messages?conv=${encodeURIComponent(conv.id)}&offer=${encodeURIComponent(
          deal.offer_id
        )}`
      );
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible d’ouvrir la messagerie.'
          : 'تعذر فتح المحادثة مع السائق حالياً.'
      );
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-primary text-ink flex items-center justify-center shrink-0">
              <HardHat className="w-5 h-5" />
            </span>
            <span>{lang === 'fr' ? 'Chauffeurs & Accords conclus' : 'السائقون'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-steel-600 mt-1">
            {lang === 'fr'
              ? 'Tous les accords conclus avec les conducteurs d’engins avec machine, durée et rémunération.'
              : 'سجل صفقات التشغيل المتفق عليها مع السائقين بكل تفاصيلها: الآلية، السائق، المدة، والأجر.'}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => navigate('/owner/machines')}
          leftIcon={<Truck className="w-4 h-4" />}
          className="text-xs font-black min-h-[42px] shrink-0"
        >
          {lang === 'fr' ? 'Lancer une recherche de chauffeur' : 'إطلاق حملة بحث عن سائق'}
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white border border-steel-200 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Accords conclus' : 'إجمالي الصفقات المبرمة'}
            </span>
            <span className="text-xl font-black text-ink tabular-nums">{deals.length}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-steel-200 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-primary-dark flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Conducteurs actifs' : 'السائقون المتفق معهم'}
            </span>
            <span className="text-xl font-black text-ink tabular-nums">
              {new Set(deals.map((d) => d.driver_id || d.driver_name)).size}
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-steel-200 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-steel-100 text-ink flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-steel-500 block">
              {lang === 'fr' ? 'Engins affectés' : 'الآليات المجهّزة بسائق'}
            </span>
            <span className="text-xl font-black text-ink tabular-nums">
              {new Set(deals.map((d) => d.machine_id || d.machine_title)).size}
            </span>
          </div>
        </Card>
      </div>

      {/* Search Filter */}
      <Card className="p-3.5 bg-white border border-steel-200 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-steel-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Rechercher par nom du conducteur, engin, ville, téléphone...'
                : 'ابحث باسم السائق، اسم الآلية، المدينة، أو رقم الهاتف...'
            }
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 bg-surface/50 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
        </div>
      </Card>

      {/* Deals List */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-2xl bg-steel-100 animate-pulse" />
          ))}
        </div>
      ) : filteredDeals.length === 0 ? (
        <Card className="p-10 text-center bg-white border border-steel-200 rounded-2xl space-y-3">
          <HardHat className="w-11 h-11 text-steel-300 mx-auto" />
          <h3 className="text-base font-black text-ink">
            {deals.length === 0
              ? lang === 'fr'
                ? 'Aucun accord conducteur conclu pour le moment'
                : 'لا توجد صفقات سائقين مسجلة بعد'
              : lang === 'fr'
              ? 'Aucun résultat pour cette recherche'
              : 'لا توجد نتائج مطابقة لبحثك'}
          </h3>
          <p className="text-xs text-steel-500 max-w-md mx-auto leading-relaxed">
            {deals.length === 0
              ? lang === 'fr'
                ? 'Lancez une recherche de conducteur depuis la section الآليات, puis concluez l’accord dans la conversation pour qu’il apparaisse ici.'
                : 'أطلق حملة البحث عن سائق من قسم الآليات، وعند الاتفاق وإغلاق الصفقة في المحادثة ستظهر هنا بكل تفاصيلها.'
              : lang === 'fr'
              ? 'Essayez un autre mot-clé.'
              : 'جرّب البحث بكلمات أخرى أو امسح مربع البحث.'}
          </p>
          {deals.length === 0 && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/owner/machines')}
              leftIcon={<Truck className="w-4 h-4" />}
              className="font-black text-xs min-h-[44px]"
            >
              {lang === 'fr' ? 'Aller aux machines' : 'الذهاب إلى قسم الآليات'}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDeals.map((deal) => {
            const expOpt = deal.driver_experience
              ? getDriverExperienceOption(deal.driver_experience)
              : null;

            return (
              <Card
                key={deal.offer_id}
                className="p-5 bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl flex flex-col justify-between gap-4 transition-colors shadow-xs"
              >
                <div className="space-y-4">
                  {/* Top Status & Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {lang === 'fr' ? 'Accord validé' : 'صفقة متفق عليها'}
                      </span>
                      {deal.contract && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-steel-200 text-ink text-[10px] font-black font-mono"
                          dir="ltr"
                        >
                          <FileText className="w-3 h-3 text-primary-dark" />
                          {deal.contract.contract_number}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-bold text-steel-500 flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(deal.agreed_at).toLocaleDateString(
                        lang === 'fr' ? 'fr-FR' : 'ar-MA'
                      )}
                    </span>
                  </div>

                  {/* Machine Row (الآلية) */}
                  <div className="flex items-center gap-3 pb-3.5 border-b border-steel-100">
                    {deal.machine_image ? (
                      <img
                        src={deal.machine_image}
                        alt={deal.machine_title || deal.machine_label_ar}
                        className="w-16 h-16 rounded-xl object-cover border border-steel-200 shrink-0 bg-steel-50"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <Truck className="w-7 h-7 text-primary-dark" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {lang === 'fr' ? 'Engin / Machine' : 'الآلية'}
                      </span>
                      <h2 className="text-sm sm:text-base font-black text-ink truncate">
                        {deal.machine_title ||
                          (lang === 'fr' ? deal.machine_label_fr : deal.machine_label_ar)}
                      </h2>
                      <span className="text-[11px] font-bold text-steel-500 block truncate">
                        {lang === 'fr' ? deal.machine_label_fr : deal.machine_label_ar}
                      </span>
                    </div>
                  </div>

                  {/* 4-Field Deal Breakdown: السائق، المدة، الأجر، المدينة */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* السائق */}
                    <div className="p-3 rounded-xl bg-surface border border-steel-200/80 flex items-start gap-2.5">
                      <HardHat className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-steel-500 block">
                          {lang === 'fr' ? 'Conducteur' : 'السائق'}
                        </span>
                        <span className="font-black text-ink block truncate">
                          {deal.driver_name}
                        </span>
                        {deal.driver_phone && (
                          <span className="text-[11px] font-mono text-steel-600 block" dir="ltr">
                            {deal.driver_phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* الأجر */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5">
                      <Coins className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-steel-600 block">
                          {lang === 'fr' ? 'Rémunération' : 'الأجر'}
                        </span>
                        <span className="text-sm font-black text-ink tabular-nums block">
                          {deal.offered_salary.toLocaleString('fr-FR')}{' '}
                          <span className="text-[11px] font-bold">
                            {lang === 'fr'
                              ? `MAD/${deal.salary_unit === 'month' ? 'mois' : 'jour'}`
                              : `د.م/${deal.salary_unit === 'month' ? 'شهر' : 'يوم'}`}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* المدة */}
                    <div className="p-3 rounded-xl bg-surface border border-steel-200/80 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-steel-500 block">
                          {lang === 'fr' ? 'Durée' : 'المدة'}
                        </span>
                        <span className="font-black text-ink block truncate">
                          {deal.duration_label ||
                            (lang === 'fr' ? 'Selon accord' : 'حسب الاتفاق')}
                        </span>
                      </div>
                    </div>

                    {/* المدينة والخبرة */}
                    <div className="p-3 rounded-xl bg-surface border border-steel-200/80 flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-steel-500 block">
                          {lang === 'fr' ? 'Ville & Expérience' : 'المدينة والخبرة'}
                        </span>
                        <span className="font-bold text-ink block truncate">
                          {deal.driver_city || deal.city || 'المغرب'}
                          {expOpt
                            ? ` · ${lang === 'fr' ? expOpt.shortFr : expOpt.shortAr}`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-steel-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDealForContract(deal)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{lang === 'fr' ? 'Contrat PDF' : 'عرض / تحميل العقد PDF'}</span>
                  </button>

                  {deal.driver_id && (
                    <button
                      type="button"
                      onClick={() => handleOpenDriverChat(deal)}
                      className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-ink text-white hover:bg-steel-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <span>{lang === 'fr' ? 'Discussion' : 'محادثة السائق'}</span>
                    </button>
                  )}

                  {deal.driver_phone && (
                    <a
                      href={`tel:${deal.driver_phone}`}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Signed Contract PDF Viewer Modal */}
      {selectedDealForContract && (
        <DriverContractModal
          isOpen={Boolean(selectedDealForContract)}
          onClose={() => setSelectedDealForContract(null)}
          initialMode="preview"
          contract={
            selectedDealForContract.contract ||
            buildFallbackDriverContractFromDeal(selectedDealForContract)
          }
          dealContext={{
            offer_id: selectedDealForContract.offer_id,
            owner_id: selectedDealForContract.owner_id,
            driver_id: selectedDealForContract.driver_id,
            machine_id: selectedDealForContract.machine_id,
            machine_title: selectedDealForContract.machine_title,
            machine_image: selectedDealForContract.machine_image,
            machine_category: selectedDealForContract.machine_category,
            machine_label_ar: selectedDealForContract.machine_label_ar,
            machine_label_fr: selectedDealForContract.machine_label_fr,
            offered_salary: selectedDealForContract.offered_salary,
            salary_unit: selectedDealForContract.salary_unit,
            duration_label: selectedDealForContract.duration_label,
            owner_accepted: true,
            driver_accepted: true,
            deal_status: 'accepted',
            won_driver_name: selectedDealForContract.driver_name,
            won_driver_phone: selectedDealForContract.driver_phone,
            agreed_at: selectedDealForContract.agreed_at,
            contract: selectedDealForContract.contract,
          }}
          partyRole="owner"
          canEdit={false}
        />
      )}
    </div>
  );
};

export default OwnerDriversPage;
