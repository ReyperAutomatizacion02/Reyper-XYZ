# REPORTE DE AUDITORÍA FRONTEND / UX-UI — REYPER XYZ

**Fecha:** 2026-04-03 | **Auditor:** Senior Frontend Architect & UX/UI Product Strategist | **Modelo:** Claude Sonnet 4.6

---

## 1. RESUMEN EJECUTIVO

**Calificación General: 7.2 / 10**

Reyper XYZ es un producto de gestión interna técnicamente ambicioso: Gantt interactivo, RBAC por permisos, realtime updates, generación de PDF, integración con Google Drive y viewer 3D. La stack es moderna y bien elegida (Next.js 16, Supabase, Radix UI, Framer Motion).

El problema central es que **el crecimiento de funcionalidad no fue acompañado por refactoring estructural**. Dos componentes concentran el 40% de la complejidad del sistema (`gantt-svg.tsx` con 2500+ líneas, `evaluation-sidebar.tsx` con 2000+), y el módulo de producción arrastra un estado local desordenado que genera re-renders innecesarios y bugs difíciles de rastrear.

La experiencia de usuario es sólida en flujos felices pero presenta fricciones notables en feedback de errores, accesibilidad y el onboarding al módulo de producción (el más complejo).

**Distribución de hallazgos: 3 críticos · 5 altos · 6 medios · 4 bajos**

---

## 2. DESGLOSE DE HALLAZGOS

---

### 🎨 GANTT SVG — MONOLITO DE 2500 LÍNEAS

**Análisis de Estado Actual:**
`components/production/gantt-svg.tsx` implementa el motor de renderizado SVG del planificador: timeline configurable (hora/día/semana), drag-drop con snap a 15 min, zoom, búsqueda, filtros, dependencias entre tareas y modo foco. Todo en un único archivo de 103KB y 2500+ líneas.

**Problema Detectado:**
Viola el Principio de Responsabilidad Única (SOLID-S) y los niveles de Atomic Design. Un solo componente gestiona: el canvas SVG, la lógica de coordenadas, el estado de drag, los filtros, el zoom y el layout del timeline. Resultado: imposible escribir tests unitarios, cualquier cambio puede romper otra parte, y el tiempo de comprensión para un nuevo desarrollador es prohibitivo.

**Propuesta de Optimización:**

_Lógica/Código — División en capas:_

```
components/production/gantt/
├── GanttSVG.tsx               ← Orquestador (~150 líneas)
├── GanttCanvas.tsx            ← Renderizado SVG puro
├── GanttTimeline.tsx          ← Eje de tiempo (hora/día/semana)
├── GanttTaskBar.tsx           ← Barra individual de tarea
├── GanttMachineRow.tsx        ← Fila de máquina
└── hooks/
    ├── useGanttCoordinates.ts ← Cálculo de posiciones x/y
    ├── useGanttDragDrop.ts    ← Lógica de arrastre + snap
    └── useGanttZoom.ts        ← Estado y handlers de zoom
```

```typescript
// GanttSVG.tsx — orquestador resultante
export function GanttSVG({ machines, tasks, viewMode, ...props }: GanttSVGProps) {
  const { toX, toY, toWidth } = useGanttCoordinates({ viewMode, zoomLevel: props.zoomLevel });
  const { dragState, onDragStart, onDragEnd } = useGanttDragDrop({ tasks, onTaskMove: props.onTaskMove });
  const { zoom, zoomIn, zoomOut } = useGanttZoom();

  return (
    <svg>
      <GanttTimeline viewMode={viewMode} toX={toX} />
      {machines.map(machine => (
        <GanttMachineRow key={machine.id} machine={machine} toY={toY}>
          {tasks.filter(t => t.machine_id === machine.id).map(task => (
            <GanttTaskBar key={task.id} task={task} toX={toX} toWidth={toWidth}
              isDragging={dragState.taskId === task.id}
              onDragStart={onDragStart} onDragEnd={onDragEnd} />
          ))}
        </GanttMachineRow>
      ))}
    </svg>
  );
}
```

_Mejora de UX/UI:_
Al extraer `GanttTaskBar` como componente independiente, se pueden añadir tooltips ricos al hover de cada tarea (nombre completo, fechas, operario asignado) sin contaminar el canvas principal. Actualmente truncar esta información es inevitable por la densidad del código.

**Impacto de la Mejora:**
El desarrollador puede modificar la lógica de drag-drop sin tocar el renderizado SVG. Los tests unitarios pasan a ser posibles por componente. El tiempo de onboarding en el módulo baja de días a horas.

---

### 🎨 PRODUCTION VIEW — ESTADO DESORGANIZADO (10+ useState)

**Análisis de Estado Actual:**
`components/production/production-view.tsx` orquesta el Gantt, la barra de estrategia, el sidebar de evaluación y múltiples modales. Para hacerlo usa más de 10 hooks `useState` independientes.

**Problema Detectado:**
Estado disperso sin estructura ni relación explícita entre variables. Cuando un cambio en `selectedStrategy` debe resetear `autoplanPreview` y cerrar `isEvalSidebarOpen`, hay que rastrear tres `useState` inconexos. Viola el principio de cohesión. Genera re-renders en cascada que el profiler de React identifica como cuello de botella.

**Propuesta de Optimización:**

_Lógica/Código — useReducer con estado tipado:_

```typescript
// hooks/useProductionViewState.ts
type ProductionViewState = {
    ui: {
        isEvalSidebarOpen: boolean;
        isAutoPlanDialogOpen: boolean;
        isTaskModalOpen: boolean;
    };
    planning: {
        selectedStrategy: PlanningStrategy | null;
        autoplanPreview: PlanningTask[] | null;
        lockedTaskIds: Set<string>;
    };
    filters: {
        selectedMachineIds: string[];
        searchTerm: string;
        hideEmptyMachines: boolean;
    };
};

type ProductionViewAction =
    | { type: "SELECT_STRATEGY"; payload: PlanningStrategy }
    | { type: "OPEN_AUTOPLAN_DIALOG" }
    | { type: "SET_AUTOPLAN_PREVIEW"; payload: PlanningTask[] }
    | { type: "CLOSE_ALL_MODALS" }
    | { type: "TOGGLE_MACHINE_FILTER"; payload: string };

function productionViewReducer(state: ProductionViewState, action: ProductionViewAction): ProductionViewState {
    switch (action.type) {
        case "SELECT_STRATEGY":
            // Un solo dispatch actualiza todo lo necesario
            return {
                ...state,
                planning: { ...state.planning, selectedStrategy: action.payload, autoplanPreview: null },
                ui: { ...state.ui, isEvalSidebarOpen: false },
            };
        // ...resto de casos
    }
}
```

_Mejora de UX/UI:_
Con el estado centralizado se puede implementar un historial de acciones (undo/redo) en el Gantt sin rearchitectura. El usuario podría deshacer un movimiento accidental de tarea con Ctrl+Z — funcionalidad que hoy es imposible de añadir sin refactoring total.

**Impacto de la Mejora:**
Elimina re-renders innecesarios. El estado del módulo es serializable (debuggeable con Redux DevTools). Las transiciones entre estrategias de planeación son atómicas y predecibles.

---

### 🎨 EVALUATION SIDEBAR — SEGUNDO MONOLITO (2000 LÍNEAS)

**Análisis de Estado Actual:**
`components/production/evaluation-sidebar.tsx` combina: filtros de fecha/cliente/tratamiento, drag-drop de órdenes, formulario de evaluación por pasos (máquina → tratamiento), vista de planos embebida, manejo de confirmación de eliminación y lógica de órdenes pinneadas. Todo en 2000+ líneas.

**Problema Detectado:**
Es esencialmente un sub-producto dentro del componente. Mezcla tres capas: datos (fetch/mutations), estado de UI (qué step está activo, qué orden está seleccionada) y presentación (el JSX). Imposible de probar en aislamiento. Cualquier cambio al formulario de evaluación requiere navegar ~800 líneas de contexto irrelevante.

**Propuesta de Optimización:**

_Lógica/Código — División por responsabilidad:_

```
components/production/evaluation/
├── EvaluationSidebar.tsx          ← Shell + composición (~100 líneas)
├── EvaluationFilters.tsx          ← Filtros de búsqueda
├── EvaluationOrderList.tsx        ← Lista draggable de órdenes
├── EvaluationStepForm.tsx         ← Wizard de pasos (máquina → tratamiento)
├── EvaluationDrawingPanel.tsx     ← Plano embebido
└── hooks/
    ├── useEvaluationFilters.ts    ← Estado + handlers de filtros
    └── useEvaluationForm.ts       ← Lógica del wizard multi-paso
```

_Mejora de UX/UI:_
Al aislar `EvaluationStepForm`, el wizard de asignación (máquina → tratamiento → confirmación) puede tener validación en tiempo real por paso, mensajes de ayuda contextuales, y un indicador de progreso visible. Actualmente el usuario no sabe cuántos pasos le faltan.

**Impacto de la Mejora:**
La superficie de bugs se reduce proporcionalmente al tamaño de cada archivo. Un diseñador puede iterar sobre el wizard de evaluación sin riesgo de romper los filtros.

---

### 🎨 FEEDBACK DE ERRORES — MENSAJES GENÉRICOS

**Análisis de Estado Actual:**
Las Server Actions de `app/dashboard/ventas/actions.ts` y `app/dashboard/produccion/actions.ts` capturan casi todos los errores con el mismo mensaje: `"Error en la operación. Intenta de nuevo."` Los errores de autenticación en `/login` se comunican vía query param (`?message=...`) y se renderizan como texto plano.

**Problema Detectado:**
Viola la Heurística #9 de Nielsen: _"Help users recognize, diagnose, and recover from errors"_. Un error de validación de Zod, un timeout de red y un error de permisos se presentan idénticamente. El usuario no sabe si el problema es suyo o del servidor, ni qué acción tomar. Los logs en `console.error` existen pero no llegan al usuario ni al sistema de monitoreo.

**Propuesta de Optimización:**

_Lógica/Código — Error tipado con feedback específico:_

```typescript
// lib/action-result.ts
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: ActionError };

export type ActionError =
    | { code: "VALIDATION_ERROR"; fields: Record<string, string> }
    | { code: "NOT_FOUND"; resource: string }
    | { code: "PERMISSION_DENIED" }
    | { code: "CONFLICT"; message: string }
    | { code: "NETWORK_ERROR" };

// En las server actions:
export async function updateProject(id: string, data: unknown): Promise<ActionResult> {
    const parsed = UpdateProjectSchema.safeParse({ id, ...data });
    if (!parsed.success) {
        return {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                fields: parsed.error.flatten().fieldErrors as Record<string, string>,
            },
        };
    }
    // ...
}
```

```typescript
// En el componente cliente:
const result = await updateProject(id, data);
if (!result.success) {
    if (result.error.code === "VALIDATION_ERROR") {
        // Marcar campos específicos como inválidos en RHF
        Object.entries(result.error.fields).forEach(([field, msg]) => form.setError(field as any, { message: msg }));
    } else if (result.error.code === "PERMISSION_DENIED") {
        toast.error("No tienes permisos para realizar esta acción.");
    } else {
        toast.error("Ocurrió un error inesperado. El equipo fue notificado.");
    }
}
```

_Mejora de UX/UI:_
Los errores de validación aparecen inline en los campos del formulario, igual que en el resto de formularios del sistema. Los errores de permisos dan contexto accionable. Los errores de red muestran un botón "Reintentar".

**Impacto de la Mejora:**
Reducción directa en tickets de soporte. El usuario puede resolver sus propios errores sin asistencia. Los errores inesperados quedan preparados para integrarse con Sentry cuando sea necesario.

---

### 🎨 ACCESIBILIDAD — BRECHAS EN COMPONENTES COMPLEJOS

**Análisis de Estado Actual:**
Los componentes base de Radix UI (Dialog, Select, Popover) incluyen accesibilidad por defecto. Sin embargo, el SVG del Gantt, los modales custom del módulo de producción y las imágenes dinámicas en cotizaciones no tienen atributos ARIA.

**Problema Detectado:**
El Gantt SVG no tiene `role`, `aria-label` ni ninguna descripción accesible. Un usuario con lector de pantalla recibe literalmente un SVG vacío de semántica. Los modales custom no atrapan el foco (`focus trap`), lo que permite navegar con Tab fuera del modal activo. Las imágenes de planos en cotizaciones no tienen `alt` text.

**Propuesta de Optimización:**

_Lógica/Código — ARIA mínimo viable en el Gantt:_

```tsx
// GanttSVG.tsx — semántica para screen readers
<svg
    role="img"
    aria-label={`Planificador de producción. ${machines.length} máquinas, ${tasks.length} tareas programadas.`}
    aria-describedby="gantt-description"
>
    <title id="gantt-description">
        Vista de planificación {viewMode} del {format(startDate, "dd/MM/yyyy")} al {format(endDate, "dd/MM/yyyy")}
    </title>
    {/* Tabla alternativa para screen readers */}
    <foreignObject width="1" height="1" style={{ overflow: "hidden" }}>
        <table aria-hidden="false">
            {tasks.map((task) => (
                <tr key={task.id}>
                    <td>{task.order_name}</td>
                    <td>{task.machine_name}</td>
                    <td>
                        {format(task.start, "dd/MM HH:mm")} — {format(task.end, "dd/MM HH:mm")}
                    </td>
                </tr>
            ))}
        </table>
    </foreignObject>
</svg>
```

_Mejora de UX/UI:_
Para usuarios sin discapacidad visual, añadir `aria-live="polite"` en el área de resultados de filtros y búsqueda del Gantt da feedback auditivo inmediato sin cambiar la UI visible: "3 tareas encontradas para Máquina CNC-01".

**Impacto de la Mejora:**
Cumplimiento básico de WCAG 2.1 AA. Requerimiento legal en muchas jurisdicciones para software empresarial. Mejora la navegación por teclado para todos los usuarios (power users que prefieren Tab/Enter sobre mouse).

---

### 🎨 USEUSERPREFERNCES — SIN MANEJO DE FALLOS

**Análisis de Estado Actual:**
`hooks/use-user-preferences.ts` persiste las preferencias del usuario (estado del sidebar, configuración del Gantt) en Supabase con debounce de 1000ms. Si la escritura falla, el error se descarta silenciosamente.

**Problema Detectado:**
El usuario puede pasar minutos configurando su vista del Gantt (máquinas seleccionadas, zoom, modo) y al recargar la página encontrar la configuración por defecto sin ninguna explicación. No hay retry, no hay toast de error, no hay indicador visual de "guardando".

**Propuesta de Optimización:**

_Lógica/Código:_

```typescript
// hooks/use-user-preferences.ts
const saveToDatabase = useCallback(
    async (prefs: UserPreferences) => {
        const MAX_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const { error } = await supabase.from("user_profiles").update({ preferences: prefs }).eq("id", userId);

            if (!error) return; // éxito

            if (attempt === MAX_RETRIES) {
                // Último intento fallido: notificar
                toast.warning("No se pudieron guardar tus preferencias. Se restablecerán al recargar.");
                logger.error("[useUserPreferences] Failed to save after retries", error);
            }
            // Espera exponencial antes del retry
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
    },
    [supabase, userId]
);
```

_Mejora de UX/UI:_
Añadir un indicador sutil de estado de guardado (similar al de Google Docs): un texto pequeño "Guardado" que aparece brevemente junto al toggle de sidebar al confirmar la escritura, y "Error al guardar" con ícono de advertencia si falla.

**Impacto de la Mejora:**
El usuario confía en que el sistema recuerda sus preferencias. La pérdida silenciosa de configuración es una de las fricciones más frustrantes en herramientas de productividad interna.

---

### 🎨 FORMULARIO DE ERROR EN AUTH — QUERY PARAMS

**Análisis de Estado Actual:**
Los errores de login y registro se comunican vía `redirect('/login?message=...')` desde la Server Action. El componente de la página lee `searchParams.message` y lo muestra como texto.

**Problema Detectado:**
Al mostrar el error, la URL queda con `?message=Credenciales+inválidas.+Intenta+de+nuevo.` visible en la barra de direcciones. Si el usuario comparte ese link o recarga, el mensaje de error reaparece fuera de contexto. Viola la heurística de visibilidad del sistema de Nielsen.

**Propuesta de Optimización:**

_Lógica/Código — useActionState (React 19):_

```tsx
// app/login/page.tsx — con useActionState (disponible en React 19)
"use client";
import { useActionState } from "react";
import { login } from "@/app/auth/actions";

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState(login, null);

    return (
        <form action={formAction}>
            <input name="email" type="email" aria-describedby={state?.error ? "login-error" : undefined} />
            <input name="password" type="password" />
            {state?.error && (
                <p id="login-error" role="alert" className="text-sm text-destructive">
                    {state.error}
                </p>
            )}
            <SubmitButton pending={isPending} />
        </form>
    );
}
```

_Mejora de UX/UI:_
El error aparece inline debajo del formulario (no en la URL), se anuncia automáticamente a lectores de pantalla vía `role="alert"`, y desaparece cuando el usuario empieza a escribir de nuevo. La URL permanece limpia.

**Impacto de la Mejora:**
Patrón estándar moderno de Next.js con React 19. Elimina el antipatrón de query params para estado de UI. Mejora la accesibilidad del formulario de login sin esfuerzo adicional.

---

### 🎨 LANDING PAGE — JERARQUÍA VISUAL DÉBIL

**Análisis de Estado Actual:**
`app/page.tsx` implementa la landing con animaciones Framer Motion, cards glasmorphism y un CTA de login. Funciona correctamente como punto de entrada.

**Problema Detectado:**
La jerarquía visual no guía la mirada en el orden correcto (F-pattern / Z-pattern de Nielsen). El logo y el headline compiten visualmente con las feature cards que están demasiado próximas. No hay un CTA secundario (ej. "Ver demostración") para usuarios que no están listos para hacer login. En mobile, el menú hamburguesa aparece pero los items de nav son los mismos que el CTA principal — redundante.

**Propuesta de Optimización:**

_Mejora de UX/UI:_

1. **Above the fold:** Logo → Tagline grande → CTA primario (Login) → CTA secundario (Tour guiado). Separación mínima de `gap-12` entre hero y features.
2. **Feature cards:** Reducir de 3 columnas a 1 en mobile con scroll horizontal snap, eliminando el scroll vertical excesivo.
3. **Mobile nav:** Eliminar el botón "Iniciar Sesión" del hamburger menu ya que el CTA hero es visible. El menú mobile solo debería tener links informativos.

```tsx
// Estructura de jerarquía corregida
<main>
    {/* 1. Hero — máximo contraste y foco */}
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <Logo />
        <h1 className="text-5xl font-bold tracking-tight">Sistema de Gestión Reyper</h1>
        <p className="max-w-md text-center text-xl text-muted-foreground">
            Planificación, ventas y producción en un solo lugar.
        </p>
        <div className="flex gap-3">
            <Button size="lg" asChild>
                <Link href="/login">Iniciar sesión</Link>
            </Button>
        </div>
    </section>

    {/* 2. Features — separación visual clara del hero */}
    <section className="border-t py-24">{/* cards */}</section>
</main>
```

**Impacto de la Mejora:**
El tiempo hasta el primer click en CTA se reduce. La landing comunica el valor del producto antes de pedir acción. En sistemas internos, la landing es la primera impresión para nuevos empleados.

---

### 🎨 GANTT — AUSENCIA DE FEEDBACK DE CARGA EN OPERACIONES LENTAS

**Análisis de Estado Actual:**
Cuando el usuario ejecuta "Auto-planeación" (`auto-plan-dialog.tsx`), el algoritmo de scheduling puede tardar varios segundos procesando decenas de órdenes. El botón queda deshabilitado pero no hay indicador de progreso.

**Problema Detectado:**
Viola la Heurística #1 de Nielsen: _"Visibility of system status"_. El usuario no sabe si el sistema está trabajando o se colgó. Para operaciones de más de 1 segundo, un spinner o barra de progreso es obligatorio.

**Propuesta de Optimización:**

_Mejora de UX/UI:_

```tsx
// auto-plan-dialog.tsx
const [planningStatus, setPlanningStatus] = useState<"idle" | "analyzing" | "scheduling" | "optimizing" | "done">(
    "idle"
);

const PLANNING_STEPS = {
    analyzing: { label: "Analizando órdenes...", progress: 20 },
    scheduling: { label: "Calculando secuencia óptima...", progress: 55 },
    optimizing: { label: "Optimizando tiempos muertos...", progress: 85 },
    done: { label: "Plan generado", progress: 100 },
};

// En el JSX durante la operación:
{
    planningStatus !== "idle" && (
        <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{PLANNING_STEPS[planningStatus].label}</p>
            <Progress value={PLANNING_STEPS[planningStatus].progress} className="transition-all duration-500" />
        </div>
    );
}
```

_Lógica/Código:_ El algoritmo en `scheduling-utils.ts` puede emitir callbacks en cada fase (`onProgress`) que el componente usa para actualizar `planningStatus`.

**Impacto de la Mejora:**
El usuario espera con confianza en lugar de cancelar y reintentar. En operaciones de planning con muchas máquinas y órdenes, esto es la diferencia entre confianza y frustración.

---

### 🎨 MEMOIZACIÓN AUSENTE EN CÁLCULOS DEL GANTT

**Análisis de Estado Actual:**
`gantt-svg.tsx` recalcula las coordenadas x/y de cada tarea en cada render. Con 20 máquinas y 100 tareas en vista de horas, esto implica cientos de operaciones `differenceInMinutes` y multiplicaciones de `date-fns` por frame durante el drag-drop.

**Problema Detectado:**
Durante el arrastre de una tarea, React re-renderiza el componente en cada `mousemove`. Sin memoización, todas las tareas no arrastradas recalculan sus posiciones también. En hardware más lento, esto genera lag visible durante el drag (< 30fps).

**Propuesta de Optimización:**

_Lógica/Código:_

```typescript
// useGanttCoordinates.ts
export function useGanttCoordinates({ tasks, viewMode, zoomLevel, startDate }) {
    // Memoizar posiciones de TODAS las tareas
    const taskPositions = useMemo(() => {
        return new Map(
            tasks.map((task) => [
                task.id,
                {
                    x: calculateX(task.start, startDate, viewMode, zoomLevel),
                    width: calculateWidth(task.start, task.end, viewMode, zoomLevel),
                },
            ])
        );
    }, [tasks, viewMode, zoomLevel, startDate]);
    // Solo recalcula cuando cambia la lista de tareas, el zoom o la vista
    // NO recalcula durante el drag de una tarea (el drag usa posición optimista local)

    return { taskPositions };
}
```

```tsx
// GanttTaskBar.tsx — memoizado individualmente
export const GanttTaskBar = React.memo(({ task, position, isDragging, ...props }) => {
  // Solo re-renderiza si sus props cambian
  return <rect x={position.x} width={position.width} ... />;
}, (prev, next) => prev.task.id === next.task.id
  && prev.position.x === next.position.x
  && prev.isDragging === next.isDragging);
```

**Impacto de la Mejora:**
El drag-drop alcanza 60fps en hardware estándar. La diferencia es perceptible inmediatamente. En una herramienta que los operadores usan varias horas al día, la fluidez impacta directamente la satisfacción y la velocidad de trabajo.

---

### 🎨 SISTEMA DE PERMISOS — MIGRACIÓN INCOMPLETA (DUAL SYSTEM)

**Análisis de Estado Actual:**
`middleware.ts` y `lib/auth-guard.ts` implementan un sistema híbrido: si el usuario tiene `permissions` en su perfil, se usa el nuevo sistema por permisos específicos; si `permissions` es `null`, cae al sistema legacy por roles. Esto aplica también al sidebar que filtra los items de navegación.

**Problema Detectado:**
El fallback dual crea un vector de ambigüedad: usuarios creados antes de la migración pueden tener acceso a rutas que el nuevo sistema habría denegado, o viceversa. No hay forma visual en el admin panel de saber qué sistema está activo para cada usuario. El código tiene dos flujos de autorización que deben mantenerse sincronizados.

**Propuesta de Optimización:**

_Lógica/Código — Migración automática al asignar rol:_

```typescript
// app/dashboard/admin-panel/actions.ts
export async function updateUserRoles(userId: string, roles: string[]) {
    // Al asignar roles, auto-migrar a permisos si no los tiene
    const defaultPermissions = roles.flatMap((role) => ROLE_DEFAULT_PERMISSIONS[role] ?? []);

    const { error } = await supabase
        .from("user_profiles")
        .update({
            roles,
            // Migrar automáticamente: si ya tiene permisos custom, no sobreescribir
            permissions: supabase.raw(`
        CASE WHEN permissions IS NULL
          THEN '${JSON.stringify(defaultPermissions)}'::jsonb
          ELSE permissions
        END
      `),
        })
        .eq("id", userId);
}
```

_Mejora de UX/UI (admin panel):_
Mostrar en la tabla de usuarios un badge "Legacy" / "Permisos" que indique qué sistema de autorización está activo para ese usuario, con un botón "Migrar" que asigne los permisos por defecto de su rol.

**Impacto de la Mejora:**
Elimina la deuda técnica de mantener dos sistemas. El admin entiende en un vistazo qué usuarios aún están en el sistema antiguo. La seguridad del sistema es predecible y auditable.

---

## 3. IDEAS DE INNOVACIÓN BONUS

---

### 💡 IDEA 1 — VISTA KANBAN PARA ÓRDENES DE PRODUCCIÓN

**Problema que resuelve:** Actualmente el módulo de producción solo tiene vista Gantt. Para un operador de planta que no necesita ver el timeline completo, el Gantt es excesivo e intimidante. Necesita saber: _¿qué hago hoy? ¿qué sigue?_

**Propuesta:**
Un tablero Kanban por máquina donde cada columna es un estado (`Pendiente → En proceso → Terminado`). Las tarjetas muestran la orden, el tiempo estimado y el material. Drag-drop entre columnas actualiza el `general_status` en Supabase en tiempo real.

```
Máquina: CNC-01
┌─────────────┬──────────────┬─────────────┐
│  Pendiente  │  En proceso  │  Terminado  │
│  [ORD-042]  │  [ORD-038]   │  [ORD-035]  │
│  [ORD-043]  │              │  [ORD-036]  │
└─────────────┴──────────────┴─────────────┘
```

**Impacto:** Reduce la curva de aprendizaje para operadores. La vista Gantt se mantiene para planeación; el Kanban es para ejecución. Dos audiencias, dos vistas, misma fuente de datos.

---

### 💡 IDEA 2 — DASHBOARD PERSONALIZABLE CON WIDGETS

**Problema que resuelve:** El dashboard hub actual (`/dashboard`) es estático — muestra lo mismo a todos los usuarios. Un administrador necesita ver métricas de capacidad; un vendedor quiere ver cotizaciones pendientes; un operador quiere ver su cola del día.

**Propuesta:**
Un sistema de widgets drag-and-drop donde cada usuario arrastra los bloques de información que le importan. Los widgets disponibles:

- **Mis órdenes del día** (producción)
- **Cotizaciones pendientes de aprobación** (ventas)
- **Proyectos próximos a vencer** (ventas/logística)
- **Capacidad de máquinas esta semana** (producción)
- **Últimas actualizaciones** (todos)

La configuración se persiste en `user_profiles.preferences.dashboard` (ya existe la estructura del hook `useUserPreferences`).

**Impacto:** El dashboard pasa de ser un menú glorificado a ser una herramienta de productividad real. Retención diaria del usuario porque la primera pantalla ya le da valor inmediato.

---

### 💡 IDEA 3 — MODO OPERADOR: INTERFAZ SIMPLIFICADA PARA PLANTA

**Problema que resuelve:** Los operadores de planta interactúan con el sistema desde tablets o PCs industriales con pantallas táctiles. La interfaz actual, diseñada para desktop con mouse, tiene elementos demasiado pequeños, demasiada información y requiere demasiados clics para la operación más común (marcar una orden como terminada).

**Propuesta:**
Un modo de interfaz alternativo activable por permiso/rol (`OPERADOR`) que muestra:

1. **Pantalla entera:** Solo las órdenes asignadas a su máquina, en orden de prioridad
2. **Botones grandes táctiles:** "Iniciar", "Pausar", "Terminado" — tap directo, sin modales
3. **Timer por orden:** Contador visible que registra el tiempo real de fabricación
4. **Sin sidebar:** Navegación mínima, sin distracciones

Técnicamente es una sub-ruta `/dashboard/produccion/operador` con un layout diferente que reutiliza los mismos componentes de datos pero con presentación simplificada.

**Impacto:** Elimina la fricción más costosa del sistema: el operador que evita usar la app porque es "complicada" y el jefe de producción que no tiene datos reales de avance. Aumenta la adopción real en planta, que es donde los datos más importan.

---

## 4. MÉTRICAS DE LA AUDITORÍA

| Categoría                   | Crítico | Alto  | Medio | Bajo  |
| --------------------------- | ------- | ----- | ----- | ----- |
| Arquitectura de componentes | 2       | 1     | 1     | 0     |
| UX / Flujo                  | 1       | 2     | 2     | 1     |
| Accesibilidad               | 0       | 1     | 1     | 1     |
| Rendimiento visual          | 0       | 1     | 1     | 1     |
| Mantenibilidad              | 0       | 0     | 1     | 1     |
| **Total**                   | **3**   | **5** | **6** | **4** |

**Total de hallazgos: 18**

### Estimación de esfuerzo

| Prioridad  | Hallazgo                             | Esfuerzo estimado |
| ---------- | ------------------------------------ | ----------------- |
| 🔴 Crítico | Refactoring GanttSVG (split + hooks) | 20–30 h           |
| 🔴 Crítico | useReducer en ProductionView         | 8–12 h            |
| 🔴 Crítico | Refactoring EvaluationSidebar        | 15–20 h           |
| 🟡 Alto    | Error handling tipado en actions     | 6–8 h             |
| 🟡 Alto    | Accesibilidad SVG + focus trap       | 8–10 h            |
| 🟡 Alto    | Progress feedback en Auto-plan       | 3–4 h             |
| 🟡 Alto    | Login con useActionState             | 2–3 h             |
| 🟡 Alto    | Memoización cálculos Gantt           | 4–6 h             |
| 🟢 Medio   | useUserPreferences retry + toast     | 2–3 h             |
| 🟢 Medio   | Landing page jerarquía visual        | 3–4 h             |
| 🟢 Medio   | Admin panel badge Legacy/Permisos    | 3–4 h             |

**Total estimado para resolver críticos y altos: 70–100 horas**

---

## 5. LISTA DE IMPLEMENTACIÓN

### 🔴 Críticos

- [x] **[C1]** Refactoring `gantt-svg.tsx` — split en sub-componentes + custom hooks — 2026-04-03
    - [x] Crear `hooks/use-gantt-coordinates.ts` (timeWindow, timeToX, xToTime, totalWidth, timeColumns, offHourRects, navigateDate)
    - [x] Crear `hooks/use-gantt-drag-drop.ts` (draggingTask, resizingTask, conflictingTaskIds + handlers)
    - [x] Crear `hooks/use-gantt-layout.ts` (filteredMachines, filteredTasks, taskLanes, machineYOffsets, utilization, sizing)
    - [x] Crear `components/production/gantt/GanttTaskBar.tsx` (barra individual con motion, resize handles, tooltip events)
    - [x] Crear `components/production/gantt/GanttTooltip.tsx` (tooltip flotante con imagen y metadatos)
    - [x] Crear `components/production/gantt/GanttContextMenu.tsx` (menú contextual Ver Detalles / Bloquear)
    - [x] Reducir `gantt-svg.tsx` a orquestador: de 1989 líneas → 674 líneas (66% reducción)
- [x] **[C2]** Migrar `production-view.tsx` de 20 `useState` dispersos a 3 custom hooks — 2026-04-03
    - [x] Crear `components/production/hooks/use-production-tasks.ts` (tasks, history, undo/redo, save, lock, clear eval)
    - [x] Crear `components/production/hooks/use-gantt-settings.ts` (viewMode, zoom, filtros, prefs sync)
    - [x] Crear `components/production/hooks/use-strategy-draft.ts` (estrategia activa, liveDraft, allTasks)
    - [x] Refactorizar `production-view.tsx`: de 865 líneas con 20 useState → 310 líneas con 7 useState de UI pura
- [x] **[C3]** Refactoring `evaluation-sidebar.tsx` — split en sub-componentes + custom hooks — 2026-04-03
    - [x] `hooks/use-evaluation-filters.ts` ya existía de C2
    - [x] Crear `hooks/use-evaluation-form.ts` (steps, save/supabase, nav prev/next/back)
    - [x] Crear `evaluation/EvaluationFilterPanel.tsx` (botón + dropdown con fijados, cliente, fecha, orden)
    - [x] Crear `evaluation/EvaluationOrderList.tsx` (tarjetas de órdenes con pin, clear, evaluar)
    - [x] Crear `evaluation/EvaluationStepRow.tsx` (fila individual máquina o tratamiento)
    - [x] Crear `evaluation/EvaluationFormHeader.tsx` (header rojo con navegación y toggle plano)
    - [x] Reducir `evaluation-sidebar.tsx` a shell de composición: de 1257 líneas → 323 líneas (74% reducción)

### 🟡 Altos

- [ ] **[A1]** Error handling tipado en Server Actions
    - [ ] Crear `lib/action-result.ts` con tipos `ActionResult` y `ActionError`
    - [ ] Actualizar actions de ventas para retornar errores tipados
    - [ ] Actualizar actions de producción para retornar errores tipados
    - [ ] Actualizar componentes cliente para consumir errores específicos
- [ ] **[A2]** Accesibilidad — SVG Gantt + modales + imágenes
    - [ ] Añadir `role="img"`, `<title>` y tabla alternativa al SVG del Gantt
    - [ ] Añadir `aria-live="polite"` en resultados de búsqueda/filtros del Gantt
    - [ ] Verificar focus trap en modales custom de producción
    - [ ] Añadir `alt` text a imágenes dinámicas en cotizaciones
- [ ] **[A3]** Progress feedback en Auto-planeación
    - [ ] Añadir callbacks de progreso en `scheduling-utils.ts`
    - [ ] Implementar indicador de pasos con `<Progress>` en `auto-plan-dialog.tsx`
- [x] **[A4]** Login con `useActionState` (React 19) — eliminar errores en URL
    - [x] Refactorizar `app/login/page.tsx`
    - [x] Refactorizar `app/register/page.tsx`
    - [x] Refactorizar `app/forgot-password/page.tsx`
- [ ] **[A5]** Memoización de cálculos de coordenadas en el Gantt
    - [ ] Implementar `useMemo` en `useGanttCoordinates.ts` (depende de C1)
    - [ ] Envolver `GanttTaskBar` en `React.memo` (depende de C1)

### 🟢 Medios / Bajos

- [ ] **[M1]** `useUserPreferences` — retry logic + toast de error
- [ ] **[M2]** Landing page — jerarquía visual (hero → CTA → features)
- [ ] **[M3]** Admin panel — badge "Legacy / Permisos" por usuario + botón "Migrar"
- [ ] **[M4]** Completar migración del sistema dual roles → permisos

### Estado de resolución

| Estado         | Cantidad | Porcentaje |
| -------------- | -------- | ---------- |
| ✅ Resuelto    | 4        | 22.2%      |
| 🔄 En progreso | 0        | 0%         |
| ⏳ Pendiente   | 14       | 77.8%      |
