# 💈 Sistema de Reservas para Barbería

Aplicación web desarrollada para el curso de **Análisis y Diseño de Sistemas** de la Universidad de Antioquia (UdeA). El sistema permite a los clientes descubrir servicios, elegir estilista, reservar horarios y consultar sus citas, mientras que los perfiles administrativos gestionan el catálogo y la operación de la barbería.

## 🚀 Tecnologías

- [React 19](https://react.dev/) y [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [React Router](https://reactrouter.com/)
- [pnpm](https://pnpm.io/) como gestor de paquetes
- Figma para diseño y prototipado

## 🛠️ Instalación y ejecución local

### Requisitos

- Node.js compatible con el proyecto
- pnpm

### 1. Clonar el repositorio

```bash
git clone https://github.com/MattC-07/SistemaDePeluqueriaAyD1.git
cd SistemaDePeluqueriaAyD1
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Iniciar el servidor de desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en la URL que indique Vite, normalmente `http://localhost:5173/`.

### Otros comandos

```bash
pnpm build      # Genera la compilación de producción
pnpm preview    # Sirve localmente la compilación generada
pnpm format     # Formatea el código con oxfmt
```

## 📋 Funcionalidades implementadas

- [x] Pantalla de inicio con servicios populares, estilistas, recomendaciones y notificaciones.
- [x] Flujo de reserva en cuatro pasos: servicio, estilista, fecha/hora y confirmación.
- [x] Consulta de disponibilidad y bloqueo temporal de horarios.
- [x] Confirmación simulada con latencia de red, código único de reserva y pantalla de éxito.
- [x] Manejo de conflictos de concurrencia (`409`) cuando una franja es ocupada.
- [x] Calendario y horarios con capas visuales corregidas para evitar solapamientos.
- [x] Catálogo y administración de servicios con creación, edición y activación/desactivación.
- [x] Protección de rutas administrativas y de estilista por rol.
- [x] Manejo visual de errores `403 Forbidden` mediante avisos en pantalla.
- [x] Bloqueo temporal tras múltiples intentos fallidos de inicio de sesión.
- [x] Cuentas demo para probar diferentes perfiles y escenarios de seguridad.

## 🔐 Cuentas demo

Estas cuentas son exclusivamente para desarrollo local y pruebas:

| Perfil | Correo | Contraseña |
| --- | --- | --- |
| Cliente 1 — Juan García | `cliente1@demo.com` | `cliente123` |
| Cliente 2 — María López | `cliente2@demo.com` | `cliente123` |
| Cliente 3 — Andrés Pérez | `cliente3@demo.com` | `cliente123` |
| Cliente 4 — Sofía Ramírez | `cliente4@demo.com` | `cliente123` |
| Cliente 5 — Prueba de seguridad | `cliente5@demo.com` | `cliente123` |
| Estilista | `estilista@barberia.com` | `demo1234` |
| Administrador | `admin@barberia.com` | `demo1234` |

El cliente 5 está destinado a validar intentos de acceso no autorizado. Las rutas `/admin/*` y `/estilista/*` deben redirigir a un cliente que no tenga el rol correspondiente.

## 🧪 Validación

Antes de integrar cambios, se pueden ejecutar:

```bash
pnpm build
npx tsc --noEmit
```

## 📁 Estructura principal

```text
SistemaDePeluqueriaAyD1/
├── src/
│   ├── screens/       # Pantallas de onboarding, inicio, reservas y administración
│   ├── services/      # Servicios simulados de reservas, recuperación y catálogo
│   ├── App.tsx        # Estado global y navegación de la aplicación
│   ├── data.ts        # Datos y tipos principales del dominio
│   ├── mockData.ts    # Datos simulados para la pantalla de inicio
│   ├── router.ts      # Configuración y guardas de rutas
│   └── ui.tsx         # Componentes visuales reutilizables
├── .figma/            # Integración de Figma Make
├── index.html         # Shell HTML de Vite
├── package.json        # Dependencias y scripts
├── tsconfig.json       # Configuración de TypeScript
└── vite.config.ts      # Configuración de Vite y Tailwind
```

## 👤 Autor

- **Mateo** — [@MattC-07](https://github.com/MattC-07)
- **Curso:** Análisis y Diseño de Sistemas — Universidad de Antioquia
