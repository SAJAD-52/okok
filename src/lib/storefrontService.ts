// ============================================================================
// JADIJCB: Storefront Persistence Service
// Handles storage with graceful fallbacks (Cloud Auth Metadata + LocalStorage)
// when public.storefronts table is not yet present in Supabase schema cache.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { generateUniqueStorefrontSlug } from './storefrontSlug';

export interface StorefrontData {
  owner_id: string;
  slug: string;
  banner_url: string;
  avatar_url?: string;
  about_ar: string;
  about_fr: string;
  whatsapp: string;
  theme_color: string;
  updated_at?: string;
  profiles?: any;
}

const LOCAL_STOREFRONT_PREFIX = 'jadijcb_storefront_';
const LOCAL_SLUG_PREFIX = 'jadijcb_storefront_slug_';
export const LOCAL_ACTIVE_SLUG_KEY = 'jadijcb_owner_storefront_slug';

/**
 * Checks if a Supabase error is caused by a missing table in schema cache
 */
function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('storefronts') ||
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205'
  );
}

/**
 * Loads storefront data for a specific owner
 */
export async function loadStorefrontByOwner(ownerId: string): Promise<StorefrontData | null> {
  if (!ownerId) return null;

  // 1. Check local storage
  let localData: StorefrontData | null = null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STOREFRONT_PREFIX}${ownerId}`);
    if (raw) localData = JSON.parse(raw);
  } catch {
    // Ignore
  }

  // 2. Check Supabase auth user_metadata if available
  let cloudMetaStorefront: StorefrontData | null = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id === ownerId && authData.user.user_metadata?.storefront) {
      cloudMetaStorefront = authData.user.user_metadata.storefront;
    }
  } catch {
    // Ignore
  }

  // 3. Try Supabase storefronts table if configured
  let dbData: StorefrontData | null = null;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('storefronts')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (!error && data) {
        dbData = data as StorefrontData;
      }
    } catch (err: any) {
      // Table doesn't exist in schema cache - fallback silently
      if (!isMissingTableError(err)) {
        console.warn('Storefront table load note:', err);
      }
    }
  }

  // Merge with priority: DB > Cloud User Metadata > Local Storage
  const merged = dbData || cloudMetaStorefront || localData;
  if (merged) {
    // Sync to local storage
    try {
      localStorage.setItem(`${LOCAL_STOREFRONT_PREFIX}${ownerId}`, JSON.stringify(merged));
      if (merged.slug) {
        localStorage.setItem(`${LOCAL_SLUG_PREFIX}${merged.slug}`, JSON.stringify(merged));
        localStorage.setItem(LOCAL_ACTIVE_SLUG_KEY, merged.slug);
      }
    } catch {
      // Ignore
    }
  }

  return merged;
}

/**
 * Loads storefront data by slug (for public viewing /s/:slug)
 */
export async function loadStorefrontBySlug(slug: string): Promise<StorefrontData | null> {
  if (!slug) return null;

  // 1. Check local storage by slug
  try {
    const raw = localStorage.getItem(`${LOCAL_SLUG_PREFIX}${slug}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  // 2. Scan all local storage storefront items
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STOREFRONT_PREFIX)) {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        if (item.slug === slug) {
          return item;
        }
      }
    }
  } catch {
    // Ignore
  }

  // 3. Try Supabase storefronts table
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('storefronts')
        .select('*, profiles(*)')
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        return data as StorefrontData;
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  // 4. Check if current user is owner of this slug
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userMetaSf = authData?.user?.user_metadata?.storefront;
    if (userMetaSf && userMetaSf.slug === slug) {
      return userMetaSf;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Saves storefront settings safely:
 * - LocalStorage (instant offline & cross-tab sync)
 * - Supabase auth user_metadata (cloud sync without requiring public.storefronts table)
 * - Supabase public.storefronts table (if table exists)
 */
export async function saveStorefrontData(
  data: StorefrontData
): Promise<{ success: boolean; error?: string }> {
  if (!data.owner_id) {
    return { success: false, error: 'User ID is required' };
  }

  const payload: StorefrontData = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  // 1. Always save in localStorage
  try {
    localStorage.setItem(`${LOCAL_STOREFRONT_PREFIX}${payload.owner_id}`, JSON.stringify(payload));
    if (payload.slug) {
      localStorage.setItem(`${LOCAL_SLUG_PREFIX}${payload.slug}`, JSON.stringify(payload));
      localStorage.setItem(LOCAL_ACTIVE_SLUG_KEY, payload.slug);
    }
    // Also notify listeners
    window.dispatchEvent(new CustomEvent('jadijcb_storefront_updated', { detail: payload }));
  } catch (err) {
    console.warn('LocalStorage save notice:', err);
  }

  // 2. Save in Supabase Auth user_metadata (Cloud persistent across sessions)
  try {
    await supabase.auth.updateUser({
      data: {
        storefront: payload,
        storefront_slug: payload.slug,
      },
    });
  } catch (err) {
    console.warn('Auth user_metadata storefront sync note:', err);
  }

  // 3. Try upserting to Supabase public.storefronts table if table is present
  if (isSupabaseConfigured) {
    try {
      const dbRow: any = {
        owner_id: payload.owner_id,
        slug: payload.slug,
        banner_url: payload.banner_url,
        about_ar: payload.about_ar,
        about_fr: payload.about_fr,
        whatsapp: payload.whatsapp,
        theme_color: payload.theme_color,
      };

      if (payload.avatar_url) {
        dbRow.avatar_url = payload.avatar_url;
      }

      const { error } = await supabase.from('storefronts').upsert(dbRow);

      if (error) {
        if (isMissingTableError(error)) {
          // Table does not exist in schema cache - this is expected in remote schema
          // Data is already saved safely in user_metadata & localStorage
          console.info('storefronts table not in schema cache; saved to cloud user_metadata & localStorage.');
          return { success: true };
        }

        // If error is specific to avatar_url column, retry without it
        if (error.message?.includes('avatar_url') || error.message?.includes('column')) {
          delete dbRow.avatar_url;
          await supabase.from('storefronts').upsert(dbRow);
          return { success: true };
        }

        console.warn('Storefront table upsert notice:', error.message);
      }
    } catch (err: any) {
      if (isMissingTableError(err)) {
        console.info('storefronts table not in schema cache; saved to cloud user_metadata & localStorage.');
        return { success: true };
      }
      console.warn('Storefront table save error:', err);
    }
  }

  return { success: true };
}
