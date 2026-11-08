// ============================================================================
// JADIJCB: Clients Directory Page (/app/clients & /owner/clients)
// Per-Owner Directory, Search by Name/Phone, Total Billed, Unpaid Balance, History
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  FileText,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  CreditCard,
  UserCheck,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { clientService } from '../lib/clientService';
import { bookingStore } from '../lib/bookingStore';
import { paymentService } from '../lib/paymentService';
import { Client, Booking } from '../types/database';
import { MOROCCAN_CITIES } from '../data/cities';

export const ClientsPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Client Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [cinOrIce, setCinOrIce] = useState('');
  const [clientCity, setClientCity] = useState('Casablanca');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Client Details Drawer / View
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const ownerId = user?.id || profile?.id;

  const loadData = async () => {
    if (!ownerId) return;
    setIsLoading(true);
    try {
      const allBookings = bookingStore.getCachedBookings().filter(
        (b) => b.owner_id === ownerId || !b.owner_id
      );
      setBookings(allBookings);

      const loadedClients = await clientService.getClients(ownerId, allBookings);
      setClients(loadedClients);
    } catch (err) {
      console.warn('Error loading clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('jadijcb_clients_updated', handleUpdate);
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_payments_updated', handleUpdate);

    return () => {
      window.removeEventListener('jadijcb_clients_updated', handleUpdate);
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_payments_updated', handleUpdate);
    };
  }, [ownerId]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (c.cin_or_ice && c.cin_or_ice.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  const openCreateModal = () => {
    setEditingClient(null);
    setClientName('');
    setClientPhone('');
    setCinOrIce('');
    setClientCity('Casablanca');
    setClientNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setClientName(c.name);
    setClientPhone(c.phone);
    setCinOrIce(c.cin_or_ice || '');
    setClientCity(c.city || 'Casablanca');
    setClientNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;

    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error(lang === 'fr' ? 'Nom et téléphone requis' : 'الاسم ورقم الهاتف مطلوبان');
      return;
    }

    setIsSubmitting(true);

    if (editingClient) {
      const res = await clientService.updateClient(ownerId, editingClient.id, {
        name: clientName,
        phone: clientPhone,
        cin_or_ice: cinOrIce,
        city: clientCity,
        notes: clientNotes,
      });
      setIsSubmitting(false);
      if (res.success) {
        toast.success(lang === 'fr' ? 'Client mis à jour !' : 'تم تحديث بيانات الزبون بنجاح!');
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Erreur');
      }
    } else {
      const res = await clientService.createClient(ownerId, {
        name: clientName,
        phone: clientPhone,
        cin_or_ice: cinOrIce,
        city: clientCity,
        notes: clientNotes,
      });
      setIsSubmitting(false);
      if (res.success) {
        toast.success(lang === 'fr' ? 'Client ajouté avec succès !' : 'تمت إضافة الزبون بنجاح إلى دليلك!');
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Erreur');
      }
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!ownerId) return;
    const confirmMsg =
      lang === 'fr'
        ? `Êtes-vous sûr de vouloir supprimer le client "${name}" ?`
        : `هل أنت متأكد من حذف الزبون "${name}"؟`;
    if (!window.confirm(confirmMsg)) return;

    const res = await clientService.deleteClient(ownerId, id);
    if (res.success) {
      toast.success(lang === 'fr' ? 'Client supprimé.' : 'تم حذف الزبون.');
      if (selectedClient?.id === id) setSelectedClient(null);
      loadData();
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  // Get rentals history for selected client
  const clientRentals = useMemo(() => {
    if (!selectedClient) return [];
    return bookings.filter((b) => {
      if (b.client_ref_id && b.client_ref_id === selectedClient.id) return true;
      if (b.client_phone && selectedClient.phone && b.client_phone.replace(/\D/g, '').endsWith(selectedClient.phone.replace(/\D/g, '').slice(-8))) return true;
      if (b.client_name && selectedClient.name && b.client_name.trim().toLowerCase() === selectedClient.name.trim().toLowerCase()) return true;
      return false;
    });
  }, [selectedClient, bookings]);

  return (
    <div className="space-y-6 text-start">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
            <Users className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Répertoire B2B des clients' : 'دليل زبائن ومقاولي الكراء'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Clients et comptes professionnels' : 'سجل الزبائن والمقاولين'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Consultez l\'historique des locations, le total facturé et les soldes restants par client.'
              : 'تتبع سجل كراء كل زبون، إجمالي المبالغ المفوترة، والديون والمستحقات المتبقية للتذكير الفوري.'}
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-black text-xs shadow-sm self-start sm:self-auto min-h-[44px]"
        >
          {lang === 'fr' ? 'Nouveau client' : 'إضافة زبون جديد'}
        </Button>
      </div>

      {/* Search and Summary Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-steel-400 absolute start-3 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Rechercher par nom, téléphone, ICE, CIN ou ville...'
                : 'ابحث بالاسم، الهاتف، رقم الـ ICE أو المدينة...'
            }
            className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-steel-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-steel-600">
          <span className="px-3 py-1.5 rounded-xl bg-white border border-steel-200 shadow-xs">
            {clients.length} {lang === 'fr' ? 'clients enregistrés' : 'زبون مسجل'}
          </span>
        </div>
      </div>

      {/* Main Grid: Clients List (Left) + Selected Client Detail Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Clients Table / Cards (7 or 12 Cols) */}
        <div className={selectedClient ? 'lg:col-span-7 space-y-3' : 'lg:col-span-12 space-y-3'}>
          {isLoading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-steel-200 text-xs text-steel-400">
              {lang === 'fr' ? 'Chargement des clients...' : 'جاري تحميل سجل الزبائن...'}
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="p-8 text-center bg-white border border-steel-200 rounded-2xl space-y-3">
              <Users className="w-10 h-10 mx-auto text-steel-300" />
              <h3 className="text-sm font-bold text-ink">
                {lang === 'fr' ? 'Aucun client trouvé' : 'لم يتم العثور على أي زبون'}
              </h3>
              <p className="text-xs text-steel-500 max-w-sm mx-auto">
                {lang === 'fr'
                  ? 'Ajoutez vos clients réguliers pour générer des contrats et factures en un clic lors de vos réservations.'
                  : 'أضف زبائنك ومقاولي الأشغال لتتمكن من اختيارهم بضغطة زر وتوليد العقود والفواتير لهم فوراً.'}
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                leftIcon={<Plus className="w-4 h-4" />}
                className="font-bold text-xs"
              >
                {lang === 'fr' ? 'Créer le premier client' : 'إضافة أول زبون الآن'}
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredClients.map((c) => {
                const isSelected = selectedClient?.id === c.id;
                const hasDue = (c.unpaid_balance || 0) > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white text-xs ${
                      isSelected
                        ? 'border-primary shadow-md ring-1 ring-primary'
                        : 'border-steel-200 hover:border-steel-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-steel-100 text-steel-700 font-black flex items-center justify-center shrink-0 text-sm">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-ink">{c.name}</span>
                            {c.cin_or_ice && (
                              <span className="px-1.5 py-0.5 rounded bg-steel-100 text-steel-600 font-mono text-[10px] font-bold">
                                {c.cin_or_ice}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-steel-500 text-[11px] mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-primary-dark" />
                              <span dir="ltr" className="font-mono">{c.phone}</span>
                            </span>
                            {c.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-steel-400" />
                                <span>{c.city}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-steel-100">
                        <div className="text-start sm:text-end">
                          <span className="text-[10px] text-steel-400 block font-medium">
                            {lang === 'fr' ? 'Total facturé' : 'إجمالي المفوتر'}
                          </span>
                          <span className="font-mono font-bold text-ink">
                            {(c.total_billed || 0).toLocaleString('fr-FR')} MAD
                          </span>
                        </div>

                        <div className="text-start sm:text-end">
                          <span className="text-[10px] text-steel-400 block font-medium">
                            {lang === 'fr' ? 'Reste dû' : 'المتبقي ذمة'}
                          </span>
                          <span
                            className={`font-mono font-black ${
                              hasDue ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {(c.unpaid_balance || 0).toLocaleString('fr-FR')} MAD
                          </span>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-2 rounded-xl text-steel-500 hover:text-ink hover:bg-steel-100 transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Client Detail Card (5 Cols) */}
        {selectedClient && (
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <Card className="p-5 bg-white border border-steel-200 shadow-elevated rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-steel-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary-dark" />
                  <h3 className="font-black text-sm text-ink">{selectedClient.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="p-1 rounded-lg text-steel-400 hover:text-ink hover:bg-steel-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-steel-50 border border-steel-200">
                  <span className="text-[10px] text-steel-400 block font-medium">
                    {lang === 'fr' ? 'Téléphone direct' : 'رقم الهاتف'}
                  </span>
                  <span className="font-mono font-bold text-ink block mt-0.5" dir="ltr">
                    {selectedClient.phone}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-steel-50 border border-steel-200">
                  <span className="text-[10px] text-steel-400 block font-medium">
                    {lang === 'fr' ? 'ICE / CIN' : 'رقم الـ ICE أو البطاقة'}
                  </span>
                  <span className="font-mono font-bold text-ink block mt-0.5">
                    {selectedClient.cin_or_ice || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-steel-50 border border-steel-200">
                  <span className="text-[10px] text-steel-400 block font-medium">
                    {lang === 'fr' ? 'Total facturé' : 'إجمالي المعاملات'}
                  </span>
                  <span className="font-mono font-bold text-ink block mt-0.5">
                    {(selectedClient.total_billed || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    (selectedClient.unpaid_balance || 0) > 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <span className="text-[10px] text-steel-500 block font-medium">
                    {lang === 'fr' ? 'Solde impayé' : 'الرصيد غير المسدد'}
                  </span>
                  <span
                    className={`font-mono font-black block mt-0.5 ${
                      (selectedClient.unpaid_balance || 0) > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {(selectedClient.unpaid_balance || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>

              {selectedClient.notes && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold block mb-0.5 text-[10px] uppercase text-amber-800">
                    {lang === 'fr' ? 'Notes particulières' : 'ملاحظات خاصة بالمقاول:'}
                  </span>
                  <p className="leading-relaxed">{selectedClient.notes}</p>
                </div>
              )}

              {/* Action Buttons: WhatsApp & Call */}
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${selectedClient.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${selectedClient.phone}`}
                  className="py-2.5 px-4 rounded-xl border border-steel-300 text-ink hover:bg-steel-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                </a>
              </div>

              {/* Rental History List */}
              <div className="pt-2">
                <h4 className="text-xs font-black text-ink mb-2">
                  {lang === 'fr' ? 'Historique des locations' : 'سجل عمليات الكراء السابقة:'}
                </h4>

                {clientRentals.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-steel-50 border border-steel-200 text-[11px] text-steel-500">
                    {lang === 'fr'
                      ? 'Aucune location enregistrée pour ce client.'
                      : 'لا توجد عمليات كراء مسجلة لهذا الزبون حتى الآن.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {clientRentals.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl border border-steel-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-black text-ink block truncate max-w-[170px]">
                            {r.machine?.title_ar || r.machine?.title_fr || 'آلية JCB'}
                          </span>
                          <span className="text-[10px] text-steel-500 font-mono" dir="ltr">
                            {r.start_at?.slice(0, 10)} → {r.end_at?.slice(0, 10)}
                          </span>
                        </div>

                        <div className="text-end">
                          <span className="font-mono font-bold text-ink block">
                            {Number(r.total_price).toLocaleString('fr-FR')} MAD
                          </span>
                          <Badge
                            variant={
                              r.status === 'completed'
                                ? 'success'
                                : r.status === 'active'
                                ? 'warning'
                                : 'neutral'
                            }
                            className="text-[9px]"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone: Delete Client */}
              <div className="pt-2 border-t border-steel-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedClient)}
                  className="text-xs font-bold text-steel-600 hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Modifier la fiche' : 'تعديل البيانات'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteClient(selectedClient.id, selectedClient.name)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Supprimer' : 'حذف'}</span>
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Create / Edit Client Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs"
        >
          <div className="bg-white border border-steel-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-start animate-scale-in">
            <div className="bg-ink p-5 text-white flex items-center justify-between border-b-2 border-primary">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm">
                  {editingClient
                    ? lang === 'fr'
                      ? 'Modifier le client'
                      : 'تعديل بيانات الزبون'
                    : lang === 'fr'
                    ? 'Ajouter un nouveau client'
                    : 'إضافة زبون / مقاول جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4">
              <Input
                label={lang === 'fr' ? 'Nom ou Raison sociale *' : 'اسم الزبون أو المقاولة *'}
                placeholder="Ex. Société Al Manar Travaux"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />

              <Input
                label={lang === 'fr' ? 'Téléphone direct / WhatsApp *' : 'رقم الهاتف / الواتساب *'}
                placeholder="+2126XXXXXXXX"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                dir="ltr"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={lang === 'fr' ? 'ICE ou CIN' : 'رقم الـ ICE أو البطاقة'}
                  placeholder="001928471..."
                  value={cinOrIce}
                  onChange={(e) => setCinOrIce(e.target.value)}
                  dir="ltr"
                />

                <div>
                  <label className="text-xs font-bold text-steel-700 block mb-1.5">
                    {lang === 'fr' ? 'Ville' : 'المدينة'}
                  </label>
                  <select
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-steel-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                  >
                    {MOROCCAN_CITIES.map((c) => (
                      <option key={c.id} value={c.name_ar}>
                        {lang === 'fr' ? c.name_fr : c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1.5">
                  {lang === 'fr' ? 'Notes et historique particulier' : 'ملاحظات وتفاصيل إضافية عن الزبون:'}
                </label>
                <textarea
                  rows={3}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex. Conducteur de travaux M. Alami, chantier Rocade Sud...'
                      : 'مثال: رئيس الورش المهندس العلمي، الورش بطريق النواصر...'
                  }
                  className="w-full px-3.5 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-steel-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-bold"
                >
                  {t('common.cancel')}
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  className="font-black text-xs px-5 shadow-sm"
                >
                  {editingClient
                    ? lang === 'fr'
                      ? 'Enregistrer'
                      : 'حفظ التعديل'
                    : lang === 'fr'
                    ? 'Ajouter le client'
                    : 'إضافة الزبون'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
