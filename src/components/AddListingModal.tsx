import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  PlusCircle, 
  Truck, 
  MapPin, 
  Phone, 
  Tag, 
  Layers, 
  CheckCircle2, 
  DollarSign 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MACHINERY_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES } from '../data/cities';
import { MachineListing, TransactionType, PriceUnit } from '../types';

export const AddListingModal: React.FC = () => {
  const { t } = useTranslation();
  const { 
    language, 
    isAddListingOpen, 
    setIsAddListingOpen, 
    addListing, 
    addToast 
  } = useAppStore();

  const [type, setType] = useState<TransactionType>('rent');
  const [categoryId, setCategoryId] = useState('loader');
  const [titleAr, setTitleAr] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [brand, setBrand] = useState('JCB');
  const [model, setModel] = useState('3CX');
  const [year, setYear] = useState(2022);
  const [cityId, setCityId] = useState('casablanca');
  const [price, setPrice] = useState(1800);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('day');
  const [withOperator, setWithOperator] = useState(true);
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [phone, setPhone] = useState('+212 661 ');
  const [whatsapp, setWhatsapp] = useState('212661');
  const [desc, setDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1579275542618-a1dfed5f54ba?auto=format&fit=crop&w=1000&q=80');

  if (!isAddListingOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCity = MOROCCAN_CITIES.find(c => c.id === cityId);

    const newListing: MachineListing = {
      id: `mach-${Date.now()}`,
      titleAr: titleAr || `آلية ${brand} ${model} بحالة ممتازة`,
      titleFr: titleFr || `Engin ${brand} ${model} en excellent état`,
      descriptionAr: desc || 'آلية مجهزة بالكامل ومفحوصة ميكانيكياً، جاهزة للعمل الفوري في كافة الأوراش.',
      descriptionFr: desc || 'Matériel inspecté et entretenu régulièrement, prêt pour démarrage immédiat.',
      type,
      categoryId,
      brand,
      model,
      year,
      condition: 'excellent',
      price: Number(price),
      priceUnit: type === 'sale' ? 'total' : priceUnit,
      cityId,
      address: `${selectedCity ? (language === 'ar' ? selectedCity.nameAr : selectedCity.nameFr) : 'Morocco'}`,
      lat: selectedCity ? selectedCity.lat : 33.5731,
      lng: selectedCity ? selectedCity.lng : -7.5898,
      images: [imageUrl],
      featuresAr: ['فحص دوري معتمد', 'تأمين الورش', 'جاهزية فورية'],
      featuresFr: ['Contrôle technique régulier', 'Assurance chantier', 'Disponibilité rapide'],
      withOperator,
      fuelIncluded,
      deliveryAvailable,
      depositMAD: type === 'rent' ? 5000 : 0,
      owner: {
        id: `own-${Date.now()}`,
        name: 'المقاول المسجل',
        companyName: 'مقاولة الأشغال العامة',
        isVerified: true,
        phone,
        whatsapp,
        rating: 5.0,
        reviewsCount: 1,
        memberSince: '2026',
        city: (selectedCity && selectedCity.nameFr) ? selectedCity.nameFr : 'Casablanca',
      },
      status: 'available',
      viewsCount: 1,
      createdAt: new Date().toISOString().split('T')[0],
    };

    addListing(newListing);
    setIsAddListingOpen(false);
    addToast(t('add_listing_modal.success'), 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-ink/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-ink text-white border-b border-steel/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-ink flex items-center justify-center font-bold">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                {t('add_listing_modal.title')}
              </h2>
              <span className="text-[11px] text-slate-300">
                {t('add_listing_modal.subtitle')}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsAddListingOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-steel/60 hover:bg-steel text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Rent or Sale Switch */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setType('rent')}
              className={`min-h-[44px] py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                type === 'rent' ? 'bg-primary text-ink shadow-sm' : 'text-slate-600 hover:text-ink'
              }`}
            >
              {t('add_listing_modal.rent_type')}
            </button>
            <button
              type="button"
              onClick={() => setType('sale')}
              className={`min-h-[44px] py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                type === 'sale' ? 'bg-primary text-ink shadow-sm' : 'text-slate-600 hover:text-ink'
              }`}
            >
              {t('add_listing_modal.sale_type')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.category_label')} *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:ring-2 focus:ring-primary"
              >
                {MACHINERY_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {language === 'ar' ? cat.nameAr : cat.nameFr}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.city_label')} *
              </label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:ring-2 focus:ring-primary"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'ar' ? c.nameAr : c.nameFr}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.brand_label')} *
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="JCB, Caterpillar, Komatsu..."
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.model_label')} *
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="3CX, 320D, D65..."
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.year_label')}
              </label>
              <input
                type="number"
                min="1990"
                max="2026"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink font-sans focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Price (MAD) */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.price_label')} *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min="50"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink font-sans focus:ring-2 focus:ring-primary"
                />
                {type === 'rent' && (
                  <select
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                    className="min-h-[44px] px-2 rounded-xl border border-slate-200 text-xs text-ink"
                  >
                    <option value="day">{language === 'ar' ? '/ يوم' : '/ jour'}</option>
                    <option value="hour">{language === 'ar' ? '/ ساعة' : '/ heure'}</option>
                    <option value="month">{language === 'ar' ? '/ شهر' : '/ mois'}</option>
                  </select>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.phone_label')} *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink font-sans focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                {t('add_listing_modal.whatsapp_label')}
              </label>
              <input
                type="tel"
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink font-sans focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Quick checkboxes for rent */}
          {type === 'rent' && (
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={withOperator}
                  onChange={(e) => setWithOperator(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span>{t('add_listing_modal.operator_label')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={deliveryAvailable}
                  onChange={(e) => setDeliveryAvailable(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span>{t('add_listing_modal.delivery_label')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={fuelIncluded}
                  onChange={(e) => setFuelIncluded(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span>{t('add_listing_modal.fuel_label')}</span>
              </label>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              {t('add_listing_modal.desc_label')}
            </label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={language === 'ar' ? 'أضف تفاصيل ذراع الحفر، الملحقات المتوفرة، شروط الدفع، وساعات العمل...' : 'Accessoires fournis, conditions de location, état des pneus...'}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            <span>{t('add_listing_modal.submit')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
