"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import { Calendar as CalendarIcon } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import moment from "moment";
import "moment/locale/es";
import {
    updateTaskSchedule,
    batchSavePlanning,
    toggleTaskLocked,
    clearOrderEvaluation
} from "@/app/dashboard/produccion/actions";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import { ProductionViewSkeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { useTour, TourStep } from "@/hooks/use-tour";
import { toast } from "sonner";
import { EvaluationModal } from "./evaluation-modal";
import {
    generateAutomatedPlanning,
    SchedulingResult,
    PlanningTask as SchedulingPlanningTask,
    SchedulingStrategy,
    shiftTasksToCurrent,
    getNextValidWorkTime,
    snapToNext15Minutes,
    OrderWithRelations,
    EvaluationStep,
} from "@/lib/scheduling-utils";
import { StrategyToolbar } from "./strategy-toolbar";
import { GanttControls } from "./gantt-controls";
import { EvaluationSidebar } from "./evaluation-sidebar";
import { BlueprintPreviewDialog } from "./blueprint-preview-dialog";
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
}

export function ProductionView({ machines, orders, tasks, operators }: ProductionViewProps) {
    const router = useRouter();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

    // User preferences
    const { getGanttPrefs, updateGanttPref, isLoading: prefsLoading } = useUserPreferences();
    const ganttPrefs = getGanttPrefs();

    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");
    const [showDependencies, setShowDependencies] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [hideEmptyMachines, setHideEmptyMachines] = useState(true);
    const [cascadeMode, setCascadeMode] = useState(false);
    const [prefsInitialized, setPrefsInitialized] = useState(false);

    // Evaluation States
    const [isEvalListOpen, setIsEvalListOpen] = useState(false);
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [selectedOrderForEval, setSelectedOrderForEval] = useState<Order | null>(null);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState<number>(-1);
    const [evalNavigationList, setEvalNavigationList] = useState<Order[]>([]);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);

    // Draft Tasks for Auto-Plan Preview
    const [draftTasks, setDraftTasks] = useState<PlanningTask[]>([]);

    // Live Strategy States
    const [activeStrategy, setActiveStrategy] = useState<SchedulingStrategy | "NONE">("NONE");
    const [localOrders, setLocalOrders] = useState<Order[]>(orders);
    const [strategyFilters] = useState({
        onlyWithCAD: false,
        onlyWithBlueprint: false,
        onlyWithMaterial: false,
        requireTreatment: false
    });

    // Confirmation states
    const [idToClearEval, setIdToClearEval] = useState<string | null>(null);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

    // Evaluation filters hook
    const evalFilters = useEvaluationFilters(orders as OrderWithRelations[]);

    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !prefsInitialized) {
            if (ganttPrefs.viewMode) setViewMode(ganttPrefs.viewMode);
            if (ganttPrefs.showDependencies !== undefined) setShowDependencies(ganttPrefs.showDependencies);
            if (ganttPrefs.zoomLevel) setZoomLevel(ganttPrefs.zoomLevel);
            if (ganttPrefs.hideEmptyMachines !== undefined) setHideEmptyMachines(ganttPrefs.hideEmptyMachines);
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
        setZoomLevel(prev => {
            const resolvedZoom = typeof newZoom === 'function' ? newZoom(prev) : newZoom;
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

    const handleNextEval = () => {
        if (selectedEvalIndex < evalNavigationList.length - 1) {
            const nextIndex = selectedEvalIndex + 1;
            setSelectedEvalIndex(nextIndex);
            setSelectedOrderForEval(evalNavigationList[nextIndex]);
        }
    };

    const handlePrevEval = () => {
        if (selectedEvalIndex > 0) {
            const prevIndex = selectedEvalIndex - 1;
            setSelectedEvalIndex(prevIndex);
            setSelectedOrderForEval(evalNavigationList[prevIndex]);
        }
    };

    // Lock/Unlock handler
    const handleToggleLock = async (taskId: string, locked: boolean) => {
        setOptimisticTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, locked } : t
        ));
        try {
            await toggleTaskLocked(taskId, locked);
        } catch {
            setOptimisticTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, locked: !locked } : t
            ));
            toast.error("Error al cambiar bloqueo");
        }
    };

    // Live Strategy Draft Computation
    const liveDraftResult = useMemo(() => {
        if (activeStrategy === "NONE") return null;

        const result = generateAutomatedPlanning(localOrders, optimisticTasks, machines.map(m => m.name), {
            mainStrategy: activeStrategy,
            ...strategyFilters
        });

        const nowSnapped = snapToNext15Minutes(moment());
        const globalStart = getNextValidWorkTime(nowSnapped);

        const shifted = shiftTasksToCurrent(
            result.tasks,
            globalStart,
            optimisticTasks as SchedulingPlanningTask[],
            machines.map(m => m.name)
        );
        return { ...result, tasks: shifted };
    }, [activeStrategy, strategyFilters, orders, optimisticTasks, machines]);

    // List of all tasks (real + draft) for the Gantt chart
    const allTasks = useMemo(() => {
        if (activeStrategy !== "NONE" && liveDraftResult) {
            const generatedDrafts = liveDraftResult.tasks.map(t => ({ ...t, isDraft: true } as PlanningTask));
            const manuallyTweakedPieceIds = new Set(draftTasks.map(d => d.order_id));
            const reconciledDrafts = [
                ...draftTasks.filter(d => d.isDraft),
                ...generatedDrafts.filter(g => !manuallyTweakedPieceIds.has(g.order_id))
            ];

            const nowSnapped = snapToNext15Minutes(moment());
            const globalStart = getNextValidWorkTime(nowSnapped);

            const fixedTasks = optimisticTasks.filter(t => {
                const isFuture = moment(t.planned_date).isSameOrAfter(globalStart);
                const isLocked = t.locked === true;
                const hasStarted = !!t.check_in;
                return isLocked || hasStarted || !isFuture;
            });

            const flexibleTasks = optimisticTasks.filter(t => {
                const isFuture = moment(t.planned_date).isSameOrAfter(globalStart);
                const isLocked = t.locked === true;
                const hasStarted = !!t.check_in;
                return !isLocked && !hasStarted && isFuture;
            });

            const activePieceIds = new Set(reconciledDrafts.map(t => t.order_id));
            const filteredFlexible = flexibleTasks.filter(t => !activePieceIds.has(t.order_id));

            return [...fixedTasks, ...filteredFlexible, ...reconciledDrafts];
        }

        const visibleReal = optimisticTasks.filter(t => !new Set(draftTasks.map(d => d.order_id)).has(t.order_id));
        return [...visibleReal, ...draftTasks];
    }, [optimisticTasks, draftTasks, activeStrategy, liveDraftResult]);

    // Planning Alerts Computation
    const planningAlerts = useMemo(() => {
        const alerts: { type: 'OVERLAP' | 'MISSING_OPERATOR', task: PlanningTask, details: string }[] = [];
        const now = moment();
        const startOfToday = moment().startOf('day');
        const flaggedTaskIds = new Set<string>();

        const machineGroups: Record<string, PlanningTask[]> = {};
        allTasks.forEach(task => {
            const mName = task.machine;
            if (!mName) return;
            if (!task.planned_date || !task.planned_end) return;
            if (moment(task.planned_end).isBefore(now)) return;

            if (!machineGroups[mName]) machineGroups[mName] = [];
            machineGroups[mName].push(task);

            if (!task.operator || task.operator.trim() === "") {
                const isToday = moment(task.planned_date).isSame(startOfToday, 'day');
                if (isToday) {
                    alerts.push({ type: 'MISSING_OPERATOR', task, details: `Sin operador asignado para hoy` });
                }
            }
        });

        Object.values(machineGroups).forEach(group => {
            const sorted = [...group].sort((a, b) => moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf());
            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const t1 = sorted[i];
                    const t2 = sorted[j];
                    if (!t1.planned_date || !t1.planned_end || !t2.planned_date || !t2.planned_end) continue;

                    const start1 = moment(t1.planned_date);
                    const end1 = moment(t1.planned_end);
                    const start2 = moment(t2.planned_date);
                    const end2 = moment(t2.planned_end);

                    if (start1.isBefore(end2) && end1.isAfter(start2)) {
                        if (!flaggedTaskIds.has(t2.id)) {
                            alerts.push({ type: 'OVERLAP', task: t2, details: `Solapamiento detectado en ${t2.machine}` });
                            flaggedTaskIds.add(t2.id);
                        }
                        if (!flaggedTaskIds.has(t1.id)) {
                            alerts.push({ type: 'OVERLAP', task: t1, details: `Solapamiento detectado en ${t1.machine}` });
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
        const real = resolvedTasks.filter(t => !t.isDraft);
        const drafts = resolvedTasks.filter(t => t.isDraft);
        setOptimisticTasks(real);
        setDraftTasks(drafts);
    };

    const handleHistorySnapshot = (previousState: PlanningTask[]) => {
        setHistory(h => [...h, previousState]);
        setFuture([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setFuture(f => [...f, allTasks]);
        setHistory(newHistory);
        handleTasksChange(previousState);
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];
        const newFuture = future.slice(0, -1);
        setHistory(h => [...h, allTasks]);
        setFuture(newFuture);
        handleTasksChange(nextState);
    };

    // Detect Changes logic
    const changedTasks = useMemo(() => {
        return optimisticTasks.filter(current => {
            const original = savedTasks.find(s => s.id === current.id);
            if (!original) return false;
            const format = "YYYY-MM-DDTHH:mm:ss";
            const currentStart = moment(current.planned_date).format(format);
            const originalStart = moment(original.planned_date).format(format);
            const currentEnd = moment(current.planned_end).format(format);
            const originalEnd = moment(original.planned_end).format(format);
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
                if (e.key === 'z') {
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    handleRedo();
                } else if (e.key === 's') {
                    e.preventDefault();
                    if (changedTasks.length > 0) {
                        handleSave();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, future, optimisticTasks, isSaving, changedTasks]);

    const handleSave = async () => {
        if (changedTasks.length === 0) return;
        setIsSaving(true);
        try {
            await Promise.all(changedTasks.map(task =>
                updateTaskSchedule(task.id, moment(task.planned_date).format("YYYY-MM-DDTHH:mm:ss"), moment(task.planned_end).format("YYYY-MM-DDTHH:mm:ss"))
            ));
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
            ...machines.map(m => m.name),
            ...tasks.map(t => t.machine).filter((n): n is string => !!n)
        ]);
        if (tasks.some(t => !t.machine)) {
            names.add("Sin Máquina");
        }
        return Array.from(names).sort();
    }, [machines, tasks]);

    const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set(allMachineNames));

    // Initialize selectedMachines from preferences
    useEffect(() => {
        if (prefsInitialized && ganttPrefs.selectedMachines && ganttPrefs.selectedMachines.length > 0) {
            const validMachines = ganttPrefs.selectedMachines.filter(m => allMachineNames.includes(m));
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
        setSelectedMachines(prev => {
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
                    notes: ""
                } as any
            };
            setOptimisticTasks([demoTask]);
        }

        const cleanup = () => {
            if (isDemo) setOptimisticTasks([]);
            setModalData(null);
        };

        const steps: TourStep[] = [
            { element: "#planning-gantt-area", popover: { title: "Área de Gantt", description: "Visualiza y gestiona la producción. Haz DOBLE CLIC en un espacio vacío para crear una tarea, o en una tarea existente para editarla.", side: "top", align: "center" } },
            { element: "#planning-view-modes", popover: { title: "Modos de Vista", description: "Cambia la escala de tiempo entre Hora, Día y Semana para ver mas detalle o el panorama general.", side: "bottom", align: "start" } },
            { element: "#planning-machine-filter", popover: { title: "Filtro de Máquinas", description: "Selecciona qué máquinas quieres ver en el diagrama.", side: "bottom" } },
            { element: "#planning-search", popover: { title: "Buscador de Piezas", description: "Resalta rápidamente las tareas relacionadas con una pieza o código específico.", side: "bottom" } },
            { element: "#planning-settings", popover: { title: "Configuración", description: "Personaliza la visualización, como mostrar/ocultar líneas de dependencia.", side: "bottom" } },
            { element: "#planning-fullscreen", popover: { title: "Pantalla Completa", description: "Maximiza el área de trabajo para tener una mejor visión de toda la planta.", side: "left" } },
            {
                element: "#planning-gantt-area",
                popover: { title: "Creación de Tareas", description: "Al hacer doble clic, se abrirá el formulario de tarea. ¡Vamos a verlo!", side: "top" },
                onHighlightStarted: () => { setModalData(null); }
            },
            {
                element: "#task-modal-content",
                popover: { title: "Formulario de Tarea", description: "Aquí se abrirá el formulario. Llénalo con la información del trabajo.", side: "left", align: "center" },
                onHighlightStarted: () => {
                    setModalData({ machine: machines[0]?.name || "CNC-01", time: Date.now(), operator: "Juan Demo", isDemo: true });
                }
            },
            { element: "#task-modal-order", popover: { title: "Selección de Pieza", description: "Busca y selecciona la orden de producción o pieza a maquinar.", side: "right" } },
            { element: "#task-modal-start", popover: { title: "Inicio Programado", description: "Define la fecha y hora de inicio. Puedes usar el calendario o escribir la hora.", side: "right" } },
            { element: "#task-modal-end", popover: { title: "Fin Estimado", description: "El sistema calculará el fin automáticamente, pero puedes ajustarlo manualmente.", side: "right" } },
            { element: "#task-modal-operator", popover: { title: "Asignación de Operador", description: "Asigna un operador responsable a esta tarea.", side: "top" } },
            { element: "#task-modal-save", popover: { title: "Guardar Cambios", description: "Guarda la tarea para reflejarla en el tablero de todos los usuarios.", side: "top" } },
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
        onCascadeModeChange: setCascadeMode,
    });

    // Show skeleton while preferences are loading
    if (!prefsInitialized) {
        return <ProductionViewSkeleton />;
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "w-full flex flex-col bg-background transition-all duration-500",
                isFullscreen ? "h-screen fixed inset-0 z-[9999] pt-4" : "h-[calc(100vh-64px)]"
            )}
        >
            {!isFullscreen && (
                <div className="px-6 pt-6 -mb-2">
                    <DashboardHeader
                        title="Planeación"
                        description="Planificador de maquinados con vista Gantt interactiva"
                        icon={<CalendarIcon className="w-8 h-8" />}
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
                changedTasksCount={changedTasks.length}
                draftTasksCount={draftTasks.length}
                containerRef={containerRef}
            />

            {/* GANTT AREA */}
            <div className="flex-1 overflow-hidden relative p-4 flex flex-col" id="planning-gantt-area">
                <div className="flex-1 w-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
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
                            setIsEvalModalOpen(true);
                        }}
                        onToggleFullscreen={toggleFullscreen}
                        focusTaskId={focusTaskId}
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
                onClose={() => setIsEvalListOpen(false)}
                isFullscreen={isFullscreen}
                filters={evalFilters}
                onOpenEvaluation={(order, idx, list) => {
                    setEvalNavigationList(list);
                    setSelectedEvalIndex(idx);
                    setSelectedOrderForEval(order);
                    setIsEvalModalOpen(true);
                }}
                onClearEvaluation={(orderId) => setIdToClearEval(orderId)}
                onPreviewBlueprint={(fileId) => setPreviewFileId(fileId)}
            />

            {/* EVALUATION MODAL */}
            <EvaluationModal
                isOpen={isEvalModalOpen}
                onClose={() => setIsEvalModalOpen(false)}
                order={selectedOrderForEval ? {
                    id: selectedOrderForEval.id,
                    part_code: selectedOrderForEval.part_code,
                    part_name: selectedOrderForEval.part_name,
                    evaluation: selectedOrderForEval.evaluation as EvaluationStep[] | null | undefined,
                    drawing_url: selectedOrderForEval.drawing_url ?? undefined,
                    urgencia: selectedOrderForEval.urgencia ?? undefined,
                } : null}
                machines={machines}
                onSuccess={(newSteps, urg) => {
                    setLocalOrders(prev => prev.map(o =>
                        o.id === selectedOrderForEval?.id
                            ? { ...o, evaluation: newSteps as unknown as typeof o.evaluation, urgencia: urg ?? null }
                            : o
                    ));

                    if (selectedEvalIndex !== -1 && evalNavigationList[selectedEvalIndex]) {
                        const updatedList = [...evalNavigationList];
                        const updatedItem = { ...updatedList[selectedEvalIndex], evaluation: newSteps as unknown as Order["evaluation"], urgencia: urg ?? null };
                        updatedList[selectedEvalIndex] = updatedItem;
                        setEvalNavigationList(updatedList);
                    }

                    if (activeStrategy !== "NONE") {
                        setDraftTasks(prev => prev.filter(d => d.order_id !== selectedOrderForEval?.id));
                    }

                    router.refresh();
                }}
                onNext={handleNextEval}
                onPrevious={handlePrevEval}
                hasNext={selectedEvalIndex < evalNavigationList.length - 1}
                hasPrevious={selectedEvalIndex > 0}
                container={containerRef.current}
            />

            {/* BLUEPRINT PREVIEW */}
            <BlueprintPreviewDialog
                fileId={previewFileId}
                onClose={() => setPreviewFileId(null)}
                container={containerRef.current}
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
