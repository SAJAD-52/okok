// ============================================================================
// JADIJCB: Machine Breakdown / Fault Reporting Service (During Active Rental)
// Handles dual persistence (bookings.breakdowns JSONB + structured notes tag
// fallback), instant owner notifications, chat alerts, and fault resolution.
// ============================================================================

import {
  Booking,
  BookingBreakdownReport,
  BreakdownCategory,
  BreakdownSeverity,
} from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';
import { bookingStore } from './bookingStore';

const FAULT_TAG_PREFIX = '[JADIJCB_FAULT:';
const FAULT_TAG_REGEX = /^\[JADIJCB_FAULT:(\{.*\})\]$/;

export interface BreakdownCategoryMeta {
  id: BreakdownCategory;
  labelAr: string;
  labelFr: string;
}

export const BREAKDOWN_CATEGORIES: BreakdownCategoryMeta[] = [
  { id: 'hydraulic', labelAr: 'عطل هيدروليكي', labelFr: 'Panne hydraulique' },
  { id: 'engine', labelAr: 'عطل في المحرك', labelFr: 'Panne moteur' },
  { id: 'electrical', labelAr: 'عطل كهربائي', labelFr: 'Panne électrique' },
  { id: 'fuel_leak', labelAr: 'تسرب زيت أو وقود', labelFr: 'Fuite d’huile / carburant' },
  { id: 'tire_track', labelAr: 'ثقب إطار أو جنزير', labelFr: 'Crevaison / chenille' },
  { id: 'other', labelAr: 'عطل ميكانيكي آخر', labelFr: 'Autre anomalie' },
];

export interface BreakdownSeverityMeta {
  id: BreakdownSeverity;
  labelAr: string;
  labelFr: string;
  hintAr: string;
  hintFr: string;
}

export const BREAKDOWN_SEVERITIES: BreakdownSeverityMeta[] = [
  {
    id: 'critical',
    labelAr: 'عاجل — الآلية متوقفة',
    labelFr: 'Urgent — Engin à l’arrêt',
    hintAr: 'الآلية توقفت كلياً عن العمل في الورش',
    hintFr: 'Travail interrompu sur chantier',
  },
  {
    id: 'moderate',
    labelAr: 'متوسط — تحتاج فحصاً',
    labelFr: 'Modéré — Contrôle requis',
    hintAr: 'الآلية ما زالت تعمل ولكن بها خلل واضح',
    hintFr: 'Fonctionne avec anomalie visible',
  },
  {
    id: 'minor',
    labelAr: 'بسيط — ملاحظة صيانة',
    labelFr: 'Mineur — Entretien à prévoir',
    hintAr: 'لا يعيق العمل حالياً لكنه يستلزم الانتباه',
    hintFr: 'N’empêche pas l’activité',
  },
];

export function getBreakdownCategoryLabel(category: BreakdownCategory, lang: 'ar' | 'fr' | string): string {
  const found = BREAKDOWN_CATEGORIES.find((c) => c.id === category);
  if (!found) return lang === 'fr' ? 'Panne technique' : 'عطل تقني';
  return lang === 'fr' ? found.labelFr : found.labelAr;
}

export function getBreakdownSeverityLabel(severity: BreakdownSeverity, lang: 'ar' | 'fr' | string): string {
  const found = BREAKDOWN_SEVERITIES.find((s) => s.id === severity);
  if (!found) return lang === 'fr' ? 'Modéré' : 'متوسط';
  return lang === 'fr' ? found.labelFr : found.labelAr;
}

/**
 * Extracts structured breakdown reports and clean human notes from a Booking.
 * Merges `booking.breakdowns` column and any `[JADIJCB_FAULT:...]` lines stored in `booking.notes`.
 */
export function extractBookingBreakdownsAndNotes(booking: Pick<Booking, 'notes' | 'breakdowns'>): {
  breakdowns: BookingBreakdownReport[];
  cleanNotes: string;
} {
  const byId = new Map<string, BookingBreakdownReport>();

  // 1. Read from dedicated breakdowns array if available
  if (Array.isArray(booking.breakdowns)) {
    for (const item of booking.breakdowns) {
      if (item && item.id) {
        byId.set(item.id, item);
      }
    }
  }

  // 2. Parse [JADIJCB_FAULT:{...}] lines from notes and strip them from cleanNotes
  const cleanLines: string[] = [];
  const rawNotes = String(booking.notes || '');
  for (const line of rawNotes.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(FAULT_TAG_REGEX);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]) as BookingBreakdownReport;
        if (parsed && parsed.id) {
          const existing = byId.get(parsed.id);
          if (!existing || (parsed.status === 'resolved' && existing.status !== 'resolved')) {
            byId.set(parsed.id, parsed);
          }
          continue;
        }
      } catch {
        // If malformed tag line, still keep cleanNotes safe
      }
    }
    if (trimmed.startsWith(FAULT_TAG_PREFIX)) continue;
    cleanLines.push(line);
  }

  const breakdowns = Array.from(byId.values()).sort(
    (a, b) => new Date(b.reported_at || 0).getTime() - new Date(a.reported_at || 0).getTime()
  );

  return {
    breakdowns,
    cleanNotes: cleanLines.join('\n').trim(),
  };
}

function buildUpdatedNotesWithBreakdowns(
  cleanNotes: string,
  breakdowns: BookingBreakdownReport[]
): string {
  const orderedOldestFirst = [...breakdowns].sort(
    (a, b) => new Date(a.reported_at || 0).getTime() - new Date(b.reported_at || 0).getTime()
  );
  const faultLines = orderedOldestFirst.map((rep) => `${FAULT_TAG_PREFIX}${JSON.stringify(rep)}]`);
  const parts = cleanNotes ? [cleanNotes, ...faultLines] : faultLines;
  return parts.join('\n');
}

export interface ReportBreakdownInput {
  booking: Booking;
  category: BreakdownCategory;
  severity: BreakdownSeverity;
  description: string;
  reporterId?: string;
  reporterName?: string;
}

export async function reportBookingBreakdown(input: ReportBreakdownInput): Promise<{
  success: boolean;
  report: BookingBreakdownReport;
  updatedBooking: Booking;
  error?: string;
}> {
  const { booking, category, severity, description, reporterId, reporterName } = input;
  const nowIso = new Date().toISOString();
  const catAr = getBreakdownCategoryLabel(category, 'ar');
  const catFr = getBreakdownCategoryLabel(category, 'fr');
  const sevAr = getBreakdownSeverityLabel(severity, 'ar');
  const sevFr = getBreakdownSeverityLabel(severity, 'fr');

  const report: BookingBreakdownReport = {
    id: `flt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category,
    severity,
    title: catAr,
    description: description.trim(),
    reported_by_id: reporterId,
    reported_by_name: reporterName || booking.client_name || 'الزبون',
    reported_at: nowIso,
    status: 'open',
  };

  const { breakdowns: existingBreakdowns, cleanNotes } = extractBookingBreakdownsAndNotes(booking);
  const nextBreakdowns = [report, ...existingBreakdowns];
  const nextNotes = buildUpdatedNotesWithBreakdowns(cleanNotes, nextBreakdowns);

  let persistedRemotely = false;
  let remoteErrorMsg: string | undefined;

  if (isSupabaseConfigured) {
    // 1a. Try updating both breakdowns JSONB column + notes
    try {
      const { data: updData, error: updErr } = await supabase
        .from('bookings')
        .update({
          notes: nextNotes,
          breakdowns: nextBreakdowns,
        })
        .eq('id', booking.id)
        .select('id')
        .maybeSingle();

      if (!updErr && updData) {
        persistedRemotely = true;
      } else if (updErr) {
        const msg = updErr.message || '';
        // 1b. If breakdowns column isn't migrated yet, update notes alone
        if (msg.toLowerCase().includes('breakdowns') || msg.toLowerCase().includes('column')) {
          const { data: notesData, error: notesErr } = await supabase
            .from('bookings')
            .update({ notes: nextNotes })
            .eq('id', booking.id)
            .select('id')
            .maybeSingle();
          if (!notesErr && notesData) {
            persistedRemotely = true;
          } else {
            remoteErrorMsg = notesErr?.message;
          }
        } else {
          remoteErrorMsg = msg;
        }
      }
    } catch (err: any) {
      remoteErrorMsg = err?.message;
    }

    // 1c. Fallback RPC for phone-matched bookings where client_id was NULL
    if (!persistedRemotely) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('report_booking_breakdown', {
          p_booking_id: booking.id,
          p_report: report,
          p_notes: nextNotes,
        });
        if (!rpcErr && rpcData) {
          persistedRemotely = true;
          remoteErrorMsg = undefined;
        }
      } catch {
        // Ignore if RPC not migrated yet
      }
    }

    // 2. Insert high-priority notification for the Owner immediately
    if (booking.owner_id) {
      const machineTitleAr =
        booking.machine?.title_ar ||
        booking.machine?.title_fr ||
        `${booking.machine?.brand || ''} ${booking.machine?.model || ''}`.trim() ||
        'الآلية المؤجرة';
      const machineTitleFr =
        booking.machine?.title_fr ||
        booking.machine?.title_ar ||
        `${booking.machine?.brand || ''} ${booking.machine?.model || ''}`.trim() ||
        'Engin loué';
      const clientLabel = reporterName || booking.client_name || 'الزبون';

      try {
        await supabase.from('notifications').insert({
          user_id: booking.owner_id,
          title_ar: `⚠️ بلاغ عطل: ${machineTitleAr}`,
          title_fr: `⚠️ Panne signalée : ${machineTitleFr}`,
          body_ar: `أبلغ ${clientLabel} عن (${catAr} · ${sevAr}): ${report.description}`,
          body_fr: `${clientLabel} signale (${catFr} · ${sevFr}) : ${report.description}`,
          type: 'booking_breakdown',
          data: {
            booking_id: booking.id,
            machine_id: booking.machine_id,
            breakdown_id: report.id,
            category,
            severity,
            machine_title: machineTitleAr,
            client_name: clientLabel,
          },
        });
      } catch (notifErr) {
        console.warn('Breakdown notification insert notice:', notifErr);
      }
    }

    // 3. Also send a chat message to the Owner if an existing conversation is found (non-blocking)
    if (booking.owner_id && reporterId) {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .or(
            `and(participant_a.eq.${reporterId},participant_b.eq.${booking.owner_id}),and(participant_a.eq.${booking.owner_id},participant_b.eq.${reporterId})`
          )
          .maybeSingle();

        if (conv?.id) {
          const machineName =
            booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية';
          await supabase.from('messages').insert({
            conversation_id: conv.id,
            sender_id: reporterId,
            content: `⚠️ بلاغ عطل في الآلية (${machineName}) أثناء فترة الكراء:\n• النوع: ${catAr}\n• الحالة: ${sevAr}\n• التفاصيل: ${report.description}`,
          });
        }
      } catch {
        // Non-blocking chat alert
      }
    }
  }

  const updatedBooking: Booking = {
    ...booking,
    notes: nextNotes,
    breakdowns: nextBreakdowns,
  };

  bookingStore.saveBooking(updatedBooking);
  window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'breakdown_reported', booking: updatedBooking } }));
  window.dispatchEvent(new CustomEvent('jadijcb_chat_unread_updated'));

  return {
    success: persistedRemotely || !isSupabaseConfigured,
    report,
    updatedBooking,
    error: persistedRemotely ? undefined : remoteErrorMsg,
  };
}

export async function resolveBookingBreakdown(
  booking: Booking,
  breakdownId: string
): Promise<{
  success: boolean;
  updatedBooking: Booking;
}> {
  const nowIso = new Date().toISOString();
  const { breakdowns: existingBreakdowns, cleanNotes } = extractBookingBreakdownsAndNotes(booking);

  const nextBreakdowns: BookingBreakdownReport[] = existingBreakdowns.map((item) =>
    item.id === breakdownId
      ? { ...item, status: 'resolved', resolved_at: nowIso }
      : item
  );
  const nextNotes = buildUpdatedNotesWithBreakdowns(cleanNotes, nextBreakdowns);

  let persisted = false;
  if (isSupabaseConfigured) {
    try {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          notes: nextNotes,
          breakdowns: nextBreakdowns,
        })
        .eq('id', booking.id);

      if (!updErr) {
        persisted = true;
      } else if (updErr.message?.toLowerCase().includes('breakdowns')) {
        const { error: notesErr } = await supabase
          .from('bookings')
          .update({ notes: nextNotes })
          .eq('id', booking.id);
        if (!notesErr) persisted = true;
      }
    } catch {
      // Fallback below
    }

    if (!persisted) {
      try {
        const { error: rpcErr } = await supabase.rpc('resolve_booking_breakdown', {
          p_booking_id: booking.id,
          p_report_id: breakdownId,
          p_notes: nextNotes,
        });
        if (!rpcErr) persisted = true;
      } catch {
        // Ignore
      }
    }

    // Notify client if client_id exists
    if (booking.client_id) {
      try {
        const machineTitleAr = booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية';
        const machineTitleFr = booking.machine?.title_fr || booking.machine?.title_ar || 'Engin';
        await supabase.from('notifications').insert({
          user_id: booking.client_id,
          title_ar: `✅ تم معالجة العطل: ${machineTitleAr}`,
          title_fr: `✅ Panne traitée : ${machineTitleFr}`,
          body_ar: `قام المالك بتحديث حالة العطل المبلّغ عنه إلى "تم الإصلاح".`,
          body_fr: `Le propriétaire a marqué l'anomalie signalée comme résolue.`,
          type: 'booking_breakdown_resolved',
          data: {
            booking_id: booking.id,
            machine_id: booking.machine_id,
            breakdown_id: breakdownId,
          },
        });
      } catch {
        // Non-blocking
      }
    }
  }

  const updatedBooking: Booking = {
    ...booking,
    notes: nextNotes,
    breakdowns: nextBreakdowns,
  };

  bookingStore.saveBooking(updatedBooking);
  window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'breakdown_resolved', booking: updatedBooking } }));

  return {
    success: persisted || !isSupabaseConfigured,
    updatedBooking,
  };
}
