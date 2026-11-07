import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Truck,
  MessageCircle,
  Edit3,
  Building2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { generateUniqueStorefrontSlug } from '../../lib/storefrontSlug';

const LOCAL_STOREFRONT_SLUG_KEY = 'jadijcb_owner_storefront_slug';

interface StorefrontLiveCardProps {
  publishedCount: number;
}

export const StorefrontLiveCard: React.FC<StorefrontLiveCardProps> = ({
  publishedCount,
}) => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [isCopied, setIsCopied] = useState(false);

  const [slug, setSlug] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STOREFRONT_SLUG_KEY);
      if (stored) return stored;
    } catch {
      // Ignore
    }
    return '';
  });

  const [bannerUrl, setBannerUrl] = useState<string>(
    'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=800&q=80'
  );
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url || '');
  const [themeColor, setThemeColor] = useState<string>('#FFB400');

  useEffect(() => {
    async function loadStorefront() {
      if (!user?.id && !profile) return;

      let foundSlug = '';

      if (isSupabaseConfigured && user?.id) {
        try {
          const { data, error } = await supabase
            .from('storefronts')
            .select('slug, banner_url, avatar_url, theme_color')
            .eq('owner_id', user.id)
            .maybeSingle();

          if (!error && data) {
            if (data.slug) foundSlug = data.slug;
            if (data.banner_url) setBannerUrl(data.banner_url);
            if (data.avatar_url) setAvatarUrl(data.avatar_url);
            if (data.theme_color) setThemeColor(data.theme_color);
          }
        } catch (e) {
          console.warn('StorefrontLiveCard fetch notice:', e);
        }
      }

      if (!foundSlug) {
        const local = localStorage.getItem(LOCAL_STOREFRONT_SLUG_KEY);
        if (local) {
          foundSlug = local;
        } else {
          const baseName = profile?.company_name || profile?.full_name || 'jadijcb-owner';
          foundSlug = generateUniqueStorefrontSlug(baseName);
          localStorage.setItem(LOCAL_STOREFRONT_SLUG_KEY, foundSlug);
        }
      }

      setSlug(foundSlug);
    }

    loadStorefront();
  }, [user, profile]);

  const effectiveSlug = slug || 'store';
  const publicPath = `/s/${effectiveSlug}`;
  const fullUrl = `https://jadijcb.ma${publicPath}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setIsCopied(true);
    toast.success(t('dashboard.link_copied'));
    setTimeout(() => setIsCopied(false), 2500);
  };

  const companyName = profile?.company_name || 'شركة الأشغال والآليات المعتمدة';
  const city = profile?.city || 'Casablanca';
  const iceNumber = profile?.ice_number || '001928471';

  return (
    <div className="bg-white border border-steel-200 rounded-2xl shadow-soft overflow-hidden text-start flex flex-col h-full">
      {/* Header with live indicator */}
      <div className="p-4 border-b border-steel-200 bg-steel-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-black text-ink uppercase tracking-wider">
            {t('dashboard.storefront_card_title')}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => navigate('/owner/storefront')}
          className="text-xs font-bold text-steel-600 hover:text-ink flex items-center gap-1 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'Modifier' : 'تعديل'}</span>
        </button>
      </div>

      {/* Mini Storefront Preview Frame */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        {/* Banner Mockup */}
        <div className="relative rounded-2xl overflow-hidden border border-steel-200 bg-ink shadow-inner">
          <img
            src={bannerUrl}
            alt="Bannière d'entreprise"
            className="w-full h-28 object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />

          {/* Floating Logo Badge */}
          <div className="absolute -bottom-1 start-4 flex items-end gap-2.5">
            {avatarUrl || profile?.avatar_url ? (
              <img
                src={avatarUrl || profile?.avatar_url}
                alt={companyName}
                className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md bg-white shrink-0"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl text-ink border-2 border-white flex items-center justify-center font-black text-sm shadow-md shrink-0"
                style={{ backgroundColor: themeColor }}
              >
                {companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="mb-1">
              <span className="text-white text-xs font-black block truncate max-w-[170px]">
                {companyName}
              </span>
              <span className="text-primary text-[10px] font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {city}
              </span>
            </div>
          </div>
        </div>

        {/* Credentials & Trust */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-steel-500 font-medium">
              {lang === 'fr' ? 'Certification :' : 'الاعتماد القانوني:'}
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ICE {iceNumber}</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-steel-500 font-medium">
              {lang === 'fr' ? 'Engins au catalogue :' : 'الآليات المعروضة:'}
            </span>
            <span className="font-mono font-bold text-ink">
              {publishedCount} {lang === 'fr' ? 'disponibles' : 'آلية'}
            </span>
          </div>

          {/* Quick Slug URL Box */}
          <div className="p-2.5 rounded-xl bg-steel-100 border border-steel-200 flex items-center justify-between text-[11px] font-mono">
            <span className="truncate text-steel-700 select-all font-bold" dir="ltr">
              jadijcb.ma/s/{slug || '...'}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ms-2 p-1.5 rounded-lg bg-white text-steel-600 hover:text-ink hover:bg-steel-50 border border-steel-200 transition-colors shrink-0 cursor-pointer"
              title={t('dashboard.copy_storefront_link')}
              aria-label={t('dashboard.copy_storefront_link')}
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* View Public Page CTA */}
        <div className="pt-2">
          <Button
            type="button"
            variant="dark"
            size="md"
            onClick={() => navigate(publicPath)}
            className="w-full justify-center font-bold text-xs min-h-[44px]"
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            {t('dashboard.view_public_storefront')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StorefrontLiveCard;
