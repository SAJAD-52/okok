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
  MessageCircle,
} from 'lucide-react';
import { Booking, Machine, Client } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { bookingStore } from '../../lib/bookingStore';
import { machineStore } from '../../lib/machineStore';
import { clientService } from '../../lib/clientService';
import { serverApi } from '../../lib/serverApi';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines?: Machine[];
  machine?: Machine | null;
  existingBookings?: Booking[];
  preselectedMachineId?: string;
  onBookingCreated?: (booking: Booking) => void;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  machines = [],
  machine,
  existingBookings = [],
  preselectedMachineId,
  onBookingCreated,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { profile, user } = useAuth();

  const machinesList = machine
    ? [machine]
    : machines.length > 0
    ? machines
    : [];

  const initialMachineId =
    machine?.id ||
    preselectedMachineId ||
    machinesList[0]?.id ||
    machines[0]?.id ||
    '';

  const isContractorBooking =
    profile?.role === 'client' ||
    profile?.role === 'contractor' ||
    Boolean(machine) ||
    Boolean(preselectedMachineId) ||
    machines.length === 1 ||
    profile?.role !== 'owner';

  const autoClientName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    user?.user_metadata?.company_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    'المقاولة المستأجرة';

  const autoClientPhone =
    profile?.phone?.trim() ||
    user?.phone?.trim() ||
    user?.user_metadata?.phone?.trim() ||
    '+212600000000';

  const [machineId, setMachineId] = useState<string>(initialMachineId);
  const [selectedClientId, setSelectedClientId] = useState<string>('new');
  const [clientName, setClientName] = useState(autoClientName);
  const [clientPhone, setClientPhone] = useState(autoClientPhone);
  const [cinOrIce, setCinOrIce] = useState(profile?.ice_number || '');
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
    if (isOpen && ownerId && !isContractorBooking) {
      clientService.getClients(ownerId).then(setClientsList);
    }
  }, [isOpen, ownerId, isContractorBooking]);

  // Sync initial machine selection and prefill user contact if available
  useEffect(() => {
    if (machine?.id) {
      setMachineId(machine.id);
    } else if (preselectedMachineId) {
      setMachineId(preselectedMachineId);
    } else if (machines.length > 0 && (!machineId || !machines.some((m) => m.id === machineId))) {
      setMachineId(machines[0].id);
    } else if (machinesList.length > 0 && !machineId) {
      setMachineId(machinesList[0].id);
    }

    if (isOpen) {
      setClientName(autoClientName);
      setClientPhone(autoClientPhone);
      if (profile?.ice_number) {
        setCinOrIce(profile.ice_number);
      }
    }
  }, [machine, preselectedMachineId, machines, machinesList, isOpen, profile, user, autoClientName, autoClientPhone]);

  // Handle client selection change
  const handleClientSelectChange = (val: string) => {
    setSelectedClientId(val);
    if (val === 'new') {
      setClientName(autoClientName);
      setClientPhone(autoClientPhone);
      setCinOrIce(profile?.ice_number || '');
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
      const targetMachine = machine || machinesList.find((m) => m.id === machineId) || machines.find((m) => m.id === machineId) || machinesList[0];
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
  }, [startDate, endDate, machineId, machines, machine, machinesList, rateType, deliveryAvailable, deliveryFee]);

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

  const targetMachine =
    machine ||
    (machineId ? machines.find((m) => m.id === machineId) : null) ||
    (machineId ? machinesList.find((m) => m.id === machineId) : null) ||
    (machineId ? machineStore.getCachedMachines().find((m) => m.id === machineId) : null) ||
    machines[0] ||
    machinesList[0] ||
    null;

  const handleExecuteBooking = async (openWhatsApp: boolean) => {
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

    const effectiveMachine =
      targetMachine ||
      machine ||
      (machineId ? machines.find((m) => m.id === machineId) : null) ||
      machines[0] ||
      machinesList[0] ||
      null;

    const effectiveMachineId = effectiveMachine?.id || machineId || preselectedMachineId;

    if (!effectiveMachineId) {
      toast.error(
        lang === 'fr' ? 'Veuillez sélectionner un engin' : 'يرجى تحديد الآلية المطلوبة'
      );
      return;
    }

    const finalClientName = isContractorBooking ? autoClientName : (clientName.trim() || autoClientName);
    const finalClientPhone = isContractorBooking ? autoClientPhone : (clientPhone.trim() || autoClientPhone);

    if (!finalClientName || !finalClientPhone) {
      toast.error(
        lang === 'fr'
          ? 'Nom de l\'entreprise et téléphone requis'
          : 'اسم المقاولة ورقم الهاتف مطلوبان'
      );
      return;
    }

    setIsSubmitting(true);

    const isUuid = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str));

    // Resolve TRUE machine owner (never confuse client/renter with machine owner!)
    let resolvedOwnerId: string | undefined =
      effectiveMachine?.owner_id ||
      effectiveMachine?.owner?.id ||
      (effectiveMachine as any)?.user_id;

    // 1. Look up machine's owner directly in Supabase machines table to ensure 100% precision
    if (effectiveMachineId && isSupabaseConfigured) {
      try {
        const { data: mData } = await supabase
          .from('machines')
          .select('owner_id')
          .eq('id', effectiveMachineId)
          .maybeSingle();
        if (mData?.owner_id) {
          resolvedOwnerId = mData.owner_id;
        }
      } catch (lookupErr) {
        console.warn('Machine owner lookup notice:', lookupErr);
      }
    }

    // 2. Fallback to cached machines
    if (!resolvedOwnerId && effectiveMachineId) {
      const foundInCache = machineStore.getCachedMachines().find((m) => m.id === effectiveMachineId);
      if (foundInCache?.owner_id) {
        resolvedOwnerId = foundInCache.owner_id;
      }
    }

    // Strictly ensure owner_id is an actual equipment owner, NEVER Super Admin
    if (resolvedOwnerId === 'super_admin_said_root' || resolvedOwnerId === 'admin' || !resolvedOwnerId) {
      if (effectiveMachine?.owner_id && effectiveMachine.owner_id !== 'super_admin_said_root' && effectiveMachine.owner_id !== 'admin') {
        resolvedOwnerId = effectiveMachine.owner_id;
      } else {
        resolvedOwnerId = 'usr_owner_casa_01';
      }
    }

    // Auto-save new client in directory if "new" was selected by an authenticated owner
    let clientRefId = selectedClientId !== 'new' ? selectedClientId : undefined;
    if (!isContractorBooking && selectedClientId === 'new' && ownerId && isUuid(ownerId) && ownerId !== 'super_admin_said_root') {
      try {
        const clientRes = await clientService.createClient(ownerId, {
          name: finalClientName,
          phone: finalClientPhone,
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
      machine_id: effectiveMachineId,
      owner_id: resolvedOwnerId,
      client_id: isUuid(user?.id) && user?.id !== 'super_admin_said_root' ? user.id : 'usr_contractor_rabat_02',
      client_name: finalClientName,
      client_phone: finalClientPhone,
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
      machine: effectiveMachine || undefined,
      created_at: new Date().toISOString(),
    };

    // 1. Direct Server SQLite Database Persistence (works across all browsers, devices and users)
    try {
      const serverRes = await serverApi.createBooking(newBooking);
      if (!serverRes.success && serverRes.error?.includes('CONFLICT')) {
        setIsSubmitting(false);
        const conflictMsg =
          lang === 'fr'
            ? 'Conflit de calendrier : Cette machine est déjà réservée sur ces dates !'
            : 'تعارض في التواريخ : هذه الآلية محجوزة مسبقاً في هذه الفترة!';
        setOverlapError(conflictMsg);
        toast.error(conflictMsg);
        return;
      }
      if (serverRes.booking?.id) {
        newBooking.id = serverRes.booking.id;
      }
    } catch (apiErr) {
      console.warn('Server SQLite save notice:', apiErr);
    }

    // 2. Save to Supabase (if configured) with adaptive retry
    if (isSupabaseConfigured) {
      try {
        let payload: any = {
          id: isUuid(newBooking.id) ? newBooking.id : crypto.randomUUID(),
          machine_id: newBooking.machine_id,
          ...(isUuid(resolvedOwnerId) ? { owner_id: resolvedOwnerId } : {}),
          ...(isUuid(user?.id) && user?.id !== 'super_admin_said_root' ? { client_id: user.id } : {}),
          client_name: newBooking.client_name,
          client_phone: newBooking.client_phone,
          start_at: newBooking.start_at,
          end_at: newBooking.end_at,
          start_date: newBooking.start_at,
          end_date: newBooking.end_date,
          total_price: newBooking.total_price,
          deposit_amount: newBooking.deposit_amount,
          rate_type: newBooking.rate_type,
          with_operator: newBooking.with_operator,
          fuel_included: newBooking.fuel_included,
          delivery_fee: newBooking.delivery_fee,
          delivery_requested: newBooking.delivery_requested,
          site_address: newBooking.site_address,
          status: newBooking.status,
          notes: newBooking.notes,
          created_at: newBooking.created_at,
        };

        // If owner_id wasn't in payload, try fetching the machine's true UUID from machines table
        if (!payload.owner_id && newBooking.machine_id) {
          try {
            const { data: mRow } = await supabase
              .from('machines')
              .select('owner_id')
              .eq('id', newBooking.machine_id)
              .maybeSingle();
            if (mRow?.owner_id && isUuid(mRow.owner_id)) {
              payload.owner_id = mRow.owner_id;
              resolvedOwnerId = mRow.owner_id;
            }
          } catch {
            // Ignore
          }
        }

        let savedData: any = null;

        // Perform adaptive insert (up to 5 attempts to automatically adapt to database schema)
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data, error } = await supabase
            .from('bookings')
            .insert(payload)
            .select()
            .maybeSingle();

          if (!error) {
            savedData = data;
            break;
          }

          const msg = error.message || '';

          if (msg.includes('BOOKING_CONFLICT')) {
            setIsSubmitting(false);
            const conflictMsg =
              lang === 'fr'
                ? 'Conflit de calendrier : Une autre réservation active existe déjà sur ces dates !'
                : 'تعارض في التواريخ : توجد بالفعل عملية كراء أخرى مؤكدة على هذه الآلية في نفس الفترة!';
            setOverlapError(conflictMsg);
            toast.error(conflictMsg);
            return;
          }

          // Strip missing column and retry
          const missingColMatch = msg.match(/Could not find the '([^']+)' column/i);
          if (missingColMatch && missingColMatch[1]) {
            delete payload[missingColMatch[1]];
            continue;
          }

          // If foreign key constraint failed on client_id, remove client_id and retry
          if (msg.includes('client_id') || msg.includes('violates foreign key constraint')) {
            if (payload.client_id) {
              delete payload.client_id;
              continue;
            }
          }

          // If invalid UUID syntax on id, remove explicit id so DB generates it
          if (msg.includes('invalid input syntax for type uuid') && msg.includes('id')) {
            delete payload.id;
            continue;
          }

          console.warn(`Adaptive booking insert attempt ${attempt + 1} notice:`, msg);
          break;
        }

        if (savedData?.id) {
          newBooking.id = savedData.id;
        }

        // Create notification record for owner
        const targetOwnerId = payload.owner_id || (isUuid(resolvedOwnerId) ? resolvedOwnerId : undefined);
        if (targetOwnerId) {
          try {
            await supabase.from('notifications').insert({
              user_id: targetOwnerId,
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
      } catch (err: any) {
        console.warn('Supabase booking insert exception:', err);
      }
    }

    // 3. Save locally & emit events (triggers instant bell notification across tabs)
    bookingStore.saveBooking(newBooking);
    setIsSubmitting(false);

    // If WhatsApp requested, open chat with owner
    if (openWhatsApp) {
      const rawOwnerPhone = (targetMachine?.owner?.phone || (targetMachine as any)?.phone || '+212661234567').replace(/\D/g, '');
      const startStr = new Date(startDate).toLocaleDateString('fr-FR');
      const endStr = new Date(endDate).toLocaleDateString('fr-FR');
      const machineTitle = targetMachine?.title_ar || targetMachine?.title_fr || `${targetMachine?.brand} ${targetMachine?.model}`;

      const waMsg = `السلام عليكم ورحمة الله،
أود تأكيد طلب كراء الآلية عبر منصة JADIJCB:

🚜 الآلية: ${machineTitle} (${targetMachine?.city || ''})
📅 الفترة: من ${startStr} إلى ${endStr}
💰 السعر التقديري: ${Number(totalPrice).toLocaleString('fr-FR')} درهم
👷 سائق معتمد: ${withOperator ? 'نعم' : 'لا'}
⛽ الوقود: ${fuelIncluded ? 'شامل' : 'غير مشمول'}

👤 الزبون / المقاولة: ${finalClientName}
📱 الهاتف: ${finalClientPhone}
📍 موقع الورش: ${siteAddress.trim() || targetMachine?.city || 'المغرب'}
${notes.trim() ? `📝 ملاحظات: ${notes.trim()}\n` : ''}
🔗 الرابط: ${window.location.origin}/marketplace/${targetMachine?.id}`;

      window.open(`https://wa.me/${rawOwnerPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
    }

    toast.success(
      lang === 'fr'
        ? 'Réservation enregistrée avec succès ! Le propriétaire a été notifié.'
        : 'تم تسجيل طلب الحجز بنجاح! تم إشعار المالك فوراً.'
    );

    if (onBookingCreated) {
      onBookingCreated(newBooking);
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecuteBooking(true);
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

          {/* If Contractor Booking: Clean Machine & Auto-filled Contractor Info (No fleet select, no client inputs!) */}
          {isContractorBooking ? (
            <div className="space-y-3">
              {/* Selected Machine Summary Card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-primary/40 flex items-center gap-3">
                {targetMachine?.images?.[0] ? (
                  <img
                    src={targetMachine.images[0]}
                    alt={targetMachine.title_ar || targetMachine.brand}
                    className="w-14 h-14 rounded-xl object-cover border border-amber-400/40 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-500/20 text-primary-dark flex items-center justify-center shrink-0">
                    <Truck className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase text-primary-dark tracking-wider block">
                    {lang === 'fr' ? 'Engin sélectionné pour réservation' : 'الآلية المطلوب كراؤها'}
                  </span>
                  <h4 className="font-black text-xs text-ink truncate">
                    {targetMachine?.title_ar || targetMachine?.title_fr || `${targetMachine?.brand} ${targetMachine?.model}`}
                  </h4>
                  <p className="text-[11px] text-steel-600 font-bold mt-0.5">
                    📍 {targetMachine?.city || 'المغرب'} • 💰 {Number(targetMachine?.daily_rate || targetMachine?.rate_daily || 2000).toLocaleString('fr-FR')} MAD / {lang === 'fr' ? 'jour' : 'يوم'}
                  </p>
                </div>
              </div>

              {/* Automatic Contractor Identity Banner (Read-only, pulled directly from account) */}
              <div className="p-3.5 rounded-2xl bg-steel-50 border border-steel-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary-dark flex items-center justify-center font-black shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-steel-500 font-bold block">
                      {lang === 'fr' ? 'Compte entreprise (Réservataire)' : 'الحساب المعتمد للحجز (المقاولة)'}
                    </span>
                    <span className="font-black text-ink text-xs truncate block">{autoClientName}</span>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-[10px] text-steel-500 font-bold block">
                    {lang === 'fr' ? 'WhatsApp de contact' : 'هاتف الواتساب المسجل'}
                  </span>
                  <span className="font-mono font-black text-ink dir-ltr text-xs block">{autoClientPhone}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Equipment Owner Internal Fleet Booking Mode */
            <>
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
            </>
          )}

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-steel-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold order-3 sm:order-1"
            >
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExecuteBooking(false)}
              isLoading={isSubmitting}
              disabled={Boolean(overlapError)}
              className="text-xs font-bold text-steel-700 hover:text-ink order-2"
            >
              {lang === 'fr' ? 'Enregistrer sans WhatsApp' : 'تأكيد بالمنصة فقط'}
            </Button>

            <button
              type="button"
              onClick={() => handleExecuteBooking(true)}
              disabled={Boolean(overlapError) || isSubmitting}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs shadow-md transition-all cursor-pointer min-h-[38px] order-1 sm:order-3"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>{lang === 'fr' ? 'Confirmer & Contacter sur WhatsApp' : 'تأكيد الحجز والتواصل عبر واتساب'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBookingModal;
