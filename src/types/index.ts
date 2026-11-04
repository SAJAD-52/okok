export type TransactionType = 'rent' | 'sale';
export type PriceUnit = 'hour' | 'day' | 'week' | 'month' | 'total';
export type MachineCondition = 'new' | 'excellent' | 'good' | 'fair';

export interface OwnerInfo {
  id: string;
  name: string;
  companyName: string;
  isVerified: boolean;
  phone: string;
  whatsapp: string;
  rating: number;
  reviewsCount: number;
  memberSince: string;
  city: string;
}

export interface MachineListing {
  id: string;
  titleAr: string;
  titleFr: string;
  descriptionAr: string;
  descriptionFr: string;
  type: TransactionType;
  categoryId: string;
  brand: string;
  model: string;
  year: number;
  hoursWorked?: number;
  weightTons?: number;
  powerHp?: number;
  condition: MachineCondition;
  price: number; // in MAD
  priceUnit: PriceUnit;
  cityId: string;
  address: string;
  lat: number;
  lng: number;
  images: string[];
  featuresAr: string[];
  featuresFr: string[];
  withOperator: boolean;
  fuelIncluded: boolean;
  deliveryAvailable: boolean;
  depositMAD?: number;
  minRentalDays?: number;
  owner: OwnerInfo;
  status: 'available' | 'rented' | 'sold';
  viewsCount: number;
  createdAt: string;
}

export interface QuoteRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  cityId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  withOperator: boolean;
  fuelIncluded: boolean;
  notes: string;
  status: 'pending' | 'accepted' | 'rejected';
  estimatedTotalMAD: number;
  createdAt: string;
}

export interface FilterState {
  type: 'all' | 'rent' | 'sale';
  categoryId: string;
  cityId: string;
  brand: string;
  minPrice: number;
  maxPrice: number;
  searchQuery: string;
  withOperatorOnly: boolean;
  deliveryAvailableOnly: boolean;
  verifiedOwnersOnly: boolean;
  sortBy: 'price_asc' | 'price_desc' | 'newest' | 'rating';
}
