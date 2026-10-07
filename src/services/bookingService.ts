import {
  APPOINTMENTS,
  STYLISTS,
  getService,
  getStylistsForService,
} from "../data";

const MOCK_API_DELAY_MS = 450;
const ANY_STYLIST_ID = "any";
const SLOT_INTERVAL_MINUTES = 15;
const SERVER_TIME_ZONE = "America/Bogota";
const SLOT_HOLD_DURATION_MS = 5 * 60 * 1000;
const MINIMUM_ADVANCE_MINUTES = 30;
const MOCK_CONFLICT_PROBABILITY = 0.2;
const LUNCH_BREAK = { start: 13 * 60, end: 14 * 60 };

interface AvailabilityRequest {
  serviceId: string;
  stylistId: string;
  date: string;
  holdId?: string;
}

interface MockServerTime {
  timestamp: number;
  timeZone: string;
}

export interface AvailableSlot {
  time: string;
  stylistId: string;
}

export interface AvailabilityResponse {
  slots: AvailableSlot[];
  serverTime: MockServerTime;
}

export interface AvailabilityDay {
  date: string;
  hasAvailability: boolean;
}

export interface SlotHold {
  id: string;
  stylistId: string;
  expiresAt: number;
}

interface MockReservation extends SlotHold {
  date: string;
  time: string;
  duration: number;
  status: "held" | "confirmed";
}

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "SLOT_TAKEN" | "HOLD_EXPIRED" | "HOLD_NOT_FOUND",
  ) {
    super(message);
    this.name = "BookingServiceError";
  }

  get response() {
    return { status: this.status, code: this.code, message: this.message };
  }
}

export interface ServerTime {
  timestamp: number;
  timeZone: string;
}

export function getServidorTime(): ServerTime {
  return {
    timestamp: new Date().getTime(),
    timeZone: SERVER_TIME_ZONE,
  };
}

interface TimeInterval {
  start: number;
  end: number;
}

const mockReservations = new Map<string, MockReservation>();
const expiredHoldIds = new Set<string>();

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getZonedDateParts(timestamp: number, timeZone: string): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(timestamp)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
}

function toDateKey(parts: Record<string, string>): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(date: string, serverDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("La fecha debe tener el formato AAAA-MM-DD.");

  const [, year, month, day] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const parsedDateKey = `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}-${String(parsedDate.getUTCDate()).padStart(2, "0")}`;
  if (parsedDateKey !== date) throw new Error("La fecha seleccionada no es válida.");
  if (date < serverDate) throw new Error("No se puede consultar disponibilidad en una fecha pasada.");

  return parsedDate;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainder = String(minutes % 60).padStart(2, "0");
  return `${hours}:${remainder}`;
}

function getMockAppointments(
  date: string,
  stylistId: string,
  serverDate: string,
  ignoredHoldId?: string,
): TimeInterval[] {
  for (const [id, reservation] of mockReservations) {
    if (reservation.status === "held" && reservation.expiresAt <= getServidorTime().timestamp) {
      mockReservations.delete(id);
      expiredHoldIds.add(id);
    }
  }

  const existingAppointments = APPOINTMENTS
    .filter(appointment =>
      appointment.date === date &&
      appointment.stylistId === stylistId &&
      (appointment.status === "confirmed" || appointment.status === "pending")
    )
    .map(appointment => {
      const service = getService(appointment.serviceId);
      const start = toMinutes(appointment.time);
      return { start, end: start + (service?.duration ?? 30) };
    });
  const mockBookings = [...mockReservations.values()]
    .filter(reservation =>
      reservation.id !== ignoredHoldId &&
      reservation.date === date &&
      reservation.stylistId === stylistId &&
      (reservation.status === "confirmed" || reservation.expiresAt > getServidorTime().timestamp)
    )
    .map(reservation => {
      const start = toMinutes(reservation.time);
      return { start, end: start + reservation.duration };
    });

  if (stylistId !== "st1") return [...existingAppointments, ...mockBookings];

  if (date === addDays(serverDate, 1)) {
    return [...existingAppointments, ...mockBookings, { start: 10 * 60 + 30, end: 11 * 60 + 30 }];
  }

  if (date === addDays(serverDate, 2)) {
    return [
      ...existingAppointments,
      ...mockBookings,
      { start: 9 * 60, end: 13 * 60 },
      { start: 14 * 60, end: 19 * 60 },
    ];
  }

  return [...existingAppointments, ...mockBookings];
}

function getWorkingHours(date: Date): TimeInterval {
  const isSunday = date.getUTCDay() === 0;
  return { start: 9 * 60, end: isSunday ? 16 * 60 : 19 * 60 };
}

function overlaps(first: TimeInterval, second: TimeInterval): boolean {
  return first.start < second.end && second.start < first.end;
}

function getStylistSlots(
  serviceDuration: number,
  date: Date,
  dateKey: string,
  stylistId: string,
  serverDate: string,
  ignoredHoldId?: string,
): AvailableSlot[] {
  const workingHours = getWorkingHours(date);
  const appointments = getMockAppointments(dateKey, stylistId, serverDate, ignoredHoldId);
  const slots: AvailableSlot[] = [];

  for (
    let start = workingHours.start;
    start + serviceDuration <= workingHours.end;
    start += SLOT_INTERVAL_MINUTES
  ) {
    const interval = { start, end: start + serviceDuration };
    if (
      !overlaps(interval, LUNCH_BREAK) &&
      !appointments.some(appointment => overlaps(interval, appointment))
    ) {
      slots.push({ time: formatTime(start), stylistId });
    }
  }

  return slots;
}

export async function getAvailability({
  serviceId,
  stylistId,
  date,
  holdId,
}: AvailabilityRequest): Promise<AvailabilityResponse> {
  await delay(MOCK_API_DELAY_MS);

  const serverTime = getServidorTime();
  const serverTimeParts = getZonedDateParts(serverTime.timestamp, serverTime.timeZone);
  const serverDate = toDateKey(serverTimeParts);
  const service = getService(serviceId);
  if (!service) throw new Error("No se encontró el servicio seleccionado.");

  const parsedDate = parseDate(date, serverDate);
  const eligibleStylists = stylistId === ANY_STYLIST_ID
    ? getStylistsForService(serviceId)
    : STYLISTS.filter(stylist =>
      stylist.id === stylistId && stylist.serviceIds.includes(serviceId)
    );

  if (!eligibleStylists.length) {
    throw new Error("El estilista seleccionado no está habilitado para este servicio.");
  }

  const slotsByTime = new Map<string, AvailableSlot>();
  for (const stylist of eligibleStylists) {
    for (const slot of getStylistSlots(
      service.duration,
      parsedDate,
      date,
      stylist.id,
      serverDate,
      holdId,
    )) {
      if (!slotsByTime.has(slot.time)) slotsByTime.set(slot.time, slot);
    }
  }

  const currentMinutes = Number(serverTimeParts.hour) * 60 +
    Number(serverTimeParts.minute) +
    Number(serverTimeParts.second ?? "0") / 60;
  const slots = [...slotsByTime.values()]
    .filter(slot =>
      date !== serverDate ||
      toMinutes(slot.time) - currentMinutes >= MINIMUM_ADVANCE_MINUTES
    )
    .sort((first, second) => first.time.localeCompare(second.time));

  return { slots, serverTime };
}

export async function reservarTurno(request: AvailabilityRequest & { time: string }): Promise<SlotHold> {
  await delay(MOCK_API_DELAY_MS);
  if (Math.random() < MOCK_CONFLICT_PROBABILITY) {
    throw new BookingServiceError(
      "Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro turno.",
      409,
      "SLOT_TAKEN",
    );
  }

  const service = getService(request.serviceId);
  if (!service) throw new Error("No se encontró el servicio seleccionado.");

  const availability = await getAvailability(request);
  const selectedSlot = availability.slots.find(slot => slot.time === request.time);

  if (!selectedSlot) {
    throw new BookingServiceError(
      "Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro turno.",
      409,
      "SLOT_TAKEN",
    );
  }

  const hold: MockReservation = {
    id: crypto.randomUUID(),
    stylistId: selectedSlot.stylistId,
    date: request.date,
    time: selectedSlot.time,
    duration: service.duration,
    expiresAt: getServidorTime().timestamp + SLOT_HOLD_DURATION_MS,
    status: "held",
  };
  mockReservations.set(hold.id, hold);
  return { id: hold.id, stylistId: hold.stylistId, expiresAt: hold.expiresAt };
}

export const holdTimeSlot = reservarTurno;

export async function releaseTimeSlot(holdId: string): Promise<void> {
  await delay(MOCK_API_DELAY_MS);
  const reservation = mockReservations.get(holdId);
  if (reservation?.status === "held") mockReservations.delete(holdId);
}

export async function confirmBooking(holdId: string): Promise<void> {
  await delay(MOCK_API_DELAY_MS);
  const reservation = mockReservations.get(holdId);

  if (!reservation || reservation.status !== "held") {
    if (expiredHoldIds.has(holdId)) {
      expiredHoldIds.delete(holdId);
      throw new BookingServiceError(
        "El tiempo para confirmar venció. Selecciona nuevamente un horario.",
        410,
        "HOLD_EXPIRED",
      );
    }
    throw new BookingServiceError(
      "El bloqueo de esta franja ya no está activo. Vuelve a seleccionar un horario.",
      404,
      "HOLD_NOT_FOUND",
    );
  }

  if (reservation.expiresAt <= getServidorTime().timestamp) {
    mockReservations.delete(holdId);
    throw new BookingServiceError(
      "El tiempo para confirmar venció. Selecciona nuevamente un horario.",
      410,
      "HOLD_EXPIRED",
    );
  }

  const start = toMinutes(reservation.time);
  const slotInterval = { start, end: start + reservation.duration };
  const takenByAnotherReservation = [...mockReservations.values()].some(other => {
    if (other.id === holdId || other.date !== reservation.date || other.stylistId !== reservation.stylistId) {
      return false;
    }
    const otherStart = toMinutes(other.time);
    return overlaps(slotInterval, { start: otherStart, end: otherStart + other.duration });
  });

  if (takenByAnotherReservation) {
    mockReservations.delete(holdId);
    throw new BookingServiceError(
      "Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro turno.",
      409,
      "SLOT_TAKEN",
    );
  }

  reservation.status = "confirmed";
  reservation.expiresAt = Number.POSITIVE_INFINITY;
}

export const getDisponibilidad = getAvailability;

export async function getAvailabilityForMonth({
  serviceId,
  stylistId,
  year,
  month,
}: {
  serviceId: string;
  stylistId: string;
  year: number;
  month: number;
}): Promise<AvailabilityDay[]> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    throw new Error("El mes solicitado no es válido.");
  }

  const today = toDateKey(getZonedDateParts(getServidorTime().timestamp, SERVER_TIME_ZONE));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dateKeys = Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const monthKey = String(month + 1).padStart(2, "0");
    return `${year}-${monthKey}-${day}`;
  });

  return Promise.all(dateKeys.map(async date => {
    if (date < today) return { date, hasAvailability: false };
    const { slots } = await getDisponibilidad({ serviceId, stylistId, date });
    return { date, hasAvailability: slots.length > 0 };
  }));
}
