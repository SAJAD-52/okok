// ============================================================================
// JADIJCB: Booking Payments & Dues Service (الأداءات، المستحقات والتذكير)
// Supports Partial Payments, Multiple Methods, Paid/Remaining Balances & WhatsApp
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { BookingPayment, PaymentMethodType, Booking } from '../types/database';

const LOCAL_PAYMENTS_KEY = 'jadijcb_booking_payments';

export const paymentService = {
  getLocalPayments(ownerId?: string): BookingPayment[] {
    try {
      const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
      if (raw) {
        const all: BookingPayment[] = JSON.parse(raw);
        if (ownerId) return all.filter((p) => p.owner_id === ownerId);
        return all;
      }
    } catch {
      // Ignore
    }
    return [];
  },

  saveLocalPayments(payments: BookingPayment[]) {
    try {
      localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
      window.dispatchEvent(new CustomEvent('jadijcb_payments_updated', { detail: payments }));
    } catch {
      // Ignore
    }
  },

  async getPaymentsForOwner(ownerId: string): Promise<BookingPayment[]> {
    let payments = this.getLocalPayments(ownerId);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('booking_payments')
          .select('*')
          .eq('owner_id', ownerId)
          .order('payment_date', { ascending: false });

        if (!error && data) {
          const dbPayments: BookingPayment[] = data.map((p: any) => ({
            id: p.id,
            booking_id: p.booking_id,
            owner_id: p.owner_id,
            amount: Number(p.amount) || 0,
            method: p.method as PaymentMethodType,
            payment_date: p.payment_date,
            note: p.note || '',
            created_at: p.created_at,
          }));

          const map = new Map<string, BookingPayment>();
          for (const p of payments) map.set(p.id, p);
          for (const p of dbPayments) map.set(p.id, p);
          payments = Array.from(map.values());

          // Update storage with all
          const allOther = this.getLocalPayments().filter((p) => p.owner_id !== ownerId);
          this.saveLocalPayments([...allOther, ...payments]);
        }
      } catch (err) {
        console.warn('Failed to load booking payments from DB:', err);
      }
    }

    return payments;
  },

  async recordPayment(
    paymentData: Omit<BookingPayment, 'id' | 'created_at'>
  ): Promise<{ success: boolean; payment?: BookingPayment; error?: string }> {
    const newPayment: BookingPayment = {
      id: crypto.randomUUID(),
      booking_id: paymentData.booking_id,
      owner_id: paymentData.owner_id,
      amount: Number(paymentData.amount) || 0,
      method: paymentData.method || 'cash',
      payment_date: paymentData.payment_date || new Date().toISOString().slice(0, 10),
      note: paymentData.note?.trim() || '',
      created_at: new Date().toISOString(),
    };

    const all = this.getLocalPayments();
    this.saveLocalPayments([newPayment, ...all]);

    if (isSupabaseConfigured && paymentData.owner_id) {
      try {
        const { data, error } = await supabase
          .from('booking_payments')
          .insert({
            id: newPayment.id,
            booking_id: newPayment.booking_id,
            owner_id: newPayment.owner_id,
            amount: newPayment.amount,
            method: newPayment.method,
            payment_date: newPayment.payment_date,
            note: newPayment.note,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('DB recordPayment notice:', error.message);
        } else if (data) {
          newPayment.id = data.id;
        }
      } catch (err) {
        console.warn('recordPayment DB error:', err);
      }
    }

    return { success: true, payment: newPayment };
  },

  computeBookingPaymentStats(booking: Booking, payments: BookingPayment[]) {
    const bookingPayments = payments.filter((p) => p.booking_id === booking.id);
    const paidAmount = bookingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(booking.total_price) || 0;
    const balanceDue = Math.max(0, total - paidAmount);

    let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
    if (paidAmount >= total && total > 0) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    }

    return {
      paidAmount,
      balanceDue,
      status,
      paymentsCount: bookingPayments.length,
      payments: bookingPayments,
    };
  },

  buildWhatsAppReminderUrl(params: {
    clientPhone: string;
    clientName: string;
    machineName: string;
    totalAmount: number;
    balanceDue: number;
    ownerCompanyName: string;
    rib?: string;
    lang: 'ar' | 'fr';
  }): string {
    const { clientPhone, clientName, machineName, totalAmount, balanceDue, ownerCompanyName, rib, lang } = params;
    const cleanPhone = clientPhone.replace(/\D/g, '');

    const formattedTotal = totalAmount.toLocaleString('fr-FR');
    const formattedDue = balanceDue.toLocaleString('fr-FR');

    let text = '';
    if (lang === 'fr') {
      text = `Bonjour ${clientName},\n\nNous vous rappelons le solde restant concernant la location de l'engin *${machineName}* auprès de *${ownerCompanyName}*.\n\n• Montant total : ${formattedTotal} MAD\n• Solde restant à régler : *${formattedDue} MAD*${rib ? `\n• RIB pour virement : ${rib}` : ''}\n\nMerci de bien vouloir procéder au règlement dans les meilleurs délais.\nCordialement.`;
    } else {
      text = `السلام عليكم ورحمة الله، السيد ${clientName}،\n\nنود تذكيركم بخصوص المستحقات المتبقية عن كراء الآلية: *${machineName}* لدى مقاولة *${ownerCompanyName}*.\n\n• إجمالي مبلغ الكراء: ${formattedTotal} درهم\n• المبلغ المتبقي الواجب أداؤه: *${formattedDue} درهم*${rib ? `\n• رقم الحساب البنكي (RIB): ${rib}` : ''}\n\nنرجو التفضل بتسوية الرصيد المتبقي في أقرب وقت.\nوتقبلوا فائق التقدير والاحترام.`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  },
};
