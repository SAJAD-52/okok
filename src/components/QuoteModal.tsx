import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  FileText, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CheckCircle,
  Truck 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MOROCCAN_CITIES } from '../data/cities';

export const QuoteModal: React.FC = () => {
  const { t } = useTranslation();
  const { 
    language, 
    quoteListing, 
    setQuoteListing, 
    addQuote, 
    addToast 
  } = useAppStore();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('+212 6');
  const [email, setEmail] = useState('');
  const [cityId, setCityId] = useState(quoteListing?.cityId || 'casablanca');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [withOperator, setWithOperator] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!quoteListing) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      addQuote({
        listingId: quoteListing.id,
        listingTitle: language === 'ar' ? quoteListing.titleAr : quoteListing.titleFr,
        companyName,
        contactName,
        phone,
        email,
        cityId,
        startDate,
        endDate,
        durationDays: 7,
        withOperator,
        fuelIncluded: quoteListing.fuelIncluded,
        notes,
        estimatedTotalMAD: quoteListing.price * 7,
      });

      setLoading(false);
      setIsSubmitted(true);
      addToast(t('quote_modal.success_title'), 'success');
    }, 600);
  };

  const handleClose = () => {
    setIsSubmitted(false);
    setQuoteListing(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-ink/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-ink text-white border-b border-steel/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-ink flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                {t('quote_modal.title')}
              </h2>
              <span className="text-[11px] text-slate-300">
                {quoteListing.brand} {quoteListing.model}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-steel/60 hover:bg-steel text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body or Success Screen */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success-light text-success mx-auto flex items-center justify-center">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-ink">
                {t('quote_modal.success_title')}
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t('quote_modal.success_desc')}
              </p>
              <div className="p-4 rounded-xl bg-surface border border-slate-200 max-w-md mx-auto text-start text-xs space-y-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact:</span>
                  <span className="font-bold text-ink">{companyName} ({contactName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-bold text-ink" dir="ltr">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-bold text-ink">{startDate} ➔ {endDate}</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] px-8 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-ink font-bold text-sm shadow-sm"
                >
                  {t('quote_modal.close')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-500">
                {t('quote_modal.subtitle')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Company Name */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.company_name')} *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ste Travaux Modernes SARL"
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Contact Name */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.contact_name')} *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ahmed Mansouri"
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.phone')} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.email')} *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@travaux.ma"
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Site City */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.site_city')} *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={cityId}
                      onChange={(e) => setCityId(e.target.value)}
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {MOROCCAN_CITIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {language === 'ar' ? c.nameAr : c.nameFr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* With Operator */}
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={withOperator}
                      onChange={(e) => setWithOperator(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span>{t('quote_modal.with_driver')}</span>
                  </label>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.start_date')}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    {t('quote_modal.end_date')}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  {t('quote_modal.notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'طبيعة الأشغال، نوعية التربة، أو عنوان الورش المحدد...' : 'Nature des travaux, accès au chantier...'}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>{loading ? t('quote_modal.submitting') : t('quote_modal.submit')}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
