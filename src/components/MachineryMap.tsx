import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { MapPin, Navigation, Eye, Truck } from 'lucide-react';
import { MachineListing } from '../types';
import { useAppStore } from '../store/useAppStore';
import { MOROCCAN_CITIES, getCityById } from '../data/cities';

interface MachineryMapProps {
  listings: MachineListing[];
}

export const MachineryMap: React.FC<MachineryMapProps> = ({ listings }) => {
  const { t } = useTranslation();
  const { language, setSelectedListing } = useAppStore();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedCityId, setSelectedCityId] = useState<string>('');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet Map centered on Morocco
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [32.0, -6.5],
        zoom: 6,
        scrollWheelZoom: true,
      });

      // OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Custom yellow/ink construction pin icon
    const customIcon = L.divIcon({
      className: 'custom-jcb-pin',
      html: `
        <div style="
          width: 38px;
          height: 38px;
          background: #0B1220;
          border: 3px solid #FFB400;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
          cursor: pointer;
        ">
          <div style="
            transform: rotate(45deg);
            color: #FFB400;
            font-size: 15px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            🏗️
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38],
    });

    listings.forEach((item) => {
      const marker = L.marker([item.lat, item.lng], { icon: customIcon });

      const cityName = language === 'ar'
        ? (getCityById(item.cityId)?.nameAr || item.cityId)
        : (getCityById(item.cityId)?.nameFr || item.cityId);

      const title = language === 'ar' ? item.titleAr : item.titleFr;
      const formattedPrice = `${new Intl.NumberFormat('fr-FR').format(item.price)} MAD`;

      const popupContent = `
        <div style="min-width: 200px; max-width: 240px; font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif; text-align: ${language === 'ar' ? 'right' : 'left'}; direction: ${language === 'ar' ? 'rtl' : 'ltr'};">
          <div style="position: relative; border-radius: 8px; overflow: hidden; margin-bottom: 8px; height: 110px;">
            <img src="${item.images[0]}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" />
            <span style="position: absolute; top: 6px; left: 6px; background: #FFB400; color: #0B1220; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
              ${item.type === 'rent' ? 'كراء / Location' : 'بيع / Vente'}
            </span>
          </div>
          <div style="font-weight: 800; font-size: 13px; color: #0B1220; line-height: 1.3; margin-bottom: 4px;">
            ${title}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
            📍 ${cityName}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 6px;">
            <span style="font-weight: 900; color: #0B1220; font-size: 14px;">
              ${formattedPrice}
            </span>
            <button id="view-listing-${item.id}" style="
              background: #0B1220;
              color: #FFB400;
              border: none;
              padding: 4px 10px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 11px;
              cursor: pointer;
            ">
              ${language === 'ar' ? 'عرض التفاصيل' : 'Voir'}
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-listing-${item.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedListing(item);
          };
        }
      });

      markersLayer.addLayer(marker);
    });

    return () => {
      // clean up
    };
  }, [listings, language, setSelectedListing]);

  // Handle fly to city
  const handleCitySelect = (cityId: string) => {
    setSelectedCityId(cityId);
    if (!cityId || !mapInstanceRef.current) return;

    const city = MOROCCAN_CITIES.find(c => c.id === cityId);
    if (city) {
      mapInstanceRef.current.flyTo([city.lat, city.lng], 11, {
        duration: 1.5,
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
      {/* Map Header Bar */}
      <div className="p-4 sm:p-5 bg-ink text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-steel/60">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h3 className="text-base sm:text-lg font-black text-white">
              {t('map_section.title')}
            </h3>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('map_section.subtitle')}
          </p>
        </div>

        {/* Quick City Centering Select */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 hidden sm:inline">
            {t('map_section.city_filter')}
          </span>
          <div className="relative">
            <select
              value={selectedCityId}
              onChange={(e) => handleCitySelect(e.target.value)}
              className="min-h-[44px] ps-3 pe-8 py-2 rounded-xl bg-steel text-white text-xs font-bold border border-steel-light focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="">{language === 'ar' ? 'اختر مدينة للتكبير' : 'Centrer sur...'}</option>
              {MOROCCAN_CITIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-ink text-white">
                  {language === 'ar' ? c.nameAr : c.nameFr}
                </option>
              ))}
            </select>
            <Navigation className="w-3.5 h-3.5 absolute end-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-[520px] sm:h-[620px] z-10 bg-slate-100"
      />
    </div>
  );
};
