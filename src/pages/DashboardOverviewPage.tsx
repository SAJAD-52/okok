// ============================================================================
// JADIJCB: Owner Dashboard Home (Desktop Split View / Mobile Stacked)
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CalendarCheck,
  TrendingUp,
  PlusCircle,
  Clock,
  MessageSquare,
  Building2,
  ExternalLink,
  Phone,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { MOCK_MACHINES, MOCK_BOOKINGS } from '../data/mockData';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { UpcomingReturnsList } from '../components/dashboard/UpcomingReturnsList';
import { StorefrontLiveCard } from '../components/dashboard/StorefrontLiveCard';
import { MachineStepperModal } from '../components/machines/MachineStepperModal';
import { Machine } from '../types/database';

export const DashboardOverviewPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [machines, setMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleMachineCreated = (newMachine: Machine) => {
    setMachines((prev) => [newMachine, ...prev]);
  };

  const companyName = profile?.company_name || 'Atlas Terrassement & Travaux S.A.R.L.';
  const ownerName = profile?.full_name || 'كريم بنجلون';
  const publishedCount = machines.filter((m) => m.is_published !== false).length;

  return (
    <div className="space-y-6 text-start">
      {/* Top Welcome Industrial Banner */}
      <div className="bg-ink text-white p-6 sm:p-7 rounded-3xl border border-steel-800 shadow-elevated relative overflow-hidden">
        <div className="absolute top-0 end-0 w-80 h-full bg-gradient-to-s from-primary/10 via-yellow-500/5 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-black uppercase tracking-wider">
                {companyName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {t('dashboard.welcome')}، {ownerName}
            </h1>
            <p className="text-xs text-steel-400 mt-1 max-w-xl">
              {t('dashboard.overview_title')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto font-black shadow-md min-h-[44px]"
            >
              {t('dashboard.quick_add_machine')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Monthly Revenue */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_monthly_revenue')}</span>
            <div className="p-2 rounded-xl bg-amber-50 text-primary-dark">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
            128 400 <span className="text-xs font-bold text-steel-500">{t('common.mad')}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            +23.4% {lang === 'fr' ? 'vs mois précédent' : 'مقارنة بالشهر الماضي'}
          </span>
        </Card>

        {/* KPI 2: Active Rentals */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_active_rentals')}</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
            3
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            {lang === 'fr' ? 'En rotation active sur chantier' : 'تعمل حالياً في الأوراش'}
          </span>
        </Card>

        {/* KPI 3: Machines Listed */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_fleet_size')}</span>
            <div className="p-2 rounded-xl bg-steel-100 text-steel-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
            {publishedCount}
          </div>
          <span className="text-[10px] text-steel-500 font-bold mt-1 block">
            {publishedCount} {lang === 'fr' ? 'visibles sur la marketplace' : 'معروضة للعموم'}
          </span>
        </Card>

        {/* KPI 4: Unread Messages */}
        <Card className="p-4 sm:p-5 bg-white border border-steel-200">
          <div className="flex items-center justify-between text-steel-500 mb-2">
            <span className="text-xs font-bold">{t('dashboard.stat_unread_messages')}</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink font-mono latin-nums">
            2
          </div>
          <span className="text-[10px] text-blue-600 font-bold mt-1 block">
            {lang === 'fr' ? 'Demandes de devis directes' : 'استفسارات كراء جديدة'}
          </span>
        </Card>
      </div>

      {/* Main Split Grid (Desktop: Left = Financials + Returns + Inquiries; Right = Live Storefront Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 6-Month Revenue Line Chart */}
          <RevenueChart />

          {/* Upcoming Returns List with Live Ticking Countdown Timers */}
          <UpcomingReturnsList bookings={MOCK_BOOKINGS} />

          {/* Recent Inquiries List */}
          <div className="p-5 bg-white border border-steel-200 rounded-2xl shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-ink">
                  {t('dashboard.recent_inquiries_title')}
                </h3>
                <p className="text-[11px] text-steel-500">
                  {lang === 'fr'
                    ? 'Contacts directs de conducteurs de travaux et chefs de chantier'
                    : 'اتصالات مباشرة من مسؤولي المشاريع ومديري الأوراش'}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app/messages')}
                className="text-xs font-bold text-steel-600"
              >
                {lang === 'fr' ? 'Voir tous' : 'عرض الكل'}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="p-3.5 rounded-xl border border-steel-200 bg-surface flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-ink font-black text-xs flex items-center justify-center">
                    MB
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-ink block">
                      Mehdi Berrada (SGTM Maroc)
                    </span>
                    <span className="text-[11px] text-steel-500">
                      {lang === 'fr'
                        ? 'Demande disponibilité JCB 3CX pour 1 mois à Zenata'
                        : 'طلب حجز جرافة JCB 3CX لمدة شهر في مشروع زناتة'}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/messages')}
                  className="shrink-0 text-xs py-1"
                >
                  {lang === 'fr' ? 'Répondre' : 'محادثة'}
                </Button>
              </div>

              <div className="p-3.5 rounded-xl border border-steel-200 bg-surface flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-steel-200 text-steel-700 font-black text-xs flex items-center justify-center">
                    TC
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-ink block">
                      Tariq Chaoui (Carrière Ben Guerir)
                    </span>
                    <span className="text-[11px] text-steel-500">
                      {lang === 'fr'
                        ? 'Renseignement sur prix de vente chargeuse CAT 950H'
                        : 'استفسار عن السعر النهائي لشراء شاحنة CAT 950H'}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/messages')}
                  className="shrink-0 text-xs py-1"
                >
                  {lang === 'fr' ? 'Répondre' : 'محادثة'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols on desktop): Live Storefront Preview */}
        <div className="lg:col-span-4 sticky top-20">
          <StorefrontLiveCard publishedCount={publishedCount} />
        </div>
      </div>

      {/* Stepper Modal */}
      <MachineStepperModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleMachineCreated}
      />
    </div>
  );
};

export default DashboardOverviewPage;
