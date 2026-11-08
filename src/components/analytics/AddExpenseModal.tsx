// ============================================================================
// JADIJCB: Record Fleet Expense & Machine Maintenance Modal
// Cost, Category, Hours/Km, Next Due Date, Receipt, and DB Sync
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Wrench,
  Fuel,
  UserCheck,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Check,
  Clock,
  Building,
  Gauge,
  Calendar,
} from 'lucide-react';
import { Machine, MachineExpense, ExpenseCategory } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { expenseStore } from '../../lib/expenseStore';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  onExpenseAdded: () => void;
  defaultMachineId?: string;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  machines,
  onExpenseAdded,
  defaultMachineId,
}) => {
  const { lang } = useLanguage();
  const { profile, user } = useAuth();

  const [machineId, setMachineId] = useState<string>(defaultMachineId || machines[0]?.id || 'general');
  const [expenseType, setExpenseType] = useState<'maintenance' | 'expense'>('expense');
  const [category, setCategory] = useState<ExpenseCategory>('preventive_service');
  const [amount, setAmount] = useState<number | ''>(1500);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [hoursOrKm, setHoursOrKm] = useState<number | ''>('');
  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [downtimeHours, setDowntimeHours] = useState<number | ''>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const CATEGORY_OPTIONS: { id: ExpenseCategory; labelAr: string; labelFr: string; icon: React.ReactNode }[] = [
    { id: 'preventive_service', labelAr: '🛠️ صيانة دورية (Vidange / Filtres)', labelFr: 'Vidange / Entretien périodique', icon: <Wrench className="w-4 h-4 text-emerald-500" /> },
    { id: 'repair_breakdown', labelAr: '⚠️ إصلاح عطل وقطع غيار (Pannes)', labelFr: 'Panne & Réparation mécanique', icon: <AlertTriangle className="w-4 h-4 text-rose-500" /> },
    { id: 'fuel', labelAr: '⛽ وقود وكازوال (Gasoil)', labelFr: 'Carburant / Gasoil', icon: <Fuel className="w-4 h-4 text-amber-500" /> },
    { id: 'operator', labelAr: '👷 أجرة وسلفة السائق (Chauffeur)', labelFr: 'Salaire / Avance opérateur', icon: <UserCheck className="w-4 h-4 text-blue-500" /> },
    { id: 'transport', labelAr: '🚚 نقل وديباناج (Porte-char)', labelFr: 'Transport / Porte-char', icon: <Truck className="w-4 h-4 text-purple-500" /> },
    { id: 'insurance_tech', labelAr: '📑 تأمين وفحص تقني (Visite)', labelFr: 'Assurance & Visite technique', icon: <ShieldCheck className="w-4 h-4 text-teal-500" /> },
    { id: 'other', labelAr: '📦 مصاريف تشغيل أخرى', labelFr: 'Autre charge d\'exploitation', icon: <Receipt className="w-4 h-4 text-steel-500" /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error(lang === 'fr' ? 'Veuillez saisir un montant valide' : 'يرجى إدخال مبلغ صحيح بالدرهم');
      return;
    }

    if (!title.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez renseigner l\'intitulé de la dépense' : 'يرجى إدخال بيان أو سبب المصروف');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedMachine = machines.find((m) => m.id === machineId);
      const newExpense: MachineExpense = {
        id: crypto.randomUUID(),
        owner_id: user?.id || profile?.id || 'default_owner',
        machine_id: machineId === 'general' ? '' : machineId,
        category,
        amount: Number(amount),
        date,
        title: title.trim(),
        description: description.trim(),
        vendor_name: vendorName.trim(),
        receipt_number: receiptNumber.trim(),
        downtime_hours: Number(downtimeHours) || 0,
        hours_or_km: Number(hoursOrKm) || undefined,
        next_due_date: nextDueDate || undefined,
        expense_type: expenseType,
        created_at: new Date().toISOString(),
        machine: selectedMachine,
      };

      await expenseStore.addExpense(newExpense);
      setIsSubmitting(false);

      toast.success(
        lang === 'fr'
          ? 'Opération de maintenance/dépense enregistrée !'
          : 'تم تسجيل عملية الصيانة / المصروف بنجاح!'
      );

      onExpenseAdded();
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err?.message || (lang === 'fr' ? 'Erreur lors de l\'enregistrement' : 'حدث خطأ أثناء الحفظ'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs text-start overflow-y-auto"
    >
      <div className="bg-white border border-steel-200 rounded-3xl max-w-lg w-full shadow-2xl my-6 overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">
                {lang === 'fr' ? 'Enregistrer une dépense ou maintenance' : 'تسجيل مصروف تشغيلي أو صيانة دورية'}
              </h3>
              <p className="text-[11px] text-steel-400">
                {lang === 'fr'
                  ? 'Suivi du coût de revient et rentabilité par engin'
                  : 'تتبع تكلفة الصيانة وصافي أرباح كل آلية في الأسطول'}
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
          {/* Machine Selection */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary-dark" />
              <span>{lang === 'fr' ? 'Engin concerné *' : 'الآلية المعنية بالمصروف *'}</span>
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title_ar} - {m.brand} {m.model}
                </option>
              ))}
              <option value="general">
                {lang === 'fr' ? '📦 Charge générale du parc (Non liée à un seul engin)' : '📦 مصاريف عامة للأسطول (غير محددة بآلية واحدة)'}
              </option>
            </select>
          </div>

          {/* Type Toggle: Maintenance vs Operational Expense */}
          <div className="flex bg-steel-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setExpenseType('maintenance');
                setCategory('preventive_service');
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                expenseType === 'maintenance' ? 'bg-primary text-ink shadow-xs' : 'text-steel-600'
              }`}
            >
              🛠️ {lang === 'fr' ? 'Entretien / Maintenance' : 'صيانة دورية وإصلاح'}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpenseType('expense');
                setCategory('fuel');
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                expenseType === 'expense' ? 'bg-primary text-ink shadow-xs' : 'text-steel-600'
              }`}
            >
              ⛽ {lang === 'fr' ? 'Charge d\'exploitation' : 'مصاريف تشغيل ووقود'}
            </button>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Catégorie de la dépense *' : 'تصنيف التكلفة والمصروف *'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'fr' ? c.labelFr : c.labelAr}
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Montant TTC (MAD) *' : 'المبلغ المؤدى (بالدرهم) *'}
              </label>
              <Input
                type="number"
                min="1"
                placeholder="Ex. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                required
                dir="ltr"
                className="font-mono font-black"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr' ? 'Date de l\'intervention *' : 'تاريخ الصيانة / العملية *'}
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>

          {/* Title / Description */}
          <Input
            label={lang === 'fr' ? 'Intitulé / Désignation *' : 'بيان العملية (العنوان) *'}
            placeholder={
              lang === 'fr'
                ? 'Ex. Vidange 500h + filtres à huile et gasoil'
                : 'مثال: فيدونج 500 ساعة مع تغيير فيلتر الزيت والمازوط'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Maintenance Specific: Hours/Km & Next Due Date */}
          {expenseType === 'maintenance' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Compteur horaire (Heures)' : 'عداد الساعات (Heures)'}</span>
                </label>
                <Input
                  type="number"
                  placeholder="Ex. 3450"
                  value={hoursOrKm}
                  onChange={(e) => setHoursOrKm(e.target.value === '' ? '' : Number(e.target.value))}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Prochaine échéance' : 'موعد الصيانة القادمة'}</span>
                </label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Vendor & Receipt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={lang === 'fr' ? 'Fournisseur / Garage' : 'المورد أو الميكانيكي'}
              placeholder="Ex. Garage Al Baraka"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />

            <Input
              label={lang === 'fr' ? 'N° Facture / Reçu' : 'رقم الفاتورة أو التوصيل'}
              placeholder="Ex. FC-2026-981"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              dir="ltr"
            />
          </div>

          {/* Downtime Hours */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-steel-500" />
              <span>{lang === 'fr' ? 'Heures d\'arrêt sur chantier (Downtime)' : 'ساعات توقف الورش بسبب العطل'}</span>
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={downtimeHours}
              onChange={(e) => setDowntimeHours(e.target.value === '' ? '' : Number(e.target.value))}
              dir="ltr"
            />
          </div>

          {/* Action Buttons */}
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
              className="font-black text-xs px-6 shadow-md"
            >
              {lang === 'fr' ? 'Enregistrer la charge' : 'حفظ وتسجيل المصروف'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpenseModal;
