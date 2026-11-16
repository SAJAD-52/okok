// ============================================================================
// JADIJCB: Dynamic Platform Payment & Subscription Settings Store
// Synchronizes Super Admin configuration with all equipment owner popups
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';

export interface PlatformSettings {
  monthly_price_mad: number;
  trial_duration_hours: number;
  bank_name: string;
  rib_number: string;
  account_holder_name: string;
  cin_number: string;
  whatsapp_number: string;
  city: string;
  updated_at?: string;
}

const LOCAL_STORAGE_KEY = 'jadijcb_platform_settings';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  monthly_price_mad: 200,
  trial_duration_hours: 72,
  bank_name: 'Attijariwafa Bank (التجاري وفا بنك)',
  rib_number: '',
  account_holder_name: 'JADIJCB MAROC',
  cin_number: '',
  whatsapp_number: '',
  city: 'Casablanca (الدار البيضاء)',
};

const LEGACY_PLACEHOLDER_RIBS = new Set(['007 780 0001234567890123 45', '007780000123456789012345']);
const LEGACY_PLACEHOLDER_CINS = new Set(['AB 123456', 'AB123456']);
const LEGACY_PLACEHOLDER_PHONES = new Set(['+212661234567', '212661234567', '0661234567', '+212661889900', '212661889900']);

function sanitizeSettings(raw: Partial<PlatformSettings>): PlatformSettings {
  const rib = (raw.rib_number || '').trim();
  const cin = (raw.cin_number || '').trim().toUpperCase();
  const wa = (raw.whatsapp_number || '').trim();

  return {
    monthly_price_mad: Number(raw.monthly_price_mad) > 0 ? Number(raw.monthly_price_mad) : DEFAULT_PLATFORM_SETTINGS.monthly_price_mad,
    trial_duration_hours: Number(raw.trial_duration_hours) > 0 ? Number(raw.trial_duration_hours) : DEFAULT_PLATFORM_SETTINGS.trial_duration_hours,
    bank_name: raw.bank_name || DEFAULT_PLATFORM_SETTINGS.bank_name,
    rib_number: LEGACY_PLACEHOLDER_RIBS.has(rib) ? '' : rib,
    account_holder_name: raw.account_holder_name || DEFAULT_PLATFORM_SETTINGS.account_holder_name,
    cin_number: LEGACY_PLACEHOLDER_CINS.has(cin) ? '' : cin,
    whatsapp_number: LEGACY_PLACEHOLDER_PHONES.has(wa.replace(/\s+/g, '')) ? '' : wa,
    city: raw.city || DEFAULT_PLATFORM_SETTINGS.city,
    updated_at: raw.updated_at,
  };
}

class PlatformSettingsStore {
  private settings: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = sanitizeSettings(parsed);
        this.saveToStorage();
      } else {
        this.settings = { ...DEFAULT_PLATFORM_SETTINGS };
        this.saveToStorage();
      }
    } catch {
      this.settings = { ...DEFAULT_PLATFORM_SETTINGS };
    }

    // Attempt to pull from Supabase if table exists
    this.pullFromRemote();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.settings));
      window.dispatchEvent(new CustomEvent('jadijcb_settings_updated', { detail: this.settings }));
    } catch (e) {
      console.warn('Could not save platform settings to storage:', e);
    }
  }

  async pullFromRemote(): Promise<PlatformSettings> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          this.settings = sanitizeSettings({
            monthly_price_mad: Number(data.monthly_price_mad) || 200,
            trial_duration_hours: Number(data.trial_duration_hours) || 72,
            bank_name: data.bank_name,
            rib_number: data.rib_number,
            account_holder_name: data.account_holder_name,
            cin_number: data.cin_number,
            whatsapp_number: data.whatsapp_number,
            city: data.city,
            updated_at: data.updated_at,
          });
          this.saveToStorage();
        }
      } catch {
        // Silently use localStorage fallback
      }
    }
    return this.settings;
  }

  getSettings(): PlatformSettings {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return sanitizeSettings(JSON.parse(stored));
      }
    } catch {
      // Fallback to in-memory
    }
    return this.settings;
  }

  async updateSettings(newSettings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    this.settings = sanitizeSettings({
      ...this.settings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    });

    // Persist to Supabase first when configured so failures surface clearly
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          id: 'global_settings',
          monthly_price_mad: this.settings.monthly_price_mad,
          trial_duration_hours: this.settings.trial_duration_hours,
          bank_name: this.settings.bank_name,
          rib_number: this.settings.rib_number,
          account_holder_name: this.settings.account_holder_name,
          cin_number: this.cinFormat(this.settings.cin_number),
          whatsapp_number: this.settings.whatsapp_number,
          city: this.settings.city,
          updated_at: this.settings.updated_at,
        });

      if (error) {
        throw new Error(error.message || 'Failed to sync platform settings to database');
      }
    }

    this.saveToStorage();
    return this.settings;
  }

  private cinFormat(cin: string): string {
    return cin.trim().toUpperCase();
  }
}

export const platformSettingsStore = new PlatformSettingsStore();
