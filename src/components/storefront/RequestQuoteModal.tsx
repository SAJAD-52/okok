// ============================================================================
// JADIJCB: Public Request a Quote Modal (طلب عرض أسعار فوري)
// Writes directly to public.leads table & triggers owner lead notification
// ============================================================================

import React, { useState } from 'react';
import { X, Send, User, Phone, MapPin, Calendar, Clock, Sparkles, Building2 } from 'lucide-react';
import { Machine } from '../../types/database';
import { leadService } from '../../lib/leadService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { MOROCCAN_CITIES } from '../../data/cities';

interface RequestQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  machines?: Machine[];
  machine?: Machine;
  initialMachineId?: string;
  companyName?: string;
  ownerName?: string;
}

export const RequestQuoteModal: React.FC<RequestQuoteModalProps> = ({
  isOpen,
  onClose,
  ownerId,
  machines = [],
  machine,
  initialMachineId,
  companyName,
  ownerName,
}) => {
  const { lang } = useLanguage();
  const availableMachines = machine ? [machine, ...machines.filter((m) => m.id !== machine.id)] : machines;

  const [machineId, setMachineId] = useState<string>(
    initialMachineId || machine?.id || availableMachines[0]?.id || ''
  );
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [city, setCity] = useState('Casablanca');
  const [duration, setDuration] = useState('أسبوع (Semaine)');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error(lang === 'fr' ? 'Nom et téléphone requis' : 'يرجى إدخال اسمك ورقم هاتفك');
      return;
    }

    setIsSubmitting(true);

    const res = await leadService.submitLead({
      owner_id: ownerId,
      machine_id: machineId || undefined,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      city,
      rental_duration: duration,
      start_date: startDate,
      notes: notes.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        lang === 'fr'
          ? 'Votre demande de devis a été transmise ! Le loueur vous recontactera rapidement.'
          : 'تم إرسال طلب عرض الأسعار بنجاح! سيتواصل معكم صاحب الآلية في أقرب وقت.'
      );
      onClose();
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs text-start overflow-y-auto"
    >
      <div className="bg-white border border-steel-200 rounded-3xl max-w-md w-full shadow-2xl my-6 overflow-hidden animate-scale-in">
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm">
                {lang === 'fr' ? 'Demander un devis rapide' : 'طلب عرض أسعار كراء فوري'}
              </h3>
              <p className="text-[11px] text-steel-400">
                {companyName}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {machines.length > 0 && (
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Engin souhaité' : 'الآلية المطلوبة للكراء'}
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title_ar} - {m.brand} {m.model}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label={lang === 'fr' ? 'Votre nom ou nom de l\'entreprise *' : 'اسمك الكامل أو مقاولة الأشغال *'}
            placeholder="Ex. Entreprise Al Boughaz"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />

          <Input
            label={lang === 'fr' ? 'Numéro de téléphone / WhatsApp *' : 'رقم الهاتف والواتساب للتواصل *'}
            placeholder="+212 6 XX XX XX XX"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            required
            dir="ltr"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Ville du chantier' : 'مدينة ورش العمل'}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c.id} value={c.name_ar}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Date souhaitée' : 'تاريخ بدء الأشغال'}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Durée estimée' : 'مدة الكراء التقريبية'}
            </label>
            <Input
              placeholder="Ex. 15 jours / شهر واحد"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Précisions sur les travaux' : 'تفاصيل وطبيعة الأشغال (اختياري):'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أعمال حفر وردم، تسوية، هدم..."
              className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
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
              leftIcon={<Send className="w-4 h-4" />}
              className="font-black text-xs px-6 shadow-sm"
            >
              {lang === 'fr' ? 'Envoyer la demande' : 'إرسال طلب السعر'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestQuoteModal;
