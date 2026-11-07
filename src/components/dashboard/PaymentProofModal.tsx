import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  UploadCloud,
  FileCheck,
  Building2,
  Send,
  MessageCircle,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { mapDatabaseError } from '../../lib/errorHelpers';
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

interface PaymentProofModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isDismissible?: boolean;
}

export const PaymentProofModal: React.FC<PaymentProofModalProps> = ({
  isOpen,
  onClose,
  isDismissible = true,
}) => {
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

  if (!isOpen) return null;

  const handleCopyRib = () => {
    navigator.clipboard.writeText((settings.rib_number || '').replace(/\s+/g, ''));
    setIsCopied(true);
    toast.success(lang === 'fr' ? 'RIB copié dans le presse-papier !' : 'تم نسخ رقم الـ RIB بنجاح!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 5 * 1024 * 1024) {
        toast.error(lang === 'fr' ? 'Le fichier dépasse 5 Mo' : 'حجم الملف يتجاوز 5 ميغابايت');
        return;
      }
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
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
      let uploadedProofUrl = previewUrl || '';

      if (user?.id) {
        if (file) {
          const fileExt = file.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${Date.now()}_receipt.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            setIsSubmitting(false);
            const errKey = mapDatabaseError(uploadError);
            toast.error(t(errKey));
            return; // STOP!
          }

          uploadedProofUrl = uploadData?.path || filePath;
        }

        const { data: paymentData, error: dbError } = await supabase
          .from('payments')
          .insert({
            user_id: user.id,
            amount,
            method,
            reference: reference.trim(),
            proof_url: uploadedProofUrl,
            status: 'pending',
          })
          .select()
          .single();

        if (dbError) {
          setIsSubmitting(false);
          const errKey = mapDatabaseError(dbError);
          toast.error(t(errKey));
          return; // STOP!
        }
      }

      setIsSubmitting(false);
      setIsSubmittedSuccess(true);
      toast.success(t('lock.success_msg'));

      setTimeout(() => {
        if (isDismissible && onClose) {
          onClose();
        }
      }, 3500);
    } catch (err: any) {
      setIsSubmitting(false);
      const errKey = mapDatabaseError(err);
      toast.error(t(errKey));
      return; // STOP!
    }
  };

  const userPhone = profile?.phone || '+2126XXXXXXXX';
  const cleanPhone = (settings.whatsapp_number || '+212661234567').replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `السلام عليكم، لقد أرسلت وصل أداء اشتراك JADIJCB (${settings.monthly_price_mad} د.م) لحساب ${userPhone}. رقم المرجع: ${reference || 'مرفق'}. شكراً.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-2xl w-full shadow-2xl my-6 overflow-hidden text-start">
        {/* Top Header Strip */}
        <div className="bg-ink p-6 text-white relative border-b-2 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center font-black shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  تفعيل وترقية اشتراك المالك (JADIJCB PRO)
                </h3>
                <span className="text-xs text-primary font-bold">
                  {settings.monthly_price_mad} د.م / شهرياً · تجربة 72 ساعة مجانية
                </span>
              </div>
            </div>

            {isDismissible && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {isSubmittedSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <FileCheck className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-ink">
                {t('lock.success_msg')}
              </h4>
              <p className="text-xs text-steel-600 max-w-md mx-auto">
                {lang === 'fr'
                  ? 'Notre équipe vérifie les virements et transferts bancaires 7j/7. Votre compte sera mis à jour automatiquement.'
                  : 'فريق العمل يتحقق من الحوالات والتحويلات البنكية على مدار الساعة. يمكنك مراسلتنا فوراً عبر الواتساب لتسريع التفعيل.'}
              </p>
              <div className="pt-4">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-md min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تأكيد التفعيل عبر واتساب ({settings.whatsapp_number})</span>
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* ROI Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>استثمار ذكي ومضمون العائد 100%</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  💡 <strong>يوم كراء واحد لآلية واحدة</strong> (بمعدل 2,200 درهم) يغطي تكلفة اشتراكك لأكثر من <strong>10 أشهر كاملة</strong>! طلبات كراء مباشرة بدون أي وسيط أو عمولة مقتطعة.
                </p>
              </div>

              {/* Payment Instruction Options (Dynamic Bank RIB & Cash Beneficiary) */}
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-3">
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
                <h4 className="text-xs font-extrabold text-ink">
                  {t('lock.upload_title')}
                </h4>
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

                {/* Amount Confirmation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label={t('lock.amount_label')}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />

                  {/* File Upload Box */}
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
                              {lang === 'fr' ? 'Choisir la photo du reçu' : 'اختر صورة الوصل'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1 justify-center font-bold min-h-[48px]"
                    isLoading={isSubmitting}
                    leftIcon={<Send className="w-4 h-4" />}
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

export default PaymentProofModal;
