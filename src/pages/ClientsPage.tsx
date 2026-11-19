// ============================================================================
// JADIJCB: Clients & Transactions Archive Directory (/owner/clients)
// Automatically aggregates all dealt-with clients (bookings, contracts, dues)
// alongside saved B2B directory clients, displaying elegant cards + full
// multi-tab transaction archive (Rentals, Payments Ledger, Official Documents).
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  MessageSquare,
  FileText,
  FileCheck,
  Printer,
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
  Banknote,
  Receipt,
  Archive,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
  Copy,
  BellRing,
  BookmarkPlus,
  Truck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  clientService,
  doesBookingMatchClient,
  normalizeClientPhoneKey,
} from '../lib/clientService';
import { bookingStore } from '../lib/bookingStore';
import { machineStore, resolveMachineRates } from '../lib/machineStore';
import { paymentService } from '../lib/paymentService';
import { documentService } from '../lib/documentService';
import { businessService } from '../lib/businessService';
import { serverApi } from '../lib/serverApi';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RecordPaymentModal } from '../components/bookings/RecordPaymentModal';
import { MachineHoverThumbnail } from '../components/bookings/MachineHoverThumbnail';
import {
  Client,
  Booking,
  Machine,
  BookingPayment,
  DocumentRecord,
  BusinessProfile,
  UserProfile,
} from '../types/database';
import { MOROCCAN_CITIES, getCityById } from '../data/cities';
import { getClientSegmentOption } from '../data/clientSegments';

type ClientFilterTab = 'all' | 'active' | 'dues' | 'settled';
type ClientSortOption = 'recent' | 'highest_billed' | 'highest_due' | 'name';
type ArchiveSubTab = 'bookings' | 'payments' | 'documents';

interface UnifiedClientRecord {
  id: string;
  savedClientId?: string;
  isSavedInDirectory: boolean;
  linkedProfileId?: string;
  name: string;
  phone: string;
  cin_or_ice: string;
  city: string;
  notes: string;
  avatar_url?: string;
  client_segment?: UserProfile['client_segment'];
  bookings: Booking[];
  payments: BookingPayment[];
  documents: DocumentRecord[];
  totalBilled: number;
  totalPaid: number;
  unpaidBalance: number;
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  cancelledCount: number;
  lastTransactionAt: string;
  lastTransactionMs: number;
}

export const ClientsPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile, isSuperAdmin, isImpersonating } = useAuth();
  const navigate = useNavigate();

  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [clientProfilesMap, setClientProfilesMap] = useState<Record<string, Partial<UserProfile>>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<ClientFilterTab>('all');
  const [sortOption, setSortOption] = useState<ClientSortOption>('recent');

  // Selected client for archive inspection
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [archiveTab, setArchiveTab] = useState<ArchiveSubTab>('bookings');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create / Edit / Save Client Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [cinOrIce, setCinOrIce] = useState('');
  const [clientCity, setClientCity] = useState('الدار البيضاء');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Payment Recording Modal inside archive
  const [paymentTarget, setPaymentTarget] = useState<{
    booking: Booking;
    balanceDue: number;
  } | null>(null);
  const [generatingDocKey, setGeneratingDocKey] = useState<string | null>(null);

  const ownerId = isImpersonating ? profile?.id : (user?.id || profile?.id);

  const loadData = useCallback(
    async (silent = false) => {
      if (!ownerId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        // 1. Load owner fleet machines (for machine matching & hover thumbnails)
        let mList: Machine[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data: mData } = await supabase
              .from('machines')
              .select('*')
              .eq('owner_id', ownerId);
            if (mData) {
              mList = mData.map((m: any) => {
                const rates = resolveMachineRates(m);
                return {
                  id: m.id,
                  owner_id: m.owner_id,
                  title_ar: m.title_ar,
                  title_fr: m.title_fr,
                  category: m.category,
                  category_id: m.category,
                  brand: m.brand,
                  model: m.model,
                  year: m.year,
                  city: m.city,
                  city_id: m.city,
                  daily_rate: rates.rateDaily,
                  rate_daily: rates.rateDaily,
                  hourly_rate: rates.rateHourly,
                  rate_hourly: rates.rateHourly,
                  weekly_rate: rates.rateWeekly,
                  rate_weekly: rates.rateWeekly,
                  status: m.is_published ? 'available' : 'inactive',
                  images: m.images || [],
                } as Machine;
              });
            }
          } catch {
            // ignore
          }
        }
        const realMachines = mList.length > 0 ? mList : machineStore.mergeMachines([], ownerId);
        setMachines(realMachines);
        const ownerMachineIds = realMachines.map((m) => m.id).filter(Boolean);

        // 2. Load owner bookings from Express SQLite + Supabase + bookingStore cache
        const combinedMap = new Map<string, Booking>();
        try {
          const serverBookings = await serverApi.getBookings({ owner_id: ownerId });
          if (Array.isArray(serverBookings)) {
            for (const sb of serverBookings) {
              if (!sb?.id) continue;
              const matchedMachine =
                realMachines.find((m) => m.id === sb.machine_id) ||
                machineStore.getCachedMachines().find((m) => m.id === sb.machine_id) ||
                sb.machine;
              combinedMap.set(sb.id, { ...sb, machine: matchedMachine });
            }
          }
        } catch {
          // ignore
        }

        if (isSupabaseConfigured) {
          try {
            const fetchedMap = new Map<string, any>();
            const { data: ownerData, error: ownerErr } = await supabase
              .from('bookings')
              .select('*')
              .eq('owner_id', ownerId)
              .order('created_at', { ascending: false });
            if (!ownerErr && ownerData) {
              for (const row of ownerData) fetchedMap.set(row.id, row);
            }

            if (ownerMachineIds.length > 0) {
              const { data: machineData, error: mErr } = await supabase
                .from('bookings')
                .select('*')
                .in('machine_id', ownerMachineIds)
                .order('created_at', { ascending: false });
              if (!mErr && machineData) {
                for (const row of machineData) fetchedMap.set(row.id, row);
              }
            }

            for (const b of fetchedMap.values()) {
              const matchedMachine =
                realMachines.find((m) => m.id === b.machine_id) ||
                machineStore.getCachedMachines().find((m) => m.id === b.machine_id) ||
                b.machines ||
                b.machine;
              combinedMap.set(b.id, {
                id: b.id,
                machine_id: b.machine_id,
                owner_id: b.owner_id,
                client_id: b.client_id,
                client_ref_id: b.client_ref_id,
                client_name: b.client_name,
                client_phone: b.client_phone,
                site_city_id: b.site_city_id,
                site_address: b.site_address,
                start_at: b.start_at || b.start_date,
                end_at: b.end_at || b.end_date,
                total_price: Number(b.total_price) || 0,
                paid_amount: Number(b.paid_amount) || 0,
                balance_due: b.balance_due != null ? Number(b.balance_due) : undefined,
                payment_status: b.payment_status,
                deposit_amount: Number(b.deposit_amount) || 0,
                rate_type: b.rate_type || 'daily',
                status: b.status,
                notes: b.notes,
                breakdowns: Array.isArray(b.breakdowns) ? b.breakdowns : undefined,
                pause_state: b.pause_state || null,
                created_at: b.created_at,
                machine: matchedMachine,
                with_operator: Boolean(b.with_operator ?? true),
                fuel_included: Boolean(b.fuel_included),
              });
            }
          } catch {
            // ignore
          }
        }

        const mergedBookings = bookingStore.mergeOwnerBookings(
          Array.from(combinedMap.values()),
          ownerId,
          ownerMachineIds,
          Boolean(isSuperAdmin && !isImpersonating)
        );
        setBookings(mergedBookings);

        // 3. Load Payments, Documents, Business Profile & Saved Directory Clients in parallel
        const [loadedPayments, loadedDocs, loadedBiz] = await Promise.all([
          paymentService.getPaymentsForOwner(ownerId).catch(() => []),
          documentService.getDocumentsForOwner(ownerId).catch(() => []),
          businessService.getProfile(ownerId).catch(() => null),
        ]);

        setPayments(loadedPayments);
        setDocuments(loadedDocs);
        if (loadedBiz) setBusinessProfile(loadedBiz);

        const loadedClients = await clientService.getClients(
          ownerId,
          mergedBookings,
          loadedPayments
        );
        setSavedClients(loadedClients);

        // 4. Enrich registered client profiles (company name, ICE/RC, avatar, city, segment)
        const clientIds = Array.from(
          new Set(
            mergedBookings
              .map((b) => b.client_id)
              .filter((id): id is string => Boolean(id && !id.startsWith('demo')))
          )
        );
        if (isSupabaseConfigured && clientIds.length > 0) {
          try {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, full_name, company_name, phone, city, ice_number, rc_number, avatar_url, client_segment')
              .in('id', clientIds);
            if (Array.isArray(profs)) {
              const pMap: Record<string, Partial<UserProfile>> = {};
              for (const p of profs as any[]) {
                if (p?.id) pMap[p.id] = p;
              }
              setClientProfilesMap(pMap);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn('Error loading clients archive:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, isSuperAdmin, isImpersonating]
  );

  useEffect(() => {
    loadData(false);

    const handleUpdate = () => loadData(true);
    window.addEventListener('jadijcb_clients_updated', handleUpdate);
    window.addEventListener('jadijcb_booking_event', handleUpdate);
    window.addEventListener('jadijcb_bookings_updated', handleUpdate);
    window.addEventListener('jadijcb_payments_updated', handleUpdate);
    window.addEventListener('jadijcb_documents_updated', handleUpdate);
    window.addEventListener('jadijcb_machines_updated', handleUpdate);

    let channel: any = null;
    if (isSupabaseConfigured && ownerId) {
      try {
        channel = supabase
          .channel(`clients_archive_rt_${ownerId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings' },
            () => loadData(true)
          )
          .subscribe();
      } catch {
        // ignore
      }
    }

    return () => {
      window.removeEventListener('jadijcb_clients_updated', handleUpdate);
      window.removeEventListener('jadijcb_booking_event', handleUpdate);
      window.removeEventListener('jadijcb_bookings_updated', handleUpdate);
      window.removeEventListener('jadijcb_payments_updated', handleUpdate);
      window.removeEventListener('jadijcb_documents_updated', handleUpdate);
      window.removeEventListener('jadijcb_machines_updated', handleUpdate);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadData, ownerId]);

  // Build unified list of ALL dealt-with clients (saved directory + automatic from bookings/deals)
  const unifiedClients = useMemo<UnifiedClientRecord[]>(() => {
    type DraftClient = {
      id: string;
      savedClientId?: string;
      isSavedInDirectory: boolean;
      linkedProfileId?: string;
      name: string;
      phone: string;
      cin_or_ice: string;
      city: string;
      notes: string;
      avatar_url?: string;
      client_segment?: UserProfile['client_segment'];
      bookings: Booking[];
    };

    const drafts: DraftClient[] = savedClients.map((c) => ({
      id: c.id,
      savedClientId: c.id,
      isSavedInDirectory: true,
      name: c.name,
      phone: c.phone,
      cin_or_ice: c.cin_or_ice || '',
      city: c.city || '',
      notes: c.notes || '',
      bookings: [],
    }));

    for (const b of bookings) {
      const prof = b.client_id ? clientProfilesMap[b.client_id] : undefined;
      const resolvedName =
        b.client_name?.trim() ||
        prof?.company_name?.trim() ||
        prof?.full_name?.trim() ||
        (lang === 'fr' ? 'Client sans nom' : 'زبون بدون اسم');
      const resolvedPhone = (b.client_phone || prof?.phone || '').trim();
      const resolvedIce =
        prof?.ice_number ||
        prof?.rc_number ||
        (b.renter as any)?.ice_number ||
        (b.renter as any)?.cin ||
        '';
      const resolvedCity = b.site_city_id || prof?.city || '';

      let matched = drafts.find((d) => doesBookingMatchClient(b, d));
      if (!matched && b.client_id) {
        matched = drafts.find((d) => d.linkedProfileId === b.client_id);
      }

      if (matched) {
        matched.bookings.push(b);
        if (!matched.linkedProfileId && b.client_id) matched.linkedProfileId = b.client_id;
        if (!matched.avatar_url && prof?.avatar_url) matched.avatar_url = prof.avatar_url;
        if (!matched.client_segment && prof?.client_segment) {
          matched.client_segment = prof.client_segment;
        }
        if (!matched.cin_or_ice && resolvedIce) matched.cin_or_ice = resolvedIce;
        if (!matched.city && resolvedCity) matched.city = resolvedCity;
        if (!matched.phone && resolvedPhone) matched.phone = resolvedPhone;
      } else {
        const phoneKey = normalizeClientPhoneKey(resolvedPhone);
        const autoKey =
          b.client_id ||
          (phoneKey ? `phone_${phoneKey}` : `name_${resolvedName.toLowerCase().replace(/\s+/g, '_')}`);
        drafts.push({
          id: `auto_${autoKey}`,
          isSavedInDirectory: false,
          linkedProfileId: b.client_id,
          name: resolvedName,
          phone: resolvedPhone,
          cin_or_ice: resolvedIce,
          city: resolvedCity,
          notes: '',
          avatar_url: prof?.avatar_url,
          client_segment: prof?.client_segment,
          bookings: [b],
        });
      }
    }

    return drafts.map((d) => {
      const sortedBookings = [...d.bookings].sort(
        (a, b) =>
          new Date(b.created_at || b.start_at || 0).getTime() -
          new Date(a.created_at || a.start_at || 0).getTime()
      );
      const bookingIds = new Set(sortedBookings.map((b) => b.id));
      const clientPayments = payments
        .filter((p) => bookingIds.has(p.booking_id))
        .sort(
          (a, b) =>
            new Date(b.payment_date || b.created_at || 0).getTime() -
            new Date(a.payment_date || a.created_at || 0).getTime()
        );
      const clientDocs = documents
        .filter((doc) => bookingIds.has(doc.booking_id))
        .sort(
          (a, b) =>
            new Date(b.issued_at || b.created_at || 0).getTime() -
            new Date(a.issued_at || a.created_at || 0).getTime()
        );

      const billableBookings = sortedBookings.filter((b) => b.status !== 'cancelled');
      let totalBilled = 0;
      let totalPaid = 0;

      for (const b of billableBookings) {
        const price = Number(b.total_price) || 0;
        const stats = paymentService.computeBookingPaymentStats(b, clientPayments);
        const paid = Math.max(stats.paidAmount, Number(b.paid_amount) || 0);
        totalBilled += price;
        totalPaid += Math.min(price > 0 ? price : paid, paid);
      }

      const unpaidBalance = Math.max(0, totalBilled - totalPaid);
      const activeCount = sortedBookings.filter(
        (b) => b.status === 'active' || b.status === 'confirmed'
      ).length;
      const pendingCount = sortedBookings.filter((b) => b.status === 'pending').length;
      const completedCount = sortedBookings.filter((b) => b.status === 'completed').length;
      const cancelledCount = sortedBookings.filter((b) => b.status === 'cancelled').length;

      const latestBookingDate = sortedBookings[0]?.created_at || sortedBookings[0]?.start_at || '';
      const latestPaymentDate = clientPayments[0]?.created_at || clientPayments[0]?.payment_date || '';
      const latestMs = Math.max(
        latestBookingDate ? new Date(latestBookingDate).getTime() : 0,
        latestPaymentDate ? new Date(latestPaymentDate).getTime() : 0
      );

      return {
        ...d,
        bookings: sortedBookings,
        payments: clientPayments,
        documents: clientDocs,
        totalBilled,
        totalPaid,
        unpaidBalance,
        activeCount,
        pendingCount,
        completedCount,
        cancelledCount,
        lastTransactionAt: latestMs > 0 ? new Date(latestMs).toISOString() : '',
        lastTransactionMs: latestMs,
      };
    });
  }, [savedClients, bookings, payments, documents, clientProfilesMap, lang]);

  // Global Executive KPI Totals
  const summaryStats = useMemo(() => {
    return unifiedClients.reduce(
      (acc, c) => {
        acc.totalClients += 1;
        acc.totalBilled += c.totalBilled;
        acc.totalPaid += c.totalPaid;
        acc.totalDue += c.unpaidBalance;
        return acc;
      },
      { totalClients: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 }
    );
  }, [unifiedClients]);

  // Filtered & Sorted Clients
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');

    const list = unifiedClients.filter((c) => {
      if (filterTab === 'active' && c.activeCount === 0 && c.pendingCount === 0) return false;
      if (filterTab === 'dues' && c.unpaidBalance <= 0) return false;
      if (filterTab === 'settled' && (c.unpaidBalance > 0 || c.totalBilled <= 0)) return false;

      if (!q) return true;
      const matchesMeta =
        c.name.toLowerCase().includes(q) ||
        (qDigits && c.phone.replace(/\D/g, '').includes(qDigits)) ||
        (c.cin_or_ice && c.cin_or_ice.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q));
      if (matchesMeta) return true;

      return c.bookings.some(
        (b) =>
          (b.machine?.title_ar || '').toLowerCase().includes(q) ||
          (b.machine?.title_fr || '').toLowerCase().includes(q) ||
          (b.machine?.brand || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortOption === 'highest_billed') return b.totalBilled - a.totalBilled;
      if (sortOption === 'highest_due') return b.unpaidBalance - a.unpaidBalance;
      if (sortOption === 'name') return a.name.localeCompare(b.name);
      return b.lastTransactionMs - a.lastTransactionMs;
    });
  }, [unifiedClients, searchQuery, filterTab, sortOption]);

  const selectedClient = useMemo(
    () => unifiedClients.find((c) => c.id === selectedClientId) || null,
    [unifiedClients, selectedClientId]
  );

  // Helper to resolve city label nicely
  const formatCity = (cityVal?: string) => {
    if (!cityVal) return '';
    const found = getCityById(cityVal);
    if (found) return lang === 'fr' ? found.name_fr : found.name_ar;
    return cityVal;
  };

  // Helper to open modal (Create new, Edit saved, or Promote auto-derived client into Directory)
  const openCreateModal = () => {
    setEditingClient(null);
    setClientName('');
    setClientPhone('');
    setCinOrIce('');
    setClientCity('الدار البيضاء');
    setClientNotes('');
    setIsModalOpen(true);
  };

  const openEditOrPromoteModal = (c: UnifiedClientRecord) => {
    if (c.isSavedInDirectory && c.savedClientId) {
      const saved = savedClients.find((s) => s.id === c.savedClientId) || null;
      setEditingClient(saved);
    } else {
      setEditingClient(null);
    }
    const resolvedCityObj = c.city ? getCityById(c.city) : undefined;
    setClientName(c.name);
    setClientPhone(c.phone);
    setCinOrIce(c.cin_or_ice || '');
    setClientCity(resolvedCityObj?.name_ar || 'الدار البيضاء');
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
        await loadData(true);
      } else {
        toast.error(res.error || t('common.error'));
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
      if (res.success && res.client) {
        toast.success(
          lang === 'fr' ? 'Client enregistré dans le répertoire !' : 'تم حفظ الزبون في الدليل بنجاح!'
        );
        setIsModalOpen(false);
        setSelectedClientId(res.client.id);
        await loadData(true);
      } else {
        toast.error(res.error || t('common.error'));
      }
    }
  };

  const handleConfirmDeleteClient = async (savedId: string) => {
    if (!ownerId) return;
    const res = await clientService.deleteClient(ownerId, savedId);
    setConfirmDeleteId(null);
    if (res.success) {
      toast.success(lang === 'fr' ? 'Fiche client supprimée du répertoire.' : 'تم حذف بطاقة الزبون من الدليل.');
      if (selectedClientId === savedId) setSelectedClientId(null);
      await loadData(true);
    } else {
      toast.error(res.error || t('common.error'));
    }
  };

  const handleGenerateOrOpenDoc = async (
    booking: Booking,
    docType: 'contract' | 'invoice' | 'receipt'
  ) => {
    if (!ownerId) return;
    const existing = documents.find((d) => d.booking_id === booking.id && d.type === docType);
    if (existing) {
      navigate(`/owner/documents/${existing.id}`);
      return;
    }

    const key = `${booking.id}_${docType}`;
    setGeneratingDocKey(key);
    try {
      const biz = businessProfile || (await businessService.getProfile(ownerId));
      const stats = paymentService.computeBookingPaymentStats(booking, payments);
      const paid = Math.max(stats.paidAmount, Number(booking.paid_amount) || 0);
      const due = Math.max(0, (Number(booking.total_price) || 0) - paid);
      const res = await documentService.generateDocument({
        ownerId,
        booking,
        type: docType,
        businessProfile: biz,
        paidAmount: paid,
        balanceDue: due,
      });
      if (res.success && res.document) {
        await loadData(true);
        navigate(`/owner/documents/${res.document.id}`);
      } else {
        toast.error(res.error || t('common.error'));
      }
    } catch {
      toast.error(lang === 'fr' ? 'Erreur lors de la création' : 'حدث خطأ أثناء إنشاء الوثيقة');
    } finally {
      setGeneratingDocKey(null);
    }
  };

  const getBookingStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'active':
        return {
          variant: 'warning' as const,
          label: lang === 'fr' ? 'En cours' : 'كراء جاري',
        };
      case 'confirmed':
        return {
          variant: 'info' as const,
          label: lang === 'fr' ? 'Confirmée' : 'مؤكد',
        };
      case 'completed':
        return {
          variant: 'success' as const,
          label: lang === 'fr' ? 'Terminée' : 'مكتمل',
        };
      case 'pending':
        return {
          variant: 'warning' as const,
          label: lang === 'fr' ? 'En attente' : 'بانتظار التأكيد',
        };
      case 'cancelled':
        return {
          variant: 'danger' as const,
          label: lang === 'fr' ? 'Annulée' : 'ملغى',
        };
      default:
        return {
          variant: 'neutral' as const,
          label: status,
        };
    }
  };

  const getMethodLabel = (method: BookingPayment['method']) => {
    switch (method) {
      case 'cash':
        return lang === 'fr' ? 'Espèces' : 'نقداً (كاش)';
      case 'rib':
        return lang === 'fr' ? 'Virement RIB' : 'تحويل بنكي RIB';
      case 'cheque':
        return lang === 'fr' ? 'Chèque' : 'شيك بنكي';
      case 'wafacash':
        return lang === 'fr' ? 'Wafacash / Cash+' : 'وفاكاش';
      default:
        return method;
    }
  };

  const getDocTypeLabel = (type: DocumentRecord['type']) => {
    if (type === 'contract') return lang === 'fr' ? 'Contrat de location' : 'عقد كراء';
    if (type === 'invoice') return lang === 'fr' ? 'Facture' : 'فاتورة';
    return lang === 'fr' ? 'Reçu de paiement' : 'وصل استلام';
  };

  return (
    <div className="space-y-6 text-start">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
            <Users className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Répertoire & Archive B2B' : 'دليل الزبناء وأرشيف المعاملات'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Clients et historique des transactions' : 'سجل الزبناء والمقاولين'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Tous les clients ayant effectué une réservation ou un contrat avec vous, avec leur archive complète.'
              : 'عرض جميع الزبناء والمقاولات الذين تعاملت معهم في بطاقات منظمة مع أرشيف كامل لعمليات الكراء، الأداءات، والعقود.'}
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

      {/* 4 Executive Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-steel-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-steel-500 text-[11px] font-bold mb-1.5">
            <span>{lang === 'fr' ? 'Clients traités' : 'الزبناء المتعامل معهم'}</span>
            <Users className="w-4 h-4 text-primary-dark" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-ink font-mono tabular-nums">
            {summaryStats.totalClients}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-steel-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-steel-500 text-[11px] font-bold mb-1.5">
            <span>{lang === 'fr' ? 'Total facturé' : 'إجمالي المعاملات'}</span>
            <Banknote className="w-4 h-4 text-steel-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-ink font-mono tabular-nums">
            {summaryStats.totalBilled.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-bold text-steel-400">MAD</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-[11px] font-bold mb-1.5">
            <span>{lang === 'fr' ? 'Total encaissé' : 'المبالغ المحصّلة'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 font-mono tabular-nums">
            {summaryStats.totalPaid.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-xs ${
            summaryStats.totalDue > 0
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-white border-steel-200'
          }`}
        >
          <div
            className={`flex items-center justify-between text-[11px] font-bold mb-1.5 ${
              summaryStats.totalDue > 0 ? 'text-rose-700' : 'text-steel-500'
            }`}
          >
            <span>{lang === 'fr' ? 'Reste à recouvrer' : 'المستحقات المتبقية'}</span>
            <AlertCircle
              className={`w-4 h-4 ${
                summaryStats.totalDue > 0 ? 'text-rose-600' : 'text-steel-400'
              }`}
            />
          </div>
          <p
            className={`text-lg sm:text-xl font-black font-mono tabular-nums ${
              summaryStats.totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {summaryStats.totalDue.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-bold">MAD</span>
          </p>
        </div>
      </div>

      {/* Search, Filter Tabs & Sort Bar */}
      <div className="bg-white rounded-2xl border border-steel-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-steel-400 absolute start-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Rechercher par nom, téléphone, ICE, ville ou engin loué...'
                  : 'ابحث باسم الزبون، الهاتف، الـ ICE، المدينة أو اسم الآلية...'
              }
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-steel-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-steel-500 whitespace-nowrap">
              {lang === 'fr' ? 'Trier :' : 'ترتيب:'}
            </span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as ClientSortOption)}
              className="px-3 py-2 rounded-xl border border-steel-200 text-xs font-bold text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="recent">{lang === 'fr' ? 'Plus récents' : 'الأحدث تعاملاً'}</option>
              <option value="highest_billed">
                {lang === 'fr' ? 'Plus gros volume' : 'الأعلى قيمة معاملات'}
              </option>
              <option value="highest_due">
                {lang === 'fr' ? 'Solde impayé' : 'الأكثر مستحقات متبقية'}
              </option>
              <option value="name">{lang === 'fr' ? 'Nom (A-Z)' : 'الاسم (أ-ي)'}</option>
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              {
                id: 'all',
                label: lang === 'fr' ? 'Tous' : 'الكل',
                count: unifiedClients.length,
              },
              {
                id: 'active',
                label: lang === 'fr' ? 'En cours' : 'معاملات جارية',
                count: unifiedClients.filter((c) => c.activeCount > 0 || c.pendingCount > 0).length,
              },
              {
                id: 'dues',
                label: lang === 'fr' ? 'Avec solde dû' : 'مستحقات متبقية',
                count: unifiedClients.filter((c) => c.unpaidBalance > 0).length,
              },
              {
                id: 'settled',
                label: lang === 'fr' ? 'Soldés 100%' : 'خالص 100%',
                count: unifiedClients.filter((c) => c.unpaidBalance === 0 && c.totalBilled > 0).length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                filterTab === tab.id
                  ? 'bg-ink text-primary border-ink shadow-xs'
                  : 'bg-surface text-steel-600 border-steel-200 hover:border-steel-300'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  filterTab === tab.id ? 'bg-primary text-ink' : 'bg-steel-200/70 text-steel-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Grid of Elegant Client Cards OR Split Cards + Selected Client Archive */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-10 text-center bg-white border border-steel-200 rounded-3xl space-y-3">
          <Users className="w-12 h-12 mx-auto text-steel-300" />
          <h3 className="text-base font-black text-ink">
            {searchQuery || filterTab !== 'all'
              ? lang === 'fr'
                ? 'Aucun client ne correspond à votre recherche'
                : 'لا توجد نتائج مطابقة للبحث أو الفلتر'
              : lang === 'fr'
              ? 'Aucun client enregistré pour le moment'
              : 'لا توجد معاملات أو زبناء مسجلون بعد'}
          </h3>
          <p className="text-xs text-steel-500 max-w-md mx-auto leading-relaxed">
            {lang === 'fr'
              ? 'Tout client ayant réservé une machine ou conclu un contrat apparaîtra automatiquement ici avec son archive.'
              : 'كل زبون أو مقاول يحجز معك آلية سيظهر هنا تلقائياً مع أرشيف معاملاته، كما يمكنك إضافة زبنائك يدوياً لتوليد العقود والفواتير بسرعة.'}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-black text-xs"
          >
            {lang === 'fr' ? 'Ajouter un client' : 'إضافة زبون جديد'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Client Cards List / Grid */}
          <div
            className={
              selectedClient
                ? 'hidden lg:block lg:col-span-5 space-y-3'
                : 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
            }
          >
            {filteredClients.map((c) => {
              const isSelected = selectedClient?.id === c.id;
              const hasDue = c.unpaidBalance > 0;
              const lastBooking = c.bookings[0];
              const lastMachineName =
                (lang === 'fr'
                  ? lastBooking?.machine?.title_fr
                  : lastBooking?.machine?.title_ar) ||
                lastBooking?.machine?.title_ar ||
                lastBooking?.machine?.title_fr ||
                '';
              const cityLabel = formatCity(c.city);
              const segLabel = c.client_segment
                ? (() => {
                    const opt = getClientSegmentOption(c.client_segment);
                    return lang === 'fr' ? opt.labelFr : opt.labelAr;
                  })()
                : '';

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setArchiveTab('bookings');
                    setConfirmDeleteId(null);
                  }}
                  className={`group rounded-2xl border bg-white transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                      : 'border-steel-200 hover:border-primary/70 hover:shadow-md shadow-xs'
                  }`}
                >
                  {/* Top Accent Strip */}
                  <div
                    className={`h-1.5 w-full ${
                      c.activeCount > 0
                        ? 'bg-primary'
                        : hasDue
                        ? 'bg-rose-500'
                        : c.totalBilled > 0
                        ? 'bg-emerald-500'
                        : 'bg-steel-200'
                    }`}
                  />

                  <div className="p-4 space-y-3.5">
                    {/* Card Identity Row */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        {c.avatar_url ? (
                          <img
                            src={c.avatar_url}
                            alt={c.name}
                            className="w-11 h-11 rounded-2xl object-cover border border-primary/50 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-ink text-primary font-black flex items-center justify-center shrink-0 text-sm shadow-xs">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-black text-sm text-ink truncate max-w-[180px]">
                              {c.name}
                            </h3>
                            {c.linkedProfileId && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-black">
                                {lang === 'fr' ? 'Vérifié' : 'حساب بالمنصة'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-[11px] text-steel-500 mt-1 flex-wrap">
                            {c.phone && (
                              <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                                <Phone className="w-3 h-3 text-primary-dark" />
                                {c.phone}
                              </span>
                            )}
                            {cityLabel && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-steel-400" />
                                {cityLabel}
                              </span>
                            )}
                          </div>

                          {(c.cin_or_ice || segLabel) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {segLabel && (
                                <span className="px-1.5 py-0.5 rounded bg-steel-100 text-steel-600 text-[10px] font-bold">
                                  {segLabel}
                                </span>
                              )}
                              {c.cin_or_ice && (
                                <span className="px-1.5 py-0.5 rounded bg-steel-100 text-steel-700 font-mono text-[10px] font-bold">
                                  ICE/CIN: {c.cin_or_ice}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Status Pill */}
                      <div className="shrink-0">
                        {c.activeCount > 0 ? (
                          <Badge variant="warning" className="text-[10px] font-black">
                            {lang === 'fr'
                              ? `${c.activeCount} active`
                              : `${c.activeCount} جاري`}
                          </Badge>
                        ) : hasDue ? (
                          <Badge variant="danger" className="text-[10px] font-black">
                            {lang === 'fr' ? 'Solde dû' : 'ذمة مالية'}
                          </Badge>
                        ) : c.totalBilled > 0 ? (
                          <Badge variant="success" className="text-[10px] font-black">
                            {lang === 'fr' ? 'Soldé' : 'خالص 100%'}
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">
                            {lang === 'fr' ? 'Répertoire' : 'بالدليل'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 3-Column Financial Mini Stats */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-surface border border-steel-200/80 text-center">
                      <div>
                        <span className="text-[10px] text-steel-400 block font-bold">
                          {lang === 'fr' ? 'Opérations' : 'المعاملات'}
                        </span>
                        <span className="font-mono font-black text-xs text-ink tabular-nums">
                          {c.bookings.length}
                        </span>
                      </div>
                      <div className="border-x border-steel-200 px-1">
                        <span className="text-[10px] text-steel-400 block font-bold">
                          {lang === 'fr' ? 'Total' : 'الإجمالي'}
                        </span>
                        <span className="font-mono font-black text-xs text-ink tabular-nums">
                          {c.totalBilled.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-steel-400 block font-bold">
                          {lang === 'fr' ? 'Reste dû' : 'المتبقي'}
                        </span>
                        <span
                          className={`font-mono font-black text-xs tabular-nums ${
                            hasDue ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {c.unpaidBalance.toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>

                    {/* Latest Transaction Preview */}
                    {lastBooking ? (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-steel-600 bg-amber-50/50 border border-amber-200/60 rounded-xl px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Truck className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                          <span className="truncate font-bold text-ink">
                            {lastMachineName || (lang === 'fr' ? 'Engin' : 'آلية')}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-steel-500 shrink-0" dir="ltr">
                          {(lastBooking.start_at || lastBooking.created_at || '').slice(0, 10)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-steel-400 bg-steel-50 rounded-xl px-2.5 py-1.5 text-center">
                        {lang === 'fr'
                          ? 'Aucune location enregistrée encore'
                          : 'لا توجد عمليات كراء مسجلة بعد'}
                      </div>
                    )}

                    {/* Quick Card Footer */}
                    <div
                      className="flex items-center justify-between gap-2 pt-2 border-t border-steel-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        {c.phone && (
                          <>
                            <a
                              href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                            <a
                              href={`tel:${c.phone}`}
                              className="p-1.5 rounded-lg text-steel-600 hover:bg-steel-100 transition-colors"
                              title={lang === 'fr' ? 'Appeler' : 'اتصال'}
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          </>
                        )}
                        {c.linkedProfileId && (
                          <button
                            type="button"
                            onClick={() => navigate(`/owner/messages?target=${c.linkedProfileId}`)}
                            className="p-1.5 rounded-lg text-primary-dark hover:bg-amber-50 transition-colors cursor-pointer"
                            title={lang === 'fr' ? 'Message plateforme' : 'محادثة داخل المنصة'}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditOrPromoteModal(c)}
                          className="p-1.5 rounded-lg text-steel-500 hover:text-ink hover:bg-steel-100 transition-colors cursor-pointer"
                          title={
                            c.isSavedInDirectory
                              ? lang === 'fr'
                                ? 'Modifier'
                                : 'تعديل'
                              : lang === 'fr'
                              ? 'Enregistrer au répertoire'
                              : 'حفظ في الدليل'
                          }
                        >
                          {c.isSavedInDirectory ? (
                            <Edit2 className="w-4 h-4" />
                          ) : (
                            <BookmarkPlus className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setArchiveTab('bookings');
                          setConfirmDeleteId(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-black text-primary-dark group-hover:text-ink cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Voir l’archive' : 'أرشيف المعاملات'}</span>
                        {isRTL ? (
                          <ArrowLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Client Detail & Complete Transactions Archive Panel */}
          {selectedClient && (
            <div className="lg:col-span-7 sticky top-20 space-y-4">
              {/* Mobile Back Button */}
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-steel-200 text-xs font-black text-ink shadow-xs cursor-pointer"
              >
                {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{lang === 'fr' ? 'Retour à la liste des clients' : 'العودة إلى بطاقات الزبناء'}</span>
              </button>

              <Card className="bg-white border border-steel-200 shadow-elevated rounded-3xl overflow-hidden">
                {/* Dark Executive Header */}
                <div className="bg-ink text-white p-5 border-b-2 border-primary space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {selectedClient.avatar_url ? (
                        <img
                          src={selectedClient.avatar_url}
                          alt={selectedClient.name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-primary shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-primary text-ink font-black flex items-center justify-center text-base shrink-0">
                          {selectedClient.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-white truncate">
                            {selectedClient.name}
                          </h2>
                          {selectedClient.isSavedInDirectory ? (
                            <span className="px-2 py-0.5 rounded-full bg-white/15 text-primary text-[10px] font-bold">
                              {lang === 'fr' ? 'Dans le répertoire' : 'محفوظ بالدليل'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[10px] font-bold">
                              {lang === 'fr' ? 'Issu des réservations' : 'مُضاف تلقائياً من الحجوزات'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-steel-300 mt-1 flex-wrap">
                          {selectedClient.phone && (
                            <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              {selectedClient.phone}
                            </span>
                          )}
                          {selectedClient.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              {formatCity(selectedClient.city)}
                            </span>
                          )}
                          {selectedClient.cin_or_ice && (
                            <span className="inline-flex items-center gap-1 font-mono text-amber-200">
                              ICE/CIN: {selectedClient.cin_or_ice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedClientId(null)}
                      className="hidden lg:flex p-1.5 rounded-xl bg-white/10 text-steel-300 hover:text-white hover:bg-white/20 cursor-pointer shrink-0"
                      aria-label={t('common.close')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Communication & Directory Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedClient.unpaidBalance > 0 && selectedClient.phone && (
                      <a
                        href={paymentService.buildWhatsAppReminderUrl({
                          clientPhone: selectedClient.phone,
                          clientName: selectedClient.name,
                          machineName:
                            selectedClient.bookings[0]?.machine?.title_ar ||
                            selectedClient.bookings[0]?.machine?.title_fr ||
                            (lang === 'fr' ? 'Location d’engin' : 'كراء آليات'),
                          totalAmount: selectedClient.totalBilled,
                          balanceDue: selectedClient.unpaidBalance,
                          ownerCompanyName:
                            businessProfile?.company_name ||
                            profile?.company_name ||
                            profile?.full_name ||
                            'JADIJCB',
                          rib: businessProfile?.rib,
                          lang,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'fr' ? 'Rappel solde WhatsApp' : 'تذكير بالمستحقات واتساب'}
                        </span>
                      </a>
                    )}

                    {selectedClient.phone && (
                      <>
                        <a
                          href={`https://wa.me/${selectedClient.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`tel:${selectedClient.phone}`}
                          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                        </a>
                      </>
                    )}

                    {selectedClient.linkedProfileId && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/owner/messages?target=${selectedClient.linkedProfileId}`)
                        }
                        className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Discuter' : 'مراسلة بالمنصة'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditOrPromoteModal(selectedClient)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {selectedClient.isSavedInDirectory ? (
                        <>
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Modifier' : 'تعديل'}</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {lang === 'fr' ? 'Enregistrer ICE & Notes' : 'تثبيت بالدليل وإضافة ICE'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Financial KPIs & Collection Progress */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-surface border border-steel-200">
                      <span className="text-[10px] text-steel-400 font-bold block">
                        {lang === 'fr' ? 'Total opérations' : 'عدد المعاملات'}
                      </span>
                      <span className="font-mono font-black text-sm text-ink mt-0.5 block">
                        {selectedClient.bookings.length}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-surface border border-steel-200">
                      <span className="text-[10px] text-steel-400 font-bold block">
                        {lang === 'fr' ? 'Total facturé' : 'المبلغ المفوتر'}
                      </span>
                      <span className="font-mono font-black text-sm text-ink mt-0.5 block">
                        {selectedClient.totalBilled.toLocaleString('fr-FR')} MAD
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        {lang === 'fr' ? 'Total payé' : 'المدفوع فعلياً'}
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-700 mt-0.5 block">
                        {selectedClient.totalPaid.toLocaleString('fr-FR')} MAD
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border ${
                        selectedClient.unpaidBalance > 0
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-emerald-50/40 border-emerald-200'
                      }`}
                    >
                      <span className="text-[10px] text-steel-500 font-bold block">
                        {lang === 'fr' ? 'Solde restant' : 'المتبقي بالذمة'}
                      </span>
                      <span
                        className={`font-mono font-black text-sm mt-0.5 block ${
                          selectedClient.unpaidBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {selectedClient.unpaidBalance.toLocaleString('fr-FR')} MAD
                      </span>
                    </div>
                  </div>

                  {/* Collection Progress Bar */}
                  {selectedClient.totalBilled > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-steel-500">
                          {lang === 'fr' ? 'Taux d’encaissement' : 'نسبة التحصيل من الزبون'}
                        </span>
                        <span className="font-mono text-ink">
                          {Math.min(
                            100,
                            Math.round((selectedClient.totalPaid / selectedClient.totalBilled) * 100)
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-steel-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            selectedClient.unpaidBalance === 0 ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (selectedClient.totalPaid / selectedClient.totalBilled) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedClient.notes && (
                    <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                      <span className="font-black text-[10px] uppercase text-amber-800 block mb-0.5">
                        {lang === 'fr' ? 'Notes internes' : 'ملاحظات خاصة عن الزبون:'}
                      </span>
                      <p className="leading-relaxed">{selectedClient.notes}</p>
                    </div>
                  )}

                  {/* Archive Sub-Tabs */}
                  <div className="flex items-center gap-2 border-b border-steel-200 pt-1 overflow-x-auto">
                    {(
                      [
                        {
                          id: 'bookings',
                          icon: <Calendar className="w-3.5 h-3.5" />,
                          label: lang === 'fr' ? 'Locations' : 'أرشيف عمليات الكراء',
                          count: selectedClient.bookings.length,
                        },
                        {
                          id: 'payments',
                          icon: <CreditCard className="w-3.5 h-3.5" />,
                          label: lang === 'fr' ? 'Paiements' : 'سجل الأداءات والدفعات',
                          count: selectedClient.payments.length,
                        },
                        {
                          id: 'documents',
                          icon: <FileText className="w-3.5 h-3.5" />,
                          label: lang === 'fr' ? 'Documents' : 'العقود والفواتير',
                          count: selectedClient.documents.length,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setArchiveTab(tab.id)}
                        className={`px-3 py-2.5 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          archiveTab === tab.id
                            ? 'border-primary text-ink'
                            : 'border-transparent text-steel-400 hover:text-ink'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            archiveTab === tab.id
                              ? 'bg-primary text-ink'
                              : 'bg-steel-100 text-steel-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: Bookings / Rentals Archive */}
                  {archiveTab === 'bookings' && (
                    <div className="space-y-3 max-h-[540px] overflow-y-auto pe-1">
                      {selectedClient.bookings.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-surface border border-steel-200 text-xs text-steel-500">
                          {lang === 'fr'
                            ? 'Aucune opération de location enregistrée pour ce client.'
                            : 'لا توجد عمليات كراء مسجلة لهذا الزبون حتى الآن.'}
                        </div>
                      ) : (
                        selectedClient.bookings.map((b) => {
                          const statusBadge = getBookingStatusBadge(b.status);
                          const stats = paymentService.computeBookingPaymentStats(
                            b,
                            selectedClient.payments
                          );
                          const paidAmount = Math.max(stats.paidAmount, Number(b.paid_amount) || 0);
                          const totalPrice = Number(b.total_price) || 0;
                          const balanceDue =
                            b.status === 'cancelled' ? 0 : Math.max(0, totalPrice - paidAmount);
                          const machineTitle =
                            (lang === 'fr' ? b.machine?.title_fr : b.machine?.title_ar) ||
                            b.machine?.title_ar ||
                            b.machine?.title_fr ||
                            (lang === 'fr' ? 'Engin de chantier' : 'آلية أشغال عمومية');

                          const hasContract = selectedClient.documents.some(
                            (d) => d.booking_id === b.id && d.type === 'contract'
                          );
                          const hasInvoice = selectedClient.documents.some(
                            (d) => d.booking_id === b.id && d.type === 'invoice'
                          );
                          const hasReceipt = selectedClient.documents.some(
                            (d) => d.booking_id === b.id && d.type === 'receipt'
                          );

                          return (
                            <div
                              key={b.id}
                              className="p-3.5 rounded-2xl border border-steel-200 bg-surface/60 hover:bg-white transition-all space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <MachineHoverThumbnail
                                    machine={b.machine}
                                    machines={machines}
                                    machineId={b.machine_id}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-black text-xs sm:text-sm text-ink truncate">
                                        {machineTitle}
                                      </h4>
                                      <Badge variant={statusBadge.variant} className="text-[10px]">
                                        {statusBadge.label}
                                      </Badge>
                                      {b.pause_state?.is_paused && (
                                        <Badge variant="warning" className="text-[10px]">
                                          {lang === 'fr' ? 'En pause' : 'متوقف مؤقتاً'}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] text-steel-500 mt-1 flex-wrap">
                                      <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                                        <Clock className="w-3 h-3 text-steel-400" />
                                        {(b.start_at || '').slice(0, 10)} → {(b.end_at || '').slice(0, 10)}
                                      </span>
                                      {b.site_city_id && (
                                        <span className="inline-flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-steel-400" />
                                          {formatCity(b.site_city_id)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px]">
                                      <span className="px-2 py-0.5 rounded-md bg-white border border-steel-200 font-bold text-steel-600">
                                        {b.with_operator
                                          ? lang === 'fr'
                                            ? 'Avec chauffeur'
                                            : 'مع سائق'
                                          : lang === 'fr'
                                          ? 'Sans chauffeur'
                                          : 'بدون سائق'}
                                      </span>
                                      {b.deposit_amount ? (
                                        <span className="px-2 py-0.5 rounded-md bg-white border border-steel-200 font-mono font-bold text-steel-600">
                                          {lang === 'fr' ? 'Caution :' : 'ضمانة:'}{' '}
                                          {Number(b.deposit_amount).toLocaleString('fr-FR')} MAD
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {/* Financial Box */}
                                <div className="bg-white rounded-xl border border-steel-200 px-3 py-2 text-start sm:text-end shrink-0 space-y-0.5">
                                  <div className="text-xs font-black font-mono text-ink">
                                    {totalPrice.toLocaleString('fr-FR')} MAD
                                  </div>
                                  <div className="text-[10px] font-mono text-emerald-700 font-bold">
                                    {lang === 'fr' ? 'Payé :' : 'المدفوع:'}{' '}
                                    {paidAmount.toLocaleString('fr-FR')} MAD
                                  </div>
                                  {b.status !== 'cancelled' && (
                                    <div
                                      className={`text-[10px] font-mono font-black ${
                                        balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                                      }`}
                                    >
                                      {balanceDue > 0
                                        ? `${lang === 'fr' ? 'Reste :' : 'المتبقي:'} ${balanceDue.toLocaleString(
                                            'fr-FR'
                                          )} MAD`
                                        : lang === 'fr'
                                        ? 'Soldé 100% ✓'
                                        : 'خالص 100% ✓'}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Transaction Action Row */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-steel-200/70 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {b.status !== 'cancelled' && balanceDue > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPaymentTarget({ booking: b, balanceDue })
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-primary text-ink hover:bg-primary-hover font-black text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <CreditCard className="w-3.5 h-3.5" />
                                      <span>
                                        {lang === 'fr' ? 'Enregistrer paiement' : 'تسجيل أداء'}
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={generatingDocKey === `${b.id}_contract`}
                                    onClick={() => handleGenerateOrOpenDoc(b, 'contract')}
                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                      hasContract
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                        : 'bg-white border-steel-200 text-steel-700 hover:bg-steel-100'
                                    }`}
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>{lang === 'fr' ? 'Contrat' : 'عقد'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={generatingDocKey === `${b.id}_invoice`}
                                    onClick={() => handleGenerateOrOpenDoc(b, 'invoice')}
                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                      hasInvoice
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                        : 'bg-white border-steel-200 text-steel-700 hover:bg-steel-100'
                                    }`}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>{lang === 'fr' ? 'Facture' : 'فاتورة'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={generatingDocKey === `${b.id}_receipt`}
                                    onClick={() => handleGenerateOrOpenDoc(b, 'receipt')}
                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                      hasReceipt
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                        : 'bg-white border-steel-200 text-steel-700 hover:bg-steel-100'
                                    }`}
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>{lang === 'fr' ? 'Reçu' : 'وصل'}</span>
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => navigate('/owner/bookings')}
                                  className="text-[10px] font-bold text-steel-500 hover:text-ink underline cursor-pointer"
                                >
                                  {lang === 'fr' ? 'Gérer dans Réservations' : 'فتح في الحجوزات'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 2: Payments Ledger Archive */}
                  {archiveTab === 'payments' && (
                    <div className="space-y-2.5 max-h-[540px] overflow-y-auto pe-1">
                      {selectedClient.payments.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-surface border border-steel-200 text-xs text-steel-500 space-y-2">
                          <CreditCard className="w-8 h-8 mx-auto text-steel-300" />
                          <p>
                            {lang === 'fr'
                              ? 'Aucun versement enregistré pour ce client.'
                              : 'لم يتم تسجيل أي دفعة أو أداء لهذا الزبون حتى الآن.'}
                          </p>
                        </div>
                      ) : (
                        selectedClient.payments.map((p) => {
                          const linkedBooking = selectedClient.bookings.find(
                            (b) => b.id === p.booking_id
                          );
                          const mName =
                            (lang === 'fr'
                              ? linkedBooking?.machine?.title_fr
                              : linkedBooking?.machine?.title_ar) ||
                            linkedBooking?.machine?.title_ar ||
                            linkedBooking?.machine?.title_fr ||
                            (lang === 'fr' ? 'Location d’engin' : 'عملية كراء');

                          return (
                            <div
                              key={p.id}
                              className="p-3.5 rounded-2xl border border-steel-200 bg-white flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                  <Banknote className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-ink truncate">{mName}</span>
                                    <Badge variant="neutral" className="text-[10px]">
                                      {getMethodLabel(p.method)}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] text-steel-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span className="font-mono" dir="ltr">
                                      {p.payment_date || p.created_at?.slice(0, 10)}
                                    </span>
                                    {p.note && <span className="text-steel-600">· {p.note}</span>}
                                  </div>
                                </div>
                              </div>

                              <span className="font-mono font-black text-sm text-emerald-700 shrink-0" dir="ltr">
                                +{Number(p.amount).toLocaleString('fr-FR')} MAD
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 3: Official Documents Archive */}
                  {archiveTab === 'documents' && (
                    <div className="space-y-2.5 max-h-[540px] overflow-y-auto pe-1">
                      {selectedClient.documents.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-surface border border-steel-200 text-xs text-steel-500 space-y-2">
                          <FileText className="w-8 h-8 mx-auto text-steel-300" />
                          <p>
                            {lang === 'fr'
                              ? 'Aucun contrat, facture ou reçu généré pour ce client. Générez-en depuis l’onglet Locations.'
                              : 'لا توجد وثائق مُصدَرة بعد لهذا الزبون. يمكنك توليد عقد أو فاتورة أو وصل مباشرة من تبويب «أرشيف عمليات الكراء».'}
                          </p>
                        </div>
                      ) : (
                        selectedClient.documents.map((doc) => {
                          const shareUrl = documentService.buildDocumentShareUrl(doc.id);
                          const machineTitle =
                            (lang === 'fr'
                              ? doc.data?.machine?.title_fr
                              : doc.data?.machine?.title_ar) ||
                            doc.data?.machine?.title_ar ||
                            doc.data?.machine?.title_fr ||
                            'JADIJCB';
                          const totalDoc = Number(doc.data?.booking?.total_price || 0);

                          return (
                            <div
                              key={doc.id}
                              className="p-3.5 rounded-2xl border border-steel-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-primary-dark flex items-center justify-center shrink-0">
                                  <FileCheck className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-ink">
                                      {getDocTypeLabel(doc.type)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-ink text-primary font-mono text-[10px] font-black">
                                      {doc.number}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-steel-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-steel-700 truncate">
                                      {machineTitle}
                                    </span>
                                    <span className="font-mono" dir="ltr">
                                      · {(doc.issued_at || doc.created_at || '').slice(0, 10)}
                                    </span>
                                    {totalDoc > 0 && (
                                      <span className="font-mono font-bold text-ink">
                                        · {totalDoc.toLocaleString('fr-FR')} MAD
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/owner/documents/${doc.id}`)}
                                  className="px-3 py-1.5 rounded-xl bg-ink text-primary hover:bg-steel-900 font-black text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>{lang === 'fr' ? 'Ouvrir / PDF' : 'فتح وطباعة'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(shareUrl);
                                      toast.success(
                                        lang === 'fr' ? 'Lien copié !' : 'تم نسخ رابط الوثيقة!'
                                      );
                                    } catch {
                                      toast.info(shareUrl);
                                    }
                                  }}
                                  className="p-2 rounded-xl border border-steel-200 text-steel-600 hover:text-ink hover:bg-steel-100 cursor-pointer"
                                  title={lang === 'fr' ? 'Copier le lien' : 'نسخ رابط الوثيقة'}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Footer Delete / Edit Strip for Saved Directory Entries */}
                  {selectedClient.isSavedInDirectory && selectedClient.savedClientId && (
                    <div className="pt-3 border-t border-steel-100 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEditOrPromoteModal(selectedClient)}
                        className="font-bold text-steel-600 hover:text-ink inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Modifier la fiche client' : 'تعديل بطاقة الزبون'}</span>
                      </button>

                      {confirmDeleteId === selectedClient.savedClientId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-rose-700">
                            {lang === 'fr' ? 'Confirmer suppression ?' : 'تأكيد الحذف من الدليل؟'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteClient(selectedClient.savedClientId!)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-[11px] cursor-pointer"
                          >
                            {lang === 'fr' ? 'Oui' : 'نعم'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded-lg bg-steel-100 text-steel-700 font-bold text-[11px] cursor-pointer"
                          >
                            {lang === 'fr' ? 'Non' : 'إلغاء'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedClient.savedClientId!)}
                          className="font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Supprimer du répertoire' : 'حذف من الدليل'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit / Save Client Modal */}
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
                    ? 'Enregistrer le client dans le répertoire'
                    : 'حفظ / إضافة زبون في الدليل'}
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
                    ? 'Enregistrer le client'
                    : 'حفظ الزبون'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Record Payment Modal */}
      {paymentTarget && (
        <RecordPaymentModal
          isOpen={Boolean(paymentTarget)}
          onClose={() => setPaymentTarget(null)}
          booking={paymentTarget.booking}
          balanceDue={paymentTarget.balanceDue}
          onPaymentRecorded={() => {
            setPaymentTarget(null);
            loadData(true);
          }}
        />
      )}
    </div>
  );
};

export default ClientsPage;
