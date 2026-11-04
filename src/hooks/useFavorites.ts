import { useState, useEffect, useCallback } from 'react';
import { toast } from '../components/ui/Toast';

const FAVORITES_STORAGE_KEY = 'jadijcb_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : ['mac_1', 'mac_3'];
    } catch {
      return ['mac_1', 'mac_3'];
    }
  });

  const toggleFavorite = useCallback((machineId: string, title?: string) => {
    setFavorites((prev) => {
      const isFav = prev.includes(machineId);
      const updated = isFav
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId];

      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save favorites to localStorage:', err);
      }

      if (!isFav) {
        toast.success(
          title
            ? `تمت إضافة "${title}" إلى قائمة المفضلة`
            : 'تمت إضافة الآلية إلى المفضلة'
        );
      } else {
        toast.info(
          title
            ? `تمت إزالة "${title}" من المفضلة`
            : 'تمت الإزالة من المفضلة'
        );
      }

      return updated;
    });
  }, []);

  const isFavorite = useCallback(
    (machineId: string) => favorites.includes(machineId),
    [favorites]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
  };
}

export default useFavorites;
