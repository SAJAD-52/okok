// ============================================================================
// JADIJCB: Marketplace Interactive Leaflet Map with Price Bubbles
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { RefreshCw, MapPin, ChevronRight, ChevronLeft, ShieldCheck, Truck } from 'lucide-react';
import { Machine } from '../../types/database';
import { useLanguage } from '../../hooks/useLanguage';
import { Button } from '../ui/Button';

interface MarketplaceMapProps {
  machines: Machine[];
  onSearchArea?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

// Map Move Detector Sub-component
function MapMoveWatcher({ onMapMoved }: { onMapMoved: () => void }) {
  useMapEvents({
    dragend() {
      onMapMoved();
    },
    zoomend() {
      onMapMoved();
    },
  });
  return null;
}

export const MarketplaceMap: React.FC<MarketplaceMapProps> = ({
  machines,
  onSearchArea,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);

  // Morocco Center
  const moroccoCenter: [number, number] = [31.8, -7.1];

  // Helper to generate custom Leaflet Price Bubble DivIcon
  const createPriceBubbleIcon = (machine: Machine) => {
    const isRent = machine.listing_mode !== 'sale';
    const priceText = isRent
      ? `${(machine.rate_daily || 0).toLocaleString('fr-FR')} ${lang === 'fr' ? 'DH' : 'د.م'}`
      : `${Math.round((machine.sale_price || 0) / 1000)}k ${lang === 'fr' ? 'DH' : 'د.م'}`;

    return L.divIcon({
      className: 'custom-price-marker',
      html: `
        <div style="
          background-color: ${isRent ? '#FFB400' : '#0B1220'};
          color: ${isRent ? '#0B1220' : '#FFFFFF'};
          padding: 4px 8px;
          border-radius: 9999px;
          font-weight: 800;
          font-size: 11px;
          font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          border: 2px solid #FFFFFF;
          display: flex;
          align-items: center;
          gap: 4px;
          transform: translate(-50%, -100%);
          cursor: pointer;
        ">
          <span>${priceText}</span>
        </div>
      `,
      iconSize: [60, 24],
      iconAnchor: [30, 24],
    });
  };

  const handleSearchThisArea = () => {
    setShowSearchAreaBtn(false);
    if (onSearchArea) {
      onSearchArea({ north: 36, south: 27, east: -1, west: -13 });
    }
  };

  return (
    <div className="relative w-full h-[600px] lg:h-[720px] rounded-3xl overflow-hidden border-2 border-steel-200 shadow-soft">
      {/* Floating "Search this area" button */}
      {showSearchAreaBtn && (
        <div className="absolute top-4 inset-x-0 mx-auto w-fit z-20">
          <Button
            type="button"
            variant="dark"
            size="sm"
            onClick={handleSearchThisArea}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-primary" />}
            className="shadow-elevated font-black text-xs px-4 py-2 min-h-[40px] bg-ink/95 backdrop-blur-md"
          >
            {lang === 'fr' ? 'Rechercher dans cette zone' : 'إعادة البحث في هذا النطاق'}
          </Button>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <MapContainer
        center={moroccoCenter}
        zoom={6}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapMoveWatcher onMapMoved={() => setShowSearchAreaBtn(true)} />

        {machines.map((machine) => {
          const lat = machine.lat || machine.location_lat || 33.5731;
          const lng = machine.lng || machine.location_lng || -7.5898;
          const isRent = machine.listing_mode !== 'sale';
          const title = lang === 'fr' ? machine.title_fr : machine.title_ar;

          return (
            <Marker
              key={machine.id}
              position={[lat, lng]}
              icon={createPriceBubbleIcon(machine)}
            >
              <Popup className="custom-leaflet-popup">
                <div className="w-64 text-start p-1 space-y-2">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-steel-100">
                    <img
                      src={machine.images[0] || 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400&q=80'}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-2 start-2 px-2 py-0.5 rounded text-[10px] font-black ${
                        isRent ? 'bg-primary text-ink' : 'bg-ink text-white'
                      }`}
                    >
                      {isRent ? (lang === 'fr' ? 'Location' : 'كراء') : (lang === 'fr' ? 'Vente' : 'بيع')}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-xs text-ink line-clamp-1">
                      {title}
                    </h4>
                    <p className="text-[11px] text-steel-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-primary-dark" />
                      <span>{machine.city || 'Maroc'}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-steel-100">
                    <span className="font-mono font-black text-xs text-ink">
                      {isRent
                        ? `${machine.rate_daily?.toLocaleString('fr-FR')} MAD/j`
                        : `${machine.sale_price?.toLocaleString('fr-FR')} MAD`}
                    </span>

                    <button
                      type="button"
                      onClick={() => navigate(`/marketplace/${machine.id}`)}
                      className="text-[11px] font-extrabold text-primary-dark hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{t('marketplace.view_details')}</span>
                      {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MarketplaceMap;
