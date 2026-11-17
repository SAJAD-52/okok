// ============================================================================
// JADIJCB: Revolutionary Owner Fleet Live Map & Graphical Telemetry Inspector
// Displays every owner machine on an interactive Leaflet map at its current
// site/city location. Hovering (mouse) or tapping (finger) reveals a rich
// graphical telemetry card: Client name, booking duration, countdown until
// machine becomes free, assigned driver, and visual SVG expenses breakdown.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Clock,
  User,
  HardHat,
  Phone,
  MessageSquare,
  PlusCircle,
  TrendingUp,
  Truck,
  X,
  Maximize2,
  Minimize2,
  Edit3,
  Check,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Navigation,
  Crosshair,
} from 'lucide-react';
import {
  Booking,
  ExpenseCategory,
  Machine,
  MachineExpense,
} from '../../types/database';
import { MOROCCAN_CITIES } from '../../data/cities';
import { OwnerDriverOfferWithApps } from '../../lib/driverOfferService';
import { useLanguage } from '../../hooks/useLanguage';

interface OwnerFleetLiveMapProps {
  machines: Machine[];
  bookings: Booking[];
  expenses: MachineExpense[];
  driverOffers?: OwnerDriverOfferWithApps[];
  ownerId?: string;
  onAddExpenseForMachine?: (machineId: string) => void;
}

type FleetFilter = 'all' | 'working' | 'available' | 'overdue';

interface CategorySlice {
  category: ExpenseCategory;
  labelAr: string;
  labelFr: string;
  color: string;
  amount: number;
  percent: number;
}

interface MachineTelemetry {
  machine: Machine;
  lat: number;
  lng: number;
  locationLabel: string;
  statusKey: 'overdue' | 'working' | 'available' | 'maintenance';
  activeBooking: Booking | null;
  upcomingBooking: Booking | null;
  clientName: string;
  clientPhone: string;
  driverName: string;
  driverPhone: string;
  driverSource: 'manual' | 'deal' | 'expense' | 'operator' | 'none';
  bookingDurationDays: number;
  bookingStartLabel: string;
  bookingEndLabel: string;
  elapsedPercent: number;
  remainingLabelAr: string;
  remainingLabelFr: string;
  remainingCompact: string;
  totalExpenses: number;
  totalRevenue: number;
  netProfit: number;
  expenseSlices: CategorySlice[];
  expenseCount: number;
}

const EXPENSE_META: Record<
  ExpenseCategory,
  { labelAr: string; labelFr: string; color: string }
> = {
  fuel: { labelAr: 'وقود وكازوال', labelFr: 'Carburant', color: '#F59E0B' },
  operator: { labelAr: 'أجرة السائق', labelFr: 'Conducteur', color: '#3B82F6' },
  preventive_service: { labelAr: 'صيانة دورية', labelFr: 'Entretien', color: '#10B981' },
  repair_breakdown: { labelAr: 'أعطال وقطع غيار', labelFr: 'Réparations', color: '#EF4444' },
  transport: { labelAr: 'نقل وسطحة', labelFr: 'Transport', color: '#8B5CF6' },
  insurance_tech: { labelAr: 'تأمين وفحص', labelFr: 'Assurance', color: '#14B8A6' },
  other: { labelAr: 'مصاريف أخرى', labelFr: 'Autres', color: '#94A3B8' },
};

const DRIVER_ASSIGNMENT_KEY = 'jadijcb_machine_drivers_v1';

function loadDriverAssignments(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRIVER_ASSIGNMENT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDriverAssignment(machineId: string, driverName: string) {
  try {
    const map = loadDriverAssignments();
    if (driverName.trim()) {
      map[machineId] = driverName.trim();
    } else {
      delete map[machineId];
    }
    localStorage.setItem(DRIVER_ASSIGNMENT_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function resolveCityCoordinates(machine: Machine): { lat: number; lng: number; cityName: string } {
  const directLat = Number(machine.lat || machine.location_lat);
  const directLng = Number(machine.lng || machine.location_lng);

  const cityQuery = (machine.city_id || machine.city || '').trim().toLowerCase();
  const matchedCity = MOROCCAN_CITIES.find(
    (c) =>
      c.id.toLowerCase() === cityQuery ||
      c.name_ar.toLowerCase() === cityQuery ||
      c.name_fr.toLowerCase() === cityQuery
  );

  if (
    Number.isFinite(directLat) &&
    Number.isFinite(directLng) &&
    Math.abs(directLat) > 1 &&
    Math.abs(directLng) > 1
  ) {
    return {
      lat: directLat,
      lng: directLng,
      cityName: machine.city || matchedCity?.name_ar || 'المغرب',
    };
  }

  if (matchedCity) {
    return {
      lat: matchedCity.lat,
      lng: matchedCity.lng,
      cityName: machine.city || matchedCity.name_ar,
    };
  }

  // Fallback to Casablanca coordinates
  return {
    lat: 33.5731,
    lng: -7.5898,
    cityName: machine.city || 'الدار البيضاء',
  };
}

function createFleetMarkerIcon(item: MachineTelemetry, lang: 'ar' | 'fr') {
  const palette =
    item.statusKey === 'overdue'
      ? { bg: '#DC2626', border: '#FEE2E2', text: '#FFFFFF', pill: lang === 'fr' ? 'Retard' : 'متأخرة' }
      : item.statusKey === 'working'
      ? { bg: '#0F172A', border: '#FFB400', text: '#FFB400', pill: item.remainingCompact }
      : item.statusKey === 'maintenance'
      ? { bg: '#475569', border: '#F59E0B', text: '#FDE68A', pill: lang === 'fr' ? 'Maint.' : 'صيانة' }
      : { bg: '#16A34A', border: '#DCFCE7', text: '#FFFFFF', pill: lang === 'fr' ? 'Libre' : 'حرة' };

  const shortTitle = (lang === 'fr'
    ? item.machine.title_fr || item.machine.title_ar
    : item.machine.title_ar || item.machine.title_fr || `${item.machine.brand} ${item.machine.model}`
  ).slice(0, 18);

  return L.divIcon({
    className: 'jadijcb-fleet-pin',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
      ">
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: ${palette.bg};
          color: #FFFFFF;
          border: 2px solid ${palette.border};
          border-radius: 14px;
          padding: 4px 8px;
          font-family: 'Cairo', 'Plus Jakarta Sans', sans-serif;
          white-space: nowrap;
          box-shadow: 0 6px 16px rgba(15,23,42,0.38);
        ">
          <span style="
            font-size: 11px;
            font-weight: 800;
            color: #FFFFFF;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${shortTitle}</span>
          <span style="
            background: ${item.statusKey === 'working' ? '#FFB400' : 'rgba(255,255,255,0.2)'};
            color: ${item.statusKey === 'working' ? '#0F172A' : '#FFFFFF'};
            font-size: 10px;
            font-weight: 900;
            padding: 1px 6px;
            border-radius: 8px;
            font-variant-numeric: tabular-nums;
          ">${palette.pill}</span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 7px solid ${palette.border};
          margin-top: -1px;
        "></div>
      </div>
    `,
    iconSize: [148, 42],
    iconAnchor: [74, 40],
  });
}

function MapViewportController({
  items,
  focusedItem,
  fitTrigger,
}: {
  items: MachineTelemetry[];
  focusedItem: MachineTelemetry | null;
  fitTrigger: number;
}) {
  const map = useMap();
  const hasFittedInitial = useRef(false);
  const lastFitTriggerRef = useRef(0);

  // Fit all owner machines nicely on initial render or explicit reset click
  useEffect(() => {
    if (items.length === 0) return;
    const isExplicitReset = fitTrigger !== lastFitTriggerRef.current;
    if (!hasFittedInitial.current || isExplicitReset) {
      hasFittedInitial.current = true;
      lastFitTriggerRef.current = fitTrigger;
      if (items.length === 1) {
        map.flyTo([items[0].lat, items[0].lng], 11, { duration: 0.9 });
      } else {
        const bounds = L.latLngBounds(items.map((i) => [i.lat, i.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 11 });
      }
    }
  }, [items, fitTrigger, map]);

  // Fly smoothly when user explicitly clicks/selects a machine
  useEffect(() => {
    if (focusedItem) {
      map.flyTo([focusedItem.lat, focusedItem.lng], Math.max(map.getZoom(), 10), {
        duration: 0.7,
      });
    }
  }, [focusedItem, map]);

  return null;
}

function MapClickReset({ onBackgroundClick }: { onBackgroundClick: () => void }) {
  useMapEvents({
    click() {
      onBackgroundClick();
    },
  });
  return null;
}

// Crisp SVG Donut Ring for Expense Breakdown inside the floating telemetry card
const ExpenseDonutChart: React.FC<{
  slices: CategorySlice[];
  totalExpenses: number;
  lang: 'ar' | 'fr';
}> = ({ slices, totalExpenses, lang }) => {
  const size = 96;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        {totalExpenses > 0 &&
          slices.map((s) => {
            const dashLength = (s.percent / 100) * circumference;
            const gapLength = Math.max(0, circumference - dashLength);
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += dashLength;
            return (
              <circle
                key={s.category}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span className="text-[9px] text-steel-300 font-bold leading-tight">
          {lang === 'fr' ? 'Dépenses' : 'المصاريف'}
        </span>
        <span className="text-xs font-black text-white font-mono tabular-nums leading-tight mt-0.5">
          {totalExpenses >= 1000
            ? `${(totalExpenses / 1000).toFixed(1)}k`
            : Math.round(totalExpenses)}
        </span>
        <span className="text-[9px] text-primary font-mono font-bold">MAD</span>
      </div>
    </div>
  );
};

// Radial Progress Arc showing how close the machine is to becoming free
const RemainingTimeArc: React.FC<{
  elapsedPercent: number;
  statusKey: MachineTelemetry['statusKey'];
  compactLabel: string;
}> = ({ elapsedPercent, statusKey, compactLabel }) => {
  const size = 54;
  const stroke = 5.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, elapsedPercent));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const arcColor =
    statusKey === 'overdue'
      ? '#EF4444'
      : statusKey === 'available'
      ? '#22C55E'
      : '#FFB400';

  return (
    <div className="relative w-[54px] h-[54px] shrink-0 flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={statusKey === 'available' ? 0 : strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-[10px] font-black font-mono tabular-nums text-white text-center leading-tight"
        dir="ltr"
      >
        {compactLabel}
      </span>
    </div>
  );
};

export const OwnerFleetLiveMap: React.FC<OwnerFleetLiveMapProps> = ({
  machines,
  bookings,
  expenses,
  driverOffers = [],
  onAddExpenseForMachine,
}) => {
  const { lang } = useLanguage();

  const [filter, setFilter] = useState<FleetFilter>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [driverOverrides, setDriverOverrides] = useState<Record<string, string>>(() =>
    loadDriverAssignments()
  );
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverDraft, setDriverDraft] = useState('');
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live countdown ticker every 60s so remaining hours stay accurate
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Build rich telemetry for every heavy equipment unit
  const fleetTelemetry = useMemo<MachineTelemetry[]>(() => {
    const heavyMachines = machines.filter(
      (m) => m.category !== 'spare-parts' && m.category_id !== 'spare-parts'
    );

    const coordSeen = new Map<string, number>();

    return heavyMachines.map((machine) => {
      const baseCoord = resolveCityCoordinates(machine);
      const coordKey = `${baseCoord.lat.toFixed(3)}_${baseCoord.lng.toFixed(3)}`;
      const dupIndex = coordSeen.get(coordKey) || 0;
      coordSeen.set(coordKey, dupIndex + 1);

      // Gentle spiral offset if multiple machines share the exact same city/depot coordinates
      const angle = dupIndex * 2.1;
      const offsetRadius = dupIndex === 0 ? 0 : 0.012 + dupIndex * 0.004;
      const lat = baseCoord.lat + Math.sin(angle) * offsetRadius;
      const lng = baseCoord.lng + Math.cos(angle) * offsetRadius;

      // Bookings for this machine
      const machineBookings = bookings.filter((b) => b.machine_id === machine.id);
      const activeBookings = machineBookings
        .filter((b) => b.status === 'active' || b.status === 'confirmed')
        .sort(
          (a, b) =>
            new Date(b.start_at || b.start_date || 0).getTime() -
            new Date(a.start_at || a.start_date || 0).getTime()
        );

      const currentBooking =
        activeBookings.find((b) => {
          const s = new Date(b.start_at || b.start_date || '').getTime();
          const e = new Date(b.end_at || b.end_date || '').getTime();
          return !Number.isNaN(s) && !Number.isNaN(e) && s <= nowTick && e >= nowTick;
        }) ||
        activeBookings[0] ||
        null;

      const upcomingBooking = !currentBooking
        ? machineBookings.find((b) => {
            if (b.status === 'cancelled' || b.status === 'completed') return false;
            const s = new Date(b.start_at || b.start_date || '').getTime();
            return !Number.isNaN(s) && s > nowTick;
          }) || null
        : null;

      let statusKey: MachineTelemetry['statusKey'] = 'available';
      let bookingDurationDays = 0;
      let elapsedPercent = 100;
      let remainingLabelAr = 'حرة وجاهزة للكراء فوراً';
      let remainingLabelFr = 'Libre immédiatement';
      let remainingCompact = lang === 'fr' ? 'Libre' : 'حرة';
      let bookingStartLabel = '—';
      let bookingEndLabel = '—';

      if (currentBooking) {
        const startMs = new Date(
          currentBooking.start_at || currentBooking.start_date || Date.now()
        ).getTime();
        const endMs = new Date(
          currentBooking.end_at || currentBooking.end_date || Date.now()
        ).getTime();

        bookingStartLabel = (currentBooking.start_at || currentBooking.start_date || '').slice(0, 10);
        bookingEndLabel = (currentBooking.end_at || currentBooking.end_date || '').slice(0, 10);

        const totalMs = Math.max(3600 * 1000, endMs - startMs);
        bookingDurationDays = Math.max(1, Math.ceil(totalMs / (24 * 3600 * 1000)));

        if (endMs < nowTick) {
          statusKey = 'overdue';
          elapsedPercent = 100;
          const lateHours = Math.max(1, Math.floor((nowTick - endMs) / (3600 * 1000)));
          const lateDays = Math.floor(lateHours / 24);
          const remH = lateHours % 24;
          remainingLabelAr =
            lateDays > 0
              ? `متأخرة عن الإرجاع بـ ${lateDays} ي ${remH > 0 ? `و ${remH} س` : ''}`
              : `متأخرة عن الإرجاع بـ ${lateHours} ساعة`;
          remainingLabelFr =
            lateDays > 0 ? `En retard de ${lateDays}j ${remH}h` : `En retard de ${lateHours}h`;
          remainingCompact =
            lang === 'fr'
              ? lateDays > 0
                ? `+${lateDays}j`
                : `+${lateHours}h`
              : lateDays > 0
              ? `+${lateDays}ي`
              : `+${lateHours}س`;
        } else {
          statusKey = 'working';
          const elapsedMs = Math.max(0, Math.min(totalMs, nowTick - startMs));
          elapsedPercent = Math.round((elapsedMs / totalMs) * 100);
          const leftMs = Math.max(0, endMs - nowTick);
          const leftTotalHours = Math.max(1, Math.ceil(leftMs / (3600 * 1000)));
          const leftDays = Math.floor(leftTotalHours / 24);
          const remHours = leftTotalHours % 24;

          if (leftDays > 0) {
            remainingLabelAr =
              remHours > 0
                ? `متبقي ${leftDays} يوم و ${remHours} ساعة`
                : `متبقي ${leftDays} ${leftDays === 1 ? 'يوم' : 'أيام'}`;
            remainingLabelFr =
              remHours > 0 ? `Reste ${leftDays}j ${remHours}h` : `Reste ${leftDays} jour(s)`;
            remainingCompact = lang === 'fr' ? `${leftDays}j` : `${leftDays}ي`;
          } else {
            remainingLabelAr = `متبقي ${leftTotalHours} ساعة فقط`;
            remainingLabelFr = `Reste ${leftTotalHours}h`;
            remainingCompact = lang === 'fr' ? `${leftTotalHours}h` : `${leftTotalHours}س`;
          }
        }
      } else if (machine.status === 'maintenance') {
        statusKey = 'maintenance';
        remainingLabelAr = 'في الصيانة الوقائية';
        remainingLabelFr = 'En maintenance';
        remainingCompact = lang === 'fr' ? 'Maint.' : 'صيانة';
      }

      // Resolve client info
      const clientName = currentBooking?.client_name
        ? currentBooking.client_name
        : upcomingBooking?.client_name
        ? `${upcomingBooking.client_name} (${lang === 'fr' ? 'À venir' : 'حجز قادم'})`
        : lang === 'fr'
        ? 'Aucun client actif'
        : 'لا يوجد زبون حالياً';
      const clientPhone = currentBooking?.client_phone || upcomingBooking?.client_phone || '';

      // Resolve driver name across manual overrides -> accepted driver deals -> operator expenses -> machine flag
      let driverName = '';
      let driverPhone = '';
      let driverSource: MachineTelemetry['driverSource'] = 'none';

      if (driverOverrides[machine.id]) {
        driverName = driverOverrides[machine.id];
        driverSource = 'manual';
      } else {
        // Check accepted driver offers matching machine category or title
        const acceptedOffer = driverOffers.find((offer) => {
          if (offer.status !== 'accepted') return false;
          const catMatch =
            offer.machine_category &&
            (machine.category?.includes(offer.machine_category) ||
              machine.category_id?.includes(offer.machine_category) ||
              machine.title_ar?.includes(offer.machine_label_ar.split(' ')[0] || '___'));
          return catMatch || offer.applications.some((a) => a.status === 'accepted');
        });
        const acceptedApp = acceptedOffer?.applications.find((a) => a.status === 'accepted');
        if (acceptedApp?.driver_name) {
          driverName = acceptedApp.driver_name;
          driverPhone = acceptedApp.driver_phone || '';
          driverSource = 'deal';
        }
      }

      const machineExpenses = expenses.filter((e) => e.machine_id === machine.id);
      if (!driverName) {
        const opExpense = machineExpenses.find(
          (e) => e.category === 'operator' && (e.vendor_name?.trim() || e.title?.trim())
        );
        if (opExpense) {
          driverName = opExpense.vendor_name?.trim() || opExpense.title.trim();
          driverSource = 'expense';
        }
      }
      if (!driverName) {
        if (machine.with_operator || currentBooking?.with_operator) {
          driverName = lang === 'fr' ? 'Chauffeur attitré (non nommé)' : 'سائق الوكالة (أضف الاسم)';
          driverSource = 'operator';
        } else {
          driverName = lang === 'fr' ? 'Sans chauffeur' : 'بدون سائق (كراء جاف)';
          driverSource = 'none';
        }
      }

      // Compute expense breakdown by category
      const categoryTotals: Partial<Record<ExpenseCategory, number>> = {};
      let totalExpenses = 0;
      for (const exp of machineExpenses) {
        const amt = Number(exp.amount) || 0;
        if (amt <= 0) continue;
        totalExpenses += amt;
        const cat = exp.category || 'other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }

      const expenseSlices: CategorySlice[] = (
        Object.entries(categoryTotals) as [ExpenseCategory, number][]
      )
        .map(([cat, amt]) => {
          const meta = EXPENSE_META[cat] || EXPENSE_META.other;
          return {
            category: cat,
            labelAr: meta.labelAr,
            labelFr: meta.labelFr,
            color: meta.color,
            amount: amt,
            percent: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const totalRevenue = machineBookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const locationLabel =
        currentBooking?.site_address?.trim() ||
        baseCoord.cityName ||
        (lang === 'fr' ? 'Maroc' : 'المغرب');

      return {
        machine,
        lat,
        lng,
        locationLabel,
        statusKey,
        activeBooking: currentBooking,
        upcomingBooking,
        clientName,
        clientPhone,
        driverName,
        driverPhone,
        driverSource,
        bookingDurationDays,
        bookingStartLabel,
        bookingEndLabel,
        elapsedPercent,
        remainingLabelAr,
        remainingLabelFr,
        remainingCompact,
        totalExpenses,
        totalRevenue,
        netProfit,
        expenseSlices,
        expenseCount: machineExpenses.length,
      };
    });
  }, [machines, bookings, expenses, driverOffers, driverOverrides, nowTick, lang]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return fleetTelemetry;
    return fleetTelemetry.filter((i) => i.statusKey === filter);
  }, [fleetTelemetry, filter]);

  const counts = useMemo(() => {
    return {
      all: fleetTelemetry.length,
      working: fleetTelemetry.filter((i) => i.statusKey === 'working').length,
      available: fleetTelemetry.filter((i) => i.statusKey === 'available').length,
      overdue: fleetTelemetry.filter((i) => i.statusKey === 'overdue').length,
    };
  }, [fleetTelemetry]);

  const markerIconsMap = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const item of filteredItems) {
      map.set(item.machine.id, createFleetMarkerIcon(item, lang));
    }
    return map;
  }, [filteredItems, lang]);

  const activeItemId = lockedId || hoveredId;
  const activeItem = useMemo(
    () => fleetTelemetry.find((i) => i.machine.id === activeItemId) || null,
    [fleetTelemetry, activeItemId]
  );

  const lockedItem = useMemo(
    () => fleetTelemetry.find((i) => i.machine.id === lockedId) || null,
    [fleetTelemetry, lockedId]
  );

  const cancelHoverClose = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const scheduleHoverClose = (id: string) => {
    cancelHoverClose();
    hoverTimerRef.current = setTimeout(() => {
      setHoveredId((prev) => (prev === id ? null : prev));
    }, 180);
  };

  const handleSaveDriverName = (machineId: string) => {
    saveDriverAssignment(machineId, driverDraft);
    setDriverOverrides(loadDriverAssignments());
    setEditingDriverId(null);
  };

  if (fleetTelemetry.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={lang === 'fr' ? 'Carte interactive de la flotte' : 'خريطة تتبع الأسطول المباشرة'}
      className="bg-white rounded-3xl border border-steel-200 shadow-soft overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="px-4 sm:px-6 py-4 bg-ink text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-steel-800">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-ink flex items-center justify-center shrink-0 shadow-xs">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-snug">
              {lang === 'fr'
                ? 'Carte Live de la Flotte & Télémétrie'
                : 'خريطة الأسطول المباشرة ومراقبة الآليات'}
            </h2>
            <p className="text-[11px] sm:text-xs text-steel-300 mt-0.5">
              {lang === 'fr'
                ? 'Survolez ou touchez un engin pour afficher client, délai de libération, chauffeur et graphique des dépenses.'
                : 'مرّر الفأرة أو المس أي آلية لعرض الزبون، مدة الحجز، الوقت المتبقي لتصبح حرة، السائق والمصاريف برسوم بيانية.'}
            </p>
          </div>
        </div>

        {/* Interactive Filter Tabs & Map Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/10">
            {(
              [
                { id: 'all', label: lang === 'fr' ? `Tous (${counts.all})` : `الكل (${counts.all})` },
                {
                  id: 'working',
                  label: lang === 'fr' ? `En chantier (${counts.working})` : `في الورش (${counts.working})`,
                },
                {
                  id: 'available',
                  label: lang === 'fr' ? `Libres (${counts.available})` : `حرة (${counts.available})`,
                },
                ...(counts.overdue > 0
                  ? [
                      {
                        id: 'overdue' as FleetFilter,
                        label: lang === 'fr' ? `Retard (${counts.overdue})` : `متأخرة (${counts.overdue})`,
                      },
                    ]
                  : []),
              ] as { id: FleetFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilter(tab.id);
                  setLockedId(null);
                  setHoveredId(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[34px] ${
                  filter === tab.id
                    ? 'bg-primary text-ink font-black'
                    : 'text-steel-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setLockedId(null);
              setHoveredId(null);
              setFitTrigger((n) => n + 1);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap shrink-0"
            title={lang === 'fr' ? 'Recentrer toute la flotte' : 'توسيط كل الآليات'}
          >
            <Crosshair className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">
              {lang === 'fr' ? 'Recentrer' : 'عرض الكل'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap shrink-0"
            title={isExpanded ? 'تصغير الخريطة' : 'تكبير الخريطة'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Quick Fleet Strip (Hover or Tap any machine pill to highlight on map + reveal card) */}
      <div className="px-4 py-2.5 bg-steel-50 border-b border-steel-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-black text-steel-500 whitespace-nowrap shrink-0">
          {lang === 'fr' ? 'Accès rapide :' : 'آلياتك على الخريطة:'}
        </span>
        {filteredItems.map((item) => {
          const isSelected = activeItemId === item.machine.id;
          const statusDotColor =
            item.statusKey === 'overdue'
              ? 'bg-red-600'
              : item.statusKey === 'working'
              ? 'bg-amber-500'
              : item.statusKey === 'maintenance'
              ? 'bg-slate-500'
              : 'bg-emerald-600';

          return (
            <button
              key={item.machine.id}
              type="button"
              onMouseEnter={() => {
                cancelHoverClose();
                setHoveredId(item.machine.id);
              }}
              onMouseLeave={() => scheduleHoverClose(item.machine.id)}
              onClick={() => {
                setLockedId((prev) => (prev === item.machine.id ? null : item.machine.id));
                setEditingDriverId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[36px] ${
                isSelected
                  ? 'bg-ink text-primary border-ink shadow-xs'
                  : 'bg-white text-ink border-steel-200 hover:border-primary'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor}`} />
              <span className="max-w-[140px] truncate">
                {lang === 'fr'
                  ? item.machine.title_fr || item.machine.title_ar
                  : item.machine.title_ar || item.machine.title_fr}
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  isSelected ? 'text-white/80' : 'text-steel-500'
                }`}
              >
                {item.remainingCompact}
              </span>
            </button>
          );
        })}
      </div>

      {/* Map Viewport + Floating Graphical Inspector HUD */}
      <div
        className={`relative w-full transition-all duration-200 ${
          isExpanded ? 'h-[620px] sm:h-[680px]' : 'h-[430px] sm:h-[510px]'
        } bg-steel-100`}
      >
        <MapContainer
          center={[32.2, -6.8]}
          zoom={6}
          scrollWheelZoom={true}
          className="w-full h-full z-10"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewportController
            items={filteredItems}
            focusedItem={lockedItem}
            fitTrigger={fitTrigger}
          />
          <MapClickReset
            onBackgroundClick={() => {
              setLockedId(null);
              setEditingDriverId(null);
            }}
          />

          {activeItem && (
            <CircleMarker
              center={[activeItem.lat, activeItem.lng]}
              radius={24}
              pathOptions={{
                color: '#FFB400',
                weight: 3,
                fillColor: '#FFB400',
                fillOpacity: 0.22,
              }}
              interactive={false}
            />
          )}

          {filteredItems.map((item) => {
            const isSelected = activeItemId === item.machine.id;
            const icon = markerIconsMap.get(item.machine.id);
            if (!icon) return null;
            return (
              <Marker
                key={item.machine.id}
                position={[item.lat, item.lng]}
                icon={icon}
                zIndexOffset={isSelected ? 600 : 0}
                eventHandlers={{
                  mouseover: () => {
                    cancelHoverClose();
                    setHoveredId(item.machine.id);
                  },
                  mouseout: () => {
                    scheduleHoverClose(item.machine.id);
                  },
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setLockedId(item.machine.id);
                    setHoveredId(item.machine.id);
                    setEditingDriverId(null);
                  },
                }}
              />
            );
          })}
        </MapContainer>

        {/* Floating Extraordinary Graphical Telemetry Card (Hover OR Finger Tap) */}
        {activeItem && (
          <div
            onMouseEnter={cancelHoverClose}
            onMouseLeave={() => {
              if (!lockedId) scheduleHoverClose(activeItem.machine.id);
            }}
            className="absolute z-[450] bottom-3 inset-x-3 md:inset-x-auto md:top-3 md:bottom-auto md:end-3 md:w-[410px] max-h-[calc(100%-24px)] overflow-y-auto rounded-2xl bg-[#0B1220]/96 backdrop-blur-md text-white border border-primary/45 shadow-2xl p-4 space-y-3.5 text-start"
          >
            {/* Card Header: Photo + Machine Title + Status + Close */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                {activeItem.machine.images?.[0] && !brokenImageIds[activeItem.machine.id] ? (
                  <img
                    src={activeItem.machine.images[0]}
                    alt={activeItem.machine.title_ar || activeItem.machine.title_fr || ''}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenImageIds((prev) => ({ ...prev, [activeItem.machine.id]: true }))
                    }
                    className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0 bg-steel-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                    <Truck className="w-6 h-6 text-primary" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    {activeItem.statusKey === 'overdue' ? (
                      <span className="text-red-400 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {lang === 'fr' ? 'Retour en retard' : 'متأخرة عن الإرجاع'}
                      </span>
                    ) : activeItem.statusKey === 'working' ? (
                      <span className="text-primary inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {lang === 'fr' ? 'En location active' : 'في الورش الآن'}
                      </span>
                    ) : activeItem.statusKey === 'maintenance' ? (
                      <span className="text-amber-300">
                        {lang === 'fr' ? 'En maintenance' : 'في الصيانة'}
                      </span>
                    ) : (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === 'fr' ? 'Libre & disponible' : 'حرة وجاهزة للكراء'}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-steel-500">·</span>
                    <span className="text-steel-300 truncate inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      {activeItem.locationLabel}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                    {lang === 'fr'
                      ? activeItem.machine.title_fr || activeItem.machine.title_ar
                      : activeItem.machine.title_ar || activeItem.machine.title_fr}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLockedId(null);
                  setHoveredId(null);
                  setEditingDriverId(null);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-steel-200 hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Countdown Ring + Booking Duration Bar */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
              <RemainingTimeArc
                elapsedPercent={activeItem.elapsedPercent}
                statusKey={activeItem.statusKey}
                compactLabel={activeItem.remainingCompact}
              />

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-steel-300 font-bold">
                    {lang === 'fr' ? 'Disponibilité :' : 'لتصبح حرة:'}
                  </span>
                  <span
                    className={`font-black tabular-nums ${
                      activeItem.statusKey === 'overdue'
                        ? 'text-red-400'
                        : activeItem.statusKey === 'available'
                        ? 'text-emerald-400'
                        : 'text-primary'
                    }`}
                  >
                    {lang === 'fr' ? activeItem.remainingLabelFr : activeItem.remainingLabelAr}
                  </span>
                </div>

                {activeItem.activeBooking ? (
                  <>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          activeItem.statusKey === 'overdue' ? 'bg-red-500' : 'bg-primary'
                        }`}
                        style={{ width: `${activeItem.elapsedPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-steel-300 font-mono tabular-nums">
                      <span>
                        {lang === 'fr'
                          ? `Durée: ${activeItem.bookingDurationDays} j`
                          : `مدة الحجز: ${activeItem.bookingDurationDays} ${
                              activeItem.bookingDurationDays === 1 ? 'يوم' : 'أيام'
                            }`}
                      </span>
                      <span dir="ltr">
                        {activeItem.bookingStartLabel} → {activeItem.bookingEndLabel}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-steel-400">
                    {lang === 'fr'
                      ? 'Aucune réservation active — prête pour un nouveau chantier.'
                      : 'لا ترتبط بأي حجز جاري حالياً ويمكن إرسالها لأي ورش.'}
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Client & Assigned Driver Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Client */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-steel-400 font-bold">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3 text-primary" />
                    {lang === 'fr' ? 'Client actuel' : 'اسم الزبون'}
                  </span>
                  {activeItem.clientPhone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${activeItem.clientPhone}`}
                        className="text-emerald-400 hover:text-emerald-300"
                        title={activeItem.clientPhone}
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://wa.me/${activeItem.clientPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
                <p className="font-black text-white truncate">{activeItem.clientName}</p>
              </div>

              {/* Driver */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-steel-400 font-bold">
                  <span className="inline-flex items-center gap-1">
                    <HardHat className="w-3 h-3 text-primary" />
                    {lang === 'fr' ? 'Conducteur' : 'اسم السائق'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeItem.driverPhone && (
                      <a
                        href={`tel:${activeItem.driverPhone}`}
                        className="text-emerald-400 hover:text-emerald-300"
                        title={activeItem.driverPhone}
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setLockedId(activeItem.machine.id);
                        setEditingDriverId(activeItem.machine.id);
                        setDriverDraft(
                          driverOverrides[activeItem.machine.id] ||
                            (activeItem.driverSource === 'deal' ||
                            activeItem.driverSource === 'expense'
                              ? activeItem.driverName
                              : '')
                        );
                      }}
                      className="text-primary hover:text-amber-300 cursor-pointer"
                      title={lang === 'fr' ? 'Modifier le nom du conducteur' : 'تحديد / تعديل اسم السائق'}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {editingDriverId === activeItem.machine.id ? (
                  <div className="flex items-center gap-1 pt-0.5">
                    <input
                      type="text"
                      value={driverDraft}
                      onChange={(e) => setDriverDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDriverName(activeItem.machine.id);
                      }}
                      placeholder={lang === 'fr' ? 'Nom du conducteur' : 'اكتب اسم السائق'}
                      className="w-full px-2 py-1 rounded-lg bg-white/15 border border-primary/50 text-[11px] text-white placeholder:text-steel-400 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDriverName(activeItem.machine.id)}
                      className="p-1.5 rounded-lg bg-primary text-ink hover:bg-primary-hover cursor-pointer shrink-0"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="font-black text-white truncate">{activeItem.driverName}</p>
                )}
              </div>
            </div>

            {/* Section 3: Extraordinary Graphical Expenses Visualization (Donut + Category Bars + Revenue vs Cost) */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/15 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-white">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>
                    {lang === 'fr'
                      ? 'Analyse graphique des dépenses'
                      : 'المصاريف والمردودية (رسم بياني)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-steel-300">
                  {activeItem.expenseCount}{' '}
                  {lang === 'fr' ? 'opérations' : 'عملية مسجلة'}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <ExpenseDonutChart
                  slices={activeItem.expenseSlices}
                  totalExpenses={activeItem.totalExpenses}
                  lang={lang}
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  {activeItem.expenseSlices.length === 0 ? (
                    <div className="space-y-2 text-[11px] text-steel-300">
                      <p>
                        {lang === 'fr'
                          ? 'Aucune dépense enregistrée pour cet engin.'
                          : 'لم تُسجّل مصاريف لهذه الآلية بعد.'}
                      </p>
                      {onAddExpenseForMachine && (
                        <button
                          type="button"
                          onClick={() => onAddExpenseForMachine(activeItem.machine.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-ink font-black text-[11px] hover:bg-primary-hover transition-colors cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Ajouter dépense' : 'تسجيل مصروف'}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    activeItem.expenseSlices.slice(0, 4).map((slice) => (
                      <div key={slice.category} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-steel-200 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: slice.color }}
                            />
                            <span className="truncate">
                              {lang === 'fr' ? slice.labelFr : slice.labelAr}
                            </span>
                          </span>
                          <span className="font-mono font-bold tabular-nums text-white shrink-0 ms-2">
                            {Math.round(slice.amount).toLocaleString('fr-FR')} MAD
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(6, slice.percent)}%`,
                              backgroundColor: slice.color,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Revenue vs Expense Comparative Visual Bar */}
              <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-steel-400 block text-[10px]">
                    {lang === 'fr' ? 'Revenus' : 'المداخيل'}
                  </span>
                  <span className="font-mono font-black text-emerald-400 tabular-nums">
                    {Math.round(activeItem.totalRevenue).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div>
                  <span className="text-steel-400 block text-[10px]">
                    {lang === 'fr' ? 'Dépenses' : 'المصاريف'}
                  </span>
                  <span className="font-mono font-black text-amber-400 tabular-nums">
                    {Math.round(activeItem.totalExpenses).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div>
                  <span className="text-steel-400 block text-[10px]">
                    {lang === 'fr' ? 'Résultat net' : 'الصافي'}
                  </span>
                  <span
                    className={`font-mono font-black tabular-nums ${
                      activeItem.netProfit >= 0 ? 'text-white' : 'text-red-400'
                    }`}
                  >
                    {Math.round(activeItem.netProfit).toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              {onAddExpenseForMachine && (
                <button
                  type="button"
                  onClick={() => onAddExpenseForMachine(activeItem.machine.id)}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-ink font-black text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? '+ Dépense' : '+ إضافة مصروف'}</span>
                </button>
              )}

              <Link
                to={`/owner/analytics?machine=${encodeURIComponent(activeItem.machine.id)}`}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors min-h-[38px]"
              >
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span>{lang === 'fr' ? 'Détails complets' : 'كامل التحليلات'}</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default OwnerFleetLiveMap;
