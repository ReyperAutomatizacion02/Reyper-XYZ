# 🔒 Auditoría Técnica Profunda — Reyper XYZ

**Fecha:** 2026-03-13  
**Auditor:** Senior Full-Stack Architect & Lead Security Auditor  
**Stack:** Next.js 16 + React 19 + Supabase + TailwindCSS  

---

## 1. RESUMEN DE SALUD

### Calificación General: 5.5 / 10

El proyecto tiene una base funcional sólida y algunas buenas decisiones (RBAC centralizado, Zod para validación, `poweredByHeader: false`). Sin embargo, tiene **deficiencias críticas de seguridad** que, si se explotan, permiten a cualquier usuario autenticado ejecutar acciones administrativas, y problemas de rendimiento que degradarán la experiencia a medida que crezca la data.

### 🔴 TOP 3 Riesgos Críticos

| # | Riesgo | Impacto |
|---|--------|---------|
| 1 | **Server Actions sin autenticación** — La mayoría de server actions no verifican quién las invoca. Cualquier usuario autenticado puede mutar datos de otros. | Escalación de privilegios total, manipulación de datos de producción |
| 2 | **Webhook sin autenticación obligatoria** — La verificación del token es condicional (`if (expectedToken && ...)`). Si la variable no está configurada, el webhook es público. | Cualquiera puede triggear la eliminación de archivos de cotizaciones |
| 3 | **Tipo `any` sistémico + supresión de TypeScript** — Casteos `as any` en 90%+ de server actions, bypasea completamente RLS typing de Supabase y permite data corruption silenciosa. | Bugs no detectables, vulnerabilidades imposibles de descubrir en review |

---

## 2. DESGLOSE DE HALLAZGOS

---

### 🚩 01 — Server Actions Sin Verificación de Autenticación

- **Categoría:** Seguridad
- **Gravedad:** 🔴 Crítica
- **Principio violado:** OWASP A01:2021 - Broken Access Control

**Diagnóstico:**  
La gran mayoría de los server actions en `ventas/actions.ts` y `produccion/actions.ts` **no verifican si el usuario está autenticado ni si tiene permisos para la operación**.

Funciones como `createClientEntry`, `saveQuote`, `updateQuote`, `deleteQuote`, `updateTaskSchedule`, `batchSavePlanning`, `deleteScenario`, y muchas más, aceptan datos directamente sin verificar `supabase.auth.getUser()`.

Solo `admin-panel/actions.ts` implementa correctamente la verificación con `verifyAdmin()`.

**Impacto:**  
Cualquier usuario autenticado (incluso uno con rol `operador`) puede invocar directamente estas server actions desde el cliente y:
- Crear/eliminar clientes, cotizaciones, y proyectos
- Modificar tareas de producción de cualquier máquina
- Eliminar escenarios de planeación
- Alterar órdenes de producción

**Refactorización Propuesta:**

```diff
// ventas/actions.ts - Ejemplo: createClientEntry
 export async function createClientEntry(name: string, prefix?: string, ...) {
     const cookieStore = await cookies();
     const supabase = createClient(cookieStore);
+
+    // VERIFICAR AUTENTICACIÓN
+    const { data: { user } } = await supabase.auth.getUser();
+    if (!user) throw new Error("No autenticado");
+
+    // VERIFICAR AUTORIZACIÓN (rol ventas o admin)
+    const { data: profile } = await supabase
+        .from("user_profiles")
+        .select("roles")
+        .eq("id", user.id)
+        .single();
+    if (!profile?.roles?.some((r: string) => ["admin", "ventas"].includes(r))) {
+        throw new Error("No autorizado");
+    }
+
     const { data, error } = await supabase.from("sales_clients")...
 }
```

> ⚠️ **Acción inmediata requerida.** Crear un helper `verifyAuth(supabase, allowedRoles[])` reutilizable y aplicarlo a CADA server action. Sin esto, el middleware solo protege la navegación, no las mutaciones de datos.

---

### 🚩 02 — Webhook con Autenticación Condicional

- **Categoría:** Seguridad
- **Gravedad:** 🔴 Crítica
- **Principio violado:** OWASP A07:2021 - Identification and Authentication Failures

**Diagnóstico:**  
En `app/api/webhooks/supabase/quotes/route.ts`, línea 14:

```typescript
// ACTUAL — INSEGURO
if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new NextResponse('Unauthorized', { status: 401 });
}
```

El operador `&&` significa: "solo valida si el token existe en env". Si `SUPABASE_WEBHOOK_SECRET` no está configurado en el deploy, **el endpoint queda completamente abierto**.

**Impacto:**  
Un atacante puede enviar un POST a `/api/webhooks/supabase/quotes` con un payload fabricado y forzar la eliminación de archivos de cualquier cotización. El `deleteQuoteFiles` usa Service Role Key con privilegios absolutos.

**Refactorización Propuesta:**

```diff
-if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
-    return new NextResponse('Unauthorized', { status: 401 });
-}
+if (!expectedToken) {
+    console.error("[WEBHOOK] SUPABASE_WEBHOOK_SECRET no configurado. Rechazando request.");
+    return new NextResponse('Server misconfigured', { status: 500 });
+}
+if (authHeader !== `Bearer ${expectedToken}`) {
+    return new NextResponse('Unauthorized', { status: 401 });
+}
```

---

### 🚩 03 — Abuso Sistémico de `as any` — Type Safety Destruida

- **Categoría:** Seguridad + Lógica
- **Gravedad:** 🔴 Crítica
- **Principio violado:** Principio de mínima sorpresa, Type Safety como barrera de seguridad

**Diagnóstico:**  
En `produccion/actions.ts`, CADA query a la tabla `planning` usa un doble casteo: `(supabase.from("planning" as any) as any)`. Esto destruye completamente la verificación de tipos de TypeScript.

En `scheduling-utils.ts`, hay múltiples casteos como `(order as any).urgencia`, `(order as any).genral_status`, `(order as any).evaluation as any`.

El archivo `utils/supabase/server.ts` línea 4 tiene `cookieStore: ReadonlyRequestCookies | any` — un `any` que anula toda type-checking.

**Impacto:**  
- TypeScript no puede detectar errores en nombres de columnas, tipos de datos, o queries inválidas
- Bugs de runtime que serían compile-time errors en un sistema tipado
- Imposible hacer refactoring seguro del schema de base de datos
- Vulnerabilidades ocultas en la lógica de negocio

**Refactorización Propuesta:**  
Regenerar los tipos con `generate_typescript_types`, verificar que la tabla `planning` y sus columnas existan en el tipo `Database`, y eliminar todos los casteos `as any`.

```diff
// produccion/actions.ts
-const { error } = await (supabase.from("planning" as any) as any)
-    .update({ planned_date: start, planned_end: end })
-    .eq("id", taskId);
+const { error } = await supabase.from("planning")
+    .update({ planned_date: start, planned_end: end })
+    .eq("id", taskId);
```

---

### 🚩 04 — Middleware con Query a DB en Cada Request

- **Categoría:** Performance
- **Gravedad:** 🟠 Alta
- **Principio violado:** Optimización de hot paths

**Diagnóstico:**  
En `middleware.ts`, líneas 56-60, cada request a `/dashboard/*` ejecuta:
1. `supabase.auth.getUser()` — Request HTTP a Supabase Auth
2. `supabase.from("user_profiles").select("is_approved, roles")` — Request HTTP a PostgREST

Esto ocurre en **cada navegación, cada carga de página, cada fetch de datos**.

**Impacto:**  
- +100-200ms de latencia por request solo en el middleware
- Carga innecesaria en la base de datos
- Si Supabase tiene un spike de latencia, toda la aplicación se detiene

**Refactorización Propuesta:**  
Codificar roles y `is_approved` en los App Metadata del usuario (JWT claims) para evitar la query en el middleware.

---

### 🚩 05 — `console.log` en Producción — Filtración de Información

- **Categoría:** Seguridad + Limpieza
- **Gravedad:** 🟠 Alta
- **Principio violado:** OWASP A09:2021 - Security Logging and Monitoring Failures

**Diagnóstico:**  
Hay **50+ instancias** de `console.log` en código de producción. Particularmente graves:

| Archivo | Problema |
|---------|----------|
| `actions-updates.ts` | `console.log("Saving update to Supabase:", { id, updates })` — Expone datos completos |
| `ventas/actions.ts` | `console.log(...INICIANDO LIMPIEZA DE CARPETA COTIZACIÓN: ${quoteId})` — Expone IDs |
| `scheduling-utils.ts` | `console.log("[AutoPlan] Starting with"...)` — Expone volumen de órdenes |
| Componentes varios | `console.log("Subscribed to..."` etc. |

El proyecto ya tiene un `logger.ts` que filtra logs en producción, pero **nadie lo usa excepto `produccion/actions.ts`**.

**Impacto:**  
Filtración de información interna (IDs, datos de negocio, estructura de DB) en herramientas de desarrollador del navegador.

---

### 🚩 06 — Dependencias Duplicadas: `moment.js` + `date-fns`

- **Categoría:** Performance
- **Gravedad:** 🟡 Media
- **Principio violado:** DRY, Bundle Size Optimization

**Diagnóstico:**  
El proyecto importa **ambas** librerías de fechas:
- `moment` (330KB sin minificar, mutable API) — usado en `scheduling-utils.ts` y `produccion/actions.ts`
- `date-fns` (~5KB por función, immutable) — declarado en `package.json` y usado en `date-utils.ts`

`moment.js` está oficialmente marcado como **legacy** por sus propios creadores.

**Impacto:**  
+330KB en el bundle, dos APIs diferentes para la misma funcionalidad, `moment` muta objetos in-place causando bugs sutiles.

---

### 🚩 07 — Server Actions Reciben `any` Sin Validación

- **Categoría:** Seguridad
- **Gravedad:** 🟠 Alta
- **Principio violado:** OWASP A03:2021 - Injection, Never Trust User Input

**Diagnóstico:**  
Múltiples funciones aceptan datos sin tipado ni validación:

```typescript
// ventas/actions.ts línea 117
export async function saveQuote(quoteData: any, items: any[]) {
    // ... directamente inserta quoteData en la DB
    .insert({ ...quoteData }) // ← SPREAD DIRECTO de input no validado
```

**Impacto:**  
Un atacante puede inyectar columnas adicionales, overwrite campos protegidos, o ejecutar mass assignment attacks.

---

### 🚩 08 — Dashboard Principal: Monolito de 539 Líneas con Queries Secuenciales

- **Categoría:** Performance
- **Gravedad:** 🟡 Media
- **Principio violado:** Single Responsibility, Efficient Data Fetching

**Diagnóstico:**  
`dashboard/page.tsx` (539 líneas) hace **4 queries secuenciales** a Supabase. Las queries 2-4 podrían paralelizarse con `Promise.all`.

**Impacto:**  
TTFB alto: el usuario espera a que las 4 queries se completen secuencialmente.

---

### 🚩 09 — Redirect URL Incorrecta en Forgot Password

- **Categoría:** Seguridad + Lógica
- **Gravedad:** 🟡 Media
- **Principio violado:** Correct Configuration

**Diagnóstico:**  
En `auth/actions.ts`, la redirect URL usa `NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')` que genera una URL inválida como `https://dnqtxzqntuvclvtrojsb/auth/callback`. Debería usar la URL del frontend.

---

### 🚩 10 — Falta de Security Headers en Producción

- **Categoría:** Seguridad
- **Gravedad:** 🟡 Media
- **Principio violado:** OWASP A05:2021 - Security Misconfiguration

**Diagnóstico:**  
`next.config.ts` no define ningún security header: sin CSP, sin X-Frame-Options, sin HSTS, sin Referrer-Policy, sin Permissions-Policy.

---

### 🚩 11 — Typo Consistente: `genral_status` en vez de `general_status`

- **Categoría:** Limpieza
- **Gravedad:** 🟢 Baja
- **Diagnóstico:** La columna `genral_status` se usa en todo el codebase. Es un typo propagado en schemas, actions, utils, y componentes.

---

### 🚩 12 — `scheduling-utils.ts`: 727 Líneas Sin Tests

- **Categoría:** Lógica + Limpieza
- **Gravedad:** 🟠 Alta
- **Principio violado:** Testability, Single Responsibility

**Diagnóstico:**  
El módulo más crítico del sistema (planificación de producción CNC) no tiene cobertura de tests. No existe framework de testing en `package.json`.

---

### 🚩 13 — `updateQuote` Delete-and-Reinsert Pattern (No Transaccional)

- **Categoría:** Lógica
- **Gravedad:** 🟡 Media
- **Principio violado:** Atomicity (ACID)

**Diagnóstico:**  
`updateQuote` primero hace DELETE de todos los items y luego INSERT de los nuevos. Si el INSERT falla, los items se pierden. No hay transacción ni rollback.

---

## 3. LISTA DE VERIFICACIÓN POST-AUDITORÍA

### 🔴 Prioridad Crítica (Semana 1)
- [ ] Crear helper `verifyAuth(supabase, allowedRoles[])` y aplicarlo a todas las server actions
- [ ] Hacer obligatoria la verificación del webhook token
- [ ] Corregir la redirect URL en `forgotPassword`
- [ ] Agregar schemas Zod para toda función que acepte `any`

### 🟠 Prioridad Alta (Semana 2-3)
- [ ] Agregar security headers en `next.config.ts`
- [ ] Regenerar tipos de Supabase y eliminar casteos `as any`
- [ ] Arreglar tipo de `server.ts` — eliminar `| any`
- [ ] Reemplazar `console.log/error/warn` directos por `logger`
- [ ] Paralelizar queries del dashboard con `Promise.all`
- [ ] Evaluar mover roles/is_approved a JWT claims
- [ ] Hacer `updateQuote` transaccional
- [ ] Configurar `SUPABASE_WEBHOOK_SECRET` como variable requerida

### 🟡 Prioridad Media (Mes 1)
- [ ] Migrar de `moment.js` a `date-fns`
- [ ] Agregar framework de testing (Vitest) con tests para `scheduling-utils.ts`
- [ ] Descomponer `dashboard/page.tsx` en sub-componentes con Suspense
- [ ] Integrar Sentry (el TODO en `logger.ts` lleva pendiente)
- [ ] Agregar rate limiting en el webhook

### 🟢 Prioridad Baja (Mantenimiento)
- [ ] Renombrar `genral_status` → `general_status` (migration + codebase rename)
- [ ] Eliminar `build.log`, `build_output.txt`, `build_output_v2.txt` del repo
- [ ] Eliminar código comentado en `auth/actions.ts` (líneas 49-60)
- [ ] Eliminar `imports/inventario.csv` del repo (85KB de datos)
