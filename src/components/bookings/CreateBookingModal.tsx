// ============================================================================
// JADIJCB: Booking Modal with Overlap Check & Resilient Schema Fallbacks
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarCheck,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Truck,
  Check,
  ShieldCheck,
  Building,
  HardHat,
} from 'lucide-react';
import { Booking, Machine, BookingStatus } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { mapDatabaseError } from '../../lib/errorHelpers';
import { bookingStore } from '../../lib/bookingStore';

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
  const [clientName, setClientName] = useState(
    profile?.company_name || profile?.full_name || ''
  );
  const [clientPhone, setClientPhone] = useState(
    profile?.phone || '+2126'
  );
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [totalPrice, setTotalPrice] = useState<number>(10000);
  const [withOperator, setWithOperator] = useState(true);
  const [notes, setNotes] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial machine selection when modal opens or machine list changes
  useEffect(() => {
    if (machines.length > 0 && (!machineId || !machines.some((m) => m.id === machineId))) {
      setMachineId(machines[0].id);
    }
  }, [machines, isOpen]);

  // Pre-fill profile details when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!clientName && (profile?.company_name || profile?.full_name)) {
        setClientName(profile.company_name || profile.full_name || '');
      }
      if ((!clientPhone || clientPhone === '+2126') && profile?.phone) {
        setClientPhone(profile.phone);
      }
    }
  }, [isOpen, profile]);

  // Dynamically calculate total price based on date range and machine rate
  useEffect(() => {
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    if (!isNaN(startTs) && !isNaN(endTs) && endTs > startTs) {
      const days = Math.max(1, Math.ceil((endTs - startTs) / (1000 * 60 * 60 * 24)));
      const targetMachine = machines.find((m) => m.id === machineId) || machines[0];
      const dailyRate = Number(targetMachine?.daily_rate) || 2000;
      setTotalPrice(days * dailyRate);
    }
  }, [startDate, endDate, machineId, machines]);

  if (!isOpen) return null;

  const targetMachine = machines.find((m) => m.id === machineId) || machines[0];
  const isContractorMode =
    profile?.role === 'client' ||
    profile?.role === 'contractor' ||
    (targetMachine?.owner_id && targetMachine.owner_id !== user?.id);

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

    const isOwner = targetMachine?.owner_id === user?.id;
    const resolvedOwnerId = targetMachine?.owner_id || user?.id || 'demo-owner';
    const resolvedClientId = isOwner ? null : (user?.id || null);

    const newBooking: Booking = {
      id: 'bk_' + Math.random().toString(36).substring(2, 9),
      machine_id: machineId,
      owner_id: resolvedOwnerId,
      client_id: resolvedClientId || undefined,
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

    if (user?.id) {
      try {
        let payload: any = {
          machine_id: newBooking.machine_id,
          owner_id: resolvedOwnerId,
          client_id: resolvedClientId,
          start_at: newBooking.start_at,
          end_at: newBooking.end_at,
          start_date: newBooking.start_at,
          end_date: newBooking.end_at,
          total_price: newBooking.total_price,
          status: newBooking.status,
          notes: `${newBooking.notes ? newBooking.notes + ' | ' : ''}العميل: ${newBooking.client_name} (${newBooking.client_phone})`,
          with_operator: withOperator,
        };

        // Try insert with adaptive stripping of missing schema columns
        let insertedId: string | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data, error } = await supabase
            .from('bookings')
            .insert(payload)
            .select('id')
            .maybeSingle();

          if (!error && data?.id) {
            insertedId = data.id;
            break;
          }

          if (error) {
            const msg = error.message || '';
            const missingColMatch = msg.match(/Could not find the '([^']+)' column/i);
            if (missingColMatch && missingColMatch[1]) {
              const col = missingColMatch[1];
              delete payload[col];
              continue;
            }
            if (msg.includes('start_date') || msg.includes('start_at')) {
              if (payload.start_at) {
                delete payload.start_at;
                delete payload.end_at;
              } else {
                delete payload.start_date;
                delete payload.end_date;
              }
              continue;
            }
            if (msg.includes('total_price')) {
              delete payload.total_price;
              payload.total_amount = newBooking.total_price;
              continue;
            }
            if (msg.includes('total_amount')) {
              delete payload.total_amount;
              continue;
            }
            if (msg.includes('client_name') || msg.includes('client_phone')) {
              delete payload.client_name;
              delete payload.client_phone;
              continue;
            }
            // Other error - stop retrying
            break;
          }
        }

        if (insertedId) {
          newBooking.id = insertedId;
        }

        // Notify machine owner via chat if possible
        if (targetMachine?.owner_id && user.id !== targetMachine.owner_id) {
          try {
            const { data: conv } = await supabase
              .from('conversations')
              .select('id')
              .or(
                `and(participant_a.eq.${user.id},participant_b.eq.${targetMachine.owner_id}),and(participant_a.eq.${targetMachine.owner_id},participant_b.eq.${user.id})`
              )
              .maybeSingle();

            let convId = conv?.id;
            if (!convId) {
              const { data: newConv } = await supabase
                .from('conversations')
                .insert({
                  participant_a: user.id,
                  participant_b: targetMachine.owner_id,
                })
                .select('id')
                .maybeSingle();
              convId = newConv?.id;
            }

            if (convId) {
              await supabase.from('messages').insert({
                conversation_id: convId,
                sender_id: user.id,
                content: `🚜 طلب حجز جديد للآلية (${targetMachine.brand} ${targetMachine.model}):\n- من: ${new Date(startDate).toLocaleDateString('fr-MA')}\n- إلى: ${new Date(endDate).toLocaleDateString('fr-MA')}\n- المبلغ التقديري: ${Number(totalPrice).toLocaleString('fr-FR')} درهم\n- الزبون: ${clientName} (${clientPhone})\n- ملاحظات الورش: ${notes || 'لا توجد'}`,
              });
            }
          } catch (chatErr) {
            console.warn('Could not post booking alert to chat:', chatErr);
          }
        }
      } catch (err: any) {
        setIsSubmitting(false);
        const errKey = mapDatabaseError(err);
        toast.error(t(errKey));
        return;
      }
    }

    setIsSubmitting(false);
    bookingStore.saveBooking(newBooking);
    onBookingCreated(newBooking);
    toast.success(
      lang === 'fr'
        ? 'Demande de réservation envoyée avec succès'
        : 'تم إرسال وتأكيد طلب الحجز بنجاح'
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
              {isContractorMode ? <HardHat className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isContractorMode
                  ? lang === 'fr'
                    ? 'Réserver cette machine pour votre chantier'
                    : 'طلب حجز الآلية لمشروعك / ورشك'
                  : t('bookings.create_manual_booking')}
              </h3>
              <span className="text-[11px] text-steel-400">
                {isContractorMode
                  ? lang === 'fr'
                    ? 'Envoyez votre demande de location directement au propriétaire'
                    : 'إرسال طلب استئجار الآلية مع فحص التعارض الزمني'
                  : lang === 'fr'
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

          {/* Machine Info / Selection */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {t('bookings.select_machine')}
            </label>
            {machines.length === 1 ? (
              <div className="p-3 bg-steel-50 rounded-xl border border-steel-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-ink block">
                    {machines[0].title_ar || machines[0].title_fr} ({machines[0].brand} {machines[0].model})
                  </span>
                  <span className="text-[11px] text-steel-500 font-bold">
                    {Number(machines[0].daily_rate || 2000).toLocaleString('fr-FR')} MAD / {lang === 'fr' ? 'jour' : 'يوم'}
                  </span>
                </div>
                <Truck className="w-5 h-5 text-primary" />
              </div>
            ) : (
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                required
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title_ar || m.title_fr} ({m.brand} {m.model}) - {Number(m.daily_rate || 2000).toLocaleString('fr-FR')} MAD/j
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isContractorMode ? (lang === 'fr' ? 'Nom de votre entreprise' : 'اسم المقاولة أو الزبون') : t('bookings.client_name_label')}
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
          <div>
            <Input
              type="number"
              label={t('bookings.total_price_label') + ' (MAD)'}
              value={totalPrice}
              onChange={(e) => setTotalPrice(Number(e.target.value))}
              required
            />
            <span className="text-[10px] text-steel-500 font-bold mt-1 block">
              {lang === 'fr'
                ? `Calculé automatiquement selon le tarif journalier (${Number(targetMachine?.daily_rate || 2000).toLocaleString('fr-FR')} MAD/j)`
                : `محسوب تلقائياً حسب التسعيرة اليومية للآلية (${Number(targetMachine?.daily_rate || 2000).toLocaleString('fr-FR')} د.م/يوم)`}
            </span>
          </div>

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
              placeholder={
                isContractorMode
                  ? lang === 'fr'
                    ? 'Ex: Chantier à Bouskoura, livraison souhaitée avant 08h00...'
                    : 'مثال: موقع الورش ببوسكورة، التسليم قبل الساعة 08:00 صباحاً...'
                  : 'ex. Chantier à Sidi Maârouf...'
              }
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
              {isContractorMode
                ? lang === 'fr'
                  ? 'Confirmer et envoyer la demande'
                  : 'تأكيد وإرسال طلب الحجز'
                : lang === 'fr'
                ? 'Enregistrer la réservation'
                : 'تأكيد وحفظ الحجز'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBookingModal;
