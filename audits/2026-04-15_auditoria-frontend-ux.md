# REPORTE DE AUDITORÍA FRONTEND / UX-UI — REYPER XYZ · Iteración 4

**Fecha:** 2026-04-15 | **Auditor:** Senior Frontend Architect & UX/UI Product Strategist | **Modelo:** Claude Sonnet 4.6
**Auditoría anterior:** [2026-04-14_auditoria-frontend-ux.md](./2026-04-14_auditoria-frontend-ux.md)

---

## 1. RESUMEN EJECUTIVO

**Calificación General: 8.2 / 10** _(anterior: 8.4 — −0.2 pts)_

La iteración 3 dejó el codebase en su mejor estado estructural hasta la fecha: monolitos resueltos, hooks limpios, tipado canónico en `types.ts`. Sin embargo, al auditar los _consumidores_ de esos tipos (vistas, modales, componentes compartidos), emergen tres patrones que frenan el siguiente salto de calidad:

1. **Regresión parcial de tipado:** `production-view.tsx` sigue usando `useState<any>(null)` para `modalData` y define su propia `PlanningTask` local en lugar de importar `GanttPlanningTask` — contradiciendo la resolución de H-04 del sprint anterior.
2. **`alert()` nativo en módulo de maquinados:** `machining-view.tsx` y `create-task-modal.tsx` usan `window.alert()` para errores y validaciones, rompiendo visiblemente la consistencia del sistema de notificaciones Sonner establecido en el resto de la app.
3. **Deuda de tipado en módulo compartido:** `production-item-detail.tsx` (657 líneas, `item: any`, 14 `useState`) es el componente más crítico del módulo de Ventas/Cotizaciones sin contrato TypeScript. Si el shape de `item` cambia en Supabase, los errores serán silenciosos en tiempo de compilación y ruidosos en producción.

La calificación baja levemente porque se detectó una regresión directa de la iteración anterior, pero la base arquitectónica sigue sólida. Cerrar H-01 a H-03 devuelve el score a 8.7+ con poco esfuerzo.

**Distribución de hallazgos: 0 críticos · 3 altos · 3 medios · 2 bajos** | **Resueltos en esta iteración: 7/8**

---

## 2. REGISTRO DE PROGRESO (vs. Auditoría Anterior)

| Hallazgo Anterior                              | Estado                                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 GanttControls llamado como función        | ✅ **RESUELTO** — `GanttStartControls` + `GanttEndControls` como componentes reales                                                                                                           |
| H-02 StrategyToolbar monolito 622 líneas       | ✅ **RESUELTO** — 165 líneas + subdirectorio `strategy/` con 5 componentes hijos                                                                                                              |
| H-03 InventoryView tipado ausente / paginación | ✅ **RESUELTO** — `InventoryItem` tipado desde Supabase, paginación de 50 ítems, error handling                                                                                               |
| H-04 GanttSVG `as any` + prop explosion        | ⚠️ **PARCIAL** — `types.ts` creado, Gantt-internals corregidos, pero `production-view.tsx:104` aún usa `useState<any>` y define `PlanningTask` local en lugar de importar `GanttPlanningTask` |
| H-05 Tour de producción inline                 | ✅ **RESUELTO** — `useProductionTour` + `PRODUCTION_TOUR_STEPS` extraídos a hooks                                                                                                             |
| H-06 Eval confirm modal z-index frágil         | ✅ **RESUELTO** — `AlertDialog` de Radix con portal en `document.body`                                                                                                                        |
| H-07 AutoPlanDialog error sin feedback         | ✅ **RESUELTO** — `toast.error()` en catch + dialog permanece abierto                                                                                                                         |
| H-08 MachiningView lógica demo acoplada        | ✅ **RESUELTO** — `useMachiningTour` extraído, `filteredTasks` determinista                                                                                                                   |
| H-09 WorkShiftManager validación solo en toast | ✅ **RESUELTO** — `fieldErrors` por campo, borde rojo + mensaje inline                                                                                                                        |
| H-10 Landing Page progreso parcial             | ✅ **RESUELTO** — sección features con `border-t`, `bg-muted/20`, scroll-x snap en mobile                                                                                                     |

---

## 3. DESGLOSE DE HALLAZGOS

---

### ✅ H-01 · ~~PRODUCTION-VIEW — REGRESIÓN `modalData: any` + `PlanningTask` LOCAL QUE DIVERGE~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
`production-view.tsx:104` declara `const [modalData, setModalData] = useState<any>(null)`. El tipo `GanttModalData` fue creado en `components/production/types.ts` para resolver exactamente este problema en H-04. Además, `production-view.tsx:26–31` define su propia `PlanningTask` local:

```typescript
// production-view.tsx:26 — tipo local que no incluye is_treatment, treatment_type, register, cascadeIds
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
    startMs?: number;
    endMs?: number;
};
```

`GanttPlanningTask` (el tipo canónico en `types.ts`) añade `is_treatment`, `treatment_type`, `register` y `cascadeIds`. Idéntico problema existe en `machining-view.tsx:27`.

**Problema Detectado:**
Dos consecuencias directas:

1. `modalData: any` propaga sin contrato hasta `useProductionTour({ setModalData })` y al prop `setModalData` de `<GanttSVG>`. Si `GanttModalData` añade o renombra un campo, `production-view.tsx` no lo detecta en compilación — el error aparece en runtime.

2. El tipo local `PlanningTask` de `production-view.tsx` no incluye `is_treatment` ni `cascadeIds`. Cuando `strategy.allTasks` (que internamente usa `GanttPlanningTask`) se pasa a `<GanttSVG optimisticTasks={strategy.allTasks}>`, TypeScript acepta el cast por compatibilidad estructural, pero el tipo en el ámbito de `production-view.tsx` no refleja fielmente los datos reales — cualquier acceso a `task.is_treatment` en el componente padre devolvería `undefined` sin advertencia. Viola el principio DRY y el SRP de mantenimiento de tipos (SOLID-S).

**Propuesta de Optimización:**

_Lógica/Código — 2 cambios en `production-view.tsx`:_

```typescript
// 1. Eliminar el import de Database y la definición local de PlanningTask
// 2. Importar el tipo canónico
import { GanttPlanningTask, GanttModalData } from "./types";

// Línea 26 — eliminar el bloque type PlanningTask = {...}
// (ya no es necesario; GanttPlanningTask es el tipo correcto)

// Línea 104 — cambiar any por el tipo correcto
const [modalData, setModalData] = useState<GanttModalData | null>(null);
```

El mismo cambio aplica a `machining-view.tsx:27` — importar `GanttPlanningTask` desde `./types` en lugar de redefinir `PlanningTask` localmente. (El tipo de machining-view puede omitir `cascadeIds` si no los usa, pero debería extender `GanttPlanningTask` por compatibilidad.)

_Mejora de UX/UI:_
Sin cambio visual directo. El beneficio es de DX: si `GanttModalData` evoluciona (e.g., se añade `lockReason`), TypeScript advertirá en `production-view.tsx` sin necesidad de buscar manualmente todos los usos.

**Impacto de la Mejora:**
Completa la resolución de H-04 iniciada en la iteración anterior. Elimina el riesgo de divergencia silenciosa entre el tipo canonical y el tipo local. `tsc --noEmit` sin errores en los 3 archivos afectados.

---

### ✅ H-02 · ~~MACHINING-VIEW + CREATE-TASK-MODAL — `alert()` NATIVO EN UI DE PRODUCCIÓN~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
`machining-view.tsx:68` y `:90` llaman a `alert()` del navegador para errores de check-in/check-out. `create-task-modal.tsx:163` y `:180` llaman a `alert()` para validación de formulario y error de creación de tarea.

```typescript
// machining-view.tsx:68
alert("Error al registrar inicio");

// machining-view.tsx:90
alert("Error al registrar fin");

// create-task-modal.tsx:163
alert("Por favor completa los campos requeridos");

// create-task-modal.tsx:180
alert("Error al crear el registro");
```

**Problema Detectado:**
`window.alert()` es un diálogo bloqueante del navegador: pausa toda ejecución de JavaScript, muestra UI nativa del OS (inconsistente con el diseño de la app), y no puede ser styled, dismissido programáticamente ni testeado. En contraste, el resto de la aplicación usa `toast()` de Sonner con estilos propios del sistema. El usuario de maquinados —que opera desde la pantalla del taller, probablemente en tablet— ve de repente un diálogo de sistema operativo en medio de una UI moderna. Viola Nielsen Heurística #4 (Consistency and Standards).

Adicionalmente, `create-task-modal.tsx:163` usa `alert()` para validación de formulario en lugar de inline errors — el mismo problema que H-09 de la iteración anterior resolvió en `work-shift-manager.tsx`. El patrón correcto ya existe en el proyecto.

**Propuesta de Optimización:**

_Lógica/Código — `machining-view.tsx` (errores de red):_

```typescript
// Añadir import al inicio (ya disponible en el proyecto)
import { toast } from "sonner";

// handleCheckIn — línea 68
} catch (error) {
    console.error("[MachiningView] Check-in error:", error);
    toast.error("No se pudo registrar el inicio. Intenta de nuevo.");
} finally {

// confirmCheckOut — línea 90
} catch (error) {
    console.error("[MachiningView] Check-out error:", error);
    toast.error("No se pudo registrar el fin. Intenta de nuevo.");
} finally {
```

_Lógica/Código — `create-task-modal.tsx` (validación + error):_

```typescript
// Validación — línea 160: reemplazar alert() con estado inline
const [formErrors, setFormErrors] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !startDate || !endDate) {
        setFormErrors("Completa los campos requeridos: orden, fecha de inicio y fin.");
        return;
    }
    setFormErrors(null);
    // ...
    } catch (error) {
        console.error("[CreateTaskModal] error:", error);
        toast.error("No se pudo crear la tarea. Verifica los datos e intenta de nuevo.");
    }
};

// En JSX, antes del botón de submit:
{formErrors && (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{formErrors}</p>
)}
```

_Mejora de UX/UI:_
El operario ve el error como un toast no-bloqueante integrado con el diseño del sistema (mismo estilo que el resto de la app). En el modal de creación de tarea, el error de validación aparece inline antes del submit — el usuario no pierde el contexto del formulario.

**Impacto de la Mejora:**
4 archivos, ~8 líneas de cambio. Elimina todos los `alert()` del codebase. Consistencia total del sistema de feedback de errores.

---

### ✅ H-03 · ~~PRODUCTION-ITEM-DETAIL — `item: any` + 657 LÍNEAS + 14 `useState`~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
`components/shared/production-item-detail.tsx` es el componente de edición de partidas de producción. Tiene 657 líneas y gestiona:

- Formulario de edición (editName, editQuantity, editMaterial, editStatus, editUrgency, editImage, editDrawingUrl, editModelUrl, editRenderUrl, editTreatmentId, editMaterialConfirmation)
- Catálogos fetcheados al montar (materials, statuses, treatments — `any[]`)
- Upload de assets (isSaving, isUploading)
- Visor de planos (visorUrl, visorType)
- Refs de inputs de archivo

```typescript
// production-item-detail.tsx:37-38
interface ProductionItemDetailProps {
    item: any; // ← cero contrato TypeScript
    // ...
}

// :72-74 — catálogos sin tipo
const [materials, setMaterials] = useState<any[]>([]);
const [statuses, setStatuses] = useState<any[]>([]);
const [treatments, setTreatments] = useState<any[]>([]);
```

**Problema Detectado:**
Tres problemas superpuestos:

1. **`item: any`** — el componente accede a `item.part_name`, `item.quantity`, `item.material`, `item.general_status`, `item.urgencia`, `item.image`, `item.drawing_url`, `item.model_url`, `item.render_url`, `item.treatment_id`, `item.material_confirmation`. Todos son accesos sin tipo. Si Supabase renombra cualquier campo (e.g., `urgencia` → `is_urgent`), el componente compila sin errores pero rompe en runtime silenciosamente (devuelve `undefined`).

2. **14 `useState` de estado de formulario** — el mismo antipatrón resuelto en `production-view.tsx` en auditorías anteriores. El estado de edición debería vivir en un hook `useProductionItemEditForm(item)` que retorne `{ fields, setField, handleSave, isSaving }`.

3. **Responsabilidades mezcladas**: edición de metadatos, upload de assets (imagen, plano, render), visor de planos y catálogos están todos en el mismo archivo. El patrón de composición con hooks ya establecido en `production/hooks/` no se replicó en `shared/`.

**Propuesta de Optimización:**

_Lógica/Código — Tipar `item` con el tipo generado por Supabase:_

```typescript
import { Database } from "@/utils/supabase/types";

// Tipo base del item (partida de producción)
type ProductionOrder = Database["public"]["Tables"]["production_orders"]["Row"];

// Si el componente acepta tanto orders completas como sub-shapes
// (ventas vs. producción), usar un tipo intersección explícito:
type ProductionItemDetailProps = {
    item: Pick<
        ProductionOrder,
        | "id"
        | "part_name"
        | "part_code"
        | "quantity"
        | "material"
        | "general_status"
        | "urgencia"
        | "image"
        | "drawing_url"
        | "model_url"
        | "render_url"
        | "treatment_id"
        | "material_confirmation"
    >;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onUpdate?: () => void;
    hiddenFields?: Array<keyof ProductionOrder>;
    readOnlyFields?: Array<keyof ProductionOrder>;
    onViewDrawing?: (url: string, title: string) => void;
};
```

_Lógica/Código — Extraer hook de formulario:_

```typescript
// hooks/use-production-item-form.ts
export function useProductionItemForm(item: ProductionItemType) {
    const [fields, setFields] = useState({
        part_name: item.part_name ?? "",
        quantity: item.quantity ?? 1,
        material: item.material ?? "",
        general_status: item.general_status ?? "",
        urgencia: item.urgencia ?? false,
        image: item.image ?? "",
        drawing_url: item.drawing_url ?? "",
        model_url: item.model_url ?? "",
        render_url: item.render_url ?? "",
        treatment_id: item.treatment_id ?? "none",
        material_confirmation: item.material_confirmation ?? "",
    });

    // Sync cuando item cambia
    useEffect(() => {
        setFields({ part_name: item.part_name ?? "" /* ... */ });
    }, [item]);

    const setField = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) =>
        setFields((prev) => ({ ...prev, [key]: value }));

    return { fields, setField };
}
```

_Árbol de archivos propuesto:_

```
components/shared/production-item/
├── ProductionItemDetail.tsx       ← Shell de composición (~80 líneas)
├── ProductionItemAssetUpload.tsx  ← Upload de imagen/plano/render
├── ProductionItemCatalogFields.tsx ← Material, status, treatment (comboboxes)
└── hooks/
    ├── use-production-item-form.ts  ← Estado del formulario tipado
    └── use-production-item-catalogs.ts ← Fetch de materials/statuses/treatments
```

_Mejora de UX/UI:_
Sin cambio visual inmediato. Pero al aislar `ProductionItemAssetUpload`, se puede añadir progreso de carga por asset (imagen vs. plano vs. render) sin que ese estado contamine el estado del formulario principal.

**Impacto de la Mejora:**
Elimina `item: any`. El compilador detecta si Supabase cambia el shape de `production_orders`. Reduce el componente de 657 a ~80 líneas. Establece el patrón de hooks compartidos en `components/shared/` siguiendo el modelo de `components/production/hooks/`.

---

### ✅ H-04 · ~~EVALUATION-SIDEBAR + SCHEDULING-UTILS — `as any` EN TIPO DISCRIMINADO `EvaluationStep`~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
`evaluation-sidebar.tsx:285–286` contiene:

```typescript
const machineSteps = steps.filter((s) => !isTreatmentStep(s) && s.hours > 0);
// ...
const totalMachineHours = machineSteps.reduce(
    (acc, s) => acc + (s as any).hours, // ← as any innecesario
    0
);
```

El tipo `EvaluationStep = MachineStep | TreatmentStep`. `MachineStep` tiene `hours: number`. El problema es que `Array.filter()` sin un type predicate devuelve `EvaluationStep[]` en lugar de `MachineStep[]`, por lo que `.hours` no está disponible sin el cast.

El mismo patrón aparece en `scheduling-utils.ts:805`: `(step as any).hours`. El tipo `isTreatmentStep` es un type guard (`step is TreatmentStep`) pero no existe el inverso `isMachineStep`.

**Problema Detectado:**
La ausencia de un type predicate `isMachineStep` obliga a usar `as any` o `as MachineStep` en cualquier lugar donde se filtre el array de steps. Viola el principio de usar el sistema de tipos en lugar de bypasearlo (TypeScript best practice). Si `MachineStep` evoluciona (e.g., `hours` pasa a ser `hours?: number`), el `as any` silencia el error.

**Propuesta de Optimización:**

_Lógica/Código — Añadir type predicate en `scheduling-utils.ts`:_

```typescript
// lib/scheduling-utils.ts — junto a isTreatmentStep
export function isMachineStep(step: EvaluationStep): step is MachineStep {
    return !isTreatmentStep(step);
}
```

_Lógica/Código — Usar el predicate en `evaluation-sidebar.tsx`:_

```typescript
// Antes:
const machineSteps = steps.filter((s) => !isTreatmentStep(s) && s.hours > 0);
const totalMachineHours = machineSteps.reduce((acc, s) => acc + (s as any).hours, 0);

// Después:
const machineSteps = steps.filter(isMachineStep).filter((s) => s.hours > 0);
const totalMachineHours = machineSteps.reduce((acc, s) => acc + s.hours, 0); // type-safe
```

_Lógica/Código — Resolver el `as any` restante en `evaluation-modal.tsx:270–271`:_

Los campos `treatment_id` y `treatment` pertenecen al tipo de la rama treatment de `EvaluationStep`. Después de `isTreatmentStep`, TypeScript los conoce:

```typescript
// evaluation-modal.tsx:264–272 — antes:
const firstTreatment = validSteps.find(isTreatmentStep);
treatment_id: firstTreatment ? (firstTreatment as any).treatment_id || null : null,
treatment:    firstTreatment ? (firstTreatment as any).treatment || null : null,

// Después — isTreatmentStep estrecha el tipo correctamente:
const firstTreatment = validSteps.find(isTreatmentStep);
treatment_id: firstTreatment?.treatment_id ?? null,
treatment:    firstTreatment?.treatment ?? null,
```

**Impacto de la Mejora:**
Elimina los últimos 3 usos de `as any` en el módulo de producción. `scheduling-utils.ts` y `evaluation-sidebar.tsx` quedan completamente type-safe. `isMachineStep` es útil en cualquier otro lugar donde se itere sobre `EvaluationStep[]`.

---

### 🎨 H-05 · Z-INDEX LADDER — SISTEMA FRAGMENTADO CON CONFLICTOS POTENCIALES

**Análisis de Estado Actual:**
El codebase usa 8 valores de z-index diferentes sin sistema centralizado:

| Componente / Archivo                   | Valor                     | Contexto                        |
| -------------------------------------- | ------------------------- | ------------------------------- |
| `app-sidebar.tsx`                      | `z-[9999]`                | Sidebar de navegación           |
| `production-view.tsx` (fullscreen)     | `z-[9999]`                | Contenedor fullscreen del Gantt |
| `evaluation-sidebar.tsx`               | `z-[1000]`                | Panel lateral de evaluación     |
| `create-task-modal.tsx`                | `z-[1000]`                | Modal de creación de tarea      |
| `auto-plan-dialog.tsx` overlay/content | `z-[10000]` / `z-[10001]` | Diálogo de auto-planificación   |
| `scenario-comparison.tsx`              | `z-[10000]` / `z-[10001]` | Comparación de escenarios       |
| `evaluation-modal.tsx`                 | `z-[10001]`               | Modal de evaluación             |
| `blueprint-preview-dialog.tsx`         | `z-[10002]`               | Vista previa de plano           |
| `confirmation-dialogs.tsx`             | `z-[10003]`               | Diálogos de confirmación        |
| `evaluation-modal.tsx` (inner overlay) | `z-[20000]`               | Overlay de guardado interno     |

**Problema Detectado:**
Dos conflictos reales y uno latente:

1. **Conflicto `z-[9999]`**: `app-sidebar.tsx` y `production-view.tsx` en fullscreen comparten el mismo z-index. En fullscreen, el sidebar queda al mismo nivel que el contenedor del Gantt — el orden de apilamiento depende del orden en el DOM, no de la intención del diseño.

2. **Conflicto `z-[1000]`**: `evaluation-sidebar.tsx` y `create-task-modal.tsx` también comparten z-index. Si ambos están visibles simultáneamente (el modal se abre desde el Gantt mientras el sidebar está abierto), el modal podría quedar detrás del sidebar.

3. **`z-[20000]`** en `evaluation-modal.tsx:671` — el overlay de "guardando" usa un valor dos órdenes de magnitud mayor que el resto, indicando que fue añadido reactivamente para "escapar" de otros z-indexes sin planificación.

**Propuesta de Optimización:**

_Lógica/Código — Escala centralizada en Tailwind config:_

```typescript
// tailwind.config.ts — añadir escala semántica de z-index
extend: {
    zIndex: {
        'nav':      '100',    // sidebar de navegación
        'overlay':  '200',    // evaluation-sidebar, panels flotantes
        'modal':    '300',    // modales de primer nivel (create-task)
        'dialog':   '400',    // diálogos Radix (auto-plan, evaluation-modal)
        'toast':    '500',    // toasts de Sonner (siempre encima)
        'fullscreen': '600',  // contenedor fullscreen (encima de nav)
    }
}
```

```typescript
// Uso en componentes:
// app-sidebar.tsx:       z-nav      (z-index: 100)
// evaluation-sidebar:   z-overlay  (z-index: 200)
// create-task-modal:    z-modal    (z-index: 300)
// Radix dialogs:        z-dialog   (z-index: 400)
// production fullscreen: z-fullscreen (z-index: 600 — encima del sidebar)
```

_Mejora de UX/UI:_
En fullscreen, el sidebar queda correctamente _detrás_ del canvas (`z-nav` < `z-fullscreen`). Los modales nunca quedan detrás de los sidebars. El `z-[20000]` del overlay de guardado en evaluation-modal se reduce a `z-dialog + 10` sin números mágicos.

**Impacto de la Mejora:**
Previene bugs de apilamiento que hoy solo no se ven porque el QA no ha ejercitado las combinaciones de estados simultáneos (fullscreen + sidebar abierto, eval-sidebar + create-task-modal). La escala semántica hace que cualquier nuevo componente sepa dónde ubicarse.

---

### 🎨 H-06 · EVALUATION-MODAL — CRECIENDO HACIA MONOLITO (711 LÍNEAS)

**Análisis de Estado Actual:**
`evaluation-modal.tsx` tiene 711 líneas mezclando: (1) lógica de estado del formulario de evaluación, (2) panel de plano SVG con visor, (3) lista de pasos de maquinado con drag & drop, (4) lógica de guardado a Supabase, y (5) renderizado del drawer/dialog completo.

**Problema Detectado:**
El patrón que originó la descomposición de `evaluation-sidebar.tsx` (2000 → 395 líneas en H-03 iteración 2) se está repitiendo. Si la evaluación necesita un nuevo tipo de paso (e.g., sub-contratación) o un cambio en el UI del visor, cualquier developer tiene que navegar 711 líneas para encontrar el lugar correcto. No hay hooks de dominio para la lógica de evaluación del modal — toda está inline.

Además, `z-[10001]` hardcodeado en el DialogContent (relacionado con H-05) y la línea 671 con `z-[20000]` para el "saving overlay" serían más fáciles de gestionar si la estructura fuera más simple.

**Propuesta de Optimización:**

_Árbol de refactorización:_

```
components/production/evaluation/
├── (existentes) EvaluationFilterPanel.tsx
├── (existentes) EvaluationFormHeader.tsx
├── (existentes) EvaluationOrderList.tsx
├── (existentes) EvaluationStepRow.tsx
├── (nuevo) EvaluationStepList.tsx    ← lista drag & drop de pasos
├── (nuevo) EvaluationDrawingPanel.tsx ← visor de plano + iframe
└── (nuevo) hooks/
    └── use-evaluation-save.ts        ← lógica de guardado a Supabase
```

```typescript
// use-evaluation-save.ts — extraer toda la lógica de save de evaluation-modal
export function useEvaluationSave({ order, validSteps, urgencia, onSuccess, onNext, onClose }) {
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSave = async (hasNext: boolean) => {
        setIsSaving(true);
        try {
            const firstTreatment = validSteps.find(isTreatmentStep);
            const { error } = await supabase
                .from("production_orders")
                .update({
                    evaluation: validSteps as unknown as Json,
                    urgencia,
                    treatment_id: firstTreatment?.treatment_id ?? null,
                    treatment: firstTreatment?.treatment ?? null,
                })
                .eq("id", order.id);

            if (error) throw error;
            toast.success("Evaluación guardada correctamente");
            onSuccess(validSteps, urgencia);
            router.refresh();
            hasNext && onNext ? onNext() : onClose();
        } catch (e: any) {
            toast.error("Error al guardar la evaluación: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return { isSaving, handleSave };
}
```

_Mejora de UX/UI:_
El visor de plano, al ser un componente dedicado, puede implementar lazy loading del iframe sin re-renderizar el formulario de evaluación.

**Impacto de la Mejora:**
`evaluation-modal.tsx` pasaría de 711 a ~150 líneas de pura composición. `use-evaluation-save.ts` es testeable unitariamente. Establece el patrón correcto para cualquier nuevo modal de evaluación.

---

### ✅ H-07 · ~~QUOTE-PDF — PROPS COMPLETAMENTE SIN TIPO~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
`components/sales/quote-pdf.tsx:241` declara:

```typescript
export function QuotePDF({ data, items }: { data: any, items: any[] }) {
```

El componente accede a `data.quote_number`, `data.date`, `data.client`, `data.items`, `items` y sus campos (`item.part_code`, `item.part_name`, `item.quantity`, `item.unit_price`, etc.) sin contrato TypeScript.

**Problema Detectado:**
El PDF es el documento que el cliente recibe. Si un campo cambia de nombre en la base de datos (e.g., `unit_price` → `price_per_unit`), el PDF generará celdas vacías sin ningún error de compilación. Es el contrato más visible con el cliente externo y el menos protegido por TypeScript.

**Propuesta de Optimización:**

_Lógica/Código — Tipar con los tipos de Supabase:_

```typescript
import { Database } from "@/utils/supabase/types";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItemRow = Database["public"]["Tables"]["quote_items"]["Row"] & {
    production_orders?: Database["public"]["Tables"]["production_orders"]["Row"] | null;
};

export function QuotePDF({ data, items }: { data: QuoteRow; items: QuoteItemRow[] }) {
    // Ahora data.quote_number y items[n].unit_price son type-safe
}
```

_Mejora de UX/UI:_
Sin cambio visual. Pero si el formato del PDF cambia, el compilador guía al developer a actualizar todos los accesos de campo.

**Impacto de la Mejora:**
El documento más crítico para el cliente queda bajo el mismo nivel de protección de tipos que el resto del sistema.

---

### ✅ H-08 · ~~SHARED COMPONENTS — DEUDA DE `any` EN COMPONENTES DE USO GENERAL~~ [RESUELTO — 2026-04-15]

**Análisis de Estado Actual:**
Varios componentes en `components/shared/` tienen contratos débiles:

- `production-item-summary.tsx:9` — `item: any`
- `projects-filter.tsx:25` — `onUpdate: (key: keyof ProjectFilters, value: any) => void`
- `projects-table.tsx:35` — `onSort: (field: any) => void`
- `data-audit-table.tsx:60` — `onSelectProject: (project: any) => void`

**Problema Detectado:**
Los componentes en `shared/` son los más reutilizados en la app — aparecen en Ventas, Logística y Producción. Un callback `onSort: (field: any)` hace imposible que el IDE sugiera los campos válidos para ordenar, y deja silencioso cualquier typo (`"part_cde"` en lugar de `"part_code"`).

**Propuesta de Optimización:**

_Lógica/Código — Patrón mínimo con generics:_

```typescript
// projects-table.tsx — antes:
onSort: (field: any) => void;

// Después — generic tipado con los campos de la tabla:
type ProjectSortField = "code" | "company" | "delivery_date" | "status" | "created_at";
onSort: (field: ProjectSortField) => void;

// data-audit-table.tsx — antes:
onSelectProject: (project: any) => void;

// Después — usar el tipo de Supabase
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
onSelectProject: (project: ProjectRow) => void;
```

**Impacto de la Mejora:**
Bajo esfuerzo, alto valor de DX. El IDE autocompleta los campos válidos al llamar `onSort("...")`. Cualquier refactor de columnas genera errores de compilación en lugar de bugs silenciosos.

---

## 4. IDEAS DE INNOVACIÓN (BONUS)

### 💡 1. CACHE DE CATÁLOGOS COMPARTIDO CON REACT QUERY / SWR

Actualmente, `production-item-detail.tsx` fetcha `materials`, `statuses` y `treatments` en un `useEffect` al montar. Si hay 10 partidas abiertas simultáneamente en el panel de Ventas, se hacen 30 requests idénticos a Supabase.

**Propuesta:**

```typescript
// hooks/use-catalog-data.ts — fetch compartido con SWR
import useSWR from "swr";

const CATALOG_CACHE_KEY = "catalog-data";

export function useCatalogData() {
    const { data, isLoading } = useSWR(
        CATALOG_CACHE_KEY,
        () => getCatalogData(),
        { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 } // 5 min cache
    );

    return {
        materials: data?.materials ?? [],
        statuses: data?.statuses ?? [],
        treatments: data?.treatments ?? [],
        isLoading,
    };
}
```

**Impacto:** Una sola request por sesión para datos de catálogo. El hook es reutilizable desde cualquier componente que necesite `materials` o `treatments`. La deduplicación de SWR garantiza que N instancias del componente comparten la misma promesa en vuelo.

---

### 💡 2. TABLA DE AUDITORÍA VISUAL PARA EL MÓDULO DE ALMACÉN

`InventoryView` hoy muestra stock actual. La siguiente capa de valor es mostrar la **trayectoria de stock**: cuándo se consumió cada ítem, quién lo registró, y qué lote queda. La tabla de datos ya contiene esta info si se loguea el consumo.

**Propuesta:**

```typescript
// Nuevo campo en inventory_items o tabla audit_log ligada al inventario
type InventoryAuditRow = {
    id: string;
    item_id: string;
    action: "entrada" | "salida" | "ajuste";
    quantity_delta: number;
    performed_by: string;
    notes: string | null;
    created_at: string;
};

// En InventoryView — tab "Historial" junto a "Stock actual"
<Tabs defaultValue="stock">
    <TabsList>
        <TabsTrigger value="stock">Stock Actual</TabsTrigger>
        <TabsTrigger value="history">Historial de Movimientos</TabsTrigger>
    </TabsList>
    <TabsContent value="history">
        <InventoryAuditTable itemId={selectedItem?.id} />
    </TabsContent>
</Tabs>
```

**Impacto:** El almacenista puede rastrear cuándo se agotó un inserto y quién fue el último en registrar salida. Conecta directamente con la innovación propuesta en auditoría anterior (consumo automático desde Gantt). Una semana de trabajo sobre el módulo ya construido.

---

### 💡 3. SKELETON LOADING CONSISTENTE EN TODOS LOS MÓDULOS

El módulo de Producción tiene `ProductionViewSkeleton` bien implementado. Los módulos de Ventas, Almacén y Admin no tienen skeletons — muestran pantalla en blanco mientras cargan.

**Propuesta — sistema de skeletons genéricos:**

```tsx
// components/ui/skeleton.tsx — extender con variantes por módulo
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="rounded-md border">
            <div className="border-b p-3">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="mr-4 inline-block h-4 w-24" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 border-b p-3">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
        </div>
    );
}
```

**Impacto:** Percepción de rendimiento uniforme en toda la app. El usuario sabe que la app está cargando (Nielsen Heurística #1 — Visibility of system status) en lugar de ver pantalla en blanco. `TableSkeleton` se puede usar en `InventoryView`, `DataAuditTable`, y la vista de proyectos de Ventas sin trabajo adicional.

---

## 5. ÍNDICE DE HALLAZGOS

| ID   | Componente / Archivo                                                                                                             | Severidad | Categoría                | Estado                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------ | ------------------------ |
| H-01 | `components/production/production-view.tsx` (línea 26, 104)                                                                      | Alta      | Tipado / Regresión       | ✅ RESUELTO — 2026-04-15 |
| H-02 | `components/production/machining-view.tsx` (línea 68, 90) / `create-task-modal.tsx` (línea 163, 180)                             | Alta      | UX / Consistencia        | ✅ RESUELTO — 2026-04-15 |
| H-03 | `components/shared/production-item-detail.tsx`                                                                                   | Alta      | Arquitectura / Tipado    | ✅ RESUELTO — 2026-04-15 |
| H-04 | `components/production/evaluation-sidebar.tsx` (línea 286) / `evaluation-modal.tsx` (líneas 270–271) / `lib/scheduling-utils.ts` | Media     | Tipado / Type predicates | ✅ RESUELTO — 2026-04-15 |
| H-05 | `components/production/` (múltiples — z-index ladder)                                                                            | Media     | UI / Stacking context    | ✅ RESUELTO — 2026-04-15 |
| H-06 | `components/production/evaluation-modal.tsx`                                                                                     | Media     | Arquitectura / SRP       | Pendiente                |
| H-07 | `components/sales/quote-pdf.tsx` (línea 241)                                                                                     | Baja      | Tipado / DX              | ✅ RESUELTO — 2026-04-15 |
| H-08 | `components/shared/` (múltiples — `any` en callbacks)                                                                            | Baja      | Tipado / DX              | ✅ RESUELTO — 2026-04-15 |

**Calificación proyectada al cerrar H-01 a H-04: 8.8 / 10**

---

## 6. PLAN DE IMPLEMENTACIÓN

> Cada sprint es de **2–3 días de trabajo**. Los ítems dentro de un sprint son independientes entre sí.

---

### SPRINT 1 — DEUDA VISIBLE: TIPOS Y ALERTAS

**Objetivo:** Cerrar la regresión de tipado de iteración anterior y eliminar todos los `alert()` del codebase.
**Fecha objetivo:** 2026-04-18

#### ✅ Tarea 1.1 — H-01: Completar tipado en `production-view.tsx` y `machining-view.tsx` — COMPLETADA 2026-04-15

- **Solución aplicada:**
    - `production-view.tsx`: eliminada `type PlanningTask` local. Añadido `import { GanttPlanningTask, GanttModalData } from "./types"`. `tasks`, `planningAlerts` y `machineGroups` ahora usan `GanttPlanningTask`. `useState<any>(null)` → `useState<GanttModalData | null>(null)`.
    - `machining-view.tsx`: eliminadas definiciones locales de `Order` y `PlanningTask`. Añadido `import { GanttPlanningTask } from "./types"`. Props e internos actualizados.
    - `hooks/use-machining-tour.ts`: eliminadas definiciones locales. Añadido `import { GanttPlanningTask } from "@/components/production/types"`. Todas las referencias actualizadas (props, return type, demo task cast).
    - `tsc --noEmit` pasa sin errores. Cero ocurrencias de `useState<any>` en el módulo de producción.

#### ✅ Tarea 1.2 — H-02: Reemplazar `alert()` con `toast.error()` e inline errors — COMPLETADA 2026-04-15

- **Solución aplicada:**
    - `machining-view.tsx`: añadido `import { toast } from "sonner"`. Los 2 `alert()` reemplazados por `toast.error()` con prefijo de contexto en `console.error`.
    - `create-task-modal.tsx`: añadido `import { toast } from "sonner"` y `useState<string | null>(null)` para `formError`. La validación de campos ahora llama a `setFormError(...)` en lugar de `alert()`. El error de red llama a `toast.error(...)`. `setFormError(null)` se ejecuta al abrir el modal (en `useEffect`) y antes de la llamada a la API. Mensaje inline con estilo `bg-destructive/10 text-destructive` insertado en el JSX antes de los botones.
    - `tsc --noEmit` pasa sin errores. `grep -rn 'alert(' components/` devuelve cero resultados.

---

### SPRINT 2 — TIPADO PROFUNDO: EVALSTEP Y SHARED

**Objetivo:** Eliminar los últimos `as any` en el módulo de evaluación y fortalecer los contratos de los componentes compartidos.
**Fecha objetivo:** 2026-04-22

#### ✅ Tarea 2.1 — H-04: Añadir `isMachineStep` type predicate — COMPLETADA 2026-04-15

- **Solución aplicada:**
    - `lib/scheduling-utils.ts`: añadido `export function isMachineStep(s: EvaluationStep): s is MachineStep` junto a `isTreatmentStep`, con JSDoc explicativo.
    - `evaluation-sidebar.tsx`: actualizado import para incluir `isMachineStep`. `steps.filter((s) => !isTreatmentStep(s) && s.hours > 0)` → `steps.filter(isMachineStep).filter((s) => s.hours > 0)`. `(s as any).hours` → `s.hours` (type-safe).
    - `evaluation-modal.tsx`: `(firstTreatment as any).treatment_id || null` → `firstTreatment?.treatment_id ?? null`. Ídem para `.treatment`. El narrowing de `isTreatmentStep` ya expone ambos campos directamente.
    - `tsc --noEmit` pasa sin errores. Cero `as any` en `evaluation-sidebar.tsx` y `evaluation-modal.tsx`.

#### ✅ Tarea 2.2 — H-07 + H-08: Tipar `QuotePDF` y callbacks en `shared/` — COMPLETADA 2026-04-15

- **Solución aplicada:**
    - `quote-pdf.tsx`: creadas interfaces explícitas `QuotePDFData` (19 campos nullable reflejando la realidad del dato) y `QuotePDFItem` (4 campos). Extraída constante `currency: string` con fallback `?? 'MXN'` para resolver usos en `formatCurrency`. Firma de `formatDate` actualizada a `string | null | undefined`. El tipado reveló y corrigió el cálculo de `taxPercent` que usaba `data.tax_rate` directamente sin null guard — ahora usa `const taxRate = data.tax_rate ?? 0`.
    - `projects-table.tsx`: añadido `type ProjectSortField = 'code' | 'name' | 'delivery_date' | 'progress' | 'parts_count'`. Reemplazado `onSort: (field: any)` por `onSort: (field: ProjectSortField)`.
    - `data-audit-table.tsx`: reemplazado `onSelectProject: (project: any)` por `onSelectProject: (project: Project)`. Ambas instancias de `isMissing: (val: any)` actualizadas a `isMissing: (val: unknown)`.
    - `tsc --noEmit` pasa sin errores. Cero `any` en contratos de interfaz en los tres archivos.

---

### SPRINT 3 — ARQUITECTURA: SHARED Y Z-INDEX

**Objetivo:** Descomponer el componente compartido más crítico y establecer la escala de z-index.
**Fecha objetivo:** 2026-04-27

#### ✅ Tarea 3.1 — H-03: Tipar y dividir `production-item-detail.tsx` — COMPLETADA 2026-04-15

- **Archivos:** `components/shared/production-item-detail.tsx` → directorio `components/shared/production-item/`
- **Pasos:**
    1. Definir `type ProductionItemDetailProps` con `Pick<ProductionOrder, ...>` en lugar de `item: any`.
    2. Crear `hooks/use-production-item-form.ts` con los 11 campos de edición como un solo objeto de estado.
    3. Crear `ProductionItemAssetUpload.tsx` con la lógica de upload de imagen/plano/render.
    4. Reducir `ProductionItemDetail.tsx` al shell de composición que importa ambos.
    5. Actualizar imports en los consumidores del componente.
- **Criterio de aceptación:** `production-item-detail.tsx` (o su equivalente) ≤ 120 líneas. `item: any` eliminado. `tsc --noEmit` pasa.

#### ✅ Tarea 3.2 — H-05: Sistema de z-index semántico — COMPLETADA 2026-04-15

- **Archivos:** `tailwind.config.ts`, y los 8+ componentes con z-index hardcodeados
- **Pasos:**
    1. Añadir la escala `zIndex` en `tailwind.config.ts` (nav/overlay/modal/dialog/toast/fullscreen).
    2. Reemplazar los valores hardcodeados en cada componente por las clases semánticas.
    3. Verificar que en fullscreen el sidebar queda por detrás del canvas.
- **Criterio de aceptación:** `grep -rn "z-\[" components/` devuelve cero resultados (todos reemplazados por clases semánticas). Probar: abrir fullscreen con sidebar visible — canvas debe cubrir el sidebar correctamente.
