import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { Link } from 'react-router-dom';
import { TrendingUp, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export interface RevenuePoint {
  month: string;
  monthFr: string;
  revenue: number;
  rentalsCount: number;
}

const DEFAULT_SIX_MONTH_DATA: RevenuePoint[] = [
  { month: 'أكتوبر', monthFr: 'Oct', revenue: 64000, rentalsCount: 7 },
  { month: 'نوفمبر', monthFr: 'Nov', revenue: 78500, rentalsCount: 9 },
  { month: 'دجنبر', monthFr: 'Déc', revenue: 92000, rentalsCount: 11 },
  { month: 'يناير', monthFr: 'Jan', revenue: 86000, rentalsCount: 10 },
  { month: 'فبراير', monthFr: 'Fév', revenue: 104000, rentalsCount: 13 },
  { month: 'مارس', monthFr: 'Mar', revenue: 128400, rentalsCount: 16 },
];

interface RevenueChartProps {
  data?: RevenuePoint[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const { t, lang } = useLanguage();
  const chartData = data && data.length > 0 ? data : DEFAULT_SIX_MONTH_DATA;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as RevenuePoint;
      return (
        <div className="bg-ink text-white p-3 rounded-xl border border-steel-700 shadow-xl text-xs space-y-1">
          <p className="font-extrabold text-primary">
            {lang === 'fr' ? data.monthFr : data.month} 2026
          </p>
          <p className="font-mono font-bold text-sm latin-nums">
            {data.revenue.toLocaleString('fr-FR')} {t('common.mad')}
          </p>
          <p className="text-[10px] text-steel-400">
            {data.rentalsCount} {lang === 'fr' ? 'missions clôturées' : 'عقد كراء مكتمل'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 bg-white border border-steel-200 rounded-2xl shadow-soft text-start">
      {/* Title & Trend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-ink">
            {t('dashboard.revenue_chart_title')}
          </h3>
          <p className="text-[11px] text-steel-500">
            {t('dashboard.revenue_chart_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+23.4% {lang === 'fr' ? 'ce mois' : 'هذا الشهر'}</span>
          </div>
          <Link
            to="/app/analytics"
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 text-xs font-black border border-primary/40 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Rentabilité détaillée' : 'الإحصائيات والأرباح'}</span>
            {useLanguage().isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Link>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFB400" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FFB400" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey={lang === 'fr' ? 'monthFr' : 'month'}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#FFB400"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#yellowGradient)"
              activeDot={{ r: 6, fill: '#0B1220', stroke: '#FFB400', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
