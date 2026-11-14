import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, LocateFixed } from 'lucide-react';
import { MOROCCAN_CITIES } from '../../data/cities';
import { useLanguage } from '../../hooks/useLanguage';

// Custom Marker for Location Picker
const pickerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapLocationPickerProps {
  lat: number;
  lng: number;
  cityId: string;
  onLocationChange: (lat: number, lng: number, cityId?: string) => void;
  hideCitySelector?: boolean;
  instructionText?: string;
  mapHeightClass?: string;
  showGpsButton?: boolean;
}

// Map Click Handler Sub-component
function ClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Map Center & Modal Resize Controller Sub-component
function CenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 12), { duration: 0.9 });
  }, [center, map]);

  return null;
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  lat,
  lng,
  cityId,
  onLocationChange,
  hideCitySelector = false,
  instructionText,
  mapHeightClass = 'h-64 sm:h-72',
  showGpsButton = false,
}) => {
  const { lang } = useLanguage();
  const [currentPos, setCurrentPos] = useState<[number, number]>([lat, lng]);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (lat && lng && (lat !== currentPos[0] || lng !== currentPos[1])) {
      setCurrentPos([lat, lng]);
    }
  }, [lat, lng]);

  const findClosestCity = (targetLat: number, targetLng: number) => {
    let closestCity = MOROCCAN_CITIES[0];
    let minDistance = Number.MAX_VALUE;

    MOROCCAN_CITIES.forEach((c) => {
      const dist = Math.hypot(c.lat - targetLat, c.lng - targetLng);
      if (dist < minDistance) {
        minDistance = dist;
        closestCity = c;
      }
    });

    return closestCity;
  };

  const handleCitySelect = (selectedCityId: string) => {
    const city = MOROCCAN_CITIES.find((c) => c.id === selectedCityId);
    if (city) {
      setCurrentPos([city.lat, city.lng]);
      onLocationChange(city.lat, city.lng, city.id);
    }
  };

  const handleMapClick = (newLat: number, newLng: number) => {
    setGpsError(null);
    setCurrentPos([newLat, newLng]);
    const closestCity = findClosestCity(newLat, newLng);
    onLocationChange(newLat, newLng, closestCity.id);
  };

  const handleMapClickRef = useRef(handleMapClick);
  handleMapClickRef.current = handleMapClick;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError(
        lang === 'fr'
          ? 'La géolocalisation n\'est pas supportée sur cet appareil.'
          : 'تحديد الموقع GPS غير مدعوم على هذا الجهاز.'
      );
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPos([latitude, longitude]);
        const closestCity = findClosestCity(latitude, longitude);
        onLocationChange(latitude, longitude, closestCity.id);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setGpsError(
          lang === 'fr'
            ? 'Impossible d\'accéder à votre position. Cliquez directement sur la carte.'
            : 'تعذر الوصول إلى موقعك الحالي، يمكنك النقر مباشرة على الخريطة لتحديد الورش.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const markerEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat: dLat, lng: dLng } = marker.getLatLng();
          handleMapClickRef.current(dLat, dLng);
        }
      },
    }),
    []
  );

  return (
    <div className="space-y-2.5 text-start">
      {/* City Dropdown & Coordinates / GPS Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {!hideCitySelector ? (
          <div className="w-full sm:w-64">
            <label className="text-xs font-bold text-steel-700 block mb-1">
              {lang === 'fr' ? 'Centrer sur une ville :' : 'المدينة الرئيسية للآلية:'}
            </label>
            <select
              value={cityId}
              onChange={(e) => handleCitySelect(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            >
              {MOROCCAN_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'fr' ? c.name_fr : c.name_ar} ({c.region_fr || c.region_ar})
                </option>
              ))}
            </select>
          </div>
        ) : showGpsButton ? (
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-ink text-xs font-bold transition-colors min-h-[44px] cursor-pointer disabled:opacity-60"
          >
            <LocateFixed className={`w-4 h-4 text-primary-dark shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">
              {isLocating
                ? lang === 'fr'
                  ? 'Localisation...'
                  : 'جاري تحديد موقعك...'
                : lang === 'fr'
                ? 'Utiliser ma position GPS'
                : 'تحديد موقعي الحالي (GPS)'}
            </span>
          </button>
        ) : (
          <div />
        )}

        {/* Real-time Pin Coordinates Display */}
        <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-steel-100 rounded-xl text-[11px] sm:text-xs font-mono font-bold text-steel-700 min-h-[40px]">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-primary-dark shrink-0" />
            <span dir="ltr" className="tabular-nums">
              {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}
            </span>
          </div>
          {!hideCitySelector && showGpsButton && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="text-primary-dark hover:text-ink px-1.5 py-0.5 rounded bg-white border border-steel-200 text-[10px] font-sans font-bold cursor-pointer"
            >
              GPS
            </button>
          )}
        </div>
      </div>

      {gpsError && (
        <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {gpsError}
        </p>
      )}

      {/* Interactive Map Box */}
      <div className={`${mapHeightClass} w-full rounded-2xl overflow-hidden border-2 border-steel-200 relative shadow-inner bg-steel-100`}>
        <MapContainer
          center={currentPos}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            draggable
            eventHandlers={markerEventHandlers}
            position={currentPos}
            ref={markerRef}
            icon={pickerIcon}
          />
          <ClickHandler onLocationSelect={handleMapClick} />
          <CenterController center={currentPos} />
        </MapContainer>

        {/* Instruction Badge */}
        <div className="absolute bottom-2.5 inset-x-2.5 z-20 pointer-events-none flex justify-center sm:justify-start">
          <span className="px-3 py-1.5 rounded-xl bg-ink/85 backdrop-blur-sm text-white text-[10px] sm:text-[11px] font-bold shadow-md flex items-center gap-1.5 max-w-full">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {instructionText ||
                (lang === 'fr'
                  ? 'Cliquez ou déplacez le marqueur sur la carte'
                  : 'انقر في أي مكان على الخريطة أو اسحب العلامة لتثبيت الموقع')}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapLocationPicker;
