// ============================================================================
// JADIJCB: Database & Domain TypeScript Definitions
// ============================================================================

export type UserRole = 'owner' | 'client' | 'admin' | 'contractor' | 'equipment_owner' | 'dealer';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended';
export type ListingMode = 'rent' | 'sale';
export type MachineCondition = 'new' | 'used' | 'excellent' | 'good' | 'fair';
export type MachineStatus = 'available' | 'rented' | 'maintenance' | 'inactive';
export type BookingStatus = 'pending' | 'active' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'rib' | 'wafacash';
export type SparePartCondition = 'new' | 'used' | 'refurbished';
export type RentalTermType = 'hourly' | 'daily' | 'weekly';

export interface UserProfile {
  id: string;
  email?: string;
  phone: string;
  full_name: string;
  company_name?: string;
  role: UserRole;
  city?: string;
  city_id?: string;
  address?: string;
  ice_number?: string; // Identifiant Commun de l’Entreprise (Morocco)
  rc_number?: string;  // Registre de Commerce (Morocco)
  verified?: boolean;
  avatar_url?: string;
  whatsapp_verified?: boolean;
  subscription_status?: SubscriptionStatus;
  trial_started_at?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  preferred_lang?: 'ar' | 'fr';
  onboarding_completed?: boolean;
  last_active_at?: string;
  activation_at?: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  proof_url: string;
  status: PaymentStatus;
  reviewed_by?: string;
  created_at: string;
  user_phone?: string;
  user_name?: string;
  company_name?: string;
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
  category?: string;
  category_id: string;
  brand: string;
  model: string;
  year: number;
  listing_mode?: ListingMode;
  condition: MachineCondition;
  city?: string;
  city_id: string;
  lat?: number;
  lng?: number;
  location_lat: number;
  location_lng: number;
  rate_hourly: number;
  rate_daily: number;
  rate_weekly: number;
  hourly_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  sale_price?: number;
  currency: 'MAD';
  with_operator: boolean;
  operator_daily_rate?: number;
  fuel_included: boolean;
  delivery_available: boolean;
  delivery_fee_per_km?: number;
  status: MachineStatus;
  is_published?: boolean;
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
  owner_id: string;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
  renter_id?: string;
  rental_term?: RentalTermType;
  start_at?: string;
  end_at?: string;
  start_date?: string;
  end_date?: string;
  duration_units?: number;
  unit_price?: number;
  total_price: number;
  deposit_amount?: number;
  rate_type?: 'hourly' | 'daily' | 'weekly';
  fuel_included?: boolean;
  delivery_fee?: number;
  client_ref_id?: string;
  paid_amount?: number;
  balance_due?: number;
  payment_status?: 'unpaid' | 'partial' | 'paid';
  with_operator: boolean;
  delivery_requested?: boolean;
  site_city_id?: string;
  site_address?: string;
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
  receiver_id?: string;
  body?: string;
  content: string;
  read_at?: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  machine_id?: string;
  participant_a?: string;
  participant_b?: string;
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

export interface ContractorSite {
  id: string;
  contractor_id: string;
  name: string;
  city: string;
  address?: string;
  lat: number;
  lng: number;
  manager_name?: string;
  manager_phone?: string;
  active_machines_count?: number;
  created_at: string;
}

export type ExpenseCategory =
  | 'fuel'               // وقود وديزل
  | 'operator'           // أجرة / راتب / سلفة السائق
  | 'preventive_service' // صيانة دورية، زيوت وفيش (Vidange)
  | 'repair_breakdown'   // إصلاح أعطاب وقطع غيار (Pannes & Pièces)
  | 'transport'          // نقل وديباناج (Porte-char)
  | 'insurance_tech'     // تأمين وفحص تقني (Assurance & Contrôle)
  | 'other';             // مصاريف وتكاليف أخرى

export interface MachineExpense {
  id: string;
  owner_id: string;
  machine_id: string;
  category: ExpenseCategory;
  amount: number; // MAD
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  receipt_number?: string;
  vendor_name?: string;
  downtime_hours?: number; // ساعات توقف الآلية
  hours_or_km?: number;
  next_due_date?: string;
  expense_type?: 'maintenance' | 'expense';
  created_at: string;
  machine?: Partial<Machine>;
}

export interface BusinessProfile {
  id?: string;
  owner_id: string;
  company_name: string;
  logo_url?: string;
  stamp_signature_url?: string;
  ice?: string;
  rc?: string;
  identifiant_fiscal?: string;
  taxe_professionnelle?: string;
  address?: string;
  phone?: string;
  rib?: string;
  vat_enabled: boolean;
  default_terms_ar?: string;
  default_terms_fr?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  cin_or_ice?: string;
  city?: string;
  notes?: string;
  total_billed?: number;
  unpaid_balance?: number;
  rentals_count?: number;
  created_at: string;
  updated_at?: string;
}

export type PaymentMethodType = 'cash' | 'rib' | 'wafacash' | 'cheque';

export interface BookingPayment {
  id: string;
  booking_id: string;
  owner_id: string;
  amount: number;
  method: PaymentMethodType;
  payment_date: string;
  note?: string;
  created_at: string;
}

export type DocumentType = 'contract' | 'invoice' | 'receipt';

export interface DocumentRecord {
  id: string;
  owner_id: string;
  booking_id: string;
  type: DocumentType;
  number: string;
  issued_at: string;
  data: Record<string, any>;
  created_at: string;
}

export interface Lead {
  id: string;
  owner_id: string;
  machine_id?: string;
  client_name: string;
  client_phone: string;
  city?: string;
  rental_duration?: string;
  start_date?: string;
  notes?: string;
  is_contacted: boolean;
  contacted_at?: string;
  created_at: string;
  machine?: Partial<Machine>;
}

