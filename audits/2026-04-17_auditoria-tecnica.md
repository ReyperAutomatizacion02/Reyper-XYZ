# REPORTE DE AUDITORÍA TÉCNICA — REYPER XYZ · Iteración 2

**Fecha:** 2026-04-17 | **Auditor:** Senior Full-Stack Architect & Lead Security Auditor | **Modelo:** Claude Sonnet 4.6
**Última actualización:** 2026-04-17 — T-02/T-03/T-05/T-06/T-07/T-10/T-13/T-16 resueltos · T-01/T-04/T-11 investigados/parciales
**Auditoría anterior:** [2026-03-31_auditoria-tecnica.md](./2026-03-31_auditoria-tecnica.md)

---

## 1. RESUMEN EJECUTIVO

**Calificación General: 6.8 / 10**

La arquitectura central del proyecto es sólida: Next.js App Router con Server Actions, Supabase con RLS habilitado, Zod para validación, `auth-guard.ts` centralizado y un sistema de permisos granular bien implementado. Sin embargo, el crecimiento acelerado del codebase desde la Iteración 1 ha introducido deuda técnica significativa: tres debilidades de seguridad críticas activas (una heredada de la iteración anterior sin resolver), ausencia total de rate limiting, patrones de consulta sin paginación que no escalan, y una degradación notable en la calidad del tipado TypeScript concentrada en el motor de planificación.

**Distribución de hallazgos: 3 críticos · 6 altos · 8 medios · 6 bajos** (23 total)

**Top 3 Riesgos Críticos:**

1. ~~`SUPABASE_SERVICE_ROLE_KEY` activo en `.env.local` — bypasea toda RLS~~ → ⚠️ INVESTIGADO: archivo nunca commiteado al repositorio
2. ~~CSP incluye `'unsafe-eval'` en producción — anula la protección principal contra XSS~~ → ✅ RESUELTO 2026-04-17
3. Condición de carrera en generación de códigos de proyecto — duplicados posibles bajo carga concurrente 🚩 PENDIENTE

---

## 2. DESGLOSE DE HALLAZGOS

---

### ⚠️ T-01 · ~~SERVICE ROLE KEY EXPUESTO EN `.env.local`~~ [INVESTIGADO — 2026-04-17]

- **Categoría:** Seguridad
- **Gravedad:** Crítica
- **Estado:** INVESTIGADO — 2026-04-17. Sin acción requerida por el momento.
- **Archivo:** `.env.local`
- **Diagnóstico:** El `SUPABASE_SERVICE_ROLE_KEY` permanece almacenado en texto plano en `.env.local`. Este key bypasea completamente las Row Level Security policies y otorga acceso de superusuario a toda la base de datos. Adicionalmente, el `NOTION_TOKEN`, `GOOGLE_API_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (producción real) también están en el mismo archivo. Viola OWASP A02:2021 (Cryptographic Failures) y el principio de menor privilegio.
- **Impacto:** Si el archivo es expuesto accidentalmente (IDE sharing, screen recording, commit con `.gitignore` bypaseado), un atacante obtiene control total sobre todas las tablas de Supabase, acceso a Notion y uso ilimitado de la Google API.
- **Investigación aplicada:** Verificado con `git log --all --full-history -- ".env.local"` y `git grep` en toda la historia del repositorio: el archivo `.env.local` **nunca ha sido commiteado**. Las únicas apariciones de `SUPABASE_SERVICE_ROLE_KEY` en el historial de git son referencias al nombre de la variable (`process.env.SUPABASE_SERVICE_ROLE_KEY`) en scripts y reportes de auditoría — nunca el valor real. Credenciales no expuestas.
- **Condición para reabrir:** Si `.gitignore` es modificado y el archivo es commiteado accidentalmente, rotar inmediatamente todas las credenciales y configurarlas como variables de entorno en la plataforma de deploy.

---

### ✅ T-02 · ~~CSP CON `'unsafe-eval'` EN PRODUCCIÓN~~ [RESUELTO — 2026-04-17]

- **Categoría:** Seguridad
- **Gravedad:** Crítica
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `next.config.ts:59`
- **Diagnóstico:** El header `Content-Security-Policy` definido en `next.config.ts` incluye `'unsafe-eval'` en la directiva `script-src`. Esta directiva permite ejecutar código JavaScript arbitrario via `eval()`, `new Function()` y similares, anulando la protección principal de la CSP contra XSS. Si un atacante logra inyectar contenido en la página, `'unsafe-eval'` convierte la CSP en ineficaz. Viola OWASP A03:2021 (Injection) y la guía OWASP CSP Cheat Sheet.
- **Impacto:** Cualquier vector XSS que logre pasar el output encoding de React puede escalar a ejecución de código arbitrario en el navegador del usuario.
- **Corrección aplicada:** `next.config.ts` — añadida constante `isDev` y la directiva `script-src` es ahora condicional: `'unsafe-eval'` solo se incluye en `development`. Build de producción queda sin él.

---

### ✅ T-03 · ~~CONDICIÓN DE CARRERA EN GENERACIÓN DE CÓDIGOS DE PROYECTO~~ [RESUELTO — 2026-04-17]

- **Categoría:** Lógica / Seguridad
- **Gravedad:** Crítica
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `app/dashboard/ventas/actions.ts:697-724`, `app/dashboard/ventas/project-actions.ts:12-47`
- **Diagnóstico:** Ambas implementaciones de `getNextProjectCode()` usan el patrón read-then-write: leen el código máximo existente, lo incrementan en JavaScript y lo usan en el siguiente `INSERT`. No existe ninguna garantía de atomicidad. Dos usuarios concurrentes pueden leer el mismo código máximo y generar proyectos con código duplicado. Viola el principio de atomicidad de transacciones de base de datos.
- **Impacto:** Duplicación de códigos de proyecto (ej. dos proyectos `ABC-0042`), conflictos de integridad referencial y confusión operativa en producción.
- **Corrección aplicada:**
    - **Migración Supabase** `20260417_atomic_project_code_generation`: función `get_next_project_code(p_prefix TEXT)` en PostgreSQL que usa `pg_advisory_xact_lock(hashtext('project_code:' || p_prefix))` para serializar llamadas concurrentes del mismo prefijo. Extrae el número con `SUBSTRING` y devuelve `PREFIX-NNNN`.
    - **`project-actions.ts`**: reemplazado el read-then-write en JavaScript por `supabase.rpc("get_next_project_code", { p_prefix })`.
    - **`actions.ts`**: eliminada la implementación duplicada local (líneas 697-724); importada la función canónica desde `project-actions.ts`. Resuelve también **T-16**.

---

### ⚠️ T-04 · SIN RATE LIMITING EN NINGÚN ENDPOINT [PARCIALMENTE RESUELTO — 2026-04-17]

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** INVESTIGADO / PARCIALMENTE RESUELTO — 2026-04-17
- **Archivo:** `middleware.ts`, `app/api/webhooks/supabase/quotes/route.ts`
- **Diagnóstico:** No existe ningún mecanismo de rate limiting a nivel de aplicación. El único endpoint HTTP (`/api/webhooks/supabase/quotes`) no tiene límite de peticiones. Las Server Actions tampoco tienen protección contra abuso repetido. Supabase aplica rate limiting en sus endpoints de auth (`signInWithPassword`, `signUp`) a nivel de plataforma, pero los límites por defecto son generosos y no aplican a las Server Actions. Viola OWASP A04:2021 (Insecure Design).
- **Impacto:** Brute force en login (aunque mitigado parcialmente por Supabase), spam del webhook si el secret se filtra, y potencial DoS mediante Server Actions costosas (ej. `getAuditData()` con eager loading profundo).
- **Corrección aplicada (webhook):** Rate limiter in-process añadido en `route.ts` — máximo 30 req/min por IP usando un `Map<string, {count, resetAt}>`. Suficiente para un webhook server-to-server de Supabase (tráfico real: 1-5 llamadas/día). Sin dependencias externas.
- **Pendiente (Server Actions):** Rate limiting stateful entre invocaciones serverless requiere Redis externo (Upstash). Template listo para cuando se habilite Upstash:
    ```ts
    // lib/rate-limit.ts — requiere UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN en .env
    import { Ratelimit } from "@upstash/ratelimit";
    import { Redis } from "@upstash/redis";
    export const actionRateLimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "10 s"),
    });
    ```

---

### ✅ T-05 · ~~QUERIES SIN PAGINACIÓN EN HISTORIAL Y PROYECTOS~~ [RESUELTO — 2026-04-17]

- **Categoría:** Performance
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `app/dashboard/ventas/actions.ts:383,413`, `app/dashboard/ventas/historial/page.tsx`
- **Diagnóstico:** `getQuotesHistory()` y `getActiveProjects()` recuperaban la totalidad de sus tablas sin ningún límite.
- **Corrección aplicada:**
    - `getQuotesHistory()`: añadidos `.limit(300)` y `{ count: "exact" }`. Retorna `{ data, totalCount, limit }`.
    - `getActiveProjects()`: añadido `.limit(500)` como protector (proyectos activos siempre son pocos).
    - `historial/page.tsx`: `loadData()` actualizado para el nuevo shape. Banner visual ámbar cuando `totalCount > limit`, indicando el total real y sugiriendo usar los filtros. Corregido `catch (error: any)` → `catch (error: unknown)`.

---

### ✅ T-06 · ~~UPLOAD SIN VALIDACIÓN MIME + NOMBRE DE ARCHIVO PREDECIBLE~~ [RESUELTO — 2026-04-17]

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `app/dashboard/ventas/upload-client.ts`, `app/dashboard/produccion/maquinas/upload-client.ts`
- **Diagnóstico:** Nombres de archivo generados con `Math.random()` (no criptográficamente seguro) y sin validación de tipo MIME antes del upload.
- **Corrección aplicada en ambos archivos:**
    - `Math.random()` → `crypto.randomUUID()` para generación del nombre de archivo.
    - Añadido `ALLOWED_TYPES` / `ALLOWED_IMAGE_TYPES` con validación antes del upload. Ventas: `jpeg, png, webp, gif, pdf`. Maquinas: `jpeg, png, webp, gif`.
    - Constante `MAX_SIZE_BYTES` nombrada en lugar de literal inline.
    - Mensajes de error descriptivos en español.

---

### ✅ T-07 · ~~`select("*")` GENERALIZADO — OVER-FETCHING DE COLUMNAS~~ [RESUELTO — 2026-04-17]

- **Categoría:** Performance
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `app/dashboard/admin-panel/actions.ts:249,272,307`, `app/dashboard/admin-panel/page.tsx:34-35`, `app/dashboard/page.tsx:276`, `app/dashboard/produccion/maquinados/page.tsx:16`, `app/dashboard/produccion/planeacion/page.tsx:19,34`
- **Diagnóstico:** Múltiples queries usaban `.select("*")` cuando solo se consumían 2-4 columnas del resultado. El caso más grave era `app/dashboard/page.tsx:276` que recuperaba todas las columnas de `planning` cuando el cálculo de utilización solo necesita `machine`, `planned_date` y `planned_end`.
- **Corrección aplicada:**
    - `admin-panel/actions.ts:249,272` — `user_profiles` proyecta `id, full_name, username, roles, permissions, is_approved, operator_name, created_at, updated_at`
    - `admin-panel/actions.ts:307` — `employees` proyecta todos los campos del tipo `Employee`
    - `admin-panel/page.tsx:34` — `employees` con proyección explícita
    - `admin-panel/page.tsx:35` — `work_shifts` proyecta `id, name, start_time, end_time, days_of_week, active, sort_order, created_at`
    - `dashboard/page.tsx:276` — `planning` → `.select("machine, planned_date, planned_end")` + `UtilizationTask` Pick type para alinear TypeScript
    - `produccion/maquinados/page.tsx:16` — `user_profiles` → `.select("roles, operator_name")`
    - `produccion/planeacion/page.tsx:34` — `work_shifts` → `.select("id, name, start_time, end_time, days_of_week, active, sort_order")` (alineado con interfaz `WorkShift`)
    - `machines` en planeacion: tabla de 9 columnas totales, sin over-fetching significativo — sin cambio.

---

### ⚠️ T-08 · INCONSISTENCIA EN MANEJO DE ERRORES — `throw` VS `ActionResult` + `catch(e: any)` [PENDIENTE]

- **Categoría:** Lógica / Mantenimiento
- **Gravedad:** Alta
- **Estado:** PENDIENTE
- **Archivo:** `app/dashboard/ventas/actions.ts:236,877`, `app/dashboard/ventas/cotizador/page.tsx`, `app/dashboard/ventas/drive-actions.ts:69`, `app/dashboard/ventas/historial/page.tsx:117`, `app/dashboard/ventas/proyectos/page.tsx:83`
- **Diagnóstico:** Dos problemas relacionados: (1) Algunas funciones usan `throw new Error(...)` mientras otras retornan `ActionResult<T>` — el cliente debe manejar ambos contratos, haciendo el código frágil. `createPositionEntry()` (línea 236) lanza directamente. (2) Numerosos bloques `catch (error: any)` acceden a `error.message` sin verificar si `error` es instancia de `Error`, lo que puede causar crashes en runtime con valores no-Error. Viola el principio de contrato explícito (DRY aplicado a interfaces).
- **Impacto:** Los errores de `throw` no son capturados por el helper `getErrorMessage()`, generando mensajes inconsistentes o crashes silenciosos en el cliente.
- **Refactorización propuesta:**
    ```ts
    // Estandarizar TODOS los server actions a ActionResult<T>
    // Cambiar catch(error: any) por:
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: message };
    }
    ```

---

### ⚠️ T-09 · TIPADO `any` MASIVO EN SCHEDULING ENGINE + ARCHIVOS GOD [PENDIENTE]

- **Categoría:** Mantenimiento
- **Gravedad:** Alta
- **Estado:** PENDIENTE
- **Archivo:** `lib/scheduling/planner.ts`, `app/dashboard/ventas/cotizador/page.tsx`, `app/dashboard/ventas/nuevo-proyecto/project-form.tsx`
- **Diagnóstico:** Dos problemas de calidad estructural: (1) `lib/scheduling/planner.ts` contiene 30+ comentarios `// eslint-disable-next-line @typescript-eslint/no-explicit-any` — toda la representación interna de tareas usa `any[]` en lugar de los tipos definidos en `lib/scheduling/types.ts`. (2) Tres archivos superan los 800 líneas: `cotizador/page.tsx` (1,586 líneas), `project-form.tsx` (1,367 líneas), `planner.ts` (761 líneas). Mezclan múltiples responsabilidades (UI, lógica de negocio, generación de PDF, upload, llamadas a Server Actions). Viola SOLID-S (Single Responsibility Principle).
- **Impacto:** El scheduling engine es prácticamente imposible de refactorizar o testear unitariamente. Los archivos God ralentizan los tiempos de revisión y aumentan la probabilidad de regresiones al modificar una sola funcionalidad.
- **Refactorización propuesta:**
    - Tipar `planner.ts` usando los tipos de `lib/scheduling/types.ts` y eliminar los `eslint-disable`.
    - Extraer `cotizador/page.tsx`: separar `QuoteItemsTable`, `QuotePDFPreview`, `QuoteFileUpload`, `QuoteDriveScan` en componentes propios.

---

### ✅ T-10 · ~~MIDDLEWARE REDIRIGE A `/login` PARA RUTAS `/api` NO AUTENTICADAS~~ [RESUELTO — 2026-04-17]

- **Categoría:** Seguridad / Lógica
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `middleware.ts:45-48`
- **Diagnóstico:** Para solicitudes no autenticadas a rutas `/api/`, el middleware ejecutaba un redirect a `/login`, devolviendo HTML en lugar de un 401 JSON.
- **Corrección aplicada:** Añadida rama específica antes del redirect: si `pathname.startsWith("/api/")` y no hay usuario, retorna `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` en lugar de redirigir a `/login`.

---

### ⚠️ T-11 · RLS BASADO EN ROLES, NO EN PERMISOS GRANULARES [INVESTIGADO]

- **Categoría:** Seguridad
- **Gravedad:** Media
- **Estado:** INVESTIGADO — la capa de aplicación (`requirePermission()`) proporciona la aplicación real; RLS es la segunda línea de defensa
- **Archivo:** `supabase/migrations/20260203_strict_rls_policies.md`
- **Diagnóstico:** Las políticas RLS verifican el array `roles` del perfil, pero la aplicación evolucionó hacia un sistema de `permissions` más granular. Un usuario con rol `ventas` pero con el permiso `ventas:cotizador` revocado via admin panel puede aún escribir en `sales_quotes` a nivel de RLS. La protección real la provee `requirePermission()` en cada Server Action, pero RLS no es el backstop que debería ser.
- **Impacto:** Si un Server Action olvida llamar `requirePermission()`, RLS no compensa la omisión. Riesgo bajo en la práctica dado el double-enforcement actual, pero aumenta con el crecimiento del codebase.
- **Pendiente:** Evaluar migrar políticas RLS para verificar el array `permissions` en lugar de (o además de) `roles`. Requiere análisis de impacto en las políticas existentes.

---

### ⚠️ T-12 · `getAuditData()` EAGER LOAD PROFUNDO SIN LÍMITE [PENDIENTE]

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** PENDIENTE
- **Archivo:** `app/dashboard/ventas/actions.ts:449-493`
- **Diagnóstico:** Recupera todos los proyectos activos con todas sus `production_orders` anidadas y todos sus campos. No hay `.limit()` ni proyección de columnas. A medida que crecen los proyectos activos y sus órdenes, esta query se volverá el cuello de botella principal del módulo de ventas.
- **Impacto:** Timeouts y alta latencia en la vista de auditoría de ventas conforme escala el negocio.
- **Refactorización propuesta:** Aplicar selección de columnas específicas y paginar los proyectos. Considerar un RPC dedicado que haga el JOIN y proyección en PostgreSQL.

---

### ✅ T-13 · ~~`select("*")` EN `planning` PARA CÁLCULO DE UTILIZACIÓN~~ [RESUELTO — 2026-04-17]

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-04-17 (resuelto junto con T-07)
- **Archivo:** `app/dashboard/page.tsx:274-279`
- **Corrección aplicada:** `.select("machine, planned_date, planned_end")` + tipo `UtilizationTask = Pick<PlanningRow, "machine" | "planned_date" | "planned_end">` para mantener coherencia TypeScript.

---

### ⚠️ T-14 · GANTT SIN VIRTUALIZACIÓN DE FILAS + SIN CAPA DE CACHÉ [PENDIENTE]

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** PENDIENTE
- **Archivo:** `components/production/gantt-svg.tsx` (862 líneas), `app/dashboard/produccion/planeacion/page.tsx`
- **Diagnóstico:** El componente Gantt renderiza todas las tareas y máquinas en un único SVG sin virtualización. Al crecer el número de órdenes activas, el DOM se vuelve pesado. Adicionalmente, no existe ninguna capa de caché (Redis, ISR, `unstable_cache`) para cómputos costosos como el Gantt o el dashboard — cada navegación recalcula todo desde cero.
- **Impacto:** Renders lentos del Gantt con >100 tareas activas; carga repetida del dashboard sin necesidad.
- **Pendiente:** Evaluar `react-window` para virtualización de filas del Gantt. Evaluar `unstable_cache` de Next.js para cachear la data del dashboard con revalidación por evento.

---

### ⚠️ T-15 · `console.error` DIRECTO EN SERVER ACTIONS INSTEAD OF LOGGER [PENDIENTE]

- **Categoría:** Mantenimiento
- **Gravedad:** Media
- **Estado:** PENDIENTE
- **Archivo:** `app/dashboard/ventas/actions.ts` (múltiples ocurrencias)
- **Diagnóstico:** Las server actions de ventas usan `console.error("[ventas]", error.message)` directamente mientras `app/dashboard/produccion/actions.ts` usa correctamente el `logger` centralizado. El logger permite integración futura con Sentry o un sistema de observabilidad sin cambiar cada archivo. La inconsistencia hace que las métricas de error sean parciales.
- **Corrección propuesta:** Reemplazar todas las ocurrencias de `console.error` en `ventas/actions.ts` por `logger.error(...)`.

---

### ✅ T-16 · ~~DOS IMPLEMENTACIONES DIVERGENTES DE `getNextProjectCode()`~~ [RESUELTO — 2026-04-17]

- **Categoría:** Mantenimiento / Lógica
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-04-17
- **Archivo:** `app/dashboard/ventas/actions.ts`, `app/dashboard/ventas/project-actions.ts`
- **Diagnóstico:** Dos funciones con el mismo nombre y propósito existían en archivos distintos con lógicas diferentes.
- **Corrección aplicada:** Resuelto como parte de T-03. La implementación canónica vive en `project-actions.ts` (ahora delegada al RPC). `actions.ts` la importa directamente — eliminada la copia local.

---

### ⚠️ T-17 · `supabase as any` PARA LLAMADAS RPC — TIPOS NO GENERADOS [PENDIENTE]

- **Categoría:** Mantenimiento
- **Gravedad:** Media
- **Estado:** PENDIENTE
- **Archivo:** `app/dashboard/ventas/actions.ts:501`
- **Diagnóstico:** `const client = supabase as any` se usa para llamar a RPCs cuyas firmas no están incluidas en `utils/supabase/types.ts`. El cast `as any` anula completamente la seguridad de tipos en esa sección. El fix es ejecutar `supabase gen types` incluyendo las funciones de la base de datos.
- **Corrección propuesta:**
    ```bash
    supabase gen types typescript --project-id <id> > utils/supabase/types.ts
    # Asegurarse de que las funciones están en el esquema público
    ```

---

### 🔵 T-18 · VERIFICACIÓN DE ROL REDUNDANTE EN PÁGINA DE MAQUINADOS [DIFERIDO]

- **Categoría:** Mantenimiento
- **Gravedad:** Baja
- **Estado:** DIFERIDO — bajo riesgo funcional dado el double-enforcement existente
- **Archivo:** `app/dashboard/produccion/maquinados/page.tsx:14-20`
- **Diagnóstico:** La página verifica `profile.roles.includes("operador")` manualmente además de que el middleware ya aplicó `produccion:maquinados`. La verificación usa `select("*")` innecesario. Duplica lógica de autorización fuera de `auth-guard.ts`.
- **Pendiente:** Eliminar el check manual de roles en la página; confiar en el middleware y `requirePermission()`. Reemplazar `select("*")` por columnas específicas si se mantiene alguna lectura del perfil.

---

### 🔵 T-19 · `SUPABASE_WEBHOOK_SECRET` AUSENTE EN `.env.local` + SIN `.env.example` [DIFERIDO]

- **Categoría:** Mantenimiento / Seguridad
- **Gravedad:** Baja
- **Estado:** DIFERIDO — el webhook falla-seguro (500) sin la variable; el riesgo es operativo, no de seguridad
- **Archivo:** `app/api/webhooks/supabase/quotes/route.ts`, raíz del proyecto
- **Diagnóstico:** `SUPABASE_WEBHOOK_SECRET` no está en `.env.local`, por lo que el webhook falla en desarrollo local con 500 "Server misconfigured". No existe `.env.example` que documente qué variables son necesarias y cuál es su propósito.
- **Pendiente:** Crear `.env.example` con todas las variables requeridas (sin valores), comentadas con su propósito. Añadir `SUPABASE_WEBHOOK_SECRET=` al `.env.example`.

---

### 🔵 T-20 · COMPONENTES Y PROPS TIPADOS COMO `any` [DIFERIDO]

- **Categoría:** Mantenimiento
- **Gravedad:** Baja
- **Estado:** DIFERIDO — no genera bugs en runtime, pero degrada la DX y el autocomplete
- **Archivo:** `app/dashboard/ventas/nuevo-proyecto/project-form.tsx:63,199`
- **Diagnóstico:** `initialQuote?: any` en `ProjectFormProps` y `AutoResizeTextarea` definido inline con `(props: any)`. El tipo `QuoteSummary` existe en `historial/page.tsx` pero no se comparte. `AutoResizeTextarea` es un componente de utilidad genérico que debería vivir en `components/ui/`.
- **Pendiente:** Mover `QuoteSummary` a `lib/types/sales.ts`. Extraer `AutoResizeTextarea` a `components/ui/auto-resize-textarea.tsx` con props tipadas.

---

### 🔵 T-21 · LOGS DE DEBUG Y COMENTARIOS ABANDONADOS EN CÓDIGO [DIFERIDO]

- **Categoría:** Limpieza
- **Gravedad:** Baja
- **Estado:** DIFERIDO — cosmético; no afecta funcionalidad
- **Archivo:** `scripts/sync-updated.ts:191`, `app/dashboard/produccion/actions.ts:80-100`
- **Diagnóstico:** (1) `console.log("🔍 [DEBUG] RAW COUNT...")` explícitamente etiquetado como DEBUG en el script de sync. (2) Bloque de ~20 líneas de comentarios que documentan deliberación interna sobre si cambiar una firma de función, terminando con una decisión ya tomada.
- **Corrección propuesta:** Eliminar ambos bloques.

---

### 🔵 T-22 · `next: ^16.1.6` — VERSIÓN INUSUAL QUE REQUIERE VERIFICACIÓN [DIFERIDO]

- **Categoría:** Mantenimiento
- **Gravedad:** Baja
- **Estado:** DIFERIDO — requiere verificación manual
- **Archivo:** `package.json`
- **Diagnóstico:** Next.js 16 no existe como versión pública estable (la línea estable es 15.x a la fecha de esta auditoría). Puede tratarse de una versión canary/RC, un tag de npm diferente, o un error tipográfico en `package.json`. Una versión canary en producción puede introducir bugs no reportados.
- **Pendiente:** Verificar `node_modules/next/package.json` version field. Si es canary, evaluar pin a la última 15.x stable.

---

### 🔵 T-23 · DEPENDENCIAS DESACTUALIZADAS + SIN `npm audit` EN CI [DIFERIDO]

- **Categoría:** Mantenimiento / Seguridad
- **Gravedad:** Baja
- **Estado:** DIFERIDO — sin CVEs conocidos identificados en el análisis
- **Archivo:** `package.json`
- **Diagnóstico:** `lucide-react: ^0.344.0` está ~120 versiones detrás de la actual (~0.460). No existe ningún paso de `npm audit` en el pipeline de CI. El monitoreo de vulnerabilidades en dependencias es reactivo, no proactivo.
- **Pendiente:** Añadir `npm audit --audit-level=high` como step de CI que falle el build si hay CVEs altos. Actualizar `lucide-react` en una sesión de mantenimiento de deps.

---

## 3. ÍNDICE DE HALLAZGOS

| ID   | Archivo / Área                                             | Gravedad | Categoría     | Estado                      |
| ---- | ---------------------------------------------------------- | -------- | ------------- | --------------------------- |
| T-01 | `.env.local`                                               | Crítica  | Seguridad     | ⚠️ INVESTIGADO — 2026-04-17 |
| T-02 | `next.config.ts:59`                                        | Crítica  | Seguridad     | ✅ RESUELTO — 2026-04-17    |
| T-03 | `ventas/actions.ts:697`, `project-actions.ts:12`           | Crítica  | Lógica        | ✅ RESUELTO — 2026-04-17    |
| T-04 | `middleware.ts`, `/api/webhooks/...`                       | Alta     | Seguridad     | ⚠️ PARCIAL — 2026-04-17     |
| T-05 | `ventas/actions.ts:383,413`                                | Alta     | Performance   | ✅ RESUELTO — 2026-04-17    |
| T-06 | `ventas/upload-client.ts`, `maquinas/upload-client.ts`     | Alta     | Seguridad     | ✅ RESUELTO — 2026-04-17    |
| T-07 | `admin-panel/actions.ts`, `page.tsx`, `dashboard/page.tsx` | Alta     | Performance   | ✅ RESUELTO — 2026-04-17    |
| T-08 | `ventas/actions.ts:236,877`, `cotizador/page.tsx`          | Alta     | Lógica        | 🚩 PENDIENTE                |
| T-09 | `lib/scheduling/planner.ts`, `cotizador/page.tsx`          | Alta     | Mantenimiento | 🚩 PENDIENTE                |
| T-10 | `middleware.ts:40-48`                                      | Media    | Seguridad     | ✅ RESUELTO — 2026-04-17    |
| T-11 | `supabase/migrations/20260203_strict_rls_...`              | Media    | Seguridad     | ⚠️ INVESTIGADO              |
| T-12 | `ventas/actions.ts:449-493`                                | Media    | Performance   | 🚩 PENDIENTE                |
| T-13 | `app/dashboard/page.tsx:274-279`                           | Media    | Performance   | ✅ RESUELTO — 2026-04-17    |
| T-14 | `components/production/gantt-svg.tsx`                      | Media    | Performance   | 🚩 PENDIENTE                |
| T-15 | `ventas/actions.ts` (múltiples)                            | Media    | Mantenimiento | 🚩 PENDIENTE                |
| T-16 | `ventas/actions.ts:697`, `project-actions.ts:12`           | Media    | Mantenimiento | ✅ RESUELTO — 2026-04-17    |
| T-17 | `ventas/actions.ts:501`                                    | Media    | Mantenimiento | 🚩 PENDIENTE                |
| T-18 | `produccion/maquinados/page.tsx:14-20`                     | Baja     | Mantenimiento | 🔵 DIFERIDO                 |
| T-19 | `api/webhooks/.../route.ts`, raíz                          | Baja     | Mantenimiento | 🔵 DIFERIDO                 |
| T-20 | `ventas/nuevo-proyecto/project-form.tsx:63,199`            | Baja     | Mantenimiento | 🔵 DIFERIDO                 |
| T-21 | `scripts/sync-updated.ts:191`, `produccion/actions.ts:80`  | Baja     | Limpieza      | 🔵 DIFERIDO                 |
| T-22 | `package.json`                                             | Baja     | Mantenimiento | 🔵 DIFERIDO                 |
| T-23 | `package.json`                                             | Baja     | Seguridad     | 🔵 DIFERIDO                 |

---

## 4. PLAN DE IMPLEMENTACIÓN POST-AUDITORÍA

### Completados en sesión 2026-04-17 ✅

- [x] **[CRÍTICO]** T-02 — CSP condicional por entorno: `'unsafe-eval'` eliminado de producción. Constante `isDev` añadida en `next.config.ts`.
- [x] **[CRÍTICO]** T-03 — Función PostgreSQL `get_next_project_code` con `pg_advisory_xact_lock` aplicada vía Supabase MCP. `project-actions.ts` actualizado para usar el RPC. Duplicado eliminado de `actions.ts`.
- [x] **[MEDIA]** T-16 — Resuelto como parte de T-03. Implementación canónica en `project-actions.ts`; `actions.ts` importa desde ahí.
- [x] **[ALTA]** T-04 (parcial) — Rate limiter in-process (30 req/min por IP) añadido al webhook. `catch (error: any)` corregido a `unknown`. Pendiente: Upstash para Server Actions.
- [x] **[MEDIA]** T-10 — Middleware retorna `401 JSON` para rutas `/api/` no autenticadas en lugar de redirect HTML.
- [x] **[ALTA]** T-05 — `getQuotesHistory()` protegida con `limit(300)` + `count: exact`; `getActiveProjects()` con `limit(500)`. Banner ámbar en UI cuando el total supera el límite cargado.
- [x] **[ALTA]** T-06 — `Math.random()` → `crypto.randomUUID()` en ambos upload-clients. Añadida validación MIME con `ALLOWED_TYPES` antes del upload.
- [x] **[ALTA]** T-07 — Proyección explícita de columnas en 7 queries: `admin-panel/actions.ts` (3), `admin-panel/page.tsx` (2), `produccion/maquinados/page.tsx` (1), `produccion/planeacion/page.tsx` (1). `machines` omitido (9 cols totales, sin over-fetching real).
- [x] **[MEDIA]** T-13 — Resuelto como parte de T-07. `.select("machine, planned_date, planned_end")` + tipo `UtilizationTask` para alinear TypeScript.

### Investigados / Sin acción requerida ⚠️

- **[CRÍTICO]** T-01 — Credenciales en `.env.local`: verificado con `git log --all` que el archivo nunca fue commiteado. Sin exposición. Condición para reabrir: commit accidental del archivo.
- **[MEDIA]** T-11 — RLS basado en roles vs. permisos: `requirePermission()` en cada Server Action proporciona la protección real. RLS es la segunda línea de defensa. Bajo riesgo en el equipo actual.

### Diferidos conscientemente 🔵

- **[BAJA]** T-18 Verificación de rol redundante en maquinados — riesgo funcional nulo dado el double-enforcement del middleware.
- **[BAJA]** T-19 `.env.example` ausente — el webhook falla-seguro; no hay riesgo de seguridad inmediato.
- **[BAJA]** T-20 Props tipadas como `any` — no genera bugs en runtime; abordar en próxima sesión de limpieza.
- **[BAJA]** T-21 Logs debug y comentarios abandonados — cosmético; resolver en cualquier PR que toque esos archivos.
- **[BAJA]** T-22 Versión de Next.js inusual — requiere verificación manual antes de decidir acción.
- **[BAJA]** T-23 Deps desactualizadas + sin npm audit — abordar en sesión dedicada de mantenimiento de dependencias.

### Pendientes — requieren acción ⚠️

- [ ] **[ALTA]** T-04 (Server Actions) — Rate limiting stateful para Server Actions requiere Upstash Redis. Template documentado en T-04.
- [ ] **[ALTA]** T-08 — Estandarizar todos los Server Actions a `ActionResult<T>`. Cambiar `catch(error: any)` por `catch(error: unknown)`.
- [ ] **[ALTA]** T-09 — Tipar el scheduling engine con `lib/scheduling/types.ts`. Extraer subcomponentes de `cotizador/page.tsx` y `project-form.tsx`.
- [ ] **[MEDIA]** T-12 — Añadir `.limit()` y proyección de columnas a `getAuditData()`.
- [ ] **[MEDIA]** T-14 — Evaluar `react-window` para Gantt + `unstable_cache` para dashboard.
- [ ] **[MEDIA]** T-15 — Reemplazar `console.error` por `logger.error` en `ventas/actions.ts`.
- [ ] **[MEDIA]** T-17 — Ejecutar `supabase gen types` con funciones incluidas para eliminar el cast `supabase as any`.

---

## 5. MÉTRICAS DE LA AUDITORÍA

| Categoría     | Crítica | Alta  | Media | Baja  |
| ------------- | ------- | ----- | ----- | ----- |
| Seguridad     | 2       | 2     | 2     | 1     |
| Performance   | 0       | 2     | 4     | 0     |
| Lógica        | 1       | 1     | 0     | 0     |
| Mantenimiento | 0       | 1     | 3     | 4     |
| Limpieza      | 0       | 0     | 0     | 1     |
| **Total**     | **3**   | **6** | **9** | **6** |

**Total de hallazgos: 23**

### Estado de resolución

| Estado                                 | Cantidad | Porcentaje |
| -------------------------------------- | -------- | ---------- |
| ✅ Resueltos en código / configuración | 7        | 30%        |
| 🔵 Diferido conscientemente            | 6        | 26%        |
| ⚠️ Investigado / Parcialmente resuelto | 3        | 13%        |
| 🚩 Pendiente (acción requerida)        | 7        | 30%        |
