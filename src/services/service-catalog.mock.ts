export type ServiceStatus = "ACTIVO" | "INACTIVO";

export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string;
  status: ServiceStatus;
}

export type ServiceInput = Pick<Service, "name" | "duration" | "price" | "category">;
export type ServiceInputErrors = Partial<Record<keyof ServiceInput, string>>;

export const serviceCategories = ["Cortes", "Barba", "Combos", "Tratamientos"] as const;

const MOCK_DELAY_MS = 400;

const delay = () => new Promise<void>(resolve => window.setTimeout(resolve, MOCK_DELAY_MS));

export class ServiceApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ServiceApiError";
  }
}

function assertAdmin(): void {
  const isAdmin =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("bb_auth") === "true" &&
    window.sessionStorage.getItem("bb_role") === "admin";
  if (!isAdmin) {
    throw new ServiceApiError(
      "Acceso Denegado: No tienes permisos para realizar esta acción.",
      403,
    );
  }
}

let nextId = 6;
let services: Service[] = [
  { id: "service-1", name: "Corte clásico", duration: 45, price: 25000, category: "Cortes", status: "ACTIVO" },
  { id: "service-2", name: "Arreglo de barba", duration: 30, price: 20000, category: "Barba", status: "ACTIVO" },
  { id: "service-3", name: "Corte y barba", duration: 60, price: 40000, category: "Combos", status: "ACTIVO" },
  { id: "service-4", name: "Tratamiento capilar", duration: 90, price: 60000, category: "Tratamientos", status: "INACTIVO" },
  { id: "service-5", name: "Perfilado de cejas", duration: 20, price: 18000, category: "Barba", status: "INACTIVO" },
];

export function validateServiceInput(input: ServiceInput): ServiceInputErrors {
  const errors: ServiceInputErrors = {};

  if (!input.name.trim()) errors.name = "El nombre es obligatorio.";
  if (!input.category.trim()) errors.category = "La categoría es obligatoria.";
  if (!Number.isInteger(input.duration) || input.duration < 10 || input.duration > 240) {
    errors.duration = "La duración debe ser un número entero entre 10 y 240 minutos.";
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.price = "El precio es obligatorio y debe ser mayor a $0.";
  }

  return errors;
}

function assertValid(input: ServiceInput): void {
  if (Object.keys(validateServiceInput(input)).length > 0) {
    throw new Error("Los datos del servicio no son válidos.");
  }
}

export async function getServices(): Promise<Service[]> {
  assertAdmin();
  await delay();
  return services.map(service => ({ ...service }));
}

export async function createService(data: ServiceInput): Promise<Service> {
  assertAdmin();
  await delay();
  assertValid(data);

  const service: Service = {
    ...data,
    id: `service-${nextId++}`,
    name: data.name.trim(),
    category: data.category.trim(),
    status: "ACTIVO",
  };

  services = [...services, service];
  return { ...service };
}

export async function updateService(id: string, data: ServiceInput): Promise<Service> {
  assertAdmin();
  await delay();
  assertValid(data);

  const existingService = services.find(service => service.id === id);
  if (!existingService) throw new Error("No se encontró el servicio que deseas actualizar.");

  const updatedService: Service = {
    ...existingService,
    ...data,
    name: data.name.trim(),
    category: data.category.trim(),
  };

  services = services.map(service => service.id === id ? updatedService : service);
  return { ...updatedService };
}

export async function toggleStatus(id: string, newStatus: ServiceStatus): Promise<Service> {
  assertAdmin();
  await delay();

  const existingService = services.find(service => service.id === id);
  if (!existingService) throw new Error("No se encontró el servicio cuyo estado deseas cambiar.");

  const updatedService = { ...existingService, status: newStatus };
  services = services.map(service => service.id === id ? updatedService : service);
  return { ...updatedService };
}
