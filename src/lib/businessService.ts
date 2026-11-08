// ============================================================================
// JADIJCB: Business Profile & Settings Service
// Manages Company Legal Details, ICE, RC, IF, TP, RIB, VAT & Default Contract Terms
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { BusinessProfile } from '../types/database';

const LOCAL_BIZ_KEY = 'jadijcb_business_profile';

export const DEFAULT_CONTRACT_TERMS_AR = `1. يلتزم المكتري باستعمال الآلية في الغرض المخصص لها ووفق قواعد السلامة المهنية المعمول بها.
2. يتحمل المكتري مسؤولية صيانة الورش والحراسة الليلية للآلية أثناء فترة الكراء.
3. في حال وقوع أي عطل ناتج عن سوء الاستخدام أو إهمال، يتحمل المكتري تكاليف الإصلاح وقطع الغيار.
4. يؤدى مبلغ الكراء المتفق عليه في الآجال المحددة دون أي تأخير، والضمانة تُسترد بعد معاينة الآلية عند نهاية الأشغال.
5. في حال حدوث نزاع، تكون المحكمة التجارية بالمدينة المختصة هي المرجع القانوني للبت فيه.`;

export const DEFAULT_CONTRACT_TERMS_FR = `1. Le locataire s'engage à utiliser l'engin conformément à sa destination et aux règles de sécurité en vigueur.
2. Le locataire assume la garde matérielle et juridique de l'engin sur le chantier pendant toute la durée de location.
3. En cas de panne ou dommage résultant d'une négligence ou mauvaise manipulation, les frais de remise en état sont à la charge du locataire.
4. Les loyers sont payables aux échéances convenues. Le dépôt de garantie est restitué après constat contradictoire de restitution.
5. En cas de litige, le Tribunal de Commerce compétent territorialement est seul habilité.`;

export const businessService = {
  getLocalProfile(ownerId: string): BusinessProfile | null {
    try {
      const raw = localStorage.getItem(`${LOCAL_BIZ_KEY}_${ownerId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return null;
  },

  saveLocalProfile(profile: BusinessProfile) {
    try {
      localStorage.setItem(`${LOCAL_BIZ_KEY}_${profile.owner_id}`, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('jadijcb_business_profile_updated', { detail: profile }));
    } catch {
      // Ignore
    }
  },

  async getProfile(ownerId: string): Promise<BusinessProfile> {
    const local = this.getLocalProfile(ownerId);

    if (isSupabaseConfigured && ownerId) {
      try {
        const { data, error } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('owner_id', ownerId)
          .maybeSingle();

        if (!error && data) {
          const loaded: BusinessProfile = {
            id: data.id,
            owner_id: data.owner_id,
            company_name: data.company_name || '',
            logo_url: data.logo_url || '',
            stamp_signature_url: data.stamp_signature_url || '',
            ice: data.ice || '',
            rc: data.rc || '',
            identifiant_fiscal: data.identifiant_fiscal || '',
            taxe_professionnelle: data.taxe_professionnelle || '',
            address: data.address || '',
            phone: data.phone || '',
            rib: data.rib || '',
            vat_enabled: Boolean(data.vat_enabled),
            default_terms_ar: data.default_terms_ar || DEFAULT_CONTRACT_TERMS_AR,
            default_terms_fr: data.default_terms_fr || DEFAULT_CONTRACT_TERMS_FR,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
          this.saveLocalProfile(loaded);
          return loaded;
        }
      } catch (err) {
        console.warn('Failed to load business profile from DB:', err);
      }
    }

    if (local) return local;

    return {
      owner_id: ownerId,
      company_name: '',
      logo_url: '',
      stamp_signature_url: '',
      ice: '',
      rc: '',
      identifiant_fiscal: '',
      taxe_professionnelle: '',
      address: '',
      phone: '',
      rib: '',
      vat_enabled: false,
      default_terms_ar: DEFAULT_CONTRACT_TERMS_AR,
      default_terms_fr: DEFAULT_CONTRACT_TERMS_FR,
    };
  },

  async saveProfile(profile: BusinessProfile): Promise<{ success: boolean; error?: string }> {
    this.saveLocalProfile(profile);

    if (!isSupabaseConfigured || !profile.owner_id) {
      return { success: true };
    }

    try {
      const payload = {
        owner_id: profile.owner_id,
        company_name: profile.company_name,
        logo_url: profile.logo_url || null,
        stamp_signature_url: profile.stamp_signature_url || null,
        ice: profile.ice || null,
        rc: profile.rc || null,
        identifiant_fiscal: profile.identifiant_fiscal || null,
        taxe_professionnelle: profile.taxe_professionnelle || null,
        address: profile.address || null,
        phone: profile.phone || null,
        rib: profile.rib || null,
        vat_enabled: Boolean(profile.vat_enabled),
        default_terms_ar: profile.default_terms_ar || DEFAULT_CONTRACT_TERMS_AR,
        default_terms_fr: profile.default_terms_fr || DEFAULT_CONTRACT_TERMS_FR,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('business_profiles')
        .upsert(payload, { onConflict: 'owner_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('business_profiles table update warning:', error.message);
        // Also keep sync with profiles table core fields
        try {
          await supabase.from('profiles').update({
            company_name: profile.company_name,
            ice_number: profile.ice,
            avatar_url: profile.logo_url,
          }).eq('id', profile.owner_id);
        } catch {
          // ignore
        }
        return { success: true };
      }

      if (data) {
        this.saveLocalProfile({ ...profile, id: data.id });
      }

      return { success: true };
    } catch (err: any) {
      console.warn('saveProfile error:', err);
      return { success: true };
    }
  },
};
