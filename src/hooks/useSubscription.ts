import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { URGENT_HOURS_THRESHOLD } from '../lib/constants';
import { SubscriptionStatus } from '../types/database';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  isLocked: boolean;
  isUrgent: boolean;
  remainingSeconds: number;
  formattedCountdown: string;
  hours: number;
  minutes: number;
  seconds: number;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
}

export function useSubscription(): SubscriptionInfo {
  const { profile, user } = useAuth();
  const [now, setNow] = useState<number>(Date.now());

  // Update clock every minute (or on tab focus) to prevent constant re-renders across DashboardLayout
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return useMemo(() => {
    // If user is admin, they are never locked and always active
    if (profile?.role === 'admin') {
      return {
        status: 'active',
        isTrial: false,
        isActive: true,
        isExpired: false,
        isLocked: false,
        isUrgent: false,
        remainingSeconds: 86400 * 365,
        formattedCountdown: '∞',
        hours: 999,
        minutes: 0,
        seconds: 0,
        trialEndsAt: null,
        subscriptionEndsAt: new Date(Date.now() + 86400000 * 365),
      };
    }

    const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const subscriptionEndsAt = profile?.subscription_ends_at
      ? new Date(profile.subscription_ends_at)
      : null;

    let status: SubscriptionStatus = profile?.subscription_status || 'trial';

    // Target expiry date calculation
    let targetExpiry: Date | null = null;
    if (status === 'active' && subscriptionEndsAt) {
      targetExpiry = subscriptionEndsAt;
    } else if (trialEndsAt) {
      targetExpiry = trialEndsAt;
    } else {
      // Default to 72 hours from profile creation if missing
      const base = profile?.created_at ? new Date(profile.created_at) : new Date();
      targetExpiry = new Date(base.getTime() + 72 * 60 * 60 * 1000);
    }

    const diffMs = targetExpiry ? targetExpiry.getTime() - now : 0;
    const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));

    const isExpired = remainingSeconds <= 0 && status !== 'active';
    const isLocked = isExpired;
    const isTrial = status === 'trial' && !isExpired;
    const isActive = status === 'active' && (!subscriptionEndsAt || subscriptionEndsAt.getTime() > now);

    // Urgent if remaining trial time is under 6 hours and still positive
    const isUrgent = isTrial && remainingSeconds > 0 && remainingSeconds <= URGENT_HOURS_THRESHOLD * 3600;

    const totalHours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedCountdown = `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;

    return {
      status: isLocked ? 'expired' : status,
      isTrial,
      isActive,
      isExpired,
      isLocked,
      isUrgent,
      remainingSeconds,
      formattedCountdown,
      hours: totalHours,
      minutes,
      seconds,
      trialEndsAt,
      subscriptionEndsAt,
    };
  }, [profile, user, now]);
}

export default useSubscription;
