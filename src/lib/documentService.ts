// ============================================================================
// JADIJCB: Documents Engine Service (عقود الكراء، الفواتير ووصولات التسليم)
// Immutable Snapshots, Sequential Numbering (CT-2026-0001, FA-2026-0001, RC-2026-0001)
// Activation tracking on profile upon first document generation
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { DocumentRecord, DocumentType, Booking, BusinessProfile, UserProfile } from '../types/database';

const LOCAL_DOCS_KEY = 'jadijcb_documents';

export const documentService = {
  getLocalDocuments(ownerId?: string): DocumentRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_DOCS_KEY);
      if (raw) {
        const all: DocumentRecord[] = JSON.parse(raw);
        if (ownerId) return all.filter((d) => d.owner_id === ownerId);
        return all;
      }
    } catch {
      // Ignore
    }
    return [];
  },

  saveLocalDocuments(docs: DocumentRecord[]) {
    try {
      localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
      window.dispatchEvent(new CustomEvent('jadijcb_documents_updated', { detail: docs }));
    } catch {
      // Ignore
    }
  },

  async getDocumentsForOwner(ownerId: string): Promise<DocumentRecord[]> {
    let docs = this.getLocalDocuments(ownerId);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('owner_id', ownerId)
          .order('issued_at', { ascending: false });

        if (!error && data) {
          const dbDocs: DocumentRecord[] = data.map((d: any) => ({
            id: d.id,
            owner_id: d.owner_id,
            booking_id: d.booking_id,
            type: d.type as DocumentType,
            number: d.number,
            issued_at: d.issued_at,
            data: d.data || {},
            created_at: d.created_at,
          }));

          const map = new Map<string, DocumentRecord>();
          for (const d of docs) map.set(d.id, d);
          for (const d of dbDocs) map.set(d.id, d);
          docs = Array.from(map.values());

          const otherDocs = this.getLocalDocuments().filter((d) => d.owner_id !== ownerId);
          this.saveLocalDocuments([...otherDocs, ...docs]);
        }
      } catch (err) {
        console.warn('Failed to load documents from DB:', err);
      }
    }

    return docs;
  },

  async getDocumentById(docId: string): Promise<DocumentRecord | null> {
    const all = this.getLocalDocuments();
    const found = all.find((d) => d.id === docId);
    if (found) return found;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            owner_id: data.owner_id,
            booking_id: data.booking_id,
            type: data.type as DocumentType,
            number: data.number,
            issued_at: data.issued_at,
            data: data.data || {},
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.warn('getDocumentById error:', err);
      }
    }

    return null;
  },

  getNextSequenceNumber(type: DocumentType, existingDocs: DocumentRecord[]): string {
    const year = new Date().getFullYear();
    const prefix = type === 'contract' ? 'CT' : type === 'invoice' ? 'FA' : 'RC';
    const regex = new RegExp(`^${prefix}-${year}-(\\d{4})$`);

    let maxNum = 0;
    for (const d of existingDocs) {
      if (d.type === type && d.number) {
        const match = d.number.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const next = maxNum + 1;
    return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
  },

  async generateDocument(params: {
    ownerId: string;
    booking: Booking;
    type: DocumentType;
    businessProfile: BusinessProfile;
    paidAmount?: number;
    balanceDue?: number;
    vatRate?: number; // e.g. 0.20
  }): Promise<{ success: boolean; document?: DocumentRecord; error?: string }> {
    const { ownerId, booking, type, businessProfile, paidAmount = 0, balanceDue = 0, vatRate = 0.20 } = params;

    // Check if an existing document of this type already exists for this booking
    const existingForOwner = await this.getDocumentsForOwner(ownerId);
    const existingDoc = existingForOwner.find((d) => d.booking_id === booking.id && d.type === type);
    if (existingDoc) {
      return { success: true, document: existingDoc };
    }

    const docNumber = this.getNextSequenceNumber(type, existingForOwner);
    const issuedAt = new Date().toISOString();

    const isVatEnabled = Boolean(businessProfile.vat_enabled);
    const totalTtc = Number(booking.total_price) || 0;
    const totalHt = isVatEnabled ? Math.round((totalTtc / (1 + vatRate)) * 100) / 100 : totalTtc;
    const vatAmount = isVatEnabled ? Math.round((totalTtc - totalHt) * 100) / 100 : 0;

    // Build immutable snapshot data
    const snapshotData = {
      documentNumber: docNumber,
      issuedAt,
      type,
      booking: {
        id: booking.id,
        start_at: booking.start_at || booking.start_date,
        end_at: booking.end_at || booking.end_date,
        total_price: totalTtc,
        total_ht: totalHt,
        vat_amount: vatAmount,
        vat_enabled: isVatEnabled,
        vat_rate_percent: isVatEnabled ? 20 : 0,
        deposit_amount: Number(booking.deposit_amount) || 0,
        rate_type: booking.rate_type || booking.rental_term || 'daily',
        with_operator: Boolean(booking.with_operator),
        fuel_included: Boolean(booking.fuel_included),
        delivery_fee: Number(booking.delivery_fee) || 0,
        notes: booking.notes || '',
        paid_amount: paidAmount,
        balance_due: balanceDue,
      },
      client: {
        name: booking.client_name || 'الزبون المكتري',
        phone: booking.client_phone || '',
        cin_or_ice: (booking.renter as any)?.ice_number || (booking.renter as any)?.cin || '',
        city: booking.site_city_id || (booking.renter as any)?.city || 'Casablanca',
        address: booking.site_address || '',
      },
      machine: {
        id: booking.machine?.id || booking.machine_id,
        title_ar: booking.machine?.title_ar || 'آلية أشغال عمومية',
        title_fr: booking.machine?.title_fr || 'Engin de chantier',
        brand: booking.machine?.brand || '',
        model: booking.machine?.model || '',
        year: booking.machine?.year || new Date().getFullYear(),
        specs: booking.machine?.specs || {},
      },
      owner: {
        company_name: businessProfile.company_name || 'مقاولة تأجير الآليات',
        logo_url: businessProfile.logo_url || '',
        stamp_signature_url: businessProfile.stamp_signature_url || '',
        ice: businessProfile.ice || '',
        rc: businessProfile.rc || '',
        identifiant_fiscal: businessProfile.identifiant_fiscal || '',
        taxe_professionnelle: businessProfile.taxe_professionnelle || '',
        address: businessProfile.address || '',
        phone: businessProfile.phone || '',
        rib: businessProfile.rib || '',
        default_terms_ar: businessProfile.default_terms_ar || '',
        default_terms_fr: businessProfile.default_terms_fr || '',
      },
    };

    const newDoc: DocumentRecord = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      booking_id: booking.id,
      type,
      number: docNumber,
      issued_at: issuedAt,
      data: snapshotData,
      created_at: issuedAt,
    };

    const all = this.getLocalDocuments();
    this.saveLocalDocuments([newDoc, ...all]);

    // Save to DB
    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .insert({
            id: newDoc.id,
            owner_id: ownerId,
            booking_id: newDoc.booking_id,
            type: newDoc.type,
            number: newDoc.number,
            issued_at: newDoc.issued_at,
            data: newDoc.data,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('DB documents insert warning:', error.message);
        } else if (data) {
          newDoc.id = data.id;
        }

        // Track activation_at on owner profile upon generating first document
        const isFirstDoc = existingForOwner.length === 0;
        if (isFirstDoc) {
          try {
            await supabase
              .from('profiles')
              .update({ activation_at: new Date().toISOString() })
              .eq('id', ownerId)
              .is('activation_at', null);
            window.dispatchEvent(new CustomEvent('jadijcb_owner_activated', { detail: { ownerId } }));
          } catch (e) {
            console.warn('Activation tracking notice:', e);
          }
        }
      } catch (err) {
        console.warn('generateDocument DB error:', err);
      }
    }

    return { success: true, document: newDoc };
  },

  buildDocumentShareUrl(docId: string): string {
    return `${window.location.origin}/owner/documents/${docId}`;
  },

  async shareDocument(doc: DocumentRecord, lang: 'ar' | 'fr') {
    const shareUrl = this.buildDocumentShareUrl(doc.id);
    const typeLabel =
      doc.type === 'contract'
        ? lang === 'fr' ? 'Contrat de location' : 'عقد كراء آلية'
        : doc.type === 'invoice'
        ? lang === 'fr' ? 'Facture' : 'فاتورة كراء'
        : lang === 'fr' ? 'Reçu' : 'وصل استلام وأداء';

    const clientName = doc.data?.client?.name || '';
    const docNumber = doc.number;
    const company = doc.data?.owner?.company_name || '';

    const shareTitle = `${typeLabel} ${docNumber} - ${company}`;
    const shareText =
      lang === 'fr'
        ? `Bonjour ${clientName}, voici votre ${typeLabel} N° ${docNumber} établi par ${company} :`
        : `السلام عليكم ${clientName}، إليكم ${typeLabel} رقم ${docNumber} الصادر عن ${company} :`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return { success: true };
      } catch {
        // User cancelled or fallback
      }
    }

    // WhatsApp fallback
    const clientPhone = (doc.data?.client?.phone || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/${clientPhone}?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(waUrl, '_blank');
    return { success: true };
  },
};
