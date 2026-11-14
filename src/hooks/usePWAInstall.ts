import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level store so `beforeinstallprompt` is never lost across route changes
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  const checkStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  sharedIsInstalled = checkStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone !== sharedIsInstalled) {
      sharedIsInstalled = standalone;
      update();
    }

    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!sharedDeferredPrompt) return 'unavailable';
    try {
      await sharedDeferredPrompt.prompt();
      const { outcome } = await sharedDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        sharedIsInstalled = true;
        sharedDeferredPrompt = null;
        notifyListeners();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, []);

  return {
    isInstallable: !!sharedDeferredPrompt,
    isInstalled: sharedIsInstalled,
    isIOS,
    install,
  };
}
