// ============================================================================
// JADIJCB: Audio Chime & Mobile/Browser Push Notification Utility
// Synthesizes crisp celebration alert sound via Web Audio API + OS/PWA notify
// ============================================================================

import { markPushKeySeenInSW } from './pushService';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlockInstalled = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function unlockAudioContextNow(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function installAudioUnlocker() {
  if (typeof window === 'undefined' || audioUnlockInstalled) return;
  audioUnlockInstalled = true;

  const unlock = () => {
    unlockAudioContextNow();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

export function playOpportunitySound(): void {
  try {
    // Vibrate on mobile devices
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([220, 90, 220, 90, 320]);
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Celebratory 4-note ascending chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.11;
      const duration = idx === notes.length - 1 ? 0.55 : 0.24;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  } catch {
    // Ignore audio context errors on restricted devices
  }
}

export function playChatMessageSound(): void {
  try {
    // Crisp mobile vibration pattern for incoming chat message
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([140, 60, 140]);
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const triggerTone = () => {
      const now = ctx.currentTime;
      // Clean two-note WhatsApp/Messenger style double-ping (E5 -> A5)
      const notes = [
        { freq: 659.25, delay: 0, duration: 0.16, peak: 0.2 },
        { freq: 880.0, delay: 0.11, duration: 0.28, peak: 0.24 },
      ];

      notes.forEach((note) => {
        const startTime = now + note.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(note.peak, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + note.duration + 0.02);
      });
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          triggerTone();
        })
        .catch(() => {});
    } else {
      triggerTone();
    }
  } catch {
    // Ignore audio context errors on restricted devices
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

export async function showBrowserOpportunityNotification(params: {
  title: string;
  body: string;
  tag: string;
  url?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  markPushKeySeenInSW(params.tag).catch(() => {});

  const targetUrl = params.url || '/owner/messages';
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: params.body,
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: params.tag,
    vibrate: [220, 90, 220, 90, 260],
    requireInteraction: true,
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    data: { url: targetUrl },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, options);
        return;
      }
      const swTarget = reg?.active || navigator.serviceWorker.controller;
      if (swTarget) {
        swTarget.postMessage({
          type: 'SHOW_LOCAL_NOTIF',
          payload: {
            title: params.title,
            body: params.body,
            tag: params.tag,
            url: targetUrl,
          },
        });
        return;
      }
    }
    const notif = new Notification(params.title, options);
    notif.onclick = () => {
      window.focus();
      window.location.href = targetUrl;
      notif.close();
    };
  } catch {
    // Fallback silent if browser blocks direct Notification constructor
  }
}

export async function showBrowserChatNotification(params: {
  title: string;
  body: string;
  tag: string;
  url: string;
  messageId?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if (params.messageId) {
    markPushKeySeenInSW(params.messageId).catch(() => {});
  }

  const options: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
    actions?: { action: string; title: string }[];
  } = {
    body: params.body,
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: params.tag,
    vibrate: [180, 70, 180],
    requireInteraction: false,
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    data: { url: params.url, type: 'chat_message', messageId: params.messageId },
    actions: [{ action: 'open', title: 'رد الآن / فتح المحادثة' }],
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, options);
        return;
      }
      const swTarget = reg?.active || navigator.serviceWorker.controller;
      if (swTarget) {
        swTarget.postMessage({
          type: 'SHOW_LOCAL_NOTIF',
          payload: {
            id: params.messageId || params.tag,
            type: 'chat_message',
            title: params.title,
            body: params.body,
            tag: params.tag,
            url: params.url,
          },
        });
        return;
      }
    }
    const notif = new Notification(params.title, options);
    notif.onclick = () => {
      window.focus();
      window.location.href = params.url;
      notif.close();
    };
  } catch {
    // Ignore restricted Notification API errors
  }
}
