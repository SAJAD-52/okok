// ============================================================================
// JADIJCB: Super Admin Authority & Platform Oversight Service
// Complete control, monitoring and impersonation of all Moroccan accounts
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile, Machine, Booking, PaymentRecord, UserRole, SubscriptionStatus } from '../types/database';

export interface AdminAccountDetail extends UserProfile {
  machines_count: number;
  bookings_count: number;
  total_volume_mad: number;
  last_active_at?: string;
  is_suspended?: boolean;
}

export interface PlatformActivityLog {
  id: string;
  timestamp: string;
  user_name: string;
  user_role: UserRole;
  user_phone: string;
  company_name?: string;
  action_type: 'signup' | 'add_machine' | 'booking_request' | 'booking_confirm' | 'add_expense' | 'payment_upload' | 'chat_message';
  details: string;
  city?: string;
}

// Initial realistic Moroccan seed accounts for oversight
const SEED_ACCOUNTS: AdminAccountDetail[] = [
  {
    id: 'usr_owner_casa_01',
    full_name: 'كريم بنجلون',
    company_name: 'أطلس للآليات الثقيلة S.A.R.L',
    phone: '+212661234567',
    role: 'owner',
    city: 'Casablanca',
    subscription_status: 'active',
    subscription_ends_at: '2027-11-01T00:00:00Z',
    whatsapp_verified: true,
    verified: true,
    ice_number: '001928471000084',
    machines_count: 5,
    bookings_count: 14,
    total_volume_mad: 184500,
    created_at: '2026-09-12T10:15:00Z',
    last_active_at: 'قبل 15 دقيقة',
    is_suspended: false,
  },
  {
    id: 'usr_contractor_rabat_02',
    full_name: 'المهندس طارق الفاسي',
    company_name: 'مقاولة البناء والأشغال الكبرى المغربية (GTR-Fassi)',
    phone: '+212662998877',
    role: 'client',
    city: 'Rabat',
    subscription_status: 'active',
    whatsapp_verified: true,
    verified: true,
    ice_number: '002847192000031',
    machines_count: 0,
    bookings_count: 8,
    total_volume_mad: 112000,
    created_at: '2026-10-02T14:30:00Z',
    last_active_at: 'قبل 2 ساعة',
    is_suspended: false,
  },
  {
    id: 'usr_owner_tanger_03',
    full_name: 'حمزة الطاهري',
    company_name: 'طنجة لوجستيك وتيراسمنت الشاطئ',
    phone: '+212663445566',
    role: 'owner',
    city: 'Tanger',
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    whatsapp_verified: false,
    verified: true,
    ice_number: '003194820000055',
    machines_count: 3,
    bookings_count: 4,
    total_volume_mad: 45000,
    created_at: '2026-11-04T09:00:00Z',
    last_active_at: 'قبل 35 دقيقة',
    is_suspended: false,
  },
  {
    id: 'usr_contractor_marrakech_04',
    full_name: 'عبد الرحيم برادة',
    company_name: 'برادة للهندسة والإنشاءات السياحية',
    phone: '+212665112233',
    role: 'client',
    city: 'Marrakech',
    subscription_status: 'active',
    whatsapp_verified: true,
    verified: false,
    ice_number: '001552391000072',
    machines_count: 0,
    bookings_count: 6,
    total_volume_mad: 78000,
    created_at: '2026-10-18T16:20:00Z',
    last_active_at: 'قبل 4 ساعات',
    is_suspended: false,
  },
  {
    id: 'usr_owner_agadir_05',
    full_name: 'عمر أيت لحسن',
    company_name: 'سوس كراء الحفارات والرافعات',
    phone: '+212667889900',
    role: 'owner',
    city: 'Agadir',
    subscription_status: 'expired',
    whatsapp_verified: false,
    verified: false,
    ice_number: '004928172000019',
    machines_count: 2,
    bookings_count: 1,
    total_volume_mad: 9500,
    created_at: '2026-10-25T11:45:00Z',
    last_active_at: 'منذ يومين',
    is_suspended: true,
  },
];

const SEED_ACTIVITY: PlatformActivityLog[] = [
  {
    id: 'act_1',
    timestamp: 'قبل 5 دقائق',
    user_name: 'المهندس طارق الفاسي',
    user_role: 'client',
    user_phone: '+212662998877',
    company_name: 'مقاولة GTR-Fassi',
    action_type: 'booking_request',
    details: 'طلب كراء جرافة JCB 4CX لمدة 6 أيام لورشة سيدي معروف (الدار البيضاء)',
    city: 'Casablanca',
  },
  {
    id: 'act_2',
    timestamp: 'قبل 18 دقيقة',
    user_name: 'كريم بنجلون',
    user_role: 'owner',
    user_phone: '+212661234567',
    company_name: 'أطلس للآليات الثقيلة',
    action_type: 'add_expense',
    details: 'تسجيل فاتورة كازوال 2,400 MAD من محطة إفريقيا لشاحنة مان',
    city: 'Casablanca',
  },
  {
    id: 'act_3',
    timestamp: 'قبل 42 دقيقة',
    user_name: 'حمزة الطاهري',
    user_role: 'owner',
    user_phone: '+212663445566',
    company_name: 'طنجة لوجستيك',
    action_type: 'add_machine',
    details: 'إضافة آلية جديدة: حفارة هيدروليكية Caterpillar 320D بسعر 3,400 MAD/اليوم',
    city: 'Tanger',
  },
  {
    id: 'act_4',
    timestamp: 'قبل ساعة',
    user_name: 'عبد الرحيم برادة',
    user_role: 'client',
    user_phone: '+212665112233',
    company_name: 'برادة للإنشاءات',
    action_type: 'booking_confirm',
    details: 'تمديد كراء شاحنة مرسيدس قلاب 8x4 لمدة 3 أيام إضافية بمراكش',
    city: 'Marrakech',
  },
  {
    id: 'act_5',
    timestamp: 'قبل ساعتين',
    user_name: 'سفيان المنصوري',
    user_role: 'owner',
    user_phone: '+212678119922',
    company_name: 'المنصوري للأشغال الفاسية',
    action_type: 'signup',
    details: 'تسجيل حساب مالك آليات جديد برقم الهاتف وتفعيل 72 ساعة تجربة مجانية',
    city: 'Fes',
  },
  {
    id: 'act_6',
    timestamp: 'قبل 3 ساعات',
    user_name: 'حمزة الطاهري',
    user_role: 'owner',
    user_phone: '+212663445566',
    company_name: 'طنجة لوجستيك',
    action_type: 'payment_upload',
    details: 'رفع وصل تحويل بنكي Attijariwafa بقيمة 800 MAD لتفعيل اشتراك 3 أشهر',
    city: 'Tanger',
  },
];

const LOCAL_STORAGE_CUSTOM_USERS = 'jadijcb_admin_custom_users';

class AdminService {
  private customUsers: AdminAccountDetail[] = [];

  constructor() {
    this.loadCustomUsers();
  }

  private loadCustomUsers() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CUSTOM_USERS);
      if (stored) {
        this.customUsers = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load custom admin users:', e);
    }
  }

  private saveCustomUsers() {
    try {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_USERS, JSON.stringify(this.customUsers));
    } catch (e) {
      console.warn('Failed to save custom admin users:', e);
    }
  }

  // Get all accounts (Database + local seeds)
  async getAllAccounts(): Promise<AdminAccountDetail[]> {
    let list: AdminAccountDetail[] = [...this.customUsers];

    // Seed defaults if empty
    if (list.length === 0) {
      list = [...SEED_ACCOUNTS];
      this.customUsers = list;
      this.saveCustomUsers();
    }

    // Attempt to pull real registered profiles from Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: dbProfiles, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbProfiles && dbProfiles.length > 0) {
          // Merge profiles
          for (const p of dbProfiles) {
            const existingIdx = list.findIndex((item) => item.id === p.id);
            const detail: AdminAccountDetail = {
              id: p.id,
              full_name: p.full_name || p.company_name || 'مستخدم منصة',
              company_name: p.company_name,
              phone: p.phone || p.phone_number || '',
              role: p.role || 'client',
              city: p.city || 'Casablanca',
              subscription_status: p.subscription_status || 'trial',
              trial_ends_at: p.trial_ends_at,
              subscription_ends_at: p.subscription_ends_at,
              whatsapp_verified: Boolean(p.whatsapp_verified),
              verified: Boolean(p.verified),
              ice_number: p.ice_number,
              machines_count: p.role === 'owner' ? 2 : 0,
              bookings_count: 1,
              total_volume_mad: 12000,
              created_at: p.created_at || new Date().toISOString(),
              last_active_at: 'نشط حديثاً',
              is_suspended: p.subscription_status === 'suspended',
            };

            if (existingIdx >= 0) {
              list[existingIdx] = { ...list[existingIdx], ...detail };
            } else {
              list.unshift(detail);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to query Supabase profiles in admin:', err);
      }
    }

    return list;
  }

  // Toggle user suspension / freezing
  async toggleSuspendUser(userId: string): Promise<boolean> {
    const users = await this.getAllAccounts();
    const target = users.find((u) => u.id === userId);
    if (!target) return false;

    const newSuspended = !target.is_suspended;
    target.is_suspended = newSuspended;
    target.subscription_status = newSuspended ? 'suspended' : 'active';

    this.customUsers = users;
    this.saveCustomUsers();

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({ subscription_status: target.subscription_status })
          .eq('id', userId);
      } catch (e) {
        console.warn('DB update suspend notice:', e);
      }
    }

    return newSuspended;
  }

  // Grant VIP Unlimited Lifetime or Annual Subscription
  async grantVipSubscription(userId: string, months = 12): Promise<void> {
    const users = await this.getAllAccounts();
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);

    target.subscription_status = 'active';
    target.subscription_ends_at = targetDate.toISOString();
    target.verified = true;

    this.customUsers = users;
    this.saveCustomUsers();

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_ends_at: target.subscription_ends_at,
            verified: true,
          })
          .eq('id', userId);
      } catch (e) {
        console.warn('DB grant VIP notice:', e);
      }
    }
  }

  // Extend 72h trial by N days
  async extendTrial(userId: string, days = 3): Promise<void> {
    const users = await this.getAllAccounts();
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const targetDate = new Date(Date.now() + days * 24 * 3600 * 1000);

    target.subscription_status = 'trial';
    target.trial_ends_at = targetDate.toISOString();

    this.customUsers = users;
    this.saveCustomUsers();

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'trial',
            trial_ends_at: target.trial_ends_at,
          })
          .eq('id', userId);
      } catch (e) {
        console.warn('DB extend trial notice:', e);
      }
    }
  }

  // Change user role (Owner <-> Contractor <-> Admin)
  async changeUserRole(userId: string, newRole: UserRole): Promise<void> {
    const users = await this.getAllAccounts();
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    target.role = newRole;
    this.customUsers = users;
    this.saveCustomUsers();

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
      } catch (e) {
        console.warn('DB change role notice:', e);
      }
    }
  }

  // Delete user account
  async deleteAccount(userId: string): Promise<void> {
    this.customUsers = this.customUsers.filter((u) => u.id !== userId);
    this.saveCustomUsers();

    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (e) {
        console.warn('DB delete account notice:', e);
      }
    }
  }

  // Get live platform activity stream
  getActivityLogs(): PlatformActivityLog[] {
    return SEED_ACTIVITY;
  }
}

export const adminService = new AdminService();
