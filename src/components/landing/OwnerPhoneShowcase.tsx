import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, TrendingUp } from 'lucide-react';

const MOROCCO_FULL_PATH =
  'M 184.5 20.7 L 190.4 20.2 L 191.8 25.5 L 210.8 30.8 L 224.9 31.3 L 234.9 33.4 L 241.0 39.9 L 242.9 52.4 L 249.9 74.0 L 226.0 81.2 L 214.0 97.2 L 197.9 110.8 L 183.8 121.2 L 164.1 127.6 L 144.2 152.1 L 144.2 178.8 L 98.0 179.6 L 97.3 207.6 L 84.0 228.4 L 82.6 253.5 L 29.1 253.5 L 26.3 261.7 L 27.7 248.4 L 34.8 233.2 L 41.8 215.3 L 55.9 198.8 L 62.5 176.7 L 77.2 160.4 L 84.4 147.8 L 107.2 138.8 L 122.9 124.7 L 130.8 108.1 L 128.6 90.6 L 136.0 78.0 L 146.5 63.0 L 158.9 57.4 L 169.8 50.5 L 172.6 46.5 L 179.5 31.8 Z';

const MAP_WORKSITE_PINS = [
  {
    id: 'casablanca',
    label: 'قنطرة في طور البناء',
    cx: 159.3,
    cy: 57.6,
    labelStyle: { left: '15%', top: '16%' },
    connector: { x1: 159.3, y1: 57.6, x2: 122, y2: 52 },
  },
  {
    id: 'fes',
    label: 'تجزئة سكنية',
    cx: 195.8,
    cy: 50.3,
    labelStyle: { left: '74%', top: '13%' },
    connector: { x1: 195.8, y1: 50.3, x2: 215, y2: 45 },
  },
  {
    id: 'marrakech',
    label: 'ورش ملعب مراكش',
    cx: 153.8,
    cy: 88.7,
    labelStyle: { left: '13%', top: '31%' },
    connector: { x1: 153.8, y1: 88.7, x2: 118, y2: 92 },
  },
];

export const OwnerPhoneShowcase: React.FC = () => {
  return (
    <div
      dir="rtl"
      className="w-full rounded-2xl bg-[#0F172A]/95 border border-primary/35 p-4 sm:p-5 shadow-2xl flex flex-col justify-between text-start"
    >
      <div>
        {/* Card Header - Full Arabic */}
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
          <div>
            <span className="text-xs text-primary font-bold block">
              واجهة المالك على الهاتف · إشعارات فورية
            </span>
            <span className="text-sm sm:text-base font-black text-white">
              لوحة التحكم وعروض كراء من مراكش وفاس
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Smartphone Device Frame */}
        <div className="mt-4 rounded-xl bg-[#070C17] border border-slate-800/90 p-3 sm:p-4">
          <div className="max-w-[310px] mx-auto rounded-[2rem] border-[3px] border-slate-700 bg-[#0B1220] shadow-[0_22px_48px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Phone Speaker Notch */}
            <div className="pt-2.5 pb-1.5 flex justify-center bg-[#090F1D]">
              <div className="w-16 h-3 rounded-full bg-black border border-slate-800" />
            </div>

            {/* Mobile App Top Bar */}
            <div className="px-3.5 py-2.5 bg-[#090F1D] border-b border-slate-800/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black tracking-wide text-white">
                  JADI<span className="text-primary">JCB</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">لوحة المالك</span>
                <div className="relative w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" />
                  <span className="absolute -top-1 -start-1 w-4 h-4 rounded-full bg-primary text-ink text-[9px] font-black flex items-center justify-center tabular-nums">
                    2
                  </span>
                </div>
              </div>
            </div>

            {/* Phone Screen Content */}
            <div className="p-3 space-y-2.5">
              {/* Dashboard Financial & Operations Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">رقم المعاملات</span>
                  <div className="text-xs font-black text-white font-mono tabular-nums latin-nums mt-0.5">
                    148 500 <span className="text-[9px] text-primary">د.م</span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">صافي الأرباح</span>
                  <div className="text-xs font-black text-emerald-400 font-mono tabular-nums latin-nums mt-0.5">
                    124 300 <span className="text-[9px]">د.م</span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">طلبات الكراء</span>
                  <div className="text-[11px] font-black text-primary font-mono tabular-nums mt-0.5">
                    12 طلب نشط
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">المصاريف</span>
                  <div className="text-[11px] font-black text-slate-200 font-mono tabular-nums latin-nums mt-0.5">
                    24 200 <span className="text-[9px] text-slate-400">د.م</span>
                  </div>
                </div>
              </div>

              {/* Incoming Rental Request Popups (Marrakech & Fes) */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-[#111B2E] border border-primary/65 shadow-lg">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-black text-primary flex items-center gap-1">
                      <Bell className="w-3 h-3 shrink-0" />
                      <span>إشعار طلب كراء · مراكش</span>
                    </span>
                    <span className="text-slate-400">الآن</span>
                  </div>
                  <div className="text-[11px] font-bold text-white mt-1">
                    زبون يطلب حفارة هيدروليك · 15 يوم
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">ورش ملعب مراكش</span>
                    <Link
                      to="/auth?mode=signup"
                      className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-ink text-[10px] font-black transition-colors whitespace-nowrap"
                    >
                      قبول العرض
                    </Link>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#111B2E] border border-primary/50 shadow-lg">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-black text-primary flex items-center gap-1">
                      <Bell className="w-3 h-3 shrink-0" />
                      <span>إشعار طلب كراء · فاس</span>
                    </span>
                    <span className="text-slate-400">منذ دقيقتين</span>
                  </div>
                  <div className="text-[11px] font-bold text-white mt-1">
                    زبون يطلب جرافة JCB 3CX · شهر واحد
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">تجزئة سكنية · فاس</span>
                    <Link
                      to="/auth?mode=signup"
                      className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-ink text-[10px] font-black transition-colors whitespace-nowrap"
                    >
                      قبول العرض
                    </Link>
                  </div>
                </div>
              </div>

              {/* Full Map of Morocco (Including Moroccan Sahara) - Site Names Only, No Machine Icons */}
              <div className="rounded-xl bg-[#080E1A] border border-slate-800 p-2.5">
                <div className="flex items-center justify-between text-[10px] mb-1.5">
                  <span className="font-bold text-white">خريطة الأوراش بالمغرب</span>
                  <span className="text-primary font-semibold">جميع الجهات</span>
                </div>

                <div className="relative w-full aspect-[280/270] rounded-lg bg-[#050912] border border-slate-800/80 overflow-hidden">
                  {/* Subtle coordinate grid backdrop */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                    aria-hidden="true"
                  />

                  <svg
                    viewBox="0 0 280 270"
                    className="w-full h-full relative z-10"
                    role="img"
                    aria-label="خريطة المغرب كاملة بالصحراء المغربية توضح مواقع الأوراش في الدار البيضاء وفاس ومراكش"
                  >
                    {/* Unified Full Morocco Outline (Tangier to Lagouira) */}
                    <path
                      d={MOROCCO_FULL_PATH}
                      fill="rgba(255, 180, 0, 0.10)"
                      stroke="#FFB400"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />

                    {/* Subtle Leader Lines & Location Dots Only (No Machinery Icons) */}
                    {MAP_WORKSITE_PINS.map((pin) => (
                      <g key={pin.id}>
                        <line
                          x1={pin.cx}
                          y1={pin.cy}
                          x2={pin.connector.x2}
                          y2={pin.connector.y2}
                          stroke="rgba(255, 180, 0, 0.55)"
                          strokeWidth="0.9"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={pin.cx}
                          cy={pin.cy}
                          r="6.5"
                          fill="rgba(255, 180, 0, 0.22)"
                        />
                        <circle
                          cx={pin.cx}
                          cy={pin.cy}
                          r="3.2"
                          fill="#FFB400"
                          stroke="#050912"
                          strokeWidth="1"
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Worksite Labels Only (No Machinery Icons, No City Clutter) */}
                  {MAP_WORKSITE_PINS.map((pin) => (
                    <div
                      key={pin.id}
                      style={pin.labelStyle}
                      className="absolute z-20 px-1.5 py-0.5 rounded bg-[#0B1220]/95 border border-primary/50 text-[9px] font-bold text-white shadow-md whitespace-nowrap pointer-events-none"
                    >
                      {pin.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer - Full Arabic */}
      <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
        <span className="text-emerald-300 font-semibold">
          3 أيام تجربة مجانية · 290 د.م/شهر
        </span>
        <span className="text-slate-400 font-semibold">0% عمولة</span>
      </div>
    </div>
  );
};

export default OwnerPhoneShowcase;
