// ============================================================================
// JADIJCB: Printable Document View (/owner/documents/:id)
// Printable A4 HTML Contract, Invoice, Receipt with Perfect Arabic Typography,
// Bilingual Toggle, window.print() Support, and Web Share / WhatsApp
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  Share2,
  ArrowRight,
  ArrowLeft,
  Building2,
  FileCheck,
  ShieldCheck,
  Calendar,
  Truck,
  CheckCircle2,
  ExternalLink,
  Percent,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { documentService } from '../lib/documentService';
import { DocumentRecord } from '../types/database';

export const DocumentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [docLang, setDocLang] = useState<'ar' | 'fr'>('ar');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      const doc = await documentService.getDocumentById(id);
      setDocument(doc);
      setIsLoading(false);
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-steel-100 flex items-center justify-center p-4">
        <div className="p-8 bg-white rounded-2xl shadow-md text-xs font-bold text-steel-500">
          جاري تحميل الوثيقة...
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-steel-100 flex items-center justify-center p-4 text-center">
        <div className="p-8 bg-white rounded-2xl shadow-md space-y-3 max-w-sm">
          <FileCheck className="w-10 h-10 mx-auto text-steel-400" />
          <h2 className="text-sm font-bold text-ink">الوثيقة غير موجودة</h2>
          <Button variant="primary" size="sm" onClick={() => navigate('/owner/bookings')}>
            الرجوع إلى الحجوزات
          </Button>
        </div>
      </div>
    );
  }

  const { data } = document;
  const isContract = document.type === 'contract';
  const isInvoice = document.type === 'invoice';
  const isReceipt = document.type === 'receipt';

  const isDocArabic = docLang === 'ar';
  const isVatEnabled = Boolean(data.booking?.vat_enabled);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    await documentService.shareDocument(document, docLang);
  };

  return (
    <div className="min-h-screen bg-steel-100 py-6 px-3 sm:px-6">
      {/* Top Floating Control Bar (Hidden when printing via CSS @media print) */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl border border-steel-200 shadow-md flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/owner/bookings')}
            leftIcon={isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            {isDocArabic ? 'الرجوع إلى الحجوزات' : 'Retour aux réservations'}
          </Button>

          {/* Bilingual Toggle */}
          <div className="flex bg-steel-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setDocLang('ar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                isDocArabic ? 'bg-primary text-ink shadow-xs' : 'text-steel-600'
              }`}
            >
              العربية (AR)
            </button>
            <button
              type="button"
              onClick={() => setDocLang('fr')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                !isDocArabic ? 'bg-primary text-ink shadow-xs' : 'text-steel-600'
              }`}
            >
              Français (FR)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            leftIcon={<Share2 className="w-4 h-4 text-emerald-600" />}
            className="text-xs font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            {isDocArabic ? 'مشاركة (WhatsApp)' : 'Partager'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="font-black text-xs shadow-sm"
          >
            {isDocArabic ? 'طباعة / حفظ PDF' : 'Imprimer / Sauvegarder PDF'}
          </Button>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 dimensions with print styles) */}
      <div
        dir={isDocArabic ? 'rtl' : 'ltr'}
        className={`max-w-4xl mx-auto bg-white p-8 sm:p-12 border border-steel-200 shadow-elevated rounded-3xl print:p-0 print:border-none print:shadow-none print:rounded-none text-ink font-sans ${
          isDocArabic ? 'text-right' : 'text-left'
        }`}
        style={{ minHeight: '297mm' }}
      >
        {/* Document Header */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-primary gap-6">
          <div className="flex items-center gap-4">
            {data.owner?.logo_url ? (
              <img
                src={data.owner.logo_url}
                alt={data.owner.company_name}
                className="w-16 h-16 rounded-2xl object-cover border border-steel-200 shrink-0 bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-steel-900 text-primary flex items-center justify-center font-black text-xl border border-steel-700 shrink-0">
                {(data.owner?.company_name || 'JCB').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-black text-ink">
                {data.owner?.company_name || 'مقاولة كراء الآليات'}
              </h1>
              <div className="text-xs text-steel-600 space-y-0.5 mt-1 font-medium">
                {data.owner?.address && <div>{data.owner.address}</div>}
                <div className="flex flex-wrap gap-x-3 text-[11px] text-steel-500">
                  {data.owner?.ice && <span>ICE: {data.owner.ice}</span>}
                  {data.owner?.rc && <span>RC: {data.owner.rc}</span>}
                  {data.owner?.identifiant_fiscal && <span>IF: {data.owner.identifiant_fiscal}</span>}
                  {data.owner?.taxe_professionnelle && <span>TP: {data.owner.taxe_professionnelle}</span>}
                </div>
                {data.owner?.phone && (
                  <div className="font-mono text-xs text-steel-700" dir="ltr">
                    Tél: {data.owner.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`${isDocArabic ? 'text-left' : 'text-right'} shrink-0`}>
            <div className="inline-block px-3 py-1 rounded-xl bg-primary/20 text-ink border border-primary font-black text-sm uppercase">
              {isContract
                ? isDocArabic
                  ? 'عقد كراء آلية أشغال'
                  : 'CONTRAT DE LOCATION'
                : isInvoice
                ? isDocArabic
                  ? 'فاتورة كراء'
                  : 'FACTURE DE LOCATION'
                : isDocArabic
                ? 'وصل استلام وأداء'
                : 'BON DE LIVRAISON & RÈGLEMENT'}
            </div>
            <div className="mt-2 text-xs font-mono font-bold text-steel-700" dir="ltr">
              N° {document.number}
            </div>
            <div className="text-[11px] text-steel-500 mt-0.5">
              {isDocArabic ? 'تاريخ الإصدار: ' : 'Date : '}
              <span className="font-mono">{document.issued_at?.slice(0, 10)}</span>
            </div>
          </div>
        </div>

        {/* Client Box & Booking Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {/* Client Details */}
          <div className="p-4 rounded-2xl bg-steel-50 border border-steel-200 text-xs space-y-1.5">
            <span className="text-[10px] font-bold text-steel-400 uppercase block">
              {isDocArabic ? 'بيانات المكتري / الزبون (Client / Locataire)' : 'Informations du Client'}
            </span>
            <div className="font-black text-sm text-ink">{data.client?.name}</div>
            {data.client?.cin_or_ice && (
              <div className="text-steel-600 font-mono text-[11px]">
                ICE / CIN: {data.client.cin_or_ice}
              </div>
            )}
            {data.client?.phone && (
              <div className="text-steel-600 font-mono text-[11px]" dir="ltr">
                Tél: {data.client.phone}
              </div>
            )}
            {data.client?.city && (
              <div className="text-steel-600 text-[11px]">{data.client.city}</div>
            )}
          </div>

          {/* Machine & Rental Period */}
          <div className="p-4 rounded-2xl bg-steel-50 border border-steel-200 text-xs space-y-1.5">
            <span className="text-[10px] font-bold text-steel-400 uppercase block">
              {isDocArabic ? 'الآلية المؤجرة وفترة العمل (Engin & Période)' : 'Engin loué & Période'}
            </span>
            <div className="font-black text-sm text-ink">
              {isDocArabic ? data.machine?.title_ar : data.machine?.title_fr || data.machine?.title_ar}
            </div>
            <div className="text-steel-600 text-[11px]">
              {data.machine?.brand} {data.machine?.model} {data.machine?.year ? `(${data.machine.year})` : ''}
            </div>
            <div className="text-steel-600 font-mono text-[11px] pt-1" dir="ltr">
              {data.booking?.start_at?.slice(0, 10)} → {data.booking?.end_at?.slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="my-6 overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse border border-steel-200">
            <thead>
              <tr className="bg-steel-100 text-steel-700 font-bold border-b border-steel-200">
                <th className="p-3 border-e border-steel-200">
                  {isDocArabic ? 'بيان العملية والآلية' : 'Désignation'}
                </th>
                <th className="p-3 border-e border-steel-200 text-center">
                  {isDocArabic ? 'السائق والوقود' : 'Chauffeur & Carburant'}
                </th>
                <th className="p-3 border-e border-steel-200 text-center">
                  {isDocArabic ? 'الضمانة المستردة' : 'Dépôt de garantie'}
                </th>
                <th className={`p-3 ${isDocArabic ? 'text-left' : 'text-right'}`}>
                  {isDocArabic ? 'المبلغ الإجمالي' : 'Total (MAD)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-200">
              <tr>
                <td className="p-3 border-e border-steel-200">
                  <span className="font-bold block">
                    {isDocArabic ? data.machine?.title_ar : data.machine?.title_fr || data.machine?.title_ar}
                  </span>
                  <span className="text-[11px] text-steel-500">
                    {isDocArabic ? 'كراء آلية من ' : 'Location du '}
                    {data.booking?.start_at?.slice(0, 10)}
                    {isDocArabic ? ' إلى ' : ' au '}
                    {data.booking?.end_at?.slice(0, 10)}
                  </span>
                </td>
                <td className="p-3 border-e border-steel-200 text-center text-[11px]">
                  {data.booking?.with_operator
                    ? isDocArabic
                      ? 'مع سائق معتمد'
                      : 'Avec chauffeur'
                    : isDocArabic
                    ? 'بدون سائق'
                    : 'Sans chauffeur'}
                  {data.booking?.fuel_included ? (isDocArabic ? ' + وقود' : ' + carburant') : ''}
                </td>
                <td className="p-3 border-e border-steel-200 text-center font-mono font-bold text-[11px]">
                  {data.booking?.deposit_amount
                    ? `${Number(data.booking.deposit_amount).toLocaleString('fr-FR')} MAD`
                    : '—'}
                </td>
                <td className={`p-3 font-mono font-bold ${isDocArabic ? 'text-left' : 'text-right'}`}>
                  {Number(data.booking?.total_price || 0).toLocaleString('fr-FR')} MAD
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals and VAT Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 my-6">
          {/* Payment Terms & Bank Info */}
          <div className="max-w-md text-xs space-y-1.5">
            {data.owner?.rib && (
              <div className="p-3 rounded-xl bg-steel-50 border border-steel-200 font-mono text-[11px]">
                <span className="font-sans font-bold text-steel-500 block mb-0.5">
                  {isDocArabic ? 'الحساب البنكي لتحويل المستحقات (RIB):' : 'Relevé d\'Identité Bancaire (RIB) :'}
                </span>
                <span className="font-bold text-ink select-all">{data.owner.rib}</span>
              </div>
            )}
          </div>

          {/* Pricing Totals Box */}
          <div className="w-full sm:w-72 bg-steel-50 p-4 rounded-2xl border border-steel-200 text-xs space-y-2">
            {isVatEnabled ? (
              <>
                <div className="flex justify-between text-steel-600">
                  <span>{isDocArabic ? 'المبلغ الصافي (HT):' : 'Montant HT :'}</span>
                  <span className="font-mono font-bold">
                    {(data.booking?.total_ht || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
                <div className="flex justify-between text-steel-600">
                  <span>{isDocArabic ? 'الضريبة على القيمة المضافة (20%):' : 'TVA (20%) :'}</span>
                  <span className="font-mono font-bold">
                    {(data.booking?.vat_amount || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-ink pt-2 border-t border-steel-300">
                  <span>{isDocArabic ? 'الإجمالي شامل الضريبة (TTC):' : 'Total TTC :'}</span>
                  <span className="font-mono text-primary-dark">
                    {Number(data.booking?.total_price || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm font-black text-ink">
                <span>{isDocArabic ? 'المبلغ الإجمالي الصافي:' : 'Total net à payer :'}</span>
                <span className="font-mono text-primary-dark">
                  {Number(data.booking?.total_price || 0).toLocaleString('fr-FR')} MAD
                </span>
              </div>
            )}

            {/* Paid & Remaining if partial payments exist */}
            {(data.booking?.paid_amount || 0) > 0 && (
              <div className="pt-2 border-t border-steel-200 space-y-1 text-[11px]">
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>{isDocArabic ? 'المبلغ المؤدى فعلياً:' : 'Montant réglé :'}</span>
                  <span className="font-mono">
                    {Number(data.booking?.paid_amount || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
                <div className="flex justify-between text-red-700 font-black">
                  <span>{isDocArabic ? 'الرصيد المتبقي ذمة:' : 'Solde restant dû :'}</span>
                  <span className="font-mono">
                    {Number(data.booking?.balance_due || 0).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contract Specific Terms & Clauses */}
        {isContract && (
          <div className="my-6 pt-4 border-t border-steel-200 text-[11px] text-steel-700 space-y-2">
            <h4 className="font-bold text-ink uppercase tracking-wider text-xs">
              {isDocArabic ? 'الشروط والالتزامات التعاقدية:' : 'Conditions contractuelles :'}
            </h4>
            <div className="p-4 rounded-xl bg-steel-50 border border-steel-200 whitespace-pre-line leading-relaxed font-sans">
              {isDocArabic
                ? data.owner?.default_terms_ar ||
                  '1. يلتزم المكتري باستعمال الآلية في الورش المتفق عليه مع الالتزام بالسلامة المهنية.\n2. الحراسة الليلية للآلية على عاتق المكتري.\n3. تختص المحكمة التجارية بالبت في أي نزاع.'
                : data.owner?.default_terms_fr ||
                  '1. Le locataire s\'engage à utiliser l\'engin conformément aux règles de sécurité.\n2. La garde sur le chantier est à la charge du locataire.\n3. Tribunal de Commerce compétent en cas de litige.'}
            </div>
          </div>
        )}

        {/* Dual Signature & Stamp Blocks */}
        <div className="grid grid-cols-2 gap-8 my-8 pt-4 border-t-2 border-steel-200 text-xs">
          {/* Owner Stamp Box */}
          <div className="border border-steel-300 rounded-2xl p-4 text-center min-h-[140px] flex flex-col justify-between relative bg-steel-50/50">
            <span className="font-black text-ink block">
              {isDocArabic ? 'توقيع وختم المالك المؤجر' : 'Signature et cachet du bailleur'}
            </span>
            {data.owner?.stamp_signature_url ? (
              <img
                src={data.owner.stamp_signature_url}
                alt="Cachet"
                className="max-h-20 max-w-full mx-auto object-contain my-1"
              />
            ) : (
              <div className="text-[10px] text-steel-400 my-auto">
                {isDocArabic ? '(الختم الرسمي للمقاولة)' : '(Cachet de l\'entreprise)'}
              </div>
            )}
            <span className="text-[10px] text-steel-500 font-mono">
              {data.owner?.company_name}
            </span>
          </div>

          {/* Client Signature Box */}
          <div className="border border-steel-300 rounded-2xl p-4 text-center min-h-[140px] flex flex-col justify-between relative bg-steel-50/50">
            <span className="font-black text-ink block">
              {isDocArabic ? 'توقيع المكتري (مسبوقاً بـ "قرئ وصودق عليه")' : 'Signature du locataire (précédée de "Lu et approuvé")'}
            </span>
            <div className="text-[10px] text-steel-400 my-auto">
              {isDocArabic ? '(توقيع الزبون / ممثل المقاولة)' : '(Signature du client)'}
            </div>
            <span className="text-[10px] text-steel-500 font-mono">
              {data.client?.name}
            </span>
          </div>
        </div>

        {/* Document Footer */}
        <div className="pt-6 border-t border-steel-200 text-center text-[10px] text-steel-400 space-y-1">
          <div>
            JADIJCB Maroc · Plateforme B2B de location de matériel et engins BTP · Document N° {document.number}
          </div>
          <div className="print:block text-[9px] text-steel-300">
            Édité le {new Date().toLocaleString('fr-FR')} via jadijcb.ma
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewPage;
