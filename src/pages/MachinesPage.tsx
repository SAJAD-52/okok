import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  MapPin,
  CheckCircle,
  Truck,
  Wrench,
  Search,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_MACHINES } from '../data/mockData';
import { EQUIPMENT_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES, getCityById } from '../data/cities';
import { formatPriceMAD } from '../data/rentalTerms';
import { Machine, MachineStatus } from '../types/database';

export const MachinesPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const [machines, setMachines] = useState<Machine[]>(MOCK_MACHINES.slice(0, 4));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [titleAr, setTitleAr] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [categoryId, setCategoryId] = useState('loader');
  const [brand, setBrand] = useState('JCB');
  const [model, setModel] = useState('3CX Eco');
  const [year, setYear] = useState(2023);
  const [cityId, setCityId] = useState('casablanca');
  const [rateDaily, setRateDaily] = useState(2500);
  const [rateHourly, setRateHourly] = useState(400);
  const [rateWeekly, setRateWeekly] = useState(15000);
  const [withOperator, setWithOperator] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      const newMachine: Machine = {
        id: `mach_${Date.now()}`,
        owner_id: 'user_1',
        title_ar: titleAr || `جرافة ${brand} ${model} بحالة ممتازة`,
        title_fr: titleFr || `${brand} ${model} en excellent état`,
        description_ar: 'آلية بحالة جيدة جداً جاهزة للعمل في الأوراش',
        description_fr: 'Machine en parfait état de fonctionnement prête pour vos chantiers',
        category_id: categoryId,
        brand,
        model,
        year: Number(year),
        condition: 'excellent',
        city_id: cityId,
        location_lat: 33.5731,
        location_lng: -7.5898,
        rate_hourly: Number(rateHourly),
        rate_daily: Number(rateDaily),
        rate_weekly: Number(rateWeekly),
        currency: 'MAD',
        with_operator: withOperator,
        fuel_included: false,
        delivery_available: true,
        status: 'available',
        images: [
          'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop',
        ],
        specs: {
          operating_weight_ton: 8.5,
          bucket_capacity_m3: 1.0,
          engine_power_hp: 95,
          fuel_type: 'diesel',
        },
        views_count: 1,
        rating_avg: 5.0,
        reviews_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMachines([newMachine, ...machines]);
      setIsSaving(false);
      setIsAddModalOpen(false);
      toast.success(
        lang === 'fr'
          ? 'Engin ajouté à votre parc avec succès !'
          : 'تمت إضافة الآلية إلى أسطولك بنجاح!'
      );
    }, 500);
  };

  const handleToggleStatus = (id: string, newStatus: MachineStatus) => {
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
    );
    toast.info(lang === 'fr' ? 'Statut mis à jour' : 'تم تحديث حالة الآلية');
  };

  const handleDeleteMachine = (id: string) => {
    if (confirm(lang === 'fr' ? 'Supprimer cet engin ?' : 'هل أنت متأكد من حذف الآلية؟')) {
      setMachines((prev) => prev.filter((m) => m.id !== id));
      toast.success(lang === 'fr' ? 'Engin supprimé' : 'تم حذف الآلية');
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
            {t('dashboard.my_fleet')}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Gérez vos engins, leurs disponibilités et grilles tarifaires'
              : 'إدارة وتحديث آليات أسطولك، حالتها التشغيلية وأسعار الكراء'}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-bold self-start sm:self-auto"
        >
          {t('dashboard.quick_add_machine')}
        </Button>
      </div>

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {machines.map((machine) => {
          const city = getCityById(machine.city_id);

          return (
            <Card key={machine.id} className="p-5 flex flex-col justify-between">
              <div className="flex items-start gap-4">
                <div className="w-24 h-20 rounded-xl overflow-hidden bg-steel-100 shrink-0">
                  <img
                    src={machine.images[0]}
                    alt={lang === 'fr' ? machine.title_fr : machine.title_ar}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="primary" size="sm">
                      {machine.brand}
                    </Badge>
                    <Badge
                      variant={
                        machine.status === 'available'
                          ? 'success'
                          : machine.status === 'rented'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {machine.status === 'available'
                        ? t('dashboard.status_available')
                        : machine.status === 'rented'
                        ? t('dashboard.status_rented')
                        : t('dashboard.status_maintenance')}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm text-ink truncate">
                    {lang === 'fr' ? machine.title_fr : machine.title_ar}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-steel-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{city ? (lang === 'fr' ? city.name_fr : city.name_ar) : machine.city_id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono latin-nums font-bold text-ink">
                      {formatPriceMAD(machine.rate_daily, lang)} / {lang === 'fr' ? 'j' : 'ي'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Switcher & Actions */}
              <div className="pt-4 mt-4 border-t border-steel-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={machine.status}
                    onChange={(e) =>
                      handleToggleStatus(machine.id, e.target.value as MachineStatus)
                    }
                    className="text-xs font-semibold py-1.5 px-2 bg-surface border border-steel-200 rounded-lg text-steel-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="available">{t('dashboard.status_available')}</option>
                    <option value="rented">{t('dashboard.status_rented')}</option>
                    <option value="maintenance">{t('dashboard.status_maintenance')}</option>
                    <option value="inactive">{t('dashboard.status_inactive')}</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDeleteMachine(machine.id)}
                    className="p-2 text-steel-400 hover:text-danger rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Machine Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('dashboard.quick_add_machine')}
        description={lang === 'fr' ? 'Renseignez les détails de votre équipement BTP' : 'أدخل مواصفات الآلية وشروط الكراء'}
        maxWidth="lg"
      >
        <form onSubmit={handleAddMachine} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={lang === 'fr' ? 'Titre en Arabe' : 'عنوان الإعلان بالعربية'}
              placeholder="مثال: جرافة JCB 3CX موديل 2023"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              required
            />
            <Input
              label={lang === 'fr' ? 'Titre en Français' : 'عنوان الإعلان بالفرنسية'}
              placeholder="ex. Tractopelle JCB 3CX 2023"
              value={titleFr}
              onChange={(e) => setTitleFr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={t('marketplace.filter_category')}
              options={EQUIPMENT_CATEGORIES.map((c) => ({
                value: c.slug,
                label: lang === 'fr' ? c.name_fr : c.name_ar,
              }))}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            />
            <Input
              label={lang === 'fr' ? 'Marque' : 'الماركة'}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="JCB, Caterpillar, Komatsu..."
              required
            />
            <Input
              label={lang === 'fr' ? 'Modèle' : 'الموديل'}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="3CX, 320D, D85..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="number"
              label={lang === 'fr' ? 'Année' : 'سنة الصنع'}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
            <Select
              label={t('marketplace.filter_city')}
              options={MOROCCAN_CITIES.map((c) => ({
                value: c.id,
                label: lang === 'fr' ? c.name_fr : c.name_ar,
              }))}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              type="number"
              label={lang === 'fr' ? 'Tarif journalier (MAD)' : 'السعر اليومي (د.م)'}
              value={rateDaily}
              onChange={(e) => setRateDaily(Number(e.target.value))}
              required
            />
            <Input
              type="number"
              label={lang === 'fr' ? 'Tarif horaire (MAD)' : 'السعر بالساعة (د.م)'}
              value={rateHourly}
              onChange={(e) => setRateHourly(Number(e.target.value))}
              required
            />
            <Input
              type="number"
              label={lang === 'fr' ? 'Tarif hebdomadaire (MAD)' : 'السعر بالأسبوع (د.م)'}
              value={rateWeekly}
              onChange={(e) => setRateWeekly(Number(e.target.value))}
              required
            />
          </div>

          <div className="pt-2 border-t border-steel-100 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-steel-700 cursor-pointer">
              <input
                type="checkbox"
                checked={withOperator}
                onChange={(e) => setWithOperator(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <span>{t('marketplace.with_operator')}</span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center font-bold"
            isLoading={isSaving}
          >
            {t('common.save')}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default MachinesPage;
