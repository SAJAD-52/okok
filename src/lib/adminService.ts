// ============================================================================
// JADIJCB: Super Admin Authority & Platform Oversight Service
// 100% Real Database Queries - No Seed Mocks
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile, Machine, Booking, PaymentRecord, UserRole, SubscriptionStatus } from '../types/database';

export interface AdminAccountDetail extends UserProfile {
  machines_count: number;
  bookings_count: number;
  documents_count: number;
  total_volume_mad: number;
  is_suspended: boolean;
}

export interface PlatformOverviewMetrics {
  total_accounts: number;
  activated_accounts: number;
  activation_rate_pct: number;
  docs_this_week: number;
  bookings_this_week: number;
  total_machines: number;
  total_volume_mad: number;
}

class AdminService {
  // Query all accounts with real aggregates from Supabase
  async getAllAccounts(): Promise<AdminAccountDetail[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      // 1. Fetch real profiles
      const { data: dbProfiles, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profError || !dbProfiles) {
        console.warn('Failed to query profiles:', profError);
        return [];
      }

      // 2. Fetch machines counts grouped by owner
      const { data: dbMachines } = await supabase
        .from('machines')
        .select('id, owner_id');

      // 3. Fetch bookings grouped by owner
      const { data: dbBookings } = await supabase
        .from('bookings')
        .select('id, owner_id, total_price, created_at');

      // 4. Fetch documents grouped by owner
      let dbDocs: any[] = [];
      try {
        const { data: docsData } = await supabase
          .from('documents')
          .select('id, owner_id, created_at');
        if (docsData) dbDocs = docsData;
      } catch {
        // Table might be freshly created
      }

      // Compute aggregates per user
      const result: AdminAccountDetail[] = dbProfiles.map((p: any) => {
        const userMachines = dbMachines ? dbMachines.filter((m: any) => m.owner_id === p.id) : [];
        const userBookings = dbBookings ? dbBookings.filter((b: any) => b.owner_id === p.id) : [];
        const userDocs = dbDocs.filter((d: any) => d.owner_id === p.id);

        const totalVolume = userBookings.reduce((sum: number, b: any) => sum + (Number(b.total_price) || 0), 0);

        return {
          id: p.id,
          phone: p.phone || p.phone_number || '',
          full_name: p.full_name || p.company_name || 'مستخدم مسجل',
          company_name: p.company_name,
          role: p.role || 'owner',
          city: p.city || 'Casablanca',
          ice_number: p.ice_number,
          rc_number: p.rc_number,
          subscription_status: p.subscription_status || 'trial',
          trial_started_at: p.trial_started_at,
          trial_ends_at: p.trial_ends_at,
          subscription_ends_at: p.subscription_ends_at,
          whatsapp_verified: Boolean(p.whatsapp_verified),
          verified: Boolean(p.verified),
          avatar_url: p.avatar_url,
          last_active_at: p.last_active_at,
          activation_at: p.activation_at,
          created_at: p.created_at || new Date().toISOString(),
          machines_count: userMachines.length,
          bookings_count: userBookings.length,
          documents_count: userDocs.length,
          total_volume_mad: totalVolume,
          is_suspended: p.subscription_status === 'suspended',
        };
      });

      return result;
    } catch (err) {
      console.warn('Super Admin getAllAccounts error:', err);
      return [];
    }
  }

  // Get live platform overview KPIs
  async getOverviewMetrics(): Promise<PlatformOverviewMetrics> {
    const defaultMetrics: PlatformOverviewMetrics = {
      total_accounts: 0,
      activated_accounts: 0,
      activation_rate_pct: 0,
      docs_this_week: 0,
      bookings_this_week: 0,
      total_machines: 0,
      total_volume_mad: 0,
    };

    if (!isSupabaseConfigured) return defaultMetrics;

    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      // Profiles
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, activation_at');

      const totalAccounts = profs?.length || 0;
      const activatedCount = profs?.filter((p: any) => Boolean(p.activation_at)).length || 0;
      const activationRate = totalAccounts > 0 ? Math.round((activatedCount / totalAccounts) * 100) : 0;

      // Machines
      const { count: machinesCount } = await supabase
        .from('machines')
        .select('*', { count: 'exact', head: true });

      // Bookings this week
      const { data: bookingsWeek } = await supabase
        .from('bookings')
        .select('id, total_price, created_at')
        .gte('created_at', oneWeekAgo);

      const bookingsThisWeek = bookingsWeek?.length || 0;
      const totalVolume = bookingsWeek?.reduce((sum: number, b: any) => sum + (Number(b.total_price) || 0), 0) || 0;

      // Docs this week
      let docsThisWeek = 0;
      try {
        const { count: dCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneWeekAgo);
        if (typeof dCount === 'number') docsThisWeek = dCount;
      } catch {
        // Table might be fresh
      }

      return {
        total_accounts: totalAccounts,
        activated_accounts: activatedCount,
        activation_rate_pct: activationRate,
        docs_this_week: docsThisWeek,
        bookings_this_week: bookingsThisWeek,
        total_machines: machinesCount || 0,
        total_volume_mad: totalVolume,
      };
    } catch (err) {
      console.warn('Super Admin getOverviewMetrics error:', err);
      return defaultMetrics;
    }
  }

  // Toggle user suspension / freezing in real database
  async toggleSuspendUser(userId: string, currentStatus?: SubscriptionStatus): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const isSuspended = currentStatus === 'suspended';
    const newStatus: SubscriptionStatus = isSuspended ? 'active' : 'suspended';

    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: newStatus })
      .eq('id', userId);

    if (error) {
      console.warn('toggleSuspendUser error:', error);
      throw error;
    }

    return !isSuspended;
  }

  // Grant VIP Unlimited Lifetime or Annual Subscription in real database
  async grantVipSubscription(userId: string, months = 12): Promise<void> {
    if (!isSupabaseConfigured) return;

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_ends_at: targetDate.toISOString(),
        verified: true,
      })
      .eq('id', userId);

    if (error) {
      console.warn('grantVipSubscription error:', error);
      throw error;
    }
  }

  // Extend 72h trial by N days in real database
  async extendTrial(userId: string, days = 3): Promise<void> {
    if (!isSupabaseConfigured) return;

    const targetDate = new Date(Date.now() + days * 24 * 3600 * 1000);

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'trial',
        trial_ends_at: targetDate.toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.warn('extendTrial error:', error);
      throw error;
    }
  }

  // Change user role in real database
  async changeUserRole(userId: string, newRole: UserRole): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.warn('changeUserRole error:', error);
      throw error;
    }
  }

  // Delete user account permanently from database
  async deleteAccount(userId: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      console.warn('deleteAccount error:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
