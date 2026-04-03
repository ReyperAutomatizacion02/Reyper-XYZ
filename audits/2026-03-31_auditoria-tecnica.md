# REPORTE DE AUDITORÍA TÉCNICA — REYPER XYZ

**Fecha:** 2026-03-31 | **Auditor:** Senior Full-Stack Architect & Lead Security Auditor | **Modelo:** Claude Sonnet 4.6
**Última actualización:** 2026-04-03 — Cierre de auditoría + decisiones de simplificación

---

## 1. RESUMEN DE SALUD

**Calificación General al momento de la auditoría: 5.5 / 10**
**Calificación tras correcciones (sesión 2026-03-31): 7.8 / 10**
**Calificación final tras cierre completo (2026-04-03): 9.0 / 10**

La arquitectura base es correcta (Next.js App Router, Supabase, Zod validations, separación de concerns). Los 16 hallazgos han sido tratados: 13 resueltos en código/configuración, 1 diferido conscientemente (Sentry — sin usuarios en producción aún), 1 investigado sin acción requerida, y 1 pendiente de acción manual irrealizable desde código (rotación de credenciales).

**Top 3 Riesgos Críticos (al momento de la auditoría):**

1. ~~**Server Actions de admin sin verificación de autorización**~~ → ✅ RESUELTO
2. ~~**Inyección de campos arbitrarios a la base de datos**~~ → ✅ RESUELTO
3. **Credenciales de producción reales en `.env.local`** → ⚠️ PENDIENTE (acción manual requerida: rotar credenciales)

---

## 2. DESGLOSE DE HALLAZGOS

---

### ✅ ~~SERVER ACTIONS DE ADMIN SIN VERIFICACIÓN DE AUTORIZACIÓN~~

- **Categoría:** Seguridad
- **Gravedad:** Crítica
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `app/dashboard/admin-panel/actions.ts`
- **Diagnóstico:** Las funciones `getPendingUsers()`, `getApprovedUsers()` y `getEmployees()` no llamaban a `requireRole` ni `requireAuth`. Cualquier usuario autenticado (incluso uno `is_approved: false`) podía invocar estas Server Actions y extraer el listado completo de usuarios del sistema. Viola OWASP A01:2021 (Broken Access Control) y el principio de defensa en profundidad.
- **Impacto:** Exfiltración de PII de todos los empleados registrados. Un usuario rechazado o con rol básico podía enumerar a todos los usuarios y sus roles.
- **Corrección aplicada:** Añadida verificación `supabase.auth.getUser()` + `verifyAdmin(supabase, user.id)` al inicio de las tres funciones.

---

### ✅ ~~BYPASS DE VALIDACIÓN ZOD — FIELD INJECTION EN BASE DE DATOS~~

- **Categoría:** Seguridad
- **Gravedad:** Crítica
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `app/dashboard/ventas/actions.ts`
- **Diagnóstico:** Las funciones `updateProject()` y `updateProductionOrder()` validaban los datos con Zod (`parsedData`), pero después ignoraban el resultado validado y pasaban el argumento **crudo `data`** directamente al `.update()` de Supabase. Un atacante podía inyectar campos arbitrarios que Supabase escribiría si la columna existía. Viola OWASP A03:2021 (Injection).
- **Impacto:** Manipulación directa de campos no permitidos en `projects` y `production_orders`.
- **Corrección aplicada:** Ambas funciones ahora desestructuran `parsedData.data` para extraer `{ id: validId, ...safeFields }` y pasan únicamente `safeFields` al `.update()`.

---

### 🚩 SERVICE ROLE KEY EXPUESTO Y USO INEFICIENTE

- **Categoría:** Seguridad
- **Gravedad:** Crítica
- **Estado:** ⚠️ PARCIALMENTE PENDIENTE — requiere acción manual
- **Archivo:** `.env.local`, `lib/storage-utils.ts`
- **Diagnóstico:** El `SUPABASE_SERVICE_ROLE_KEY` bypasea completamente las Row Level Security policies de Supabase. Este key da acceso de superusuario a toda la base de datos. En `storage-utils.ts` se creaba un cliente admin en cada invocación de la función, sin ningún wrapper de singleton.
- **Impacto:** Compromiso total de la base de datos si el key se filtra. Pérdida de datos, escalada de privilegios.
- **Pendiente:** Rotar manualmente las siguientes credenciales desde sus respectivas consolas y actualizar `.env.local` + variables de entorno en producción:
    - `SUPABASE_SERVICE_ROLE_KEY` → Supabase Dashboard → Project Settings → API
    - `NOTION_TOKEN` → Notion → My Integrations
    - `GOOGLE_API_KEY` → Google Cloud Console → Credentials
- **Nota:** El patrón singleton de cliente admin queda como mejora opcional de arquitectura; la prioridad es la rotación de credenciales.

---

### ✅ ~~URL DE RESET DE CONTRASEÑA CONSTRUIDA INCORRECTAMENTE~~

- **Categoría:** Seguridad / Lógica
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `app/auth/actions.ts`
- **Diagnóstico:** El `redirectTo` para el reset de contraseña estaba construido como `NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '')`, generando una URL como `https://dnqtxzqntuvclvtrojsb` (sin dominio válido).
- **Impacto:** La función "olvidé mi contraseña" estaba rota en producción.
- **Corrección aplicada:** Ahora usa `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account/update-password`. Se añadió `NEXT_PUBLIC_SITE_URL=http://localhost:3000` al `.env.local`. **Acción pendiente:** cambiar este valor a la URL real de producción en el panel de hosting antes de desplegar.

---

### ✅ ~~AUSENCIA DE CONTENT-SECURITY-POLICY (CSP)~~

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `next.config.ts`
- **Diagnóstico:** El config implementaba varios headers de seguridad pero no incluía `Content-Security-Policy`. Sin CSP, el navegador permitía cargar scripts de cualquier origen. Viola OWASP A05:2021.
- **Impacto:** Explotación de cualquier vulnerabilidad XSS. Robo de sesiones.
- **Corrección aplicada:** Añadido header `Content-Security-Policy` con directivas para `default-src`, `script-src`, `style-src`, `connect-src` (incluyendo Supabase y Google APIs), `img-src`, `font-src`, `frame-src`, `frame-ancestors`, `object-src` y `base-uri`.

---

### ✅ ~~API ROUTES EXCLUIDAS TOTALMENTE DEL MIDDLEWARE DE AUTH~~

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `middleware.ts`
- **Diagnóstico:** Todas las rutas `/api/*` eran excluidas del sistema de autenticación del middleware mediante una excepción genérica. Cualquier ruta API futura olvidada sin auth quedaría completamente expuesta. Viola el principio de Secure by Default.
- **Corrección aplicada:** Eliminada la excepción `isApiRoute` genérica. Reemplazada por `API_PUBLIC_ROUTES: string[] = []` (allowlist explícita vacía). Toda ruta `/api/` ahora requiere usuario autenticado por defecto. Para añadir rutas públicas, deben listarse explícitamente en `API_PUBLIC_ROUTES`.

---

### ✅ ~~`.passthrough()` EN SCHEMAS ZOD — INYECCIÓN DE CAMPOS EN BD~~

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `lib/validations/sales.ts`
- **Diagnóstico:** `SaveQuoteSchema` y `UpdateQuoteSchema` usaban `.passthrough()`, lo que significaba que Zod no filtraba campos desconocidos. Un atacante podía enviar campos adicionales que se escribirían en la BD. Viola el principio de validación estricta (allowlist).
- **Corrección aplicada:** Cambiado `.passthrough()` a `.strict()` en `SaveQuoteSchema` y `UpdateQuoteSchema`.

---

### ✅ ~~SIN RATE LIMITING EN ENDPOINTS DE AUTENTICACIÓN~~

- **Categoría:** Seguridad
- **Gravedad:** Alta
- **Estado:** RESUELTO — 2026-04-03
- **Archivo:** Supabase Dashboard → Authentication → Rate Limits
- **Diagnóstico:** Las funciones `login()`, `signup()` y `forgotPassword()` no implementaban ningún mecanismo de rate limiting. Un ataque de credential stuffing o enumeración de emails tenía ruta libre. Viola OWASP A07:2021.
- **Corrección aplicada:** Rate limiting configurado directamente en Supabase Auth (sin dependencias externas): **Sign-ups and sign-ins reducido de 30 → 5 requests/5 min por IP**. Cubre el riesgo de brute force para este sistema interno sin añadir infraestructura.
- **Decisión:** Se evaluó implementar `@upstash/ratelimit` en `middleware.ts` pero se descartó — Supabase Auth nativo es suficiente para el caso de uso actual (sistema interno, usuarios conocidos). No se añaden dependencias externas.

---

### ✅ ~~`verifyAdmin` CON TIPO `any` — BYPASS DE TYPE SAFETY~~

- **Categoría:** Seguridad / Limpieza
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `app/dashboard/admin-panel/actions.ts`
- **Diagnóstico:** `verifyAdmin(supabase: any, userId: string)` usaba `any`, eliminando toda verificación de tipo en compilación. Tampoco manejaba errores de red en la query.
- **Corrección aplicada:** Tipado cambiado a `SupabaseClient` (importado de `@supabase/supabase-js`). Añadido manejo de `error` en la destructuración de la query: `if (error || !callerProfile?.roles?.includes("admin"))`.

---

### ✅ ~~CANAL REALTIME CON `Math.random()` — PROLIFERACIÓN DE SUSCRIPCIONES~~

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `hooks/use-realtime.ts`
- **Diagnóstico:** El canal se nombraba con `Math.random()`, garantizando que cada mount del componente creaba un canal nuevo. En React Strict Mode (activo), los efectos se ejecutaban dos veces, duplicando las suscripciones.
- **Impacto:** Múltiples conexiones WebSocket activas. Mensajes duplicados. Sobrecarga en Supabase Realtime.
- **Corrección aplicada:** Canal ahora usa nombre determinístico `realtime_${table}_${event}`, eliminando el sufijo aleatorio.

---

### ✅ ~~N+1 QUERY EN ELIMINACIÓN DE ARCHIVOS DE STORAGE~~

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `lib/storage-utils.ts`
- **Diagnóstico:** Los archivos se eliminaban uno por uno en un loop `for...of`, haciendo una request HTTP a Supabase Storage por cada archivo.
- **Corrección aplicada:** Eliminado el loop. Ahora se pasan todos los paths en una sola llamada `supabaseAdmin.storage.from("quotes").remove(filesToRemove)`.

---

### ✅ ~~`getFilterOptions()` — FULL TABLE SCAN PARA VALORES ÚNICOS~~

- **Categoría:** Performance
- **Gravedad:** Media
- **Estado:** RESUELTO — 2026-04-03
- **Archivo:** `app/dashboard/ventas/actions.ts`
- **Diagnóstico:** Se traían todos los proyectos activos para deduplicar en memoria con `new Set()`. Con escala, esto carga cientos/miles de rows en RAM del servidor solo para producir listas de filtros.
- **Corrección aplicada:** Creadas dos funciones RPC en `supabase/migrations/20260403_filter_options_rpcs.sql` (`get_distinct_active_companies` y `get_distinct_active_requestors`). `getFilterOptions()` ahora invoca ambas RPCs con `Promise.all` en lugar de hacer full scan.
- **Acción requerida:** Ejecutar el archivo SQL en Supabase Dashboard → SQL Editor.

---

### ⚠️ VERSIÓN DE NEXT.JS EN `package.json`

- **Categoría:** Lógica / Mantenimiento
- **Gravedad:** Media
- **Estado:** INVESTIGADO — 2026-03-31
- **Archivo:** `package.json`
- **Diagnóstico original:** La dependencia `"next": "^16.1.6"` generó sospecha ya que no correspondía a ninguna versión pública conocida al momento de la auditoría.
- **Resultado de la investigación:** Verificado con `npm ls next` — `next@16.1.6` está efectivamente instalado y es la versión real en uso. El proyecto funciona correctamente con esta versión. No se toma acción adicional.

---

### ✅ ~~`dotenv` EN DEPENDENCIAS DE PRODUCCIÓN~~

- **Categoría:** Limpieza
- **Gravedad:** Baja
- **Estado:** RESUELTO — 2026-03-31
- **Archivo:** `package.json`
- **Diagnóstico:** `dotenv` estaba en `dependencies` (producción). Next.js maneja las variables de entorno nativamente.
- **Corrección aplicada:** `dotenv` movido a `devDependencies`.

---

### 🔵 SIN INTEGRACIÓN DE MONITOREO EN PRODUCCIÓN

- **Categoría:** Mantenimiento
- **Gravedad:** Baja
- **Estado:** DIFERIDO — 2026-04-03
- **Archivo:** `utils/logger.ts`
- **Diagnóstico:** El logger tiene un TODO para Sentry que no ha sido implementado. En producción, los errores solo llegan a `console.error()`. No hay observabilidad real.
- **Decisión:** Se evaluó integrar `@sentry/nextjs` pero se difirió conscientemente. El sistema aún no tiene suficiente carga de usuarios en producción que justifique la infraestructura adicional. El TODO en `utils/logger.ts` documenta el punto de integración cuando sea necesario.
- **Cuando retomar:** Al tener usuarios reales en producción y necesitar visibilidad de errores sin reporte manual.

---

### ✅ ~~AUDITORÍA DE PERMISOS RLS EN `user_profiles`~~

- **Categoría:** Seguridad
- **Gravedad:** Baja
- **Estado:** VERIFICADO Y CERRADO — 2026-04-03
- **Archivo:** `supabase/user_profiles.sql`
- **Diagnóstico original:** Verificar que el anon key no pueda hacer `SELECT *` sin filtro de `id = auth.uid()`.
- **Resultado de la verificación:** Las políticas SELECT están declaradas `TO authenticated`, lo que excluye al rol `anon` por completo. Usuarios autenticados solo pueden leer su propio perfil (`USING (auth.uid() = id)`). Admins leen todos los perfiles vía `is_admin()`. No se requiere acción adicional.

---

## 3. LISTA DE VERIFICACIÓN POST-AUDITORÍA

### Completados en sesión 2026-03-31 ✅

- [x] **[CRÍTICO]** Añadir `verifyAdmin` en `getPendingUsers()`, `getApprovedUsers()` y `getEmployees()`.
- [x] **[CRÍTICO]** Corregir `updateProject()` y `updateProductionOrder()` para usar `parsedData.data` en el `.update()`.
- [x] **[ALTA]** Corregir la URL de reset de contraseña — `NEXT_PUBLIC_SITE_URL` añadido a `.env.local`.
- [x] **[ALTA]** Añadir `Content-Security-Policy` en `next.config.ts`.
- [x] **[ALTA]** Cambiar `.passthrough()` a `.strict()` en `SaveQuoteSchema` y `UpdateQuoteSchema`.
- [x] **[ALTA]** Eliminar la excepción global de `/api/*` en el middleware; reemplazada por allowlist explícita.
- [x] **[MEDIA]** Tipar correctamente `verifyAdmin(supabase: SupabaseClient)` eliminando `any`.
- [x] **[MEDIA]** Corregir el nombre del canal Realtime — eliminado `Math.random()`.
- [x] **[MEDIA]** Optimizar `deleteQuoteFilesInternal()` — borrado en batch único.
- [x] **[BAJA]** Mover `dotenv` de `dependencies` a `devDependencies`.

### Completados en sesión 2026-04-03 ✅

- [x] **[ALTA]** Rate limiting configurado en Supabase Auth Dashboard → sign-ups/sign-ins reducido a 5 req/5min por IP. Sin dependencias externas.
- [x] **[MEDIA]** Crear RPCs `get_distinct_active_companies` y `get_distinct_active_requestors` en `supabase/migrations/20260403_filter_options_rpcs.sql` y actualizar `getFilterOptions()` para usarlas.
- [x] **[BAJA]** Verificar RLS en `user_profiles` — anon key bloqueado, SELECT restringido a `auth.uid() = id`. Sin acción requerida.

### Diferidos conscientemente 🔵

- **[BAJA] Sentry:** Diferido hasta tener usuarios reales en producción. El TODO en `utils/logger.ts` documenta el punto de integración.

### Pendientes — requieren acción manual ⚠️

- [ ] **[BAJA]** Revocar y regenerar: `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_TOKEN`, `GOOGLE_API_KEY`. Las credenciales nunca fueron commiteadas a git, por lo que el riesgo es bajo. Se recomienda rotar periódicamente como buena práctica.
- [x] **[ANTES DE DESPLEGAR]** Configurar `NEXT_PUBLIC_SITE_URL` para producción — 2026-04-03:
    1. **Vercel** → proyecto → Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL=https://tu-dominio.com` ✅
    2. **Supabase** → Authentication → URL Configuration → Redirect URLs → `https://tu-dominio.com/auth/callback` ✅
- [x] **[ANTES DE DESPLEGAR]** Ejecutar `supabase/migrations/20260403_filter_options_rpcs.sql` en Supabase Dashboard → SQL Editor — 2026-04-03 ✅

---

## 4. MÉTRICAS DE LA AUDITORÍA

| Categoría     | Crítica | Alta  | Media | Baja  |
| ------------- | ------- | ----- | ----- | ----- |
| Seguridad     | 3       | 4     | 2     | 0     |
| Performance   | 0       | 0     | 3     | 0     |
| Lógica        | 0       | 1     | 1     | 0     |
| Mantenimiento | 0       | 0     | 0     | 2     |
| **Total**     | **3**   | **5** | **6** | **2** |

**Total de hallazgos: 16**

### Estado de resolución final (2026-04-03)

| Estado                                 | Cantidad | Porcentaje |
| -------------------------------------- | -------- | ---------- |
| ✅ Resueltos en código / configuración | 13       | 81.25%     |
| 🔵 Diferido conscientemente            | 1        | 6.25%      |
| ⚠️ Investigado / Sin acción requerida  | 1        | 6.25%      |
| 🚩 Pendiente (solo acción manual)      | 1        | 6.25%      |

**Diferido:** Sentry — sin usuarios reales en producción aún; el punto de integración está documentado en `utils/logger.ts`.
**Único hallazgo irresoluble desde código:** Rotación de credenciales de producción expuestas en `.env.local` — requiere acceso a consolas externas (Supabase, Notion, Google Cloud).
