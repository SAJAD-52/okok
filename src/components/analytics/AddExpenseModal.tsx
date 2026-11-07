// ============================================================================
// JADIJCB: Record Fleet Expense & Machine Breakdown / Maintenance Modal
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
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState<number | ''>(2500);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [downtimeHours, setDowntimeHours] = useState<number | ''>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const CATEGORY_OPTIONS: { id: ExpenseCategory; labelAr: string; labelFr: string; icon: React.ReactNode }[] = [
    { id: 'fuel', labelAr: '⛽ وقود وكازوال', labelFr: 'Carburant / Gasoil', icon: <Fuel className="w-4 h-4 text-amber-500" /> },
    { id: 'operator', labelAr: '👷 أجرة وسلفة السائق', labelFr: 'Salaire / Chauffeur', icon: <UserCheck className="w-4 h-4 text-blue-500" /> },
    { id: 'preventive_service', labelAr: '🛠️ صيانة دورية (Vidange)', labelFr: 'Entretien régulier', icon: <Wrench className="w-4 h-4 text-emerald-500" /> },
    { id: 'repair_breakdown', labelAr: '⚠️ إصلاح عطل وقطع غيار', labelFr: 'Panne & Réparation', icon: <AlertTriangle className="w-4 h-4 text-rose-500" /> },
    { id: 'transport', labelAr: '🚚 نقل وديباناج (Porte-char)', labelFr: 'Transport / Porte-char', icon: <Truck className="w-4 h-4 text-purple-500" /> },
    { id: 'insurance_tech', labelAr: '📑 تأمين وفحص تقني', labelFr: 'Assurance & Visite', icon: <ShieldCheck className="w-4 h-4 text-teal-500" /> },
    { id: 'other', labelAr: '📦 مصاريف تشغيل أخرى', labelFr: 'Autre charge', icon: <Receipt className="w-4 h-4 text-steel-500" /> },
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
        id: 'exp_' + Math.random().toString(36).substring(2, 9),
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
        created_at: new Date().toISOString(),
        machine: selectedMachine,
      };

      await expenseStore.saveExpense(newExpense);
      toast.success(lang === 'fr' ? 'Dépense enregistrée avec succès' : 'تم تسجيل المصروف والعملية بنجاح');
      onExpenseAdded();
      onClose();
    } catch {
      toast.error(lang === 'fr' ? 'Erreur lors de l\'enregistrement' : 'حدث خطأ أثناء حفظ المصروف');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-lg w-full shadow-2xl my-auto overflow-hidden text-start animate-fade-in">
        {/* Header */}
        <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-black">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {lang === 'fr' ? 'Enregistrer une charge ou une panne' : 'تسجيل مصروف تشغيلي أو عطل فني'}
              </h3>
              <span className="text-[11px] text-steel-400">
                {lang === 'fr'
                  ? 'Suivez vos coûts de carburant, chauffeurs, vidanges et réparations'
                  : 'تتبع تكاليف المحروقات، أجور السائقين، الصيانة، وقطع الغيار'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Machine Selection */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Machine concernée' : 'الآلية المعنية بالمصروف'}
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            >
              <option value="general">
                {lang === 'fr' ? '🌐 Charge générale sur tout le parc' : '🌐 مصاريف عامة على الأسطول ككل'}
              </option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  🚜 {m.title_ar || m.title_fr} ({m.brand} {m.model})
                </option>
              ))}
            </select>
          </div>

          {/* Category Chips */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {lang === 'fr' ? 'Type de dépense' : 'نوع وطبيعة المصروف'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-start flex items-center gap-2 transition-all cursor-pointer ${
                    category === cat.id
                      ? 'border-primary bg-amber-50 text-ink ring-2 ring-primary/20 shadow-sm'
                      : 'border-steel-200 hover:bg-steel-50 text-steel-700'
                  }`}
                >
                  {cat.icon}
                  <span className="truncate">{lang === 'fr' ? cat.labelFr : cat.labelAr}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label={lang === 'fr' ? 'Montant (MAD)' : 'المبلغ بالدرهم (MAD)'}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 3500"
              required
            />
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1">
                {lang === 'fr' ? 'Date de l\'opération' : 'تاريخ العملية'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                required
              />
            </div>
          </div>

          {/* Title / Description */}
          <Input
            label={lang === 'fr' ? 'Intitulé / Motif de la dépense' : 'بيان المصروف أو سبب العطل'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              category === 'fuel'
                ? 'مثال: تزويد كازوال 800 لتر للورش'
                : category === 'repair_breakdown'
                ? 'مثال: إصلاح مضخة الهيدروليك وتغيير الفلتر'
                : 'مثال: أجرة السائق الشهرية'
            }
            required
          />

          {/* Downtime Hours (especially for breakdowns/maintenance) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1">
                {lang === 'fr' ? 'Arrêt machine (heures)' : 'ساعات توقف الآلية (إن وجد)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={downtimeHours}
                  onChange={(e) => setDowntimeHours(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
                <Clock className="w-4 h-4 text-steel-400 absolute end-3 top-3 pointer-events-none" />
              </div>
            </div>

            <Input
              label={lang === 'fr' ? 'N° Facture / BL' : 'رقم الفاتورة أو وصل الشراء'}
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="BL-2026-081"
            />
          </div>

          {/* Vendor / Supplier */}
          <Input
            label={lang === 'fr' ? 'Fournisseur / Garage / Station' : 'المزود أو محطة الوقود أو الورشة'}
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="مثال: محطة طوطال، كراج السلام للوزن الثقيل"
          />

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1">
              {lang === 'fr' ? 'Notes et observations' : 'ملاحظات وتفاصيل إضافية'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل حول القطع المستبدلة أو موقع التدخل الميداني..."
              className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center font-black min-h-[48px]"
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Confirmer et enregistrer la dépense' : 'تأكيد وحفظ بيانات المصروف'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
