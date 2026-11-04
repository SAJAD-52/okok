import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CalendarCheck,
  TrendingUp,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_MACHINES, MOCK_BOOKINGS } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';

export const DashboardOverviewPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 text-start">
      {/* Welcome Banner */}
      <div className="bg-ink text-white p-6 sm:p-8 rounded-2xl border border-steel-800 shadow-soft relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-primary font-bold uppercase tracking-wider block mb-1">
              Atlas Terrassement & Travaux S.A.R.L.
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              {t('dashboard.welcome')}، كريم بنجلون
            </h1>
            <p className="text-xs text-steel-400 mt-1 max-w-xl">
              {t('dashboard.overview_title')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/app/machines')}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold"
            >
              {t('dashboard.quick_add_machine')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.stat_active_rentals')}</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-success">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-ink font-mono latin-nums">2</div>
          <span className="text-[11px] text-success font-medium mt-1 block">
            {lang === 'fr' ? '100% opérationnels' : 'تعمل حالياً في الأوراش'}
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.stat_pending_bookings')}</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-ink font-mono latin-nums">1</div>
          <span className="text-[11px] text-amber-600 font-medium mt-1 block">
            {lang === 'fr' ? 'Nécessite votre validation' : 'بانتظار موافقتك'}
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.stat_monthly_revenue')}</span>
            <div className="p-2 rounded-lg bg-primary-100 text-ink">
              <TrendingUp className="w-4 h-4 text-primary-dark" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-ink font-mono latin-nums">
            {formatPriceMAD(44600, lang)}
          </div>
          <span className="text-[11px] text-success font-medium mt-1 block">
            +18% {lang === 'fr' ? 'vs mois dernier' : 'مقارنة بالشهر الماضي'}
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-semibold">{t('dashboard.stat_fleet_size')}</span>
            <div className="p-2 rounded-lg bg-steel-100 text-steel-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-ink font-mono latin-nums">3</div>
          <span className="text-[11px] text-steel-500 font-medium mt-1 block">
            {lang === 'fr' ? 'Toutes vérifiées ICE' : 'مفحوصة ومعتمدة'}
          </span>
        </Card>
      </div>

      {/* Recent Bookings & Fleet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incoming Bookings */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
              {t('dashboard.recent_bookings')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/bookings')}
              className="text-xs font-bold text-primary-dark"
            >
              {lang === 'fr' ? 'Tout voir' : 'عرض الكل'}
            </Button>
          </div>

          <div className="space-y-3">
            {MOCK_BOOKINGS.map((booking) => (
              <div
                key={booking.id}
                className="p-3.5 rounded-xl border border-steel-200 bg-surface flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-ink">
                      {booking.renter?.company_name || booking.renter?.full_name}
                    </span>
                    <Badge
                      variant={
                        booking.status === 'active'
                          ? 'success'
                          : booking.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {booking.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-steel-500 mt-0.5">
                    {booking.site_address} · {booking.duration_units} {lang === 'fr' ? 'jours' : 'أيام'}
                  </p>
                </div>

                <div className="text-end">
                  <span className="font-bold font-mono text-xs text-ink block latin-nums">
                    {formatPriceMAD(booking.total_price, lang)}
                  </span>
                  <button
                    onClick={() => navigate('/app/bookings')}
                    className="text-[11px] text-primary-dark font-bold hover:underline cursor-pointer"
                  >
                    {lang === 'fr' ? 'Détails' : 'معاينة'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* My Fleet Quick View */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
              {t('dashboard.my_fleet')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/machines')}
              className="text-xs font-bold text-primary-dark"
            >
              {lang === 'fr' ? 'Gérer le parc' : 'إدارة الأسطول'}
            </Button>
          </div>

          <div className="space-y-3">
            {MOCK_MACHINES.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl border border-steel-200 bg-surface flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-10 rounded-lg overflow-hidden bg-steel-200 shrink-0">
                    <img
                      src={m.images[0]}
                      alt={lang === 'fr' ? m.title_fr : m.title_ar}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-start">
                    <h3 className="font-bold text-xs text-ink line-clamp-1">
                      {m.brand} {m.model}
                    </h3>
                    <p className="text-[11px] text-steel-500 font-mono latin-nums">
                      {formatPriceMAD(m.rate_daily, lang)} / {lang === 'fr' ? 'jour' : 'يوم'}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={m.status === 'available' ? 'success' : 'neutral'}
                  size="sm"
                >
                  {m.status === 'available'
                    ? t('dashboard.status_available')
                    : t('dashboard.status_rented')}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverviewPage;
