import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizeMoroccanPhone, phoneToSyntheticEmail } from '../lib/authHelpers';
import { UserProfile, UserRole } from '../types/database';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithPhone: (phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signupWithPhone: (
    phone: string,
    pass: string,
    role: UserRole,
    meta?: { fullName?: string; companyName?: string; city?: string }
  ) => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  setDemoSession: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const LOCAL_STORAGE_PROFILE_KEY = 'jadijcb_current_profile';

const DEFAULT_DEMO_OWNER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  phone: '+212661234567',
  full_name: 'Karim Benjelloun',
  company_name: 'Atlas Terrassement S.A.R.L.',
  role: 'owner',
  city: 'Casablanca',
  city_id: 'casablanca',
  ice_number: '001928471000032',
  whatsapp_verified: true,
  subscription_status: 'trial',
  // Active trial with 48 hours remaining for demo
  trial_started_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  trial_ends_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  preferred_lang: 'ar',
  onboarding_completed: true,
  created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
};

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
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_DEMO_OWNER;
    } catch {
      return DEFAULT_DEMO_OWNER;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const saveProfileLocally = (p: UserProfile | null) => {
    setProfile(p);
    if (p) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  };

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        saveProfileLocally(data as UserProfile);
      }
    } catch (err) {
      console.warn('Failed to fetch profile from Supabase:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          setUser(session.user);
          await fetchProfile(session.user.id);
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

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: pass,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          setUser(data.user);
          await fetchProfile(data.user.id);
          setIsLoading(false);
          return { success: true };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err?.message || 'auth.auth_failed' };
      }
    }

    // Demo/Offline Fallback
    const mockProfile: UserProfile = {
      id: 'demo-user-' + Date.now(),
      phone: norm.e164,
      full_name: 'مقاول مغربي',
      company_name: 'شركة أشغال البناء',
      role: 'owner',
      city: 'Casablanca',
      whatsapp_verified: true,
      subscription_status: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      preferred_lang: 'ar',
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };
    saveProfileLocally(mockProfile);
    setUser({ id: mockProfile.id, email: syntheticEmail });
    setIsLoading(false);
    return { success: true };
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

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: pass,
          options: {
            data: {
              phone: norm.e164,
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
          return { success: false, error: error.message };
        }

        if (data.user) {
          setUser(data.user);
          await fetchProfile(data.user.id);
          setIsLoading(false);
          return { success: true, isNewUser: true };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err?.message || 'auth.signup_failed' };
      }
    }

    // Demo/Offline Fallback for new sign-up: fresh 72h trial
    const newMockProfile: UserProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      phone: norm.e164,
      full_name: meta?.fullName || '',
      company_name: meta?.companyName || '',
      role,
      city: meta?.city || 'Casablanca',
      whatsapp_verified: false,
      subscription_status: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      preferred_lang: 'ar',
      onboarding_completed: false,
      created_at: new Date().toISOString(),
    };

    saveProfileLocally(newMockProfile);
    setUser({ id: newMockProfile.id, email: syntheticEmail });
    setIsLoading(false);
    return { success: true, isNewUser: true };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Signout warning:', err);
      }
    }
    setUser(null);
    saveProfileLocally(null);
  };

  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: 'No active profile' };

    const merged = { ...profile, ...updates };

    if (isSupabaseConfigured && profile.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id);

        if (error) {
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to update' };
      }
    }

    saveProfileLocally(merged);
    return { success: true };
  };

  const setDemoSession = (role: UserRole) => {
    const demoProfile: UserProfile = {
      id: role === 'admin' ? 'admin-demo-id' : 'demo-owner-' + role,
      phone: role === 'admin' ? '+212600000000' : '+212661234567',
      full_name:
        role === 'admin'
          ? 'المشرف العام (JADIJCB Admin)'
          : role === 'owner'
          ? 'كريم بنجلون (مالك آليات)'
          : 'مصطفى السعدي (مقاولة بناء)',
      company_name:
        role === 'admin'
          ? 'JADIJCB HQ Maroc'
          : role === 'owner'
          ? 'أطلس للآليات الثقيلة S.A.R.L'
          : 'شركة البناء الحديثة',
      role,
      city: 'Casablanca',
      city_id: 'casablanca',
      ice_number: '001928471000032',
      whatsapp_verified: true,
      subscription_status: role === 'admin' ? 'active' : 'trial',
      trial_started_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      trial_ends_at: new Date(Date.now() + 60 * 3600 * 1000).toISOString(),
      preferred_lang: 'ar',
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };

    saveProfileLocally(demoProfile);
    setUser({ id: demoProfile.id, email: phoneToSyntheticEmail(demoProfile.phone) });
  };

  const isAuthenticated = Boolean(user || profile);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated,
        loginWithPhone,
        signupWithPhone,
        logout,
        updateProfile,
        setDemoSession,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default useAuth;
