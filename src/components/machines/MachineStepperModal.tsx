// ============================================================================
// JADIJCB: Machine & Spare Part Stepper Wizard Modal
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  UploadCloud,
  Trash2,
  Truck,
  Wrench,
  MapPin,
  Camera,
  CheckCircle2,
  Sparkles,
  Layers,
  Tag,
  Plus,
  TrendingDown,
} from 'lucide-react';
import { Machine, ListingMode, MachineCondition, VolumeDiscountTier, RentalTermType } from '../../types/database';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { MOROCCAN_CITIES } from '../../data/cities';
import { formatPriceMAD, formatTermQuantityUnit } from '../../data/rentalTerms';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { MapLocationPicker } from './MapLocationPicker';
import { compressImage } from '../../lib/imageCompressor';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { mapDatabaseError } from '../../lib/errorHelpers';
import { machineStore, resolveMachineRates, resolveVolumeDiscounts } from '../../lib/machineStore';

interface MachineStepperModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineToEdit?: Machine | null;
  onSave: (savedMachine: Machine) => void;
}

export const MachineStepperModal: React.FC<MachineStepperModalProps> = ({
  isOpen,
  onClose,
  machineToEdit,
  onSave,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { profile, user } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [langTab, setLangTab] = useState<'ar' | 'fr'>('ar');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [titleAr, setTitleAr] = useState(machineToEdit?.title_ar || '');
  const [titleFr, setTitleFr] = useState(machineToEdit?.title_fr || '');
  const [descAr, setDescAr] = useState(machineToEdit?.description_ar || '');
  const [descFr, setDescFr] = useState(machineToEdit?.description_fr || '');
  const [categoryId, setCategoryId] = useState(
    machineToEdit?.category_id && machineToEdit.category_id !== 'backhoe-loaders'
      ? machineToEdit.category_id
      : 'loader'
  );
  const [brand, setBrand] = useState(machineToEdit?.brand || 'JCB');
  const [model, setModel] = useState(machineToEdit?.model || '3CX Eco');
  const [year, setYear] = useState<number>(machineToEdit?.year || 2022);

  // Mode & Pricing
  const [listingMode, setListingMode] = useState<ListingMode>(
    machineToEdit?.listing_mode || 'rent'
  );
  const [condition, setCondition] = useState<MachineCondition>(
    machineToEdit?.condition || 'good'
  );
  const initialRates = machineToEdit ? resolveMachineRates(machineToEdit) : null;
  const [hourlyRate, setHourlyRate] = useState<number>(initialRates ? initialRates.rateHourly : 350);
  const [dailyRate, setDailyRate] = useState<number>(initialRates ? initialRates.rateDaily : 2200);
  const [weeklyRate, setWeeklyRate] = useState<number>(initialRates ? initialRates.rateWeekly : 12000);
  const [monthlyRate, setMonthlyRate] = useState<number>(initialRates ? initialRates.rateMonthly : 38000);
  const [yearlyRate, setYearlyRate] = useState<number>(initialRates ? initialRates.rateYearly : 390000);
  const [salePrice, setSalePrice] = useState<number>(initialRates ? initialRates.salePrice : 480000);
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscountTier[]>(() =>
    machineToEdit ? resolveVolumeDiscounts(machineToEdit) : []
  );
  const [activeDiscountTerm, setActiveDiscountTerm] = useState<RentalTermType>('daily');
  const [newTierQty, setNewTierQty] = useState<number>(5);
  const [newTierPrice, setNewTierPrice] = useState<number>(() =>
    Math.max(1, Math.round((initialRates ? initialRates.rateDaily : 2200) * 0.9))
  );
  const [withOperator, setWithOperator] = useState<boolean>(
    machineToEdit?.with_operator ?? true
  );
  const [fuelIncluded, setFuelIncluded] = useState<boolean>(
    machineToEdit?.fuel_included ?? false
  );
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean>(
    machineToEdit?.delivery_available ?? true
  );

  // Spare Parts specific
  const [isSparePart, setIsSparePart] = useState<boolean>(
    machineToEdit?.category_id === 'spare-parts' || machineToEdit?.category === 'spare-parts' || false
  );
  const [sparePartCategory, setSparePartCategory] = useState<string>(
    (machineToEdit?.specs as any)?.part_type || 'filters'
  );
  const [partNumber, setPartNumber] = useState<string>(
    (machineToEdit?.specs as any)?.part_number ||
      (machineToEdit?.category_id === 'spare-parts' || machineToEdit?.category === 'spare-parts'
        ? machineToEdit?.model || ''
        : '')
  );
  const [compatibleBrands, setCompatibleBrands] = useState<string>(
    (machineToEdit?.specs as any)?.compatible_models || 'JCB 3CX, 4CX'
  );

  // Location (Mandatory map pin confirmation for new listings)
  const [cityId, setCityId] = useState(machineToEdit?.city_id || 'casablanca');
  const [lat, setLat] = useState<number>(machineToEdit?.location_lat || machineToEdit?.lat || 33.5731);
  const [lng, setLng] = useState<number>(machineToEdit?.location_lng || machineToEdit?.lng || -7.5898);
  const [hasConfirmedMapLocation, setHasConfirmedMapLocation] = useState<boolean>(
    Boolean(
      machineToEdit &&
        ((machineToEdit.location_lat && machineToEdit.location_lng) ||
          (machineToEdit.lat && machineToEdit.lng))
    )
  );

  // Images (up to 8 real photos)
  const [images, setImages] = useState<string[]>(
    machineToEdit?.images?.length ? machineToEdit.images : []
  );
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isCompressingImages, setIsCompressingImages] = useState(false);

  // Publishing
  const [isPublished, setIsPublished] = useState<boolean>(
    machineToEdit?.is_published ?? true
  );

  // Re-sync form state every time modal opens or target machine changes
  useEffect(() => {
    if (!isOpen) return;
    const editIsSpare =
      machineToEdit?.category_id === 'spare-parts' || machineToEdit?.category === 'spare-parts';
    setStep(1);
    setLangTab('ar');
    setTitleAr(machineToEdit?.title_ar || '');
    setTitleFr(machineToEdit?.title_fr || '');
    setDescAr(machineToEdit?.description_ar || '');
    setDescFr(machineToEdit?.description_fr || '');
    setCategoryId(
      machineToEdit?.category_id && machineToEdit.category_id !== 'backhoe-loaders'
        ? machineToEdit.category_id
        : 'loader'
    );
    setBrand(machineToEdit?.brand || 'JCB');
    setModel(machineToEdit?.model || '3CX Eco');
    setYear(machineToEdit?.year || 2022);
    setListingMode(machineToEdit?.listing_mode || 'rent');
    setCondition(machineToEdit?.condition || 'good');
    const editRates = machineToEdit ? resolveMachineRates(machineToEdit) : null;
    const initDaily = editRates ? editRates.rateDaily : 2200;
    setHourlyRate(editRates ? editRates.rateHourly : 350);
    setDailyRate(initDaily);
    setWeeklyRate(editRates ? editRates.rateWeekly : 12000);
    setMonthlyRate(editRates ? editRates.rateMonthly : 38000);
    setYearlyRate(editRates ? editRates.rateYearly : 390000);
    setSalePrice(editRates ? editRates.salePrice : 480000);
    setVolumeDiscounts(machineToEdit ? resolveVolumeDiscounts(machineToEdit) : []);
    setActiveDiscountTerm('daily');
    setNewTierQty(5);
    setNewTierPrice(Math.max(1, Math.round(initDaily * 0.9)));
    setWithOperator(machineToEdit?.with_operator ?? true);
    setFuelIncluded(machineToEdit?.fuel_included ?? false);
    setDeliveryAvailable(machineToEdit?.delivery_available ?? true);
    setIsSparePart(Boolean(editIsSpare));
    setSparePartCategory((machineToEdit?.specs as any)?.part_type || 'filters');
    setPartNumber(
      (machineToEdit?.specs as any)?.part_number || (editIsSpare ? machineToEdit?.model || '' : '')
    );
    setCompatibleBrands((machineToEdit?.specs as any)?.compatible_models || 'JCB 3CX, 4CX');
    setCityId(machineToEdit?.city_id || 'casablanca');
    setLat(machineToEdit?.location_lat || machineToEdit?.lat || 33.5731);
    setLng(machineToEdit?.location_lng || machineToEdit?.lng || -7.5898);
    setHasConfirmedMapLocation(
      Boolean(
        machineToEdit &&
          ((machineToEdit.location_lat && machineToEdit.location_lng) ||
            (machineToEdit.lat && machineToEdit.lng))
      )
    );
    setImages(machineToEdit?.images?.length ? machineToEdit.images : []);
    setPendingFiles([]);
    setIsPublished(machineToEdit?.is_published ?? true);
  }, [isOpen, machineToEdit]);

  if (!isOpen) return null;

  const handleLocationChange = (newLat: number, newLng: number, newCityId?: string) => {
    setLat(newLat);
    setLng(newLng);
    setHasConfirmedMapLocation(true);
    if (newCityId) {
      setCityId(newCityId);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 8) {
      toast.error(
        lang === 'fr'
          ? 'Vous pouvez ajouter au maximum 8 photos'
          : 'الحد الأقصى هو 8 صور للآلية'
      );
      return;
    }

    setIsCompressingImages(true);

    try {
      const newUrls: string[] = [];
      const newPending: { file: File; previewUrl: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        newUrls.push(compressed.previewUrl);
        newPending.push({ file: compressed.file, previewUrl: compressed.previewUrl });
      }

      setPendingFiles((prev) => [...prev, ...newPending].slice(0, 8));
      setImages((prev) => [...prev, ...newUrls].slice(0, 8));
      toast.success(
        lang === 'fr'
          ? 'Photos compressées avec succès'
          : 'تم ضغط الصور وحفظها بنجاح'
      );
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsCompressingImages(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const removedUrl = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPendingFiles((prev) => prev.filter((p) => p.previewUrl !== removedUrl));
  };

  const requireMapLocationMessage =
    lang === 'fr'
      ? "Obligatoire : veuillez cliquer sur la carte ou confirmer l'emplacement exact avant de continuer 📍"
      : 'إلزامي: يرجى النقر على الخريطة أو تثبيت موقع الآلية الدقيق أولاً قبل المتابعة 📍';

  const handleFinalSubmit = async () => {
    if (!titleAr.trim() && !titleFr.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir un titre en arabe ou français'
          : 'يرجى إدخال عنوان الإعلان'
      );
      setStep(1);
      return;
    }

    if (isSparePart && !partNumber.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir la référence unique de la pièce (Réf / Part Number)'
          : 'يرجى إدخال رقم المرجع الفريد لقطعة الغيار (Réf / Part Number)'
      );
      setStep(1);
      return;
    }

    if (!hasConfirmedMapLocation || !Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      toast.error(requireMapLocationMessage);
      setStep(3);
      return;
    }

    setIsSubmitting(true);

    // Upload pending blob images to Supabase machine-images bucket
    const finalImageUrls: string[] = [];
    const currentUserId = user?.id || profile?.id;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.startsWith('http://') || img.startsWith('https://')) {
        finalImageUrls.push(img);
      } else if (img.startsWith('blob:') && isSupabaseConfigured && currentUserId) {
        const pendingItem = pendingFiles.find((p) => p.previewUrl === img);
        if (pendingItem?.file) {
          try {
            const fileExt = pendingItem.file.name.split('.').pop() || 'jpg';
            const filePath = `${currentUserId}/${Date.now()}_${i}.${fileExt}`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from('machine-images')
              .upload(filePath, pendingItem.file, {
                cacheControl: '3600',
                upsert: false,
              });

            if (!uploadErr && uploadData?.path) {
              const { data: pubData } = supabase.storage
                .from('machine-images')
                .getPublicUrl(uploadData.path);
              if (pubData?.publicUrl) {
                finalImageUrls.push(pubData.publicUrl);
                continue;
              }
            }
          } catch (uploadErr) {
            console.warn('Machine image storage upload notice:', uploadErr);
          }
        }
        // Fallback: keep preview URL if storage fails or offline
        finalImageUrls.push(img);
      } else {
        finalImageUrls.push(img);
      }
    }

    const cleanHourlyRate = isSparePart ? 0 : Math.max(0, Number(hourlyRate) || 0);
    const cleanDailyRate = isSparePart ? 0 : Math.max(0, Number(dailyRate) || 0);
    const cleanWeeklyRate = isSparePart ? 0 : Math.max(0, Number(weeklyRate) || 0);
    const cleanMonthlyRate = isSparePart ? 0 : Math.max(0, Number(monthlyRate) || 0);
    const cleanYearlyRate = isSparePart ? 0 : Math.max(0, Number(yearlyRate) || 0);
    const cleanSalePrice = Math.max(0, Number(salePrice) || 0);
    const cleanVolumeDiscounts: VolumeDiscountTier[] = isSparePart
      ? []
      : volumeDiscounts
          .filter((tier) => Number(tier.min_quantity) >= 2 && Number(tier.discounted_unit_price) > 0)
          .map((tier) => ({
            id: tier.id || `${tier.term}_${tier.min_quantity}`,
            term: tier.term,
            min_quantity: Math.max(2, Math.round(Number(tier.min_quantity))),
            discounted_unit_price: Math.max(1, Number(tier.discounted_unit_price)),
          }))
          .sort((a, b) => a.min_quantity - b.min_quantity);

    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;
    const catSlug = isSparePart ? 'spare-parts' : categoryId;

    const specsPayload: any = isSparePart
      ? {
          part_number: partNumber,
          compatible_models: compatibleBrands,
          part_type: sparePartCategory,
        }
      : {
          operating_weight_ton: (machineToEdit?.specs as any)?.operating_weight_ton || 8.5,
          engine_power_hp: (machineToEdit?.specs as any)?.engine_power_hp || 92,
          bucket_capacity_m3: (machineToEdit?.specs as any)?.bucket_capacity_m3 || 1.0,
          rate_monthly: cleanMonthlyRate,
          rate_yearly: cleanYearlyRate,
          volume_discounts: cleanVolumeDiscounts,
        };

    const machineData: Machine = {
      id: machineToEdit?.id || 'mac_' + Math.random().toString(36).substring(2, 9),
      owner_id: user?.id || profile?.id || 'demo-owner',
      title_ar: titleAr.trim() || titleFr.trim() || (isSparePart ? `${brand} ${partNumber}` : `${brand} ${model}`),
      title_fr: titleFr.trim() || titleAr.trim() || (isSparePart ? `${brand} ${partNumber}` : `${brand} ${model}`),
      description_ar: descAr.trim() || descFr.trim() || (isSparePart ? `قطعة غيار ${brand} أصلية - مرجع ${partNumber}` : ''),
      description_fr: descFr.trim() || descAr.trim() || (isSparePart ? `Pièce détachée ${brand} - Réf ${partNumber}` : ''),
      category: catSlug,
      category_id: catSlug,
      brand: brand.trim(),
      model: isSparePart ? (partNumber.trim() || model.trim()) : model.trim(),
      year: isSparePart ? new Date().getFullYear() : (Number(year) || 2022),
      listing_mode: isSparePart ? 'sale' : listingMode,
      condition,
      city: cityName,
      city_id: cityId,
      lat,
      lng,
      location_lat: lat,
      location_lng: lng,
      rate_hourly: cleanHourlyRate,
      rate_daily: cleanDailyRate,
      rate_weekly: cleanWeeklyRate,
      rate_monthly: cleanMonthlyRate,
      rate_yearly: cleanYearlyRate,
      hourly_rate: cleanHourlyRate,
      daily_rate: cleanDailyRate,
      weekly_rate: cleanWeeklyRate,
      monthly_rate: cleanMonthlyRate,
      yearly_rate: cleanYearlyRate,
      sale_price: cleanSalePrice,
      currency: 'MAD',
      with_operator: isSparePart ? false : withOperator,
      fuel_included: isSparePart ? false : fuelIncluded,
      delivery_available: deliveryAvailable,
      status: isPublished ? 'available' : 'inactive',
      is_published: isPublished,
      images: finalImageUrls,
      specs: specsPayload,
      volume_discounts: cleanVolumeDiscounts,
      views_count: machineToEdit?.views_count || 0,
      rating_avg: machineToEdit?.rating_avg || 5.0,
      reviews_count: machineToEdit?.reviews_count || 0,
      owner: {
        full_name: profile?.full_name || (lang === 'fr' ? 'Propriétaire certifié' : 'مالك معتمد'),
        company_name: profile?.company_name || profile?.full_name || '',
        phone: profile?.phone || '',
        whatsapp_verified: true,
      },
      created_at: machineToEdit?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase with strict adaptive error handling & soft-lock RLS check
    if (user?.id) {
      try {
        let payload: any = {
          owner_id: user.id,
          title_ar: machineData.title_ar,
          title_fr: machineData.title_fr,
          description_ar: machineData.description_ar,
          description_fr: machineData.description_fr,
          category: machineData.category === 'backhoe-loaders' ? 'loader' : machineData.category,
          brand: machineData.brand,
          model: machineData.model,
          year_of_manufacture: Number(machineData.year) || 2022,
          year: Number(machineData.year) || 2022,
          listing_mode: machineData.listing_mode,
          condition: machineData.condition === 'new' ? 'new' : 'used',
          city: machineData.city,
          lat: machineData.lat,
          lng: machineData.lng,
          hourly_rate: cleanHourlyRate,
          daily_rate: cleanDailyRate,
          weekly_rate: cleanWeeklyRate,
          monthly_rate: cleanMonthlyRate,
          yearly_rate: cleanYearlyRate,
          rate_hourly: cleanHourlyRate,
          rate_daily: cleanDailyRate,
          rate_weekly: cleanWeeklyRate,
          rate_monthly: cleanMonthlyRate,
          rate_yearly: cleanYearlyRate,
          volume_discounts: cleanVolumeDiscounts,
          sale_price: cleanSalePrice,
          with_operator: machineData.with_operator,
          fuel_included: machineData.fuel_included,
          delivery_available: machineData.delivery_available,
          images: machineData.images,
          specs: machineData.specs,
          is_published: machineData.is_published,
        };

        let savedData: any = null;
        let lastError: any = null;

        // Perform adaptive insert/update (up to 18 adaptive attempts for schema cache mismatches)
        for (let attempt = 0; attempt < 18; attempt++) {
          const req = machineToEdit?.id
            ? supabase.from('machines').update(payload).eq('id', machineToEdit.id).select().maybeSingle()
            : supabase.from('machines').insert(payload).select().maybeSingle();

          const { data, error } = await req;

          if (!error) {
            savedData = data;
            lastError = null;
            break;
          }

          lastError = error;
          const msg = error.message || '';

          // 1. Column missing in PostgREST schema cache: e.g. "Could not find the 'rate_daily' column"
          const missingColMatch = msg.match(/Could not find the '([^']+)' column/i);
          if (missingColMatch && missingColMatch[1]) {
            const col = missingColMatch[1];
            delete payload[col];
            continue;
          }

          // 2. Year vs Year of manufacture
          if (msg.includes('year_of_manufacture')) {
            payload.year_of_manufacture = Number(machineData.year) || 2022;
            delete payload.year;
            continue;
          }
          if (msg.includes("'year'") || msg.includes('"year"')) {
            delete payload.year;
            payload.year_of_manufacture = Number(machineData.year) || 2022;
            continue;
          }

          // 3. Category enum mismatch: invalid input value for enum machine_category_type
          if (msg.includes('machine_category_type') || msg.includes('enum')) {
            payload.category = 'loader';
            continue;
          }

          // Other error (e.g. RLS soft lock, permissions)
          break;
        }

        if (lastError) {
          const errKey = mapDatabaseError(lastError);
          // If error is schema cache related and all retries exhausted, allow fallback save so user isn't blocked
          if (!lastError.message?.includes('schema cache') && !lastError.message?.includes('violates not-null')) {
            setIsSubmitting(false);
            toast.error(t(errKey));
            return;
          }
        }

        if (savedData?.id) {
          machineData.id = savedData.id;
        }
      } catch (err: any) {
        console.warn('Machine remote save warning:', err);
      }
    }

    if (!machineData.id) {
      machineData.id = `mach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (user?.id) {
      machineData.owner_id = user.id;
    }

    // Save to machineStore for real-time local and cross-portal synchronization
    machineStore.saveMachine(machineData);

    setIsSubmitting(false);
    onSave(machineData);
    toast.success(t('machines.saved_success'));
    onClose();
  };

  const stepsList = isSparePart
    ? [
        { num: 1, title: lang === 'fr' ? '1. Données de la pièce' : '1. بيانات قطعة الغيار' },
        { num: 2, title: lang === 'fr' ? '2. Prix & Conditions' : '2. السعر وشروط البيع' },
        { num: 3, title: lang === 'fr' ? '3. Emplacement' : '3. الموقع الجغرافي' },
        { num: 4, title: lang === 'fr' ? '4. Photos de la pièce' : '4. صور قطعة الغيار' },
        { num: 5, title: lang === 'fr' ? '5. Révision & Publication' : '5. المراجعة والنشر' },
      ]
    : [
        { num: 1, title: t('machines.step_basics') },
        { num: 2, title: t('machines.step_mode') },
        { num: 3, title: t('machines.step_location') },
        { num: 4, title: t('machines.step_images') },
        { num: 5, title: t('machines.step_publish') },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-2xl w-full shadow-2xl my-auto overflow-hidden text-start">
        {/* Top Header */}
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              {isSparePart ? <Wrench className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isSparePart
                  ? machineToEdit
                    ? lang === 'fr'
                      ? 'Modifier la pièce de rechange'
                      : 'تعديل قطعة الغيار'
                    : lang === 'fr'
                    ? 'إضافة قطعة غيار أو ملحق'
                    : 'إضافة قطعة غيار أو ملحق'
                  : machineToEdit
                  ? t('machines.edit_machine')
                  : t('machines.add_machine')}
              </h3>
              <span className="text-[11px] text-primary font-bold">
                {stepsList[step - 1].title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-steel-100 px-4 py-2 border-b border-steel-200 flex items-center justify-between gap-1 overflow-x-auto">
          {stepsList.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                if (s.num > 3 && !hasConfirmedMapLocation) {
                  toast.error(requireMapLocationMessage);
                  setStep(3);
                  return;
                }
                setStep(s.num);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                step === s.num
                  ? 'bg-primary text-ink shadow-sm'
                  : step > s.num
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-steel-500 hover:bg-steel-200'
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black border border-current">
                {step > s.num ? '✓' : s.num}
              </span>
              <span className="hidden sm:inline">{s.title.split('. ')[1]}</span>
            </button>
          ))}
        </div>

        {/* Modal Step Content */}
        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-4">
          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Spare Part Toggle */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-primary-dark shrink-0" />
                  <div>
                    <span className="text-xs font-black text-ink block">
                      {lang === 'fr' ? 'Annonce spécifique pour pièces de rechange et outillage' : 'هذا الإعلان خاص بقطع الغيار والمستلزمات'}
                    </span>
                    <span className="text-[11px] text-steel-500">
                      {lang === 'fr'
                        ? 'Active le formulaire adapté (vente ferme, sans location, sans chauffeur ni carburant)'
                        : 'تكييف النموذج لقطع الغيار (بيع مباشر، بدون كراء، وبدون سائق أو مازوت)'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSparePart}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsSparePart(checked);
                    if (checked) {
                      setListingMode('sale');
                      setWithOperator(false);
                      setFuelIncluded(false);
                      if (salePrice > 100000) setSalePrice(2500);
                    }
                  }}
                  className="w-5 h-5 accent-primary cursor-pointer shrink-0"
                />
              </div>

              {/* Conditional Step 1 Fields */}
              {isSparePart ? (
                /* SPARE PARTS SPECIFIC FIELDS (No machinery category, no year) */
                <div className="space-y-4">
                  {/* Spare Part Category */}
                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {lang === 'fr' ? 'Catégorie de la pièce détachée :' : 'نوع وتصنيف قطعة الغيار :'}
                    </label>
                    <select
                      value={sparePartCategory}
                      onChange={(e) => setSparePartCategory(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    >
                      <option value="filters">{lang === 'fr' ? 'Filtres & Lubrifiants (Huile, Carburant, Air)' : 'فلاتر وزيوت وتشحيم (زيت، مازوت، هواء)'}</option>
                      <option value="hydraulic">{lang === 'fr' ? 'Hydraulique (Pompes, Vérins, Flexibles, Distributeurs)' : 'هيدروليك، مضخات، موزعات وخراطيم'}</option>
                      <option value="engine">{lang === 'fr' ? 'Moteurs, Culasses & Boîtes de vitesse' : 'محركات، رؤوس أسطوانات وناقل الحركة'}</option>
                      <option value="teeth">{lang === 'fr' ? 'Dents, Lames de godet & Fixations' : 'أسنان وشفرات كباش ومثبتات'}</option>
                      <option value="tracks">{lang === 'fr' ? 'Chenilles (Caoutchouc/Acier) & Galets' : 'جنازير مطاطية وحديدية وعجلات'}</option>
                      <option value="electric">{lang === 'fr' ? 'Électricité, Démarreurs, Alternateurs & Batteries' : 'كهرباء، دينامو، إنارة وبطاريات تشغيل'}</option>
                      <option value="attachments">{lang === 'fr' ? 'Brise-roche (BRH) & Outils de démolition' : 'كواسر ومرفقات هيدروليكية BRH'}</option>
                      <option value="other">{lang === 'fr' ? 'Autres composants mécaniques & outillage' : 'مستلزمات وصيانة عامة'}</option>
                    </select>
                  </div>

                  {/* Brand & Reference (Réf) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label={lang === 'fr' ? 'Marque / Fabricant de la pièce :' : 'الماركة المصنعة للقطعة أو المورد :'}
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder={lang === 'fr' ? 'Ex: JCB, Caterpillar, Rexroth, Perkins...' : 'مثال: JCB، كاتر بيلر، ريكسروث، بيركنز...'}
                      required
                    />
                    <Input
                      label={lang === 'fr' ? 'Référence d\'origine (Réf / Part Number) :' : 'رقم المرجع الأصلي للقطعة (Réf / Part Number) :'}
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                      placeholder="Ex: 320/08560, J350, 1104D..."
                      required
                    />
                  </div>

                  {/* Compatible Models */}
                  <div>
                    <Input
                      label={lang === 'fr' ? 'Engins et modèles compatibles :' : 'الآليات والموديلات المتوافقة مع هذه القطعة :'}
                      value={compatibleBrands}
                      onChange={(e) => setCompatibleBrands(e.target.value)}
                      placeholder={lang === 'fr' ? 'Ex: Compatible avec JCB 3CX, 4CX, CAT 428...' : 'مثال: متوافق مع JCB 3CX، 4CX، كوماتسو PC200...'}
                      required
                    />
                  </div>
                </div>
              ) : (
                /* MACHINERY FIELDS (Standard Category, Brand, Model & Year) */
                <>
                  {/* Equipment Category Selection */}
                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {t('machines.category_label')}
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    >
                      {EQUIPMENT_CATEGORIES.filter((c) => c.slug !== 'spare-parts').map((cat) => (
                        <option key={cat.id} value={cat.slug}>
                          {lang === 'fr' ? cat.name_fr : cat.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Brand, Model & Year */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label={t('machines.brand_label')}
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      required
                    />
                    <Input
                      label={t('machines.model_label')}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                    />
                    <Input
                      type="number"
                      label={t('machines.year_label')}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      required
                    />
                  </div>
                </>
              )}

              {/* Bilingual Tabs AR / FR */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-steel-700">
                    {lang === 'fr' ? 'Titre et description bilingues :' : 'العنوان والوصف باللغتين:'}
                  </label>
                  <div className="flex bg-steel-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setLangTab('ar')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        langTab === 'ar' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                      }`}
                    >
                      العربية (AR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLangTab('fr')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        langTab === 'fr' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                      }`}
                    >
                      Français (FR)
                    </button>
                  </div>
                </div>

                {langTab === 'ar' ? (
                  <div className="space-y-3">
                    <Input
                      label={isSparePart ? 'عنوان إعلان قطعة الغيار (بالعربية) :' : t('machines.title_ar')}
                      placeholder={
                        isSparePart
                          ? 'مثال: طقم فلاتر أصلية شامل لآلية JCB 3CX (زيت + هيدروليك)'
                          : 'مثال: جرافة JCB 3CX موديل 2022 بحالة ممتازة'
                      }
                      value={titleAr}
                      onChange={(e) => setTitleAr(e.target.value)}
                      dir="rtl"
                    />
                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1">
                        {isSparePart ? 'وصف تفصيلي لقطعة الغيار (بالعربية) :' : t('machines.desc_ar')}
                      </label>
                      <textarea
                        rows={3}
                        dir="rtl"
                        value={descAr}
                        onChange={(e) => setDescAr(e.target.value)}
                        placeholder={
                          isSparePart
                            ? 'أدخل مواصفات القطعة، رقم المرجع، مدى التوافق والجاهزية، الضمان إن وجد...'
                            : 'أدخل مواصفات الآلية، ساعات العمل، وسجل الصيانة...'
                        }
                        className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      label={isSparePart ? 'Titre de l\'annonce pièce (Français) :' : t('machines.title_fr')}
                      placeholder={
                        isSparePart
                          ? 'ex. Kit complet filtres d\'origine JCB 3CX (Huile, Carburant)'
                          : 'ex. Tractopelle JCB 3CX 2022 en excellent état'
                      }
                      value={titleFr}
                      onChange={(e) => setTitleFr(e.target.value)}
                      dir="ltr"
                    />
                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1">
                        {isSparePart ? 'Description détaillée de la pièce (Français) :' : t('machines.desc_fr')}
                      </label>
                      <textarea
                        rows={3}
                        dir="ltr"
                        value={descFr}
                        onChange={(e) => setDescFr(e.target.value)}
                        placeholder={
                          isSparePart
                            ? 'Précisez la référence, l\'état neuf sous emballage, la compatibilité exacte...'
                            : 'Précisez les heures de travail, godets disponibles, et révisions...'
                        }
                        className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: MODE & PRICING */}
          {step === 2 && (
            <div className="space-y-4">
              {isSparePart ? (
                /* SPARE PARTS SPECIFIC STEP 2: Sale only, single price, condition, delivery (NO rental, NO hourly/daily rates, NO driver, NO fuel) */
                <div className="space-y-4">
                  {/* Sale Only Notice Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Tag className="w-5 h-5 text-amber-700 shrink-0" />
                      <div>
                        <span className="block font-black text-sm">
                          {lang === 'fr' ? 'Vente ferme uniquement' : 'طريقة العرض: بيع نهائي مباشر'}
                        </span>
                        <span className="text-[11px] text-amber-800 font-normal">
                          {lang === 'fr'
                            ? 'Les pièces de rechange sont proposées à l\'achat direct (pas de location ni chauffeur ni carburant).'
                            : 'قطع الغيار تباع لمرة واحدة فقط (تم استبعاد خيارات الكراء، السائق، والمازوت).'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg font-black shrink-0">
                      {lang === 'fr' ? '100% Vente' : 'بيع وشراء'}
                    </span>
                  </div>

                  {/* Single Final Sale Price */}
                  <div>
                    <Input
                      type="number"
                      label={lang === 'fr' ? 'Prix de vente de la pièce (MAD) :' : 'سعر بيع قطعة الغيار (د.م) :'}
                      value={salePrice}
                      onChange={(e) => setSalePrice(Number(e.target.value))}
                      placeholder="مثال: 2500"
                      required
                    />
                    <span className="text-[11px] text-steel-500 mt-1 block">
                      {lang === 'fr' ? 'Prix d\'acquisition net pour le client (MAD)' : 'السعر الصافي لشراء القطعة بالدرهم المغربي'}
                    </span>
                  </div>

                  {/* Part Condition */}
                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {lang === 'fr' ? 'État de la pièce détachée :' : 'حالة قطعة الغيار :'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCondition('new')}
                        className={`p-3.5 rounded-2xl border text-xs font-bold transition-all min-h-[48px] cursor-pointer ${
                          condition === 'new'
                            ? 'border-primary bg-amber-50 text-ink ring-2 ring-primary'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        <span className="block font-black">{lang === 'fr' ? '✨ Neuve d\'origine' : '✨ جديدة كلياً أصلية'}</span>
                        <span className="text-[10px] text-steel-500 font-normal">{lang === 'fr' ? 'Sous emballage certifié' : 'في علبتها الأصلية'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCondition('good')}
                        className={`p-3.5 rounded-2xl border text-xs font-bold transition-all min-h-[48px] cursor-pointer ${
                          condition !== 'new'
                            ? 'border-primary bg-amber-50 text-ink ring-2 ring-primary'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        <span className="block font-black">{lang === 'fr' ? '🔧 Occasion bon état' : '🔧 مستعملة بحالة ممتازة'}</span>
                        <span className="text-[10px] text-steel-500 font-normal">{lang === 'fr' ? 'Vérifiée et fonctionnelle' : 'مفحوصة وجاهزة للتركيب'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Toggle Only */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-steel-200 bg-surface cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-ink block">
                        {lang === 'fr' ? 'Expédition et livraison sur chantier disponible' : 'إمكانية الشحن والتوصيل المباشر إلى موقع الورش'}
                      </span>
                      <span className="text-[11px] text-steel-500">
                        {lang === 'fr' ? 'Via transporteur, messagerie ou enlèvement sur magasin' : 'عبر الإرساليات السريعة لأي مدينة أو الاستلام المباشر'}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={deliveryAvailable}
                      onChange={(e) => setDeliveryAvailable(e.target.checked)}
                      className="w-5 h-5 accent-primary cursor-pointer shrink-0"
                    />
                  </label>
                </div>
              ) : (
                /* MACHINERY SPECIFIC STEP 2: Dual Mode (Rent/Sale) with rates, driver, and fuel */
                <>
                  {/* Dual-Mode Selector */}
                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {t('machines.listing_mode_label')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setListingMode('rent')}
                        className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 min-h-[56px] transition-all cursor-pointer ${
                          listingMode === 'rent'
                            ? 'border-primary bg-amber-50 text-ink ring-2 ring-primary'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        <Truck className="w-4 h-4 text-primary-dark" />
                        <span>{t('machines.mode_rent_option')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setListingMode('sale')}
                        className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 min-h-[56px] transition-all cursor-pointer ${
                          listingMode === 'sale'
                            ? 'border-primary bg-amber-50 text-ink ring-2 ring-primary'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        <Tag className="w-4 h-4 text-primary-dark" />
                        <span>{t('machines.mode_sale_option')}</span>
                      </button>
                    </div>
                  </div>

                  {/* RENT LOGIC */}
                  {listingMode === 'rent' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          type="number"
                          min={0}
                          label={t('machines.hourly_rate_label')}
                          value={hourlyRate > 0 ? hourlyRate : ''}
                          placeholder="0"
                          onChange={(e) => setHourlyRate(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                          required
                        />
                        <Input
                          type="number"
                          min={0}
                          label={t('machines.daily_rate_label')}
                          value={dailyRate > 0 ? dailyRate : ''}
                          placeholder="0"
                          onChange={(e) => setDailyRate(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                          required
                        />
                        <Input
                          type="number"
                          min={0}
                          label={t('machines.weekly_rate_label')}
                          value={weeklyRate > 0 ? weeklyRate : ''}
                          placeholder="0"
                          onChange={(e) => setWeeklyRate(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          type="number"
                          min={0}
                          label={t('machines.monthly_rate_label')}
                          value={monthlyRate > 0 ? monthlyRate : ''}
                          placeholder="0"
                          onChange={(e) => setMonthlyRate(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                        <Input
                          type="number"
                          min={0}
                          label={t('machines.yearly_rate_label')}
                          value={yearlyRate > 0 ? yearlyRate : ''}
                          placeholder="0"
                          onChange={(e) => setYearlyRate(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </div>

                      {/* Toggles */}
                      <div className="space-y-2.5 pt-2 border-t border-steel-200">
                        <label className="flex items-center justify-between p-3 rounded-xl border border-steel-200 bg-surface cursor-pointer">
                          <span className="text-xs font-bold text-ink">
                            {t('machines.with_operator_toggle')}
                          </span>
                          <input
                            type="checkbox"
                            checked={withOperator}
                            onChange={(e) => setWithOperator(e.target.checked)}
                            className="w-5 h-5 accent-primary cursor-pointer"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl border border-steel-200 bg-surface cursor-pointer">
                          <span className="text-xs font-bold text-ink">
                            {t('machines.fuel_included_toggle')}
                          </span>
                          <input
                            type="checkbox"
                            checked={fuelIncluded}
                            onChange={(e) => setFuelIncluded(e.target.checked)}
                            className="w-5 h-5 accent-primary cursor-pointer"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl border border-steel-200 bg-surface cursor-pointer">
                          <span className="text-xs font-bold text-ink">
                            {t('machines.delivery_available_toggle')}
                          </span>
                          <input
                            type="checkbox"
                            checked={deliveryAvailable}
                            onChange={(e) => setDeliveryAvailable(e.target.checked)}
                            className="w-5 h-5 accent-primary cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Tiered / Volume Duration Pricing Discounts (Tarification dégressive - Upsell) */}
                      {(() => {
                        const termTabs: {
                          key: RentalTermType;
                          label: string;
                          baseRate: number;
                          defaultQty: number;
                          presets: { qty: number; pct: number }[];
                        }[] = [
                          {
                            key: 'hourly',
                            label: lang === 'fr' ? 'Heure' : 'ساعة',
                            baseRate: Number(hourlyRate) || 0,
                            defaultQty: 5,
                            presets: [
                              { qty: 5, pct: 10 },
                              { qty: 10, pct: 20 },
                            ],
                          },
                          {
                            key: 'daily',
                            label: lang === 'fr' ? 'Jour' : 'يوم',
                            baseRate: Number(dailyRate) || 0,
                            defaultQty: 5,
                            presets: [
                              { qty: 5, pct: 10 },
                              { qty: 15, pct: 15 },
                            ],
                          },
                          {
                            key: 'weekly',
                            label: lang === 'fr' ? 'Semaine' : 'أسبوع',
                            baseRate: Number(weeklyRate) || 0,
                            defaultQty: 2,
                            presets: [
                              { qty: 2, pct: 10 },
                              { qty: 4, pct: 15 },
                            ],
                          },
                          {
                            key: 'monthly',
                            label: lang === 'fr' ? 'Mois' : 'شهر',
                            baseRate: Number(monthlyRate) || 0,
                            defaultQty: 3,
                            presets: [
                              { qty: 3, pct: 10 },
                              { qty: 6, pct: 15 },
                            ],
                          },
                          {
                            key: 'yearly',
                            label: lang === 'fr' ? 'An' : 'سنة',
                            baseRate: Number(yearlyRate) || 0,
                            defaultQty: 2,
                            presets: [{ qty: 2, pct: 10 }],
                          },
                        ];

                        const currentTab = termTabs.find((tItem) => tItem.key === activeDiscountTerm) || termTabs[1];
                        const tiersForActiveTerm = volumeDiscounts
                          .filter((tier) => tier.term === activeDiscountTerm)
                          .sort((a, b) => a.min_quantity - b.min_quantity);

                        const upsertTier = (term: RentalTermType, qty: number, price: number) => {
                          const cleanQty = Math.max(2, Math.round(Number(qty) || 2));
                          const cleanPrice = Math.max(1, Math.round(Number(price) || 1));
                          setVolumeDiscounts((prev) => {
                            const existingIdx = prev.findIndex(
                              (item) => item.term === term && item.min_quantity === cleanQty
                            );
                            if (existingIdx >= 0) {
                              return prev.map((item, i) =>
                                i === existingIdx ? { ...item, discounted_unit_price: cleanPrice } : item
                              );
                            }
                            return [
                              ...prev,
                              {
                                id: `${term}_${cleanQty}_${Date.now()}`,
                                term,
                                min_quantity: cleanQty,
                                discounted_unit_price: cleanPrice,
                              },
                            ];
                          });
                        };

                        return (
                          <div className="pt-4 border-t border-steel-200 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
                                  <TrendingDown className="w-4 h-4 text-primary-dark shrink-0" />
                                  <span>
                                    {lang === 'fr'
                                      ? 'Tarification dégressive selon la durée (Upsell Volume)'
                                      : 'التسعيرة التنازلية حسب المدة (تخفيض تلقائي عند الكراء المطول)'}
                                  </span>
                                </h4>
                                <p className="text-[11px] text-steel-500 mt-0.5 leading-relaxed">
                                  {lang === 'fr'
                                    ? 'Réduisez automatiquement le prix unitaire pour encourager les longues durées (ex: 1 000 MAD/j -> 900 MAD/j dès 5 jours).'
                                    : 'شجّع الزبناء على الكراء لمدة أطول بتخفيض ثمن الوحدة تلقائياً (مثلاً: اليوم بـ 1000 د.م، وعند طلب 5 أيام فأكثر يصبح بـ 900 د.م).'}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] shrink-0 latin-nums">
                                {volumeDiscounts.length} {lang === 'fr' ? 'paliers' : 'عروض'}
                              </span>
                            </div>

                            {/* 5 Period Tabs */}
                            <div className="grid grid-cols-5 gap-1 bg-steel-100 p-1 rounded-xl">
                              {termTabs.map((tab) => {
                                const count = volumeDiscounts.filter((d) => d.term === tab.key).length;
                                const isActive = activeDiscountTerm === tab.key;
                                return (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => {
                                      setActiveDiscountTerm(tab.key);
                                      setNewTierQty(tab.defaultQty);
                                      setNewTierPrice(
                                        tab.baseRate > 0 ? Math.max(1, Math.round(tab.baseRate * 0.9)) : 100
                                      );
                                    }}
                                    className={`py-1.5 px-1 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center ${
                                      isActive
                                        ? 'bg-primary text-ink shadow-xs'
                                        : 'text-steel-600 hover:text-ink'
                                    }`}
                                  >
                                    <span className="block truncate">{tab.label}</span>
                                    <span className="text-[9px] font-mono opacity-80 block truncate latin-nums">
                                      {count > 0 ? `(${count})` : tab.baseRate > 0 ? formatPriceMAD(tab.baseRate, lang) : '—'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Base Rate + Quick 1-Click Presets */}
                            <div className="p-2.5 rounded-xl bg-steel-50 border border-steel-200 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-steel-700 latin-nums">
                                {lang === 'fr' ? 'Tarif de base :' : 'الثمن العادي للوحدة :'}{' '}
                                <strong className="text-ink font-mono">
                                  {currentTab.baseRate > 0
                                    ? `${formatPriceMAD(currentTab.baseRate, lang)}/${currentTab.label}`
                                    : lang === 'fr'
                                    ? 'Non défini'
                                    : 'غير محدد'}
                                </strong>
                              </span>

                              {currentTab.baseRate > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-steel-500">
                                    {lang === 'fr' ? 'Raccourcis :' : 'أمثلة سريعة:'}
                                  </span>
                                  {currentTab.presets.map((p) => {
                                    const suggestedPrice = Math.max(
                                      1,
                                      Math.round((currentTab.baseRate * (100 - p.pct)) / 100)
                                    );
                                    return (
                                      <button
                                        key={p.qty}
                                        type="button"
                                        onClick={() => upsertTier(activeDiscountTerm, p.qty, suggestedPrice)}
                                        className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-steel-300 hover:border-primary text-[10px] font-black text-ink transition-colors cursor-pointer latin-nums"
                                      >
                                        +{p.qty} {formatTermQuantityUnit(activeDiscountTerm, p.qty, lang)} (-{p.pct}%)
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Configured Discount Tiers for Selected Period */}
                            {tiersForActiveTerm.length > 0 && (
                              <div className="space-y-2 max-h-52 overflow-y-auto pe-0.5">
                                {tiersForActiveTerm.map((tier) => {
                                  const base = currentTab.baseRate;
                                  const discountPct =
                                    base > 0 && tier.discounted_unit_price < base
                                      ? Math.round(((base - tier.discounted_unit_price) / base) * 100)
                                      : 0;
                                  const invalidHigh = base > 0 && tier.discounted_unit_price >= base;

                                  return (
                                    <div
                                      key={tier.id}
                                      className={`p-2.5 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 ${
                                        invalidHigh
                                          ? 'border-amber-400 bg-amber-50/70'
                                          : 'border-emerald-200 bg-emerald-50/40'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-[11px] font-bold text-steel-600 shrink-0">
                                          {lang === 'fr' ? 'Dès' : 'ابتداءً من'}
                                        </span>
                                        <input
                                          type="number"
                                          min={2}
                                          value={tier.min_quantity}
                                          onChange={(e) => {
                                            const val = Math.max(2, Math.round(Number(e.target.value) || 2));
                                            setVolumeDiscounts((prev) =>
                                              prev.map((d) => (d.id === tier.id ? { ...d, min_quantity: val } : d))
                                            );
                                          }}
                                          className="w-16 px-2 py-1 rounded-lg border border-steel-300 bg-white text-xs font-mono font-black text-center text-ink"
                                          dir="ltr"
                                        />
                                        <span className="text-[11px] font-bold text-steel-700 shrink-0">
                                          {formatTermQuantityUnit(activeDiscountTerm, tier.min_quantity, lang)} ⟵
                                        </span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={tier.discounted_unit_price}
                                          onChange={(e) => {
                                            const val = Math.max(1, Math.round(Number(e.target.value) || 1));
                                            setVolumeDiscounts((prev) =>
                                              prev.map((d) =>
                                                d.id === tier.id ? { ...d, discounted_unit_price: val } : d
                                              )
                                            );
                                          }}
                                          className="w-24 px-2 py-1 rounded-lg border border-steel-300 bg-white text-xs font-mono font-black text-center text-ink"
                                          dir="ltr"
                                        />
                                        <span className="text-[10px] font-bold text-steel-500 shrink-0">
                                          {lang === 'fr' ? `MAD/${currentTab.label}` : `د.م/${currentTab.label}`}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {discountPct > 0 ? (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black latin-nums">
                                            -{discountPct}%
                                          </span>
                                        ) : invalidHigh ? (
                                          <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black">
                                            {lang === 'fr' ? '≥ tarif base' : 'أكبر من العادي'}
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setVolumeDiscounts((prev) => prev.filter((d) => d.id !== tier.id))
                                          }
                                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                                          aria-label={t('common.delete')}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add New Tier Row */}
                            <div className="p-3 rounded-xl border border-dashed border-steel-300 bg-steel-50/70 space-y-2">
                              <span className="text-[11px] font-black text-steel-700 block">
                                {lang === 'fr'
                                  ? `+ Ajouter un palier de réduction (${currentTab.label})`
                                  : `+ إضافة شريحة تخفيض جديدة (${currentTab.label})`}
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                <div className="sm:col-span-5 flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-steel-600 shrink-0">
                                    {lang === 'fr' ? 'Dès' : 'من'}
                                  </span>
                                  <input
                                    type="number"
                                    min={2}
                                    value={newTierQty}
                                    onChange={(e) => setNewTierQty(Math.max(2, Math.round(Number(e.target.value) || 2)))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-steel-300 bg-white text-xs font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                                    dir="ltr"
                                  />
                                  <span className="text-[11px] font-bold text-steel-600 shrink-0">
                                    {formatTermQuantityUnit(activeDiscountTerm, newTierQty, lang)}+
                                  </span>
                                </div>

                                <div className="sm:col-span-5 flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-steel-600 shrink-0">
                                    {lang === 'fr' ? 'Prix :' : 'الثمن الجديد:'}
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={newTierPrice > 0 ? newTierPrice : ''}
                                    onChange={(e) =>
                                      setNewTierPrice(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))
                                    }
                                    placeholder={lang === 'fr' ? 'MAD' : 'د.م'}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-steel-300 bg-white text-xs font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                                    dir="ltr"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newTierPrice || newTierPrice <= 0) {
                                      toast.error(
                                        lang === 'fr'
                                          ? 'Veuillez saisir un tarif réduit valide'
                                          : 'يرجى إدخال الثمن المخفض للوحدة'
                                      );
                                      return;
                                    }
                                    upsertTier(activeDiscountTerm, newTierQty, newTierPrice);
                                    setNewTierQty((prev) => prev + (activeDiscountTerm === 'daily' || activeDiscountTerm === 'hourly' ? 5 : 2));
                                    setNewTierPrice((prev) => Math.max(1, Math.round(prev * 0.92)));
                                  }}
                                  className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-ink hover:bg-black text-primary text-xs font-black flex items-center justify-center gap-1 cursor-pointer min-h-[34px]"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{lang === 'fr' ? 'Ajouter' : 'إضافة'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* SALE LOGIC */}
                  {listingMode === 'sale' && (
                    <div className="space-y-4 pt-2">
                      <Input
                        type="number"
                        min={0}
                        label={t('machines.sale_price_label')}
                        value={salePrice > 0 ? salePrice : ''}
                        placeholder="0"
                        onChange={(e) => setSalePrice(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        required
                      />

                      <div>
                        <label className="text-xs font-bold text-steel-700 block mb-1.5">
                          {t('machines.condition_label')}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCondition('new')}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                              condition === 'new'
                                ? 'border-primary bg-amber-50 text-ink'
                                : 'border-steel-200 text-steel-600'
                            }`}
                          >
                            {t('machines.condition_new')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCondition('good')}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                              condition !== 'new'
                                ? 'border-primary bg-amber-50 text-ink'
                                : 'border-steel-200 text-steel-600'
                            }`}
                          >
                            {t('machines.condition_used')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 3: MANDATORY LOCATION WITH LEAFLET PICKER */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                <div>
                  <h4 className="text-xs font-extrabold text-ink flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary-dark shrink-0" />
                    <span>
                      {isSparePart
                        ? lang === 'fr'
                          ? 'Localisation du magasin / dépôt de la pièce'
                          : 'تحديد موقع قطعة الغيار / المتجر على الخريطة'
                        : t('machines.map_picker_title')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-black">
                      {lang === 'fr' ? 'Obligatoire' : 'إلزامي'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-steel-500 mt-0.5">
                    {isSparePart
                      ? lang === 'fr'
                        ? 'Obligatoire pour recevoir les demandes directes de pièces des propriétaires d’engins à proximité.'
                        : 'إلزامي ليتمكن ملاك الآليات من إيجاد قطعة الغيار عبر حملات البحث المباشر القريبة من مواقعهم.'
                      : lang === 'fr'
                      ? 'Nécessaire pour recevoir les alertes directes des chantiers à proximité.'
                      : 'ضروري لتحديد المسافة وتلقي إشعارات البحث المباشر من الأوراش القريبة منك.'}
                  </p>
                </div>
              </div>

              {/* Mandatory confirmation status bar */}
              {hasConfirmedMapLocation ? (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {lang === 'fr'
                        ? 'Position confirmée sur la carte'
                        : 'تم تثبيت الموقع على الخريطة بنجاح'}
                    </span>
                  </div>
                  <span dir="ltr" className="font-mono text-[11px] font-bold shrink-0">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950">
                  <div className="flex items-start gap-2 font-bold">
                    <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'fr'
                        ? 'Cliquez sur la carte, déplacez le marqueur ou confirmez la position ci-dessous :'
                        : 'انقر على الخريطة أو اسحب الدبوس لتحديد مكان الآلية، أو اضغط على زر التثبيت:'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasConfirmedMapLocation(true)}
                    className="px-3 py-2 rounded-xl bg-ink text-primary text-[11px] font-black hover:bg-steel-800 transition-colors shrink-0 cursor-pointer"
                  >
                    {lang === 'fr' ? 'Confirmer ce point ✓' : 'تثبيت هذا الموقع ✓'}
                  </button>
                </div>
              )}

              <MapLocationPicker
                lat={lat}
                lng={lng}
                cityId={cityId}
                showGpsButton={true}
                onLocationChange={handleLocationChange}
              />
            </div>
          )}

          {/* STEP 4: IMAGES UPLOAD (UP TO 8) */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-extrabold text-ink">
                  {t('machines.images_title')}
                </h4>
                <p className="text-[11px] text-steel-500">
                  {t('machines.images_hint')}
                </p>
              </div>

              {/* Upload Drop Area */}
              <div className="relative border-2 border-dashed border-steel-300 rounded-2xl p-6 text-center hover:border-primary transition-colors bg-steel-50">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={images.length >= 8 || isCompressingImages}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <UploadCloud className="w-8 h-8 text-primary-dark" />
                  <span className="text-xs font-bold text-ink">
                    {isCompressingImages
                      ? (lang === 'fr' ? 'Compression en cours...' : 'جاري ضغط الصور...')
                      : (lang === 'fr' ? 'Cliquez ou glissez jusqu\'à 8 photos' : 'انقر لاختيار حتى 8 صور')}
                  </span>
                  <span className="text-[10px] text-steel-400">
                    {images.length} / 8 {lang === 'fr' ? 'photos chargées' : 'صور مضافة'}
                  </span>
                </div>
              </div>

              {/* Thumbnails Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-xl overflow-hidden border border-steel-200 group bg-steel-100"
                  >
                    <img
                      src={imgUrl}
                      alt={`Aperçu ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 end-1.5 w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center shadow opacity-90 hover:opacity-100 cursor-pointer"
                      aria-label="Supprimer la photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 start-1.5 px-1.5 py-0.5 rounded bg-ink/80 text-white text-[9px] font-bold">
                        {lang === 'fr' ? 'Principale' : 'الرئيسية'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & PUBLISH */}
          {step === 5 && (
            <div className="space-y-4">
              <Card className="p-4 bg-steel-50 border-steel-200 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-steel-200">
                  <span className="font-bold text-steel-500">
                    {lang === 'fr' ? 'Titre :' : 'العنوان:'}
                  </span>
                  <span className="font-extrabold text-ink">
                    {titleAr || titleFr}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-steel-200">
                  <span className="font-bold text-steel-500">
                    {lang === 'fr' ? 'Mode :' : 'طريقة العرض:'}
                  </span>
                  <span className="font-bold text-primary-dark">
                    {listingMode === 'rent' ? t('machines.mode_rent_option') : t('machines.mode_sale_option')}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-steel-200">
                  <span className="font-bold text-steel-500">
                    {lang === 'fr' ? 'Tarif :' : 'التسعيرة:'}
                  </span>
                  <span className="font-mono font-black text-ink text-end">
                    {listingMode === 'rent'
                      ? `${dailyRate} MAD/j · ${monthlyRate} MAD/mois · ${yearlyRate} MAD/an`
                      : `${salePrice} MAD`}
                  </span>
                </div>

                {listingMode === 'rent' && !isSparePart && (
                  <div className="flex items-center justify-between pb-2 border-b border-steel-200">
                    <span className="font-bold text-steel-500">
                      {lang === 'fr' ? 'Paliers dégressifs :' : 'عروض التخفيض حسب المدة:'}
                    </span>
                    <span className="font-bold text-emerald-700 latin-nums">
                      {volumeDiscounts.length}{' '}
                      {lang === 'fr' ? 'paliers configurés' : 'شرائح مفعّلة'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-bold text-steel-500">
                    {lang === 'fr' ? 'Ville :' : 'المدينة:'}
                  </span>
                  <span className="font-bold text-ink">
                    {MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId}
                  </span>
                </div>
              </Card>

              {/* Publish Toggle */}
              <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-primary bg-amber-50/50 cursor-pointer">
                <div>
                  <span className="text-xs font-black text-ink block">
                    {t('machines.publish_toggle')}
                  </span>
                  <span className="text-[11px] text-steel-600">
                    {lang === 'fr'
                      ? 'L\'annonce sera immédiatement visible par les entrepreneurs'
                      : 'ستظهر الآلية مباشرة في نتائج البحث وسوق الآليات العام'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-6 h-6 accent-primary cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* Modal Navigation Footer */}
        <div className="p-4 bg-steel-50 border-t border-steel-200 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setStep(step - 1)}
              leftIcon={isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Précédent' : 'السابق'}
            </Button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                if (step === 1 && isSparePart && !partNumber.trim()) {
                  toast.error(
                    lang === 'fr'
                      ? 'Veuillez saisir la référence unique de la pièce (Réf / Part Number)'
                      : 'يرجى إدخال رقم المرجع الفريد لقطعة الغيار (Réf / Part Number) قبل المتابعة'
                  );
                  return;
                }
                if (step === 3 && !hasConfirmedMapLocation) {
                  toast.error(requireMapLocationMessage);
                  return;
                }
                setStep(step + 1);
              }}
              className="font-bold"
              rightIcon={isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Suivant' : 'التالي'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleFinalSubmit}
              isLoading={isSubmitting}
              className="font-black px-6 shadow-md"
              leftIcon={<Check className="w-4 h-4" />}
            >
              {t('common.save')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MachineStepperModal;
