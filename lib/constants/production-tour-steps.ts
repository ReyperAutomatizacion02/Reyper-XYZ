import { type TourStep } from "@/hooks/use-tour";

/**
 * Static step definitions for the production Gantt tour.
 *
 * Steps at index 6 and 7 have dynamic `onHighlightStarted` callbacks
 * that depend on runtime state (modal data, demo tasks). Those callbacks
 * are injected by `useProductionTour` — the base data lives here.
 */
export const PRODUCTION_TOUR_STEPS: TourStep[] = [
    {
        element: "#planning-gantt-area",
        popover: {
            title: "Área de Gantt",
            description:
                "Visualiza y gestiona la producción. Haz DOBLE CLIC en un espacio vacío para crear una tarea, o en una tarea existente para editarla.",
            side: "top",
            align: "center",
        },
    },
    {
        element: "#planning-view-modes",
        popover: {
            title: "Modos de Vista",
            description: "Cambia la escala de tiempo entre Hora, Día y Semana.",
            side: "bottom",
            align: "start",
        },
    },
    {
        element: "#planning-machine-filter",
        popover: {
            title: "Filtro de Máquinas",
            description: "Selecciona qué máquinas quieres ver en el diagrama.",
            side: "bottom",
        },
    },
    {
        element: "#planning-search",
        popover: {
            title: "Buscador de Piezas",
            description: "Resalta rápidamente las tareas relacionadas con una pieza o código específico.",
            side: "bottom",
        },
    },
    {
        element: "#planning-settings",
        popover: {
            title: "Configuración",
            description: "Personaliza la visualización, como mostrar/ocultar líneas de dependencia.",
            side: "bottom",
        },
    },
    {
        element: "#planning-fullscreen",
        popover: {
            title: "Pantalla Completa",
            description: "Maximiza el área de trabajo para tener una mejor visión de toda la planta.",
            side: "left",
        },
    },
    // Index 6 — onHighlightStarted: () => setModalData(null)  [injected by hook]
    {
        element: "#planning-gantt-area",
        popover: {
            title: "Creación de Tareas",
            description: "Al hacer doble clic, se abrirá el formulario de tarea.",
            side: "top",
        },
    },
    // Index 7 — onHighlightStarted: () => setModalData({...demo})  [injected by hook]
    {
        element: "#task-modal-content",
        popover: {
            title: "Formulario de Tarea",
            description: "Aquí se abrirá el formulario. Llénalo con la información del trabajo.",
            side: "left",
            align: "center",
        },
    },
    {
        element: "#task-modal-order",
        popover: {
            title: "Selección de Pieza",
            description: "Busca y selecciona la orden de producción o pieza a maquinar.",
            side: "right",
        },
    },
    {
        element: "#task-modal-start",
        popover: {
            title: "Inicio Programado",
            description: "Define la fecha y hora de inicio.",
            side: "right",
        },
    },
    {
        element: "#task-modal-end",
        popover: {
            title: "Fin Estimado",
            description: "El sistema calculará el fin automáticamente, pero puedes ajustarlo.",
            side: "right",
        },
    },
    {
        element: "#task-modal-operator",
        popover: {
            title: "Asignación de Operador",
            description: "Asigna un operador responsable a esta tarea.",
            side: "top",
        },
    },
    {
        element: "#task-modal-save",
        popover: {
            title: "Guardar Cambios",
            description: "Guarda la tarea para reflejarla en el tablero de todos los usuarios.",
            side: "top",
        },
    },
];
