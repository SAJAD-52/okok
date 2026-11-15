// ============================================================================
// JADIJCB: Audio Chime & Mobile/Browser Push Notification Utility
// Dual-layer audio (HTML5 WAV + Web Audio API) + timeout-safe SW notification
// ============================================================================

import { markPushKeySeenInSW, waitForServiceWorkerReady } from './pushService';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlockInstalled = false;
let chatAudioEl: HTMLAudioElement | null = null;
let chatWavUrl: string | null = null;

// Build a crisp two-note chime WAV in memory (works reliably even when AudioContext is throttled)
function getChatWavDataUrl(): string | null {
  if (chatWavUrl) return chatWavUrl;
  if (typeof window === 'undefined') return null;

  try {
    const sampleRate = 22050;
    const durationSec = 0.42;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Note 1: 659.25 Hz (0s -> 0.16s)
      if (t < 0.17) {
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 14);
        sample += Math.sin(2 * Math.PI * 659.25 * t) * 0.55 * env;
        sample += Math.sin(2 * Math.PI * 1318.5 * t) * 0.18 * env;
      }

      // Note 2: 880 Hz (0.11s -> 0.42s)
      if (t >= 0.11) {
        const dt = t - 0.11;
        const env = Math.min(1, dt / 0.01) * Math.exp(-dt * 9);
        sample += Math.sin(2 * Math.PI * 880 * dt) * 0.65 * env;
        sample += Math.sin(2 * Math.PI * 1760 * dt) * 0.2 * env;
      }

      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, clamped * 32767, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    chatWavUrl = `data:audio/wav;base64,${window.btoa(binary)}`;
    return chatWavUrl;
  } catch {
    return null;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

    if (!chatAudioEl && typeof Audio !== 'undefined') {
      const url = getChatWavDataUrl();
      if (url) {
        chatAudioEl = new Audio(url);
        chatAudioEl.preload = 'auto';
        chatAudioEl.volume = 0.01;
        chatAudioEl
          .play()
          .then(() => {
            if (chatAudioEl) {
              chatAudioEl.pause();
              chatAudioEl.currentTime = 0;
              chatAudioEl.volume = 0.9;
            }
          })
          .catch(() => {
            if (chatAudioEl) chatAudioEl.volume = 0.9;
          });
      }
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
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([220, 90, 220, 90, 320]);
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.11;
      const duration = idx === notes.length - 1 ? 0.55 : 0.24;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.02);
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
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([160, 70, 160]);
    }

    // 1. Primary: HTML5 pre-generated WAV Audio (louder & survives WebAudio suspension)
    let htmlPlayed = false;
    try {
      const wav = getChatWavDataUrl();
      if (wav && typeof Audio !== 'undefined') {
        const player = chatAudioEl || new Audio(wav);
        player.volume = 0.9;
        player.currentTime = 0;
        const playPromise = player.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              htmlPlayed = true;
            })
            .catch(() => {});
        }
        htmlPlayed = true;
      }
    } catch {
      // fallback to Web Audio API below
    }

    // 2. Web Audio API synthesis fallback / reinforcement
    const ctx = getAudioContext();
    if (!ctx) return;

    const triggerTone = () => {
      if (htmlPlayed && ctx.state === 'suspended') return;
      const now = ctx.currentTime;
      const notes = [
        { freq: 659.25, delay: 0, duration: 0.16, peak: htmlPlayed ? 0.12 : 0.28 },
        { freq: 880.0, delay: 0.11, duration: 0.3, peak: htmlPlayed ? 0.15 : 0.32 },
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
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  markPushKeySeenInSW(params.tag).catch(() => {});

  const targetUrl = params.url || '/owner/messages';
  const swOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
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
    const reg = await waitForServiceWorkerReady(1800);
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(params.title, swOptions);
      return true;
    }
    const swTarget = reg?.active || navigator.serviceWorker?.controller;
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
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const notif = new Notification(params.title, {
      body: params.body,
      icon: '/pwa-icon-192.png',
      tag: params.tag,
      dir: 'rtl',
      lang: 'ar',
      data: { url: targetUrl },
    });
    notif.onclick = () => {
      window.focus();
      window.location.href = targetUrl;
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function showBrowserChatNotification(params: {
  title: string;
  body: string;
  tag: string;
  url: string;
  messageId?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  if (params.messageId) {
    markPushKeySeenInSW(params.messageId).catch(() => {});
  }

  const swOptions: NotificationOptions & {
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
    const reg = await waitForServiceWorkerReady(1800);
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(params.title, swOptions);
      return true;
    }
    const swTarget = reg?.active || navigator.serviceWorker?.controller;
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
      return true;
    }
  } catch {
    // Fall back to direct window Notification API (without actions!)
  }

  try {
    const notif = new Notification(params.title, {
      body: params.body,
      icon: '/pwa-icon-192.png',
      tag: params.tag,
      dir: 'rtl',
      lang: 'ar',
      data: { url: params.url, type: 'chat_message', messageId: params.messageId },
    });
    notif.onclick = () => {
      window.focus();
      window.location.href = params.url;
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}
