export type ServicioCategoria = 'Cortes' | 'Barba' | 'Combos' | 'Tratamientos';
export type ServicioEstado = 'ACTIVO' | 'INACTIVO';

export interface ServicioItem {
  id: string;
  nombre: string;
  duracion: number;
  precio: number;
  categoria: ServicioCategoria;
  estado: ServicioEstado;
}

export interface ServicioFormValues {
  nombre: string;
  duracion: string;
  precio: string;
  categoria: string;
}

export const servicioCategorias: ServicioCategoria[] = [
  'Cortes',
  'Barba',
  'Combos',
  'Tratamientos',
];

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const initialServices: ServicioItem[] = [
  {
    id: 'svc-1',
    nombre: 'Corte Fade & Barba',
    duracion: 60,
    precio: 35000,
    categoria: 'Combos',
    estado: 'ACTIVO',
  },
  {
    id: 'svc-2',
    nombre: 'Corte Clásico',
    duracion: 45,
    precio: 25000,
    categoria: 'Cortes',
    estado: 'ACTIVO',
  },
  {
    id: 'svc-3',
    nombre: 'Arreglo de Barba',
    duracion: 30,
    precio: 20000,
    categoria: 'Barba',
    estado: 'ACTIVO',
  },
  {
    id: 'svc-4',
    nombre: 'Tratamiento Capilar',
    duracion: 90,
    precio: 60000,
    categoria: 'Tratamientos',
    estado: 'ACTIVO',
  },
  {
    id: 'svc-5',
    nombre: 'Perfilado de Cejas',
    duracion: 20,
    precio: 18000,
    categoria: 'Barba',
    estado: 'INACTIVO',
  },
];

let servicioStore: ServicioItem[] = [...initialServices];

export function getEmptyServicioForm(): ServicioFormValues {
  return {
    nombre: '',
    duracion: '',
    precio: '',
    categoria: '',
  };
}

export function validarServicio(form: ServicioFormValues): Partial<Record<'nombre' | 'duracion' | 'precio' | 'categoria', string>> {
  const errors: Partial<Record<'nombre' | 'duracion' | 'precio' | 'categoria', string>> = {};

  if (!form.nombre.trim()) {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (!form.categoria.trim()) {
    errors.categoria = 'La categoría es obligatoria.';
  }

  const duracionValue = Number(form.duracion);
  if (form.duracion === '' || Number.isNaN(duracionValue) || duracionValue < 10 || duracionValue > 240) {
    errors.duracion = 'La duración debe estar entre 10 y 240 minutos.';
  }

  const precioValue = Number(form.precio);
  if (form.precio === '' || Number.isNaN(precioValue) || precioValue <= 0) {
    errors.precio = 'El precio debe ser mayor a $0.';
  }

  return errors;
}

export async function listarActivos(): Promise<ServicioItem[]> {
  await delay(350);
  return servicioStore.filter(item => item.estado === 'ACTIVO');
}

export async function listarInactivos(): Promise<ServicioItem[]> {
  await delay(350);
  return servicioStore.filter(item => item.estado === 'INACTIVO');
}

export async function crearServicio(form: ServicioFormValues): Promise<ServicioItem> {
  const errors = validarServicio(form);
  if (Object.keys(errors).length > 0) {
    throw new Error('Datos inválidos');
  }

  const nuevoServicio: ServicioItem = {
    id: `svc-${Date.now()}`,
    nombre: form.nombre.trim(),
    duracion: Number(form.duracion),
    precio: Number(form.precio),
    categoria: form.categoria as ServicioCategoria,
    estado: 'ACTIVO',
  };

  servicioStore = [...servicioStore, nuevoServicio];
  return nuevoServicio;
}

export async function editarServicio(id: string, form: ServicioFormValues): Promise<ServicioItem> {
  const errors = validarServicio(form);
  if (Object.keys(errors).length > 0) {
    throw new Error('Datos inválidos');
  }

  const index = servicioStore.findIndex(item => item.id === id);
  if (index === -1) {
    throw new Error('Servicio no encontrado');
  }

  const actualizado: ServicioItem = {
    ...servicioStore[index],
    nombre: form.nombre.trim(),
    duracion: Number(form.duracion),
    precio: Number(form.precio),
    categoria: form.categoria as ServicioCategoria,
  };

  servicioStore = servicioStore.map(item => item.id === id ? actualizado : item);
  return actualizado;
}

export async function desactivarServicio(id: string): Promise<ServicioItem> {
  const item = servicioStore.find(servicio => servicio.id === id);
  if (!item) {
    throw new Error('Servicio no encontrado');
  }

  const actualizado = { ...item, estado: 'INACTIVO' as const };
  servicioStore = servicioStore.map(servicio => servicio.id === id ? actualizado : servicio);
  return actualizado;
}

export async function reactivarServicio(id: string): Promise<ServicioItem> {
  const item = servicioStore.find(servicio => servicio.id === id);
  if (!item) {
    throw new Error('Servicio no encontrado');
  }

  const actualizado = { ...item, estado: 'ACTIVO' as const };
  servicioStore = servicioStore.map(servicio => servicio.id === id ? actualizado : servicio);
  return actualizado;
}
