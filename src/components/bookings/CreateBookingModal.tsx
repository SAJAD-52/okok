// ============================================================================
// JADIJCB: Booking Modal with Conflict Protection & Clients Integration
// Enforces overlap prevention, client directory selection, rate options & deposit
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
  Banknote,
  Fuel,
  MapPin,
} from 'lucide-react';
import { Booking, Machine, Client } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { bookingStore } from '../../lib/bookingStore';
import { clientService } from '../../lib/clientService';

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
  const { t, lang, isRTL } = useLanguage();
  const { profile, user } = useAuth();

  const [machineId, setMachineId] = useState<string>(machines[0]?.id || '');
  const [selectedClientId, setSelectedClientId] = useState<string>('new');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [cinOrIce, setCinOrIce] = useState('');
  const [clientsList, setClientsList] = useState<Client[]>([]);

  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );

  const [rateType, setRateType] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [totalPrice, setTotalPrice] = useState<number>(10000);
  const [depositAmount, setDepositAmount] = useState<number>(3000);
  const [withOperator, setWithOperator] = useState(true);
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [siteAddress, setSiteAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [conflictingBooking, setConflictingBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerId = user?.id || profile?.id;

  // Load clients list for this owner
  useEffect(() => {
    if (isOpen && ownerId) {
      clientService.getClients(ownerId).then(setClientsList);
    }
  }, [isOpen, ownerId]);

  // Sync initial machine selection
  useEffect(() => {
    if (machines.length > 0 && (!machineId || !machines.some((m) => m.id === machineId))) {
      setMachineId(machines[0].id);
    }
  }, [machines, isOpen]);

  // Handle client selection change
  const handleClientSelectChange = (val: string) => {
    setSelectedClientId(val);
    if (val === 'new') {
      setClientName('');
      setClientPhone('');
      setCinOrIce('');
    } else {
      const found = clientsList.find((c) => c.id === val);
      if (found) {
        setClientName(found.name);
        setClientPhone(found.phone);
        setCinOrIce(found.cin_or_ice || '');
      }
    }
  };

  // Dynamically calculate total price based on dates, machine rates, delivery
  useEffect(() => {
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    if (!isNaN(startTs) && !isNaN(endTs) && endTs > startTs) {
      const targetMachine = machines.find((m) => m.id === machineId) || machines[0];
      const hours = (endTs - startTs) / (1000 * 60 * 60);
      const days = Math.max(1, Math.ceil(hours / 24));

      let base = 0;
      if (rateType === 'hourly') {
        const hourlyRate = Number(targetMachine?.hourly_rate || targetMachine?.rate_hourly) || 350;
        base = Math.max(1, Math.round(hours)) * hourlyRate;
      } else if (rateType === 'weekly') {
        const weeklyRate = Number(targetMachine?.weekly_rate || targetMachine?.rate_weekly) || 12000;
        const weeks = Math.max(1, Math.ceil(days / 7));
        base = weeks * weeklyRate;
      } else {
        const dailyRate = Number(targetMachine?.daily_rate || targetMachine?.rate_daily) || 2000;
        base = days * dailyRate;
      }

      const total = base + (deliveryAvailable ? Number(deliveryFee) || 0 : 0);
      setTotalPrice(total);
    }
  }, [startDate, endDate, machineId, machines, rateType, deliveryAvailable, deliveryFee]);

  // Live conflict checker
  useEffect(() => {
    if (!startDate || !endDate || !machineId) {
      setOverlapError(null);
      setConflictingBooking(null);
      return;
    }

    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    if (isNaN(startTs) || isNaN(endTs) || endTs <= startTs) return;

    const conflict = existingBookings.find((b) => {
      if (b.machine_id !== machineId) return false;
      if (b.status === 'cancelled' || b.status === 'completed') return false;

      const bStart = new Date(b.start_at || b.start_date || '').getTime();
      const bEnd = new Date(b.end_at || b.end_date || '').getTime();

      return startTs < bEnd && endTs > bStart;
    });

    if (conflict) {
      setConflictingBooking(conflict);
      const conflictStartStr = (conflict.start_at || conflict.start_date || '').slice(0, 10);
      const conflictEndStr = (conflict.end_at || conflict.end_date || '').slice(0, 10);
      const conflictClient = conflict.client_name || 'زبون آخر';

      const alertMsg =
        lang === 'fr'
          ? `Conflit détecté : Cette machine est déjà réservée du ${conflictStartStr} au ${conflictEndStr} par "${conflictClient}" (Statut: ${conflict.status}).`
          : `تعارض في الموعد : هذه الآلية محجوزة مسبقاً من ${conflictStartStr} إلى ${conflictEndStr} لصالح "${conflictClient}" (الحالة: ${conflict.status}).`;

      setOverlapError(alertMsg);
    } else {
      setConflictingBooking(null);
      setOverlapError(null);
    }
  }, [startDate, endDate, machineId, existingBookings, lang]);

  if (!isOpen) return null;

  const targetMachine = machines.find((m) => m.id === machineId) || machines[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();

    if (endTs <= startTs) {
      toast.error(
        lang === 'fr'
          ? 'La date de fin doit être postérieure à la date de début'
          : 'تاريخ نهاية الكراء يجب أن يكون بعد تاريخ البداية'
      );
      return;
    }

    if (overlapError) {
      toast.error(overlapError);
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error(lang === 'fr' ? 'Nom et téléphone du client requis' : 'اسم الزبون ورقم الهاتف مطلوبان');
      return;
    }

    setIsSubmitting(true);

    const resolvedOwnerId = targetMachine?.owner_id || ownerId || 'owner';

    // Auto-save new client in directory if "new" was selected
    let clientRefId = selectedClientId !== 'new' ? selectedClientId : undefined;
    if (selectedClientId === 'new' && ownerId) {
      try {
        const clientRes = await clientService.createClient(ownerId, {
          name: clientName.trim(),
          phone: clientPhone.trim(),
          cin_or_ice: cinOrIce.trim(),
        });
        if (clientRes.client?.id) {
          clientRefId = clientRes.client.id;
        }
      } catch (err) {
        console.warn('Auto client save notice:', err);
      }
    }

    const newBooking: Booking = {
      id: crypto.randomUUID(),
      machine_id: machineId,
      owner_id: resolvedOwnerId,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      client_ref_id: clientRefId,
      start_at: new Date(startDate).toISOString(),
      end_at: new Date(endDate).toISOString(),
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      total_price: Number(totalPrice),
      deposit_amount: Number(depositAmount),
      rate_type: rateType,
      with_operator: withOperator,
      fuel_included: fuelIncluded,
      delivery_requested: deliveryAvailable,
      delivery_fee: Number(deliveryFee),
      site_address: siteAddress.trim(),
      status: 'pending',
      notes: notes.trim(),
      paid_amount: 0,
      balance_due: Number(totalPrice),
      payment_status: 'unpaid',
      machine: targetMachine,
      created_at: new Date().toISOString(),
    };

    // Save to Supabase with overlap conflict handling
    if (user?.id) {
      try {
        const payload: any = {
          id: newBooking.id,
          machine_id: newBooking.machine_id,
          owner_id: resolvedOwnerId,
          client_name: newBooking.client_name,
          client_phone: newBooking.client_phone,
          start_at: newBooking.start_at,
          end_at: newBooking.end_at,
          start_date: newBooking.start_at,
          end_date: newBooking.end_at,
          total_price: newBooking.total_price,
          deposit_amount: newBooking.deposit_amount,
          rate_type: newBooking.rate_type,
          with_operator: newBooking.with_operator,
          fuel_included: newBooking.fuel_included,
          delivery_fee: newBooking.delivery_fee,
          status: newBooking.status,
          notes: newBooking.notes,
          created_at: newBooking.created_at,
        };

        const { data, error } = await supabase
          .from('bookings')
          .insert(payload)
          .select()
          .maybeSingle();

        if (error) {
          if (error.message?.includes('BOOKING_CONFLICT')) {
            setIsSubmitting(false);
            const conflictMsg =
              lang === 'fr'
                ? 'Conflit de calendrier : Une autre réservation active existe déjà sur ces dates !'
                : 'تعارض في التواريخ : توجد بالفعل عملية كراء أخرى مؤكدة على هذه الآلية في نفس الفترة!';
            setOverlapError(conflictMsg);
            toast.error(conflictMsg);
            return;
          }
          console.warn('DB booking insert notice:', error.message);
        } else if (data) {
          newBooking.id = data.id;

          // Create notification record for owner
          if (resolvedOwnerId) {
            try {
              await supabase.from('notifications').insert({
                user_id: resolvedOwnerId,
                title_ar: 'طلب كراء جديد وارد 🚜',
                title_fr: 'Nouvelle demande de location reçue 🚜',
                body_ar: `طلب الزبون ${clientName.trim()} كراء (${targetMachine?.title_ar || targetMachine?.model || 'الآلية'}) بقيمة ${Number(totalPrice).toLocaleString('fr-FR')} د.م.`,
                body_fr: `Le client ${clientName.trim()} a réservé ${targetMachine?.title_fr || targetMachine?.model || 'engin'} (${Number(totalPrice).toLocaleString('fr-FR')} MAD).`,
                type: 'booking_request',
                data: {
                  booking_id: newBooking.id,
                  machine_id: newBooking.machine_id,
                  client_name: newBooking.client_name,
                  client_phone: newBooking.client_phone,
                  total_price: newBooking.total_price,
                },
              });
            } catch (notifErr) {
              console.warn('Could not insert notification:', notifErr);
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes('BOOKING_CONFLICT')) {
          setIsSubmitting(false);
          toast.error(
            lang === 'fr'
              ? 'Conflit de réservation sur cette machine'
              : 'تعارض في التواريخ : الآلية محجوزة مسبقاً'
          );
          return;
        }
      }
    }

    // Save locally & emit events (triggers instant bell notification across tabs)
    bookingStore.saveBooking(newBooking);
    setIsSubmitting(false);

    toast.success(
      lang === 'fr'
        ? 'Réservation enregistrée avec succès ! Le propriétaire a été notifié.'
        : 'تم تسجيل وتثبيت حجز الآلية بنجاح! تم إشعار المالك فوراً.'
    );

    onBookingCreated(newBooking);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs text-start overflow-y-auto"
    >
      <div className="bg-white border border-steel-200 rounded-3xl max-w-xl w-full shadow-2xl my-6 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">
                {lang === 'fr' ? 'Nouvelle réservation de matériel' : 'تسجيل حجز وعقد كراء جديد'}
              </h3>
              <p className="text-[11px] text-steel-400">
                {lang === 'fr'
                  ? 'Protection anti-conflit de calendrier et calcul automatique'
                  : 'مع حماية تلقائية ضد تداخل المواعيد وحساب التكلفة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Overlap Conflict Banner Alert */}
          {overlapError && (
            <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 space-y-1 animate-pulse">
              <div className="flex items-center gap-2 font-black">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{lang === 'fr' ? 'Alerte conflit de planning !' : 'تحذير : تعارض في جدول المواعيد!'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">{overlapError}</p>
            </div>
          )}

          {/* Machine Selection */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary-dark" />
              <span>{lang === 'fr' ? 'Sélectionner l\'engin *' : 'اختر الآلية من أسطولك *'}</span>
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title_ar} - {m.brand} {m.model} ({m.daily_rate || m.rate_daily || 2000} MAD/j)
                </option>
              ))}
            </select>
          </div>

          {/* Client Selection (Directory / Inline New) */}
          <div className="p-3.5 rounded-2xl bg-steel-50 border border-steel-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-steel-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Client ou Entreprise *' : 'الزبون أو المقاولة المستأجرة *'}</span>
              </label>

              {clientsList.length > 0 && (
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelectChange(e.target.value)}
                  className="px-2 py-1 text-[11px] rounded-lg border border-steel-300 bg-white font-bold"
                >
                  <option value="new">{lang === 'fr' ? '+ Nouveau client' : '+ زبون جديد'}</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={lang === 'fr' ? 'Nom du client / Raison sociale' : 'اسم الزبون / الشركة'}
                placeholder="Ex. Société BTP Travaux"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />

              <Input
                label={lang === 'fr' ? 'Téléphone WhatsApp' : 'رقم الهاتف والواتساب'}
                placeholder="+2126XXXXXXXX"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>

          {/* Dates & Timeframe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Date & Heure de début *' : 'تاريخ وتوقيت البداية *'}</span>
              </label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Date & Heure de fin *' : 'تاريخ وتوقيت الانتهاء *'}</span>
              </label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>

          {/* Pricing & Deposit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Mode de tarification' : 'طريقة التسعير'}
              </label>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              >
                <option value="daily">{lang === 'fr' ? 'Par jour (يومي)' : 'باليوم'}</option>
                <option value="hourly">{lang === 'fr' ? 'Par heure (بالساعة)' : 'بالساعة'}</option>
                <option value="weekly">{lang === 'fr' ? 'Par semaine (أسبوعي)' : 'بالأسبوع'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Total location (MAD) *' : 'إجمالي مبلغ الكراء (درهم) *'}
              </label>
              <Input
                type="number"
                min="0"
                value={totalPrice}
                onChange={(e) => setTotalPrice(Number(e.target.value))}
                required
                dir="ltr"
                className="font-mono font-black"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Dépôt de garantie (MAD)' : 'مبلغ الضمانة المستردة'}
              </label>
              <Input
                type="number"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                dir="ltr"
                className="font-mono"
              />
            </div>
          </div>

          {/* Operational Options Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="p-3 rounded-xl border border-steel-200 bg-steel-50 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-xs text-ink">
                {lang === 'fr' ? 'Avec chauffeur' : 'مع سائق معتمد'}
              </span>
              <input
                type="checkbox"
                checked={withOperator}
                onChange={(e) => setWithOperator(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </label>

            <label className="p-3 rounded-xl border border-steel-200 bg-steel-50 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-xs text-ink">
                {lang === 'fr' ? 'Carburant inclus' : 'الوقود والديزل مشمول'}
              </span>
              <input
                type="checkbox"
                checked={fuelIncluded}
                onChange={(e) => setFuelIncluded(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </label>

            <label className="p-3 rounded-xl border border-steel-200 bg-steel-50 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-xs text-ink">
                {lang === 'fr' ? 'Transport porte-char' : 'التوصيل / بورت شار'}
              </span>
              <input
                type="checkbox"
                checked={deliveryAvailable}
                onChange={(e) => setDeliveryAvailable(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
            </label>
          </div>

          {deliveryAvailable && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={lang === 'fr' ? 'Frais de transport (MAD)' : 'تكلفة النقل والتوصيل (درهم)'}
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                dir="ltr"
              />
              <Input
                label={lang === 'fr' ? 'Adresse ou zone du chantier' : 'موقع ورش العمل'}
                placeholder="Ex. Tit Mellil, Casablanca"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Notes et conditions particulières' : 'ملاحظات وتفاصيل إضافية:'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'fr' ? 'Ex. Heures de travail 8h/j, repos le dimanche...' : 'مثال: ساعات العمل 8 ساعات يومياً، الراحة يوم الأحد...'}
              className="w-full px-3.5 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Actions */}
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
              disabled={Boolean(overlapError)}
              className="font-black text-xs px-6 shadow-md"
            >
              {lang === 'fr' ? 'Confirmer la réservation' : 'تأكيد وحفظ الحجز'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBookingModal;
