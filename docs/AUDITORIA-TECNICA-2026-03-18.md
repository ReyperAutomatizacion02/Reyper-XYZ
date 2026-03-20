# AUDITORÍA TÉCNICA INTEGRAL — Reyper XYZ

**Fecha:** 2026-03-18
**Auditor:** Claude Opus 4.6 (Senior Full-Stack Architect & Lead Security Auditor)
**Proyecto:** Reyper XYZ — Sistema interno de gestión para Reyper Maquinados CNC
**Stack:** Next.js 16.1.6 · React 19.2.3 · Supabase · TypeScript · Tailwind CSS · shadcn/ui

---

## 1. RESUMEN DE SALUD

### Calificación General: 5.5 / 10

El proyecto tiene una base arquitectónica razonable (Next.js App Router, server components, Supabase con RLS, RBAC en middleware), pero acumula deuda técnica severa en seguridad, tipado, testing y rendimiento que lo hacen **no apto para producción a escala** sin intervención significativa.

### Top 3 Riesgos Detectados

| # | Riesgo | Impacto |
|---|--------|---------|
| 1 | **0% cobertura de tests** + algoritmo de scheduling de 727 líneas sin probar | Un bug silencioso en la lógica de planificación puede corromper la producción entera sin que nadie lo detecte |
| 2 | **54 casteos `as any`** + tipos Supabase incompletos | TypeScript pierde su razón de existir; errores en runtime que el compilador debería atrapar |
| 3 | **Validación de inputs ausente** en múltiples server actions + exposición de errores internos | Superficie de ataque abierta: datos malformados entran directamente a la base de datos |

---

## 2. DESGLOSE DE HALLAZGOS

---

### ✅ H-01: ZERO TEST COVERAGE — RESUELTO

- **Categoría:** Lógica / Seguridad
- **Gravedad:** CRÍTICA
- **Estado:** ✅ RESUELTO (2026-03-18)
- **Resolución:** Se configuró Vitest como framework de testing. Se escribieron 66 tests en 2 archivos: `lib/__tests__/scheduling-utils.test.ts` (55 tests cubriendo `getPriorityLevel`, `getStatusPriority`, `compareOrdersByPriority`, `prepareOrdersForScheduling`, `getNextValidWorkTime`, `snapToNext15Minutes`, `generateAutomatedPlanning`, `shiftScenarioTasks`) y `lib/__tests__/auth-guard.test.ts` (11 tests cubriendo `requireAuth` y `requireRole` con Supabase mockeado). Todos los 66 tests pasan. Scripts `test` y `test:watch` agregados a package.json.
- **Diagnóstico:** No existe ningún archivo de test (`*.test.ts`, `*.spec.ts`, `__tests__/`), ningún framework de testing configurado (ni Jest, ni Vitest, ni Playwright), y ninguna dependencia de testing en `package.json`. El algoritmo de scheduling en `lib/scheduling-utils.ts` (727 líneas de lógica de negocio pura) opera sin ninguna verificación automatizada.
- **Impacto:** Cualquier cambio en la lógica de planificación, auth guards, o server actions puede introducir regresiones silenciosas. En un sistema de manufactura CNC, un error en la asignación de tareas a máquinas puede resultar en piezas defectuosas, tiempos muertos de máquina, o incumplimiento de entregas.
- **Archivos afectados:** Todo el proyecto — especialmente:
  - `lib/scheduling-utils.ts` — algoritmo de scheduling crítico
  - `lib/auth-guard.ts` — lógica de autorización
  - `lib/config/permissions.ts` — configuración RBAC
  - `app/dashboard/produccion/actions.ts` — mutaciones de producción
- **Refactorización Propuesta:**

  *Configuración mínima con Vitest:*
  ```bash
  npm install -D vitest @testing-library/react @testing-library/jest-dom
  ```

  ```typescript
  // vitest.config.ts
  import { defineConfig } from 'vitest/config'
  import path from 'path'

  export default defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  })
  ```

  ```typescript
  // lib/__tests__/scheduling-utils.test.ts
  import { describe, it, expect } from 'vitest'
  import { autoScheduleTasks } from '../scheduling-utils'

  describe('autoScheduleTasks', () => {
    it('assigns tasks to available machines respecting capacity', () => {
      const machines = [{ id: '1', name: 'CNC-01', capacity: 8 }]
      const tasks = [{ id: 't1', duration: 4, machine: null }]
      const result = autoScheduleTasks(machines, tasks)
      expect(result[0].machine).toBe('1')
    })

    it('rejects tasks exceeding machine capacity', () => {
      // ... test edge cases
    })
  })
  ```

---

### ✅ H-02: 54 CASTEOS `as any` — TIPOS SUPABASE ROTOS (RESUELTO)

- **Categoría:** Lógica / Limpieza
- **Gravedad:** CRÍTICA
- **Estado:** ✅ RESUELTO (2026-03-18)
- **Resultado:** Tipos regenerados desde BD live, `<Database>` generic aplicado a todos los clientes Supabase, ~30 archivos corregidos. De ~70 `as any` → 5 irreducibles (canvas PDF.js, drag-and-drop lib, demo data, Supabase Realtime overload ×2). 0 errores TypeScript.
- **Diagnóstico:** Se encontraron 54 instancias de `as any` distribuidas en 15+ archivos. El caso más grave está en `app/dashboard/produccion/actions.ts` donde **cada operación de base de datos** requiere doble casteo:
  ```typescript
  await (supabase.from("planning" as any) as any)
  ```
  Esto indica que `utils/supabase/types.ts` no incluye las tablas `planning`, `machines`, `production_orders`, entre otras. TypeScript está efectivamente deshabilitado para todo el módulo de producción.
- **Impacto:** Errores de tipos en runtime (campo inexistente, tipo incorrecto en insert/update) que TypeScript debería atrapar en compilación. Cada refactoring de esquema de BD requiere verificación manual en lugar de automática.
- **Archivos principales:**
  - `app/dashboard/produccion/actions.ts` — 14 instancias
  - `components/production/production-view.tsx` — 11 instancias
  - `lib/scheduling-utils.ts` — 8 instancias
  - `components/production/gantt-svg.tsx` — 8 instancias
  - `app/dashboard/logistica/proyectos/page.tsx` — 7 instancias
  - `app/dashboard/ventas/proyectos/page.tsx` — 6 instancias
- **Refactorización Propuesta:**

  *Código Actual:* (`app/dashboard/produccion/actions.ts:17`)
  ```typescript
  const { error } = await (supabase.from("planning" as any) as any)
    .update({ machine, operator, planned_date, shift })
    .eq("id", taskId);
  ```

  *Código Optimizado:*
  1. Regenerar tipos con `supabase gen types typescript`:
  ```bash
  npx supabase gen types typescript --project-id <project-id> > utils/supabase/types.ts
  ```

  2. Uso correcto sin casteos:
  ```typescript
  const { error } = await supabase
    .from("planning")
    .update({ machine, operator, planned_date, shift })
    .eq("id", taskId);
  ```

---

### ✅ H-03: VALIDACIÓN DE INPUTS AUSENTE EN SERVER ACTIONS (RESUELTO)

- **Categoría:** Seguridad
- **Gravedad:** CRÍTICA
- **Estado:** ✅ RESUELTO (2026-03-18)
- **Resultado:** Validación Zod agregada a los 8 archivos de server actions (~35 funciones). Se crearon 4 archivos de schemas: `lib/validations/production.ts`, `lib/validations/admin.ts`, `lib/validations/auth.ts`, `lib/validations/updates.ts`. Se expandió `lib/validations/sales.ts` con schemas para catálogos, cotizaciones, contactos, proyectos y Drive. 0 errores TypeScript.
- **Diagnóstico:** Múltiples server actions aceptan datos directamente sin validación Zod ni sanitización. Mientras que `lib/validations/sales.ts` define schemas para algunas operaciones de ventas, las funciones de creación de catálogos y producción no validan nada.
- **Impacto:** Datos malformados, strings excesivamente largos, o caracteres especiales entran directamente a Supabase. Aunque Supabase parametriza queries (protege contra SQL injection), no hay protección contra datos basura, strings vacíos, o valores fuera de rango. Violación directa de OWASP A03:2021 (Injection).
- **Archivos afectados:**
  - `app/dashboard/ventas/actions.ts:14-21` — `createClientEntry(name, prefix?, business_name?)` sin validación
  - `app/dashboard/ventas/actions.ts:87-103` — `createPositionEntry()`, `createAreaEntry()`, `createUnitEntry()`, `createMaterialEntry()`, `createTreatmentEntry()` — todas aceptan strings crudos
  - `app/dashboard/produccion/actions.ts:32-83` — `scheduleNewTask()`, `createPlanningTask()` — aceptan `machine` y `operator` sin checks
  - `app/dashboard/produccion/actions.ts:168` — `batchSavePlanning()` — operación bulk sin validación
- **Refactorización Propuesta:**

  *Código Actual:* (`app/dashboard/ventas/actions.ts:87`)
  ```typescript
  export async function createPositionEntry(name: string) {
    const supabase = await createClient();
    await requireRole(supabase, VENTAS_ROLES);
    const { error } = await supabase.from("sales_positions").insert({ name });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/ventas");
  }
  ```

  *Código Optimizado:*
  ```typescript
  import { z } from "zod";

  const catalogEntrySchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100).trim(),
  });

  export async function createPositionEntry(name: string) {
    const supabase = await createClient();
    await requireRole(supabase, VENTAS_ROLES);

    const parsed = catalogEntrySchema.parse({ name });

    const { error } = await supabase
      .from("sales_positions")
      .insert({ name: parsed.name });

    if (error) throw new Error("Error al crear posición");
    revalidatePath("/dashboard/ventas");
  }
  ```

---

### 🚩 H-04: EXPOSICIÓN DE ERRORES INTERNOS AL CLIENTE

- **Categoría:** Seguridad
- **Gravedad:** ALTA
- **Diagnóstico:** Los mensajes de error de Supabase se propagan directamente al usuario mediante URLs y respuestas HTTP. Esto expone detalles de la infraestructura interna (nombres de tablas, constraints, versión de PostgreSQL). Violación de OWASP A04:2021 (Insecure Design).
- **Impacto:** Un atacante puede mapear el esquema de la base de datos y entender la lógica interna del sistema mediante mensajes de error provocados.
- **Archivos afectados:**
  - `app/auth/actions.ts:29,80,98` — `redirect("/login?message=" + encodeURIComponent(error.message))`
  - `app/dashboard/ventas/actions.ts:56` — `throw new Error(error.message)`
  - `app/api/webhooks/supabase/quotes/route.ts:46` — `return new NextResponse("Error Interno: ${error.message}", { status: 500 })`
- **Refactorización Propuesta:**

  *Código Actual:* (`app/auth/actions.ts:29`)
  ```typescript
  return redirect("/login?message=" + encodeURIComponent(error.message));
  ```

  *Código Optimizado:*
  ```typescript
  import { logger } from "@/utils/logger";

  // Log el error real server-side
  logger.error("Login failed", { email: data.email, error: error.message });

  // Devolver mensaje genérico al usuario
  return redirect("/login?message=" + encodeURIComponent("Credenciales inválidas. Intenta de nuevo."));
  ```

---

### ✅ H-05: OPEN REDIRECT EN AUTH CALLBACK — RESUELTO

- **Categoría:** Seguridad
- **Gravedad:** ALTA
- **Estado:** ✅ RESUELTO (2026-03-18)
- **Resolución:** Se implementó función `getSafeRedirect()` que valida el parámetro `next` contra una whitelist de prefijos (`/dashboard`, `/pending-approval`), bloquea URLs protocol-relative (`//evil.com`) y absolutas. Cualquier valor no permitido redirige a `/dashboard`.
- **Diagnóstico original:** El parámetro `next` del query string se usa directamente en la redirección sin validación contra una whitelist.
- **Impacto:** Un atacante puede construir una URL como `/auth/callback?next=//evil.com` que redirige al usuario a un sitio de phishing después de autenticarse. Violación de OWASP A01:2021 (Broken Access Control).
- **Archivo:** `app/auth/callback/route.ts:6-16`
- **Refactorización Propuesta:**

  *Código Actual:*
  ```typescript
  const next = searchParams.get("next") ?? "/dashboard";
  return NextResponse.redirect(`${origin}${next}`);
  ```

  *Código Optimizado:*
  ```typescript
  const SAFE_REDIRECTS = ['/dashboard', '/pending-approval', '/account/update-password'];
  const requestedNext = searchParams.get("next") ?? "/dashboard";
  const next = SAFE_REDIRECTS.includes(requestedNext) ? requestedNext : "/dashboard";
  return NextResponse.redirect(`${origin}${next}`);
  ```

---

### 🚩 H-06: SIN PAGINACIÓN — QUERIES DE 5,000 REGISTROS

- **Categoría:** Performance
- **Gravedad:** CRÍTICA
- **Diagnóstico:** Múltiples páginas cargan miles de registros en una sola query sin paginación ni streaming. Conforme la base de datos crezca, estos endpoints se convertirán en cuellos de botella que degradan la experiencia del usuario y pueden causar timeouts.
- **Impacto:** Con 5,000+ registros: tiempos de carga de 3-10 segundos, consumo excesivo de memoria en el servidor, transferencia de datos innecesaria al cliente. A 50,000 registros: timeouts y crashes.
- **Archivos afectados:**
  - `app/dashboard/produccion/planeacion/page.tsx:22-23` — `.limit(5000)` en `production_orders` y `planning`
  - `app/dashboard/produccion/maquinados/page.tsx:45` — `.limit(1000)` en tasks
  - `app/dashboard/produccion/planeacion/page.tsx:15` — `machines.select("*")` sin límite
- **Refactorización Propuesta:**

  *Código Actual:* (`app/dashboard/produccion/planeacion/page.tsx:22`)
  ```typescript
  const { data: orders } = await supabase
    .from("production_orders")
    .select("id, part_code, part_name, quantity, genral_status, project_id, projects(code, company)")
    .limit(5000);
  ```

  *Código Optimizado:*
  ```typescript
  // Server component con paginación
  const page = Number(searchParams?.page) || 1;
  const pageSize = 50;

  const { data: orders, count } = await supabase
    .from("production_orders")
    .select("id, part_code, part_name, quantity, genral_status, project_id, projects(code, company)", { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1)
    .order("created_at", { ascending: false });
  ```

---

### 🚩 H-07: COMPONENTES GIGANTES (1,500 — 1,900 LÍNEAS)

- **Categoría:** Limpieza / Performance
- **Gravedad:** ALTA
- **Diagnóstico:** Tres componentes exceden las 1,400 líneas, violando el Principio de Responsabilidad Única (SRP de SOLID). Son imposibles de testear, difíciles de mantener, y aumentan el bundle size del cliente innecesariamente.
- **Impacto:** Cada cambio en cualquier parte del componente requiere recargar las 1,900 líneas completas. Code splitting imposible. Bugs difíciles de aislar. Onboarding de nuevos desarrolladores severamente impactado.
- **Archivos afectados:**
  - `components/production/production-view.tsx` — **1,899 líneas**
  - `components/production/gantt-svg.tsx` — **1,569 líneas**
  - `app/dashboard/ventas/cotizador/page.tsx` — **1,490 líneas**
- **Refactorización Propuesta para `production-view.tsx`:**

  Dividir en módulos con responsabilidad única:
  ```
  components/production/
  ├── production-view.tsx          (~200 líneas - orquestador)
  ├── production-toolbar.tsx       (~150 líneas - filtros y acciones)
  ├── production-calendar.tsx      (~200 líneas - vista de calendario)
  ├── production-task-list.tsx     (~200 líneas - lista de tareas)
  ├── production-task-card.tsx     (~100 líneas - tarjeta individual)
  ├── production-modals/
  │   ├── create-task-modal.tsx    (ya existe)
  │   ├── task-detail-modal.tsx
  │   └── auto-plan-dialog.tsx     (ya existe)
  └── hooks/
      ├── use-production-state.ts  (~100 líneas - estado centralizado)
      └── use-production-filters.ts
  ```

---

### 🚩 H-08: COMPONENTES DUPLICADOS (DRY VIOLATION)

- **Categoría:** Limpieza
- **Gravedad:** ALTA
- **Diagnóstico:** Existen componentes prácticamente idénticos (~95% overlap) en dos directorios diferentes. Esto viola el principio DRY y crea un riesgo real de divergencia.
- **Impacto:** Bugs corregidos en un componente no se corrigen en el duplicado. Doble trabajo de mantenimiento. Inconsistencias de UI entre módulos de ventas y proyectos.
- **Archivos duplicados:**
  - `components/sales/production-item-detail.tsx` ↔ `components/projects/production-item-detail.tsx`
  - `components/sales/project-details-panel.tsx` ↔ `components/projects/project-details-panel.tsx`
  - `components/sales/projects-table.tsx` ↔ `components/projects/projects-table.tsx`
  - `components/sales/projects-filter.tsx` ↔ `components/projects/projects-filter.tsx`
  - `components/sales/project-header-form.tsx` ↔ `components/projects/project-header-form.tsx`
  - `components/sales/production-item-summary.tsx` ↔ `components/projects/production-item-summary.tsx`
- **Refactorización Propuesta:**

  Crear componentes compartidos con props de configuración:
  ```typescript
  // components/shared/production-item-detail.tsx
  interface ProductionItemDetailProps {
    item: ProductionOrder;
    mode: "sales" | "projects" | "logistics";
    hiddenFields?: string[];
    readOnlyFields?: string[];
    onSave: (data: Partial<ProductionOrder>) => Promise<void>;
  }

  export function ProductionItemDetail({ item, mode, hiddenFields, readOnlyFields, onSave }: ProductionItemDetailProps) {
    // Componente unificado
  }
  ```

---

### ✅ H-09: SIN ERROR BOUNDARIES NI LOADING STATES — RESUELTO

- **Categoría:** Performance / Lógica
- **Gravedad:** ALTA
- **Estado:** ✅ RESUELTO (2026-03-18)
- **Resolución:** Se creó componente reutilizable `ErrorDisplay` y se implementaron 9 error boundaries: `global-error.tsx` (root), `dashboard/error.tsx` (nivel dashboard), y 7 archivos `error.tsx` en cada subdirectorio (`ventas`, `produccion`, `admin-panel`, `almacen`, `diseno`, `logistica`, `actualizaciones`). Cada boundary muestra mensajes contextualizados al módulo con botón de reintentar.
- **Diagnóstico:** No existe ningún archivo `error.tsx` en el App Router. Solo hay 1 `loading.tsx` (`app/dashboard/loading.tsx`). Las páginas que hacen fetches de 5,000 registros no tienen Suspense boundaries. Si una query falla, el usuario ve una pantalla en blanco o el error genérico de Next.js.
- **Impacto:** Experiencia de usuario degradada: sin feedback visual durante cargas pesadas, sin recuperación elegante ante errores. En un entorno de manufactura donde la app se usa en planta, esto genera frustración y llamadas innecesarias a soporte.
- **Refactorización Propuesta:**

  ```typescript
  // app/dashboard/error.tsx
  "use client";

  export default function DashboardError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Algo salió mal</h2>
        <p className="text-muted-foreground">
          Ocurrió un error inesperado. Intenta de nuevo.
        </p>
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    );
  }
  ```

  ```typescript
  // app/dashboard/produccion/planeacion/loading.tsx
  export default function PlanningLoading() {
    return <div className="animate-pulse p-8">Cargando planificación...</div>;
  }
  ```

---

### 🚩 H-10: MOMENT.JS EN LUGAR DE DATE-FNS (BUNDLE BLOAT)

- **Categoría:** Performance
- **Gravedad:** MEDIA
- **Diagnóstico:** El proyecto importa **ambos** `moment` (72KB gzipped, no tree-shakeable) y `date-fns` (tree-shakeable). `moment` se usa extensivamente en el módulo de producción (50+ instancias) mientras que `date-fns` se usa en otras partes. Esto agrega ~72KB innecesarios al bundle del cliente.
- **Impacto:** Bundle del cliente inflado. Moment.js está oficialmente en modo de mantenimiento y su equipo recomienda alternativas.
- **Archivos con moment:**
  - `components/production/production-view.tsx:52-53`
  - `components/production/gantt-svg.tsx`
  - `lib/scheduling-utils.ts`
- **Refactorización Propuesta:**

  *Código Actual:*
  ```typescript
  import moment from "moment";
  import "moment/locale/es";

  const startOfWeek = moment().startOf("week");
  const formatted = moment(date).format("DD/MM/YYYY");
  ```

  *Código Optimizado:*
  ```typescript
  import { startOfWeek, format } from "date-fns";
  import { es } from "date-fns/locale";

  const weekStart = startOfWeek(new Date(), { locale: es });
  const formatted = format(date, "dd/MM/yyyy", { locale: es });
  ```

---

### 🚩 H-11: NO SE USA `next/image`

- **Categoría:** Performance
- **Gravedad:** MEDIA
- **Diagnóstico:** A pesar de que `next.config.ts` configura formatos de imagen (AVIF, WebP) y dominios remotos, no se encontró ningún uso de `next/image` en el codebase. Todas las imágenes se cargan con `<img>` nativo.
- **Impacto:** Sin lazy loading automático, sin optimización de formato, sin responsive sizes, sin blur placeholders. Imágenes de Supabase Storage se sirven en tamaño completo sin importar el viewport.
- **Refactorización Propuesta:**

  *Código Actual:*
  ```tsx
  <img src={item.image} alt={item.part_name} className="w-16 h-16 object-cover" />
  ```

  *Código Optimizado:*
  ```tsx
  import Image from "next/image";

  <Image
    src={item.image}
    alt={item.part_name}
    width={64}
    height={64}
    className="object-cover"
    placeholder="blur"
    blurDataURL="data:image/png;base64,..."
  />
  ```

---

### 🚩 H-12: SIN RATE LIMITING NI SECURITY HEADERS

- **Categoría:** Seguridad
- **Gravedad:** MEDIA
- **Diagnóstico:** No hay rate limiting en ningún endpoint. No hay headers de seguridad configurados (CSP, X-Frame-Options, Strict-Transport-Security). El middleware solo maneja auth y routing.
- **Impacto:** Vulnerable a ataques de fuerza bruta en login, spam en server actions, y clickjacking. Violación de OWASP A05:2021 (Security Misconfiguration).
- **Refactorización Propuesta:**

  Agregar headers en `next.config.ts`:
  ```typescript
  const nextConfig: NextConfig = {
    // ... existing config
    headers: async () => [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ],
  };
  ```

---

### 🚩 H-13: DIRECTORIO `src/app` HUÉRFANO

- **Categoría:** Limpieza
- **Gravedad:** BAJA
- **Diagnóstico:** Existen dos directorios de app: `/app` (activo) y `/src/app` (huérfano con `layout.tsx`, `page.tsx`, `favicon.ico`, `globals.css`). Next.js usa `/app` por la configuración actual.
- **Impacto:** Confusión para nuevos desarrolladores. Potencial conflicto si alguien modifica el archivo equivocado.
- **Refactorización:** Eliminar `/src/app` completamente.

---

### 🚩 H-14: CAMPO DE BD MAL ESCRITO: `genral_status`

- **Categoría:** Limpieza / Lógica
- **Gravedad:** BAJA (pero molesto)
- **Diagnóstico:** El campo `genral_status` (falta la "e" en "general") se usa en 20+ archivos. Es un error tipográfico en el esquema de la base de datos que se propagó a todo el código.
- **Impacto:** Confusión para desarrolladores, queries difíciles de buscar, profesionalismo del codebase reducido.
- **Archivos afectados:** `scheduling-utils.ts`, `production-item-detail.tsx`, `produccion/actions.ts`, `ventas/actions.ts`, y otros.
- **Refactorización:** Migración de Supabase para renombrar la columna + search-and-replace global.

---

### 🚩 H-15: REALTIME REFRESHER CON `router.refresh()` COMPLETO

- **Categoría:** Performance
- **Gravedad:** MEDIA
- **Diagnóstico:** `components/realtime-refresher.tsx` escucha cambios de Postgres y ejecuta `router.refresh()` que recarga TODOS los server components de la página. El throttle de 500ms es insuficiente para evitar cascadas de re-renders.
- **Impacto:** Cada cambio en la BD dispara una recarga completa de la página. Con múltiples usuarios editando simultáneamente, la app se vuelve inutilizable.
- **Refactorización Propuesta:**

  Usar React `useOptimistic` o invalidación granular con `revalidatePath`:
  ```typescript
  // En lugar de router.refresh() global
  // Usar SWR/React Query con invalidación por key
  const { mutate } = useSWR(`/api/planning/${taskId}`);
  // En el listener:
  channel.on('postgres_changes', { event: 'UPDATE', table: 'planning' }, () => {
    mutate(); // Solo re-fetch los datos afectados
  });
  ```

---

### 🚩 H-16: `deleteQuoteFiles()` USA SERVICE ROLE SIN VERIFICACIÓN DE PROPIEDAD

- **Categoría:** Seguridad
- **Gravedad:** ALTA
- **Diagnóstico:** La función `deleteQuoteFiles()` en `app/dashboard/ventas/actions.ts:464-502` crea un cliente admin con `SUPABASE_SERVICE_ROLE_KEY` para eliminar archivos de storage, pero no verifica que la cotización pertenezca al usuario autenticado. Si se invoca con un `quoteId` arbitrario, elimina archivos de cualquier cotización.
- **Impacto:** Un usuario autenticado con rol de ventas podría eliminar archivos de cotizaciones que no le pertenecen.
- **Refactorización Propuesta:**

  ```typescript
  export async function deleteQuoteFiles(quoteId: string) {
    const supabase = await createClient();
    const { user } = await requireAuth(supabase);

    // Verificar propiedad antes de usar service role
    const { data: quote } = await supabase
      .from("sales_quotes")
      .select("id, created_by")
      .eq("id", quoteId)
      .single();

    if (!quote || quote.created_by !== user.id) {
      throw new Error("No autorizado para eliminar esta cotización");
    }

    // Ahora sí, usar service role para storage
    const supabaseAdmin = createAdminClient(/* ... */);
    // ... resto de la lógica
  }
  ```

---

### 🚩 H-17: QUERIES DUPLICADAS Y N+1

- **Categoría:** Performance
- **Gravedad:** MEDIA
- **Diagnóstico:** Patrones de consultas ineficientes encontrados en múltiples archivos.
- **Archivos afectados:**
  - `app/dashboard/ventas/actions.ts:303-315` — Dos queries paralelas a `projects` para obtener columnas diferentes que podrían ser una sola query
  - `app/dashboard/ventas/actions.ts:333-354` — `getQuoteById()` hace 2 queries separadas (quote + items) cuando podría ser una con relaciones
- **Refactorización Propuesta:**

  *Código Actual:* (`getQuoteById`)
  ```typescript
  const { data: quote } = await supabase.from("sales_quotes").select("*").eq("id", id).single();
  const { data: items } = await supabase.from("sales_quote_items").select("*").eq("quote_id", id);
  ```

  *Código Optimizado:*
  ```typescript
  const { data: quote } = await supabase
    .from("sales_quotes")
    .select("*, sales_quote_items(*)")
    .eq("id", id)
    .single();
  ```

---

### 🚩 H-18: `force-dynamic` EN TODAS LAS PÁGINAS — SIN CACHING

- **Categoría:** Performance
- **Gravedad:** MEDIA
- **Diagnóstico:** Múltiples páginas declaran `export const dynamic = 'force-dynamic'` que desactiva completamente el caching de Next.js. Datos que cambian infrecuentemente (catálogos, máquinas, operadores) se re-fetechean en cada request.
- **Impacto:** TTFB elevado innecesariamente. Carga adicional a Supabase.
- **Archivos:** `app/dashboard/page.tsx:5`, `app/dashboard/produccion/maquinados/page.tsx:6`, `app/dashboard/produccion/planeacion/page.tsx:7`
- **Refactorización:** Usar `revalidatePath()` / `revalidateTag()` con ISR para datos semi-estáticos (catálogos, lista de máquinas). Mantener `force-dynamic` solo para datos que realmente cambian en tiempo real.

---

### 🚩 H-19: DEMO/PLACEHOLDER CODE EN PRODUCCIÓN

- **Categoría:** Limpieza / Seguridad
- **Gravedad:** BAJA
- **Diagnóstico:** Código de demo y hardcoded IDs encontrados en archivos de producción.
- **Archivos:**
  - `app/dashboard/ventas/nuevo-proyecto/project-form.tsx:338` — `setDriveFolderUrl("https://drive.google.com/drive/folders/demo-folder-id")`
  - `components/production/production-view.tsx:816` — Comentario: `// Cast to any to avoid strict type checking on demo data`
  - `app/dashboard/ventas/project-actions.ts:126` — UUID hardcodeado: `status_id: '3f454811-5b77-4b11-ab75-458e20c5ae6e'`
- **Refactorización:** Mover IDs a constantes en `lib/constants/`, eliminar código demo.

---

### 🚩 H-20: CONSOLE.LOG EN PRODUCCIÓN — 78 INSTANCIAS

- **Categoría:** Limpieza / Seguridad
- **Gravedad:** BAJA
- **Diagnóstico:** 78 `console.log` / `console.error` directos encontrados en código de producción. El proyecto tiene `utils/logger.ts` pero no se usa consistentemente. Algunos logs incluyen datos potencialmente sensibles.
- **Archivos con más instancias:**
  - `app/dashboard/ventas/actions.ts` — 16 instancias (incluyendo logs de rutas de storage en líneas 471, 481)
  - `app/dashboard/actions-updates.ts` — 5 instancias
  - `components/realtime-refresher.tsx` — 5 instancias (debug logs)
- **Refactorización:** Reemplazar todos los `console.log` con el `logger` existente y configurarlo para silenciarse en producción.

---

## 3. LISTA DE VERIFICACIÓN POST-AUDITORÍA

### Prioridad CRÍTICA (Semana 1)
- [x] ~~Regenerar tipos Supabase con `supabase gen types typescript` y eliminar los 54 `as any`~~ ✅ Resuelto 2026-03-18 — 0 errores TS, solo 5 `as any` irreducibles
- [x] ~~Agregar validación Zod a TODOS los server actions que aceptan input de usuario~~ ✅ Resuelto 2026-03-18 — 35 funciones validadas, 4 archivos de schemas creados
- [x] ~~Implementar error boundaries (`error.tsx`) en `/app/dashboard/` y subdirectorios~~ ✅ Resuelto 2026-03-18 — 9 error boundaries creados (global + dashboard + 7 subdirectorios), componente reutilizable `ErrorDisplay`
- [x] ~~Configurar Vitest y escribir tests para `scheduling-utils.ts` y `auth-guard.ts`~~ ✅ Resuelto 2026-03-18 — 66 tests (55 scheduling + 11 auth), todos pasando, Vitest configurado
- [x] ~~Corregir open redirect en `auth/callback/route.ts` con whitelist de rutas~~ ✅ Resuelto 2026-03-18 — función `getSafeRedirect()` con whitelist de prefijos permitidos, bloquea URLs protocol-relative y absolutas
- [ ] Reemplazar mensajes de error internos con mensajes genéricos al usuario

### Prioridad ALTA (Semana 2-3)
- [ ] Agregar verificación de propiedad en `deleteQuoteFiles()`
- [ ] Implementar paginación en queries de producción/planeación (remover `.limit(5000)`)
- [ ] Unificar componentes duplicados en `components/shared/`
- [ ] Agregar security headers en `next.config.ts`
- [ ] Agregar `loading.tsx` a todas las rutas con fetches pesados
- [ ] Comenzar refactoring de `production-view.tsx` (1,899 líneas → 5-10 componentes)

### Prioridad MEDIA (Semana 3-4)
- [ ] Reemplazar `moment.js` con `date-fns` en todo el módulo de producción
- [ ] Migrar imágenes a `next/image`
- [ ] Combinar queries N+1 (`getQuoteById`, `getFilterOptions`)
- [ ] Implementar caching selectivo (remover `force-dynamic` donde no sea necesario)
- [ ] Refactorizar `realtime-refresher.tsx` para invalidación granular
- [ ] Configurar Prettier y extender reglas de ESLint

### Prioridad BAJA (Mes 2)
- [ ] Eliminar directorio `src/app` huérfano
- [ ] Corregir typo `genral_status` → `general_status` (requiere migración de BD)
- [ ] Eliminar código demo/placeholder
- [ ] Reemplazar 78 `console.log` con `logger.ts`
- [ ] Mover UUIDs hardcodeados a `lib/constants/`
- [ ] Configurar pre-commit hooks con Husky + lint-staged

---

*Fin del reporte. Este documento debe revisarse mensualmente para trackear el progreso de remediación.*
