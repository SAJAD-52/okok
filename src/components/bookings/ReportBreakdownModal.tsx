// ============================================================================
// JADIJCB: Client Machine Breakdown / Fault Report Modal
// Used once a booking is active (machine delivered to client on site)
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Wrench,
  Send,
  ShieldAlert,
  Info,
  Zap,
  Droplets,
  Cog,
  Disc,
} from 'lucide-react';
import {
  Booking,
  BreakdownCategory,
  BreakdownSeverity,
} from '../../types/database';
import {
  BREAKDOWN_CATEGORIES,
  BREAKDOWN_SEVERITIES,
  reportBookingBreakdown,
} from '../../lib/breakdownService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';

interface ReportBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onBreakdownReported?: (updatedBooking: Booking) => void;
}

const CATEGORY_ICONS: Record<BreakdownCategory, React.ReactNode> = {
  hydraulic: <Wrench className="w-4 h-4" />,
  engine: <Cog className="w-4 h-4" />,
  electrical: <Zap className="w-4 h-4" />,
  fuel_leak: <Droplets className="w-4 h-4" />,
  tire_track: <Disc className="w-4 h-4" />,
  other: <AlertTriangle className="w-4 h-4" />,
};

export const ReportBreakdownModal: React.FC<ReportBreakdownModalProps> = ({
  isOpen,
  onClose,
  booking,
  onBreakdownReported,
}) => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();

  const [category, setCategory] = useState<BreakdownCategory>('hydraulic');
  const [severity, setSeverity] = useState<BreakdownSeverity>('critical');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !booking) return null;

  const machineTitle =
    lang === 'fr'
      ? (booking.machine as any)?.title_fr ||
        (booking.machine as any)?.title_ar ||
        (booking.machine as any)?.brand ||
        'Engin loué'
      : (booking.machine as any)?.title_ar ||
        (booking.machine as any)?.title_fr ||
        (booking.machine as any)?.brand ||
        'الآلية المستلمة';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim() || description.trim().length < 4) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez décrire brièvement la panne constatée'
          : 'يرجى كتابة وصف مختصر للعطل الظاهر في الآلية'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const reporterName =
        profile?.company_name ||
        profile?.full_name ||
        booking.client_name ||
        (lang === 'fr' ? 'Client' : 'الزبون');

      const res = await reportBookingBreakdown({
        booking,
        category,
        severity,
        description: description.trim(),
        reporterId: user?.id || profile?.id,
        reporterName,
      });

      if (onBreakdownReported) {
        onBreakdownReported(res.updatedBooking);
      }

      toast.success(
        lang === 'fr'
          ? 'Panne enregistrée sur la commande et le propriétaire a été notifié !'
          : 'تم تسجيل العطل في خانة الطلب وإرسال إشعار فوري للمالك!'
      );

      setDescription('');
      setCategory('hydraulic');
      setSeverity('critical');
      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-white border border-steel-200 shadow-2xl rounded-3xl overflow-hidden p-0 animate-in fade-in zoom-in-95 duration-150 text-start">
        {/* Top Dark Header */}
        <div className="bg-ink text-white p-5 flex items-center justify-between border-b-2 border-rose-500">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white truncate">
                {lang === 'fr' ? 'Signaler une panne sur l’engin' : 'الإبلاغ عن عطل في الآلية'}
              </h3>
              <p className="text-xs text-amber-300 font-bold truncate">
                {machineTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Category Picker */}
          <div>
            <label className="text-xs font-black text-ink block mb-2">
              {lang === 'fr' ? 'Type de panne constatée :' : 'نوع العطل الذي ظهر:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BREAKDOWN_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all text-start cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500 shadow-xs'
                        : 'bg-white border-steel-200 text-steel-700 hover:border-steel-300 hover:bg-steel-50'
                    }`}
                  >
                    <span className={isSelected ? 'text-rose-600' : 'text-steel-400'}>
                      {CATEGORY_ICONS[cat.id]}
                    </span>
                    <span className="leading-tight">
                      {lang === 'fr' ? cat.labelFr : cat.labelAr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity Selector */}
          <div>
            <label className="text-xs font-black text-ink block mb-2">
              {lang === 'fr' ? 'État actuel de l’engin :' : 'حالة الآلية حالياً:'}
            </label>
            <div className="space-y-2">
              {BREAKDOWN_SEVERITIES.map((sev) => {
                const isSelected = severity === sev.id;
                const badgeColors =
                  sev.id === 'critical'
                    ? 'border-rose-500 bg-rose-50/90 text-rose-950 ring-1 ring-rose-500'
                    : sev.id === 'moderate'
                    ? 'border-amber-500 bg-amber-50/90 text-amber-950 ring-1 ring-amber-500'
                    : 'border-sky-500 bg-sky-50/90 text-sky-950 ring-1 ring-sky-500';
                return (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverity(sev.id)}
                    className={`w-full p-3 rounded-xl border text-start transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? badgeColors
                        : 'border-steel-200 bg-white hover:bg-steel-50 text-steel-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-black block">
                        {lang === 'fr' ? sev.labelFr : sev.labelAr}
                      </span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        {lang === 'fr' ? sev.hintFr : sev.hintAr}
                      </span>
                    </div>
                    {sev.id === 'critical' ? (
                      <ShieldAlert className={`w-4 h-4 shrink-0 ${isSelected ? 'text-rose-600' : 'text-steel-400'}`} />
                    ) : (
                      <Info className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-steel-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-black text-ink block mb-1.5">
              {lang === 'fr' ? 'Détails de la panne (obligatoire) :' : 'تفاصيل العطل ومكانه (مطلوب):'}
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Ex: Fuite d’huile au niveau du vérin du godet avant, impossible de continuer le terrassement...'
                  : 'مثال: تسرب زيت في ذراع الرفع الأمامي وتوقفت الآلية عن العمل في الورش...'
              }
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Instant Notice Callout */}
          <div className="p-3 rounded-xl bg-steel-50 border border-steel-200 text-[11px] text-steel-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'fr'
                ? 'Ce signalement sera enregistré directement dans la fiche de votre réservation et enverra une alerte instantanée au propriétaire.'
                : 'سيُحفظ هذا البلاغ فوراً داخل إطار الطلب عند المالك وعندك، وسيصله إشعار فوري لاتخاذ اللازم.'}
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
              className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600 font-black"
            >
              {isSubmitting
                ? (lang === 'fr' ? 'Envoi...' : 'جاري الإرسال...')
                : (lang === 'fr' ? 'Envoyer l’alerte au propriétaire' : 'تسجيل العطل وإشعار المالك')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ReportBreakdownModal;
