import type { BadgeTone } from '@/components/ui/Badge';
import type { ReservationStatus } from './types';

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  active: 'نشط',
  converted: 'اتحوّل لعقد',
  released: 'ملغي',
};

export const reservationStatusTone: Record<ReservationStatus, BadgeTone> = {
  active: 'info',
  converted: 'success',
  released: 'neutral',
};
