import { useEffect, useRef, useState } from 'react';
import { getService, getStylistsForService, type Appointment } from '../data';
import {
  getDisponibilidad,
  liberarTurno,
  reservarTurno,
  rescheduleMyAppointment,
  type AvailableSlot,
  type SlotHold,
} from '../services/bookingService';
import { Button } from '../ui';

const ANY_STYLIST_ID = 'any';
const TIME_ZONE = 'America/Bogota';

function getTodayInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function ModalModificarCita({
  appointment,
  onClose,
  onUpdated,
}: {
  appointment: Appointment;
  onClose: () => void;
  onUpdated: (appointment: Appointment) => void;
}) {
  const service = getService(appointment.serviceId);
  const stylists = getStylistsForService(appointment.serviceId);
  const initialStylistId = stylists.some(stylist => stylist.id === appointment.stylistId)
    ? appointment.stylistId
    : ANY_STYLIST_ID;
  const [date, setDate] = useState(appointment.date);
  const [stylistId, setStylistId] = useState(initialStylistId);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [hold, setHold] = useState<SlotHold | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeHold = useRef<SlotHold | null>(null);
  const requestVersion = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(saving);
  const today = getTodayInBogota();
  onCloseRef.current = onClose;
  savingRef.current = saving;

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) onCloseRef.current();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setAvailabilityStatus('loading');
    setAvailabilityError(null);
    getDisponibilidad({ serviceId: appointment.serviceId, stylistId, date })
      .then(result => {
        if (!active) return;
        setSlots(result.slots);
        setAvailabilityError(null);
        setAvailabilityStatus('success');
      })
      .catch(reason => {
        if (!active) return;
        setSlots([]);
        setAvailabilityStatus('error');
        setAvailabilityError(reason instanceof Error ? reason.message : 'No fue posible consultar los horarios.');
      });
    return () => { active = false; };
  }, [appointment.serviceId, date, retry, stylistId]);

  useEffect(() => () => {
    requestVersion.current += 1;
    if (activeHold.current) void liberarTurno(activeHold.current.id);
  }, []);

  if (!service) return null;

  const releaseHold = async () => {
    const currentHold = activeHold.current;
    activeHold.current = null;
    setHold(null);
    if (currentHold) await liberarTurno(currentHold.id);
  };

  const changeDate = (nextDate: string) => {
    requestVersion.current += 1;
    void releaseHold();
    setDate(nextDate);
    setSelectedSlot(null);
    setErrorMessage(null);
    setAvailabilityError(null);
  };

  const changeStylist = (nextStylistId: string) => {
    requestVersion.current += 1;
    void releaseHold();
    setStylistId(nextStylistId);
    setSelectedSlot(null);
    setErrorMessage(null);
    setAvailabilityError(null);
  };

  const selectSlot = async (slot: AvailableSlot) => {
    if (hold?.time === slot.time && hold.stylistId === slot.stylistId) return;
    const version = ++requestVersion.current;
    setErrorMessage(null);
    setAvailabilityError(null);
    setSelectedSlot(slot);
    try {
      await releaseHold();
      const nextHold = await reservarTurno({
        serviceId: appointment.serviceId,
        stylistId: slot.stylistId,
        date,
        time: slot.time,
      });
      if (version !== requestVersion.current) {
        await liberarTurno(nextHold.id);
        return;
      }
      activeHold.current = nextHold;
      setHold(nextHold);
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setSelectedSlot(null);
      setErrorMessage(reason instanceof Error ? reason.message : 'No se pudo reservar temporalmente el horario.');
      setRetry(current => current + 1);
    }
  };

  const saveChanges = async () => {
    if (!selectedSlot || !hold) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updatedAppointment = await rescheduleMyAppointment(
        appointment.id,
        { date, time: selectedSlot.time, stylistId: selectedSlot.stylistId },
        hold.id,
      );
      activeHold.current = null;
      setSuccessMessage(`¡Cita reprogramada exitosamente para el ${date} a las ${selectedSlot.time}!`);
      onUpdated(updatedAppointment);
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : 'No fue posible modificar la cita. Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const selectedStylist = stylists.find(stylist => stylist.id === selectedSlot?.stylistId);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#3D2415]/60 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modify-appointment-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl focus:outline-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A67850]">Modificar cita</p>
            <h2 id="modify-appointment-title" className="mt-1 font-display text-xl font-black text-[#6B4226]">
              Elige una nueva fecha y hora
            </h2>
            <p className="mt-1 text-sm text-[#6B4226]">{service.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar modificación de cita"
            className="rounded-full p-2 text-xl text-[#6B4226] hover:bg-[#FBF3E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6B4226]"
          >
            ×
          </button>
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-[#8B9D77] bg-[#EAF2E3] p-4 text-sm font-semibold text-[#3F684B]" role="status" aria-live="polite">
            <p>{successMessage}</p>
            <p className="mt-1">Estilista: {selectedStylist?.name ?? 'Estilista asignado'}</p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-bold text-[#6B4226]">
                Nueva fecha
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={event => changeDate(event.target.value)}
                  className="rounded-xl border border-[#D8C4B0] bg-white px-3 py-2.5 text-[#3D2415] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87371E]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-bold text-[#6B4226]">
                Estilista
                <select
                  value={stylistId}
                  onChange={event => changeStylist(event.target.value)}
                  className="rounded-xl border border-[#D8C4B0] bg-white px-3 py-2.5 text-[#3D2415] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87371E]"
                >
                  <option value={ANY_STYLIST_ID}>Cualquier estilista</option>
                  {stylists.map(stylist => (
                    <option key={stylist.id} value={stylist.id}>{stylist.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5">
              <h3 className="font-display font-black text-[#6B4226]">Horarios disponibles</h3>
              {availabilityStatus === 'loading' && (
                <p className="mt-3 text-sm text-[#A67850]" role="status">Consultando disponibilidad...</p>
              )}
              {availabilityStatus === 'error' && (
                <div className="mt-3 rounded-xl bg-[#FFF5F5] p-3 text-sm text-[#7C2C20]" role="alert">
                  <p>{availabilityError ?? 'No fue posible consultar los horarios.'}</p>
                  <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 font-bold underline">
                    Reintentar
                  </button>
                </div>
              )}
              {availabilityStatus === 'success' && slots.length === 0 && (
                <p className="mt-3 rounded-xl bg-[#FBF3E9] p-3 text-sm text-[#6B4226]">
                  No hay horarios disponibles para esta fecha. Prueba otro día o estilista.
                </p>
              )}
              {availabilityStatus === 'success' && slots.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map(slot => {
                    const isSelected = selectedSlot?.time === slot.time && selectedSlot.stylistId === slot.stylistId;
                    return (
                      <button
                        key={`${slot.time}-${slot.stylistId}`}
                        type="button"
                        onClick={() => void selectSlot(slot)}
                        disabled={saving}
                        aria-pressed={isSelected}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87371E] ${
                          isSelected
                            ? 'border-[#87371E] bg-[#87371E] text-white'
                            : 'border-[#D8C4B0] text-[#6B4226] hover:bg-[#FBF3E9]'
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSlot && hold && (
              <p className="mt-4 rounded-xl bg-[#EAF2E3] p-3 text-sm font-semibold text-[#3F684B]">
                Seleccionaste {date} a las {selectedSlot.time}
                {selectedStylist ? ` con ${selectedStylist.name}` : ''}. El horario está bloqueado temporalmente.
              </p>
            )}
            {errorMessage && availabilityStatus !== 'error' && (
              <p className="mt-4 rounded-xl bg-[#FFF5F5] p-3 text-sm font-semibold text-[#7C2C20]" role="alert">
                {errorMessage}
              </p>
            )}
          </>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {successMessage ? (
            <Button onClick={onClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={saving}>Volver</Button>
              <Button
                onClick={() => void saveChanges()}
                disabled={!selectedSlot || !hold || saving}
                ariaBusy={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
