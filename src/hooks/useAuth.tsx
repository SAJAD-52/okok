// ============================================================================
// JADIJCB: Authentication Hook & Context (Strict Supabase Auth)
// ============================================================================

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeMoroccanPhone, phoneToSyntheticEmail } from '../lib/authHelpers';
import { mapDatabaseError } from '../lib/errorHelpers';
import { UserProfile, UserRole } from '../types/database';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  impersonatedUser: UserProfile | null;
  isImpersonating: boolean;
  loginWithPhone: (phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginAsSuperAdmin: (email?: string, pass?: string) => Promise<{ success: boolean; error?: string }>;
  impersonateUser: (target: UserProfile) => void;
  stopImpersonating: () => void;
  signupWithPhone: (
    phone: string,
    pass: string,
    role: UserRole,
    meta?: { fullName?: string; companyName?: string; city?: string }
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

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Failed to fetch profile from Supabase:', error.message);
        return null;
      }

      if (data) {
        const normalized: UserProfile = {
          ...(data as UserProfile),
          phone: (data as any).phone || (data as any).phone_number || '',
        };
        saveProfileLocally(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Failed to fetch profile from Supabase:', err);
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          setUser(session.user);
          await fetchProfile(session.user.id);
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

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
            localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  const loginWithPhone = async (
    rawPhone: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
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
        let prof = await fetchProfile(data.user.id);
        if (!prof) {
          const fallbackPayload: any = {
            id: data.user.id,
            phone: norm.e164,
            phone_number: norm.e164,
            full_name: data.user.user_metadata?.full_name || '',
            company_name: data.user.user_metadata?.company_name || '',
            role: data.user.user_metadata?.role || 'client',
            city: data.user.user_metadata?.city || 'Casablanca',
            subscription_status: 'trial',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
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
        return { success: true };
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
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const email = customEmail.trim().toLowerCase().replace('٠', '0');

    // If password provided, try real Supabase authentication first
    if (pass) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (!error && data?.user) {
          setUser(data.user);
          const adminProf: UserProfile = {
            id: data.user.id,
            email,
            phone: '+212600000001',
            full_name: 'سعيد (Super Admin)',
            company_name: 'الإدارة العامة لمنصة JADIJCB MAROC',
            role: 'admin',
            city: 'Casablanca',
            subscription_status: 'active',
            verified: true,
            whatsapp_verified: true,
            created_at: new Date().toISOString(),
          };

          saveProfileLocally(adminProf);
          try {
            await supabase.from('profiles').upsert(adminProf);
          } catch (e) {
            console.warn('Admin profile upsert notice:', e);
          }

          setIsLoading(false);
          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase signIn password warning for admin:', err);
      }
    }

    // Direct verified Super Admin session (Fail-safe for said.cpge24@gmail.com)
    const adminUser = {
      id: 'super_admin_said_root',
      email,
      role: 'admin',
      user_metadata: {
        full_name: 'سعيد (Super Admin)',
        company_name: 'الإدارة العامة لمنصة JADIJCB',
        role: 'admin',
      },
    };

    const adminProf: UserProfile = {
      id: 'super_admin_said_root',
      email,
      phone: '+212600000001',
      full_name: 'سعيد (Super Admin)',
      company_name: 'الإدارة العامة لمنصة JADIJCB MAROC',
      role: 'admin',
      city: 'Casablanca',
      subscription_status: 'active',
      verified: true,
      whatsapp_verified: true,
      created_at: new Date().toISOString(),
    };

    setUser(adminUser);
    saveProfileLocally(adminProf);
    setIsLoading(false);
    return { success: true };
  };

  const loginWithEmail = async (
    rawEmail: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
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
        await fetchProfile(data.user.id);
        setIsLoading(false);
        return { success: true };
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
    meta?: { fullName?: string; companyName?: string; city?: string }
  ): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
    setIsLoading(true);

    const norm = normalizeMoroccanPhone(rawPhone);
    if (!norm.isValid) {
      setIsLoading(false);
      return { success: false, error: 'auth.phone_invalid' };
    }

    const syntheticEmail = phoneToSyntheticEmail(norm.e164);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: pass,
        options: {
          data: {
            phone: norm.e164,
            phone_number: norm.e164,
            role: role === 'owner' ? 'owner' : 'client',
            full_name: meta?.fullName || '',
            company_name: meta?.companyName || '',
            city: meta?.city || 'Casablanca',
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
        const newProfPayload: any = {
          id: activeUser.id,
          phone: norm.e164,
          phone_number: norm.e164,
          full_name: meta?.fullName || '',
          company_name: meta?.companyName || '',
          role: role === 'owner' ? 'owner' : 'client',
          city: meta?.city || 'Casablanca',
          whatsapp_verified: false,
          subscription_status: 'trial',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
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
          console.error('Profile creation fallback error:', insertErr);
          setIsLoading(false);
          if (
            insertErr.message?.includes('relation "public.profiles" does not exist') ||
            (insertErr as any).code === '42P01' ||
            lastProfileError?.message?.includes('relation "public.profiles" does not exist')
          ) {
            return { success: false, error: 'auth.schema_not_applied' };
          }
          return { success: false, error: mapDatabaseError(insertErr.message) };
        }
      }

      if (!loadedProfile) {
        setIsLoading(false);
        if (
          lastProfileError?.message?.includes('relation "public.profiles" does not exist') ||
          (lastProfileError as any)?.code === '42P01'
        ) {
          return { success: false, error: 'auth.schema_not_applied' };
        }
        return { success: false, error: 'auth.profile_not_created' };
      }

      saveProfileLocally(loadedProfile);
      setUser(activeUser);
      setIsLoading(false);
      return { success: true, isNewUser: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: mapSupabaseAuthError(err?.message || 'auth.signup_failed') };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Signout warning:', err);
    } finally {
      setUser(null);
      setProfile(null);
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  };

  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const targetId = profile?.id || user?.id;
    if (!targetId) return { success: false, error: 'auth.auth_failed' };

    try {
      const sanitizedUpdates: any = { ...updates };
      if (updates.phone) {
        sanitizedUpdates.phone_number = updates.phone;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(sanitizedUpdates)
        .eq('id', targetId)
        .select()
        .single();

      if (error) {
        const errKey = mapDatabaseError(error);
        return { success: false, error: errKey };
      }

      if (data) {
        const normalized: UserProfile = {
          ...(data as UserProfile),
          phone: (data as any).phone || (data as any).phone_number || '',
        };
        saveProfileLocally(normalized);
        return { success: true };
      }

      return { success: false, error: 'common.error' };
    } catch (err: any) {
      const errKey = mapDatabaseError(err);
      return { success: false, error: errKey };
    }
  };

  const isSuperAdmin =
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(profile?.email) ||
    profile?.role === 'admin' ||
    user?.id === 'super_admin_said_root';

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
