// ============================================================================
// JADIJCB: Client Web Push & Background Sync Registration Utility
// Enables OS-level phone notification shade alerts even when app is closed.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function waitForServiceWorkerReady(
  timeoutMs: number = 2500
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing && (existing.active || existing.waiting || existing.installing)) {
      if (existing.active) return existing;
    }

    const readyOrTimeout = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready.then((reg) => reg).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (readyOrTimeout) return readyOrTimeout;

    // Fallback: register standalone sw-push.js if dev-sw didn't activate in time
    try {
      const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      return reg;
    } catch {
      return existing || null;
    }
  } catch {
    return null;
  }
}

export async function syncServiceWorkerPushContext(
  userId: string,
  userRole: string = 'owner'
): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) return;

  try {
    const reg = await waitForServiceWorkerReady(2500);
    if (!reg) return;

    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    let accessToken = '';

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getSession();
        accessToken = data?.session?.access_token || '';
      } catch {
        // ignore
      }
    }

    const payload = {
      ownerId: userId,
      userId,
      userRole,
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      updatedAt: Date.now(),
    };

    const targetSw = reg.active || reg.waiting || reg.installing || navigator.serviceWorker.controller;
    if (targetSw) {
      targetSw.postMessage({ type: 'SET_PUSH_CONTEXT', payload });
    }

    // Register Periodic Background Sync where supported (Chrome/Edge Android PWA)
    const anyReg = reg as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, options?: { minInterval: number }) => Promise<void>;
      };
    };
    if (anyReg.periodicSync && typeof anyReg.periodicSync.register === 'function') {
      try {
        await anyReg.periodicSync.register('jadijcb-opportunity-sync', {
          minInterval: 60 * 1000,
        });
      } catch {
        // Permission or browser policy may restrict periodicSync
      }
    }
  } catch {
    // ignore SW errors
  }
}

export async function markPushKeySeenInSW(key: string): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !key) return;
  try {
    const reg = await waitForServiceWorkerReady(1200);
    const targetSw = reg?.active || navigator.serviceWorker.controller;
    if (targetSw) {
      targetSw.postMessage({ type: 'MARK_PUSH_SEEN', key });
    }
  } catch {
    // ignore
  }
}

async function resolveVapidPublicKey(): Promise<string | null> {
  const envKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  if (envKey) return envKey;

  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.publicKey) return String(data.publicKey);
      }
    }
  } catch {
    // ignore on static-only deploy without /api
  }
  return null;
}

export async function subscribeOwnerWebPush(
  userId: string,
  userRole: string = 'owner'
): Promise<boolean> {
  if (typeof window === 'undefined' || !userId) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;

  await syncServiceWorkerPushContext(userId, userRole);

  if (!('PushManager' in window)) return false;

  try {
    const reg = await waitForServiceWorkerReady(3000);
    if (!reg || !reg.pushManager) return false;

    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = await resolveVapidPublicKey();
      if (!vapidPublicKey) return false;

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    if (!subscription) return false;
    const subJson = subscription.toJSON();
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';

    // 1. Persist to Express SQLite backend (when available)
    fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subscription: subJson,
      }),
    }).catch(() => {});

    // 2. Persist to Supabase public.push_subscriptions (when migration applied)
    if (isSupabaseConfigured && p256dh && auth) {
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent.slice(0, 180),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );
      } catch {
        // ignore if table not yet created
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function registerOwnerPushNotifications(
  userId: string,
  userRole: string = 'owner'
): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = 'default';
    }
  }

  if (perm === 'granted' && userId) {
    subscribeOwnerWebPush(userId, userRole).catch(() => {});
  }

  return perm;
}

export async function sendWebPushToUsers(params: {
  userIds: string[];
  title: string;
  body: string;
  tag: string;
  url?: string;
  id?: string;
  type?: string;
}): Promise<void> {
  if (!params.userIds || params.userIds.length === 0) return;

  try {
    let remoteSubs: any[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('user_id, endpoint, p256dh, auth')
          .in('user_id', params.userIds);
        if (Array.isArray(data)) {
          remoteSubs = data;
        }
      } catch {
        // ignore if table not yet created
      }
    }

    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_ids: params.userIds,
        subscriptions: remoteSubs,
        payload: {
          id: params.id || params.tag,
          type: params.type || 'chat_message',
          title: params.title,
          body: params.body,
          tag: params.tag,
          url: params.url || '/owner/messages',
          icon: '/pwa-icon-192.png',
        },
      }),
    }).catch(() => {});
  } catch {
    // ignore network failure
  }
}

export async function sendWebPushForDispatch(params: {
  ownerIds: string[];
  title: string;
  body: string;
  tag: string;
  url?: string;
}): Promise<void> {
  return sendWebPushToUsers({
    userIds: params.ownerIds,
    title: params.title,
    body: params.body,
    tag: params.tag,
    url: params.url || '/owner/messages',
    type: 'dispatch_opportunity',
  });
}
