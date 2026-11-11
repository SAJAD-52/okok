import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  UploadCloud,
  FileCheck,
  MessageCircle,
  AlertCircle,
  Clock,
  Sparkles,
  TrendingUp,
  CreditCard,
  Phone,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  MONTHLY_PLAN_PRICE_MAD,
  WHATSAPP_ADMIN_LINK,
} from '../../lib/constants';
import { platformSettingsStore, PlatformSettings } from '../../lib/platformSettings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { PaymentMethod } from '../../types/database';
import { mapDatabaseError } from '../../lib/errorHelpers';
import { compressImage } from '../../lib/imageCompressor';

interface SoftLockModalProps {
  isLocked: boolean;
}

export const SoftLockModal: React.FC<SoftLockModalProps> = ({ isLocked }) => {
  const { t, lang } = useLanguage();
  const { profile, user } = useAuth();

  const [settings, setSettings] = useState<PlatformSettings>(() => platformSettingsStore.getSettings());

  useEffect(() => {
    const handleUpdate = () => {
      setSettings(platformSettingsStore.getSettings());
    };
    window.addEventListener('jadijcb_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    platformSettingsStore.pullFromRemote().then(setSettings);
    return () => {
      window.removeEventListener('jadijcb_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const [method, setMethod] = useState<PaymentMethod>('rib');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState<number>(() => settings.monthly_price_mad || 200);

  useEffect(() => {
    if (settings.monthly_price_mad) {
      setAmount(settings.monthly_price_mad);
    }
  }, [settings.monthly_price_mad]);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  if (!isLocked) return null;

  const handleCopyRib = () => {
    navigator.clipboard.writeText((settings.rib_number || '').replace(/\s+/g, ''));
    setIsCopied(true);
    toast.success(lang === 'fr' ? 'RIB copié dans le presse-papier !' : 'تم نسخ رقم الـ RIB بنجاح!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      try {
        const compressed = await compressImage(selected);
        setFile(compressed.file);
        setPreviewUrl(compressed.previewUrl);
      } catch {
        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez saisir le numéro de référence' : 'يرجى إدخال رقم المرجع أو العملية');
      return;
    }

    if (!file && !previewUrl) {
      toast.error(lang === 'fr' ? 'Veuillez joindre le reçu' : 'يرجى إرفاق صورة الوصل');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedProofUrl = '';

      if (isSupabaseConfigured && user?.id) {
        if (file) {
          const fileExt = file.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${Date.now()}_receipt.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

          if (uploadError) {
            setIsSubmitting(false);
            const errKey = mapDatabaseError(uploadError);
            toast.error(t(errKey));
            return;
          }

          uploadedProofUrl = uploadData?.path || filePath;
        }

        const { error: insertError } = await supabase.from('payments').insert({
          user_id: user.id,
          amount,
          method,
          reference: reference.trim(),
          proof_url: uploadedProofUrl,
          status: 'pending',
        });

        if (insertError) {
          setIsSubmitting(false);
          const errKey = mapDatabaseError(insertError);
          toast.error(t(errKey));
          return;
        }
      }

      setIsSubmitting(false);
      setIsSubmittedSuccess(true);
      toast.success(t('lock.success_msg'));
    } catch {
      setIsSubmitting(false);
      toast.error(t('common.error'));
    }
  };

  const userPhone = profile?.phone || '+2126XXXXXXXX';
  const cleanPhone = (settings.whatsapp_number || '+212661234567').replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `السلام عليكم، لقد قمت بأداء اشتراك منصة JADIJCB (${settings.monthly_price_mad} د.م) لحساب ${userPhone}. رقم المرجع: ${reference || 'وصل مرفق'}. أرجو التأكيد والتفعيل السريع وشكراً.`
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="softlock-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-2xl w-full shadow-2xl my-auto overflow-hidden text-start">
        {/* Urgent Industrial Header */}
        <div className="bg-ink p-6 text-white border-b-2 border-primary relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-danger/20 border border-danger text-danger flex items-center justify-center font-black shrink-0">
              <Lock className="w-6 h-6 text-red-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="softlock-title" className="text-base sm:text-xl font-black text-white">
                  {lang === 'fr' ? 'Fin de la période d\'essai gratuite (72h)' : 'انتهاء الفترة التجريبية المجانية (72 ساعة)'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger text-white font-black uppercase tracking-wider">
                  تفعيل الاشتراك
                </span>
              </div>
              <p className="text-xs text-steel-400 mt-1 max-w-xl">
                {lang === 'fr'
                  ? 'Pour continuer à recevoir des demandes de location des chantiers et entreprises, activez votre abonnement mensuel.'
                  : 'لتستمر آلياتك في الظهور بمحرك بحث المقاولات واستقبال طلبات الكراء المباشرة، فعّل اشتراكك الشهري الآن.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {isSubmittedSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <FileCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-ink">
                {t('lock.success_msg')}
              </h3>
              <p className="text-xs text-steel-600 max-w-md mx-auto">
                {lang === 'fr'
                  ? 'Votre reçu est bien transmis aux administrateurs. Vous pouvez contacter le support WhatsApp pour une activation en quelques minutes.'
                  : 'وصل الأداء قيد المراجعة لدى الإدارة. يمكنك مراسلة الدعم المباشر عبر واتساب لتسريع التفعيل خلال دقائق.'}
              </p>
              <div className="pt-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all min-h-[48px]"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>تأكيد التفعيل عبر واتساب ({settings.whatsapp_number})</span>
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Subscription Plan Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/5 border-2 border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-dark" />
                    <span className="text-xs font-black text-ink">
                      اشتراك مالك الآليات الاحترافي (JADIJCB PRO)
                    </span>
                  </div>
                  <p className="text-[11px] text-steel-700 mt-1">
                    عرض غير محدود للآليات · متجر إلكتروني معتمد · 0% عمولة على عقود الكراء
                  </p>
                </div>
                <div className="text-end">
                  <div className="text-2xl font-black text-ink font-mono latin-nums">
                    {settings.monthly_price_mad} <span className="text-xs font-bold text-steel-600">د.م / شهر</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    بدون أي التزام أو عمولة
                  </span>
                </div>
              </div>

              {/* Moroccan ROI & Lead Magnet Value Proposition */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>استثمار ذكي ومضمون العائد 100%</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  💡 <strong>يوم كراء واحد لآلية واحدة</strong> (بمعدل 2,200 درهم/يوم) يغطي تكلفة اشتراكك الشهري لأكثر من <strong>10 أشهر كاملة</strong>! تواصل مباشر وفوري مع مديري المشاريع والمقاولات بدون أي وسيط.
                </p>
              </div>

              {/* Payment Instruction Options (Dynamic Bank RIB & Cash Beneficiary) */}
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-2">
                  طرق الأداء المعتمدة (تحويل بنكي أو وكالات كاش):
                </label>

                {/* Option 1: Bank RIB */}
                <Card className="p-4 mb-3 border-steel-200 bg-surface">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary-dark" />
                      <span className="text-xs font-extrabold text-ink">
                        التحويل البنكي المباشر (Virement Bancaire)
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-steel-200 text-steel-700 font-bold">
                      {settings.bank_name}
                    </span>
                  </div>

                  <p className="text-[11px] text-steel-600 mb-2">
                    اسم صاحب الحساب: <strong>{settings.account_holder_name}</strong>
                  </p>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-steel-300 font-mono text-xs font-bold tracking-wide">
                    <span className="truncate text-ink select-all">{settings.rib_number}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyRib}
                      className="ms-2 shrink-0 text-xs py-1 px-2.5 min-h-[32px] font-bold"
                      leftIcon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {isCopied ? 'تم النسخ ✓' : 'نسخ رقم الـ RIB'}
                    </Button>
                  </div>
                </Card>

                {/* Option 2: Cash Plus / Wafacash */}
                <Card className="p-4 border-steel-200 bg-surface">
                  <span className="text-xs font-extrabold text-ink block mb-1">
                    أو التحويل عبر وكالات تحويل الأموال (Wafacash / Cash Plus):
                  </span>
                  <div className="p-2.5 rounded-xl bg-white border border-steel-300 text-xs text-steel-700 space-y-1">
                    <p>
                      المستفيد: <strong>{settings.account_holder_name}</strong>
                    </p>
                    <p>
                      رقم البطاقة الوطنية (CIN): <strong className="font-mono">{settings.cin_number}</strong>
                    </p>
                    <p>
                      المدينة: <strong>{settings.city}</strong>
                    </p>
                  </div>
                </Card>
              </div>

              {/* Upload Proof Form */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-steel-200">
                <h3 className="text-xs font-extrabold text-ink">
                  {t('lock.upload_title')}
                </h3>
                <p className="text-[11px] text-steel-500">
                  {t('lock.upload_desc')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {t('lock.method_select')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMethod('rib')}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                          method === 'rib'
                            ? 'border-primary bg-primary-100/50 text-ink'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        {t('lock.method_rib')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod('wafacash')}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                          method === 'wafacash'
                            ? 'border-primary bg-primary-100/50 text-ink'
                            : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                        }`}
                      >
                        {t('lock.method_wafacash')}
                      </button>
                    </div>
                  </div>

                  {/* Reference */}
                  <Input
                    label={t('lock.reference_label')}
                    placeholder={t('lock.reference_placeholder')}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                  />
                </div>

                {/* Amount Confirmation & File Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label={t('lock.amount_label')}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />

                  <div>
                    <label className="text-xs font-bold text-steel-700 block mb-1.5">
                      {t('lock.proof_label')}
                    </label>
                    <div className="relative border-2 border-dashed border-steel-300 rounded-xl p-3 text-center hover:border-primary transition-colors cursor-pointer bg-steel-50">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        required={!previewUrl}
                      />
                      <div className="flex items-center justify-center gap-2 text-steel-600">
                        {file ? (
                          <>
                            <FileCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-ink truncate max-w-[180px]">
                              {file.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4 text-steel-400" />
                            <span className="text-xs font-medium">
                              {lang === 'fr' ? 'Photo du reçu de virement' : 'صورة وصل التحويل أو الحوالة'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1 justify-center font-black min-h-[48px]"
                    isLoading={isSubmitting}
                  >
                    {t('lock.submit_btn')}
                  </Button>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors min-h-[48px] shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{t('lock.whatsapp_btn')}</span>
                  </a>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoftLockModal;
