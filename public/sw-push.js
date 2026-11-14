// ============================================================================
// JADIJCB: Service Worker Background Push & Notification Shade Handler
// Imported into Workbox SW so lockscreen / system tray alerts appear even when
// the user is outside the app or the browser tab is closed/backgrounded.
// ============================================================================

const PUSH_CTX_CACHE = 'jadijcb-push-ctx-v1';
const PUSH_CTX_REQ = '/__jadijcb_push_ctx__';
const PUSH_SEEN_REQ = '/__jadijcb_pushed_ids__';

async function readCacheJson(keyReq, fallback) {
  try {
    const cache = await caches.open(PUSH_CTX_CACHE);
    const res = await cache.match(keyReq);
    if (!res) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function writeCacheJson(keyReq, data) {
  try {
    const cache = await caches.open(PUSH_CTX_CACHE);
    await cache.put(
      keyReq,
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch {
    // ignore storage errors
  }
}

async function displayShadeNotification(payload) {
  const title = payload.title || 'فرصة جديدة 🎉';
  const body = payload.body || 'طلب كراء آلية قريب من موقعك على JADIJCB';
  const tag = payload.tag || 'jadijcb-dispatch-' + Date.now();
  const targetUrl = payload.url || '/owner/messages';

  try {
    await self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [240, 100, 240, 100, 320],
      requireInteraction: true,
      renotify: true,
      tag,
      data: {
        url: targetUrl,
        ...(payload.data || {}),
      },
      actions: [
        { action: 'open', title: 'فتح المحادثة الآن' },
      ],
    });
  } catch {
    // ignore if notification permission revoked
  }
}

async function checkBackgroundDispatchAlerts() {
  const ctx = await readCacheJson(PUSH_CTX_REQ, null);
  if (!ctx || !ctx.ownerId) return;

  const seenIds = await readCacheJson(PUSH_SEEN_REQ, []);
  const seenSet = new Set(Array.isArray(seenIds) ? seenIds : []);
  const newlyFound = [];

  // 1. Check Express /api/notifications if hosted on full-stack origin
  try {
    const apiRes = await fetch(
      `/api/notifications?user_id=${encodeURIComponent(ctx.ownerId)}&unread_only=true`,
      { cache: 'no-store' }
    );
    if (apiRes.ok) {
      const json = await apiRes.json();
      const list = Array.isArray(json.notifications) ? json.notifications : [];
      for (const n of list) {
        if (n && !n.is_read && n.type === 'dispatch_opportunity' && !seenSet.has(n.id)) {
          newlyFound.push({
            id: n.id,
            title: n.title_ar || 'فرصة جديدة 🎉',
            body: n.body_ar || 'طلب آلية جديد قريب من موقعك',
            tag: (n.data && n.data.campaign_id) || n.id,
            url: `/owner/messages?target=${(n.data && n.data.contractor_id) || ''}&machine=${(n.data && n.data.machine_id) || ''}&campaign=${(n.data && n.data.campaign_id) || ''}`,
          });
        }
      }
    }
  } catch {
    // Vercel static or offline
  }

  // 2. Check Supabase REST unread notifications directly using saved auth context
  if (ctx.supabaseUrl && ctx.supabaseAnonKey) {
    const headers = {
      apikey: ctx.supabaseAnonKey,
      Authorization: `Bearer ${ctx.accessToken || ctx.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const notifUrl = `${ctx.supabaseUrl}/rest/v1/notifications?user_id=eq.${encodeURIComponent(
        ctx.ownerId
      )}&type=eq.dispatch_opportunity&is_read=eq.false&order=created_at.desc&limit=10`;
      const res = await fetch(notifUrl, { headers, cache: 'no-store' });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          for (const r of rows) {
            const d = r.data || {};
            const key = d.campaign_id || r.id;
            if (!seenSet.has(r.id) && !seenSet.has(key)) {
              newlyFound.push({
                id: r.id,
                title: r.title_ar || 'فرصة جديدة 🎉',
                body:
                  r.body_ar ||
                  `«${d.company_name || 'مقاولة'}» محتاجة «${d.machine_name || 'آلية'}» ديالك`,
                tag: key,
                url: `/owner/messages?target=${d.contractor_id || ''}&machine=${d.machine_id || ''}&campaign=${d.campaign_id || ''}`,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const dispUrl = `${ctx.supabaseUrl}/rest/v1/dispatch_notifications?owner_id=eq.${encodeURIComponent(
        ctx.ownerId
      )}&is_read=eq.false&status=eq.sent&order=created_at.desc&limit=10`;
      const res = await fetch(dispUrl, { headers, cache: 'no-store' });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          for (const d of rows) {
            const key = d.campaign_id || d.id;
            if (!seenSet.has(d.id) && !seenSet.has(key)) {
              newlyFound.push({
                id: d.id,
                title: 'فرصة جديدة 🎉',
                body: `«${d.company_name || 'مقاولة'}» محتاجة «${d.machine_name || 'آلية'}» ديالك`,
                tag: key,
                url: `/owner/messages?target=${d.contractor_id || ''}&machine=${d.machine_id || ''}&campaign=${d.campaign_id || ''}`,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  for (const item of newlyFound) {
    seenSet.add(item.id);
    if (item.tag) seenSet.add(item.tag);
    await displayShadeNotification(item);
  }

  if (newlyFound.length > 0) {
    await writeCacheJson(PUSH_SEEN_REQ, Array.from(seenSet).slice(-150));
  }
}

// 1. Incoming Web Push Event (works even when app is completely closed)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch {
      payload = {};
    }
  }

  event.waitUntil(
    (async () => {
      if (payload && payload.id) {
        const seenIds = await readCacheJson(PUSH_SEEN_REQ, []);
        const seenSet = new Set(Array.isArray(seenIds) ? seenIds : []);
        seenSet.add(payload.id);
        if (payload.tag) seenSet.add(payload.tag);
        await writeCacheJson(PUSH_SEEN_REQ, Array.from(seenSet).slice(-150));
      }
      await displayShadeNotification(payload);
    })()
  );
});

// 2. Notification Tap -> Open or Focus App directly on target conversation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/owner/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Periodic & Background Sync when OS wakes Service Worker
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'jadijcb-opportunity-sync') {
    event.waitUntil(checkBackgroundDispatchAlerts());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'jadijcb-opportunity-sync') {
    event.waitUntil(checkBackgroundDispatchAlerts());
  }
});

// 4. Messages from Open Client Tabs
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SET_PUSH_CONTEXT' && msg.payload) {
    event.waitUntil(writeCacheJson(PUSH_CTX_REQ, msg.payload));
  } else if (msg.type === 'MARK_PUSH_SEEN' && msg.key) {
    event.waitUntil(
      (async () => {
        const seenIds = await readCacheJson(PUSH_SEEN_REQ, []);
        const seenSet = new Set(Array.isArray(seenIds) ? seenIds : []);
        seenSet.add(msg.key);
        await writeCacheJson(PUSH_SEEN_REQ, Array.from(seenSet).slice(-150));
      })()
    );
  } else if (msg.type === 'SHOW_LOCAL_NOTIF' && msg.payload) {
    event.waitUntil(displayShadeNotification(msg.payload));
  } else if (msg.type === 'CHECK_DISPATCH_NOW') {
    event.waitUntil(checkBackgroundDispatchAlerts());
  }
});
