import type { MoneyString } from '@/lib/api';

/** Enum values from Modules/Inventory/app/Enums (BACKEND_API_REFERENCE.md §12). */
export const VEHICLE_STATUSES = [
  'available',
  'reserved',
  'sold',
  'under_maintenance',
  'transferred',
] as const;
export const TRANSMISSIONS = ['automatic', 'manual', 'cvt', 'dct'] as const;
export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'natural_gas'] as const;
export const VEHICLE_TYPES = [
  'sedan',
  'hatchback',
  'suv',
  'crossover',
  'pickup',
  'van',
  'coupe',
  'convertible',
  'minibus',
  'other',
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type FuelType = (typeof FUEL_TYPES)[number];
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface IdName {
  id: number;
  name: string;
}

/** `VehicleResource` (Modules/Inventory/app/Http/Resources/VehicleResource.php). */
export interface Vehicle {
  id: number;
  stock_number: string;
  brand?: IdName;
  model?: IdName;
  year: number;
  vin: string | null;
  engine_number: string | null;
  color: string | null;
  mileage: number;
  transmission: Transmission;
  fuel_type: FuelType;
  vehicle_type: VehicleType;
  /** Omitted (key absent) without `vehicles.view-cost`. */
  purchase_price?: MoneyString;
  additional_costs?: MoneyString;
  total_cost?: MoneyString;
  selling_price: MoneyString | null;
  purchase_date: string | null;
  supplier?: IdName | null;
  branch?: IdName;
  description: string | null;
  specifications: Record<string, string> | null;
  status: VehicleStatus;
  images?: { id: number; url: string; is_primary: boolean }[];
  created_at: string;
  updated_at: string;
}

/** Raw catalog models returned by GET /vehicle-brands and /vehicle-models. */
export interface VehicleBrand {
  id: number;
  name: string;
  country: string | null;
  is_active: boolean;
}

export interface VehicleModel {
  id: number;
  brand_id: number;
  name: string;
  is_active: boolean;
}
