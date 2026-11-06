// ============================================================================
// JADIJCB: Rental Extension Modal for Contractors (طلب تمديد مدة الكراء)
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  Truck,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Booking } from '../../types/database';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { formatPriceMAD } from '../../data/rentalTerms';

interface RentalExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onExtensionSubmitted?: (updatedBooking: Booking) => void;
}

export const RentalExtensionModal: React.FC<RentalExtensionModalProps> = ({
  isOpen,
  onClose,
  booking,
  onExtensionSubmitted,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();

  const [extensionDays, setExtensionDays] = useState<number>(3);
  const [customDate, setCustomDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !booking) return null;

  const currentEnd = new Date(booking.end_at || booking.end_date || Date.now());
  const dailyRate =
    (booking.machine as any)?.daily_rate ||
    (booking.machine as any)?.rate_daily ||
    Math.round(booking.total_price / 3) ||
    2000;

  // Calculate new end date and extra cost
  let newEndDate: Date;
  let calculatedDays = extensionDays;

  if (customDate) {
    newEndDate = new Date(customDate);
    const diffMs = newEndDate.getTime() - currentEnd.getTime();
    calculatedDays = Math.max(1, Math.round(diffMs / (24 * 3600 * 1000)));
  } else {
    newEndDate = new Date(currentEnd.getTime() + extensionDays * 24 * 3600 * 1000);
  }

  const extraAmount = calculatedDays * dailyRate;

  const formatDateDisplay = (d: Date) => {
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePresetDays = (days: number) => {
    setExtensionDays(days);
    setCustomDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEndDate <= currentEnd) {
      toast.error(
        lang === 'fr'
          ? 'La nouvelle date doit être postérieure à la date de fin actuelle'
          : 'تاريخ التمديد يجب أن يكون بعد تاريخ نهاية الحجز الحالي'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const extensionTag = `[طلب تمديد: +${calculatedDays} أيام إلى ${newEndDate.toISOString().slice(0, 10)} بمبلغ إضافي ${extraAmount} درهم - ${reason.trim() || 'أشغال الورش مستمرة'}]`;
      const updatedNotes = booking.notes
        ? `${booking.notes}\n${extensionTag}`
        : extensionTag;

      // 1. Update booking in Supabase
      const { data, error } = await supabase
        .from('bookings')
        .update({
          notes: updatedNotes,
        })
        .eq('id', booking.id)
        .select('*, machines(*)')
        .single();

      if (error) {
        console.warn('Extension update error:', error.message);
      }

      // 2. Also send chat message to owner if conversation exists
      if (booking.owner_id && user?.id) {
        try {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .or(
              `and(participant_a.eq.${user.id},participant_b.eq.${booking.owner_id}),and(participant_a.eq.${booking.owner_id},participant_b.eq.${user.id})`
            )
            .maybeSingle();

          if (conv?.id) {
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              sender_id: user.id,
              content: `📢 طلب تمديد كراء: نطلب تمديد مدة كراء الآلية لمدة ${calculatedDays} أيام إضافية إلى غاية ${formatDateDisplay(newEndDate)} (+${extraAmount.toLocaleString('fr-FR')} درهم). ملاحظات: ${reason || 'أشغال الورش لا زالت مستمرة'}`,
            });
          }
        } catch (msgErr) {
          console.warn('Could not post extension chat message:', msgErr);
        }
      }

      const updatedBooking: Booking = {
        ...booking,
        notes: updatedNotes,
      };

      if (onExtensionSubmitted) {
        onExtensionSubmitted(updatedBooking);
      }

      toast.success(
        lang === 'fr'
          ? `Demande de prolongation envoyée avec succès (+${calculatedDays} jours)`
          : `تم إرسال طلب تمديد الكراء للمالك بنجاح (+${calculatedDays} أيام)`
      );

      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-white border border-steel-200 shadow-2xl rounded-3xl overflow-hidden p-0 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-ink text-white p-5 flex items-center justify-between border-b border-steel-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {lang === 'fr' ? 'Demande de prolongation' : 'طلب تمديد فترة الكراء'}
              </h3>
              <p className="text-xs text-primary font-bold">
                {(booking.machine as any)?.title_ar || (booking.machine as any)?.title_fr || 'الآلية المؤجرة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Timeline Overview */}
          <div className="bg-steel-50 rounded-2xl p-4 border border-steel-200 flex items-center justify-between gap-3 text-xs">
            <div className="text-start">
              <span className="text-steel-500 block text-[11px]">
                {lang === 'fr' ? 'Fin actuelle :' : 'تاريخ النهاية الحالي:'}
              </span>
              <span className="font-black text-ink">{formatDateDisplay(currentEnd)}</span>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary/20 text-ink flex items-center justify-center shrink-0">
              {isRTL ? <ArrowLeft className="w-4 h-4 text-primary-dark" /> : <ArrowRight className="w-4 h-4 text-primary-dark" />}
            </div>

            <div className="text-end">
              <span className="text-steel-500 block text-[11px]">
                {lang === 'fr' ? 'Nouvelle fin :' : 'تاريخ النهاية الجديد:'}
              </span>
              <span className="font-black text-primary-dark">{formatDateDisplay(newEndDate)}</span>
            </div>
          </div>

          {/* Preset Days Options */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-2">
              {lang === 'fr' ? 'Sélectionnez la durée de prolongation :' : 'اختر مدة التمديد المطلوبة:'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { days: 3, label: lang === 'fr' ? '+3 j' : '+3 أيام' },
                { days: 7, label: lang === 'fr' ? '+1 sem' : '+أسبوع' },
                { days: 14, label: lang === 'fr' ? '+2 sem' : '+أسبوعين' },
                { days: 30, label: lang === 'fr' ? '+1 mois' : '+شهر' },
              ].map((p) => {
                const isSelected = extensionDays === p.days && !customDate;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => handlePresetDays(p.days)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-ink border-primary shadow-sm'
                        : 'bg-white text-steel-700 border-steel-200 hover:border-steel-400'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Picker */}
          <div>
            <label className="text-[11px] font-bold text-steel-500 block mb-1">
              {lang === 'fr' ? 'Ou choisissez une date de fin exacte :' : 'أو حدد تاريخ نهاية محدد للورش:'}
            </label>
            <input
              type="date"
              min={currentEnd.toISOString().slice(0, 10)}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[42px]"
            />
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1">
              {lang === 'fr' ? 'Motif de la prolongation (optionnel) :' : 'سبب التمديد وملاحظات الورش (اختياري):'}
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Ex: Chantier de terrassement prolongé de quelques jours...'
                  : 'مثال: أعمال الحفر مستمرة في الورش ونحتاج الآلية مع نفس السائق...'
              }
              className="w-full px-3 py-2 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Pricing Summary Box */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-primary/40 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-steel-600">
              <span>{lang === 'fr' ? 'Tarif journalier :' : 'التسعيرة اليومية:'}</span>
              <span className="font-bold">{dailyRate.toLocaleString('fr-FR')} MAD</span>
            </div>
            <div className="flex items-center justify-between text-steel-600">
              <span>{lang === 'fr' ? 'Nombre de jours ajoutés :' : 'عدد الأيام الإضافية:'}</span>
              <span className="font-bold">+{calculatedDays} {lang === 'fr' ? 'jours' : 'أيام'}</span>
            </div>
            <div className="pt-2 border-t border-primary/20 flex items-center justify-between text-sm font-black text-ink">
              <span>{lang === 'fr' ? 'Montant additionnel estimé :' : 'المبلغ الإضافي التقديري:'}</span>
              <span className="text-primary-dark font-black">{extraAmount.toLocaleString('fr-FR')} MAD</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              {isSubmitting
                ? (lang === 'fr' ? 'Envoi...' : 'جاري الإرسال...')
                : (lang === 'fr' ? 'Envoyer la demande' : 'إرسال طلب التمديد للمالك')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
