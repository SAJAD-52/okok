// ============================================================================
// JADIJCB: Geographic & InDrive-style Radar Utilities for Job Sites
// ============================================================================

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

export function estimateDeliveryMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 15;
  if (distanceKm <= 5) return 25;
  if (distanceKm <= 15) return 40;
  if (distanceKm <= 35) return 60;
  if (distanceKm <= 60) return 90;
  if (distanceKm <= 100) return 150;
  return Math.round(distanceKm * 1.5 + 25);
}

export function formatDistanceKm(distanceKm: number, lang: 'ar' | 'fr' = 'ar'): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return lang === 'fr' ? `${meters} m` : `${meters} متر`;
  }
  return lang === 'fr' ? `${distanceKm} km` : `${distanceKm} كم`;
}

export function formatEta(minutes: number, lang: 'ar' | 'fr' = 'ar'): string {
  if (minutes < 60) {
    return lang === 'fr' ? `~${minutes} min` : `حوالي ${minutes} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) {
    return lang === 'fr' ? `~${hours} h` : `حوالي ${hours} ساعة`;
  }
  return lang === 'fr'
    ? `~${hours} h ${remMinutes} min`
    : `حوالي ${hours} س و ${remMinutes} د`;
}
