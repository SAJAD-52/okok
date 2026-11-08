// ============================================================================
// JADIJCB: Owner Storefront Builder Page (/owner/storefront)
// Features Auto-Generated Unique Slug & Direct File Uploads for Banner & Logo
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
  Lock,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  QrCode,
  Inbox,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUniqueStorefrontSlug } from '../lib/storefrontSlug';
import { ImageUploadField } from '../components/storefront/ImageUploadField';
import {
  loadStorefrontByOwner,
  saveStorefrontData,
  LOCAL_ACTIVE_SLUG_KEY,
} from '../lib/storefrontService';
import { machineStore } from '../lib/machineStore';
import { leadService } from '../lib/leadService';
import { Lead } from '../types/database';
import { QrCodeModal } from '../components/storefront/QrCodeModal';

export const StorefrontPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, user, updateProfile } = useAuth();

  // Auto-generated unique slug state
  const [slug, setSlug] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_ACTIVE_SLUG_KEY);
      if (stored) return stored;
    } catch {
      // Ignore
    }
    return '';
  });

  // Images state (Direct file uploads)
  const [bannerUrl, setBannerUrl] = useState<string>(
    'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1200&q=80'
  );
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url || '');

  // Form info state
  const [aboutAr, setAboutAr] = useState(
    'شركة متخصصة في كراء آليات ومعدات الأشغال العمومية والبناء مع سائقين معتمدين وصيانة دورية لضمان استمرارية الأوراش بأعلى جودة.'
  );
  const [aboutFr, setAboutFr] = useState(
    'Entreprise spécialisée dans la location d\'engins lourds et matériels de BTP avec opérateurs qualifiés et maintenance sur site.'
  );
  const [whatsapp, setWhatsapp] = useState(profile?.phone || '+212661234567');
  const [themeColor, setThemeColor] = useState('#FFB400');
  const [activeAboutTab, setActiveAboutTab] = useState<'ar' | 'fr'>('ar');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMachines, setPreviewMachines] = useState<any[]>([]);

  // Leads inbox state & QR code modal
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  const loadLeads = async () => {
    const ownerId = user?.id || profile?.id;
    if (!ownerId) return;
    setIsLoadingLeads(true);
    try {
      const list = await leadService.getOwnerLeads(ownerId);
      setLeads(list);
    } catch (e) {
      console.warn('Leads load notice:', e);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleToggleLead = async (leadId: string) => {
    const updated = await leadService.toggleLeadContacted(leadId);
    if (updated) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      toast.success(
        updated.is_contacted
          ? (lang === 'fr' ? 'Marqué comme contacté' : 'تم تحديد الطلب كـ تم التواصل بنجاح')
          : (lang === 'fr' ? 'Remis en attente' : 'تمت إعادة الطلب إلى قيد المتابعة')
      );
    }
  };

  // 1. Fetch or initialize storefront with unique non-repeating slug
  useEffect(() => {
    async function loadStorefront() {
      if (!user?.id && !profile) return;
      loadLeads();

      let loadedSlug = '';

      try {
        const sf = await loadStorefrontByOwner(user?.id || profile?.id || '');
        if (sf) {
          if (sf.slug) loadedSlug = sf.slug;
          if (sf.banner_url) setBannerUrl(sf.banner_url);
          if (sf.avatar_url) setAvatarUrl(sf.avatar_url);
          if (sf.about_ar) setAboutAr(sf.about_ar);
          if (sf.about_fr) setAboutFr(sf.about_fr);
          if (sf.whatsapp) setWhatsapp(sf.whatsapp);
          if (sf.theme_color) setThemeColor(sf.theme_color);
        }

        let mList: any[] = [];
        if (isSupabaseConfigured && user?.id) {
          const { data: mData } = await supabase
            .from('machines')
            .select('*')
            .eq('owner_id', user.id)
            .limit(4);

          if (mData && mData.length > 0) {
            mList = mData;
          }
        }
        const realMachines = machineStore.mergeMachines(mList, user?.id);
        setPreviewMachines(realMachines.slice(0, 4));
      } catch (err) {
        console.warn('Storefront load notice:', err);
      }

      // If no slug exists, generate a unique non-repeating slug
      if (!loadedSlug) {
        const storedLocalSlug = localStorage.getItem(LOCAL_ACTIVE_SLUG_KEY);
        if (storedLocalSlug) {
          loadedSlug = storedLocalSlug;
        } else {
          const baseName = profile?.company_name || profile?.full_name || 'jadijcb-owner';
          loadedSlug = generateUniqueStorefrontSlug(baseName);
          localStorage.setItem(LOCAL_ACTIVE_SLUG_KEY, loadedSlug);
        }
      }

      setSlug(loadedSlug);
    }

    loadStorefront();
  }, [user, profile]);

  // Keep avatar in sync with profile if not overridden
  useEffect(() => {
    if (profile?.avatar_url && !avatarUrl) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url, avatarUrl]);

  const publicUrl = `/s/${slug || 'store'}`;
  const fullPublicUrl = `https://jadijcb.ma${publicUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setIsCopied(true);
    toast.success(lang === 'fr' ? 'Lien unique copié !' : 'تم نسخ رابط المتجر بنجاح!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const ownerId = user?.id || profile?.id;
    if (!ownerId) {
      setIsSaving(false);
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }

    // Ensure we have a valid unique slug
    const finalSlug = slug || generateUniqueStorefrontSlug(profile?.company_name || profile?.full_name);
    setSlug(finalSlug);

    // Update profile avatar if updated
    if (avatarUrl && avatarUrl !== profile?.avatar_url) {
      try {
        await updateProfile({ avatar_url: avatarUrl });
      } catch (e) {
        console.warn('Profile avatar update notice:', e);
      }
    }

    // Save with resilient fallback (LocalStorage + Auth Metadata + DB if table exists)
    const res = await saveStorefrontData({
      owner_id: ownerId,
      slug: finalSlug,
      banner_url: bannerUrl,
      avatar_url: avatarUrl,
      about_ar: aboutAr,
      about_fr: aboutFr,
      whatsapp,
      theme_color: themeColor,
    });

    setIsSaving(false);

    if (res.success) {
      toast.success(
        lang === 'fr'
          ? 'Vitrine mise à jour avec succès !'
          : 'تم حفظ إعدادات وصور المتجر بنجاح!'
      );
    } else {
      toast.error(res.error || 'حدث خطأ أثناء الحفظ');
    }
  };

  const companyName = profile?.company_name || 'شركة الأشغال والآليات المعتمدة';
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
            {lang === 'fr'
              ? 'Générez et personnalisez votre vitrine B2B avec votre logo, bannière et lien unique protégé.'
              : 'خصص واجهة متجرك الإلكتروني العام مع رفع الغلاف والشعار ورابط فريد ومحمي ضد التكرار.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsQrModalOpen(true)}
            leftIcon={<QrCode className="w-3.5 h-3.5" />}
            className="text-xs font-bold"
          >
            {lang === 'fr' ? 'Code QR' : 'رمز QR'}
          </Button>

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
            onClick={() => handleSave()}
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
          <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-6">
            <form onSubmit={handleSave} className="space-y-5">
              {/* 1. Auto-generated Read-only Unique Slug Box */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-ink block">
                        {lang === 'fr'
                          ? 'Lien public unique et vérifié'
                          : 'رابط متجرك العام (فريد ومحمي ضد التكرار)'}
                      </span>
                      <span className="text-[10px] text-amber-800 font-medium block">
                        {lang === 'fr'
                          ? 'Généré automatiquement pour garantir une adresse exclusive à votre entreprise'
                          : 'تم إنشاء هذا الرابط تلقائياً لضمان هوية حصرية غير مكررة لمتجرك أمام الزبائن'}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{lang === 'fr' ? 'Actif' : 'معتمد'}</span>
                  </span>
                </div>

                {/* Readonly URL Box with 1-Click Copy */}
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-steel-300">
                  <span className="ps-2 text-steel-400 font-mono text-xs select-none">
                    <LinkIcon className="w-3.5 h-3.5 text-steel-400 inline me-1" />
                  </span>
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={fullPublicUrl}
                    className="flex-1 bg-transparent font-mono text-xs font-bold text-ink focus:outline-none select-all cursor-text truncate"
                    title={fullPublicUrl}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-steel-900 hover:bg-steel-800 text-primary font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-black">{lang === 'fr' ? 'Copié' : 'تم النسخ'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Copier' : 'نسخ الرابط'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Banner Image Upload */}
              <div className="pt-1">
                <ImageUploadField
                  label={lang === 'fr' ? 'Bannière de couverture (Upload)' : 'صورة الغلاف (Banner Upload)'}
                  description={
                    lang === 'fr'
                      ? 'Téléversez une photo panoramique de vos chantiers ou engins pour habiller le haut de votre vitrine.'
                      : 'ارفع صورة عريضة تعبر عن أسطولك أو أوراشك الميدانية لتظهر في أعلى المتجر أمام المقاولين.'
                  }
                  value={bannerUrl}
                  onChange={(url) => setBannerUrl(url)}
                  onRemove={() => setBannerUrl('')}
                  aspectRatio="banner"
                  recommendedDimensions="1200 × 400 px"
                />
              </div>

              {/* 3. Company Profile / Logo Upload */}
              <div className="pt-1">
                <ImageUploadField
                  label={lang === 'fr' ? 'Logo de l\'entreprise ou Photo de profil' : 'شعار المقاولة أو الصورة الشخصية (Logo Upload)'}
                  description={
                    lang === 'fr'
                      ? 'Téléversez le logo de votre société BTP ou votre photo professionnelle.'
                      : 'ارفع الشعار الرسمي لشركتك أو الصورة الشخصية للمسؤول لإعطاء ثقة فورية للزبائن.'
                  }
                  value={avatarUrl}
                  onChange={(url) => setAvatarUrl(url)}
                  onRemove={() => setAvatarUrl('')}
                  aspectRatio="square"
                  recommendedDimensions="400 × 400 px"
                />
              </div>

              {/* 4. WhatsApp Direct Phone */}
              <Input
                label={t('storefront.whatsapp_label')}
                placeholder="+212 6 XX XX XX XX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                dir="ltr"
                required
              />

              {/* 5. Theme Color Picker */}
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

              {/* 6. Bilingual About Text with Tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-steel-700">
                    {lang === 'fr' ? 'Présentation de l\'entreprise :' : 'نبذة تعريفية عن الشركة ومجالات التدخل:'}
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

              {/* Save Submit Button */}
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
                className="w-full h-36 object-cover bg-ink"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />

              {/* Floating Avatar & Details */}
              <div className="absolute bottom-3 start-4 end-4 flex items-end justify-between">
                <div className="flex items-end gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={companyName}
                      className="w-14 h-14 rounded-2xl border-2 border-white object-cover shadow-lg shrink-0 bg-white"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-2xl border-2 border-white flex items-center justify-center font-black text-ink text-base shadow-lg shrink-0"
                      style={{ backgroundColor: themeColor }}
                    >
                      {companyName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

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
                        ICE {profile?.ice_number || '001928471'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Storefront Body Preview */}
            <div className="p-4 space-y-4">
              {/* Unique Slug badge in preview */}
              <div className="p-2 rounded-xl bg-steel-100 border border-steel-200 flex items-center justify-between text-[11px] font-mono">
                <span className="truncate text-steel-700 select-all" dir="ltr">
                  jadijcb.ma/s/{slug || '...'}
                </span>
                <span className="text-[10px] bg-primary/20 text-ink px-1.5 py-0.5 rounded font-sans font-bold">
                  {lang === 'fr' ? 'Lien unique' : 'رابط حصري'}
                </span>
              </div>

              {/* About Snippet */}
              <div className="p-3 rounded-xl bg-steel-50 border border-steel-200 text-xs text-steel-700 leading-relaxed font-medium">
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
                  {previewMachines.length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-steel-50 border border-steel-200 text-[11px] text-steel-500">
                      {lang === 'fr' ? 'Aucun engin dans votre flotte pour l\'instant' : 'لا توجد آليات في أسطولك بعد'}
                    </div>
                  ) : (
                    previewMachines.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl border border-steel-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={m.images?.[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=200&q=80'}
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
                          {m.rate_daily || m.daily_rate || 0} MAD / j
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Open Public Page Button */}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="dark"
                  size="md"
                  onClick={() => navigate(publicUrl)}
                  className="w-full justify-center font-bold text-xs min-h-[42px]"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  {t('dashboard.view_public_storefront')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Leads Inbox Section (طلبات عروض الأسعار الواردة من المتجر) */}
      <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-steel-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center font-black">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-ink">
                {lang === 'fr' ? 'Demandes de devis reçues (Leads)' : 'طلبات عروض الأسعار الواردة (Leads)'}
              </h2>
              <p className="text-[11px] text-steel-500">
                {lang === 'fr'
                  ? 'Toutes les demandes envoyées par les entreprises depuis votre vitrine publique'
                  : 'جميع طلبات عروض الأسعار الواردة من مقاولات البناء عبر متجرك الإلكتروني'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-steel-100 text-steel-700 text-xs font-bold">
              {leads.length} {lang === 'fr' ? 'demande(s)' : 'طلب'}
            </span>
            {leads.filter((l) => !l.is_contacted).length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black animate-pulse">
                {leads.filter((l) => !l.is_contacted).length} {lang === 'fr' ? 'en attente' : 'بانتظار التواصل'}
              </span>
            )}
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="py-12 text-center text-steel-400 space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-steel-300" />
            <p className="text-xs font-bold text-steel-600">
              {lang === 'fr' ? 'Aucune demande de devis pour le moment' : 'لا توجد طلبات عروض أسعار جديدة حالياً'}
            </p>
            <p className="text-[11px] text-steel-400 max-w-sm mx-auto">
              {lang === 'fr'
                ? 'Partagez votre lien de vitrine sur WhatsApp ou les réseaux pour recevoir des demandes directes de chantiers.'
                : 'شارك رابط متجرك أو رمز QR مع المقاولين وعبر مجموعات الواتساب لتلقي طلبات كراء مباشرة.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const cleanPhone = lead.client_phone.replace(/\D/g, '');
              const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `السلام عليكم سي ${lead.client_name}، نحن شركة ${companyName}. تلقينا طلبكم لعرض أسعار كراء الآليات عبر متجرنا على JADIJCB ويسعدنا خدمتكم.`
              )}`;

              return (
                <div
                  key={lead.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    lead.is_contacted
                      ? 'bg-steel-50/70 border-steel-200 opacity-80'
                      : 'bg-amber-50/40 border-amber-200/90 shadow-xs'
                  }`}
                >
                  <div className="space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-ink">{lead.client_name}</span>
                      <span className="font-mono text-steel-600 font-bold" dir="ltr">
                        {lead.client_phone}
                      </span>
                      {lead.city && (
                        <span className="flex items-center gap-1 text-steel-500 text-[11px]">
                          <MapPin className="w-3 h-3 text-primary-dark" />
                          {lead.city}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lead.is_contacted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {lead.is_contacted
                          ? (lang === 'fr' ? '✓ Contacté' : '✓ تم التواصل')
                          : (lang === 'fr' ? '⏳ En attente' : '⏳ قيد الانتظار')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-steel-600 text-[11px]">
                      {lead.machine && (
                        <span>
                          الآلية المطلوبة: <strong className="text-ink">{lead.machine.title_ar || lead.machine.title_fr}</strong>
                        </span>
                      )}
                      {lead.rental_duration && (
                        <span>
                          المدة المتوقعة: <strong className="text-ink">{lead.rental_duration}</strong>
                        </span>
                      )}
                      {lead.start_date && (
                        <span>
                          تاريخ البداية: <strong className="text-ink font-mono">{lead.start_date}</strong>
                        </span>
                      )}
                      <span className="text-steel-400 font-mono text-[10px]">
                        {lead.created_at?.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>

                    {lead.notes && (
                      <p className="text-steel-600 bg-white/70 p-2 rounded-xl border border-steel-200/60 text-[11px] leading-relaxed">
                        &ldquo;{lead.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={`tel:${lead.client_phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink text-white font-bold text-xs hover:bg-steel-800 transition-colors shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                    </a>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleToggleLead(lead.id)}
                      className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        lead.is_contacted
                          ? 'bg-white border-steel-300 text-steel-700 hover:bg-steel-100'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {lead.is_contacted
                          ? (lang === 'fr' ? 'Remettre en attente' : 'إعادة للانتظار')
                          : (lang === 'fr' ? 'Marquer contacté' : 'تحديد كـ تم التواصل')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* QR Code Modal for Owner Storefront */}
      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        storeUrl={fullPublicUrl}
        companyName={companyName}
      />
    </div>
  );
};

export default StorefrontPage;
