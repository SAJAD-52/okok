// ============================================================================
// JADIJCB: Supabase Error Mapping Helper
// ============================================================================

export function mapDatabaseError(error: any): string {
  if (!error) return 'common.error';
  const raw = typeof error === 'string' ? error : error.message || error.details || '';
  const lower = raw.toLowerCase();

  // 1. Soft-Lock / RLS write restriction mapping
  if (
    lower.includes('row-level security') ||
    lower.includes('row level security') ||
    lower.includes('rls') ||
    lower.includes('is_subscription_active') ||
    lower.includes('permission denied')
  ) {
    return 'lock.write_blocked';
  }

  // 2. Overlapping active bookings exclusion constraint
  if (
    lower.includes('no_overlapping_active_bookings') ||
    lower.includes('overlapping') ||
    lower.includes('overlap') ||
    lower.includes('conflicting key value violates exclusion constraint')
  ) {
    return 'bookings.overlap_error';
  }

  return raw || 'common.error';
}

export default mapDatabaseError;
