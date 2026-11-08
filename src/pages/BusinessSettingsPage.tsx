// ============================================================================
// JADIJCB: Business Profile & Settings Page (/app/settings/business)
// Legal Identity, ICE, RC, IF, TP, RIB, 20% VAT Toggle, Stamp, and Contract Terms
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileCheck,
  CreditCard,
  Save,
  ShieldAlert,
  Percent,
  FileText,
  MapPin,
  Phone,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { businessService } from '../lib/businessService';
import { BusinessProfile } from '../types/database';
import { ImageUploadField } from '../components/storefront/ImageUploadField';

export const BusinessSettingsPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [stampUrl, setStampUrl] = useState('');
  const [ice, setIce] = useState('');
  const [rc, setRc] = useState('');
  const [identifiantFiscal, setIdentifiantFiscal] = useState('');
  const [taxePro, setTaxePro] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [rib, setRib] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [termsAr, setTermsAr] = useState('');
  const [termsFr, setTermsFr] = useState('');
  const [activeTermsTab, setActiveTermsTab] = useState<'ar' | 'fr'>('ar');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const ownerId = user?.id || profile?.id;

  useEffect(() => {
    async function load() {
      if (!ownerId) return;
      setIsLoading(true);
      try {
        const bp = await businessService.getProfile(ownerId);
        setCompanyName(bp.company_name || profile?.company_name || '');
        setLogoUrl(bp.logo_url || profile?.avatar_url || '');
        setStampUrl(bp.stamp_signature_url || '');
        setIce(bp.ice || profile?.ice_number || '');
        setRc(bp.rc || '');
        setIdentifiantFiscal(bp.identifiant_fiscal || '');
        setTaxePro(bp.taxe_professionnelle || '');
        setAddress(bp.address || '');
        setPhone(bp.phone || profile?.phone || '');
        setRib(bp.rib || '');
        setVatEnabled(Boolean(bp.vat_enabled));
        setTermsAr(bp.default_terms_ar || '');
        setTermsFr(bp.default_terms_fr || '');
      } catch (err) {
        console.warn('Error loading business profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [ownerId, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) {
      toast.error(lang === 'fr' ? 'Veuillez vous connecter' : 'يرجى تسجيل الدخول أولاً');
      return;
    }

    if (!companyName.trim()) {
      toast.error(lang === 'fr' ? 'Le nom de l\'entreprise est requis' : 'اسم الشركة أو المقاولة مطلوب');
      return;
    }

    setIsSaving(true);

    const payload: BusinessProfile = {
      owner_id: ownerId,
      company_name: companyName.trim(),
      logo_url: logoUrl,
      stamp_signature_url: stampUrl,
      ice: ice.trim(),
      rc: rc.trim(),
      identifiant_fiscal: identifiantFiscal.trim(),
      taxe_professionnelle: taxePro.trim(),
      address: address.trim(),
      phone: phone.trim(),
      rib: rib.trim(),
      vat_enabled: vatEnabled,
      default_terms_ar: termsAr,
      default_terms_fr: termsFr,
    };

    const res = await businessService.saveProfile(payload);
    setIsSaving(false);

    if (res.success) {
      toast.success(
        lang === 'fr'
          ? 'Paramètres d\'entreprise enregistrés avec succès !'
          : 'تم حفظ وتحديث إعدادات وبيانات المقاولة بنجاح!'
      );
    } else {
      toast.error(res.error || (lang === 'fr' ? 'Erreur lors de l\'enregistrement' : 'حدث خطأ أثناء الحفظ'));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-dark font-black text-xs uppercase mb-1">
            <Building2 className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Configuration légale et comptable' : 'الهوية القانونية والفوترة'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr' ? 'Profil et paramètres de l\'entreprise' : 'إعدادات وبيانات المقاولة'}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {lang === 'fr'
              ? 'Renseignez vos identifiants fiscaux (ICE, RC, IF, TP), RIB et TVA pour vos contrats et factures automatiques.'
              : 'أدخل المعرفات الضريبية (ICE، السجل التجاري، المعرف الضريبي)، الحساب البنكي والضريبة لتظهر تلقائياً في العقود والفواتير.'}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          isLoading={isSaving}
          variant="primary"
          size="md"
          leftIcon={<Save className="w-4 h-4" />}
          className="font-black text-xs shadow-sm self-start sm:self-auto min-h-[44px]"
        >
          {lang === 'fr' ? 'Enregistrer les paramètres' : 'حفظ التغييرات'}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Legal Identity & Identifiers */}
        <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-5 rounded-2xl">
          <div className="flex items-center gap-2 pb-3 border-b border-steel-100">
            <FileCheck className="w-5 h-5 text-primary-dark" />
            <h2 className="text-sm font-black text-ink">
              {lang === 'fr' ? 'Identifiants légaux & Fiscaux (Maroc)' : 'المعرفات القانونية والضريبية المغربية'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label={lang === 'fr' ? 'Raison sociale / Nom de l\'entreprise *' : 'الاسم التجاري أو اسم المقاولة *'}
                placeholder="Ex. Atlas Terrassement S.A.R.L."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <Input
              label={lang === 'fr' ? 'Identifiant Commun de l\'Entreprise (ICE) *' : 'رقم التعريف الموحد للمقاولة (ICE) *'}
              placeholder="001928471000084"
              value={ice}
              onChange={(e) => setIce(e.target.value)}
              hint={lang === 'fr' ? '15 chiffres' : '15 رقماً مسجلة بالسجل التجاري'}
              dir="ltr"
            />

            <Input
              label={lang === 'fr' ? 'Registre du Commerce (RC)' : 'السجل التجاري (RC)'}
              placeholder="Ex. 349102"
              value={rc}
              onChange={(e) => setRc(e.target.value)}
              dir="ltr"
            />

            <Input
              label={lang === 'fr' ? 'Identifiant Fiscal (IF)' : 'المعرف الضريبي (IF)'}
              placeholder="Ex. 40284910"
              value={identifiantFiscal}
              onChange={(e) => setIdentifiantFiscal(e.target.value)}
              dir="ltr"
            />

            <Input
              label={lang === 'fr' ? 'Taxe Professionnelle (TP - Optionnel)' : 'الضريبة المهنية (TP - اختياري)'}
              placeholder="Ex. 25910284"
              value={taxePro}
              onChange={(e) => setTaxePro(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Input
              label={lang === 'fr' ? 'Téléphone officiel de contact' : 'رقم الهاتف الرسمي للتعاملات'}
              placeholder="+212 6 XX XX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />

            <Input
              label={lang === 'fr' ? 'Adresse du siège social / Dépôt' : 'عنوان المقر الاجتماعي أو مستودع الآليات'}
              placeholder={lang === 'fr' ? 'Zone Industrielle Sidi Bernoussi, Casablanca' : 'المنطقة الصناعية سيدي البرنوصي، الدار البيضاء'}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </Card>

        {/* Section 2: Logo and Official Stamp / Signature */}
        <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-5 rounded-2xl">
          <div className="flex items-center gap-2 pb-3 border-b border-steel-100">
            <Sparkles className="w-5 h-5 text-primary-dark" />
            <h2 className="text-sm font-black text-ink">
              {lang === 'fr' ? 'Logo et Cachet / Signature officielle' : 'شعار المقاولة والختم / التوقيع الرسمي'}
            </h2>
          </div>

          <p className="text-xs text-steel-500">
            {lang === 'fr'
              ? 'Le logo et le cachet apparaîtront automatiquement sur les contrats de location, devis et factures imprimables.'
              : 'يظهر الشعار والختم تلقائياً في ترويسة وتذييل عقود الكراء والفواتير المطبوعة لإضفاء طابع رسمي وموثوق أمام الزبائن.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <ImageUploadField
              label={lang === 'fr' ? 'Logo de l\'entreprise' : 'شعار المقاولة (Logo)'}
              description={lang === 'fr' ? 'Format carré ou transparent recommandé (PNG, JPG)' : 'شعار بجودة واضحة على خلفية بيضاء أو شفافة'}
              value={logoUrl}
              onChange={setLogoUrl}
              onRemove={() => setLogoUrl('')}
              aspectRatio="square"
              recommendedDimensions="400 × 400 px"
            />

            <ImageUploadField
              label={lang === 'fr' ? 'Cachet & Signature (Tampon)' : 'صورة الختم الرسمي والتوقيع (Cachet)'}
              description={
                lang === 'fr'
                  ? 'Téléversez une photo de votre cachet d\'entreprise pour l\'apposer au bas des contrats.'
                  : 'ارفع صورة ممسوحة للختم الرسمي للمقاولة مع التوقيع لتضمينها آلياً في أسفل العقود.'
              }
              value={stampUrl}
              onChange={setStampUrl}
              onRemove={() => setStampUrl('')}
              aspectRatio="square"
              recommendedDimensions="400 × 400 px"
            />
          </div>
        </Card>

        {/* Section 3: Invoicing, RIB & VAT (20%) */}
        <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-5 rounded-2xl">
          <div className="flex items-center gap-2 pb-3 border-b border-steel-100">
            <CreditCard className="w-5 h-5 text-primary-dark" />
            <h2 className="text-sm font-black text-ink">
              {lang === 'fr' ? 'Facturation, RIB bancaire et TVA' : 'الفوترة، الحساب البنكي (RIB) والضريبة على القيمة المضافة'}
            </h2>
          </div>

          <div className="space-y-4">
            <Input
              label={lang === 'fr' ? 'Relevé d\'Identité Bancaire (RIB 24 chiffres)' : 'رقم الحساب البنكي للتحويلات (RIB - 24 رقماً)'}
              placeholder="Ex. 011 780 0000 123456789012 34"
              value={rib}
              onChange={(e) => setRib(e.target.value)}
              hint={
                lang === 'fr'
                  ? 'Sera affiché sur les factures et rappels de paiement WhatsApp pour les virements clients.'
                  : 'يظهر في الفواتير ورسائل تذكير الزبائن بالدفع عبر الواتساب لتسهيل التحويل البنكي.'
              }
              dir="ltr"
            />

            {/* VAT Toggle (20%) */}
            <div className="p-4 rounded-xl bg-steel-50 border border-steel-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary-dark" />
                  <span className="text-xs font-black text-ink">
                    {lang === 'fr' ? 'Assujetti à la TVA (Taux standard 20%)' : 'تفعيل احتساب الضريبة على القيمة المضافة (TVA 20%)'}
                  </span>
                </div>
                <p className="text-[11px] text-steel-500">
                  {lang === 'fr'
                    ? 'Si activé, vos factures détailleront automatiquement le montant HT, la TVA à 20% et le total TTC.'
                    : 'عند التفعيل، ستفصل الفواتير آلياً بين المبلغ الصافي (HT)، وقيمة الضريبة (20%)، والإجمالي شامل الضريبة (TTC).'}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-steel-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-steel-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Section 4: Default Contract Terms (AR & FR) */}
        <Card className="p-6 bg-white border border-steel-200 shadow-soft space-y-5 rounded-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-steel-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-dark" />
              <h2 className="text-sm font-black text-ink">
                {lang === 'fr' ? 'Clauses et conditions générales du contrat' : 'بنود وشروط عقد الكراء الافتراضية'}
              </h2>
            </div>

            {/* Bilingual Tabs */}
            <div className="flex bg-steel-100 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTermsTab('ar')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTermsTab === 'ar' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                }`}
              >
                العربية (AR)
              </button>
              <button
                type="button"
                onClick={() => setActiveTermsTab('fr')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTermsTab === 'fr' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                }`}
              >
                Français (FR)
              </button>
            </div>
          </div>

          {activeTermsTab === 'ar' ? (
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                الشروط والالتزامات بالعربية (تُدرج في النسخة العربية لعقد الكراء):
              </label>
              <textarea
                rows={6}
                dir="rtl"
                value={termsAr}
                onChange={(e) => setTermsAr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed font-sans"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                Conditions contractuelles en français (insérées dans le contrat FR) :
              </label>
              <textarea
                rows={6}
                dir="ltr"
                value={termsFr}
                onChange={(e) => setTermsFr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed font-sans"
              />
            </div>
          )}

          {/* Mandatory Legal Disclaimer Note */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <span className="font-black block mb-0.5">
                {lang === 'fr' ? 'Avis juridique important :' : 'تنبيه قانوني هام:'}
              </span>
              <span>
                {lang === 'fr'
                  ? 'Le modèle de contrat et les clauses ci-dessus sont fournis à titre de guide général et indicatif. Il est vivement recommandé de faire valider vos contrats par un conseiller juridique ou un avocat spécialisé en droit des affaires marocain.'
                  : 'نموذج العقد والشروط الواردة أعلاه هي دليل إرشادي عام، وينبغي مراجعته وتدقيقه من قبل مستشار قانوني أو محامٍ معتمد وفق خصوصية نشاطكم والقانون التجاري المغربي.'}
              </span>
            </div>
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            className="font-black text-xs px-8 shadow-md min-h-[48px]"
          >
            {lang === 'fr' ? 'Enregistrer tous les paramètres' : 'حفظ بيانات وإعدادات المقاولة'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BusinessSettingsPage;
