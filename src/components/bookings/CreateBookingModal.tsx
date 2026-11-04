// ============================================================================
// JADIJCB: Manual Booking Creator with Overlap Conflict Prevention
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  CalendarCheck,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Truck,
  Check,
} from 'lucide-react';
import { Booking, Machine, BookingStatus } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  existingBookings: Booking[];
  onBookingCreated: (booking: Booking) => void;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  machines,
  existingBookings,
  onBookingCreated,
}) => {
  const { t, lang } = useLanguage();
  const { profile, user } = useAuth();

  const [machineId, setMachineId] = useState<string>(machines[0]?.id || '');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('+2126');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [totalPrice, setTotalPrice] = useState<number>(11000);
  const [withOperator, setWithOperator] = useState(true);
  const [notes, setNotes] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverlapError(null);

    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();

    if (endTs <= startTs) {
      toast.error(
        lang === 'fr'
          ? 'La date de fin doit être postérieure à la date de début'
          : 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية'
      );
      return;
    }

    // Client-side & DB Exclusion Check: prevent overlapping active bookings for the same machine
    const hasOverlap = existingBookings.some((b) => {
      if (b.machine_id !== machineId) return false;
      if (b.status === 'cancelled') return false;

      const existingStart = new Date(b.start_at || b.start_date || '').getTime();
      const existingEnd = new Date(b.end_at || b.end_date || '').getTime();

      return startTs < existingEnd && endTs > existingStart;
    });

    if (hasOverlap) {
      const msg = t('bookings.overlap_alert_msg');
      setOverlapError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);

    const targetMachine = machines.find((m) => m.id === machineId);

    const newBooking: Booking = {
      id: 'bk_' + Math.random().toString(36).substring(2, 9),
      machine_id: machineId,
      owner_id: user?.id || profile?.id || 'demo-owner',
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      start_at: new Date(startDate).toISOString(),
      end_at: new Date(endDate).toISOString(),
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      total_price: Number(totalPrice),
      with_operator: withOperator,
      status: 'pending',
      notes: notes.trim(),
      machine: targetMachine,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && user?.id) {
      try {
        const { error } = await supabase.from('bookings').insert({
          machine_id: newBooking.machine_id,
          owner_id: user.id,
          client_name: newBooking.client_name,
          client_phone: newBooking.client_phone,
          start_at: newBooking.start_at,
          end_at: newBooking.end_at,
          total_price: newBooking.total_price,
          status: newBooking.status,
          notes: newBooking.notes,
        });

        if (error) {
          // PostgreSQL btree_gist exclusion constraint violation code: 23P01
          if (error.code === '23P01' || error.message?.includes('exclude')) {
            setOverlapError(t('bookings.overlap_alert_msg'));
            setIsSubmitting(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Booking insertion warning:', err);
      }
    }

    setIsSubmitting(false);
    onBookingCreated(newBooking);
    toast.success(
      lang === 'fr'
        ? 'Réservation enregistrée avec succès'
        : 'تم تسجيل الحجز بنجاح'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-lg w-full shadow-2xl my-auto overflow-hidden text-start">
        {/* Header */}
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {t('bookings.create_manual_booking')}
              </h3>
              <span className="text-[11px] text-steel-400">
                {lang === 'fr'
                  ? 'Planifiez une mission avec vérification de disponibilité'
                  : 'جدولة كراء آلية مع التحقق التلقائي من تعارض المواعيد'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Overlap Error Warning Banner */}
          {overlapError && (
            <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/40 text-danger flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-black block">
                  {t('bookings.overlap_alert_title')}
                </span>
                <p className="text-[11px] mt-0.5 leading-snug">
                  {overlapError}
                </p>
              </div>
            </div>
          )}

          {/* Machine Selection */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {t('bookings.select_machine')}
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              required
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title_ar || m.title_fr} ({m.brand} {m.model})
                </option>
              ))}
            </select>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('bookings.client_name_label')}
              placeholder="ex. Société BTP Tanger"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
            <Input
              label={t('bookings.client_phone_label')}
              placeholder="+212 6 XX XX XX XX"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              dir="ltr"
              required
            />
          </div>

          {/* Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1">
                {t('bookings.start_date_label')}
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setOverlapError(null);
                }}
                className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1">
                {t('bookings.end_date_label')}
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setOverlapError(null);
                }}
                className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                required
              />
            </div>
          </div>

          {/* Total Price */}
          <Input
            type="number"
            label={t('bookings.total_price_label')}
            value={totalPrice}
            onChange={(e) => setTotalPrice(Number(e.target.value))}
            required
          />

          {/* Operator Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-steel-200 bg-surface cursor-pointer">
            <span className="text-xs font-bold text-ink">
              {lang === 'fr' ? 'Chauffeur inclus avec l\'engin' : 'توفير سائق معتمد مع الآلية'}
            </span>
            <input
              type="checkbox"
              checked={withOperator}
              onChange={(e) => setWithOperator(e.target.checked)}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </label>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1">
              {t('bookings.notes_label')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. Chantier à Sidi Maârouf, livraison avant 08h00..."
              className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center font-black min-h-[48px]"
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Enregistrer la réservation' : 'تأكيد وحفظ الحجز'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBookingModal;
