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
  rib_number: '007 780 0001234567890123 45',
  account_holder_name: 'Said CPGE',
  cin_number: 'AB 123456',
  whatsapp_number: '+212661234567',
  city: 'Casablanca (الدار البيضاء)',
};

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
        this.settings = { ...DEFAULT_PLATFORM_SETTINGS, ...parsed };
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
          this.settings = {
            monthly_price_mad: Number(data.monthly_price_mad) || 200,
            trial_duration_hours: Number(data.trial_duration_hours) || 72,
            bank_name: data.bank_name || DEFAULT_PLATFORM_SETTINGS.bank_name,
            rib_number: data.rib_number || DEFAULT_PLATFORM_SETTINGS.rib_number,
            account_holder_name: data.account_holder_name || DEFAULT_PLATFORM_SETTINGS.account_holder_name,
            cin_number: data.cin_number || DEFAULT_PLATFORM_SETTINGS.cin_number,
            whatsapp_number: data.whatsapp_number || DEFAULT_PLATFORM_SETTINGS.whatsapp_number,
            city: data.city || DEFAULT_PLATFORM_SETTINGS.city,
            updated_at: data.updated_at,
          };
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
        return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback to in-memory
    }
    return this.settings;
  }

  async updateSettings(newSettings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    this.settings = {
      ...this.settings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };

    this.saveToStorage();

    // Persist to Supabase if table exists
    if (isSupabaseConfigured) {
      try {
        await supabase
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
      } catch (err) {
        console.warn('Remote settings sync fallback to local storage:', err);
      }
    }

    return this.settings;
  }

  private cinFormat(cin: string): string {
    return cin.trim().toUpperCase();
  }
}

export const platformSettingsStore = new PlatformSettingsStore();
