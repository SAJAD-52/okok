// ============================================================================
// JADIJCB: Authentication Hook & Context (Strict Supabase Auth)
// ============================================================================

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizeMoroccanPhone, phoneToSyntheticEmail } from '../lib/authHelpers';
import { isLifetimeFreePhone } from '../lib/constants';
import { mapDatabaseError } from '../lib/errorHelpers';
import { UserProfile, UserRole, ClientSegment } from '../types/database';
import { generateUniqueStorefrontSlug } from '../lib/storefrontSlug';
import { saveStorefrontData } from '../lib/storefrontService';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  impersonatedUser: UserProfile | null;
  isImpersonating: boolean;
  loginWithPhone: (phone: string, pass: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  loginAsSuperAdmin: (email?: string, pass?: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  impersonateUser: (target: UserProfile) => void;
  stopImpersonating: () => void;
  signupWithPhone: (
    phone: string,
    pass: string,
    role: UserRole,
    meta?: {
      fullName?: string;
      companyName?: string;
      city?: string;
      clientSegment?: ClientSegment;
      clientActivityNote?: string;
      driverMachines?: string[];
      driverExperienceYears?: string;
      driverAvailable?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const SUPER_ADMIN_EMAIL = 'said.cpge24@gmail.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim().replace('٠', '0');
  return clean === 'said.cpge24@gmail.com' || clean === 'said.cpge240@gmail.com';
}

const LOCAL_STORAGE_PROFILE_KEY = 'jadijcb_current_profile';

function mapSupabaseAuthError(message: string): string {
  if (!message) return 'auth.auth_failed';
  const lower = message.toLowerCase();
  if (
    lower.includes('email provider is disabled') ||
    lower.includes('signups not allowed') ||
    lower.includes('provider is disabled') ||
    lower.includes('email signups are not allowed') ||
    lower.includes('signup requires a valid email') ||
    lower.includes('email logins are disabled')
  ) {
    return 'auth.provider_disabled';
  }
  if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'auth.rate_limit_exceeded';
  }
  if (lower.includes('invalid login credentials')) {
    return 'auth.invalid_credentials';
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'auth.phone_already_registered';
  }
  if (lower.includes('database error saving new user')) {
    return 'auth.db_trigger_error';
  }
  if (lower.includes('email not confirmed')) {
    return 'auth.email_confirmation_required';
  }
  return mapDatabaseError(message);
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(() => {
    try {
      const stored = sessionStorage.getItem('jadijcb_impersonate');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const impersonateUser = (target: UserProfile) => {
    setImpersonatedUser(target);
    try {
      sessionStorage.setItem('jadijcb_impersonate', JSON.stringify(target));
    } catch (e) {
      console.warn('Failed to store impersonation in session:', e);
    }
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
    try {
      sessionStorage.removeItem('jadijcb_impersonate');
    } catch (e) {
      console.warn('Failed to remove impersonation from session:', e);
    }
  };

  const saveProfileLocally = (p: UserProfile | null) => {
    setProfile(p);
    if (p) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  };

  const inFlightProfileFetchesRef = React.useRef<Map<string, Promise<UserProfile | null>>>(new Map());

  const fetchProfile = useCallback(async (userId: string, knownUser?: any): Promise<UserProfile | null> => {
    const existingPromise = inFlightProfileFetchesRef.current.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchTask = (async (): Promise<UserProfile | null> => {
    try {
      const { data, error } = isSupabaseConfigured
        ? await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
        : { data: null, error: null };

      if (error) {
        console.warn('Failed to fetch profile from Supabase:', error.message);
      }

      // Use provided auth user metadata first to avoid extra redundant network call on login
      let meta: any = knownUser?.user_metadata || {};
      if (Object.keys(meta).length === 0 && isSupabaseConfigured) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          meta = userData?.user?.user_metadata || {};
        } catch {
          // Ignore
        }
      }

      // Also check local stored profile for fallback
      let localCached: any = {};
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
        if (stored) localCached = JSON.parse(stored);
      } catch {
        // Ignore
      }

      const mergedPhone = (data as any)?.phone || (data as any)?.phone_number || meta.phone || localCached.phone || '';
      const isLifetimeVip = isLifetimeFreePhone(mergedPhone);
      const lifetimeEnd = '2099-12-31T23:59:59.000Z';

      if (isLifetimeVip && (data as any)?.subscription_status !== 'active') {
        supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_ends_at: lifetimeEnd,
          })
          .eq('id', userId)
          .then(() => {}, () => {});
      }

      // Throttled last_active_at & activation_at heartbeat (once per browser session)
      try {
        const pingKey = `jadijcb_active_ping_${userId}`;
        if (!sessionStorage.getItem(pingKey)) {
          sessionStorage.setItem(pingKey, '1');
          const nowIso = new Date().toISOString();
          const activePatch: Record<string, string> = { last_active_at: nowIso };
          if (!(data as any)?.activation_at) {
            activePatch.activation_at = nowIso;
          }
          supabase.from('profiles').update(activePatch).eq('id', userId).then(() => {}, () => {});
        }
      } catch {
        // ignore sessionStorage / network errors
      }

      const dbRole = (data as any)?.role;
      const metaRole = meta?.role || localCached?.role;
      const resolvedRole: UserRole =
        dbRole === 'admin'
          ? 'admin'
          : metaRole === 'driver' || dbRole === 'driver'
          ? 'driver'
          : dbRole || metaRole || 'client';

      const normalized: UserProfile = {
        id: userId,
        phone: mergedPhone,
        full_name: (data as any)?.full_name || meta.full_name || meta.fullName || localCached.full_name || '',
        company_name: (data as any)?.company_name || meta.company_name || meta.companyName || localCached.company_name || '',
        city: (data as any)?.city || meta.city || localCached.city || 'Casablanca',
        role: resolvedRole,
        client_segment: (data as any)?.client_segment || meta.client_segment || meta.clientSegment || localCached.client_segment || undefined,
        client_activity_note: (data as any)?.client_activity_note || meta.client_activity_note || meta.clientActivityNote || localCached.client_activity_note || '',
        driver_machines: Array.isArray((data as any)?.driver_machines) && (data as any).driver_machines.length > 0
          ? (data as any).driver_machines
          : Array.isArray(meta.driver_machines)
          ? meta.driver_machines
          : Array.isArray(localCached.driver_machines)
          ? localCached.driver_machines
          : [],
        driver_experience_years:
          (data as any)?.driver_experience_years ||
          meta.driver_experience_years ||
          localCached.driver_experience_years ||
          undefined,
        driver_available:
          (data as any)?.driver_available ??
          meta.driver_available ??
          localCached.driver_available ??
          true,
        driver_bio: (data as any)?.driver_bio || meta.driver_bio || localCached.driver_bio || '',
        ice_number: (data as any)?.ice_number || meta.ice_number || meta.iceNumber || localCached.ice_number || '',
        onboarding_completed: (data as any)?.onboarding_completed ?? meta.onboarding_completed ?? localCached.onboarding_completed ?? true,
        whatsapp_verified: Boolean((data as any)?.whatsapp_verified ?? meta.whatsapp_verified ?? localCached.whatsapp_verified ?? true),
        subscription_status: isLifetimeVip
          ? 'active'
          : resolvedRole === 'driver' || resolvedRole === 'client' || resolvedRole === 'contractor'
          ? 'active'
          : (data as any)?.subscription_status || localCached.subscription_status || 'trial',
        trial_started_at: (data as any)?.trial_started_at || localCached.trial_started_at || new Date().toISOString(),
        trial_ends_at: (data as any)?.trial_ends_at || localCached.trial_ends_at || new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        subscription_ends_at: isLifetimeVip
          ? lifetimeEnd
          : (data as any)?.subscription_ends_at || localCached.subscription_ends_at,
        preferred_lang: (data as any)?.preferred_lang || meta.preferred_lang || localCached.preferred_lang || 'ar',
        created_at: (data as any)?.created_at || localCached.created_at || new Date().toISOString(),
      };

      saveProfileLocally(normalized);
      return normalized;
    } catch (err) {
      console.warn('Failed to fetch profile from Supabase:', err);
    }
    return null;
    })();

    inFlightProfileFetchesRef.current.set(userId, fetchTask);
    try {
      return await fetchTask;
    } finally {
      inFlightProfileFetchesRef.current.delete(userId);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function initAuth() {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          setUser(session.user);
          await fetchProfile(session.user.id, session.user);
        } else if (mounted) {
          setUser(null);
          setProfile(null);
          localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
        }
      } catch (err) {
        console.warn('Supabase session load warning:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }

      if (!mounted) return;
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, session.user);
          } else {
            setUser(null);
            setProfile(null);
            localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
          }
        }
      );
      authSubscription = authListener?.subscription || null;
    }

    initAuth();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const loginWithPhone = async (
    rawPhone: string,
    pass: string
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'auth.supabase_not_configured' };
    }

    setIsLoading(true);

    const norm = normalizeMoroccanPhone(rawPhone);
    if (!norm.isValid) {
      setIsLoading(false);
      return { success: false, error: 'auth.phone_invalid' };
    }

    const syntheticEmail = phoneToSyntheticEmail(norm.e164);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: pass,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: mapSupabaseAuthError(error.message) };
      }

      if (data?.user) {
        setUser(data.user);
        let prof = await fetchProfile(data.user.id, data.user);
        if (!prof) {
          const isVipSignup = isLifetimeFreePhone(norm.e164);
          const fallbackPayload: any = {
            id: data.user.id,
            phone: norm.e164,
            phone_number: norm.e164,
            full_name: data.user.user_metadata?.full_name || '',
            company_name: data.user.user_metadata?.company_name || '',
            role: data.user.user_metadata?.role || 'client',
            city: data.user.user_metadata?.city || 'Casablanca',
            subscription_status: isVipSignup ? 'active' : 'trial',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
            subscription_ends_at: isVipSignup ? '2099-12-31T23:59:59.000Z' : undefined,
            preferred_lang: 'ar',
          };
          const { data: insertedProf } = await supabase
            .from('profiles')
            .upsert(fallbackPayload)
            .select()
            .maybeSingle();

          if (insertedProf) {
            prof = {
              ...(insertedProf as UserProfile),
              phone: (insertedProf as any).phone || (insertedProf as any).phone_number || norm.e164,
            };
            saveProfileLocally(prof);
          }
        }
        setIsLoading(false);
        const finalRole =
          data.user.user_metadata?.role === 'driver' && prof?.role !== 'admin'
            ? 'driver'
            : prof?.role || data.user.user_metadata?.role || 'client';
        return {
          success: true,
          role: finalRole as UserRole,
        };
      }

      setIsLoading(false);
      return { success: false, error: 'auth.auth_failed' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: mapSupabaseAuthError(err?.message || 'auth.auth_failed') };
    }
  };

  const loginAsSuperAdmin = async (
    customEmail = SUPER_ADMIN_EMAIL,
    pass?: string
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'auth.supabase_not_configured' };
    }

    setIsLoading(true);
    const email = customEmail.trim().toLowerCase().replace('٠', '0');

    if (!isSuperAdminEmail(email)) {
      setIsLoading(false);
      return { success: false, error: 'auth.invalid_credentials' };
    }

    if (!pass || !pass.trim()) {
      setIsLoading(false);
      return { success: false, error: 'auth.invalid_credentials' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error || !data?.user) {
        setIsLoading(false);
        return {
          success: false,
          error: mapSupabaseAuthError(error?.message || 'auth.invalid_credentials'),
        };
      }

      // Verify account holds admin privilege in DB or matches verified SUPER_ADMIN_EMAIL
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const hasAdminPrivilege =
        isSuperAdminEmail(data.user.email) || existingProf?.role === 'admin';

      if (!hasAdminPrivilege) {
        await supabase.auth.signOut({ scope: 'local' });
        setIsLoading(false);
        return { success: false, error: 'auth.invalid_credentials' };
      }

      setUser(data.user);
      const adminProf: UserProfile = {
        id: data.user.id,
        email,
        phone: existingProf?.phone || '+212600000001',
        full_name: existingProf?.full_name || 'سعيد (Super Admin)',
        company_name: existingProf?.company_name || 'الإدارة العامة لمنصة JADIJCB MAROC',
        role: 'admin',
        city: existingProf?.city || 'Casablanca',
        subscription_status: 'active',
        verified: true,
        whatsapp_verified: true,
        created_at: existingProf?.created_at || new Date().toISOString(),
      };

      saveProfileLocally(adminProf);
      setIsLoading(false);
      return { success: true, role: 'admin' };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: mapSupabaseAuthError(err?.message || 'auth.auth_failed'),
      };
    }
  };

  const loginWithEmail = async (
    rawEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'auth.supabase_not_configured' };
    }

    setIsLoading(true);
    const email = rawEmail.trim().toLowerCase().replace('٠', '0');

    if (isSuperAdminEmail(email)) {
      return loginAsSuperAdmin(email, pass);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: mapSupabaseAuthError(error.message) };
      }

      if (data?.user) {
        setUser(data.user);
        const prof = await fetchProfile(data.user.id, data.user);
        setIsLoading(false);
        return { success: true, role: prof?.role };
      }

      setIsLoading(false);
      return { success: false, error: 'auth.auth_failed' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: mapSupabaseAuthError(err?.message || 'auth.auth_failed') };
    }
  };

  const signupWithPhone = async (
    rawPhone: string,
    pass: string,
    role: UserRole,
    meta?: {
      fullName?: string;
      companyName?: string;
      city?: string;
      clientSegment?: ClientSegment;
      clientActivityNote?: string;
      driverMachines?: string[];
      driverExperienceYears?: string;
      driverAvailable?: boolean;
    }
  ): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'auth.supabase_not_configured' };
    }

    setIsLoading(true);

    const norm = normalizeMoroccanPhone(rawPhone);
    if (!norm.isValid) {
      setIsLoading(false);
      return { success: false, error: 'auth.phone_invalid' };
    }

    const syntheticEmail = phoneToSyntheticEmail(norm.e164);
    const resolvedRole: UserRole =
      role === 'owner' ? 'owner' : role === 'driver' ? 'driver' : 'client';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: pass,
        options: {
          data: {
            phone: norm.e164,
            phone_number: norm.e164,
            role: resolvedRole,
            full_name: meta?.fullName || '',
            company_name: meta?.companyName || '',
            city: meta?.city || 'Casablanca',
            client_segment: resolvedRole === 'client' ? meta?.clientSegment || 'individual' : undefined,
            client_activity_note: resolvedRole === 'client' ? meta?.clientActivityNote || '' : undefined,
            driver_machines: resolvedRole === 'driver' ? meta?.driverMachines || [] : undefined,
            driver_experience_years:
              resolvedRole === 'driver' ? meta?.driverExperienceYears || '3_5' : undefined,
            driver_available:
              resolvedRole === 'driver' ? meta?.driverAvailable ?? true : undefined,
            preferred_lang: 'ar',
          },
        },
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: mapSupabaseAuthError(error.message) };
      }

      let activeSession = data?.session;
      let activeUser = data?.user;

      // If data.session is null (e.g. if Supabase GoTrue hasn't returned a session on signUp),
      // attempt an immediate signInWithPassword in case the database trigger or setting auto-confirmed the account
      if (!activeSession) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: pass,
        });

        if (!signInErr && signInData?.session) {
          activeSession = signInData.session;
          activeUser = signInData.user;
        } else if (signInErr) {
          setIsLoading(false);
          return { success: false, error: mapSupabaseAuthError(signInErr.message) };
        }
      }

      if (!activeSession || !activeUser) {
        setIsLoading(false);
        return { success: false, error: 'auth.email_confirmation_required' };
      }

      // Retry fetchProfile up to 5 times (400 ms apart, DB trigger creates row)
      let loadedProfile: UserProfile | null = null;
      let lastProfileError: any = null;

      for (let attempt = 1; attempt <= 5; attempt++) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeUser.id)
          .maybeSingle();

        if (prof && !profErr) {
          loadedProfile = prof as UserProfile;
          break;
        }

        if (profErr) {
          lastProfileError = profErr;
        }

        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }

      // If DB trigger didn't create the profile or is delayed, attempt client-side creation
      if (!loadedProfile) {
        const isVipSignup = isLifetimeFreePhone(norm.e164);
        const newProfPayload: any = {
          id: activeUser.id,
          phone: norm.e164,
          phone_number: norm.e164,
          full_name: meta?.fullName || '',
          company_name: meta?.companyName || '',
          role: resolvedRole,
          city: meta?.city || 'Casablanca',
          whatsapp_verified: false,
          subscription_status: isVipSignup || resolvedRole !== 'owner' ? 'active' : 'trial',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          subscription_ends_at: isVipSignup ? '2099-12-31T23:59:59.000Z' : undefined,
          preferred_lang: 'ar',
          created_at: new Date().toISOString(),
        };

        const { data: insertedProf, error: insertErr } = await supabase
          .from('profiles')
          .upsert(newProfPayload)
          .select()
          .maybeSingle();

        if (insertedProf && !insertErr) {
          loadedProfile = insertedProf as UserProfile;
        } else if (insertErr) {
          console.warn('Profile creation fallback warning:', insertErr);
          // Try minimal payload without enum role in case 'driver' isn't migrated in Postgres yet
          try {
            const minPayload = {
              id: activeUser.id,
              phone: norm.e164,
              full_name: meta?.fullName || '',
              company_name: meta?.companyName || '',
              city: meta?.city || 'Casablanca',
              role: resolvedRole === 'owner' ? 'owner' : 'client',
            };
            const { data: minData } = await supabase
              .from('profiles')
              .upsert(minPayload)
              .select()
              .maybeSingle();
            if (minData) loadedProfile = minData as UserProfile;
          } catch (minErr) {
            console.warn('Minimal profile creation warning:', minErr);
          }
        }
      }

      if (!loadedProfile) {
        loadedProfile = {
          id: activeUser.id,
          phone: norm.e164,
          full_name: meta?.fullName || '',
          company_name: meta?.companyName || '',
          role: resolvedRole,
          client_segment: meta?.clientSegment,
          client_activity_note: meta?.clientActivityNote || '',
          driver_machines: resolvedRole === 'driver' ? meta?.driverMachines || [] : undefined,
          driver_experience_years:
            resolvedRole === 'driver' ? meta?.driverExperienceYears || '3_5' : undefined,
          driver_available: resolvedRole === 'driver' ? meta?.driverAvailable ?? true : undefined,
          city: meta?.city || 'Casablanca',
          whatsapp_verified: false,
          subscription_status: resolvedRole === 'owner' ? 'trial' : 'active',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          preferred_lang: 'ar',
          created_at: new Date().toISOString(),
        };
      } else {
        loadedProfile = {
          ...loadedProfile,
          role: resolvedRole === 'driver' ? 'driver' : loadedProfile.role,
          client_segment: loadedProfile.client_segment || meta?.clientSegment,
          client_activity_note: loadedProfile.client_activity_note || meta?.clientActivityNote || '',
          driver_machines:
            resolvedRole === 'driver'
              ? loadedProfile.driver_machines?.length
                ? loadedProfile.driver_machines
                : meta?.driverMachines || []
              : loadedProfile.driver_machines,
          driver_experience_years:
            resolvedRole === 'driver'
              ? loadedProfile.driver_experience_years || meta?.driverExperienceYears || '3_5'
              : loadedProfile.driver_experience_years,
          driver_available:
            resolvedRole === 'driver'
              ? loadedProfile.driver_available ?? meta?.driverAvailable ?? true
              : loadedProfile.driver_available,
        };
      }

      saveProfileLocally(loadedProfile);
      setUser(activeUser);

      // Auto-generate unique storefront slug for machinery owners
      if (role === 'owner') {
        const autoSlug = generateUniqueStorefrontSlug(meta?.companyName || meta?.fullName);
        if (activeUser?.id) {
          try {
            await saveStorefrontData({
              owner_id: activeUser.id,
              slug: autoSlug,
              whatsapp: norm.e164,
              theme_color: '#FFB400',
              banner_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1200&q=80',
              about_ar: 'شركة متخصصة في كراء آليات ومعدات الأشغال العمومية والبناء مع سائقين معتمدين.',
              about_fr: 'Entreprise spécialisée dans la location d\'engins de travaux publics au Maroc.',
            });
          } catch (e) {
            console.warn('Auto storefront slug creation notice:', e);
          }
        }
      }

      setIsLoading(false);
      return { success: true, isNewUser: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: mapSupabaseAuthError(err?.message || 'auth.signup_failed') };
    }
  };

  const logout = async () => {
    setUser(null);
    setProfile(null);
    setImpersonatedUser(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
      sessionStorage.removeItem('jadijcb_impersonate');
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      }
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch (err) {
      console.warn('Signout warning:', err);
    }
  };

  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const targetId = profile?.id || user?.id;
    if (!targetId) return { success: false, error: 'auth.auth_failed' };

    try {
      // 1. Filter only valid known SQL columns in public.profiles table
      const KNOWN_DB_COLUMNS = [
        'full_name',
        'company_name',
        'city',
        'role',
        'phone',
        'phone_number',
        'avatar_url',
        'whatsapp_verified',
        'subscription_status',
        'trial_started_at',
        'trial_ends_at',
        'subscription_ends_at',
        'preferred_lang',
        'driver_machines',
        'driver_experience_years',
        'driver_available',
        'driver_bio',
      ];

      const dbPayload: any = {};
      for (const col of KNOWN_DB_COLUMNS) {
        if (col in updates && (updates as any)[col] !== undefined) {
          dbPayload[col] = (updates as any)[col];
        }
      }

      if (updates.phone) {
        dbPayload.phone = updates.phone;
        dbPayload.phone_number = updates.phone;
      }

      // 2. Update Supabase auth user_metadata with ALL fields
      try {
        await supabase.auth.updateUser({
          data: {
            ...updates,
          },
        });
      } catch (authMetaErr) {
        console.warn('Could not update auth user_metadata:', authMetaErr);
      }

      // 3. Update public.profiles table
      let dbData: any = null;
      if (Object.keys(dbPayload).length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .update(dbPayload)
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Supabase profiles update warning:', error.message);
          // Fallback to minimal core columns if schema cache lacks newer columns or enum value
          const minimalPayload: any = {};
          if (updates.full_name !== undefined) minimalPayload.full_name = updates.full_name;
          if (updates.company_name !== undefined) minimalPayload.company_name = updates.company_name;
          if (updates.city !== undefined) minimalPayload.city = updates.city;

          if (Object.keys(minimalPayload).length > 0) {
            const { data: retryData } = await supabase
              .from('profiles')
              .update(minimalPayload)
              .eq('id', targetId)
              .select()
              .maybeSingle();
            dbData = retryData;
          }
        } else {
          dbData = data;
        }
      }

      // 4. Update local state and localStorage (always preserve resolved driver role & fields)
      const resolvedMergedRole =
        profile?.role === 'driver' && updates.role === undefined
          ? 'driver'
          : updates.role || profile?.role || 'client';

      const merged: UserProfile = {
        ...(profile || ({} as UserProfile)),
        ...(dbData || {}),
        ...updates,
        id: targetId,
        role: resolvedMergedRole,
        phone: updates.phone || profile?.phone || '',
        full_name: updates.full_name !== undefined ? updates.full_name : profile?.full_name || '',
        company_name: updates.company_name !== undefined ? updates.company_name : profile?.company_name || '',
        city: updates.city !== undefined ? updates.city : profile?.city || 'Casablanca',
        client_segment: updates.client_segment !== undefined ? updates.client_segment : profile?.client_segment,
        client_activity_note:
          updates.client_activity_note !== undefined
            ? updates.client_activity_note
            : profile?.client_activity_note || '',
        driver_machines:
          updates.driver_machines !== undefined ? updates.driver_machines : profile?.driver_machines || [],
        driver_experience_years:
          updates.driver_experience_years !== undefined
            ? updates.driver_experience_years
            : profile?.driver_experience_years,
        driver_available:
          updates.driver_available !== undefined
            ? updates.driver_available
            : profile?.driver_available ?? true,
        driver_bio: updates.driver_bio !== undefined ? updates.driver_bio : profile?.driver_bio || '',
        ice_number: updates.ice_number !== undefined ? updates.ice_number : profile?.ice_number || '',
        onboarding_completed:
          updates.onboarding_completed !== undefined
            ? updates.onboarding_completed
            : profile?.onboarding_completed ?? true,
      };

      saveProfileLocally(merged);
      window.dispatchEvent(new CustomEvent('jadijcb_profile_updated', { detail: merged }));

      return { success: true };
    } catch (err: any) {
      console.warn('updateProfile error:', err);
      const merged: UserProfile = {
        ...(profile || {} as UserProfile),
        ...updates,
        id: targetId,
      };
      saveProfileLocally(merged);
      return { success: true };
    }
  };

  const isSuperAdmin =
    Boolean(user) &&
    (isSuperAdminEmail(user?.email) || profile?.role === 'admin');

  const isAuthenticated = Boolean(user);
  const effectiveProfile = impersonatedUser || profile;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: effectiveProfile,
        isLoading,
        isAuthenticated,
        isSuperAdmin,
        impersonatedUser,
        isImpersonating: Boolean(impersonatedUser),
        loginWithPhone,
        loginWithEmail,
        loginAsSuperAdmin,
        impersonateUser,
        stopImpersonating,
        signupWithPhone,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default useAuth;
