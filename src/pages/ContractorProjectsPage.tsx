// ============================================================================
// JADIJCB: Contractor Job Sites & Projects Management (أوراش ومشاريع المقاولة)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  MapPin,
  Plus,
  Trash2,
  Compass,
  Phone,
  User,
  Sparkles,
  Building,
  CheckCircle,
  X,
} from 'lucide-react';
import { ContractorSite, MoroccanCity } from '../types/database';
import { MOROCCAN_CITIES } from '../data/cities';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

export const ContractorProjectsPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sites, setSites] = useState<ContractorSite[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Site Form
  const [siteName, setSiteName] = useState('');
  const [city, setCity] = useState('الدار البيضاء');
  const [address, setAddress] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('+2126');
  const [lat, setLat] = useState<number>(33.5731);
  const [lng, setLng] = useState<number>(-7.5898);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jadijcb_contractor_sites');
      if (stored) {
        setSites(JSON.parse(stored));
      } else {
        const defaultSites: ContractorSite[] = [
          {
            id: 'site_1',
            contractor_id: user?.id || 'demo',
            name: 'ورش مشروع عين السبع - الدار البيضاء',
            city: 'الدار البيضاء',
            address: 'المنطقة الصناعية عين السبع، شارع الشفشاوني',
            lat: 33.6042,
            lng: -7.5318,
            manager_name: 'هشام برادة',
            manager_phone: '+212661234567',
            created_at: new Date().toISOString(),
          },
          {
            id: 'site_2',
            contractor_id: user?.id || 'demo',
            name: 'ورش تهيئة المنطقة الصناعية - طنجة المتوسط',
            city: 'طنجة',
            address: 'القصر المجاز، ميناء طنجة المتوسط',
            lat: 35.7595,
            lng: -5.834,
            manager_name: 'عمر التازي',
            manager_phone: '+212662987654',
            created_at: new Date().toISOString(),
          },
          {
            id: 'site_3',
            contractor_id: user?.id || 'demo',
            name: 'مشروع إنجاز مسلك قروي - ورزازات / درعة',
            city: 'ورزازات',
            address: 'طريق تزارين - إقليم زاكورة',
            lat: 30.9335,
            lng: -6.937,
            manager_name: 'محمد الصغيري',
            manager_phone: '+212671009988',
            created_at: new Date().toISOString(),
          },
        ];
        setSites(defaultSites);
        localStorage.setItem('jadijcb_contractor_sites', JSON.stringify(defaultSites));
      }
    } catch {
      // Ignore
    }
  }, [user]);

  const saveSitesToStorage = (updated: ContractorSite[]) => {
    setSites(updated);
    try {
      localStorage.setItem('jadijcb_contractor_sites', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleCityChange = (cityName: string) => {
    setCity(cityName);
    const found = MOROCCAN_CITIES.find((c: any) => c.name_ar === cityName || c.name_fr === cityName);
    if (found) {
      setLat(found.lat);
      setLng(found.lng);
    }
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez saisir le nom du chantier' : 'يرجى إدخال اسم الورش');
      return;
    }

    const newSite: ContractorSite = {
      id: 'site_' + Math.random().toString(36).substring(2, 9),
      contractor_id: user?.id || 'demo',
      name: siteName.trim(),
      city,
      address: address.trim(),
      lat,
      lng,
      manager_name: managerName.trim() || undefined,
      manager_phone: managerPhone.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    const updated = [newSite, ...sites];
    saveSitesToStorage(updated);
    setIsAddModalOpen(false);
    toast.success(lang === 'fr' ? 'Chantier ajouté avec succès !' : 'تمت إضافة الورش بنجاح!');

    // Reset form
    setSiteName('');
    setAddress('');
    setManagerName('');
    setManagerPhone('+2126');
  };

  const handleDeleteSite = (siteId: string) => {
    const updated = sites.filter((s) => s.id !== siteId);
    saveSitesToStorage(updated);
    toast.success(lang === 'fr' ? 'Chantier supprimé' : 'تم حذف الورش من القائمة');
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
            <HardHat className="w-6 h-6 text-primary" />
            <span>{lang === 'fr' ? 'Mes Chantiers & Projets de Construction' : 'أوراش ومشاريع المقاولة'}</span>
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Enregistrez vos chantiers pour trouver en un clic les engins disponibles les plus proches grâce au radar.'
              : 'احفظ مواقع أوراش البناء الخاصة بشركتك للبحث الفوري عن أقرب الآليات والشاحنات بضغطة زر واحدة.'}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0"
        >
          {lang === 'fr' ? 'Ajouter un nouveau chantier' : 'إضافة ورش عمل جديد'}
        </Button>
      </div>

      {/* Grid of Saved Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sites.map((s) => (
          <Card
            key={s.id}
            className="p-5 bg-white border border-steel-200 shadow-soft rounded-3xl flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center font-black">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-ink">{s.name}</h3>
                    <span className="text-[11px] text-steel-500 flex items-center gap-1 font-bold">
                      <MapPin className="w-3 h-3 text-steel-400" />
                      <span>{s.city}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSite(s.id)}
                  className="p-1.5 text-steel-400 hover:text-rose-600 transition-colors"
                  title={lang === 'fr' ? 'Supprimer' : 'حذف'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {s.address && (
                <p className="text-xs text-steel-600 bg-steel-50 p-2.5 rounded-xl border border-steel-100">
                  {s.address}
                </p>
              )}

              {(s.manager_name || s.manager_phone) && (
                <div className="pt-2 border-t border-steel-100 text-xs text-steel-600 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-steel-400" />
                    <span>{s.manager_name || (lang === 'fr' ? 'Chef de chantier' : 'رئيس الورش')}</span>
                  </span>
                  {s.manager_phone && (
                    <a
                      href={`tel:${s.manager_phone}`}
                      className="font-bold text-primary-dark hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{s.manager_phone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Direct Radar Button */}
            <div className="pt-4 mt-4 border-t border-steel-100">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(`/entreprise/map?lat=${s.lat}&lng=${s.lng}&site=${encodeURIComponent(s.name)}`)
                }
                leftIcon={<Compass className="w-4 h-4" />}
                className="w-full justify-center font-black text-xs"
              >
                {lang === 'fr' ? 'Radar engins pour ce chantier' : 'رادار الآليات الأقرب لهذا الورش'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Site Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white border border-steel-200 shadow-2xl rounded-3xl overflow-hidden p-0">
            <div className="bg-ink text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardHat className="w-5 h-5 text-primary" />
                <h3 className="text-base font-black text-white">
                  {lang === 'fr' ? 'Nouveau Chantier' : 'إضافة ورش بناء جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-steel-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="p-6 space-y-4">
              <Input
                label={lang === 'fr' ? 'Nom du chantier / projet' : 'اسم الورش أو المشروع'}
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder={lang === 'fr' ? 'Ex: Chantier Bouskoura Résidences' : 'مثال: ورش تهيئة مركب بوسكورة'}
                required
              />

              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1">
                  {lang === 'fr' ? 'Ville du chantier' : 'المدينة'}
                </label>
                <select
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[42px]"
                >
                  {MOROCCAN_CITIES.map((c: MoroccanCity) => (
                    <option key={c.id} value={c.name_ar}>
                      {lang === 'fr' ? c.name_fr : c.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label={lang === 'fr' ? 'Adresse ou repère sur place' : 'العنوان أو أقرب نقطة معروفة للورش'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={lang === 'fr' ? 'Ex: Route de l\'aéroport, sortie sud' : 'مثال: طريق المطار، المخرج الجنوبي'}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={lang === 'fr' ? 'Chef de chantier' : 'رئيس الورش'}
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="هشام العلمي"
                />
                <Input
                  label={lang === 'fr' ? 'Téléphone' : 'الهاتف'}
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button type="button" variant="outline" size="md" onClick={() => setIsAddModalOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="md" leftIcon={<CheckCircle className="w-4 h-4" />}>
                  {lang === 'fr' ? 'Enregistrer le chantier' : 'حفظ بيانات الورش'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ContractorProjectsPage;
