export type UserRole = 'contractor' | 'equipment_owner' | 'dealer' | 'admin';

export type MachineCondition = 'excellent' | 'good' | 'fair';
export type MachineStatus = 'available' | 'rented' | 'maintenance' | 'inactive';
export type SparePartCondition = 'new' | 'used' | 'refurbished';
export type RentalTermType = 'hourly' | 'daily' | 'weekly';
export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  company_name?: string;
  role: UserRole;
  city_id: string;
  address?: string;
  ice_number?: string; // Identifiant Commun de l’Entreprise (Morocco)
  rc_number?: string;  // Registre de Commerce (Morocco)
  verified: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface EquipmentSpecs {
  operating_weight_ton?: number;
  bucket_capacity_m3?: number;
  engine_power_hp?: number;
  max_dig_depth_m?: number;
  boom_reach_m?: number;
  lifting_capacity_ton?: number;
  fuel_type?: 'diesel' | 'electric' | 'hybrid';
}

export interface Machine {
  id: string;
  owner_id: string;
  title_ar: string;
  title_fr: string;
  description_ar: string;
  description_fr: string;
  category_id: string;
  brand: string;
  model: string;
  year: number;
  condition: MachineCondition;
  city_id: string;
  location_lat: number;
  location_lng: number;
  rate_hourly: number;
  rate_daily: number;
  rate_weekly: number;
  currency: 'MAD';
  with_operator: boolean;
  operator_daily_rate?: number;
  fuel_included: boolean;
  delivery_available: boolean;
  delivery_fee_per_km?: number;
  status: MachineStatus;
  images: string[];
  specs: EquipmentSpecs;
  views_count: number;
  rating_avg: number;
  reviews_count: number;
  owner?: Partial<UserProfile>;
  created_at: string;
  updated_at: string;
}

export interface SparePart {
  id: string;
  seller_id: string;
  name_ar: string;
  name_fr: string;
  part_number: string;
  brand: string;
  category_id: string;
  compatible_models: string[];
  condition: SparePartCondition;
  price: number;
  stock_quantity: number;
  city_id: string;
  images: string[];
  seller?: Partial<UserProfile>;
  created_at: string;
}

export interface Booking {
  id: string;
  machine_id: string;
  renter_id: string;
  owner_id: string;
  rental_term: RentalTermType;
  start_date: string;
  end_date: string;
  duration_units: number; // hours or days or weeks
  unit_price: number;
  total_price: number;
  deposit_amount: number;
  with_operator: boolean;
  delivery_requested: boolean;
  site_city_id: string;
  site_address: string;
  status: BookingStatus;
  notes?: string;
  machine?: Partial<Machine>;
  renter?: Partial<UserProfile>;
  owner?: Partial<UserProfile>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  machine_id?: string;
  participants: UserProfile[];
  last_message?: string;
  last_message_at: string;
  unread_count: number;
}

export interface Review {
  id: string;
  machine_id: string;
  author_id: string;
  author_name: string;
  rating: number; // 1 to 5
  comment: string;
  created_at: string;
}

export interface MoroccanCity {
  id: string;
  name_ar: string;
  name_fr: string;
  region_ar: string;
  region_fr: string;
  nameAr: string;
  nameFr: string;
  regionAr?: string;
  regionFr?: string;
  lat: number;
  lng: number;
  is_major: boolean;
  isMajor?: boolean;
}

export interface EquipmentCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_fr: string;
  description_ar: string;
  description_fr: string;
  icon_name: string;
  badge_count: number;
}
