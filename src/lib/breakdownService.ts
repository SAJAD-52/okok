// ============================================================================
// JADIJCB: Machine Breakdown / Fault Reporting & Rental Pause/Resume Service
// Handles dual persistence (bookings.breakdowns / pause_state JSONB + structured
// notes tags fallback), instant owner/client notifications, and exact remaining
// hours preservation across pause & resume.
// ============================================================================

import {
  Booking,
  BookingBreakdownReport,
  BookingPauseState,
  BreakdownCategory,
  BreakdownSeverity,
} from '../types/database';
import { supabase, isSupabaseConfigured } from './supabase';
import { bookingStore } from './bookingStore';

const FAULT_TAG_PREFIX = '[JADIJCB_FAULT:';
const FAULT_TAG_REGEX = /^\[JADIJCB_FAULT:(\{.*\})\]$/;

const PAUSE_TAG_PREFIX = '[JADIJCB_PAUSE:';
const PAUSE_TAG_REGEX = /^\[JADIJCB_PAUSE:(\{.*\})\]$/;

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
 * Formats a remaining duration in milliseconds into clear Arabic / French hours & minutes.
 */
export function formatRemainingDuration(ms: number, lang: 'ar' | 'fr' | string): string {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / (60 * 1000));
  if (totalMinutes <= 0) {
    return lang === 'fr' ? '0 heure (terminé)' : '0 ساعة (منتهي)';
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  if (days > 0) {
    if (lang === 'fr') {
      return `${days}j ${remHours}h (${totalHours}h au total)`;
    }
    return `${days} يوم و ${remHours} ساعة (${totalHours} ساعة إجمالاً)`;
  }

  if (totalHours > 0) {
    if (lang === 'fr') {
      return remMinutes > 0 ? `${totalHours}h ${remMinutes}min` : `${totalHours}h`;
    }
    return remMinutes > 0
      ? `${totalHours} ساعة و ${remMinutes} دقيقة`
      : `${totalHours} ساعة`;
  }

  return lang === 'fr' ? `${remMinutes} min` : `${remMinutes} دقيقة`;
}

/**
 * Formats compact remaining hours pill (e.g. "56 س" or "2ي 8س").
 */
export function formatCompactRemaining(ms: number, lang: 'ar' | 'fr' | string): string {
  const safeMs = Math.max(0, ms);
  const totalHours = Math.ceil(safeMs / (3600 * 1000));
  if (totalHours <= 0) return lang === 'fr' ? '0h' : '0س';
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  if (days > 0) {
    return lang === 'fr'
      ? remHours > 0 ? `${days}j ${remHours}h` : `${days}j`
      : remHours > 0 ? `${days}ي ${remHours}س` : `${days}ي`;
  }
  return lang === 'fr' ? `${totalHours}h` : `${totalHours}س`;
}

/**
 * Extracts structured breakdown reports, pause state, and clean human notes from a Booking.
 */
export function extractBookingBreakdownsAndNotes(
  booking: Pick<Booking, 'notes' | 'breakdowns' | 'pause_state'>
): {
  breakdowns: BookingBreakdownReport[];
  pauseState: BookingPauseState | null;
  cleanNotes: string;
} {
  const byId = new Map<string, BookingBreakdownReport>();
  let parsedPauseFromNotes: BookingPauseState | null = null;

  // 1. Read from dedicated breakdowns array if available
  if (Array.isArray(booking.breakdowns)) {
    for (const item of booking.breakdowns) {
      if (item && item.id) {
        byId.set(item.id, item);
      }
    }
  }

  // 2. Parse [JADIJCB_FAULT:{...}] and [JADIJCB_PAUSE:{...}] lines from notes
  const cleanLines: string[] = [];
  const rawNotes = String(booking.notes || '');
  for (const line of rawNotes.split('\n')) {
    const trimmed = line.trim();

    const faultMatch = trimmed.match(FAULT_TAG_REGEX);
    if (faultMatch && faultMatch[1]) {
      try {
        const parsed = JSON.parse(faultMatch[1]) as BookingBreakdownReport;
        if (parsed && parsed.id) {
          const existing = byId.get(parsed.id);
          if (!existing || (parsed.status === 'resolved' && existing.status !== 'resolved')) {
            byId.set(parsed.id, parsed);
          }
          continue;
        }
      } catch {
        // ignore malformed line
      }
    }
    if (trimmed.startsWith(FAULT_TAG_PREFIX)) continue;

    const pauseMatch = trimmed.match(PAUSE_TAG_REGEX);
    if (pauseMatch && pauseMatch[1]) {
      try {
        parsedPauseFromNotes = JSON.parse(pauseMatch[1]) as BookingPauseState;
        continue;
      } catch {
        // ignore malformed pause tag
      }
    }
    if (trimmed.startsWith(PAUSE_TAG_PREFIX)) continue;

    cleanLines.push(line);
  }

  const breakdowns = Array.from(byId.values()).sort(
    (a, b) => new Date(b.reported_at || 0).getTime() - new Date(a.reported_at || 0).getTime()
  );

  let pauseState: BookingPauseState | null = null;
  if (booking.pause_state && parsedPauseFromNotes) {
    const colTime = Math.max(
      booking.pause_state.client_repair_confirmed_at
        ? new Date(booking.pause_state.client_repair_confirmed_at).getTime()
        : 0,
      booking.pause_state.resumed_at ? new Date(booking.pause_state.resumed_at).getTime() : 0,
      booking.pause_state.paused_at ? new Date(booking.pause_state.paused_at).getTime() : 0
    );
    const noteTime = Math.max(
      parsedPauseFromNotes.client_repair_confirmed_at
        ? new Date(parsedPauseFromNotes.client_repair_confirmed_at).getTime()
        : 0,
      parsedPauseFromNotes.resumed_at ? new Date(parsedPauseFromNotes.resumed_at).getTime() : 0,
      parsedPauseFromNotes.paused_at ? new Date(parsedPauseFromNotes.paused_at).getTime() : 0
    );
    const primary = noteTime > colTime ? parsedPauseFromNotes : booking.pause_state;
    const secondary = noteTime > colTime ? booking.pause_state : parsedPauseFromNotes;
    pauseState = {
      ...secondary,
      ...primary,
      client_repair_confirmed:
        primary.is_paused
          ? Boolean(primary.client_repair_confirmed || secondary.client_repair_confirmed)
          : primary.client_repair_confirmed,
      client_repair_confirmed_at:
        primary.client_repair_confirmed_at || secondary.client_repair_confirmed_at,
      client_repair_confirmed_by:
        primary.client_repair_confirmed_by || secondary.client_repair_confirmed_by,
    };
  } else {
    pauseState = booking.pause_state || parsedPauseFromNotes || null;
  }

  return {
    breakdowns,
    pauseState,
    cleanNotes: cleanLines.join('\n').trim(),
  };
}

export function isBookingPaused(
  booking: Pick<Booking, 'status' | 'notes' | 'breakdowns' | 'pause_state'>
): boolean {
  if (booking.status !== 'active') return false;
  const { pauseState } = extractBookingBreakdownsAndNotes(booking);
  return Boolean(pauseState?.is_paused);
}

/**
 * Returns remaining milliseconds for a booking:
 * - If paused, returns the exact frozen remaining_ms saved at pause time.
 * - Otherwise returns max(0, end_at - nowMs).
 */
export function getEffectiveRemainingMs(
  booking: Pick<Booking, 'end_at' | 'end_date' | 'status' | 'notes' | 'breakdowns' | 'pause_state'>,
  nowMs: number = Date.now()
): number {
  const { pauseState } = extractBookingBreakdownsAndNotes(booking);
  if (pauseState?.is_paused) {
    return Math.max(0, Number(pauseState.remaining_ms) || 0);
  }
  const endMs = new Date(booking.end_at || booking.end_date || nowMs).getTime();
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - nowMs);
}

function buildUpdatedNotesWithExtras(
  cleanNotes: string,
  breakdowns: BookingBreakdownReport[],
  pauseState: BookingPauseState | null
): string {
  const orderedOldestFirst = [...breakdowns].sort(
    (a, b) => new Date(a.reported_at || 0).getTime() - new Date(b.reported_at || 0).getTime()
  );
  const faultLines = orderedOldestFirst.map((rep) => `${FAULT_TAG_PREFIX}${JSON.stringify(rep)}]`);
  const parts = cleanNotes ? [cleanNotes, ...faultLines] : [...faultLines];
  if (pauseState) {
    parts.push(`${PAUSE_TAG_PREFIX}${JSON.stringify(pauseState)}]`);
  }
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

  const { breakdowns: existingBreakdowns, pauseState, cleanNotes } =
    extractBookingBreakdownsAndNotes(booking);
  const nextBreakdowns = [report, ...existingBreakdowns];
  const nextNotes = buildUpdatedNotesWithExtras(cleanNotes, nextBreakdowns, pauseState);

  let persistedRemotely = false;
  let remoteErrorMsg: string | undefined;

  if (isSupabaseConfigured) {
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
  const { breakdowns: existingBreakdowns, pauseState, cleanNotes } =
    extractBookingBreakdownsAndNotes(booking);

  const nextBreakdowns: BookingBreakdownReport[] = existingBreakdowns.map((item) =>
    item.id === breakdownId
      ? { ...item, status: 'resolved', resolved_at: nowIso, resolved_by: 'owner' }
      : item
  );
  const nextNotes = buildUpdatedNotesWithExtras(cleanNotes, nextBreakdowns, pauseState);

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

    if (booking.client_id) {
      try {
        const machineTitleAr = booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية';
        const machineTitleFr = booking.machine?.title_fr || booking.machine?.title_ar || 'Engin';
        const isPausedNow = Boolean(pauseState?.is_paused);
        await supabase.from('notifications').insert({
          user_id: booking.client_id,
          title_ar: `🔧 قام المالك بصيانة العطل: ${machineTitleAr}`,
          title_fr: `🔧 Réparation effectuée : ${machineTitleFr}`,
          body_ar: isPausedNow
            ? `أشار المالك إلى إصلاح العطل. اضغط على «تم الإصلاح» من حسابك بعد المعاينة ليتمكن المالك من استئناف الكراء.`
            : `قام المالك بتحديث حالة العطل المبلّغ عنه إلى "تم الإصلاح".`,
          body_fr: isPausedNow
            ? `Le propriétaire signale que l'engin est réparé. Confirmez « Réparé » pour autoriser la reprise.`
            : `Le propriétaire a marqué l'anomalie signalée comme résolue.`,
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

/**
 * Client-side confirmation ("تم الإصلاح") protecting the client:
 * - Resolves any open breakdown reports on the booking.
 * - Sets `pauseState.client_repair_confirmed = true` so the Owner's "مواصلة"
 *   (Resume) button unlocks ONLY after the client confirms the machine is repaired.
 */
export async function confirmClientRepairCompleted(
  booking: Booking,
  clientId?: string,
  clientName?: string
): Promise<{
  success: boolean;
  updatedBooking: Booking;
  error?: string;
}> {
  const nowIso = new Date().toISOString();
  const { breakdowns: existingBreakdowns, pauseState: prevPauseState, cleanNotes } =
    extractBookingBreakdownsAndNotes(booking);

  const nextBreakdowns: BookingBreakdownReport[] = existingBreakdowns.map((item) =>
    item.status === 'open'
      ? { ...item, status: 'resolved', resolved_at: nowIso, resolved_by: 'client' }
      : item
  );

  const nextPauseState: BookingPauseState | null = prevPauseState
    ? {
        ...prevPauseState,
        client_repair_confirmed: true,
        client_repair_confirmed_at: nowIso,
        client_repair_confirmed_by: clientId || clientName || booking.client_id || 'client',
      }
    : null;

  const nextNotes = buildUpdatedNotesWithExtras(cleanNotes, nextBreakdowns, nextPauseState);
  let persisted = false;
  let errorMsg: string | undefined;

  if (isSupabaseConfigured) {
    try {
      const updatePayload: Record<string, any> = {
        notes: nextNotes,
        breakdowns: nextBreakdowns,
      };
      if (nextPauseState) {
        updatePayload.pause_state = nextPauseState;
      }

      const { error: updErr } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', booking.id);

      if (!updErr) {
        persisted = true;
      } else if (
        updErr.message?.toLowerCase().includes('breakdowns') ||
        updErr.message?.toLowerCase().includes('pause_state') ||
        updErr.message?.toLowerCase().includes('column')
      ) {
        const { error: notesErr } = await supabase
          .from('bookings')
          .update({ notes: nextNotes })
          .eq('id', booking.id);
        if (!notesErr) {
          persisted = true;
        } else {
          errorMsg = notesErr.message;
        }
      } else {
        errorMsg = updErr.message;
      }
    } catch (e: any) {
      errorMsg = e?.message;
    }

    if (!persisted) {
      for (const rep of existingBreakdowns.filter((f) => f.status === 'open')) {
        try {
          const { error: rpcErr } = await supabase.rpc('resolve_booking_breakdown', {
            p_booking_id: booking.id,
            p_report_id: rep.id,
            p_notes: nextNotes,
          });
          if (!rpcErr) {
            persisted = true;
            errorMsg = undefined;
          }
        } catch {
          // Ignore if RPC not present
        }
      }
    }

    if (booking.owner_id) {
      const machineTitleAr =
        booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية المؤجرة';
      const machineTitleFr =
        booking.machine?.title_fr || booking.machine?.title_ar || 'Engin loué';
      const clientLabel = clientName || booking.client_name || 'الزبون';

      try {
        await supabase.from('notifications').insert({
          user_id: booking.owner_id,
          title_ar: `✅ أكد الزبون «تم الإصلاح»: ${machineTitleAr}`,
          title_fr: `✅ Réparation confirmée par le client : ${machineTitleFr}`,
          body_ar: `أكّد ${clientLabel} أن الآلية تم إصلاحها وجاهزة للعمل. يمكنك الآن الضغط على زر «مواصلة» لاستئناف العداد.`,
          body_fr: `${clientLabel} a confirmé que l'engin est réparé. Vous pouvez maintenant cliquer sur « Reprendre ».`,
          type: 'booking_repair_confirmed',
          data: {
            booking_id: booking.id,
            machine_id: booking.machine_id,
            client_name: clientLabel,
          },
        });
      } catch {
        // Non-blocking
      }

      if (clientId) {
        try {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .or(
              `and(participant_a.eq.${clientId},participant_b.eq.${booking.owner_id}),and(participant_a.eq.${booking.owner_id},participant_b.eq.${clientId})`
            )
            .maybeSingle();
          if (conv?.id) {
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              sender_id: clientId,
              content: `✅ تم الإصلاح (${machineTitleAr}): أكّدت جاهزية الآلية للعمل. يمكنك الآن الضغط على زر «مواصلة» لاستئناف مدة الكراء.`,
            });
          }
        } catch {
          // Non-blocking
        }
      }
    }
  }

  const updatedBooking: Booking = {
    ...booking,
    notes: nextNotes,
    breakdowns: nextBreakdowns,
    pause_state: nextPauseState,
  };

  bookingStore.saveBooking(updatedBooking);
  window.dispatchEvent(
    new CustomEvent('jadijcb_booking_event', {
      detail: { action: 'client_repair_confirmed', booking: updatedBooking },
    })
  );

  return {
    success: persisted || !isSupabaseConfigured,
    updatedBooking,
    error: persisted ? undefined : errorMsg,
  };
}

/**
 * Pauses an active booking (e.g. during machine breakdown/repair) while
 * freezing the exact remaining milliseconds/hours so the client loses zero time.
 */
export async function pauseBookingForBreakdown(
  booking: Booking,
  reason?: string
): Promise<{
  success: boolean;
  pauseState: BookingPauseState;
  updatedBooking: Booking;
  error?: string;
}> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const { breakdowns, pauseState: prevPauseState, cleanNotes } =
    extractBookingBreakdownsAndNotes(booking);

  // If already paused, keep frozen remaining_ms rather than overwriting
  const endMs = new Date(booking.end_at || booking.end_date || nowMs).getTime();
  const remainingMs = prevPauseState?.is_paused
    ? Math.max(0, prevPauseState.remaining_ms)
    : Number.isNaN(endMs)
    ? 0
    : Math.max(0, endMs - nowMs);

  const openFault = breakdowns.find((f) => f.status === 'open');
  const resolvedReason =
    reason?.trim() ||
    (openFault
      ? `${getBreakdownCategoryLabel(openFault.category, 'ar')} - ${openFault.description}`
      : 'عطل في الآلية — قيد الإصلاح');

  const nextPauseState: BookingPauseState = {
    is_paused: true,
    paused_at: nowIso,
    remaining_ms: remainingMs,
    total_paused_ms: prevPauseState?.total_paused_ms || 0,
    pause_reason: resolvedReason,
    client_repair_confirmed: false,
    client_repair_confirmed_at: undefined,
    client_repair_confirmed_by: undefined,
  };

  const nextNotes = buildUpdatedNotesWithExtras(cleanNotes, breakdowns, nextPauseState);
  let persisted = false;
  let errorMsg: string | undefined;

  if (isSupabaseConfigured) {
    try {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          notes: nextNotes,
          pause_state: nextPauseState,
        })
        .eq('id', booking.id);

      if (!updErr) {
        persisted = true;
      } else if (updErr.message?.toLowerCase().includes('pause_state') || updErr.message?.toLowerCase().includes('column')) {
        const { error: notesErr } = await supabase
          .from('bookings')
          .update({ notes: nextNotes })
          .eq('id', booking.id);
        if (!notesErr) {
          persisted = true;
        } else {
          errorMsg = notesErr.message;
        }
      } else {
        errorMsg = updErr.message;
      }
    } catch (e: any) {
      errorMsg = e?.message;
    }

    if (!persisted) {
      try {
        const { error: rpcErr } = await supabase.rpc('pause_booking', {
          p_booking_id: booking.id,
          p_pause_state: nextPauseState,
          p_notes: nextNotes,
        });
        if (!rpcErr) {
          persisted = true;
          errorMsg = undefined;
        }
      } catch {
        // Ignore if RPC not migrated
      }
    }

    // Notify client that rental countdown is paused and remaining hours are preserved
    if (booking.client_id) {
      try {
        const machineTitleAr = booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية';
        const machineTitleFr = booking.machine?.title_fr || booking.machine?.title_ar || 'Engin';
        const remTextAr = formatRemainingDuration(remainingMs, 'ar');
        const remTextFr = formatRemainingDuration(remainingMs, 'fr');
        await supabase.from('notifications').insert({
          user_id: booking.client_id,
          title_ar: `⏸️ تم إيقاف عداد الحجز مؤقتاً: ${machineTitleAr}`,
          title_fr: `⏸️ Location mise en pause : ${machineTitleFr}`,
          body_ar: `تم تجميد وقت الكراء بسبب العطل مع حفظ ${remTextAr} بالكامل حتى استئناف العمل.`,
          body_fr: `Décompte suspendu pour panne : ${remTextFr} conservées jusqu'à la reprise.`,
          type: 'booking_paused',
          data: {
            booking_id: booking.id,
            machine_id: booking.machine_id,
            remaining_ms: remainingMs,
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
    pause_state: nextPauseState,
  };

  bookingStore.saveBooking(updatedBooking);
  window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'booking_paused', booking: updatedBooking } }));

  return {
    success: persisted || !isSupabaseConfigured,
    pauseState: nextPauseState,
    updatedBooking,
    error: persisted ? undefined : errorMsg,
  };
}

/**
 * Resumes a paused booking, shifting `end_at` forward by the exact preserved
 * `remaining_ms` from `now`, so the client retains 100% of their remaining hours.
 */
export async function resumeBookingAfterBreakdown(booking: Booking): Promise<{
  success: boolean;
  newEndAt: string;
  pauseState: BookingPauseState;
  updatedBooking: Booking;
  error?: string;
}> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const { breakdowns, pauseState: prevPauseState, cleanNotes } =
    extractBookingBreakdownsAndNotes(booking);

  const preservedMs = Math.max(0, Number(prevPauseState?.remaining_ms) || 0);
  const pausedElapsedMs = prevPauseState?.paused_at
    ? Math.max(0, nowMs - new Date(prevPauseState.paused_at).getTime())
    : 0;
  const newEndAtIso = new Date(nowMs + preservedMs).toISOString();

  const nextPauseState: BookingPauseState = {
    is_paused: false,
    remaining_ms: 0,
    total_paused_ms: (prevPauseState?.total_paused_ms || 0) + pausedElapsedMs,
    pause_reason: prevPauseState?.pause_reason,
    resumed_at: nowIso,
  };

  const nextNotes = buildUpdatedNotesWithExtras(cleanNotes, breakdowns, nextPauseState);
  let persisted = false;
  let errorMsg: string | undefined;

  if (isSupabaseConfigured) {
    try {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          end_at: newEndAtIso,
          notes: nextNotes,
          pause_state: nextPauseState,
        })
        .eq('id', booking.id);

      if (!updErr) {
        persisted = true;
      } else if (updErr.message?.toLowerCase().includes('pause_state') || updErr.message?.toLowerCase().includes('column')) {
        const { error: fallbackErr } = await supabase
          .from('bookings')
          .update({
            end_at: newEndAtIso,
            notes: nextNotes,
          })
          .eq('id', booking.id);
        if (!fallbackErr) {
          persisted = true;
        } else {
          errorMsg = fallbackErr.message;
        }
      } else {
        errorMsg = updErr.message;
      }
    } catch (e: any) {
      errorMsg = e?.message;
    }

    if (!persisted) {
      try {
        const { error: rpcErr } = await supabase.rpc('resume_booking', {
          p_booking_id: booking.id,
          p_new_end_at: newEndAtIso,
          p_pause_state: nextPauseState,
          p_notes: nextNotes,
        });
        if (!rpcErr) {
          persisted = true;
          errorMsg = undefined;
        }
      } catch {
        // Ignore if RPC not migrated
      }
    }

    // Notify client that rental has resumed with preserved remaining hours
    if (booking.client_id) {
      try {
        const machineTitleAr = booking.machine?.title_ar || booking.machine?.title_fr || 'الآلية';
        const machineTitleFr = booking.machine?.title_fr || booking.machine?.title_ar || 'Engin';
        const remTextAr = formatRemainingDuration(preservedMs, 'ar');
        const remTextFr = formatRemainingDuration(preservedMs, 'fr');
        await supabase.from('notifications').insert({
          user_id: booking.client_id,
          title_ar: `▶️ تم استئناف الحجز: ${machineTitleAr}`,
          title_fr: `▶️ Location reprise : ${machineTitleFr}`,
          body_ar: `تمت مواصلة الحجز بعد إصلاح العطل واسترجاع ${remTextAr} المتبقية حتى ${newEndAtIso.slice(0, 16).replace('T', ' ')}.`,
          body_fr: `Location relancée avec vos ${remTextFr} restantes jusqu'au ${newEndAtIso.slice(0, 16).replace('T', ' ')}.`,
          type: 'booking_resumed',
          data: {
            booking_id: booking.id,
            machine_id: booking.machine_id,
            new_end_at: newEndAtIso,
            preserved_ms: preservedMs,
          },
        });
      } catch {
        // Non-blocking
      }
    }
  }

  const updatedBooking: Booking = {
    ...booking,
    end_at: newEndAtIso,
    end_date: newEndAtIso,
    notes: nextNotes,
    pause_state: nextPauseState,
  };

  bookingStore.saveBooking(updatedBooking);
  window.dispatchEvent(new CustomEvent('jadijcb_booking_event', { detail: { action: 'booking_resumed', booking: updatedBooking } }));

  return {
    success: persisted || !isSupabaseConfigured,
    newEndAt: newEndAtIso,
    pauseState: nextPauseState,
    updatedBooking,
    error: persisted ? undefined : errorMsg,
  };
}
