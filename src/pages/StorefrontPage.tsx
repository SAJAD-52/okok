// ============================================================================
// JADIJCB: Owner Storefront Builder Page
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ExternalLink,
  Save,
  Copy,
  Check,
  ShieldCheck,
  Phone,
  MessageCircle,
  MapPin,
  Palette,
  Image,
  Globe,
  Truck,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { MOCK_MACHINES } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const StorefrontPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  // Storefront Form State
  const [slug, setSlug] = useState('atlas-terrassement');
  const [bannerUrl, setBannerUrl] = useState(
    'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1200&q=80'
  );
  const [aboutAr, setAboutAr] = useState(
    'شركة أطلس للأشغال العمومية والترابية، متخصصة في كراء آليات الحفر والتسوية الثقيلة مع سائقين معتمدين في جهة الدار البيضاء-سطات ومختلف المدن المغربية منذ 2012.'
  );
  const [aboutFr, setAboutFr] = useState(
    'Atlas Terrassement & Travaux Publics S.A.R.L. : Partenaire privilégié des chantiers au Maroc. Location d\'engins lourds avec chauffeurs certifiés et maintenance sur site.'
  );
  const [whatsapp, setWhatsapp] = useState(profile?.phone || '+212661234567');
  const [themeColor, setThemeColor] = useState('#FFB400');
  const [activeAboutTab, setActiveAboutTab] = useState<'ar' | 'fr'>('ar');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch live storefront if Supabase is connected
  useEffect(() => {
    async function loadStorefront() {
      if (!isSupabaseConfigured || !user?.id) return;

      try {
        const { data, error } = await supabase
          .from('storefronts')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!error && data) {
          if (data.slug) setSlug(data.slug);
          if (data.banner_url) setBannerUrl(data.banner_url);
          if (data.about_ar) setAboutAr(data.about_ar);
          if (data.about_fr) setAboutFr(data.about_fr);
          if (data.whatsapp) setWhatsapp(data.whatsapp);
          if (data.theme_color) setThemeColor(data.theme_color);
        }
      } catch (err) {
        console.warn('Storefront load notice:', err);
      }
    }

    loadStorefront();
  }, [user]);

  const publicUrl = `/s/${slug}`;
  const fullPublicUrl = `https://jadijcb.ma${publicUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setIsCopied(true);
    toast.success(t('dashboard.link_copied'));
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-]/g, '-');

    setSlug(cleanSlug);

    if (isSupabaseConfigured && user?.id) {
      try {
        const { error } = await supabase.from('storefronts').upsert({
          owner_id: user.id,
          slug: cleanSlug,
          banner_url: bannerUrl,
          about_ar: aboutAr,
          about_fr: aboutFr,
          whatsapp,
          theme_color: themeColor,
        });

        if (error) {
          toast.error(error.message);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        console.warn('Storefront save error:', err);
      }
    }

    setIsSaving(false);
    toast.success(
      lang === 'fr'
        ? 'Vitrine mise à jour avec succès !'
        : 'تم حفظ إعدادات المتجر بنجاح!'
    );
  };

  const companyName = profile?.company_name || 'Atlas Terrassement & Travaux S.A.R.L.';
  const city = profile?.city || 'Casablanca';

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {t('storefront.title')}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {t('storefront.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(publicUrl)}
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
            className="text-xs font-bold"
          >
            {t('storefront.view_live_btn')}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            className="font-black text-xs shadow-sm"
          >
            {t('storefront.save_changes')}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left = Builder Form, Right = Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Builder Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-6 bg-white border border-steel-200 shadow-soft">
            <form onSubmit={handleSave} className="space-y-4">
              {/* Custom Slug */}
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1">
                  {t('storefront.slug_label')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-xs text-steel-400 font-mono" dir="ltr">
                    jadijcb.ma/s/
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full ps-28 pe-4 py-2.5 rounded-xl border border-steel-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface min-h-[44px]"
                    placeholder={t('storefront.slug_placeholder')}
                    required
                  />
                </div>
                <p className="text-[11px] text-steel-400 mt-1">
                  {t('storefront.slug_url_preview')} <strong className="font-mono text-ink" dir="ltr">{fullPublicUrl}</strong>
                </p>
              </div>

              {/* Banner URL */}
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1">
                  {t('storefront.banner_url_label')}
                </label>
                <Input
                  placeholder="https://images.unsplash.com/..."
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  dir="ltr"
                />
              </div>

              {/* WhatsApp Direct Phone */}
              <Input
                label={t('storefront.whatsapp_label')}
                placeholder="+212 6 XX XX XX XX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                dir="ltr"
                required
              />

              {/* Theme Color Picker */}
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1.5">
                  {t('storefront.theme_color_label')}
                </label>
                <div className="flex items-center gap-3">
                  {['#FFB400', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#0B1220'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setThemeColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                        themeColor === c ? 'scale-110 border-ink ring-2 ring-primary' : 'border-white'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded-full border border-steel-300 cursor-pointer p-0 bg-transparent"
                  />
                </div>
              </div>

              {/* Bilingual About Text with Tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-steel-700">
                    {lang === 'fr' ? 'Présentation de l\'entreprise :' : 'نبذة تعريفية عن الشركة:'}
                  </label>
                  <div className="flex bg-steel-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveAboutTab('ar')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        activeAboutTab === 'ar' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                      }`}
                    >
                      العربية (AR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAboutTab('fr')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        activeAboutTab === 'fr' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                      }`}
                    >
                      Français (FR)
                    </button>
                  </div>
                </div>

                {activeAboutTab === 'ar' ? (
                  <div>
                    <textarea
                      rows={4}
                      dir="rtl"
                      value={aboutAr}
                      onChange={(e) => setAboutAr(e.target.value)}
                      placeholder="اكتب نبذة عن شركتك، خبرتكم الميدانية، والآليات المتوفرة..."
                      className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      dir="ltr"
                      value={aboutFr}
                      onChange={(e) => setAboutFr(e.target.value)}
                      placeholder="Présentez votre entreprise, vos domaines d'intervention et vos équipements..."
                      className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center font-black min-h-[48px]"
                  isLoading={isSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {t('storefront.save_changes')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right: Live Interactive Storefront Preview (5 Cols) */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          <Card className="p-0 bg-white border border-steel-200 shadow-elevated rounded-3xl overflow-hidden">
            {/* Live Preview Header Bar */}
            <div className="px-4 py-2.5 bg-steel-900 text-white flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{t('storefront.live_preview_title')}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? t('dashboard.link_copied') : t('dashboard.copy_storefront_link')}</span>
              </button>
            </div>

            {/* Storefront Hero Preview */}
            <div className="relative">
              <img
                src={bannerUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=800&q=80'}
                alt="Bannière"
                className="w-full h-36 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />

              {/* Floating Avatar & Details */}
              <div className="absolute bottom-3 start-4 end-4 flex items-end justify-between">
                <div className="flex items-end gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl border-2 border-white flex items-center justify-center font-black text-ink text-base shadow-lg shrink-0"
                    style={{ backgroundColor: themeColor }}
                  >
                    AT
                  </div>
                  <div className="text-white">
                    <h3 className="font-black text-sm truncate max-w-[190px]">
                      {companyName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-steel-200">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" />
                        {city}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-300 font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        ICE 001928471
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Storefront Body Preview */}
            <div className="p-4 space-y-4">
              {/* About Snippet */}
              <div className="p-3 rounded-xl bg-steel-50 border border-steel-200 text-xs text-steel-700 leading-relaxed">
                {lang === 'fr' ? aboutFr : aboutAr}
              </div>

              {/* Contact Buttons */}
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${whatsapp}`}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl border border-steel-300 text-ink hover:bg-steel-50 transition-colors"
                  title="Appel direct"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>

              {/* Machines Grid Preview */}
              <div>
                <span className="text-xs font-bold text-steel-500 block mb-2">
                  {lang === 'fr' ? 'Engins disponibles (Extrait) :' : 'الآليات المعروضة في المتجر:'}
                </span>

                <div className="space-y-2">
                  {MOCK_MACHINES.slice(0, 2).map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl border border-steel-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={m.images[0]}
                          alt={m.title_ar}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div>
                          <span className="font-black text-ink block truncate max-w-[150px]">
                            {lang === 'fr' ? m.title_fr : m.title_ar}
                          </span>
                          <span className="text-[10px] text-steel-500">
                            {m.brand} {m.model}
                          </span>
                        </div>
                      </div>

                      <span className="font-mono font-bold text-xs text-ink">
                        {m.rate_daily} MAD / j
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StorefrontPage;
