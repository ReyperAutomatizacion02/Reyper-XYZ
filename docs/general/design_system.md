# Sistema de Diseño

El diseño de Reyper XYZ prioriza la claridad, la modernidad y la eficiencia visual. Se utiliza un enfoque de diseño "Premium" con atención al detalle en micro-interacciones.

## Paleta de Colores

| Color | Hex | Uso |
| :--- | :--- | :--- |
| **Rojo Reyper** | `#EC1C21` | Acción principal, alertas críticas, identidad de marca. |
| **Gris Neutro** | `#676161` | Textos secundarios, bordes sutiles, fondos neutros. |
| **Fondo Claro** | `#FFFFFF` | Fondo principal en modo claro. |
| **Fondo Oscuro** | `#0f172a` | (Slate-900) Fondo principal en modo oscuro. |

## Tipografía
Se utiliza una familia sans-serif moderna (ej. *Inter* o *Geist*) para garantizar legibilidad en interfaces densas de datos.

## Componentes UI (Shadcn/UI + Tailwind)

El sistema está construido sobre **Tailwind CSS** y utiliza componentes de **Shadcn/UI** para mantener la consistencia.

### Botones
*   **Primario**: Fondo Rojo Reyper, texto blanco. Tienen efectos de hover sutiles.
*   **Secundario**: Borde gris, fondo transparente.
*   **Fantasma**: Solo texto, para acciones de menor jerarquía.

### Layout
*   **Sidebar**: Colapsable, persistente a la izquierda. Contiene la navegación principal.
*   **Header**: Barra superior con información del usuario logueado y controles globales (tema).
*   **Main Content**: Área de trabajo central, diseñada para expandirse y aprovechar el ancho de pantalla.

### Feedback Visual
*   **Spinners/Skeletons**: Indicadores de carga para todas las peticiones de datos.
*   **Toasts**: Notificaciones flotantes (Sonner) para confirmar acciones (ej. "Guardado exitosamente").
*   **Animaciones**: Transiciones suaves (Framer Motion) al abrir modales o cambiar de página.
