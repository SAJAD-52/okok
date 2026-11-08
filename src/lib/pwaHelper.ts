// ============================================================================
// JADIJCB: PWA Basics & User Activity Heartbeat (last_active_at throttled 1h)
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

const LAST_ACTIVE_KEY = 'jadijcb_last_active_ping';

export function recordUserActivityThrottled(userId: string) {
  if (!userId) return;

  try {
    const lastPing = localStorage.getItem(`${LAST_ACTIVE_KEY}_${userId}`);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    if (lastPing && now - Number(lastPing) < ONE_HOUR) {
      return; // Throttled
    }

    localStorage.setItem(`${LAST_ACTIVE_KEY}_${userId}`, String(now));

    if (isSupabaseConfigured) {
      const iso = new Date().toISOString();
      (async () => {
        try {
          await supabase.from('profiles').update({ last_active_at: iso }).eq('id', userId);
        } catch {
          // Ignore
        }
      })();
    }
  } catch {
    // Ignore storage issues
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return { isInstallable, isInstalled, promptInstall };
}
