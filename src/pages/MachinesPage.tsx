// ============================================================================
// JADIJCB: Machines & Spare Parts CRUD Management Page
// ============================================================================

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine, ListingMode } from '../types/database';
import { MOCK_MACHINES } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const MachinesPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [machines, setMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [activeFilter, setActiveFilter] = useState<'all' | 'rent' | 'sale' | 'spare'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachineToEdit, setSelectedMachineToEdit] = useState<Machine | null>(null);
  const [isStepperOpen, setIsStepperOpen] = useState(false);

  // Fetch live machines from Supabase if connected
  useEffect(() => {
    async function loadMachines() {
      if (!isSupabaseConfigured || !user?.id) return;

      try {
        const { data, error } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: Machine[] = data.map((m: any) => ({
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
            specs: {
              operating_weight_ton: 8.5,
              engine_power_hp: 92,
              bucket_capacity_m3: 1.0,
            },
            views_count: m.views_count || 0,
            rating_avg: 5.0,
            reviews_count: 0,
            created_at: m.created_at,
            updated_at: m.created_at,
          }));

          setMachines(mapped);
        }
      } catch (err) {
        console.warn('Machine load notice:', err);
      }
    }

    loadMachines();
  }, [user]);

  const handleOpenAdd = () => {
    setSelectedMachineToEdit(null);
    setIsStepperOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setSelectedMachineToEdit(machine);
    setIsStepperOpen(true);
  };

  const handleSaveMachine = (saved: Machine) => {
    setMachines((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      if (exists) {
        return prev.map((m) => (m.id === saved.id ? saved : m));
      }
      return [saved, ...prev];
    });
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('machines')
          .update({ is_published: newStatus })
          .eq('id', id);
      } catch (err) {
        console.warn('Publish toggle notice:', err);
      }
    }

    setMachines((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              is_published: newStatus,
              status: newStatus ? 'available' : 'inactive',
            }
          : m
      )
    );

    toast.success(
      lang === 'fr'
        ? newStatus
          ? 'Annonce publiée sur la marketplace'
          : 'Annonce masquée de la marketplace'
        : newStatus
        ? 'تم نشر الآلية في السوق بنجاح'
        : 'تم إلغاء نشر الآلية من السوق'
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('machines.delete_confirm'))) return;

    if (isSupabaseConfigured) {
      try {
        await supabase.from('machines').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete machine notice:', err);
      }
    }

    setMachines((prev) => prev.filter((m) => m.id !== id));
    toast.success(
      lang === 'fr' ? 'Engin supprimé du parc' : 'تم حذف الآلية من الأسطول'
    );
  };

  // Filtered Machines
  const filteredMachines = machines.filter((item) => {
    const isSpare = item.category_id === 'spare-parts' || item.category === 'spare-parts';

    if (activeFilter === 'rent' && (item.listing_mode === 'sale' || isSpare)) return false;
    if (activeFilter === 'sale' && (item.listing_mode === 'rent' || isSpare)) return false;
    if (activeFilter === 'spare' && !isSpare) return false;

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const title = (item.title_ar + ' ' + item.title_fr + ' ' + item.brand + ' ' + item.model).toLowerCase();
    return title.includes(term);
  });

  return (
    <div className="space-y-6 text-start">
      {/* Header with Title and Add CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {t('machines.manage_title')}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {t('machines.manage_subtitle')}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-black shadow-md min-h-[44px]"
        >
          {t('machines.add_machine')}
        </Button>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4 bg-white border border-steel-200">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder={
                lang === 'fr'
                  ? 'Rechercher par marque, modèle (JCB, CAT...)...'
                  : 'بحث بالماركة، الموديل أو العنوان...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            />
            <Search className="w-4 h-4 text-steel-400 absolute start-3 top-3" />
          </div>

          {/* Mode/Category Filter Chips */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-ink text-white'
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

      {/* Machines List */}
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
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-steel-400" />
                          {machine.city || 'Casablanca'}
                        </span>
                        {machine.with_operator && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-bold">
                              {lang === 'fr' ? 'Chauffeur inclus' : 'مع سائق'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Pricing Tag */}
                      <div className="font-mono font-black text-sm text-ink">
                        {machine.listing_mode === 'sale' ? (
                          <span>
                            {machine.sale_price?.toLocaleString('fr-FR')} {t('common.mad')}
                          </span>
                        ) : (
                          <span>
                            {machine.rate_daily?.toLocaleString('fr-FR')} {t('common.mad')} / {lang === 'fr' ? 'jour' : 'يوم'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-steel-100">
                    {/* Publish/Hide Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(machine.id, isPublished)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] ${
                        isPublished
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-steel-200 bg-steel-100 text-steel-600 hover:bg-steel-200'
                      }`}
                      title={isPublished ? 'Masquer du public' : 'Publier'}
                    >
                      {isPublished ? (
                        <>
                          <Eye className="w-4 h-4 text-emerald-600" />
                          <span className="hidden md:inline">{lang === 'fr' ? 'En ligne' : 'منشور'}</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 text-steel-400" />
                          <span className="hidden md:inline">{lang === 'fr' ? 'Masqué' : 'معطل'}</span>
                        </>
                      )}
                    </button>

                    {/* Edit button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(machine)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      {t('common.edit')}
                    </Button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(machine.id)}
                      className="p-2 rounded-xl text-steel-400 hover:text-danger hover:bg-red-50 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Stepper Modal */}
      <MachineStepperModal
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        machineToEdit={selectedMachineToEdit}
        onSave={handleSaveMachine}
      />
    </div>
  );
};

export default MachinesPage;
