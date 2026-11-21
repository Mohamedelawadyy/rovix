import type { FuelType, Transmission, VehicleStatus, VehicleType } from './types';

/** Arabic labels for backend enum values (the API returns untranslated snake_case values). */
export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  available: 'متاحة',
  reserved: 'محجوزة',
  sold: 'مباعة',
  under_maintenance: 'في الصيانة',
  transferred: 'محوّلة لفرع',
};

export const transmissionLabels: Record<Transmission, string> = {
  automatic: 'أوتوماتيك',
  manual: 'مانيوال',
  cvt: 'CVT',
  dct: 'DCT',
};

export const fuelTypeLabels: Record<FuelType, string> = {
  petrol: 'بنزين',
  diesel: 'ديزل',
  hybrid: 'هايبرد',
  electric: 'كهرباء',
  natural_gas: 'غاز طبيعي',
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  sedan: 'سيدان',
  hatchback: 'هاتشباك',
  suv: 'SUV',
  crossover: 'كروس أوفر',
  pickup: 'بيك أب',
  van: 'فان',
  coupe: 'كوبيه',
  convertible: 'مكشوفة',
  minibus: 'ميني باص',
  other: 'أخرى',
};

/** Badge tone per status, matching the design system (semantic colors only). */
export const vehicleStatusTone: Record<VehicleStatus, 'success' | 'info' | 'neutral' | 'warning'> =
  {
    available: 'success',
    reserved: 'info',
    sold: 'neutral',
    under_maintenance: 'warning',
    transferred: 'info',
  };
