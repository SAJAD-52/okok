// ============================================================================
// JADIJCB: Record Partial Payment Modal (تسجيل دفعة وأداء)
// Amount, Method (Espèces, Virement RIB, Wafacash, Chèque), Date & Notes
// ============================================================================

import React, { useState } from 'react';
import { X, CreditCard, Banknote, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { Booking, PaymentMethodType } from '../../types/database';
import { paymentService } from '../../lib/paymentService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  balanceDue: number;
  onPaymentRecorded: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  booking,
  balanceDue,
  onPaymentRecorded,
}) => {
  const { lang } = useLanguage();
  const [amount, setAmount] = useState<string>(String(balanceDue > 0 ? balanceDue : 1000));
  const [method, setMethod] = useState<PaymentMethodType>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      toast.error(lang === 'fr' ? 'Montant invalide' : 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setIsSubmitting(true);
    const res = await paymentService.recordPayment({
      booking_id: booking.id,
      owner_id: booking.owner_id,
      amount: num,
      method,
      payment_date: paymentDate,
      note,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        lang === 'fr' ? 'Paiement enregistré avec succès !' : 'تم تسجيل الدفعة والأداء بنجاح!'
      );
      onPaymentRecorded();
      onClose();
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs text-start"
    >
      <div className="bg-white border border-steel-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-black text-sm">
              {lang === 'fr' ? 'Enregistrer un règlement' : 'تسجيل دفعة / أداء للحجز'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Booking Summary Box */}
          <div className="p-3 rounded-2xl bg-steel-50 border border-steel-200 space-y-1">
            <div className="flex justify-between font-bold text-ink">
              <span>{booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية'}</span>
              <span className="font-mono text-primary-dark">
                {Number(booking.total_price).toLocaleString('fr-FR')} MAD
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-steel-500">
              <span>{lang === 'fr' ? 'Client :' : 'الزبون:'} {booking.client_name}</span>
              <span className="font-black text-red-600 font-mono">
                {lang === 'fr' ? 'Reste :' : 'المتبقي:'} {balanceDue.toLocaleString('fr-FR')} MAD
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Montant payé (MAD) *' : 'المبلغ المدفوع (بالدرهم) *'}
            </label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              dir="ltr"
              className="font-mono text-sm font-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Mode de paiement' : 'طريقة الأداء'}
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethodType)}
              className="w-full px-3 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            >
              <option value="cash">{lang === 'fr' ? 'Espèces (كاش)' : 'نقداً (كاش)'}</option>
              <option value="rib">{lang === 'fr' ? 'Virement bancaire (تحويل بنكي)' : 'تحويل بنكي (Virement)'}</option>
              <option value="cheque">{lang === 'fr' ? 'Chèque (شيك)' : 'شيك بنكي (Chèque)'}</option>
              <option value="wafacash">{lang === 'fr' ? 'Wafacash / Cash Plus' : 'وفاكاش / كاش بلوس'}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Date du versement' : 'تاريخ الدفعة'}
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Note ou N° chèque / bordereau (Optionnel)' : 'ملاحظة أو رقم الشيك / وصل التحويل:'}
            </label>
            <Input
              placeholder={lang === 'fr' ? 'Ex. Chèque Attijariwafa N° 48192' : 'مثال: شيك التجاري وفا بنك رقم 48192'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-steel-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="font-black text-xs px-5 shadow-sm"
            >
              {lang === 'fr' ? 'Valider le paiement' : 'تأكيد وحفظ الدفعة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
