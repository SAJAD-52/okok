import { create } from 'zustand';
import { MachineListing, FilterState, QuoteRequest } from '../types';
import { INITIAL_LISTINGS } from '../data/mockListings';
import { toggleLanguage as i18nToggle, setAppLanguage as i18nSet } from '../i18n';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'error';
}

interface AppStore {
  language: 'ar' | 'fr';
  toggleLanguage: () => void;
  setLanguage: (lang: 'ar' | 'fr') => void;

  listings: MachineListing[];
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;

  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  selectedListing: MachineListing | null;
  setSelectedListing: (listing: MachineListing | null) => void;

  quoteListing: MachineListing | null;
  setQuoteListing: (listing: MachineListing | null) => void;

  isAddListingOpen: boolean;
  setIsAddListingOpen: (open: boolean) => void;

  quotes: QuoteRequest[];
  addQuote: (quote: Omit<QuoteRequest, 'id' | 'createdAt' | 'status'>) => void;
  addListing: (listing: MachineListing) => void;

  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'info' | 'error') => void;
  removeToast: (id: string) => void;
}

const defaultFilters: FilterState = {
  type: 'all',
  categoryId: '',
  cityId: '',
  brand: '',
  minPrice: 0,
  maxPrice: 2000000,
  searchQuery: '',
  withOperatorOnly: false,
  deliveryAvailableOnly: false,
  verifiedOwnersOnly: false,
  sortBy: 'newest',
};

const getSavedFavorites = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('jadijcb_favorites');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  language: (typeof window !== 'undefined' && localStorage.getItem('jadijcb_lang') === 'fr') ? 'fr' : 'ar',
  
  toggleLanguage: () => {
    const nextLang = i18nToggle();
    set({ language: nextLang as 'ar' | 'fr' });
  },

  setLanguage: (lang) => {
    i18nSet(lang);
    set({ language: lang });
  },

  listings: INITIAL_LISTINGS,
  filters: defaultFilters,

  setFilter: (key, value) => {
    set(state => ({
      filters: { ...state.filters, [key]: value },
    }));
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },

  favorites: getSavedFavorites(),

  toggleFavorite: (id) => {
    const current = get().favorites;
    const exists = current.includes(id);
    const updated = exists ? current.filter(item => item !== id) : [...current, id];
    try {
      localStorage.setItem('jadijcb_favorites', JSON.stringify(updated));
    } catch {
      // ignore
    }
    set({ favorites: updated });
    get().addToast(
      exists ? (get().language === 'ar' ? 'تمت إزالة الآلية من المفضلة' : 'Retiré des favoris') : 
               (get().language === 'ar' ? 'تمت إضافة الآلية إلى المفضلة' : 'Ajouté aux favoris'),
      'info'
    );
  },

  isFavorite: (id) => get().favorites.includes(id),

  selectedListing: null,
  setSelectedListing: (listing) => set({ selectedListing: listing }),

  quoteListing: null,
  setQuoteListing: (listing) => set({ quoteListing: listing }),

  isAddListingOpen: false,
  setIsAddListingOpen: (open) => set({ isAddListingOpen: open }),

  quotes: [],
  addQuote: (quoteData) => {
    const newQuote: QuoteRequest = {
      ...quoteData,
      id: `quote-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    set(state => ({ quotes: [newQuote, ...state.quotes] }));
  },

  addListing: (listing) => {
    set(state => ({ listings: [listing, ...state.listings] }));
  },

  toasts: [],
  addToast: (text, type = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set(state => ({ toasts: [...state.toasts, { id, text, type }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));
