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

function getDefaultMessagesBase(userRole) {
  if (userRole === 'driver') return '/driver/messages';
  return userRole === 'client' || userRole === 'contractor'
    ? '/entreprise/messages'
    : '/owner/messages';
}

async function displayShadeNotification(payload) {
  const ctx = await readCacheJson(PUSH_CTX_REQ, null);
  const isChat = payload.type === 'chat_message';
  const isDriverOffer = payload.type === 'driver_job_offer';
  const title =
    payload.title ||
    (isChat
      ? 'رسالة جديدة 💬'
      : isDriverOffer
      ? 'عرض عمل عاجل لسائق 👷'
      : 'فرصة جديدة 🎉');
  const body =
    payload.body ||
    (isChat
      ? 'لديك رسالة جديدة في المحادثة على JADIJCB'
      : isDriverOffer
      ? 'مالك آلية يبحث عن سائق محترف لآليتك على JADIJCB'
      : 'طلب كراء آلية قريب من موقعك على JADIJCB');
  const tag =
    payload.tag ||
    ((isChat
      ? 'jadijcb-chat-'
      : isDriverOffer
      ? 'driver-offer-'
      : 'jadijcb-dispatch-') + Date.now());
  const defaultBase = isDriverOffer ? '/driver/joboffer' : getDefaultMessagesBase(ctx && ctx.userRole);
  const targetUrl = payload.url || defaultBase;

  try {
    await self.registration.showNotification(title, {
      body,
      icon: payload.icon || '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: isChat ? [180, 70, 180] : [240, 100, 240, 100, 320],
      requireInteraction: !isChat,
      renotify: true,
      tag,
      data: {
        url: targetUrl,
        type: payload.type || 'dispatch_opportunity',
        ...(payload.data || {}),
      },
      actions: [
        {
          action: 'open',
          title: isChat
            ? 'رد أو فتح المحادثة'
            : isDriverOffer
            ? 'معاينة عرض العمل'
            : 'فتح المحادثة الآن',
        },
      ],
    });
  } catch {
    // ignore if notification permission revoked
  }
}

async function checkBackgroundDispatchAlerts() {
  const ctx = await readCacheJson(PUSH_CTX_REQ, null);
  const activeUserId = (ctx && (ctx.userId || ctx.ownerId)) || '';
  if (!activeUserId) return;

  const userRole = (ctx && ctx.userRole) || 'owner';
  const isContractorRole = userRole === 'client' || userRole === 'contractor';
  const isDriverRole = userRole === 'driver';
  const isDriverBusy = isDriverRole && ctx && ctx.driverAvailable === false;
  const driverMachines = Array.isArray(ctx && ctx.driverMachines) ? ctx.driverMachines : [];
  const messagesBase = getDefaultMessagesBase(userRole);

  const seenIds = await readCacheJson(PUSH_SEEN_REQ, []);
  const seenSet = new Set(Array.isArray(seenIds) ? seenIds : []);
  const newlyFound = [];

  // 1. Check Express /api/notifications if hosted on full-stack origin
  try {
    const apiRes = await fetch(
      `/api/notifications?user_id=${encodeURIComponent(activeUserId)}&role=${encodeURIComponent(userRole)}&unread_only=true`,
      { cache: 'no-store' }
    );
    if (apiRes.ok) {
      const json = await apiRes.json();
      const list = Array.isArray(json.notifications) ? json.notifications : [];
      for (const n of list) {
        if (!n || n.is_read) continue;
        if (n.type === 'dispatch_opportunity' && !isContractorRole && !isDriverRole && !seenSet.has(n.id)) {
          newlyFound.push({
            id: n.id,
            type: 'dispatch_opportunity',
            title: n.title_ar || 'فرصة جديدة 🎉',
            body: n.body_ar || 'طلب آلية جديد قريب من موقعك',
            tag: (n.data && n.data.campaign_id) || n.id,
            url: `/owner/messages?target=${(n.data && n.data.contractor_id) || ''}&machine=${(n.data && n.data.machine_id) || ''}&campaign=${(n.data && n.data.campaign_id) || ''}`,
          });
        } else if (n.type === 'driver_job_offer' && isDriverRole && !isDriverBusy && !seenSet.has(n.id)) {
          const offerKey = (n.data && n.data.offer_id) ? `driver-offer-${n.data.offer_id}` : n.id;
          if (!seenSet.has(offerKey)) {
            newlyFound.push({
              id: n.id,
              type: 'driver_job_offer',
              title: n.title_ar || 'عرض عمل عاجل لسائق 👷',
              body: n.body_ar || 'مالك آلية يبحث عن سائق محترف لآليتك على JADIJCB',
              tag: offerKey,
              url: (n.data && n.data.offer_id)
                ? `/driver/joboffer?offer=${encodeURIComponent(n.data.offer_id)}`
                : '/driver/joboffer',
            });
          }
        } else if (n.type === 'chat_message') {
          const msgKey = (n.data && n.data.message_id) || n.id;
          if (!seenSet.has(n.id) && !seenSet.has(msgKey)) {
            const convId = (n.data && n.data.conversation_id) || '';
            newlyFound.push({
              id: msgKey,
              type: 'chat_message',
              title: n.title_ar || 'رسالة جديدة 💬',
              body: n.body_ar || 'لديك رسالة جديدة في المحادثة',
              tag: convId ? `jadijcb-chat-${convId}` : msgKey,
              url: convId ? `${messagesBase}?conv=${encodeURIComponent(convId)}` : messagesBase,
            });
          }
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
        activeUserId
      )}&is_read=eq.false&order=created_at.desc&limit=15`;
      const res = await fetch(notifUrl, { headers, cache: 'no-store' });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          for (const r of rows) {
            const d = r.data || {};
            if (r.type === 'dispatch_opportunity' && !isContractorRole && !isDriverRole) {
              const key = d.campaign_id || r.id;
              if (!seenSet.has(r.id) && !seenSet.has(key)) {
                newlyFound.push({
                  id: r.id,
                  type: 'dispatch_opportunity',
                  title: r.title_ar || 'فرصة جديدة 🎉',
                  body:
                    r.body_ar ||
                    `«${d.company_name || 'مقاولة'}» محتاجة «${d.machine_name || 'آلية'}» ديالك`,
                  tag: key,
                  url: `/owner/messages?target=${d.contractor_id || ''}&machine=${d.machine_id || ''}&campaign=${d.campaign_id || ''}`,
                });
              }
            } else if (r.type === 'driver_job_offer' && isDriverRole && !isDriverBusy) {
              const key = d.offer_id ? `driver-offer-${d.offer_id}` : r.id;
              if (!seenSet.has(r.id) && !seenSet.has(key)) {
                newlyFound.push({
                  id: r.id,
                  type: 'driver_job_offer',
                  title: r.title_ar || 'عرض عمل عاجل لسائق 👷',
                  body:
                    r.body_ar ||
                    `مطلوب سائق: ${d.machine_label_ar || 'آلية بناء'} · ${d.offered_salary || ''} درهم`,
                  tag: key,
                  url: d.offer_id ? `/driver/joboffer?offer=${encodeURIComponent(d.offer_id)}` : '/driver/joboffer',
                });
              }
            } else if (r.type === 'chat_message') {
              const msgKey = d.message_id || r.id;
              const convId = d.conversation_id || '';
              if (!seenSet.has(r.id) && !seenSet.has(msgKey)) {
                newlyFound.push({
                  id: msgKey,
                  type: 'chat_message',
                  title: r.title_ar || 'رسالة جديدة 💬',
                  body: r.body_ar || 'لديك رسالة جديدة في المحادثة',
                  tag: convId ? `jadijcb-chat-${convId}` : msgKey,
                  url: convId ? `${messagesBase}?conv=${encodeURIComponent(convId)}` : messagesBase,
                });
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (!isContractorRole && !isDriverRole) {
      try {
        const dispUrl = `${ctx.supabaseUrl}/rest/v1/dispatch_notifications?owner_id=eq.${encodeURIComponent(
          activeUserId
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
                  type: 'dispatch_opportunity',
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

    if (isDriverRole && !isDriverBusy) {
      try {
        const drvOffersUrl = `${ctx.supabaseUrl}/rest/v1/driver_job_offers?status=eq.open&order=created_at.desc&limit=10`;
        const res = await fetch(drvOffersUrl, { headers, cache: 'no-store' });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows)) {
            for (const o of rows) {
              const matchesMachine =
                driverMachines.length === 0 || driverMachines.includes(o.machine_category);
              const tag = `driver-offer-${o.id}`;
              if (matchesMachine && !seenSet.has(o.id) && !seenSet.has(tag)) {
                const salaryText =
                  Number(o.offered_salary) > 0
                    ? `${Number(o.offered_salary).toLocaleString('fr-FR')} درهم/${o.salary_unit === 'month' ? 'شهر' : 'يوم'}`
                    : '';
                newlyFound.push({
                  id: o.id,
                  type: 'driver_job_offer',
                  title: `فرصة عمل لسائق: ${o.machine_label_ar} 👷`,
                  body: [salaryText, o.duration_label, o.owner_company || o.owner_name]
                    .filter(Boolean)
                    .join(' · '),
                  tag,
                  url: `/driver/joboffer?offer=${encodeURIComponent(o.id)}`,
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  for (const item of newlyFound) {
    seenSet.add(item.id);
    if (
      item.tag &&
      (item.type === 'dispatch_opportunity' || item.type === 'driver_job_offer')
    ) {
      seenSet.add(item.tag);
    }
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
      const ctx = await readCacheJson(PUSH_CTX_REQ, null);
      if (
        payload &&
        payload.type === 'driver_job_offer' &&
        ctx &&
        ctx.userRole === 'driver' &&
        ctx.driverAvailable === false
      ) {
        return;
      }
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
    event.waitUntil(
      (async () => {
        const prev = await readCacheJson(PUSH_CTX_REQ, {});
        const mergedPayload = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          ...msg.payload,
          driverMachines: Array.isArray(msg.payload.driverMachines)
            ? msg.payload.driverMachines
            : Array.isArray(prev && prev.driverMachines)
            ? prev.driverMachines
            : [],
          driverAvailable:
            typeof msg.payload.driverAvailable === 'boolean'
              ? msg.payload.driverAvailable
              : typeof (prev && prev.driverAvailable) === 'boolean'
              ? prev.driverAvailable
              : true,
        };
        await writeCacheJson(PUSH_CTX_REQ, mergedPayload);
      })()
    );
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
