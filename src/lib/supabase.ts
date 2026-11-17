import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabaseUrl = rawUrl || 'https://placeholder-jadijcb.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('placeholder')
);

const SUPABASE_FETCH_TIMEOUT_MS = 28000;

const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Supabase request timed out (28s)')), SUPABASE_FETCH_TIMEOUT_MS);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true });
    }
  }

  const getHost = () => {
    try {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return new URL(urlStr).host;
    } catch {
      return 'supabase';
    }
  };

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    if (res.status >= 500) {
      console.warn(`[Supabase] Server HTTP ${res.status} from ${getHost()}`);
    }
    return res;
  } catch (err: any) {
    console.warn(`[Supabase] Fetch error (${getHost()}):`, err?.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: timedFetch,
  },
});
