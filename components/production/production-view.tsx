"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import { Calendar as CalendarIcon } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { format, startOfDay, isBefore, isSameDay } from "date-fns";
import {
    updateTaskSchedule,
    batchSavePlanning,
    toggleTaskLocked,
    clearOrderEvaluation,
} from "@/app/dashboard/produccion/actions";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import { ProductionViewSkeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { useTour, TourStep } from "@/hooks/use-tour";
import { toast } from "sonner";
import {
    generateAutomatedPlanning,
    SchedulingResult,
    SchedulingStrategy,
    getNextValidWorkTime,
    snapToNext15Minutes,
    OrderWithRelations,
    WorkShift,
    DEFAULT_SHIFTS,
} from "@/lib/scheduling-utils";
import { StrategyToolbar } from "./strategy-toolbar";
import { GanttControls, ProjectOption } from "./gantt-controls";
import { EvaluationSidebar } from "./evaluation-sidebar";
import { ConfirmationDialogs } from "./confirmation-dialogs";
import { useEvaluationFilters } from "./hooks/use-evaluation-filters";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
    startMs?: number;
    endMs?: number;
};

interface ProductionViewProps {
    machines: Machine[];
    orders: OrderWithRelations[];
    tasks: PlanningTask[];
    operators: string[];
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    shifts?: WorkShift[];
}

export function ProductionView({
    machines,
    orders,
    tasks,
    operators,
    treatments,
    shifts = DEFAULT_SHIFTS,
}: ProductionViewProps) {
    const router = useRouter();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [projectFilter, setProjectFilter] = useState<string[]>([]);
    const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

    // User preferences
    const {
        getGanttPrefs,
        updateGanttPref,
        getEvalPrefs,
        updateEvalPref,
        isLoading: prefsLoading,
    } = useUserPreferences();
    const ganttPrefs = getGanttPrefs();

    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");
    const [showDependencies, setShowDependencies] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [hideEmptyMachines, setHideEmptyMachines] = useState(true);
    const [cascadeMode, setCascadeMode] = useState(false);
    const [prefsInitialized, setPrefsInitialized] = useState(false);

    // Evaluation States
    const [isEvalListOpen, setIsEvalListOpen] = useState(false);
    const [selectedOrderForEval, setSelectedOrderForEval] = useState<Order | null>(null);

    // Draft Tasks for Auto-Plan Preview
    const [draftTasks, setDraftTasks] = useState<PlanningTask[]>([]);

    // Live Strategy States
    const [activeStrategy, setActiveStrategy] = useState<SchedulingStrategy | "NONE">("NONE");
    const [localOrders, setLocalOrders] = useState<Order[]>(orders);
    const [strategyFilters] = useState({
        onlyWithCAD: false,
        onlyWithBlueprint: false,
        onlyWithMaterial: false,
        requireTreatment: false,
    });

    // Confirmation states
    const [idToClearEval, setIdToClearEval] = useState<string | null>(null);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

    // Evaluation filters hook
    const evalFilters = useEvaluationFilters(orders as OrderWithRelations[], {
        isLoading: prefsLoading,
        getEvalPrefs,
        updateEvalPref,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !prefsInitialized) {
            if (ganttPrefs.viewMode) setViewMode(ganttPrefs.viewMode);
            if (ganttPrefs.showDependencies !== undefined) setShowDependencies(ganttPrefs.showDependencies);
            if (ganttPrefs.zoomLevel) setZoomLevel(ganttPrefs.zoomLevel);
            if (ganttPrefs.hideEmptyMachines !== undefined) setHideEmptyMachines(ganttPrefs.hideEmptyMachines);
            if (ganttPrefs.projectFilter) setProjectFilter(ganttPrefs.projectFilter);
            if (ganttPrefs.cascadeMode !== undefined) setCascadeMode(ganttPrefs.cascadeMode);
            setPrefsInitialized(true);
        }
    }, [prefsLoading, prefsInitialized, ganttPrefs]);

    // Save viewMode preference
    const handleViewModeChange = (newMode: "hour" | "day" | "week") => {
        setViewMode(newMode);
        setZoomLevel(1);
        updateGanttPref({ viewMode: newMode, zoomLevel: 1 });
    };

    const handleShowDependenciesChange = (value: boolean) => {
        setShowDependencies(value);
        updateGanttPref({ showDependencies: value });
    };

    const handleHideEmptyMachinesChange = (value: boolean) => {
        setHideEmptyMachines(value);
        updateGanttPref({ hideEmptyMachines: value });
    };

    const handleProjectFilterChange = (newFilter: string[]) => {
        setProjectFilter(newFilter);
        updateGanttPref({ projectFilter: newFilter });
    };

    const handleCascadeModeChange = (value: boolean) => {
        setCascadeMode(value);
        updateGanttPref({ cascadeMode: value });
    };

    const confirmClearEvaluation = async (orderId: string) => {
        try {
            await clearOrderEvaluation(orderId);
            toast.success("Evaluación limpiada exitosamente");
            router.refresh();
            setIdToClearEval(null);
        } catch (error) {
            console.error(error);
            toast.error("Error al limpiar evaluación");
        }
    };

    const handleDiscardDrafts = () => {
        setDraftTasks([]);
        toast.info("Planeación automática descartada");
    };

    const handleSaveAllPlanning = async () => {
        if (draftTasks.length === 0 && changedTasks.length === 0) return;

        toast.loading("Guardando planeación...", { id: "save-planning" });

        try {
            await batchSavePlanning(draftTasks, changedTasks);
            toast.success("Planeación guardada con éxito", { id: "save-planning" });
            setDraftTasks([]);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar la planeación", { id: "save-planning" });
        }
    };

    const handleZoomChange = (newZoom: number | ((prev: number) => number)) => {
        setZoomLevel((prev) => {
            const resolvedZoom = typeof newZoom === "function" ? newZoom(prev) : newZoom;
            updateGanttPref({ zoomLevel: resolvedZoom });
            return resolvedZoom;
        });
    };

    // State lifted from GanttSVG
    const [savedTasks, setSavedTasks] = useState<PlanningTask[]>(tasks);
    const [optimisticTasks, setOptimisticTasks] = useState<PlanningTask[]>(tasks);
    const [history, setHistory] = useState<PlanningTask[][]>([]);
    const [future, setFuture] = useState<PlanningTask[][]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Lock/Unlock handler
    const handleToggleLock = async (taskId: string, locked: boolean) => {
        setOptimisticTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, locked } : t)));
        try {
            await toggleTaskLocked(taskId, locked);
        } catch {
            setOptimisticTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, locked: !locked } : t)));
            toast.error("Error al cambiar bloqueo");
        }
    };

    // Live Strategy Draft Computation — debounced to avoid recalculating on every keystroke
    const [liveDraftResult, setLiveDraftResult] = useState<SchedulingResult | null>(null);
    const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (activeStrategy === "NONE") {
            setLiveDraftResult(null);
            return;
        }

        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);

        draftDebounceRef.current = setTimeout(() => {
            // generateAutomatedPlanning already schedules tasks starting from
            // the current time with proper shift-splitting and collision avoidance.
            // Do NOT re-process through shiftTasksToCurrent — that function doesn't
            // perform shift-splitting, so it can collapse post-treatment segments
            // into single tasks that span overnight, ignoring active work schedules.
            const result = generateAutomatedPlanning(
                localOrders,
                optimisticTasks,
                machines.map((m) => m.name),
                { mainStrategy: activeStrategy, ...strategyFilters },
                shifts
            );

            setLiveDraftResult(result);
        }, 400);

        return () => {
            if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        };
    }, [activeStrategy, strategyFilters, localOrders, optimisticTasks, machines, shifts]);

    // List of all tasks (real + draft) for the Gantt chart
    const allTasks = useMemo(() => {
        if (activeStrategy !== "NONE" && liveDraftResult) {
            const generatedDrafts = liveDraftResult.tasks.map((t) => ({ ...t, isDraft: true }) as PlanningTask);
            const manuallyTweakedPieceIds = new Set(draftTasks.map((d) => d.order_id));
            const reconciledDrafts = [
                ...draftTasks.filter((d) => d.isDraft),
                ...generatedDrafts.filter((g) => !manuallyTweakedPieceIds.has(g.order_id)),
            ];

            const nowSnapped = snapToNext15Minutes(new Date());
            const globalStart = getNextValidWorkTime(nowSnapped, shifts);

            const fixedTasks = optimisticTasks.filter((t) => {
                const isFuture = !isBefore(new Date(t.planned_date!), globalStart);
                const isLocked = t.locked === true;
                const hasStarted = !!t.check_in;
                return isLocked || hasStarted || !isFuture;
            });

            const flexibleTasks = optimisticTasks.filter((t) => {
                const isFuture = !isBefore(new Date(t.planned_date!), globalStart);
                const isLocked = t.locked === true;
                const hasStarted = !!t.check_in;
                return !isLocked && !hasStarted && isFuture;
            });

            const activePieceIds = new Set(reconciledDrafts.map((t) => t.order_id));
            const filteredFlexible = flexibleTasks.filter((t) => !activePieceIds.has(t.order_id));

            return [...fixedTasks, ...filteredFlexible, ...reconciledDrafts];
        }

        const visibleReal = optimisticTasks.filter((t) => !new Set(draftTasks.map((d) => d.order_id)).has(t.order_id));
        return [...visibleReal, ...draftTasks];
    }, [optimisticTasks, draftTasks, activeStrategy, liveDraftResult]);

    // Planning Alerts Computation
    const planningAlerts = useMemo(() => {
        const alerts: { type: "OVERLAP" | "MISSING_OPERATOR"; task: PlanningTask; details: string }[] = [];
        const now = new Date();
        const today = startOfDay(new Date());
        const flaggedTaskIds = new Set<string>();

        const machineGroups: Record<string, PlanningTask[]> = {};
        allTasks.forEach((task) => {
            const mName = task.machine;
            if (!mName) return;
            if (!task.planned_date || !task.planned_end) return;
            if (isBefore(new Date(task.planned_end!), now)) return;

            if (!machineGroups[mName]) machineGroups[mName] = [];
            machineGroups[mName].push(task);

            if (!task.operator || task.operator.trim() === "") {
                const isToday = isSameDay(new Date(task.planned_date!), today);
                if (isToday) {
                    alerts.push({ type: "MISSING_OPERATOR", task, details: `Sin operador asignado para hoy` });
                }
            }
        });

        Object.values(machineGroups).forEach((group) => {
            const sorted = [...group].sort(
                (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
            );
            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const t1 = sorted[i];
                    const t2 = sorted[j];
                    if (!t1.planned_date || !t1.planned_end || !t2.planned_date || !t2.planned_end) continue;

                    const start1 = new Date(t1.planned_date);
                    const end1 = new Date(t1.planned_end);
                    const start2 = new Date(t2.planned_date);
                    const end2 = new Date(t2.planned_end);

                    if (isBefore(start1, end2) && isBefore(start2, end1)) {
                        if (!flaggedTaskIds.has(t2.id)) {
                            alerts.push({
                                type: "OVERLAP",
                                task: t2,
                                details: `Solapamiento detectado en ${t2.machine}`,
                            });
                            flaggedTaskIds.add(t2.id);
                        }
                        if (!flaggedTaskIds.has(t1.id)) {
                            alerts.push({
                                type: "OVERLAP",
                                task: t1,
                                details: `Solapamiento detectado en ${t1.machine}`,
                            });
                            flaggedTaskIds.add(t1.id);
                        }
                    }
                }
            }
        });

        return alerts;
    }, [allTasks]);

    // Locate Task Logic
    const locateTask = (taskId: string) => {
        setFocusTaskId(taskId);
        setTimeout(() => setFocusTaskId(null), 3000);
    };

    // Wrapper for setOptimisticTasks - Handles both real and draft tasks
    const handleTasksChange = (newTasks: React.SetStateAction<PlanningTask[]>) => {
        const resolvedTasks = typeof newTasks === "function" ? newTasks(allTasks) : newTasks;
        const real = resolvedTasks.filter((t) => !t.isDraft);
        const drafts = resolvedTasks.filter((t) => t.isDraft);
        setOptimisticTasks(real);
        setDraftTasks(drafts);
    };

    const handleHistorySnapshot = (previousState: PlanningTask[]) => {
        setHistory((h) => [...h, previousState]);
        setFuture([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setFuture((f) => [...f, allTasks]);
        setHistory(newHistory);
        handleTasksChange(previousState);
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];
        const newFuture = future.slice(0, -1);
        setHistory((h) => [...h, allTasks]);
        setFuture(newFuture);
        handleTasksChange(nextState);
    };

    // Detect Changes logic
    const changedTasks = useMemo(() => {
        return optimisticTasks.filter((current) => {
            const original = savedTasks.find((s) => s.id === current.id);
            if (!original) return false;
            const fmt = "yyyy-MM-dd'T'HH:mm:ss";
            const currentStart = format(new Date(current.planned_date!), fmt);
            const originalStart = format(new Date(original.planned_date!), fmt);
            const currentEnd = format(new Date(current.planned_end!), fmt);
            const originalEnd = format(new Date(original.planned_end!), fmt);
            return currentStart !== originalStart || currentEnd !== originalEnd;
        }) as PlanningTask[];
    }, [optimisticTasks, savedTasks]);

    // Sync props to state
    React.useEffect(() => {
        setSavedTasks(tasks);
        setLocalOrders(orders);
        if (changedTasks.length === 0) {
            setOptimisticTasks(tasks);
        }
    }, [tasks, orders, changedTasks.length]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === "z") {
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === "y") {
                    e.preventDefault();
                    handleRedo();
                } else if (e.key === "s") {
                    e.preventDefault();
                    if (changedTasks.length > 0) {
                        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
                        saveDebounceRef.current = setTimeout(() => handleSave(), 400);
                    }
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [history, future, optimisticTasks, isSaving, changedTasks]);

    const handleSave = async () => {
        if (changedTasks.length === 0) return;
        setIsSaving(true);
        try {
            await Promise.all(
                changedTasks.map((task) =>
                    updateTaskSchedule(
                        task.id,
                        format(new Date(task.planned_date!), "yyyy-MM-dd'T'HH:mm:ss"),
                        format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm:ss")
                    )
                )
            );
            router.refresh();
        } catch (error) {
            console.error("Failed to save", error);
            alert("Error al guardar los cambios.");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDiscard = () => {
        handleDiscardDrafts();
        setOptimisticTasks(savedTasks);
        setHistory([]);
        setIsDiscardConfirmOpen(false);
    };

    // Derive unique machine names
    const allMachineNames = useMemo(() => {
        const names = new Set([
            ...machines.map((m) => m.name),
            ...tasks.map((t) => t.machine).filter((n): n is string => !!n),
        ]);
        if (tasks.some((t) => !t.machine)) {
            names.add("Sin Máquina");
        }
        return Array.from(names).sort();
    }, [machines, tasks]);

    // Build unique project list from orders for the project filter dropdown
    const availableProjects = useMemo<ProjectOption[]>(() => {
        const seen = new Map<string, ProjectOption>();
        for (const order of orders) {
            if (!order.project_id) continue;
            if (!seen.has(order.project_id)) {
                seen.set(order.project_id, {
                    id: order.project_id,
                    code: order.projects?.code ?? order.project_id,
                    company: order.projects?.company ?? null,
                });
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [orders]);

    const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set(allMachineNames));

    // Initialize selectedMachines from preferences
    useEffect(() => {
        if (prefsInitialized && ganttPrefs.selectedMachines && ganttPrefs.selectedMachines.length > 0) {
            const validMachines = ganttPrefs.selectedMachines.filter((m) => allMachineNames.includes(m));
            if (validMachines.length > 0) {
                setSelectedMachines(new Set(validMachines));
            }
        }
    }, [prefsInitialized, ganttPrefs.selectedMachines, allMachineNames]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const toggleMachine = (machineName: string) => {
        setSelectedMachines((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(machineName)) newSet.delete(machineName);
            else newSet.add(machineName);
            updateGanttPref({ selectedMachines: Array.from(newSet) });
            return newSet;
        });
    };

    const selectAllMachines = () => {
        setSelectedMachines(new Set(allMachineNames));
        updateGanttPref({ selectedMachines: allMachineNames });
    };

    const clearAllMachines = () => {
        setSelectedMachines(new Set());
        updateGanttPref({ selectedMachines: [] });
    };

    // --- MODAL STATE (Lifted) ---
    const [modalData, setModalData] = React.useState<any>(null);

    // --- HELP TOUR HANDLER ---
    const { startTour } = useTour();

    const handleStartTour = () => {
        const isDemo = optimisticTasks.length === 0;

        if (isDemo) {
            const demoTask: any = {
                id: "demo-task-1",
                order_id: "demo-order-1",
                machine: machines[0]?.name || "CNC-01",
                operator: "Juan Demo",
                planned_date: new Date().toISOString(),
                planned_end: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: "Tarea de demostración",
                status: "planned",
                production_orders: {
                    id: "demo-order-1",
                    part_code: "PZA-DEMO-001",
                    part_name: "Pieza Demo",
                    quantity: 10,
                    client: "Cliente Demo",
                    status: "active",
                    created_at: new Date().toISOString(),
                    delivery_date: new Date(Date.now() + 86400000).toISOString(),
                    priority: "normal",
                    material: "Acero",
                    notes: "",
                } as any,
            };
            setOptimisticTasks([demoTask]);
        }

        const cleanup = () => {
            if (isDemo) setOptimisticTasks([]);
            setModalData(null);
        };

        const steps: TourStep[] = [
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
                    description:
                        "Cambia la escala de tiempo entre Hora, Día y Semana para ver mas detalle o el panorama general.",
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
            {
                element: "#planning-gantt-area",
                popover: {
                    title: "Creación de Tareas",
                    description: "Al hacer doble clic, se abrirá el formulario de tarea. ¡Vamos a verlo!",
                    side: "top",
                },
                onHighlightStarted: () => {
                    setModalData(null);
                },
            },
            {
                element: "#task-modal-content",
                popover: {
                    title: "Formulario de Tarea",
                    description: "Aquí se abrirá el formulario. Llénalo con la información del trabajo.",
                    side: "left",
                    align: "center",
                },
                onHighlightStarted: () => {
                    setModalData({
                        machine: machines[0]?.name || "CNC-01",
                        time: Date.now(),
                        operator: "Juan Demo",
                        isDemo: true,
                    });
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
                    description: "Define la fecha y hora de inicio. Puedes usar el calendario o escribir la hora.",
                    side: "right",
                },
            },
            {
                element: "#task-modal-end",
                popover: {
                    title: "Fin Estimado",
                    description: "El sistema calculará el fin automáticamente, pero puedes ajustarlo manualmente.",
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

        startTour(steps, cleanup);
    };

    // Synchronize fullscreen state
    React.useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Strategy change handler
    const handleStrategyChange = (strategy: SchedulingStrategy | "NONE") => {
        setActiveStrategy(strategy);
        if (strategy !== "NONE") {
            setDraftTasks([]);
            setHistory([]);
        }
    };

    // Gantt controls (renders start/end control elements)
    const { startControls, endControls } = GanttControls({
        viewMode,
        onViewModeChange: handleViewModeChange,
        searchQuery,
        onSearchChange: setSearchQuery,
        allMachineNames,
        selectedMachines,
        onToggleMachine: toggleMachine,
        onSelectAllMachines: selectAllMachines,
        onClearAllMachines: clearAllMachines,
        showDependencies,
        onShowDependenciesChange: handleShowDependenciesChange,
        hideEmptyMachines,
        onHideEmptyMachinesChange: handleHideEmptyMachinesChange,
        cascadeMode,
        onCascadeModeChange: handleCascadeModeChange,
        availableProjects,
        projectFilter,
        onProjectFilterChange: handleProjectFilterChange,
        zoomLevel,
        onZoomChange: handleZoomChange,
        isFullscreen,
        onToggleFullscreen: toggleFullscreen,
    });

    // Show skeleton while preferences are loading
    if (!prefsInitialized) {
        return <ProductionViewSkeleton />;
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex w-full flex-col bg-background transition-all duration-500",
                isFullscreen ? "fixed inset-0 z-[9999] h-screen pt-4" : "h-[calc(100vh-64px)]"
            )}
        >
            {!isFullscreen && (
                <div className="-mb-2 px-6 pt-6">
                    <DashboardHeader
                        title="Planeación"
                        description="Planificador de maquinados con vista Gantt interactiva"
                        icon={<CalendarIcon className="h-8 w-8" />}
                        colorClass="text-red-500"
                        bgClass="bg-red-500/10"
                        backUrl="/dashboard/produccion"
                        onHelp={handleStartTour}
                    />
                </div>
            )}

            {/* LIVE STRATEGY TOOLBAR */}
            <StrategyToolbar
                activeStrategy={activeStrategy}
                onStrategyChange={handleStrategyChange}
                planningAlerts={planningAlerts}
                onLocateTask={locateTask}
                liveDraftResult={liveDraftResult as SchedulingResult | null}
                onSaveAllPlanning={handleSaveAllPlanning}
                isEvalListOpen={isEvalListOpen}
                onToggleEvalList={() => setIsEvalListOpen(!isEvalListOpen)}
                ordersPendingEvalCount={evalFilters.ordersPendingEvaluation.length}
                showEvaluated={evalFilters.showEvaluated}
                changedTasksCount={changedTasks.length}
                draftTasksCount={draftTasks.length}
                containerRef={containerRef}
            />

            {/* GANTT AREA */}
            <div className="relative flex flex-1 flex-col overflow-hidden p-4" id="planning-gantt-area">
                <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                    <GanttSVG
                        initialMachines={machines}
                        initialOrders={orders}
                        optimisticTasks={allTasks}
                        setOptimisticTasks={handleTasksChange}
                        onHistorySnapshot={handleHistorySnapshot}
                        hideEmptyMachines={hideEmptyMachines}
                        searchQuery={searchQuery}
                        viewMode={viewMode}
                        isFullscreen={isFullscreen}
                        selectedMachines={selectedMachines}
                        operators={operators}
                        showDependencies={showDependencies}
                        zoomLevel={zoomLevel}
                        setZoomLevel={handleZoomChange}
                        onTaskDoubleClick={(task) => {
                            setSelectedOrderForEval(task.production_orders);
                            setIsEvalListOpen(true);
                        }}
                        focusTaskId={focusTaskId}
                        projectFilter={projectFilter}
                        startControls={startControls}
                        endControls={endControls}
                        onToggleLock={handleToggleLock}
                        cascadeMode={cascadeMode}
                        container={containerRef.current}
                    />
                </div>
            </div>

            {/* EVALUATION SIDEBAR */}
            <EvaluationSidebar
                isOpen={isEvalListOpen}
                onClose={() => {
                    setIsEvalListOpen(false);
                    setSelectedOrderForEval(null);
                }}
                isFullscreen={isFullscreen}
                filters={evalFilters}
                onClearEvaluation={(orderId) => setIdToClearEval(orderId)}
                selectedOrder={selectedOrderForEval}
                onSelectOrder={setSelectedOrderForEval}
                machines={machines}
                treatments={treatments}
                onEvalSuccess={(orderId, newSteps) => {
                    setLocalOrders((prev) =>
                        prev.map((o) =>
                            o.id === orderId ? { ...o, evaluation: newSteps as unknown as typeof o.evaluation } : o
                        )
                    );
                    if (activeStrategy !== "NONE") {
                        setDraftTasks((prev) => prev.filter((d) => d.order_id !== orderId));
                    }
                    router.refresh();
                }}
            />

            {/* CONFIRMATION DIALOGS */}
            <ConfirmationDialogs
                idToClearEval={idToClearEval}
                onClearEvalCancel={() => setIdToClearEval(null)}
                onClearEvalConfirm={confirmClearEvaluation}
                isDiscardConfirmOpen={isDiscardConfirmOpen}
                onDiscardCancel={setIsDiscardConfirmOpen}
                onDiscardConfirm={confirmDiscard}
                container={containerRef.current}
            />
        </div>
    );
}
