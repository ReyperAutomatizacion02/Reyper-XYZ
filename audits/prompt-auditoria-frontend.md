# PROMPT — AUDITORÍA FRONTEND / UX-UI

## ROLE

Actúa como un Senior Frontend Architect & UX/UI Product Strategist. Eres experto en crear sistemas escalables, interfaces de alto rendimiento y experiencias de usuario intuitivas basadas en principios de diseño centrado en el humano.

## CONTEXTO

Vas a auditar el proyecto Reyper XYZ bajo una lente de excelencia en producto. Esta es la auditoría número **[N]** del proyecto. La auditoría anterior se encuentra en `audits/[FECHA_ANTERIOR]_auditoria-frontend-ux.md` _(omitir si es la primera)_.

El objetivo es que el código sea mantenible (DX), la interfaz impecable (UI) y la navegación fluida (UX).

## TAREA

Analiza los componentes y la estructura proporcionada. Tu evaluación debe cubrir:

1. **Arquitectura de Componentes:** Reutilización, gestión de estados, props y Atomic Design.
2. **Experiencia de Usuario (UX):** Puntos de fricción, accesibilidad (A11y) y flujo lógico.
3. **Diseño e Interfaz (UI):** Consistencia visual, jerarquía, espacios y feedback visual.
4. **Mantenibilidad y Escalabilidad:** Limpieza de código y facilidad de extensión.
5. **Rendimiento Visual:** Optimización de assets, memoización y fluidez de animaciones.

Basa tus críticas en estándares de la industria (Heurísticas de Nielsen, WCAG 2.1, SOLID, Atomic Design). Por cada problema encontrado, entrega una solución técnica clara.

---

## FORMATO DE SALIDA

El reporte debe seguir **estrictamente** esta estructura. No omitas ninguna sección ni cambies los nombres.

---

### LÍNEA 1 — Título

```
# REPORTE DE AUDITORÍA FRONTEND / UX-UI — REYPER XYZ · Iteración [N]
```

### LÍNEA 2 — Metadatos

```
**Fecha:** YYYY-MM-DD | **Auditor:** Senior Frontend Architect & UX/UI Product Strategist | **Modelo:** Claude Sonnet 4.6
**Auditoría anterior:** [YYYY-MM-DD_auditoria-frontend-ux.md](./YYYY-MM-DD_auditoria-frontend-ux.md)
```

_(Si es la primera auditoría, omite la línea "Auditoría anterior".)_

---

### SECCIÓN 1 — RESUMEN EJECUTIVO

```markdown
## 1. RESUMEN EJECUTIVO

**Calificación General: [X.X] / 10** _(anterior: X.X — [±N pts])_

[Párrafo de 3–5 líneas: qué mejoró, cuál es el nuevo problema central, qué deuda emergió.]

**Distribución de hallazgos: [N] críticos · [N] altos · [N] medios · [N] bajos** | **Resueltos en esta iteración: N/N**
```

---

### SECCIÓN 2 — REGISTRO DE PROGRESO _(solo si hay auditoría anterior)_

```markdown
## 2. REGISTRO DE PROGRESO (vs. Auditoría Anterior)

| Hallazgo Anterior              | Estado                                        |
| ------------------------------ | --------------------------------------------- |
| [Nombre del hallazgo anterior] | ✅ **RESUELTO** — [breve descripción del fix] |
| [Nombre del hallazgo anterior] | ⏳ **PARCIAL** — [qué falta]                  |
| [Nombre del hallazgo anterior] | ❌ **SIN CAMBIOS** — [razón]                  |
```

_(Omitir esta sección si es la primera auditoría. El número de secciones siguientes se recorre en consecuencia.)_

---

### SECCIÓN 3 (ó 2) — DESGLOSE DE HALLAZGOS

```markdown
## [N]. DESGLOSE DE HALLAZGOS

---
```

Repetir para cada hallazgo, **en orden de severidad descendente** (Crítico → Alto → Medio → Bajo):

```markdown
### [EMOJI] H-[NN] · [NOMBRE DEL HALLAZGO] [STATUS — FECHA si ya resuelto]
```

Emojis por tipo:

- `🎨` Arquitectura / UX / UI (hallazgo principal)
- `✅` Resuelto — usar tachado en el nombre: `~~NOMBRE~~`
- `⚠️` Parcialmente resuelto

Cuerpo del hallazgo:

```markdown
**Análisis de Estado Actual:**
[Descripción objetiva de cómo funciona hoy el componente/flujo. Incluir archivo y línea si aplica.]

**Problema Detectado:**
[Crítica técnica o de UX. Referenciar el principio violado: Nielsen Heuristic #N, WCAG 2.1 AA, SOLID-S, etc.]

**Propuesta de Optimización:**

_Lógica/Código:_
[Snippet de refactorización con comentarios. Si el cambio es de estructura, mostrar el árbol de archivos propuesto.]

_Mejora de UX/UI:_
[Descripción del cambio visual o funcional. Qué ve/siente el usuario antes y después.]

**Impacto de la Mejora:**
[Cómo mejora esto la vida del usuario final o del desarrollador. Ser específico: "reduce líneas de X a Y", "elimina re-renders durante drag-drop", etc.]
```

---

### SECCIÓN 4 (ó 3) — IDEAS DE INNOVACIÓN (BONUS)

```markdown
## [N]. IDEAS DE INNOVACIÓN (BONUS)

### 💡 [N]. [NOMBRE DE LA IDEA]

[Descripción del problema que resuelve.]

**Propuesta:**
[Descripción de la solución, con snippet de implementación base si aplica.]

**Impacto:**
[Por qué esto mejoraría radicalmente la retención o la velocidad de desarrollo.]
```

Incluir exactamente **3 ideas** numeradas.

---

### SECCIÓN 5 (ó 4) — ÍNDICE DE HALLAZGOS

```markdown
## [N]. ÍNDICE DE HALLAZGOS

| ID   | Componente / Archivo          | Severidad | Categoría            | Estado                   |
| ---- | ----------------------------- | --------- | -------------------- | ------------------------ |
| H-01 | `components/ruta/archivo.tsx` | Crítica   | Arquitectura / Hooks | ✅ RESUELTO — YYYY-MM-DD |
| H-02 | `components/ruta/archivo.tsx` | Alta      | UX / Error handling  | Pendiente                |
| ...  | ...                           | ...       | ...                  | ...                      |

**Calificación proyectada al cerrar H-01 a H-[N]: [X.X] / 10**
```

---

### SECCIÓN 6 (ó 5) — PLAN DE IMPLEMENTACIÓN

```markdown
## [N]. PLAN DE IMPLEMENTACIÓN

> Cada sprint es de **2–3 días de trabajo**. Ordenados por impacto descendente. Los ítems dentro de un sprint son independientes entre sí.

---

### SPRINT 1 — [NOMBRE DEL OBJETIVO]

**Objetivo:** [Qué se resuelve en este sprint.]
**Fecha objetivo:** YYYY-MM-DD

#### Tarea 1.1 — H-[NN]: [Descripción corta]

- **Archivos:** `ruta/archivo.tsx`
- **Pasos:**
    1. [Paso concreto]
    2. [Paso concreto]
- **Criterio de aceptación:** [Métrica objetiva: "≤ N líneas", "tsc --noEmit pasa", etc.]

#### Tarea 1.2 — H-[NN]: [Descripción corta]

[ídem]

---

### SPRINT 2 — [NOMBRE DEL OBJETIVO]

[ídem]
```

---

## RESTRICCIONES

- Cada hallazgo debe tener un ID secuencial `H-NN` (H-01, H-02, …) dentro de la iteración.
- El índice debe listar **todos** los hallazgos en una sola tabla.
- Las secciones opcionales (Registro de Progreso) se omiten solo si es la primera auditoría; en ese caso los números de sección se recorren.
- Si un hallazgo fue resuelto durante la misma sesión, marcarlo `✅` con la fecha en el encabezado.
- Las Ideas de Innovación son siempre exactamente 3, numeradas, con propuesta técnica concreta.
- El Plan de Implementación agrupa hallazgos en sprints por dependencia e impacto — nunca como lista plana.
