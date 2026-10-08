import { APPOINTMENTS, SERVICES, STYLISTS, getService, type AppointmentStatus } from './data';

export const LANDING_SERVICES = SERVICES;
export const LANDING_STYLISTS = STYLISTS;

export const LANDING_SERVICE_IMAGES: Record<string, string> = {
  s1: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85',
  s2: 'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=900&q=85',
  s3: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85',
  s4: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=85',
  s5: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=900&q=85',
  s6: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85',
  s7: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85',
  s8: 'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=900&q=85',
  s9: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=85',
  s10: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=900&q=85',
  s11: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85',
  s12: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85',
};

export const LANDING_STYLIST_IMAGES: Record<string, string> = {
  st1: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&h=320&q=80',
  st2: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=320&h=320&q=80',
  st3: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=320&h=320&q=80',
  st4: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=320&h=320&q=80',
  st5: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&h=320&q=80',
  st6: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=320&h=320&q=80',
};

export const LANDING_LOCATION = {
  address: 'Apartadó-Antioquia',
  reference: 'Barbería EBV · Apartadó, Antioquia.',
  mapQuery: 'barberia+Apartado+Antioquia',
  phone: '+57 300 000 0000',
  email: 'contacto@barberiaebv.com',
};

export const LANDING_HOURS = [
  { days: 'Lunes a sábado', hours: '8:00 a. m. – 8:00 p. m.' },
  { days: 'Domingos', hours: '9:00 a. m. – 4:00 p. m.' },
];

export function getRecentAppointmentNotifications(userName: string) {
  return APPOINTMENTS
    .filter(appointment =>
      appointment.clientName === userName &&
      ['confirmed', 'pending', 'cancelled'].includes(appointment.status)
    )
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 3)
    .map(appointment => ({
      id: appointment.id,
      serviceName: getService(appointment.serviceId)?.name ?? 'Tu cita',
      date: appointment.date,
      time: appointment.time,
      status: appointment.status as Extract<AppointmentStatus, 'confirmed' | 'pending' | 'cancelled'>,
    }));
}
