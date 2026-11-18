// ============================================================================
// JADIJCB: Work Termination Modal (إنهاء العمل وإبراء الذمة - وفق مدونة الشغل 65.99)
// Supports mutual confirmation between Owner & Driver to prevent disputes
// (Art. 33, 34, 41, 72, 73 of Moroccan Labor Code), plus documented fallback.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Flag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { AgreedDriverDealItem } from '../../lib/driverOfferService';
import { WorkTerminationReason } from '../../types/database';

interface WorkTerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: AgreedDriverDealItem | null;
  partyRole: 'owner' | 'driver';
  isSubmitting?: boolean;
  onConfirmAction: (payload: {
    reason: WorkTerminationReason;
    note: string;
    forceUnilateral?: boolean;
  }) => Promise<void>;
}

const REASON_OPTIONS: {
  id: WorkTerminationReason;
  labelAr: string;
  labelFr: string;
  onlyRole?: 'owner' | 'driver';
}[] = [
  {
    id: 'completed_project',
    labelAr: 'انتهاء الأشغال والمدة المتفق عليها (المادة 33)',
    labelFr: 'Fin des travaux / durée convenue (Art. 33)',
  },
  {
    id: 'mutual_agreement',
    labelAr: 'إنهاء العمل بالتراضي بين الطرفين وإبراء الذمة',
    labelFr: 'Rupture d’un commun accord & solde de tout compte',
  },
  {
    id: 'driver_resignation',
    labelAr: 'مغادرة طوعية / استقالة السائق (المادة 34)',
    labelFr: 'Départ volontaire / Démission du conducteur (Art. 34)',
    onlyRole: 'driver',
  },
  {
    id: 'owner_early_stop',
    labelAr: 'توقف مبكر للعمل من طرف المالك / المقاولة',
    labelFr: 'Arrêt anticipé par le propriétaire / l’entreprise',
    onlyRole: 'owner',
  },
];

export const WorkTerminationModal: React.FC<WorkTerminationModalProps> = ({
  isOpen,
  onClose,
  deal,
  partyRole,
  isSubmitting = false,
  onConfirmAction,
}) => {
  const { lang } = useLanguage();
  const [reason, setReason] = useState<WorkTerminationReason>('completed_project');
  const [note, setNote] = useState('');
  const [attested, setAttested] = useState(false);

  const term = deal?.termination || deal?.contract?.termination || null;
  const isPending = term?.work_status === 'pending_end';
  const currentUserConfirmed = Boolean(
    term && (partyRole === 'owner' ? term.owner_confirmed : term.driver_confirmed)
  );
  const isRespondingToPeer = Boolean(isPending && !currentUserConfirmed);
  const isWaitingForPeer = Boolean(isPending && currentUserConfirmed);

  useEffect(() => {
    if (!isOpen) return;
    setReason(term?.reason || 'completed_project');
    setNote(term?.note || '');
    setAttested(false);
  }, [isOpen, term?.reason, term?.note]);

  if (!isOpen || !deal) return null;

  const visibleReasons = REASON_OPTIONS.filter(
    (opt) => !opt.onlyRole || opt.onlyRole === partyRole || opt.id === term?.reason
  );

  const handleSubmit = async (forceUnilateral: boolean = false) => {
    if (!attested) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez cocher la case d’attestation avant de valider'
          : 'يرجى التأشير على خانة الإقرار القانوني قبل المتابعة'
      );
      return;
    }
    await onConfirmAction({
      reason,
      note: note.trim(),
      forceUnilateral,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      dir={lang === 'fr' ? 'ltr' : 'rtl'}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-steel-200 overflow-hidden text-start">
        {/* Header */}
        <div className="bg-ink text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black truncate">
                {isRespondingToPeer
                  ? lang === 'fr'
                    ? 'Confirmer la fin de mission'
                    : 'تأكيد إنهاء العمل وإبراء الذمة'
                  : isWaitingForPeer
                  ? lang === 'fr'
                    ? 'Demande de fin de mission en attente'
                    : 'طلب إنهاء العمل في انتظار التأكيد'
                  : lang === 'fr'
                  ? 'Clôturer la mission / Fin de travail'
                  : 'إنهاء العمل وتثبيت نهاية المهمة'}
              </h2>
              <p className="text-[11px] text-steel-300 truncate">
                {deal.machine_title} ·{' '}
                {partyRole === 'owner' ? deal.driver_name : deal.owner_company || deal.owner_name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-steel-800 hover:bg-steel-700 text-steel-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Deal Context Summary */}
          <div className="p-3 rounded-2xl bg-surface border border-steel-200 flex items-center gap-3">
            {deal.machine_image ? (
              <img
                src={deal.machine_image}
                alt={deal.machine_title}
                className="w-12 h-12 rounded-xl object-cover border border-steel-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-primary-dark" />
              </div>
            )}
            <div className="min-w-0 text-xs">
              <p className="font-black text-ink truncate">{deal.machine_title}</p>
              <p className="text-steel-600 font-bold truncate">
                {deal.offered_salary.toLocaleString('fr-FR')} {lang === 'fr' ? 'MAD' : 'د.م'}/
                {deal.salary_unit === 'month'
                  ? lang === 'fr'
                    ? 'mois'
                    : 'شهر'
                  : lang === 'fr'
                  ? 'jour'
                  : 'يوم'}{' '}
                · {deal.duration_label}
              </p>
            </div>
          </div>

          {/* Moroccan Labor Law Protection Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">
              {lang === 'fr'
                ? 'Conformément au Code du Travail marocain (Loi 65-99, Art. 72 & 73), la validation mutuelle protège le conducteur contre l’abandon de poste et protège le propriétaire en constatant le solde de tout compte et la restitution de l’engin.'
                : 'حمايةً للطرفين وفق مدونة الشغل المغربية (القانون 65.99، المواد 33 و 72 و 73): التأكيد المشترك يحمي المالك بتوثيق تصفية الحساب وتسليم الآلية، ويحمي السائق من الادعاء بالمغادرة التلقائية أو الفصل التعسفي.'}
            </p>
          </div>

          {isWaitingForPeer ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-surface border border-steel-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-black text-amber-700">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>
                    {lang === 'fr'
                      ? 'En attente de confirmation par l’autre partie'
                      : 'تم إرسال طلب إنهاء العمل — في انتظار تأكيد الطرف الآخر'}
                  </span>
                </div>
                <p className="text-steel-600 font-bold">
                  {lang === 'fr' ? 'Motif déclaré : ' : 'السبب المسجّل: '}
                  {
                    REASON_OPTIONS.find((r) => r.id === (term?.reason || 'completed_project'))?.[
                      lang === 'fr' ? 'labelFr' : 'labelAr'
                    ]
                  }
                </p>
                {term?.note && (
                  <p className="text-steel-500">
                    {lang === 'fr' ? 'Note : ' : 'ملاحظة: '}
                    {term.note}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="font-semibold leading-relaxed">
                    {lang === 'fr'
                      ? 'Si le partenaire reste injoignable, vous pouvez enregistrer une clôture unilatérale documentée (sous votre responsabilité juridique selon le Code du Travail).'
                      : 'في حال تعذر تفاعل الطرف الآخر، يمكنك إغلاق المهمة أحادياً مع بقاء إثبات الإجراء والتاريخ محفوظاً (تحت المسؤولية القانونية وفق مدونة الشغل).'}
                  </p>
                </div>
                <label className="flex items-start gap-2 text-[11px] font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-rose-600"
                  />
                  <span>
                    {lang === 'fr'
                      ? 'Je confirme vouloir enregistrer la fin de mission unilatérale sous ma responsabilité.'
                      : 'أؤكد تسجيل إنهاء العمل أحادياً مع تحمّل المسؤولية القانونية للسبب المصرح به.'}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  {lang === 'fr' ? 'Fermer' : 'إغلاق'}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black"
                >
                  {lang === 'fr' ? 'Clôturer unilatéralement' : 'تثبيت الإنهاء الأحادي'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Legal Reason */}
              <div>
                <label className="block text-xs font-black text-ink mb-1.5">
                  {lang === 'fr' ? 'Motif juridique de fin de mission' : 'السبب القانوني لإنهاء العمل'}
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as WorkTerminationReason)}
                  disabled={isRespondingToPeer}
                  className="w-full px-3 py-2.5 rounded-xl border border-steel-300 bg-white text-xs font-bold text-ink disabled:bg-surface"
                >
                  {visibleReasons.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {lang === 'fr' ? opt.labelFr : opt.labelAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-bold text-steel-600 mb-1">
                  {lang === 'fr'
                    ? 'Note (restitution engin / règlement salaire)'
                    : 'ملاحظات التصفية (استلام الآلية / تصفية الأجر المتبقي)'}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex: Engin restitué en bon état, salaire intégralement payé.'
                      : 'مثال: تم تسليم الآلية بحالة سليمة وأداء كامل المستحقات المالية...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-steel-300 text-xs text-ink"
                />
              </div>

              {/* Legal Attestation */}
              <label className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs font-bold text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0"
                />
                <span className="leading-relaxed">
                  {partyRole === 'owner'
                    ? lang === 'fr'
                      ? 'En tant que propriétaire, j’atteste avoir réglé ou m’engager à solder la rémunération due au conducteur pour les jours travaillés et constaté le retour de l’engin.'
                      : 'أقرّ بصفتي مالك الآلية بأداء كامل مستحقات السائق عن مدة العمل المنجزة وتوثيق نهاية المهمة.'
                    : lang === 'fr'
                    ? 'En tant que conducteur, j’atteste avoir restitué l’engin et ses clés au propriétaire et validé le règlement convenu.'
                    : 'أقرّ بصفتي سائقاً بتسليم الآلية ومفاتيحها للمالك وبمراجعة مستحقاتي المتفق عليها.'}
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="md" onClick={onClose}>
                  {lang === 'fr' ? 'Annuler' : 'إلغاء'}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  className="font-black text-xs min-h-[42px]"
                >
                  {isRespondingToPeer
                    ? lang === 'fr'
                      ? 'Confirmer la fin de mission ✓'
                      : 'تأكيد إنهاء العمل وإبراء الذمة ✓'
                    : lang === 'fr'
                    ? 'Envoyer la demande de fin'
                    : 'إرسال طلب إنهاء العمل'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkTerminationModal;
