// ============================================================================
// JADIJCB: Public Owner Storefront Page (/s/:slug)
// ============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  ShieldCheck,
  Phone,
  MessageCircle,
  Truck,
  Tag,
  Wrench,
  Star,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_MACHINES } from '../data/mockData';
import { Machine } from '../types/database';

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();

  const [filterMode, setFilterMode] = useState<'all' | 'rent' | 'sale'>('all');

  // Realistic fallback metadata for demo storefronts
  const company = {
    name: slug === 'atlas-terrassement' ? 'Atlas Terrassement & Travaux S.A.R.L.' : 'Société BTP Maroc',
    city: 'Casablanca',
    ice: '001928471000032',
    phone: '+212661234567',
    whatsapp: '+212661234567',
    banner: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1600&q=80',
    about_ar:
      'شركة أطلس للأشغال العمومية والترابية، متخصصة في كراء آليات الحفر والتسوية الثقيلة مع سائقين معتمدين في جهة الدار البيضاء-سطات ومختلف المدن المغربية منذ 2012.',
    about_fr:
      'Atlas Terrassement & Travaux Publics S.A.R.L. : Partenaire privilégié des chantiers au Maroc. Location d\'engins lourds avec chauffeurs certifiés et maintenance sur site.',
    theme_color: '#FFB400',
  };

  const machines = MOCK_MACHINES.filter((m) => m.is_published !== false);

  const filteredMachines = machines.filter((m) => {
    if (filterMode === 'rent') return m.listing_mode === 'rent';
    if (filterMode === 'sale') return m.listing_mode === 'sale';
    return true;
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <PublicHeader />

      <main className="flex-1 pb-16">
        {/* Full-width Branded Banner */}
        <div className="relative h-48 sm:h-64 lg:h-80 w-full overflow-hidden bg-ink">
          <img
            src={company.banner}
            alt={company.name}
            className="w-full h-full object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        </div>

        {/* Company Identity Header Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20 relative z-10 text-start">
          <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Logo & Company Name */}
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white flex items-center justify-center font-black text-ink text-2xl shadow-xl shrink-0"
                  style={{ backgroundColor: company.theme_color }}
                >
                  AT
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-ink">
                      {company.name}
                    </h1>
                    <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t('storefront.ice_verified')}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-primary-dark" />
                      {company.city}
                    </span>
                    <span>·</span>
                    <span className="font-mono">ICE: {company.ice}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>4.9 (24 avis)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Salam ${company.name}, je consulte votre parc sur JADIJCB pour une demande de devis.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-md min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${company.phone}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-steel-300 bg-white hover:bg-steel-50 text-ink font-bold text-xs transition-colors min-h-[44px]"
                >
                  <Phone className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Appeler' : 'اتصال مباشر'}</span>
                </a>
              </div>
            </div>

            {/* About Box */}
            <div className="mt-6 pt-6 border-t border-steel-200 text-xs sm:text-sm text-steel-700 leading-relaxed">
              <p>{lang === 'fr' ? company.about_fr : company.about_ar}</p>
            </div>
          </Card>
        </div>

        {/* Catalog of Published Machines */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink">
                {lang === 'fr' ? 'Catalogue du parc disponible' : 'أسطول الآليات والمعدات المتاحة'}
              </h2>
              <p className="text-xs text-steel-500 mt-0.5">
                {filteredMachines.length} {t('storefront.published_machines_count')}
              </p>
            </div>

            {/* Category/Mode Filter Chips */}
            <div className="flex items-center gap-1.5 p-1 bg-steel-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'all' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                }`}
              >
                {t('common.all')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('rent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'rent' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                }`}
              >
                {t('machines.filter_rent')}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('sale')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'sale' ? 'bg-white text-ink shadow-sm' : 'text-steel-600'
                }`}
              >
                {t('machines.filter_sale')}
              </button>
            </div>
          </div>

          {/* Machines Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMachines.map((machine) => (
              <Card
                key={machine.id}
                className="overflow-hidden border border-steel-200 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Photo */}
                  <div className="relative aspect-video overflow-hidden bg-steel-100">
                    <img
                      src={machine.images[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=600&q=80'}
                      alt={machine.title_ar}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 start-2">
                      <Badge
                        variant={machine.listing_mode === 'sale' ? 'neutral' : 'warning'}
                        size="sm"
                      >
                        {machine.listing_mode === 'sale'
                          ? t('machines.mode_sale_option')
                          : t('machines.mode_rent_option')}
                      </Badge>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-sm text-ink line-clamp-1 group-hover:text-primary-dark transition-colors">
                      {lang === 'fr' ? machine.title_fr : machine.title_ar}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-steel-500 font-bold">
                      <span>{machine.brand} {machine.model}</span>
                      <span>·</span>
                      <span>{machine.year}</span>
                    </div>

                    <p className="text-xs text-steel-600 line-clamp-2 leading-relaxed">
                      {lang === 'fr' ? machine.description_fr : machine.description_ar}
                    </p>
                  </div>
                </div>

                {/* Footer Pricing & CTA */}
                <div className="p-4 pt-2 border-t border-steel-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-steel-400 block font-bold">
                      {machine.listing_mode === 'sale' ? (lang === 'fr' ? 'Prix' : 'السعر') : (lang === 'fr' ? 'Tarif journalier' : 'السعر اليومي')}
                    </span>
                    <span className="font-mono font-black text-sm text-ink">
                      {machine.listing_mode === 'sale'
                        ? `${machine.sale_price?.toLocaleString('fr-FR')} MAD`
                        : `${machine.rate_daily?.toLocaleString('fr-FR')} MAD / j`}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/marketplace/${machine.id}`)}
                    className="font-bold text-xs"
                    rightIcon={isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  >
                    {t('marketplace.view_details')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PublicStorefrontPage;
