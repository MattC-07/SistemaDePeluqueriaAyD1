import { APPOINTMENTS, STYLISTS, getService, getStylistsForService } from "../data";

const MOCK_API_DELAY_MS = 300;
const SLOT_HOLD_DURATION_MS = 5 * 60 * 1000;
const SLOT_INTERVAL_MINUTES = 15;
const MINIMUM_ADVANCE_MINUTES = 30;
const MOCK_CONFLICT_PROBABILITY = 0.2;
const SERVER_TIME_ZONE = "America/Bogota";
const LUNCH_BREAK = { start: 13 * 60, end: 14 * 60 };
const ANY_STYLIST_ID = "any";

export interface AvailabilityRequest {
  serviceId: string;
  stylistId: string;
  date: string;
  holdId?: string;
}

export interface AvailableSlot {
  time: string;
  stylistId: string;
}

export interface ServerTime {
  timestamp: number;
  timeZone: string;
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

export interface BookingServiceErrorResponse {
  status: number;
  code: "SLOT_TAKEN" | "HOLD_EXPIRED" | "HOLD_NOT_FOUND";
  message: string;
}

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: BookingServiceErrorResponse["code"],
  ) {
    super(message);
    this.name = "BookingServiceError";
  }

  get response(): BookingServiceErrorResponse {
    return { status: this.status, code: this.code, message: this.message };
  }
}

interface TimeInterval {
  start: number;
  end: number;
}

interface MockReservation extends SlotHold {
  date: string;
  time: string;
  duration: number;
  status: "held" | "confirmed";
}

const reservations = new Map<string, MockReservation>();
const expiredHoldIds = new Set<string>();

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function getServidorTime(): ServerTime {
  return { timestamp: Date.now(), timeZone: SERVER_TIME_ZONE };
}

function zonedParts(timestamp: number): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SERVER_TIME_ZONE,
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

function dateKey(parts: Record<string, string>): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(date: string, today: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("La fecha debe tener el formato AAAA-MM-DD.");

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const normalized = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  if (normalized !== date) throw new Error("La fecha seleccionada no es válida.");
  if (date < today) throw new Error("No se puede consultar disponibilidad en una fecha pasada.");
  return parsed;
}

function toMinutes(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error("La hora debe tener el formato HH:mm.");
  return Number(match[1]) * 60 + Number(match[2]);
}

function overlaps(first: TimeInterval, second: TimeInterval): boolean {
  return first.start < second.end && second.start < first.end;
}

function pruneExpiredHolds(now: number): void {
  for (const [id, reservation] of reservations) {
    if (reservation.status === "held" && reservation.expiresAt <= now) {
      reservations.delete(id);
      expiredHoldIds.add(id);
    }
  }
}

function mockIntervals(date: string, stylistId: string, today: string, now: number, ignoredHoldId?: string): TimeInterval[] {
  const appointments = APPOINTMENTS
    .filter(appointment =>
      appointment.date === date &&
      appointment.stylistId === stylistId &&
      (appointment.status === "confirmed" || appointment.status === "pending")
    )
    .map(appointment => {
      const start = toMinutes(appointment.time);
      return { start, end: start + (getService(appointment.serviceId)?.duration ?? 30) };
    });

  const activeReservations = [...reservations.values()]
    .filter(reservation =>
      reservation.id !== ignoredHoldId &&
      reservation.date === date &&
      reservation.stylistId === stylistId &&
      (reservation.status === "confirmed" || reservation.expiresAt > now)
    )
    .map(reservation => {
      const start = toMinutes(reservation.time);
      return { start, end: start + reservation.duration };
    });

  if (stylistId === "st1" && date === addDays(today, 1)) {
    activeReservations.push({ start: 10 * 60 + 30, end: 11 * 60 + 30 });
  }
  if (stylistId === "st1" && date === addDays(today, 2)) {
    activeReservations.push({ start: 9 * 60, end: 13 * 60 }, { start: 14 * 60, end: 19 * 60 });
  }

  return [...appointments, ...activeReservations];
}

function getSlotsForStylist(
  request: AvailabilityRequest,
  stylistId: string,
  duration: number,
  date: Date,
  now: number,
  today: string,
  ignoreHoldId?: string,
): AvailableSlot[] {
  const opening = 9 * 60;
  const closing = date.getUTCDay() === 0 ? 16 * 60 : 19 * 60;
  const busy = mockIntervals(request.date, stylistId, today, now, ignoreHoldId);
  const parts = zonedParts(now);
  const isToday = request.date === today;
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60;
  const result: AvailableSlot[] = [];

  for (let start = opening; start + duration <= closing; start += SLOT_INTERVAL_MINUTES) {
    const interval = { start, end: start + duration };
    if (overlaps(interval, LUNCH_BREAK) || busy.some(appointment => overlaps(interval, appointment))) continue;
    if (isToday && start - currentMinutes < MINIMUM_ADVANCE_MINUTES) continue;
    result.push({
      time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
      stylistId,
    });
  }
  return result;
}

function resolveStylists(serviceId: string, stylistId: string) {
  const stylists = stylistId === ANY_STYLIST_ID
    ? getStylistsForService(serviceId)
    : STYLISTS.filter(stylist =>
      stylist.id === stylistId && stylist.serviceIds.includes(serviceId)
    );
  if (!stylists.length) throw new Error("El estilista seleccionado no está habilitado para este servicio.");
  return stylists;
}

function calculateAvailability(request: AvailabilityRequest, serverTime: ServerTime): AvailableSlot[] {
  const service = getService(request.serviceId);
  if (!service) throw new Error("No se encontró el servicio seleccionado.");
  const today = dateKey(zonedParts(serverTime.timestamp));
  const date = parseDate(request.date, today);
  const stylists = resolveStylists(request.serviceId, request.stylistId);
  const byTime = new Map<string, AvailableSlot>();

  for (const stylist of stylists) {
    for (const slot of getSlotsForStylist(
      request,
      stylist.id,
      service.duration,
      date,
      serverTime.timestamp,
      today,
      request.holdId,
    )) {
      if (!byTime.has(slot.time)) byTime.set(slot.time, slot);
    }
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export async function getDisponibilidad(
  request: AvailabilityRequest,
): Promise<{ slots: AvailableSlot[]; serverTime: ServerTime }> {
  await delay(MOCK_API_DELAY_MS);
  const serverTime = getServidorTime();
  pruneExpiredHolds(serverTime.timestamp);
  return { slots: calculateAvailability(request, serverTime), serverTime };
}

export const getAvailability = getDisponibilidad;

export async function getAvailabilityForMonth(request: {
  serviceId: string;
  stylistId: string;
  year: number;
  month: number;
}): Promise<AvailabilityDay[]> {
  if (
    !Number.isInteger(request.year) ||
    !Number.isInteger(request.month) ||
    request.month < 0 ||
    request.month > 11
  ) {
    throw new Error("El mes solicitado no es válido.");
  }

  await delay(MOCK_API_DELAY_MS);
  const serverTime = getServidorTime();
  pruneExpiredHolds(serverTime.timestamp);
  const today = dateKey(zonedParts(serverTime.timestamp));
  const dayCount = new Date(Date.UTC(request.year, request.month + 1, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const date = `${request.year}-${String(request.month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    if (date < today) return { date, hasAvailability: false };
    const slots = calculateAvailability({
      serviceId: request.serviceId,
      stylistId: request.stylistId,
      date,
    }, serverTime);
    return { date, hasAvailability: slots.length > 0 };
  });
}

export async function reservarTurno(
  request: AvailabilityRequest & { time: string },
): Promise<SlotHold> {
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
  const serverTime = getServidorTime();
  pruneExpiredHolds(serverTime.timestamp);
  const available = calculateAvailability(request, serverTime);
  const slot = available.find(candidate => candidate.time === request.time);
  if (!slot) {
    throw new BookingServiceError(
      "Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro turno.",
      409,
      "SLOT_TAKEN",
    );
  }

  const hold: MockReservation = {
    id: crypto.randomUUID(),
    stylistId: slot.stylistId,
    date: request.date,
    time: slot.time,
    duration: service.duration,
    expiresAt: serverTime.timestamp + SLOT_HOLD_DURATION_MS,
    status: "held",
  };
  reservations.set(hold.id, hold);
  return { id: hold.id, stylistId: hold.stylistId, expiresAt: hold.expiresAt };
}

export const holdTimeSlot = reservarTurno;

export async function liberarTurno(holdId: string): Promise<void> {
  await delay(MOCK_API_DELAY_MS);
  const reservation = reservations.get(holdId);
  if (reservation?.status === "held") reservations.delete(holdId);
}

export const releaseTimeSlot = liberarTurno;

export async function confirmarReserva(holdId: string): Promise<void> {
  await delay(MOCK_API_DELAY_MS);
  const serverNow = getServidorTime().timestamp;
  pruneExpiredHolds(serverNow);
  const reservation = reservations.get(holdId);

  if (!reservation || reservation.status !== "held") {
    const expired = expiredHoldIds.delete(holdId);
    throw new BookingServiceError(
      expired
        ? "El tiempo para confirmar venció. Selecciona nuevamente un horario."
        : "El bloqueo de esta franja ya no está activo. Vuelve a seleccionar un horario.",
      expired ? 410 : 404,
      expired ? "HOLD_EXPIRED" : "HOLD_NOT_FOUND",
    );
  }
  if (reservation.expiresAt <= serverNow) {
    reservations.delete(holdId);
    throw new BookingServiceError(
      "El tiempo para confirmar venció. Selecciona nuevamente un horario.",
      410,
      "HOLD_EXPIRED",
    );
  }

  reservation.status = "confirmed";
  reservation.expiresAt = Number.POSITIVE_INFINITY;
}

export const confirmBooking = confirmarReserva;
