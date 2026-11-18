// ============================================================================
// JADIJCB: Interactive Driver Work Contract Builder & PDF Viewer Modal
// Lets Owner & Driver review negotiated terms, generate a formal bilingual PDF
// work contract inside the chat, both approve it, download/print the .pdf file,
// and unlock final deal closure ("إغلاق الصفقة").
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  X,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Handshake,
  Edit3,
  HardHat,
  Truck,
  Building2,
  ShieldCheck,
  Coins,
  Calendar,
  MapPin,
  Loader2,
  Send,
  Home,
  Utensils,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { DriverContractData, DriverDealContext, DriverSalaryUnit } from '../../types/database';
import { useLanguage } from '../../hooks/useLanguage';

export interface DriverContractFormValues {
  owner_name: string;
  owner_company: string;
  owner_phone: string;
  owner_ice: string;
  driver_name: string;
  driver_phone: string;
  driver_city: string;
  driver_cin: string;
  driver_license: string;
  machine_id?: string;
  machine_title: string;
  machine_image?: string;
  machine_category: string;
  machine_label_ar: string;
  machine_label_fr: string;
  work_city: string;
  work_location_note: string;
  offered_salary: number;
  salary_unit: DriverSalaryUnit;
  duration_label: string;
  start_date: string;
  payment_terms: string;
  accommodation_included: boolean;
  meals_included: boolean;
  custom_terms: string;
}

interface DriverContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'builder' | 'preview';
  contract: DriverContractData | null;
  dealContext?: DriverDealContext | null;
  partyRole?: 'owner' | 'driver';
  prefillOwner?: {
    name?: string;
    company?: string;
    phone?: string;
    ice?: string;
    city?: string;
  };
  prefillDriver?: {
    name?: string;
    phone?: string;
    city?: string;
  };
  canEdit?: boolean;
  onGenerateContract?: (values: DriverContractFormValues) => Promise<void>;
  onAgreeContract?: () => Promise<void>;
  onCloseDeal?: () => Promise<void>;
  isSubmittingAction?: boolean;
}

const DEFAULT_DRIVER_CLAUSES_AR = [
  'يلتزم السائق بقيادة الآلية وتشغيلها وفق قواعد السلامة المهنية المعمول بها في أوراش البناء والأشغال العمومية، مع ارتداء معدات الوقاية الفردية (الخوذة، السترة، والأحذية الواقية).',
  'يلتزم السائق بالفحص اليومي لمستوى الزيوت والماء وضغط الإطارات وتشحيم الآلية بانتظام، مع التبليغ الفوري لمالك الآلية عن أي عطل تقني.',
  'يلتزم المالك بتوفير آلية سليمة تقنياً ومؤمّنة، وبأداء الأجر المتفق عليه في هذا العقد داخل الآجال المحددة دون تأخير.',
  'يسري مفعول هذا العقد فور مصادقة الطرفين عليه رقمياً وإغلاق الصفقة عبر منصة JADIJCB.',
];

const DEFAULT_DRIVER_CLAUSES_FR = [
  'Le conducteur s’engage à conduire et exploiter l’engin dans le strict respect des normes de sécurité du chantier et du port des EPI obligatoires.',
  'Le conducteur assure le contrôle quotidien des niveaux (huile, eau, graissage) et signale immédiatement tout dysfonctionnement technique au propriétaire.',
  'Le propriétaire s’engage à mettre à disposition un engin conforme, assuré et en bon état de fonctionnement, et à verser la rémunération convenue aux échéances prévues.',
  'Le présent contrat prend effet dès validation numérique par les deux parties et clôture officielle de l’accord sur JADIJCB.',
];

export const DriverContractModal: React.FC<DriverContractModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  contract,
  dealContext,
  partyRole = 'owner',
  prefillOwner,
  prefillDriver,
  canEdit = false,
  onGenerateContract,
  onAgreeContract,
  onCloseDeal,
  isSubmittingAction = false,
}) => {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<'builder' | 'preview'>(initialMode);
  const [docLang, setDocLang] = useState<'ar' | 'fr'>(lang === 'fr' ? 'fr' : 'ar');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<DriverContractFormValues>({
    owner_name: '',
    owner_company: '',
    owner_phone: '',
    owner_ice: '',
    driver_name: '',
    driver_phone: '',
    driver_city: '',
    driver_cin: '',
    driver_license: '',
    machine_id: undefined,
    machine_title: '',
    machine_image: '',
    machine_category: 'tractopelle',
    machine_label_ar: '',
    machine_label_fr: '',
    work_city: '',
    work_location_note: '',
    offered_salary: 0,
    salary_unit: 'day',
    duration_label: '',
    start_date: new Date().toISOString().slice(0, 10),
    payment_terms: 'أداء أسبوعي منتظم',
    accommodation_included: false,
    meals_included: false,
    custom_terms: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setDocLang(lang === 'fr' ? 'fr' : 'ar');

    const baseSalary = contract?.offered_salary ?? dealContext?.offered_salary ?? 350;
    const baseUnit = contract?.salary_unit || dealContext?.salary_unit || 'day';

    setForm({
      owner_name: contract?.owner_name || prefillOwner?.name || 'مالك الآلية',
      owner_company: contract?.owner_company || prefillOwner?.company || prefillOwner?.name || '',
      owner_phone: contract?.owner_phone || prefillOwner?.phone || '',
      owner_ice: contract?.owner_ice || prefillOwner?.ice || '',
      driver_name:
        contract?.driver_name ||
        dealContext?.won_driver_name ||
        prefillDriver?.name ||
        'سائق مهني',
      driver_phone:
        contract?.driver_phone ||
        dealContext?.won_driver_phone ||
        prefillDriver?.phone ||
        '',
      driver_city:
        contract?.driver_city ||
        prefillDriver?.city ||
        dealContext?.work_city ||
        'المغرب',
      driver_cin: contract?.driver_cin || '',
      driver_license: contract?.driver_license || '',
      machine_id: contract?.machine_id || dealContext?.machine_id,
      machine_title:
        contract?.machine_title ||
        dealContext?.machine_title ||
        dealContext?.machine_label_ar ||
        'آلية أشغال عمومية',
      machine_image: contract?.machine_image || dealContext?.machine_image || '',
      machine_category:
        contract?.machine_category || dealContext?.machine_category || 'tractopelle',
      machine_label_ar:
        contract?.machine_label_ar || dealContext?.machine_label_ar || 'آلية أشغال عمومية',
      machine_label_fr:
        contract?.machine_label_fr || dealContext?.machine_label_fr || 'Engin BTP',
      work_city: contract?.work_city || dealContext?.work_city || 'المغرب (حسب موقع الورش)',
      work_location_note:
        contract?.work_location_note || dealContext?.work_location_note || '',
      offered_salary: Number(baseSalary) || 0,
      salary_unit: baseUnit,
      duration_label:
        contract?.duration_label || dealContext?.duration_label || 'شهر واحد قابل للتمديد',
      start_date: contract?.start_date || new Date().toISOString().slice(0, 10),
      payment_terms:
        contract?.payment_terms ||
        (baseUnit === 'month' ? 'أداء شهري منتظم' : 'أداء أسبوعي منتظم'),
      accommodation_included:
        contract?.accommodation_included ?? Boolean(dealContext?.accommodation_included),
      meals_included: contract?.meals_included ?? Boolean(dealContext?.meals_included),
      custom_terms: contract?.custom_terms || '',
    });
  }, [isOpen, initialMode, contract, dealContext, prefillOwner, prefillDriver, lang]);

  if (!isOpen) return null;

  const isDocAr = docLang === 'ar';
  const activeContract: DriverContractData | null = contract;
  const isDealFinalized = dealContext?.deal_status === 'accepted';
  const bothContractAgreed = Boolean(
    activeContract && activeContract.owner_agreed && activeContract.driver_agreed
  );
  const currentUserContractAgreed = Boolean(
    activeContract &&
      (partyRole === 'owner' ? activeContract.owner_agreed : activeContract.driver_agreed)
  );
  const currentUserDealClosed = Boolean(
    dealContext &&
      (partyRole === 'owner' ? dealContext.owner_accepted : dealContext.driver_accepted)
  );

  const handleDownloadPdf = async () => {
    if (!pdfSheetRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(pdfSheetRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
        });
      } catch {
        // Retry hiding external thumbnails if CORS blocks canvas readback
        canvas = await html2canvas(pdfSheetRef.current, {
          scale: 2,
          useCORS: false,
          allowTaint: false,
          backgroundColor: '#ffffff',
          ignoreElements: (el) => el.tagName === 'IMG' && el.hasAttribute('data-external-img'),
        });
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 16;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 8;

      pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 16;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 8;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 16;
      }

      const fileCode = activeContract?.contract_number || 'JADIJCB';
      pdf.save(`Contrat-Chauffeur-${fileCode}.pdf`);

      toast.success(
        lang === 'fr'
          ? 'Contrat PDF téléchargé avec succès !'
          : 'تم تحميل عقد العمل بصيغة PDF بنجاح!'
      );
    } catch {
      toast.info(
        lang === 'fr'
          ? 'Ouverture de l’aperçu d’impression PDF...'
          : 'جاري فتح نافذة الحفظ بصيغة PDF...'
      );
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSubmitBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onGenerateContract) return;
    if (!form.offered_salary || form.offered_salary <= 0) {
      toast.error(
        lang === 'fr' ? 'Veuillez indiquer la rémunération convenue' : 'يرجى تحديد الأجر المتفق عليه'
      );
      return;
    }
    if (!form.duration_label.trim()) {
      toast.error(
        lang === 'fr' ? 'Veuillez indiquer la durée de travail' : 'يرجى تحديد مدة العمل المتفق عليها'
      );
      return;
    }
    await onGenerateContract(form);
    setMode('preview');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:bg-white print:p-0 print:static"
      dir={lang === 'fr' ? 'ltr' : 'rtl'}
    >
      <div className="bg-surface w-full max-w-4xl max-h-[94vh] rounded-3xl shadow-2xl border border-steel-200 flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Modal Header */}
        <div className="bg-ink text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 text-start">
              <h2 className="text-sm sm:text-base font-black truncate">
                {mode === 'builder'
                  ? lang === 'fr'
                    ? 'Rédiger & Générer le Contrat PDF'
                    : 'إعداد وتوليد عقد تشغيل الآلية (PDF)'
                  : lang === 'fr'
                  ? `Contrat de travail · ${activeContract?.contract_number || ''}`
                  : `عقد تشغيل آلية وسائق · ${activeContract?.contract_number || ''}`}
              </h2>
              <p className="text-[11px] text-steel-300 truncate">
                {mode === 'builder'
                  ? lang === 'fr'
                    ? 'Vérifiez les conditions négociées puis envoyez le PDF dans la discussion.'
                    : 'راجع الشروط المتفق عليها في المحادثة وأرسل العقد للطرف الآخر للمصادقة.'
                  : lang === 'fr'
                  ? 'Les deux parties consultent et approuvent ce contrat PDF avant de clôturer l’accord.'
                  : 'يطلع الطرفان على العقد ويوافقان عليه ثم يضغطان على «إغلاق الصفقة».'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'preview' && (
              <div className="flex bg-steel-800 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDocLang('ar')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                    isDocAr ? 'bg-primary text-ink' : 'text-steel-300'
                  }`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => setDocLang('fr')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                    !isDocAr ? 'bg-primary text-ink' : 'text-steel-300'
                  }`}
                >
                  FR
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-steel-800 hover:bg-steel-700 text-steel-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {mode === 'builder' ? (
            <form onSubmit={handleSubmitBuilder} className="space-y-4 text-start">
              {/* Machine Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-white border border-steel-200 flex items-center gap-3">
                {form.machine_image ? (
                  <img
                    src={form.machine_image}
                    alt={form.machine_title}
                    className="w-14 h-14 rounded-xl object-cover border border-steel-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <Truck className="w-6 h-6 text-primary-dark" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-primary-dark block">
                    {lang === 'fr' ? 'Engin objet du contrat' : 'الآلية موضوع العقد'}
                  </span>
                  <h3 className="text-sm font-black text-ink truncate">{form.machine_title}</h3>
                  <span className="text-[11px] text-steel-500 block truncate">
                    {lang === 'fr' ? form.machine_label_fr : form.machine_label_ar}
                  </span>
                </div>
              </div>

              {/* Owner & Driver Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-steel-200 space-y-2.5">
                  <p className="text-xs font-black text-ink flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary-dark" />
                    <span>{lang === 'fr' ? '1er Partie : Propriétaire' : 'الطرف الأول: مالك الآلية'}</span>
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Nom / Entreprise' : 'الاسم أو اسم المقاولة'}
                    </label>
                    <input
                      type="text"
                      value={form.owner_company || form.owner_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          owner_company: e.target.value,
                          owner_name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        {lang === 'fr' ? 'Téléphone' : 'الهاتف'}
                      </label>
                      <input
                        type="text"
                        value={form.owner_phone}
                        onChange={(e) => setForm((p) => ({ ...p, owner_phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-mono text-ink"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        ICE (اختياري)
                      </label>
                      <input
                        type="text"
                        value={form.owner_ice}
                        onChange={(e) => setForm((p) => ({ ...p, owner_ice: e.target.value }))}
                        placeholder="001234567..."
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-mono text-ink"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-steel-200 space-y-2.5">
                  <p className="text-xs font-black text-ink flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-primary-dark" />
                    <span>{lang === 'fr' ? '2e Partie : Conducteur' : 'الطرف الثاني: السائق'}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        {lang === 'fr' ? 'Nom complet' : 'الاسم الكامل'}
                      </label>
                      <input
                        type="text"
                        value={form.driver_name}
                        onChange={(e) => setForm((p) => ({ ...p, driver_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        {lang === 'fr' ? 'Téléphone' : 'الهاتف'}
                      </label>
                      <input
                        type="text"
                        value={form.driver_phone}
                        onChange={(e) => setForm((p) => ({ ...p, driver_phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-mono text-ink"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        CIN (البطاقة الوطنية)
                      </label>
                      <input
                        type="text"
                        value={form.driver_cin}
                        onChange={(e) => setForm((p) => ({ ...p, driver_cin: e.target.value }))}
                        placeholder="مثال: BK123456"
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-mono text-ink"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-steel-600 mb-1">
                        {lang === 'fr' ? 'Permis / CACES' : 'رقم الرخصة'}
                      </label>
                      <input
                        type="text"
                        value={form.driver_license}
                        onChange={(e) => setForm((p) => ({ ...p, driver_license: e.target.value }))}
                        placeholder="Permis C / BTP"
                        className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-mono text-ink"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial & Work Duration Terms */}
              <div className="p-4 rounded-2xl bg-white border border-steel-200 space-y-3">
                <p className="text-xs font-black text-ink flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary-dark" />
                  <span>
                    {lang === 'fr'
                      ? 'Conditions financières, durée & lieu'
                      : 'شروط الأجر، المدة وموقع العمل'}
                  </span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Salaire convenu (MAD)' : 'الأجر المتفق عليه (د.م)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.offered_salary}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, offered_salary: Number(e.target.value) || 0 }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-sm font-black text-ink"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Unité' : 'وحدة الأجر'}
                    </label>
                    <select
                      value={form.salary_unit}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          salary_unit: e.target.value === 'month' ? 'month' : 'day',
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink bg-white"
                    >
                      <option value="day">{lang === 'fr' ? 'Par Jour' : 'يومي (باليوم)'}</option>
                      <option value="month">{lang === 'fr' ? 'Par Mois' : 'شهري (بالشهر)'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Mode de paiement' : 'وتيرة الأداء'}
                    </label>
                    <select
                      value={form.payment_terms}
                      onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink bg-white"
                    >
                      <option value="أداء يومي عند نهاية العمل">أداء يومي عند نهاية العمل</option>
                      <option value="أداء أسبوعي منتظم">أداء أسبوعي منتظم</option>
                      <option value="أداء كل 15 يوم">أداء كل 15 يوم</option>
                      <option value="أداء شهري منتظم">أداء شهري منتظم</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Durée du contrat' : 'المدة المتفق عليها'}
                    </label>
                    <input
                      type="text"
                      value={form.duration_label}
                      onChange={(e) => setForm((p) => ({ ...p, duration_label: e.target.value }))}
                      placeholder="مثال: شهرين قابل للتمديد"
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Date de début' : 'تاريخ بداية العمل'}
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-steel-600 mb-1">
                      {lang === 'fr' ? 'Ville / Chantier' : 'المدينة / موقع الورش'}
                    </label>
                    <input
                      type="text"
                      value={form.work_city}
                      onChange={(e) => setForm((p) => ({ ...p, work_city: e.target.value }))}
                      placeholder="الدار البيضاء - النواصر"
                      className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs font-bold text-ink"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.accommodation_included}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, accommodation_included: e.target.checked }))
                      }
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>{lang === 'fr' ? 'Logement assuré par le propriétaire' : 'السكن على عاتق المالك'}</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.meals_included}
                      onChange={(e) => setForm((p) => ({ ...p, meals_included: e.target.checked }))}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>{lang === 'fr' ? 'Repas pris en charge' : 'التغذية متوفرة'}</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-steel-600 mb-1">
                    {lang === 'fr'
                      ? 'Clauses supplémentaires convenues (optionnel)'
                      : 'شروط أو ملاحظات إضافية متفق عليها في المحادثة (اختياري)'}
                  </label>
                  <textarea
                    rows={2}
                    value={form.custom_terms}
                    onChange={(e) => setForm((p) => ({ ...p, custom_terms: e.target.value }))}
                    placeholder={
                      lang === 'fr'
                        ? 'Ex: Horaires 8h-17h, prime de rendement...'
                        : 'مثال: ساعات العمل من 8 صباحاً إلى 5 مساءً، توقف يوم الأحد، تعويض الساعات الإضافية...'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {activeContract && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setMode('preview')}
                    className="text-xs font-bold min-h-[42px]"
                  >
                    {lang === 'fr' ? 'Retour à l’aperçu' : 'العودة لمعاينة العقد'}
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmittingAction}
                  leftIcon={<Send className="w-4 h-4" />}
                  className="text-xs font-black min-h-[44px] shadow-sm"
                >
                  {activeContract
                    ? lang === 'fr'
                      ? 'Mettre à jour et envoyer le PDF'
                      : 'تحديث وإرسال العقد في المحادثة (PDF)'
                    : lang === 'fr'
                    ? 'Générer et envoyer le Contrat PDF'
                    : 'توليد وإرسال العقد في المحادثة (PDF)'}
                </Button>
              </div>
            </form>
          ) : activeContract ? (
            /* Official A4 Bilingual Contract Preview Sheet */
            <div className="space-y-4">
              <div
                ref={pdfSheetRef}
                dir={isDocAr ? 'rtl' : 'ltr'}
                className={`bg-white border border-steel-200 rounded-2xl p-6 sm:p-9 shadow-sm text-ink space-y-6 ${
                  isDocAr ? 'text-right' : 'text-left'
                }`}
              >
                {/* Official Letterhead */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b-2 border-ink">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-ink text-primary text-xs font-black">
                      <ShieldCheck className="w-4 h-4" />
                      <span>JADIJCB · {isDocAr ? 'عقد رقمي موثّق' : 'Contrat Numérique Vérifié'}</span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-black text-ink pt-1">
                      {isDocAr
                        ? 'عقد اتفاق وتشغيل آلية أشغال عمومية'
                        : 'CONTRAT D’ENGAGEMENT DE CONDUCTEUR D’ENGIN BTP'}
                    </h1>
                    <p className="text-xs text-steel-500 font-bold">
                      {isDocAr
                        ? 'وثيقة اتفاق متبادلة بين مالك الآلية والسائق المهني'
                        : 'Accord mutuel de travail et de conduite d’engin de chantier'}
                    </p>
                  </div>

                  <div className="text-xs bg-surface border border-steel-200 rounded-xl px-4 py-2.5 space-y-1">
                    <div className="font-black text-ink font-mono" dir="ltr">
                      {activeContract.contract_number} · v{activeContract.version}
                    </div>
                    <div className="text-[11px] text-steel-500 font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(activeContract.generated_at).toLocaleDateString(
                          isDocAr ? 'ar-MA' : 'fr-FR'
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parties Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface border border-steel-200 space-y-1.5">
                    <span className="text-[10px] font-black text-primary-dark uppercase block">
                      {isDocAr ? 'الطرف الأول (مالك الآلية / المقاولة)' : '1ère Partie : Propriétaire / Entreprise'}
                    </span>
                    <p className="text-sm font-black text-ink">
                      {activeContract.owner_company || activeContract.owner_name}
                    </p>
                    {activeContract.owner_phone && (
                      <p className="text-xs text-steel-600 font-mono" dir="ltr">
                        {activeContract.owner_phone}
                      </p>
                    )}
                    {activeContract.owner_ice && (
                      <p className="text-[11px] text-steel-500 font-mono" dir="ltr">
                        ICE: {activeContract.owner_ice}
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-surface border border-steel-200 space-y-1.5">
                    <span className="text-[10px] font-black text-primary-dark uppercase block">
                      {isDocAr ? 'الطرف الثاني (السائق المهني)' : '2ème Partie : Conducteur d’engins'}
                    </span>
                    <p className="text-sm font-black text-ink">{activeContract.driver_name}</p>
                    {activeContract.driver_phone && (
                      <p className="text-xs text-steel-600 font-mono" dir="ltr">
                        {activeContract.driver_phone}
                      </p>
                    )}
                    <p className="text-[11px] text-steel-600 font-bold">
                      {activeContract.driver_city || 'المغرب'}
                      {activeContract.driver_cin ? ` · CIN: ${activeContract.driver_cin}` : ''}
                      {activeContract.driver_license
                        ? ` · ${activeContract.driver_license}`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Machine & Conditions Card */}
                <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-amber-200">
                    {activeContract.machine_image ? (
                      <img
                        src={activeContract.machine_image}
                        alt={activeContract.machine_title}
                        crossOrigin="anonymous"
                        data-external-img="true"
                        className="w-16 h-16 rounded-xl object-cover border border-amber-300 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-white border border-amber-300 flex items-center justify-center shrink-0">
                        <Truck className="w-7 h-7 text-primary-dark" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {isDocAr ? 'الآلية المتفق على قيادتها' : 'Engin concerné par la mission'}
                      </span>
                      <h3 className="text-base font-black text-ink">
                        {activeContract.machine_title}
                      </h3>
                      <p className="text-xs text-steel-600 font-bold">
                        {isDocAr ? activeContract.machine_label_ar : activeContract.machine_label_fr}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {isDocAr ? 'الأجر المتفق عليه' : 'Rémunération'}
                      </span>
                      <span className="text-sm font-black text-ink tabular-nums">
                        {activeContract.offered_salary.toLocaleString('fr-FR')}{' '}
                        {isDocAr ? 'د.م' : 'MAD'}/
                        {activeContract.salary_unit === 'month'
                          ? isDocAr
                            ? 'شهر'
                            : 'mois'
                          : isDocAr
                          ? 'يوم'
                          : 'jour'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {isDocAr ? 'المدة المتوقعة' : 'Durée prévue'}
                      </span>
                      <span className="font-black text-ink block">
                        {activeContract.duration_label}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {isDocAr ? 'وتيرة الأداء' : 'Paiement'}
                      </span>
                      <span className="font-bold text-ink block">
                        {activeContract.payment_terms}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-steel-500 block">
                        {isDocAr ? 'المدينة / البداية' : 'Ville / Début'}
                      </span>
                      <span className="font-bold text-ink block">
                        <MapPin className="w-3 h-3 inline me-0.5 text-primary-dark" />
                        {activeContract.work_city}
                        {activeContract.start_date ? ` (${activeContract.start_date})` : ''}
                      </span>
                    </div>
                  </div>

                  {(activeContract.accommodation_included || activeContract.meals_included) && (
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-amber-200/70 text-xs font-bold text-emerald-800">
                      {activeContract.accommodation_included && (
                        <span className="inline-flex items-center gap-1">
                          <Home className="w-3.5 h-3.5" />
                          {isDocAr ? 'السكن موفّر على عاتق المالك' : 'Logement pris en charge'}
                        </span>
                      )}
                      {activeContract.meals_included && (
                        <span className="inline-flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5" />
                          {isDocAr ? 'التغذية متوفرة بالورش' : 'Repas inclus sur chantier'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Clauses */}
                <div className="space-y-2.5 text-xs">
                  <h4 className="font-black text-ink border-b border-steel-200 pb-1.5">
                    {isDocAr ? 'البنود والالتزامات المتفق عليها' : 'Clauses & Engagements Mutuels'}
                  </h4>
                  <ul className="space-y-1.5 text-steel-700 leading-relaxed list-disc list-inside">
                    {(isDocAr ? DEFAULT_DRIVER_CLAUSES_AR : DEFAULT_DRIVER_CLAUSES_FR).map(
                      (clause, idx) => (
                        <li key={idx}>{clause}</li>
                      )
                    )}
                    {activeContract.custom_terms && (
                      <li className="font-bold text-ink">{activeContract.custom_terms}</li>
                    )}
                  </ul>
                </div>

                {/* Dual Digital Signatures / Agreement Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div
                    className={`p-4 rounded-xl border-2 text-center space-y-1.5 ${
                      activeContract.owner_agreed
                        ? 'border-emerald-400 bg-emerald-50/60'
                        : 'border-dashed border-steel-300 bg-surface'
                    }`}
                  >
                    <span className="text-[11px] font-black text-ink block">
                      {isDocAr ? 'توقيع وموافقة المالك' : 'Approbation Propriétaire'}
                    </span>
                    <p className="text-xs font-bold text-steel-700">
                      {activeContract.owner_company || activeContract.owner_name}
                    </p>
                    {activeContract.owner_agreed ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isDocAr ? 'موافق على العقد' : 'Contrat approuvé'}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-steel-500 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {isDocAr ? 'في انتظار موافقة المالك' : 'En attente de validation'}
                      </span>
                    )}
                    {activeContract.owner_agreed_at && (
                      <span className="block text-[10px] text-steel-500 font-mono" dir="ltr">
                        {new Date(activeContract.owner_agreed_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-4 rounded-xl border-2 text-center space-y-1.5 ${
                      activeContract.driver_agreed
                        ? 'border-emerald-400 bg-emerald-50/60'
                        : 'border-dashed border-steel-300 bg-surface'
                    }`}
                  >
                    <span className="text-[11px] font-black text-ink block">
                      {isDocAr ? 'توقيع وموافقة السائق' : 'Approbation Conducteur'}
                    </span>
                    <p className="text-xs font-bold text-steel-700">{activeContract.driver_name}</p>
                    {activeContract.driver_agreed ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isDocAr ? 'موافق على العقد' : 'Contrat approuvé'}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-steel-500 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {isDocAr ? 'في انتظار موافقة السائق' : 'En attente de validation'}
                      </span>
                    )}
                    {activeContract.driver_agreed_at && (
                      <span className="block text-[10px] text-steel-500 font-mono" dir="ltr">
                        {new Date(activeContract.driver_agreed_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                {isDealFinalized && (
                  <div className="p-3 rounded-xl bg-emerald-600 text-white text-center text-xs font-black flex items-center justify-center gap-2">
                    <Handshake className="w-4 h-4" />
                    <span>
                      {isDocAr
                        ? 'عقد نهائي مختوم — تم إغلاق الصفقة بنجاح وحفظه في حساب الطرفين'
                        : 'CONTRAT FINALISÉ — Accord conclu et enregistré pour les deux parties'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-steel-500">
              {lang === 'fr' ? 'Aucun contrat disponible.' : 'لم يتم إنشاء عقد بعد.'}
            </div>
          )}
        </div>

        {/* Sticky Modal Footer Actions */}
        {mode === 'preview' && activeContract && (
          <div className="bg-white border-t border-steel-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isDownloadingPdf}
                onClick={handleDownloadPdf}
                leftIcon={<Download className="w-4 h-4 text-primary-dark" />}
                className="text-xs font-black min-h-[40px]"
              >
                {lang === 'fr' ? 'Télécharger PDF' : 'تحميل العقد PDF'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
                className="text-xs font-bold min-h-[40px]"
              >
                {lang === 'fr' ? 'Imprimer' : 'طباعة'}
              </Button>

              {canEdit && !isDealFinalized && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('builder')}
                  leftIcon={<Edit3 className="w-4 h-4" />}
                  className="text-xs font-bold min-h-[40px]"
                >
                  {lang === 'fr' ? 'Modifier les termes' : 'تعديل الشروط'}
                </Button>
              )}
            </div>

            {/* Dual Agreement -> Deal Closure Progression */}
            {dealContext && !isDealFinalized && dealContext.deal_status !== 'closed' && (
              <div className="flex flex-wrap items-center gap-2">
                {!currentUserContractAgreed && onAgreeContract ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    isLoading={isSubmittingAction}
                    onClick={onAgreeContract}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    className="text-xs font-black min-h-[42px] shadow-sm"
                  >
                    {lang === 'fr' ? 'J’approuve ce contrat' : 'أوافق على بنود العقد'}
                  </Button>
                ) : !bothContractAgreed ? (
                  <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-black flex items-center gap-1.5">
                    <Clock className="w-4 h-4 animate-pulse shrink-0" />
                    <span>
                      {lang === 'fr'
                        ? 'En attente de l’approbation de l’autre partie'
                        : 'وافقت على العقد — في انتظار موافقة الطرف الآخر'}
                    </span>
                  </div>
                ) : !currentUserDealClosed && onCloseDeal ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    isLoading={isSubmittingAction}
                    onClick={onCloseDeal}
                    leftIcon={<Handshake className="w-4 h-4" />}
                    className="text-xs font-black min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    {lang === 'fr' ? 'Clôturer l’accord maintenant' : 'إغلاق الصفقة الآن 🤝'}
                  </Button>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>
                      {lang === 'fr'
                        ? 'En attente de clôture par le partenaire'
                        : 'تم تأكيدك — في انتظار ضغط الطرف الآخر لإغلاق الصفقة'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverContractModal;
