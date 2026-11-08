// ============================================================================
// JADIJCB: Machines & Spare Parts CRUD Management Page
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Truck,
  Wrench,
  Tag,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine, ListingMode } from '../types/database';
import { formatPriceMAD } from '../data/rentalTerms';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mapDatabaseError } from '../lib/errorHelpers';
import { machineStore } from '../lib/machineStore';

export const MachinesPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'rent' | 'sale' | 'spare'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachineToEdit, setSelectedMachineToEdit] = useState<Machine | null>(null);
  const [isStepperOpen, setIsStepperOpen] = useState(false);

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
                      <img
                        src={machine.images[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400&q=80'}
                        alt={machine.title_ar}
                        className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover border border-steel-200 shrink-0 bg-steel-100"
                      />

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-ink hover:text-primary-dark transition-colors">
                            {lang === 'fr' ? machine.title_fr : machine.title_ar}
                          </span>

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
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Machine Stepper Modal */}
      <MachineStepperModal
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        machineToEdit={selectedMachineToEdit}
        onSave={handleSaved}
      />
    </div>
  );
};

export default MachinesPage;
