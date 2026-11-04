import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
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

// Map Center Controller Sub-component
function CenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 12, { duration: 1.2 });
  }, [center, map]);
  return null;
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  lat,
  lng,
  cityId,
  onLocationChange,
}) => {
  const { lang } = useLanguage();
  const [currentPos, setCurrentPos] = useState<[number, number]>([lat, lng]);

  useEffect(() => {
    if (lat && lng && (lat !== currentPos[0] || lng !== currentPos[1])) {
      setCurrentPos([lat, lng]);
    }
  }, [lat, lng]);

  const handleCitySelect = (selectedCityId: string) => {
    const city = MOROCCAN_CITIES.find((c) => c.id === selectedCityId);
    if (city) {
      setCurrentPos([city.lat, city.lng]);
      onLocationChange(city.lat, city.lng, city.id);
    }
  };

  const handleMapClick = (newLat: number, newLng: number) => {
    setCurrentPos([newLat, newLng]);

    // Find closest city
    let closestCity = MOROCCAN_CITIES[0];
    let minDistance = Number.MAX_VALUE;

    MOROCCAN_CITIES.forEach((c) => {
      const dist = Math.hypot(c.lat - newLat, c.lng - newLng);
      if (dist < minDistance) {
        minDistance = dist;
        closestCity = c;
      }
    });

    onLocationChange(newLat, newLng, closestCity.id);
  };

  return (
    <div className="space-y-3 text-start">
      {/* City Dropdown & Coordinates Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Real-time Pin Coordinates Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-steel-100 rounded-xl text-xs font-mono font-bold text-steel-700 self-start sm:self-end">
          <Navigation className="w-3.5 h-3.5 text-primary-dark shrink-0" />
          <span dir="ltr">
            {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}
          </span>
        </div>
      </div>

      {/* Interactive Map Box */}
      <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border-2 border-steel-200 relative shadow-inner">
        <MapContainer
          center={currentPos}
          zoom={11}
          scrollWheelZoom={false}
          className="h-full w-full z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={currentPos} icon={pickerIcon} />
          <ClickHandler onLocationSelect={handleMapClick} />
          <CenterController center={currentPos} />
        </MapContainer>

        {/* Instruction Badge */}
        <div className="absolute bottom-3 start-3 z-20 pointer-events-none">
          <span className="px-3 py-1.5 rounded-lg bg-ink/85 backdrop-blur-sm text-white text-[10px] font-bold shadow-md flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-primary" />
            <span>
              {lang === 'fr'
                ? 'Cliquez n\'importe où sur la carte pour déplacer le repère'
                : 'انقر في أي مكان على الخريطة لتثبيت موقع الآلية'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapLocationPicker;
