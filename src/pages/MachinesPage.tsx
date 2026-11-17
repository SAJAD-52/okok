// ============================================================================
// JADIJCB: Machines & Spare Parts CRUD Management Page
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Truck,
  Wrench,
  Tag,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  RotateCcw,
  Radio,
  Globe,
  MessageSquare,
  XCircle,
  Handshake,
  CalendarCheck,
  HardHat,
  Phone,
  Users,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine, ListingMode, DispatchCampaign } from '../types/database';
import { formatPriceMAD } from '../data/rentalTerms';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { SparePartDispatchModal } from '../components/machines/SparePartDispatchModal';
import { DriverDispatchModal } from '../components/machines/DriverDispatchModal';
import {
  closeDispatchCampaign,
  fetchContractorCampaigns,
  subscribeLocalDispatchEvents,
} from '../lib/dispatchService';
import {
  closeDriverJobOffer,
  fetchOwnerDriverOffers,
  finalizeDriverJobOfferDirect,
  OwnerDriverOfferWithApps,
} from '../lib/driverOfferService';
import { getDriverExperienceOption } from '../data/driverMachines';
import { chatStore } from '../lib/chatStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapDatabaseError } from '../lib/errorHelpers';
import { machineStore } from '../lib/machineStore';

export const MachinesPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'rent' | 'sale' | 'spare'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachineToEdit, setSelectedMachineToEdit] = useState<Machine | null>(null);
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [spareDispatchMachine, setSpareDispatchMachine] = useState<Machine | null>(null);
  const [driverDispatchMachine, setDriverDispatchMachine] = useState<Machine | null>(null);
  const [spareCampaigns, setSpareCampaigns] = useState<DispatchCampaign[]>([]);
  const [driverCampaigns, setDriverCampaigns] = useState<OwnerDriverOfferWithApps[]>([]);
  const [closingOfferDriverKey, setClosingOfferDriverKey] = useState<string | null>(null);

  // Fetch live machines from Supabase
  const loadMachines = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    let mapped: Machine[] = [];

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          setIsError(true);
          toast.error(t(mapDatabaseError(error)));
          return;
        }

        if (data) {
        mapped = data.map((m: any) => ({
          id: m.id,
          owner_id: m.owner_id,
          title_ar: m.title_ar,
          title_fr: m.title_fr,
          description_ar: m.description_ar,
          description_fr: m.description_fr,
          category: m.category,
          category_id: m.category,
          brand: m.brand,
          model: m.model,
          year: m.year,
          listing_mode: m.listing_mode,
          condition: m.condition === 'new' ? 'new' : 'good',
          city: m.city,
          city_id: m.city,
          lat: m.lat,
          lng: m.lng,
          location_lat: m.lat,
          location_lng: m.lng,
          rate_hourly: Number(m.hourly_rate) || 0,
          rate_daily: Number(m.daily_rate) || 0,
          rate_weekly: Number(m.weekly_rate) || 0,
          hourly_rate: Number(m.hourly_rate) || 0,
          daily_rate: Number(m.daily_rate) || 0,
          weekly_rate: Number(m.weekly_rate) || 0,
          sale_price: Number(m.sale_price) || 0,
          currency: 'MAD',
          with_operator: Boolean(m.with_operator),
          fuel_included: Boolean(m.fuel_included),
          delivery_available: Boolean(m.delivery_available),
          status: m.is_published ? 'available' : 'inactive',
          is_published: m.is_published,
          images: m.images || [],
          specs: m.specs || {},
          views_count: m.views_count || 0,
          rating_avg: m.rating_avg || 0,
          reviews_count: m.reviews_count || 0,
          created_at: m.created_at,
          updated_at: m.created_at,
        }));
        }
      }
    } catch (err: any) {
      console.warn('Machines load notice:', err);
    } finally {
      const merged = machineStore.mergeMachines(mapped, user.id);
      setMachines(merged);
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMachines();

    const handleUpdate = () => {
      loadMachines();
    };
    window.addEventListener('jadijcb_machines_updated', handleUpdate);
    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
    };
  }, [loadMachines]);

  // Load & sync spare-part dispatch campaigns launched by this owner
  useEffect(() => {
    const ownerUid = user?.id || profile?.id;
    if (!ownerUid) return;

    let cancelled = false;
    const loadSpareCampaigns = async () => {
      const list = await fetchContractorCampaigns(ownerUid);
      const filtered = list.filter(
        (c) =>
          c.campaign_type === 'spare_part' ||
          Boolean(c.part_reference) ||
          c.machine_category === 'spare-parts'
      );
      if (!cancelled) setSpareCampaigns(filtered);
    };

    loadSpareCampaigns();
    const unsubLocal = subscribeLocalDispatchEvents(() => {
      loadSpareCampaigns();
    });

    let channel: any = null;
    if (isSupabaseConfigured && user?.id) {
      channel = supabase
        .channel(`owner_spare_campaigns_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'dispatch_notifications',
            filter: `contractor_id=eq.${user.id}`,
          },
          () => loadSpareCampaigns()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'dispatch_campaigns',
            filter: `contractor_id=eq.${user.id}`,
          },
          () => loadSpareCampaigns()
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      unsubLocal();
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.id]);

  // Load & sync owner's Driver Search Campaigns & Applications
  useEffect(() => {
    const ownerUid = user?.id || profile?.id;
    if (!ownerUid) return;

    let cancelled = false;
    const loadDriverCampaigns = async () => {
      const list = await fetchOwnerDriverOffers(ownerUid);
      if (!cancelled) setDriverCampaigns(list);
    };

    loadDriverCampaigns();
    const onLocalUpdated = () => loadDriverCampaigns();
    window.addEventListener('jadijcb_driver_offers_updated', onLocalUpdated);

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`owner_driver_campaigns_${ownerUid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_job_applications' },
          () => loadDriverCampaigns()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_job_offers',
            filter: `owner_id=eq.${ownerUid}`,
          },
          () => loadDriverCampaigns()
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('jadijcb_driver_offers_updated', onLocalUpdated);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.id]);

  // Auto-open edit modal if ?edit=machineId query parameter exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId && machines.length > 0) {
      const target = machines.find((m) => m.id === editId);
      if (target) {
        setSelectedMachineToEdit(target);
        setIsStepperOpen(true);
      }
    }
  }, [machines]);

  const handleOpenAdd = () => {
    setSelectedMachineToEdit(null);
    setIsStepperOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setSelectedMachineToEdit(machine);
    setIsStepperOpen(true);
  };

  const handleTogglePublish = async (machine: Machine) => {
    const nextStatus = !machine.is_published;

    const { data, error } = await supabase
      .from('machines')
      .update({ is_published: nextStatus })
      .eq('id', machine.id)
      .select()
      .single();

    if (error) {
      const errKey = mapDatabaseError(error);
      toast.error(t(errKey));
      return; // STOP! No optimistic state update, no success toast!
    }

    // Reload the list from the database
    await loadMachines();

    toast.success(
      nextStatus
        ? lang === 'fr'
          ? 'Engin publié avec succès sur la marketplace'
          : 'تم نشر الآلية وإظهارها للعموم في السوق'
        : lang === 'fr'
        ? 'Engin masqué de la marketplace'
        : 'تم إخفاء الآلية من السوق العام'
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('machines.delete_confirm'))) return;

    try {
      await supabase
        .from('machines')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('Machine delete remote notice:', e);
    }

    machineStore.deleteMachine(id);
    await loadMachines();

    toast.success(
      lang === 'fr' ? 'Engin supprimé définitivement' : 'تم حذف الآلية من أسطولك'
    );
  };

  const handleSaved = async () => {
    setIsStepperOpen(false);
    await loadMachines();
  };

  // Filtered List
  const filteredMachines = machines.filter((m) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'rent'
        ? m.listing_mode === 'rent'
        : activeFilter === 'sale'
        ? m.listing_mode === 'sale'
        : activeFilter === 'spare'
        ? m.category_id === 'spare-parts' || m.category === 'spare-parts'
        : true;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      m.title_ar.toLowerCase().includes(searchLower) ||
      m.title_fr.toLowerCase().includes(searchLower) ||
      m.brand.toLowerCase().includes(searchLower) ||
      m.model.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const rentCount = machines.filter((m) => m.listing_mode === 'rent').length;
  const saleCount = machines.filter((m) => m.listing_mode === 'sale').length;
  const spareCount = machines.filter(
    (m) => m.category_id === 'spare-parts' || m.category === 'spare-parts'
  ).length;

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {t('machines.manage_title')}
          </h1>
          <p className="text-xs text-steel-500 mt-0.5">
            {t('machines.manage_subtitle')}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-black shadow-md min-h-[44px]"
        >
          {t('machines.add_machine')}
        </Button>
      </div>

      {/* KPI Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-steel-200">
          <span className="text-[11px] font-bold text-steel-500 block">
            {t('machines.filter_all')}
          </span>
          <span className="text-xl font-black text-ink font-mono latin-nums">
            {machines.length}
          </span>
        </Card>

        <Card className="p-3.5 bg-white border border-steel-200">
          <span className="text-[11px] font-bold text-steel-500 block">
            {t('machines.filter_rent')}
          </span>
          <span className="text-xl font-black text-ink font-mono latin-nums">
            {rentCount}
          </span>
        </Card>

        <Card className="p-3.5 bg-white border border-steel-200">
          <span className="text-[11px] font-bold text-steel-500 block">
            {t('machines.filter_sale')}
          </span>
          <span className="text-xl font-black text-ink font-mono latin-nums">
            {saleCount}
          </span>
        </Card>

        <Card className="p-3.5 bg-white border border-steel-200">
          <span className="text-[11px] font-bold text-steel-500 block">
            {t('machines.filter_spare')}
          </span>
          <span className="text-xl font-black text-ink font-mono latin-nums">
            {spareCount}
          </span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 bg-white border border-steel-200 shadow-soft">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="w-full md:w-80">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Rechercher par marque, modèle ou nom...'
                  : 'بحث بالماركة، الموديل أو اسم الآلية...'
              }
              startIcon={<Search className="w-4 h-4 text-steel-400" />}
              className="text-xs min-h-[40px]"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-primary text-ink shadow-sm'
                  : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {t('machines.filter_all')}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('rent')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                activeFilter === 'rent'
                  ? 'bg-primary text-ink shadow-sm'
                  : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {t('machines.filter_rent')}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('sale')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                activeFilter === 'sale'
                  ? 'bg-primary text-ink shadow-sm'
                  : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {t('machines.filter_sale')}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('spare')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                activeFilter === 'spare'
                  ? 'bg-primary text-ink shadow-sm'
                  : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {t('machines.filter_spare')}
            </button>
          </div>
        </div>
      </Card>

      {/* Error State with Retry */}
      {isError && (
        <Card className="p-8 text-center bg-red-50/50 border border-red-200">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">
            {lang === 'fr'
              ? 'Erreur lors du chargement des engins'
              : 'حدث خطأ أثناء تحميل قائمة الآليات'}
          </h3>
          <p className="text-xs text-steel-500 mb-4">
            {lang === 'fr'
              ? 'Impossible de récupérer votre flotte. Veuillez vérifier votre connexion.'
              : 'تعذر الاتصال بقاعدة البيانات. يرجى إعادة المحاولة.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMachines}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </Card>
      )}

      {/* Skeletons Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="p-4 sm:p-5 bg-white border border-steel-200 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <Skeleton className="w-20 h-20 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Skeleton className="h-9 w-24 rounded-xl" />
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <Skeleton className="h-9 w-9 rounded-xl" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Machines List */}
      {!isLoading && !isError && (
        <div className="space-y-3">
          {filteredMachines.length === 0 ? (
            <Card className="p-10 text-center bg-white border border-steel-200">
              <Truck className="w-12 h-12 text-steel-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink mb-1">
                {lang === 'fr' ? 'Aucun engin trouvé' : 'لم يتم العثور على آليات'}
              </h3>
              <p className="text-xs text-steel-500 mb-4">
                {lang === 'fr'
                  ? 'Ajoutez votre première machine pour commencer à recevoir des demandes'
                  : 'أضف أول آلية في أسطولك لبدء استقبال طلبات الكراء والشراء'}
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenAdd}
                leftIcon={<Plus className="w-4 h-4" />}
                className="font-bold"
              >
                {t('machines.add_machine')}
              </Button>
            </Card>
          ) : (
            filteredMachines.map((machine) => {
              const isSpare =
                machine.category_id === 'spare-parts' || machine.category === 'spare-parts';
              const isPublished = machine.is_published !== false;

              return (
                <Card
                  key={machine.id}
                  className="p-4 sm:p-5 bg-white border border-steel-200 hover:shadow-md transition-all rounded-2xl"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Left: Thumbnail & Info */}
                    <div className="flex items-start sm:items-center gap-3.5 w-full sm:w-auto">
                      <Link
                        to={`/marketplace/${machine.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 group"
                        title={lang === 'fr' ? 'معاينة في صفحة المنتج' : 'معاينة في صفحة المنتج'}
                      >
                        <img
                          src={machine.images[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400&q=80'}
                          alt={machine.title_ar}
                          className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover border border-steel-200 shrink-0 bg-steel-100 group-hover:opacity-90 transition-opacity"
                        />
                      </Link>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/marketplace/${machine.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-black text-sm text-ink hover:text-primary-dark transition-colors flex items-center gap-1 group"
                            title={lang === 'fr' ? 'Aperçu sur la page produit' : 'معاينة الآلية في صفحة المنتج'}
                          >
                            <span>{lang === 'fr' ? machine.title_fr : machine.title_ar}</span>
                            <ExternalLink className="w-3 h-3 text-steel-400 group-hover:text-primary-dark transition-colors" />
                          </Link>

                          <Badge
                            variant={machine.listing_mode === 'sale' ? 'neutral' : 'warning'}
                            size="sm"
                          >
                            {isSpare
                              ? t('machines.filter_spare')
                              : machine.listing_mode === 'sale'
                              ? t('machines.mode_sale_option')
                              : t('machines.mode_rent_option')}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel-500 mb-1.5">
                          <span className="font-bold text-ink">
                            {machine.brand} {machine.model} ({machine.year})
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-steel-400" />
                            {machine.city || 'Maroc'}
                          </span>
                          {machine.condition && (
                            <span className="text-[11px] bg-steel-100 text-steel-700 px-2 py-0.5 rounded">
                              {machine.condition === 'new'
                                ? t('machines.condition_new')
                                : t('machines.condition_used')}
                            </span>
                          )}
                        </div>

                        {/* Badges: with operator / fuel / delivery */}
                        <div className="flex flex-wrap items-center gap-2">
                          {machine.with_operator && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('marketplace.with_operator')}
                            </span>
                          )}
                          {machine.fuel_included && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                              {t('marketplace.filter_fuel')}
                            </span>
                          )}
                          {machine.delivery_available && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                              {t('marketplace.filter_delivery')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Pricing & Quick Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-steel-100">
                      {/* Price Tag */}
                      <div className="text-start sm:text-end">
                        {machine.listing_mode === 'sale' ? (
                          <>
                            <span className="text-[11px] text-steel-500 block">
                              {t('machines.sale_price_label')}
                            </span>
                            <span className="font-black text-sm sm:text-base text-ink font-mono latin-nums">
                              {formatPriceMAD(machine.sale_price || 0)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] text-steel-500 block">
                              {t('machines.daily_rate_label')}
                            </span>
                            <span className="font-black text-sm sm:text-base text-ink font-mono latin-nums">
                              {formatPriceMAD(machine.rate_daily || machine.daily_rate || 0)}
                              <span className="text-xs font-normal text-steel-500">
                                /{t('marketplace.per_day')}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Toggle Publish */}
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(machine)}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                            isPublished
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-steel-100 text-steel-500 border-steel-200 hover:bg-steel-200'
                          }`}
                          title={
                            isPublished
                              ? lang === 'fr'
                                ? 'En ligne sur la marketplace (cliquez pour masquer)'
                                : 'معروض في السوق (انقر للإخفاء)'
                              : lang === 'fr'
                              ? 'Masqué (cliquez pour publier)'
                              : 'مخفي (انقر للنشر)'
                          }
                          aria-label="Toggle publish"
                        >
                          {isPublished ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>

                        {/* Preview on Public Product Page (زر معاينة الآلية في صفحة المنتج) */}
                        <Link
                          to={`/marketplace/${machine.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center group"
                          title={lang === 'fr' ? 'Aperçu sur la page produit' : 'معاينة الآلية في صفحة المنتج'}
                          aria-label={lang === 'fr' ? 'Aperçu sur la page produit' : 'معاينة الآلية في صفحة المنتج'}
                        >
                          <ExternalLink className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
                        </Link>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(machine)}
                          className="p-2 rounded-xl bg-steel-100 text-steel-700 hover:bg-steel-200 border border-steel-200 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title={t('machines.edit_machine')}
                          aria-label={t('machines.edit_machine')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(machine.id)}
                          className="p-2 rounded-xl bg-red-50 text-danger hover:bg-red-100 border border-red-200 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Direct Driver & Spare-Part Live Search Campaign Buttons (for machinery rows) */}
                  {!isSpare && (
                    <div className="mt-3 pt-3 border-t border-steel-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="text-[11px] text-steel-500 font-medium">
                        {lang === 'fr'
                          ? 'Besoin urgent d’un conducteur ou d’une pièce pour cet engin ?'
                          : 'تحتاج سائقاً أو قطعة غيار مستعجلة لهذه الآلية؟'}
                      </span>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDriverDispatchMachine(machine)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-xs border border-ink/20 transition-all shadow-xs cursor-pointer min-h-[42px]"
                        >
                          <HardHat className="w-4 h-4 shrink-0" />
                          <span>
                            {lang === 'fr' ? 'Rechercher un conducteur' : 'إبحث عن سائق'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSpareDispatchMachine(machine)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-ink hover:bg-steel-800 text-primary font-black text-xs border border-ink transition-all shadow-xs cursor-pointer min-h-[42px]"
                        >
                          <Radio className="w-4 h-4 shrink-0" />
                          <span>
                            {lang === 'fr' ? 'Rechercher une pièce' : 'إبحث عن قطعة غيار'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Owner's Launched Spare-Part Live Dispatch Campaigns Tracker */}
      {spareCampaigns.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-dark shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Campagnes directes de recherche de pièces lancées'
                  : 'حملات البحث المباشر عن قطع الغيار'}
              </span>
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 tabular-nums">
              {spareCampaigns.filter((c) => c.status === 'active').length}{' '}
              {lang === 'fr' ? 'actives' : 'نشطة'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spareCampaigns.map((camp) => {
              const acceptedNotifs = (camp.notifications || []).filter((n) => n.status === 'accepted');
              const isClosed = camp.status === 'closed';
              const hasDealWon = Boolean(camp.won_owner_id);

              return (
                <Card
                  key={camp.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    hasDealWon
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-soft'
                      : isClosed
                      ? 'bg-steel-50/70 border-steel-200 opacity-90'
                      : 'bg-white border-amber-300 shadow-soft'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                            hasDealWon
                              ? 'bg-emerald-600 text-white'
                              : isClosed
                              ? 'bg-steel-200 text-steel-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {hasDealWon ? (
                            <>
                              <Handshake className="w-3 h-3" />
                              <span>{lang === 'fr' ? 'Accord conclu' : 'تم الاتفاق'}</span>
                            </>
                          ) : isClosed ? (
                            lang === 'fr' ? 'Clôturée' : 'مغلقة'
                          ) : lang === 'fr' ? (
                            'En diffusion live'
                          ) : (
                            'نشطة الآن'
                          )}
                        </span>

                        {camp.part_reference && (
                          <span
                            dir="ltr"
                            className="px-2 py-0.5 rounded-lg bg-ink text-primary text-[10px] font-mono font-black"
                          >
                            Réf: {camp.part_reference}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-steel-100 text-steel-700 text-[10px] font-bold tabular-nums">
                          {camp.is_nationwide ? (
                            <>
                              <Globe className="w-3 h-3 text-primary-dark" />
                              <span>{lang === 'fr' ? 'Tout le Maroc' : 'المغرب كاملاً'}</span>
                            </>
                          ) : (
                            <span>
                              {lang === 'fr' ? `Rayon ${camp.radius_km} km` : `نطاق ${camp.radius_km} كم`}
                            </span>
                          )}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-ink mt-1.5">{camp.machine_name}</h3>
                      <p className="text-[11px] text-steel-500 font-bold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{camp.site_name}</span>
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-xs font-black text-primary-dark font-mono tabular-nums block">
                        {camp.matched_owners_count}{' '}
                        {lang === 'fr' ? 'fournisseurs' : 'مورد'}
                      </span>
                      <span className="text-[10px] text-steel-400 font-mono" dir="ltr">
                        {camp.created_at?.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  {hasDealWon ? (
                    <div className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{camp.won_machine_title || camp.machine_name}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => navigate('/owner/bookings')}
                          leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
                          className="text-[11px] min-h-[38px]"
                        >
                          {lang === 'fr' ? 'Voir commande' : 'عرض الطلب'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/owner/messages?target=${camp.won_owner_id}&machine=${camp.won_machine_id || ''}&campaign=${camp.id}`
                            )
                          }
                          leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                          className="text-[11px] min-h-[38px]"
                        >
                          {lang === 'fr' ? 'Chat fournisseur' : 'محادثة المورد'}
                        </Button>
                      </div>
                    </div>
                  ) : acceptedNotifs.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-steel-100">
                      <p className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {lang === 'fr'
                            ? `${acceptedNotifs.length} fournisseur(s) intéressé(s) !`
                            : `استجاب ${acceptedNotifs.length} مورد(ين) لطلب القطعة!`}
                        </span>
                      </p>
                      {acceptedNotifs.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 text-xs">
                            <p className="font-black text-ink truncate">
                              {n.matched_machine_title || camp.machine_name}
                            </p>
                            {n.distance_km != null && (
                              <span className="text-[10px] text-emerald-800 font-bold tabular-nums">
                                {lang === 'fr' ? 'À' : 'على بعد'} {Math.round(n.distance_km)}{' '}
                                {lang === 'fr' ? 'km' : 'كم'}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/owner/messages?target=${n.owner_id}&machine=${n.machine_id || ''}&campaign=${camp.id}`
                              )
                            }
                            leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                            className="shrink-0 text-[11px] min-h-[38px]"
                          >
                            {lang === 'fr' ? 'Discuter' : 'محادثة المورد'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-steel-500 pt-2 border-t border-steel-100">
                      {camp.matched_owners_count > 0
                        ? lang === 'fr'
                          ? 'Alerte envoyée aux fournisseurs de pièces. En attente de réponse...'
                          : 'تم إرسال التنبيه لموردي قطع الغيار في النطاق وفي انتظار تفاعلهم...'
                        : lang === 'fr'
                        ? 'Aucun fournisseur trouvé dans ce périmètre.'
                        : 'لم يتم رصد موردي قطع غيار داخل هذا النطاق وقت الإرسال.'}
                    </p>
                  )}

                  {!isClosed && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await closeDispatchCampaign(camp.id);
                          setSpareCampaigns((prev) =>
                            prev.map((c) => (c.id === camp.id ? { ...c, status: 'closed' } : c))
                          );
                          toast.info(lang === 'fr' ? 'Campagne clôturée' : 'تم إغلاق حملة البحث');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-steel-500 hover:text-rose-600 transition-colors cursor-pointer py-1 px-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Clôturer la campagne' : 'إغلاق الحملة'}</span>
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Owner's Launched Driver Search Campaigns Tracker */}
      {driverCampaigns.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary-dark shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Campagnes directes de recherche de conducteurs'
                  : 'حملات البحث المباشر عن سائقين'}
              </span>
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 tabular-nums">
              {driverCampaigns.filter((c) => c.status === 'open').length}{' '}
              {lang === 'fr' ? 'actives' : 'نشطة'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {driverCampaigns.map((camp) => {
              const isClosed = camp.status === 'closed';
              const isDealAccepted = camp.status === 'accepted';
              const isInactive = isClosed || isDealAccepted;
              return (
                <Card
                  key={camp.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDealAccepted
                      ? 'bg-emerald-50/45 border-emerald-400 shadow-soft'
                      : camp.applications.length > 0
                      ? 'bg-emerald-50/35 border-emerald-300 shadow-soft'
                      : isClosed
                      ? 'bg-steel-50/70 border-steel-200 opacity-90'
                      : 'bg-white border-amber-300 shadow-soft'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                            isDealAccepted
                              ? 'bg-emerald-600 text-white'
                              : isClosed
                              ? 'bg-steel-200 text-steel-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isDealAccepted ? (
                            <>
                              <Handshake className="w-3 h-3" />
                              <span>
                                {lang === 'fr' ? 'Accord conclu' : 'تم إغلاق الصفقة'}
                              </span>
                            </>
                          ) : isClosed ? (
                            lang === 'fr' ? (
                              'Clôturée'
                            ) : (
                              'مغلقة'
                            )
                          ) : lang === 'fr' ? (
                            'En diffusion live'
                          ) : (
                            'نشطة الآن'
                          )}
                        </span>

                        {camp.offered_salary > 0 && (
                          <span
                            dir="ltr"
                            className="px-2 py-0.5 rounded-lg bg-ink text-primary text-[10px] font-mono font-black tabular-nums"
                          >
                            {camp.offered_salary.toLocaleString('fr-FR')}{' '}
                            {lang === 'fr' ? 'MAD' : 'د.م'}/
                            {camp.salary_unit === 'month'
                              ? lang === 'fr'
                                ? 'mois'
                                : 'شهر'
                              : lang === 'fr'
                              ? 'jour'
                              : 'يوم'}
                          </span>
                        )}

                        {camp.duration_label && (
                          <span className="px-2 py-0.5 rounded-lg bg-steel-100 text-steel-700 text-[10px] font-bold">
                            {camp.duration_label}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-ink mt-1.5">
                        {lang === 'fr' ? camp.machine_label_fr : camp.machine_label_ar}
                      </h3>
                      <p className="text-[11px] text-steel-500 font-bold flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>
                          {isDealAccepted
                            ? lang === 'fr'
                              ? 'Offre retirée de la liste publique après accord'
                              : 'تم إغلاق العرض وإزالته من لائحة عروض العمل'
                            : lang === 'fr'
                            ? 'Diffusée à tous les conducteurs de cet engin'
                            : 'معروضة لجميع السائقين المسجلين بهذه الآلية'}
                        </span>
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      {camp.matched_drivers_count != null && (
                        <span className="text-xs font-black text-primary-dark font-mono tabular-nums block">
                          {camp.matched_drivers_count}{' '}
                          {lang === 'fr' ? 'notifiés' : 'سائق'}
                        </span>
                      )}
                      <span className="text-[10px] text-steel-400 font-mono" dir="ltr">
                        {camp.created_at?.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  {camp.applications.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-steel-100">
                      <p className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {lang === 'fr'
                            ? `${camp.applications.length} conducteur(s) intéressé(s) !`
                            : `تقدم ${camp.applications.length} سائق(ين) لهذا العرض!`}
                        </span>
                      </p>

                      {camp.applications.map((app) => {
                        const exp = getDriverExperienceOption(app.driver_experience);
                        const actionKey = `${camp.id}::${app.driver_id}`;
                        const isAppWon = app.status === 'accepted';
                        return (
                          <div
                            key={app.id}
                            className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                              isAppWon
                                ? 'bg-white border-emerald-400 shadow-2xs'
                                : 'bg-emerald-50 border-emerald-200'
                            }`}
                          >
                            <div className="min-w-0 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-black text-ink truncate">{app.driver_name}</p>
                                {isAppWon && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black">
                                    <Handshake className="w-3 h-3" />
                                    {lang === 'fr' ? 'Retenu' : 'تم الاتفاق معه'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-steel-600 font-bold">
                                {app.driver_city || 'المغرب'} ·{' '}
                                {lang === 'fr' ? exp.shortFr : exp.shortAr}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              {!isInactive && (
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  isLoading={closingOfferDriverKey === actionKey}
                                  onClick={async () => {
                                    const ownerUid = user?.id || profile?.id || '';
                                    if (!ownerUid || !app.driver_id) return;
                                    setClosingOfferDriverKey(actionKey);
                                    try {
                                      await finalizeDriverJobOfferDirect({
                                        offer: camp,
                                        ownerId: ownerUid,
                                        ownerName: profile?.full_name || camp.owner_name,
                                        driverId: app.driver_id,
                                        driverName: app.driver_name,
                                        driverPhone: app.driver_phone,
                                        driverCity: app.driver_city,
                                      });
                                      setDriverCampaigns((prev) =>
                                        prev.map((c) =>
                                          c.id === camp.id
                                            ? {
                                                ...c,
                                                status: 'accepted',
                                                applications: c.applications.map((a) =>
                                                  a.driver_id === app.driver_id
                                                    ? { ...a, status: 'accepted' }
                                                    : a
                                                ),
                                              }
                                            : c
                                        )
                                      );
                                      toast.success(
                                        lang === 'fr'
                                          ? 'Accord conclu ! L’offre est clôturée dans la liste des offres.'
                                          : 'تم إغلاق الصفقة بنجاح وأُغلق العرض في لائحة عروض العمل!'
                                      );
                                    } finally {
                                      setClosingOfferDriverKey(null);
                                    }
                                  }}
                                  leftIcon={<Handshake className="w-3.5 h-3.5" />}
                                  className="text-[11px] min-h-[36px] font-black"
                                >
                                  {lang === 'fr' ? 'Clôturer l’accord' : 'إغلاق الصفقة'}
                                </Button>
                              )}

                              <Button
                                type="button"
                                variant={isInactive ? 'primary' : 'outline'}
                                size="sm"
                                onClick={async () => {
                                  const ownerUid = user?.id || profile?.id || '';
                                  if (!ownerUid || !app.driver_id) return;
                                  const conv = await chatStore.getOrCreateConversation(
                                    ownerUid,
                                    app.driver_id,
                                    null,
                                    {
                                      id: app.driver_id,
                                      full_name: app.driver_name,
                                      phone: app.driver_phone,
                                      city: app.driver_city,
                                      role: 'driver',
                                    }
                                  );
                                  navigate(
                                    `/owner/messages?conv=${encodeURIComponent(
                                      conv.id
                                    )}&offer=${encodeURIComponent(camp.id)}`
                                  );
                                }}
                                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                                className="text-[11px] min-h-[36px]"
                              >
                                {lang === 'fr' ? 'Discuter' : 'محادثة'}
                              </Button>

                              {app.driver_phone && (
                                <a
                                  href={`tel:${app.driver_phone}`}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-steel-300 text-ink font-bold text-[11px] min-h-[36px]"
                                >
                                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-steel-500 pt-2 border-t border-steel-100">
                      {isDealAccepted
                        ? lang === 'fr'
                          ? 'Accord conclu avec le conducteur et offre clôturée.'
                          : 'تم إغلاق الصفقة مع السائق وإغلاق العرض.'
                        : lang === 'fr'
                        ? 'Alerte envoyée aux conducteurs qualifiés. En attente de candidatures...'
                        : 'تم بث العرض للسائقين المسجلين بهذه الآلية وفي انتظار تفاعلهم...'}
                    </p>
                  )}

                  {!isInactive && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await closeDriverJobOffer(camp.id);
                          setDriverCampaigns((prev) =>
                            prev.map((c) => (c.id === camp.id ? { ...c, status: 'closed' } : c))
                          );
                          toast.info(
                            lang === 'fr' ? 'Offre conducteur clôturée' : 'تم إغلاق عرض السائق'
                          );
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-steel-500 hover:text-rose-600 transition-colors cursor-pointer py-1 px-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Clôturer l’offre' : 'إغلاق العرض'}</span>
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Machine Stepper Modal */}
      <MachineStepperModal
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        machineToEdit={selectedMachineToEdit}
        onSave={handleSaved}
      />

      {/* Spare Parts Live Dispatch Modal */}
      <SparePartDispatchModal
        isOpen={Boolean(spareDispatchMachine)}
        onClose={() => setSpareDispatchMachine(null)}
        machine={spareDispatchMachine}
        onCampaignLaunched={(newCampaign) => {
          setSpareCampaigns((prev) => [newCampaign, ...prev]);
        }}
      />

      {/* Urgent Driver Live Dispatch Modal ("إبحث عن سائق") */}
      <DriverDispatchModal
        isOpen={Boolean(driverDispatchMachine)}
        onClose={() => setDriverDispatchMachine(null)}
        machine={driverDispatchMachine}
        onOfferLaunched={(newOffer) => {
          setDriverCampaigns((prev) => [{ ...newOffer, applications: [] }, ...prev]);
        }}
      />
    </div>
  );
};

export default MachinesPage;
