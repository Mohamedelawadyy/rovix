import type {
  FuelType,
  MovementStatus,
  Transmission,
  VehicleCostType,
  VehicleStatus,
  VehicleType,
} from './types';

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

export const vehicleCostTypeLabels: Record<VehicleCostType, string> = {
  transportation: 'نقل',
  maintenance: 'صيانة',
  inspection: 'فحص',
  licensing: 'ترخيص',
  registration: 'تسجيل',
  repairs: 'إصلاحات',
  other: 'أخرى',
};

export const movementStatusLabels: Record<MovementStatus, string> = {
  in_transit: 'في الطريق',
  completed: 'تم الاستلام',
  cancelled: 'ملغي',
};

export const movementStatusTone: Record<MovementStatus, 'info' | 'success' | 'neutral'> = {
  in_transit: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

/** Workflows that change a vehicle's status (backend morph aliases). Unknown ones show as-is. */
export const statusSourceLabels: Record<string, string> = {
  sales_contract: 'عقد بيع',
  vehicle_reservation: 'حجز',
  vehicle_movement: 'تحويل بين الفروع',
  purchase_order: 'أمر شراء',
};
