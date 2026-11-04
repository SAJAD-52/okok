import React, { useState, useEffect } from 'react';
import { Clock, Truck, Phone, MessageSquare, AlertCircle } from 'lucide-react';
import { Booking } from '../../types/database';
import { useLanguage } from '../../hooks/useLanguage';

interface UpcomingReturnsListProps {
  bookings: Booking[];
}

export const UpcomingReturnsList: React.FC<UpcomingReturnsListProps> = ({
  bookings,
}) => {
  const { t, lang } = useLanguage();
  const [now, setNow] = useState(Date.now());

  // Live timer ticking every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter active bookings with future end dates
  const activeBookings = bookings.filter(
    (b) => b.status === 'active' || b.status === 'confirmed'
  );

  const formatRemainingTime = (endDateStr: string) => {
    const endTs = new Date(endDateStr).getTime();
    const diff = endTs - now;

    if (diff <= 0) {
      return {
        text: lang === 'fr' ? 'Échéance dépassée' : 'انتهى وقت الورش',
        isOverdue: true,
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (days > 0) {
      return {
        text: `${days}j ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
        isOverdue: false,
      };
    }

    return {
      text: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
      isOverdue: false,
    };
  };

  return (
    <div className="p-5 bg-white border border-steel-200 rounded-2xl shadow-soft text-start space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-ink">
            {t('dashboard.upcoming_returns_title')}
          </h3>
          <p className="text-[11px] text-steel-500">
            {t('dashboard.upcoming_returns_subtitle')}
          </p>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
      </div>

      {activeBookings.length === 0 ? (
        <p className="text-xs text-steel-400 py-3">
          {t('dashboard.no_upcoming_returns')}
        </p>
      ) : (
        <div className="space-y-2.5">
          {activeBookings.slice(0, 3).map((item) => {
            const endTarget = item.end_at || item.end_date || new Date(Date.now() + 48 * 3600 * 1000).toISOString();
            const { text, isOverdue } = formatRemainingTime(endTarget);

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-steel-200 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/60 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-ink">
                      {item.machine?.title_ar || item.machine?.title_fr || 'JCB 3CX Eco'}
                    </h4>
                    <p className="text-[11px] text-steel-600">
                      {item.client_name || 'Société BTP Casablanca'} · {item.site_address || 'Casablanca'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {/* Countdown Badge */}
                  <div className="text-end">
                    <span className="text-[10px] text-steel-500 block">
                      {t('dashboard.returns_countdown_label')}
                    </span>
                    <span
                      className={`font-mono text-xs font-black tracking-wider px-2 py-0.5 rounded-md ${
                        isOverdue
                          ? 'bg-red-100 text-danger'
                          : 'bg-ink text-primary'
                      }`}
                    >
                      {text}
                    </span>
                  </div>

                  {item.client_phone && (
                    <a
                      href={`tel:${item.client_phone}`}
                      className="w-8 h-8 rounded-lg bg-white border border-steel-300 text-steel-600 hover:text-ink flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                      title={item.client_phone}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpcomingReturnsList;
