# REPORTE DE AUDITORÍA FRONTEND / UX-UI — REYPER XYZ

# Iteración 3: Seguimiento de Evolución

**Fecha:** 2026-04-14 | **Auditor:** Senior Frontend Architect & UX/UI Product Strategist | **Modelo:** Claude Sonnet 4.6
**Auditoría anterior:** [2026-04-03_auditoria-frontend-ux.md](./2026-04-03_auditoria-frontend-ux.md)

---

## 1. RESUMEN EJECUTIVO

**Calificación General: 8.4 / 10** _(anterior: 7.2 / 10 — +1.2 pts)_

En 11 días, el equipo ejecutó una refactorización de alto impacto. Los tres problemas críticos de la auditoría anterior fueron atendidos con seriedad:

- `gantt-svg.tsx`: **2500 → 868 líneas** (−65%). Hooks y sub-componentes extraídos.
- `evaluation-sidebar.tsx`: **2000 → 395 líneas** (−80%). Completamente descompuesto en atomic components.
- `production-view.tsx`: Estado de dominio migrado a 4 hooks dedicados. Solo 6 `useState` de UI local permanecen — apropiados y justificados.

También se cerraron los problemas de feedback de errores (`lib/action-result.ts` tipado), el antipatrón de query params en login (`useActionState`), las preferencias de usuario con retry/SavingState, el Progress en auto-planeación y la base de accesibilidad del Gantt SVG.

**La deuda técnica se redistribuyó:** los monolitos desaparecieron, pero emergieron nuevos patrones problemáticos de menor severidad. Hay un anti-patrón crítico nuevo (`GanttControls` llamado como función) — **ya resuelto (2026-04-14)** —, un segundo monolito formándose (`strategy-toolbar.tsx` con 622 líneas), y el módulo de Almacén debuta sin tipado.

**Distribución de hallazgos: 1 crítico · 3 altos · 4 medios · 3 bajos** | **Resueltos en esta iteración: 1**

---

## 2. REGISTRO DE PROGRESO (vs. Auditoría Anterior)

| Hallazgo Anterior                       | Estado                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| Gantt SVG monolito 2500 líneas          | ✅ **RESUELTO** — 868 líneas, hooks y sub-componentes extraídos |
| ProductionView 10+ useState             | ✅ **RESUELTO** — 4 hooks de dominio, 6 useState de UI local    |
| EvaluationSidebar monolito 2000 líneas  | ✅ **RESUELTO** — 395 líneas + 4 componentes hijos              |
| Feedback de errores genérico            | ✅ **RESUELTO** — `lib/action-result.ts` con tipado completo    |
| Login con query params                  | ✅ **RESUELTO** — `useActionState` de React 19                  |
| useUserPreferences sin manejo de fallos | ✅ **RESUELTO** — retry, SavingState, toast de error            |
| Auto-plan sin feedback de progreso      | ✅ **RESUELTO** — Progress + callback por fase                  |
| Accesibilidad Gantt SVG                 | ✅ **RESUELTO** — `role="img"`, `aria-live`, tabla accesible    |
| GanttTaskBar sin memoización            | ✅ **RESUELTO** — `React.memo` con comparador custom            |

---

## 3. DESGLOSE DE HALLAZGOS

---

### ✅ H-01 · GANTTCONTROLS — COMPONENTE LLAMADO COMO FUNCIÓN [RESUELTO — 2026-04-14]

**Análisis de Estado Actual:**
`GanttControls` tiene hooks internos (`useState`, `useEffect`, `useCallback`) y 666 líneas de JSX. En `production-view.tsx` se invoca como función pura:

```typescript
// production-view.tsx:366 — ANTI-PATRÓN CRÍTICO
const { startControls, endControls } = GanttControls({
    viewMode: settings.viewMode,
    // ... 20+ props
});
```

**Problema Detectado:**
Esto viola la [Regla de los Hooks de React](https://react.dev/reference/rules/rules-of-hooks): los hooks solo pueden llamarse dentro de componentes de función, no desde funciones auxiliares invocadas durante el render de otro componente. Aunque hoy "funciona" porque React no puede detectarlo en todos los casos, el comportamiento es **indefinido** y puede causar bugs silenciosos relacionados con el orden de hooks, especialmente con Strict Mode activo o en actualizaciones de React. Además, los hooks internos de `GanttControls` no tienen su propio ciclo de vida limpio.

**Propuesta de Optimización:**

_Lógica/Código — Convertir a componente real con render props:_

```tsx
// components/production/gantt-controls.tsx — opción A: render props
interface GanttControlsProps {
    // ... mismas props
    renderStart: (controls: React.ReactNode) => React.ReactNode;
    renderEnd: (controls: React.ReactNode) => React.ReactNode;
}

// O mejor aún — opción B: dos componentes focalizados
// GanttStartControls.tsx — viewMode, search, machine filter
// GanttEndControls.tsx   — zoom, fullscreen, settings

// En production-view.tsx:
<GanttSVG
    startControls={
        <GanttStartControls
            viewMode={settings.viewMode}
            onViewModeChange={settings.handleViewModeChange}
            // ...
        />
    }
    endControls={
        <GanttEndControls
            zoomLevel={settings.zoomLevel}
            isFullscreen={isFullscreen}
            // ...
        />
    }
/>;
```

_Mejora de UX/UI:_
Al separar `GanttStartControls` y `GanttEndControls` como componentes propios, cada uno puede tener su propio estado de expansión/colapso en mobile sin contaminar el estado del canvas principal.

**Impacto de la Mejora:**
Elimina un bug latente que podría manifestarse en React 19+ con mayor rigor en la validación de hooks. Es la corrección de mayor prioridad del sprint.

---

### 🎨 H-02 · STRATEGY-TOOLBAR — NUEVO MONOLITO (622 LÍNEAS)

**Análisis de Estado Actual:**
`components/production/strategy-toolbar.tsx` se creó como parte de la refactorización de `production-view.tsx` y acumula 622 líneas mezclando cuatro responsabilidades distintas en un solo archivo.

**Problema Detectado:**
El componente concentra: (1) tabs de estrategia Manual/Ruta Crítica, (2) badge de alertas de planeación con popover de detalle, (3) selector de órdenes incluidas/excluidas con popover de 200+ líneas, y (4) botón de guardado con estado. Repite exactamente el mismo patrón que originó los monolitos de la auditoría anterior. A este ritmo, en 2 semanas superará las 900 líneas.

**Propuesta de Optimización:**

_Lógica/Código — División inmediata:_

```
components/production/strategy/
├── StrategyToolbar.tsx          ← Shell + composición (~80 líneas)
├── StrategyTabs.tsx             ← Manual / Ruta Crítica tabs
├── PlanningAlertsPopover.tsx    ← Badge + popover de alertas
├── OrderSelectionPopover.tsx    ← Selector de órdenes incluidas
└── ToolbarSaveButton.tsx        ← Botón con changedCount + draftCount
```

```tsx
// StrategyToolbar.tsx resultante — solo composición
export function StrategyToolbar(props: StrategyToolbarProps) {
    return (
        <div className="flex items-center gap-2 border-b px-4 py-2">
            <StrategyTabs activeStrategy={props.activeStrategy} onStrategyChange={props.onStrategyChange} />
            <PlanningAlertsPopover alerts={props.planningAlerts} onLocateTask={props.onLocateTask} />
            <OrderSelectionPopover
                orders={props.orders}
                eligibleOrders={props.eligibleOrders}
                excludedOrderIds={props.excludedOrderIds}
                onToggle={props.onToggleOrderExclusion}
                onSelectAll={props.onSelectAllOrders}
                onDeselectAll={props.onDeselectAllOrders}
            />
            <ToolbarSaveButton
                changedCount={props.changedTasksCount}
                draftCount={props.draftTasksCount}
                onSave={props.onSaveAllPlanning}
            />
        </div>
    );
}
```

_Mejora de UX/UI:_
Al aislar `PlanningAlertsPopover`, el badge de alertas puede implementar animación `shake` cuando aparecen nuevos conflictos, sin que ese estado toque el resto del toolbar.

**Impacto de la Mejora:**
Contiene la deuda antes de que se magnifique. Facilita que otro desarrollador modifique el selector de órdenes sin entender todo el toolbar.

---

### 🎨 H-03 · INVENTORYVIEW — TIPADO AUSENTE Y UX INCOMPLETA [ALTO]

**Análisis de Estado Actual:**
`components/warehouse/inventory-view.tsx` (135 líneas) es el módulo más nuevo del sistema. Implementa búsqueda con debounce y muestra una tabla de inventario.

**Problema Detectado:**
Tres problemas superpuestos:

1. **`useState<any[]>([])`** — los items no tienen tipo. `item.key`, `item.name`, `item.stock_quantity`, `item.min_stock`, `item.metadata?.brand` se acceden sin contrato TypeScript. Supabase genera tipos automáticamente, pero no se usan.

2. **`fetchInventory` en useEffect sin dependencias correctas** — la función se recrea en cada render, creando una referencia nueva que puede generar el warning de ESLint `react-hooks/exhaustive-deps`. El patrón correcto es `useCallback` o moverla fuera.

3. **Paginación falsa** — `limit(100)` hardcodeado con texto "Mostrando los primeros X resultados". Para un inventario que puede tener miles de ítems (insertos, brocas, consumibles), este límite silencioso es un bug de UX: el usuario buscará algo que existe y no lo encontrará.

**Propuesta de Optimización:**

_Lógica/Código — Tipado y fetch correcto:_

```typescript
// Usar el tipo generado por Supabase
type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];

// En el componente:
const [items, setItems] = useState<InventoryItem[]>([]);
const [page, setPage] = useState(0);
const PAGE_SIZE = 50;

const fetchInventory = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const baseQuery = supabase
        .from("inventory_items")
        .select("*", { count: "exact" })
        .order("key", { ascending: true })
        .range(from, to);

    const query = searchTerm
        ? baseQuery.or(`key.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        : baseQuery;

    const { data, error, count } = await query;
    if (data) {
        setItems(data);
        setTotalCount(count ?? 0);
    }
    setLoading(false);
}, [searchTerm, page, supabase]);
```

_Mejora de UX/UI:_
Agregar paginación con "Página 1 de N" y botones anterior/siguiente. Con 50 ítems por página, la tabla es scannable. Mostrar el total real ("847 ítems en inventario") en lugar de ocultar el límite.

**Impacto de la Mejora:**
Un operario buscando el código de un inserto específico necesita que la búsqueda funcione sobre _todo_ el inventario. El límite silencioso actual es la diferencia entre "el sistema no tiene ese ítem" y "el sistema sí lo tiene pero no lo muestra".

---

### ✅ H-04 · GANTT-SVG — TIPO `any` PERSISTENTE Y PROP EXPLOSION [RESUELTO — 2026-04-14]

**Análisis de Estado Actual:**
A pesar de la refactorización exitosa, `gantt-svg.tsx` mantiene 7 instancias de `(task as any).is_treatment` y la prop `modalData?: any` sin tipar en la interfaz pública.

**Problema Detectado:**

1. **`(task as any).is_treatment`** — el campo `is_treatment` existe en los tipos generados de Supabase (`utils/supabase/types.ts:167`), pero la definición local de `PlanningTask` en `gantt-svg.tsx` no lo extiende correctamente. El cast a `any` es un parche que silencia el error real.

2. **`modalData?: any`** en `GanttSVGProps` — se propaga a `GanttTaskBar.setModalData(data: any)`. Untyped data entre componentes es una fuente de bugs silenciosos al refactorizar.

3. **GanttTaskBar recibe 20+ props** incluyendo handlers (`onMouseDown`, `onResizeStart`, `setHoveredTask`, `setTooltipPos`, `setContextMenu`) y refs (`isScrollingRef`). Aunque está memoizado, el número de props hace que el comparador `areTaskBarsEqual` sea difícil de mantener y propenso a omisiones.

**Propuesta de Optimización:**

_Lógica/Código — Extender el tipo local:_

```typescript
// components/production/gantt-svg.tsx — tipo corregido
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
    is_treatment?: boolean | null; // ← añadir explícitamente
    register?: string | null; // ← ídem para otros campos usados con any
};

// Eliminar todos los (task as any).is_treatment:
const isTreatmentTask = !!task.is_treatment; // type-safe
```

_Lógica/Código — GanttInteractionContext para reducir prop drilling:_

```tsx
// contexts/gantt-interaction-context.tsx
interface GanttInteractionContext {
    draggingTask: { id: string; cascadeIds?: string[] } | null;
    resizingTask: { id: string } | null;
    hoveredTask: PlanningTask | null;
    isScrollingRef: React.RefObject<boolean>;
    onMouseDown: (e: React.MouseEvent, task: PlanningTask) => void;
    onResizeStart: (e: React.MouseEvent, task: PlanningTask, dir: "left" | "right") => void;
    setHoveredTask: (task: PlanningTask | null) => void;
    setTooltipPos: (pos: TooltipPos) => void;
    setContextMenu: (data: ContextMenuData | null) => void;
    setModalData: (data: GanttModalData) => void;
    onTaskDoubleClick?: (task: PlanningTask) => void;
    readOnly: boolean;
}

// GanttTaskBar recibe solo sus props de datos:
// task, x, y, width, height, color, isDragging, isResizing, isLocked, isFocused, isCascadeGhost, isConflicting
// Los handlers los consume del contexto — comparador de memo se simplifica radicalmente
```

_Mejora de UX/UI:_
Ninguna directa, pero la eliminación de prop drilling hace que `GanttTaskBar` sea testeable en aislamiento con un simple `<GanttInteractionProvider>` mock.

**Impacto de la Mejora:**
Elimina 7 casts `as any`. Hace el comparador de memo más robusto. Reduce la interfaz pública de `GanttTaskBar` de 20+ a 13 props — cada una con significado claro.

---

### 🎨 H-05 · TOUR DE PRODUCCIÓN — 120 LÍNEAS INLINE EN EL COMPONENTE [MEDIO]

**Análisis de Estado Actual:**
`production-view.tsx` contiene la definición completa del tour guiado (pasos, textos, callbacks de demostración) directamente en el cuerpo del componente. Ocupa ~120 líneas (líneas 205–363).

**Problema Detectado:**
Viola el principio de separación de contenido y lógica. Los textos del tour son _contenido_ que un product manager o diseñador debería poder editar sin tocar código de componente. Mezclarlos con la lógica de demostración (`taskState.setOptimisticTasks`, `setModalData`) hace que cualquier cambio de copy requiera revisar 515 líneas de componente.

**Propuesta de Optimización:**

_Lógica/Código — Extraer a hook dedicado:_

```typescript
// hooks/use-production-tour.ts
export function useProductionTour({ machines, taskState, setModalData }: UseProductionTourProps) {
    const { startTour } = useTour();

    const handleStartTour = useCallback(() => {
        const isDemo = taskState.optimisticTasks.length === 0;
        if (isDemo) taskState.setOptimisticTasks([buildDemoTask(machines[0])]);

        const cleanup = () => {
            if (isDemo) taskState.setOptimisticTasks([]);
            setModalData(null);
        };

        startTour(PRODUCTION_TOUR_STEPS(setModalData, machines), cleanup);
    }, [machines, taskState, setModalData, startTour]);

    return { handleStartTour };
}

// hooks/production-tour-steps.ts — solo contenido/configuración
export const PRODUCTION_TOUR_STEPS = (setModalData: (d: any) => void, machines: Machine[]): TourStep[] => [
    {
        element: "#planning-gantt-area",
        popover: {
            title: "Área de Gantt",
            description: "Visualiza y gestiona la producción...",
        },
    },
    // ... resto de pasos
];
```

_Mejora de UX/UI:_
Al separar los steps, es trivial añadir un segundo tour "avanzado" para usuarios veteranos que explique estrategias de planeación, sin duplicar la infraestructura del tour.

**Impacto de la Mejora:**
`production-view.tsx` pierde ~120 líneas. El copy del tour es editable sin riesgo de romper lógica de componente.

---

### 🎨 H-06 · EVALUATION CONFIRM MODAL — Z-INDEX FRÁGIL [MEDIO]

**Análisis de Estado Actual:**
`evaluation-sidebar.tsx` renderiza su modal de confirmación como un `div` con `absolute inset-0 z-[10000]` dentro del sidebar (`z-[1000]`).

**Problema Detectado:**
El sidebar ya vive en `fixed position z-[1000]`. El modal overlay `absolute inset-0` dentro de él solo cubre el sidebar, no el resto de la pantalla. Funciona visualmente porque el overlay tiene `bg-black/60` y el sidebar ocupa el lado derecho, pero:

1. El backdrop no cubre el canvas del Gantt — el usuario puede hacer clic fuera mientras el modal "bloquea" la UI.
2. Si el Drawing Panel está abierto (`z-[999]`), queda detrás del modal a pesar de ser parte del mismo flujo.
3. `z-[10000]` hardcodeado es un número mágico que solo funciona mientras nada más use z-index mayor.

**Propuesta de Optimización:**

_Lógica/Código — Usar el AlertDialog de Radix ya disponible en el sistema:_

```tsx
// evaluation-sidebar.tsx — usar AlertDialog de Radix (ya en el proyecto)
import { AlertDialog, AlertDialogContent, AlertDialogHeader, ... } from "@/components/ui/alert-dialog";

// En el JSX del form view — fuera del div del sidebar:
<AlertDialog open={!!confirmModal} onOpenChange={() => setConfirmModal(null)}>
    <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModal?.onConfirm}>
                {confirmModal?.type === "warning" ? "Entendido" : "Continuar"}
            </AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
```

_Mejora de UX/UI:_
El overlay de Radix usa un Portal que monta en `document.body`, cubriendo toda la pantalla correctamente. El foco queda atrapado dentro del dialog (focus trap). Esc lo cierra. Todo esto es gratuito al usar el componente ya disponible.

**Impacto de la Mejora:**
Elimina el z-index mágico. Cumple WCAG 2.1 con focus trap. El usuario no puede interactuar accidentalmente con el Gantt mientras confirma una acción destructiva.

---

### 🎨 H-07 · AUTO-PLAN DIALOG — ERROR DE GUARDADO SIN FEEDBACK [MEDIO]

**Análisis de Estado Actual:**
`auto-plan-dialog.tsx:176` — el bloque catch de `handleSave` solo hace `console.error(err)`.

**Problema Detectado:**
Si `onSaveScenario` falla (red, Supabase, validación), el usuario ve que el botón vuelve a "GUARDAR ESCENARIO" sin ninguna explicación. La planeación que acaba de generar puede estar perdida. Viola la Heurística #1 de Nielsen (Visibilidad del estado del sistema).

**Propuesta de Optimización:**

_Lógica/Código — 3 líneas de cambio:_

```typescript
// auto-plan-dialog.tsx:175
} catch (err) {
    console.error("[AutoPlanDialog] Error saving scenario:", err);
    toast.error("No se pudo guardar el escenario. Intenta de nuevo.");
    // No cerrar el dialog — el usuario puede reintentar
} finally {
    setIsSaving(false);
}
```

_Mejora de UX/UI:_
El dialog permanece abierto cuando falla el guardado. El usuario ve el error y tiene la opción de reintentar sin perder la configuración del escenario.

**Impacto de la Mejora:**
Cambio de 2 líneas. Elimina un punto ciego de UX donde el usuario no sabe si el guardado funcionó o no.

---

### 🎨 H-08 · MACHINING VIEW — LÓGICA DEMO ACOPLADA [BAJO]

**Análisis de Estado Actual:**
`machining-view.tsx` (354 líneas) tiene un sistema de `demoMode` ("none" | "pending" | "active") que genera tareas falsas para el tour. La lógica de demo está mezclada con la lógica de filtrado de tareas reales.

**Problema Detectado:**
El mismo patrón detectado en `production-view.tsx` para el tour, pero más pequeño. Los `if (demoMode !== 'none')` en `filteredTasks` crean un camino de código alternativo que no está testeado por los tests de producción.

**Propuesta de Optimización:**

_Lógica/Código — Separar demo tasks de real tasks:_

```typescript
// hooks/use-machining-tour.ts — extraer demo logic
export function useMachiningTour({ operatorName, onDemoStart, onDemoEnd }) {
    const { startTour } = useTour();
    const [demoTasks, setDemoTasks] = useState<PlanningTask[]>([]);

    const handleStartTour = () => {
        const demo = buildMachiningDemoTasks(operatorName);
        setDemoTasks(demo);
        startTour(MACHINING_TOUR_STEPS, () => setDemoTasks([]));
    };

    return { demoTasks, handleStartTour };
}

// En MachiningView — filteredTasks solo usa tareas reales
// el merge con demoTasks ocurre en el JSX, no en el memo:
const displayTasks = demoTasks.length > 0 ? demoTasks : filteredTasks;
```

_Mejora de UX/UI:_ Sin cambio visual. El beneficio es de DX: `filteredTasks` pasa a ser determinista y testeable.

**Impacto de la Mejora:**
Facilita escribir tests unitarios para `filteredTasks` sin simular el estado del tour.

---

### 🎨 H-09 · WORKSHIFT MANAGER — VALIDACIÓN SOLO EN TOAST [BAJO]

**Análisis de Estado Actual:**
`components/admin/work-shift-manager.tsx` valida el formulario de turnos mostrando errores como toasts (`toast.error("El nombre es obligatorio")`). El campo incorrecto no recibe feedback visual.

**Problema Detectado:**
Viola la Heurística #9 de Nielsen: el usuario debe poder diagnosticar el error desde el campo que lo causó, no desde una notificación toast que desaparece. En formularios cortos con 4–5 campos, el error debería mostrarse inline.

**Propuesta de Optimización:**

_Lógica/Código — Estado de errores por campo:_

```typescript
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

const saveShift = () => {
    const errors: Record<string, string> = {};
    if (!editing?.name.trim()) errors.name = "El nombre es obligatorio";
    if (!editing?.start_time) errors.start_time = "Hora de inicio requerida";
    if (!editing?.end_time) errors.end_time = "Hora de fin requerida";
    if (editing?.days_of_week.length === 0) errors.days = "Selecciona al menos un día";

    if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
    }
    setFieldErrors({});
    // ... save logic
};

// En el JSX del campo:
<Input
    value={editing.name}
    onChange={...}
    className={cn(fieldErrors.name && "border-destructive")}
/>
{fieldErrors.name && (
    <p className="text-xs text-destructive">{fieldErrors.name}</p>
)}
```

_Mejora de UX/UI:_
El campo en error queda resaltado en rojo con el mensaje debajo. El usuario sabe exactamente qué corregir sin leer un toast que ya desapareció.

**Impacto de la Mejora:**
Patrón estándar de formularios en el resto del sistema (login, cotizador). Consistencia de UX a costo mínimo.

---

### 🎨 H-10 · LANDING PAGE — PROGRESO PARCIAL [BAJO]

**Análisis de Estado Actual:**
`app/page.tsx` implementó la mejora de jerarquía visual recomendada: hero de 70vh con h1 prominente, CTAs separados, features debajo del fold. Sin embargo, la sección de features en desktop sigue siendo 3 columnas compactas sin separación visual clara del hero.

**Problema Detectado:**
La separación entre hero y features usa solo `py-20` sin un divisor visual o cambio de fondo. El ojo del usuario pasa directamente de "Gestión Integral CNC" a las feature cards, sin la pausa que da una sección con `border-t` o cambio sutil de background. En mobile, las 3 cards están en stack vertical con `gap-6` pero sin scroll snap.

**Propuesta de Optimización:**

_Mejora de UX/UI:_

```tsx
{
    /* Feature section con separación visual clara */
}
<section className="border-t border-border/50 bg-muted/20 py-24">
    <div className="mx-auto max-w-7xl px-6">
        <p className="mb-12 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            ¿Qué incluye?
        </p>
        {/* cards — en mobile: scroll-x snap en lugar de stack */}
        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible">
            {FEATURES.map((f) => (
                <div key={f.title} className="min-w-[280px] snap-start md:min-w-0 ...">
                    {/* card */}
                </div>
            ))}
        </div>
    </div>
</section>;
```

**Impacto de la Mejora:**
La landing comunica valor antes de pedir login. En mobile, las cards con scroll horizontal son más ergonómicas que el stack infinito.

---

## 4. IDEAS DE INNOVACIÓN (BONUS)

### 💡 1. GANTT COLABORATIVO EN TIEMPO REAL CON CURSORES VISIBLES

El stack ya tiene Supabase Realtime activo (`realtime-refresher.tsx`). El siguiente nivel es mostrar el cursor de cada planificador activo en el Gantt, similar a Figma. Cuando "María" arrastra una tarea en su pantalla, "Carlos" ve un cursor con su nombre moviéndose en tiempo real.

**Implementación base:**

```typescript
// broadcast del cursor cada 100ms durante drag
supabase.channel("gantt-cursors").send({
    type: "broadcast",
    event: "cursor",
    payload: { userId, x: currentTime.toISOString(), machine: draggingTask.machine },
});
```

**Impacto:** Elimina conflictos silenciosos de planeación. Dos planificadores no pueden asignar la misma máquina al mismo tiempo sin saberlo. La confianza del equipo en el plan aumenta radicalmente.

---

### 💡 2. TIMELINE DE SALUD DEL PROYECTO EN EL DASHBOARD

Actualmente, el Dashboard (`app/dashboard/page.tsx`) muestra charts estáticos. La propuesta es un **"Semáforo de Proyectos"**: una vista compacta que cruza fecha de entrega, estado de evaluación y tareas en Gantt para calcular automáticamente el riesgo de cada proyecto.

```typescript
type ProjectHealth = {
    projectId: string;
    status: "on-track" | "at-risk" | "delayed";
    daysToDelivery: number;
    evaluationCompletion: number; // % de piezas evaluadas
    ganttCoverage: number; // % de piezas con tarea asignada
};
```

**Por qué ahora:** Los datos ya existen (evaluation, planning, production_orders). Solo falta el cálculo y la visualización. Una semana de trabajo, impacto inmediato en decisiones de gerencia.

---

### 💡 3. MÓDULO DE ALMACÉN CON CONSUMO AUTOMÁTICO DESDE GANTT

`InventoryView` existe pero es solo lectura. La innovación es conectarlo con el Gantt: cuando se crea una tarea de maquinado para una pieza, el sistema sugiere automáticamente los insertos y consumibles del inventario necesarios según el material y la máquina.

```typescript
// Al crear una tarea en el Gantt:
const suggestions = await getToolingSuggestions({
    machine: task.machine,
    material: order.material,
    operation: evaluationStep.machine_type,
});
// UI: "Para este maquinado se recomienda: Inserto CNMG 120408 (Stock: 12)"
```

**Impacto:** Cierra el ciclo entre producción y almacén. El operario sabe qué herramientas necesitar antes de empezar. El almacenista puede anticipar solicitudes. Convierte el módulo de Almacén de "catálogo pasivo" a "herramienta activa de producción".

---

## 5. ÍNDICE DE HALLAZGOS

| ID                                                                          | Componente / Archivo                           | Severidad   | Categoría                       | Esfuerzo   |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ----------- | ------------------------------- | ---------- |
| [H-01](#h-01--ganttcontrols--componente-llamado-como-función-crítico)       | `components/production/gantt-controls.tsx`     | ✅ RESUELTO | Arquitectura / Hooks            | 2026-04-14 |
| [H-02](#h-02--strategy-toolbar--nuevo-monolito-622-líneas)                  | `components/production/strategy-toolbar.tsx`   | 🟠 ALTO     | Arquitectura / SRP              | 3–4h       |
| [H-03](#h-03--inventoryview--tipado-ausente-y-ux-incompleta-alto)           | `components/warehouse/inventory-view.tsx`      | 🟠 ALTO     | Tipado / UX                     | 2h         |
| [H-04](#h-04--gantt-svg--tipo-any-persistente-y-prop-explosion-alto)        | `components/production/gantt-svg.tsx`          | ✅ RESUELTO | Tipado / DX                     | 2026-04-14 |
| [H-05](#h-05--tour-de-producción--120-líneas-inline-en-el-componente-medio) | `components/production/production-view.tsx`    | 🟡 MEDIO    | Separación de responsabilidades | 2h         |
| [H-06](#h-06--evaluation-confirm-modal--z-index-frágil-medio)               | `components/production/evaluation-sidebar.tsx` | 🟡 MEDIO    | A11y / Z-index                  | 1h         |
| [H-07](#h-07--auto-plan-dialog--error-de-guardado-sin-feedback-medio)       | `components/production/auto-plan-dialog.tsx`   | 🟡 MEDIO    | UX / Error handling             | 15min      |
| [H-08](#h-08--machining-view--lógica-demo-acoplada-bajo)                    | `components/production/machining-view.tsx`     | 🟢 BAJO     | DX / Testabilidad               | 1.5h       |
| [H-09](#h-09--workshift-manager--validación-solo-en-toast-bajo)             | `components/admin/work-shift-manager.tsx`      | 🟢 BAJO     | UX / Formularios                | 1h         |
| [H-10](#h-10--landing-page--progreso-parcial-bajo)                          | `app/page.tsx`                                 | 🟢 BAJO     | UI / Visual                     | 30min      |

**Calificación proyectada al cerrar H-01 a H-04: 9.1 / 10**

---

## 6. PLAN DE IMPLEMENTACIÓN

> Cada sprint es de **2–3 días de trabajo**. Los sprints están ordenados por impacto descendente y dependencias entre hallazgos. Los ítems dentro de un sprint son independientes entre sí y pueden ejecutarse en paralelo.

---

### SPRINT 1 — ESTABILIDAD CRÍTICA

**Objetivo:** Eliminar el bug latente de hooks y la deuda de tipado más urgente.
**Fecha objetivo:** 2026-04-17

#### ✅ Tarea 1.1 — H-01: Refactorizar `GanttControls` como componente real — COMPLETADA 2026-04-14

- **Solución aplicada:**
    - `GanttStartControls` — componente puro con props `viewMode` + `onViewModeChange`. Sin hooks.
    - `GanttEndControls` — componente real propietario de todos los hooks (`useState`, `useEffect`, `useCallback`).
    - Eliminado `const { startControls, endControls } = GanttControls({...})` de `production-view.tsx`.
    - `<GanttSVG>` recibe `startControls={<GanttStartControls ... />}` y `endControls={<GanttEndControls ... />}` como JSX directo.
    - `tsc --noEmit` pasa sin errores. Cero referencias al patrón antiguo en el codebase.

#### ✅ Tarea 1.2 — H-04: Eliminar casts `as any` — COMPLETADA 2026-04-14

- **Solución aplicada:**
    - Creado `components/production/types.ts` con `GanttPlanningTask` (tipo canónico compartido) y `GanttModalData`.
    - `GanttPlanningTask` extiende la fila de Supabase con `is_treatment`, `treatment_type`, `register`, `isDraft`, `cascadeIds`, `startMs`, `endMs`.
    - Los 4 archivos que redefinían `PlanningTask` localmente (`gantt-svg.tsx`, `GanttTaskBar.tsx`, `use-gantt-drag-drop.ts`, `use-gantt-layout.ts`) ahora importan el tipo compartido.
    - Eliminados todos los casts `as any` en los 4 archivos. `modalData` y `setModalData` tipados con `GanttModalData | null`.
    - Corregido bug latente en `GanttTaskBar`: `onDoubleClick` pasaba el objeto `task` completo a `setModalData`; ahora construye el shape correcto.
    - `tsc --noEmit` pasa sin errores. Cero ocurrencias de `as any` en los archivos afectados.

#### Tarea 1.3 — H-07: Feedback de error en `AutoPlanDialog` _(quickwin — 15 min)_

- **Archivo:** `components/production/auto-plan-dialog.tsx:175`
- **Pasos:**
    1. Reemplazar el bloque catch:
        ```typescript
        } catch (err) {
            console.error("[AutoPlanDialog] Error saving scenario:", err);
            toast.error("No se pudo guardar el escenario. Intenta de nuevo.");
        } finally {
            setIsSaving(false);
        }
        ```
    2. Remover el `setIsSaving(false)` del bloque try para que siempre se ejecute en finally.
- **Criterio de aceptación:** Al simular un error en `onSaveScenario`, el dialog no se cierra y aparece un toast de error.

---

### SPRINT 2 — ARQUITECTURA Y CALIDAD

**Objetivo:** Frenar la formación del segundo monolito y completar el tipado del módulo de Almacén.
**Fecha objetivo:** 2026-04-21

#### Tarea 2.1 — H-02: Dividir `strategy-toolbar.tsx`

- **Archivos:** `components/production/strategy/` (directorio nuevo)
- **Pasos:**
    1. Crear `components/production/strategy/StrategyTabs.tsx` con los tabs Manual/Ruta Crítica (aprox. 80 líneas extraídas).
    2. Crear `components/production/strategy/PlanningAlertsPopover.tsx` con el badge + popover de alertas de solapamiento/operador (aprox. 150 líneas).
    3. Crear `components/production/strategy/OrderSelectionPopover.tsx` con el selector de órdenes incluidas/excluidas (aprox. 200 líneas).
    4. Crear `components/production/strategy/ToolbarSaveButton.tsx` con el botón de guardado + contadores (aprox. 50 líneas).
    5. Reducir `strategy-toolbar.tsx` a un shell de composición de ~100 líneas que importa y orquesta los 4 componentes anteriores.
    6. Actualizar el barrel export si existe, o ajustar el import en `production-view.tsx`.
- **Criterio de aceptación:** `strategy-toolbar.tsx` ≤ 120 líneas. Cada archivo hijo ≤ 220 líneas. Funcionalidad idéntica al estado anterior.

#### Tarea 2.2 — H-03: Tipar y paginar `InventoryView`

- **Archivo:** `components/warehouse/inventory-view.tsx`
- **Pasos:**
    1. Importar el tipo generado: `type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]`.
    2. Cambiar `useState<any[]>([])` → `useState<InventoryItem[]>([])`.
    3. Añadir `useState<number>(0)` para `page` y `useState<number>(0)` para `totalCount`.
    4. Envolver `fetchInventory` en `useCallback` con dependencias `[searchTerm, page, supabase]`.
    5. Cambiar `limit(100)` por `.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)` con `PAGE_SIZE = 50`.
    6. Añadir controles de paginación al footer: `<Button onClick={() => setPage(p => p - 1)}>Anterior</Button>` / `<Button>Siguiente</Button>` + texto "Página X de N".
    7. Al cambiar `searchTerm`, resetear `page` a 0.
- **Criterio de aceptación:** `tsc --noEmit` sin errores en este archivo. La búsqueda funciona sobre todos los registros. La navegación entre páginas funciona correctamente.

---

### SPRINT 3 — UX Y ACCESIBILIDAD

**Objetivo:** Corregir el modal de confirmación, extraer el tour y limpiar el flujo de maquinados.
**Fecha objetivo:** 2026-04-24

#### Tarea 3.1 — H-06: Reemplazar confirm modal inline por `AlertDialog`

- **Archivo:** `components/production/evaluation-sidebar.tsx`
- **Pasos:**
    1. Importar `AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction` desde `@/components/ui/alert-dialog`.
    2. Eliminar el bloque `{confirmModal && (<div className="absolute inset-0 z-[10000] ...">...</div>)}` (líneas 341–388).
    3. Añadir `<AlertDialog open={!!confirmModal} onOpenChange={() => confirmModal?.type === 'info' && setConfirmModal(null)}>` al final del JSX del `form view`, fuera del `motion.div`.
    4. Mapear `confirmModal.title`, `confirmModal.message` y `confirmModal.onConfirm` a los slots del AlertDialog.
    5. Para el tipo `"warning"`, usar `AlertDialogAction className="bg-destructive"` en lugar del botón rojo custom.
- **Criterio de aceptación:** El backdrop cubre toda la pantalla (no solo el sidebar). Esc cierra el modal de tipo `"info"`. El foco queda atrapado dentro del dialog mientras está abierto.

#### Tarea 3.2 — H-05: Extraer tour de producción

- **Archivos nuevos:** `hooks/use-production-tour.ts`, `lib/constants/production-tour-steps.ts`
- **Pasos:**
    1. Crear `lib/constants/production-tour-steps.ts` con la función `buildProductionTourSteps(setModalData, machines)` que devuelve el array de `TourStep[]` actualmente en `production-view.tsx:242–362`.
    2. Crear `hooks/use-production-tour.ts` con la función `useProductionTour({ machines, taskState, setModalData })` que contiene la lógica de demo task y llama a `startTour`.
    3. En `production-view.tsx`, reemplazar `handleStartTour` completo por:
        ```typescript
        const { handleStartTour } = useProductionTour({ machines, taskState, setModalData });
        ```
    4. Eliminar las ~120 líneas extraídas de `production-view.tsx`.
- **Criterio de aceptación:** `production-view.tsx` ≤ 400 líneas. El tour funciona igual que antes. El código del tour es editable sin abrir `production-view.tsx`.

#### Tarea 3.3 — H-08: Separar lógica demo en `MachiningView`

- **Archivo nuevo:** `hooks/use-machining-tour.ts`
- **Pasos:**
    1. Extraer `buildMachiningDemoTasks(operatorName)` a una función en `lib/constants/machining-tour-steps.ts`.
    2. Crear `hooks/use-machining-tour.ts` que encapsula `useState<PlanningTask[]>([])` para `demoTasks` y la llamada a `startTour`.
    3. En `MachiningView`, eliminar el `useState<"none" | "pending" | "active">` y el `if (demoMode !== 'none')` en `filteredTasks`.
    4. Añadir `const { demoTasks, handleStartTour } = useMachiningTour({ operatorName })`.
    5. En el JSX: `const displayTasks = demoTasks.length > 0 ? demoTasks : filteredTasks`.
- **Criterio de aceptación:** `filteredTasks` no contiene ninguna referencia a `demoMode`. `MachiningView` ≤ 250 líneas.

---

### SPRINT 4 — POLISH Y DX

**Objetivo:** Pulir formularios, landing y unificar patrones de validación.
**Fecha objetivo:** 2026-04-28

#### Tarea 4.1 — H-09: Validación inline en `WorkShiftManager`

- **Archivo:** `components/admin/work-shift-manager.tsx`
- **Pasos:**
    1. Añadir `const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})`.
    2. Reemplazar los 4 `toast.error(...)` de validación por asignaciones a `errors` y un `setFieldErrors(errors)` único.
    3. En cada `<Input>`, añadir `className={cn(fieldErrors.name && "border-destructive")}`.
    4. Debajo de cada campo, añadir `{fieldErrors.X && <p className="text-xs text-destructive mt-1">{fieldErrors.X}</p>}`.
    5. Limpiar `fieldErrors` al abrir el formulario (`cancelEdit` y `openNew`).
- **Criterio de aceptación:** Enviar el formulario vacío resalta los campos en rojo con mensajes inline. Los toasts de validación eliminados.

#### Tarea 4.2 — H-10: Separador visual en landing + scroll snap mobile

- **Archivo:** `app/page.tsx`
- **Pasos:**
    1. Envolver la sección de features en `<section className="border-t border-border/50 bg-muted/20 py-24">`.
    2. Añadir un label de sección: `<p className="mb-12 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">¿Qué incluye?</p>`.
    3. Cambiar el grid de cards por `flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible`.
    4. Añadir `min-w-[280px] snap-start` a cada card en mobile, `md:min-w-0` para desktop.
- **Criterio de aceptación:** En viewport < 768px, las cards se deslizan horizontalmente con snap. En desktop, se mantiene el grid de 3 columnas. La sección tiene separación visual clara del hero.

---

### RESUMEN TIMELINE

```
Semana 1 (Apr 14–17)    SPRINT 1 — Estabilidad Crítica
  ├── Tarea 1.1  GanttControls → componente real          ✅ DONE (2026-04-14)
  ├── Tarea 1.2  Eliminar as any en gantt-svg             ✅ DONE (2026-04-14)
  └── Tarea 1.3  Toast de error en AutoPlanDialog         15min

Semana 2 (Apr 18–21)    SPRINT 2 — Arquitectura y Calidad
  ├── Tarea 2.1  Dividir strategy-toolbar.tsx             3–4h
  └── Tarea 2.2  Tipar + paginar InventoryView            2h

Semana 3 (Apr 22–24)    SPRINT 3 — UX y Accesibilidad
  ├── Tarea 3.1  AlertDialog en EvaluationSidebar         1h
  ├── Tarea 3.2  Extraer tour de producción               2h
  └── Tarea 3.3  Separar demo logic en MachiningView      1.5h

Semana 4 (Apr 25–28)    SPRINT 4 — Polish y DX
  ├── Tarea 4.1  Validación inline WorkShiftManager       1h
  └── Tarea 4.2  Landing separator + scroll snap          30min
```

**Esfuerzo total estimado: ~19–21 horas de desarrollo**
**Calificación proyectada al finalizar Sprint 4: 9.3 / 10**
