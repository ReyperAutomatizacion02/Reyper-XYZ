"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Filter,
    GanttChartSquare,
    Info,
    Layers,
    ListFilter,
    Lock,
    Plus,
    RotateCcw,
    Save,
    Search,
    Settings2,
    Sparkles,
    Trash2,
    Undo2,
    Unlock,
    User,
    Box,
    Clock,
    X,
    LayoutGrid,
    CheckCircle2,
    History as HistoryIcon,
    FileText,
    ArrowUpDown,
    CheckSquare,
    Wand2,
    ClipboardList,
    AlertTriangle,
    XCircle,
    ArrowUpAZ,
    ArrowDownZA,
    ListOrdered,
    BarChart3,
    ChevronDown,
    RotateCw,
    Settings,
    ZoomIn,
    ZoomOut,
    Link2,
    ExternalLink
} from "lucide-react";
import { Database } from "@/utils/supabase/types";
import moment from "moment";
import "moment/locale/es";
import {
    updateTaskSchedule,
    batchSavePlanning,
    fetchScenarios,
    saveScenario,
    deleteScenario,
    markScenarioApplied,
    toggleTaskLocked,
    clearOrderEvaluation
} from "@/app/dashboard/produccion/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import { ProductionViewSkeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTour, TourStep } from "@/hooks/use-tour";
import { toast } from "sonner";
import { EvaluationModal } from "./evaluation-modal";
import { generateAutomatedPlanning, compareOrdersByPriority, SchedulingResult, SavedScenario, PlanningTask as SchedulingPlanningTask, shiftTasksToCurrent } from "@/lib/scheduling-utils";
import { ScenarioComparison } from "./scenario-comparison";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { extractDriveFileId } from "@/lib/drive-utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AutoPlanDialog } from "./auto-plan-dialog";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface ProductionViewProps {
    machines: Machine[];
    orders: Order[];
    tasks: PlanningTask[];
    operators: string[];
}

export function ProductionView({ machines, orders, tasks, operators }: ProductionViewProps) {
    const router = useRouter();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // User preferences
    const { getGanttPrefs, updateGanttPref, isLoading: prefsLoading } = useUserPreferences();
    const ganttPrefs = getGanttPrefs();

    // Initialize states with defaults, will be updated from preferences
    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");
    const [showDependencies, setShowDependencies] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hideEmptyMachines, setHideEmptyMachines] = useState(true);
    const [prefsInitialized, setPrefsInitialized] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Evaluation States
    const [isEvalListOpen, setIsEvalListOpen] = useState(false);
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [selectedOrderForEval, setSelectedOrderForEval] = useState<Order | null>(null);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState<number>(-1);
    const [evalNavigationList, setEvalNavigationList] = useState<Order[]>([]);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);

    // Draft Tasks for Auto-Plan Preview
    const [draftTasks, setDraftTasks] = useState<PlanningTask[]>([]);

    // Scenario Management
    const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
    const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);

    // Evaluation Search and Filters
    const [evalSearchQuery, setEvalSearchQuery] = useState("");
    const [evalFilterType, setEvalFilterType] = useState<"request" | "delivery" | "none">("none");
    const [evalDateValue, setEvalDateValue] = useState("");
    const [evalDateOperator, setEvalDateOperator] = useState<"before" | "after">("after");

    // Confirmation states
    const [idToClearEval, setIdToClearEval] = useState<string | null>(null);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const filterPanelRef = useRef<HTMLDivElement>(null);

    const clearEvaluation = async (orderId: string) => {
        setIdToClearEval(orderId);
    };


    const [clientFilter, setClientFilter] = useState<string[]>([]);
    const [treatmentFilter, setTreatmentFilter] = useState("all");
    const [evalSortDirection, setEvalSortDirection] = useState<"asc" | "desc">("asc");
    const [evalSortBy, setEvalSortBy] = useState<"auto" | "date" | "code" | "both">("auto");
    const [showEvaluated, setShowEvaluated] = useState(false);
    const [isAutoPlanDialogOpen, setIsAutoPlanDialogOpen] = useState(false);

    const clearAllFilters = () => {
        setEvalSearchQuery("");
        setClientFilter([]);
        setTreatmentFilter("all");
        setEvalFilterType("none");
        setEvalDateValue("");
        setEvalDateOperator("after");
        setEvalSortBy("auto");
        setEvalSortDirection("asc");
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (evalSearchQuery) count++;
        if (clientFilter.length > 0) count++;
        if (treatmentFilter !== "all") count++;
        if (evalFilterType !== "none") count++;
        return count;
    }, [evalSearchQuery, clientFilter, treatmentFilter, evalFilterType]);

    // Filter orders that need evaluation
    const ordersPendingEvaluation = useMemo(() => {
        let filtered = (orders as any[]).filter(o => {
            const isFinished = o.genral_status === 'D7-ENTREGADA' || o.genral_status === 'D8-CANCELADA';
            if (isFinished) return false;
            if (o.material === 'ENSAMBLE') return false;

            // Search filter
            if (evalSearchQuery) {
                const searchLower = evalSearchQuery.toLowerCase();
                const matchesSearch =
                    o.part_code?.toLowerCase().includes(searchLower) ||
                    o.part_name?.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            // Client filter (multi-select)
            if (clientFilter.length > 0) {
                if (!o.projects?.company || !clientFilter.includes(o.projects.company)) return false;
            }

            // Treatment filter
            if (treatmentFilter !== "all") {
                const hasTreatment = o.treatment && o.treatment !== "" && o.treatment !== "N/A";
                if (treatmentFilter === "yes" && !hasTreatment) return false;
                if (treatmentFilter === "no" && hasTreatment) return false;
            }

            const hasEvaluation = o.evaluation && Array.isArray(o.evaluation) && o.evaluation.length > 0;
            if (showEvaluated) {
                if (!hasEvaluation) return false;
            } else {
                if (hasEvaluation) return false;
            }

            // Date filtering
            if (evalFilterType !== "none" && evalDateValue) {
                const targetDate = moment(evalDateValue);
                let orderDate;
                if (evalFilterType === "request") {
                    orderDate = moment(o.projects?.start_date || o.created_at);
                } else {
                    orderDate = moment(o.projects?.delivery_date || o.created_at);
                }

                if (evalDateOperator === "before") {
                    // Inclusive: On or Before
                    if (!orderDate.isSameOrBefore(targetDate, 'day')) return false;
                } else {
                    // Inclusive: On or After
                    if (!orderDate.isSameOrAfter(targetDate, 'day')) return false;
                }
            }

            return true;
        });

        // Sorting: Configurable (Priority, Date, Code, or Both)
        filtered.sort((a, b) => {
            // Priority is the DEFAULT behavior ("auto" or if selected)
            if (evalSortBy === "auto") {
                const res = compareOrdersByPriority(a, b);
                return evalSortDirection === "asc" ? res : -res;
            }

            const dateA = a.projects?.delivery_date || a.created_at || "";
            const dateB = b.projects?.delivery_date || b.created_at || "";
            const codeA = a.part_code || "";
            const codeB = b.part_code || "";

            const compareDates = () => {
                if (dateA === dateB) return 0;
                if (evalSortDirection === "asc") return dateA > dateB ? 1 : -1;
                return dateA < dateB ? 1 : -1;
            };

            const compareCodes = () => {
                if (evalSortDirection === "asc") {
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                }
                return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
            };

            if (evalSortBy === "date") return compareDates();
            if (evalSortBy === "code") return compareCodes();

            // "both" - Primary: Date, Secondary: Code
            const dateResult = compareDates();
            if (dateResult !== 0) return dateResult;
            return compareCodes();
        });

        return filtered;
    }, [orders, evalSearchQuery, clientFilter, treatmentFilter, evalSortDirection, evalSortBy, showEvaluated, evalFilterType, evalDateValue, evalDateOperator]);

    // Get unique clients for the filter
    const uniqueClients = useMemo(() => {
        const clients = new Set<string>();
        (orders as any[]).forEach(o => {
            if (o.projects?.company) clients.add(o.projects.company);
        });
        return Array.from(clients).sort();
    }, [orders]);


    // Initialize from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !prefsInitialized) {
            if (ganttPrefs.viewMode) setViewMode(ganttPrefs.viewMode);
            if (ganttPrefs.showDependencies !== undefined) setShowDependencies(ganttPrefs.showDependencies);
            if (ganttPrefs.zoomLevel) setZoomLevel(ganttPrefs.zoomLevel);
            if (ganttPrefs.hideEmptyMachines !== undefined) setHideEmptyMachines(ganttPrefs.hideEmptyMachines);
            // Note: selectedMachines initialized in a separate effect below (needs allMachineNames)
            setPrefsInitialized(true);
        }
    }, [prefsLoading, prefsInitialized, ganttPrefs]);

    // Load saved scenarios on mount
    useEffect(() => {
        fetchScenarios().then((data: any[]) => {
            setSavedScenarios(data.map((s: any) => ({
                id: s.id,
                name: s.name,
                strategy: s.strategy,
                config: s.config,
                tasks: s.tasks || [],
                skipped: s.skipped || [],
                metrics: s.metrics || {},
                created_by: s.created_by,
                created_at: s.created_at,
                applied_at: s.applied_at,
            })));
        }).catch(err => {
            console.error("Failed to load scenarios:", err);
        });
    }, []);

    // Save viewMode preference
    const handleViewModeChange = (newMode: "hour" | "day" | "week") => {
        setViewMode(newMode);
        setZoomLevel(1); // Reset zoom on mode change
        updateGanttPref({ viewMode: newMode, zoomLevel: 1 });
    };

    // Save showDependencies preference
    const handleShowDependenciesChange = (value: boolean) => {
        setShowDependencies(value);
        updateGanttPref({ showDependencies: value });
    };

    // Auto-Plan logic (Triggering the Dialog)
    const handleAutoPlan = () => {
        setIsAutoPlanDialogOpen(true);
    };

    // Scenario: Save
    const handleSaveScenario = async (data: { name: string; strategy: string; config: any; result: SchedulingResult }) => {
        toast.loading("Guardando escenario...", { id: "save-scenario" });
        try {
            await saveScenario({
                name: data.name,
                strategy: data.strategy,
                config: data.config,
                tasks: data.result.tasks as any[],
                skipped: data.result.skipped,
                metrics: data.result.metrics,
            });
            toast.success(`Escenario "${data.name}" guardado`, { id: "save-scenario" });

            // Refresh scenarios list
            const updated = await fetchScenarios();
            const mappedScenarios: SavedScenario[] = updated.map((s: any) => ({
                id: s.id,
                name: s.name,
                strategy: s.strategy,
                config: s.config,
                tasks: s.tasks || [],
                skipped: s.skipped || [],
                metrics: s.metrics || {},
                created_by: s.created_by,
                created_at: s.created_at,
                applied_at: s.applied_at,
            }));
            setSavedScenarios(mappedScenarios);

            // AUTO-PREVIEW: Find the scenario we just saved (the one with the newest created_at)
            // or we could match by name if unique, but newest is safer.
            const newScenario = [...mappedScenarios].sort((a, b) =>
                moment(b.created_at).valueOf() - moment(a.created_at).valueOf()
            )[0];

            if (newScenario) {
                handlePreviewScenario(newScenario);
            }

        } catch (err) {
            toast.error("Error al guardar escenario", { id: "save-scenario" });
            throw err;
        }
    };

    // Scenario: Preview on Gantt
    const handlePreviewScenario = (scenario: SavedScenario) => {
        if (activePreviewId === scenario.id) {
            // Toggle off
            setActivePreviewId(null);
            setDraftTasks([]);
            return;
        }

        // REPOSITIONING: Shift scenario tasks to start from "Now"
        const existingRealTasks = optimisticTasks;
        const machinesList = machines.map(m => m.name);

        // Shift the preview tasks to the current time
        // Snap current time to nearest 15 mins for better alignment
        const now = moment();
        const minutes = now.minute();
        // Snap current time to NEXT 15 mins for better alignment (always forward)
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        const snappedNow = now.clone().minute(0).add(roundedMinutes, 'minutes').second(0).millisecond(0);

        const shiftedTasks = shiftTasksToCurrent(
            scenario.tasks as any[],
            snappedNow, // targetTime: Now snapped to 15m
            existingRealTasks,
            machinesList
        );

        setActivePreviewId(scenario.id);
        setDraftTasks(shiftedTasks as any);
        toast.info(`Preview: "${scenario.name}" — Ajustado al tiempo actual.`);
    };

    // Scenario: Apply (save tasks to DB permanently)
    const handleApplyScenario = async (scenario: SavedScenario) => {
        if (scenario.tasks.length === 0) {
            toast.warning("Este escenario no tiene tareas.");
            return;
        }
        toast.loading("Aplicando escenario...", { id: "apply-scenario" });
        try {
            await batchSavePlanning(scenario.tasks as any[], []);
            await markScenarioApplied(scenario.id);
            toast.success(`Escenario "${scenario.name}" aplicado permanentemente`, { id: "apply-scenario" });
            setDraftTasks([]);
            setActivePreviewId(null);
            // Refresh scenarios to update applied_at
            const updated = await fetchScenarios();
            setSavedScenarios(updated.map((s: any) => ({
                id: s.id, name: s.name, strategy: s.strategy, config: s.config,
                tasks: s.tasks || [], skipped: s.skipped || [],
                metrics: s.metrics || {}, created_by: s.created_by,
                created_at: s.created_at, applied_at: s.applied_at,
            })));
            router.refresh();
        } catch (err) {
            toast.error("Error al aplicar escenario", { id: "apply-scenario" });
        }
    };

    // Scenario: Delete
    const handleDeleteScenario = async (scenarioId: string) => {
        toast.loading("Eliminando...", { id: "delete-scenario" });
        try {
            await deleteScenario(scenarioId);
            setSavedScenarios(prev => prev.filter(s => s.id !== scenarioId));
            if (activePreviewId === scenarioId) {
                setActivePreviewId(null);
                setDraftTasks([]);
            }
            toast.success("Escenario eliminado", { id: "delete-scenario" });
        } catch (err) {
            toast.error("Error al eliminar", { id: "delete-scenario" });
        }
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

    // Scenario: Cycle between saved scenario previews
    const handleCyclePreview = (direction: -1 | 1) => {
        if (savedScenarios.length < 2) return;
        const currentIdx = savedScenarios.findIndex(s => s.id === activePreviewId);
        const nextIdx = (currentIdx + direction + savedScenarios.length) % savedScenarios.length;
        const nextScenario = savedScenarios[nextIdx];

        // Shift tasks to current time (same as handlePreviewScenario)
        const now = moment();
        const roundedMinutes = Math.ceil(now.minute() / 15) * 15;
        const snappedNow = now.clone().minute(0).add(roundedMinutes, 'minutes').second(0).millisecond(0);
        const shiftedTasks = shiftTasksToCurrent(
            nextScenario.tasks as any[],
            snappedNow,
            optimisticTasks,
            machines.map(m => m.name)
        );

        setActivePreviewId(nextScenario.id);
        setDraftTasks(shiftedTasks as any);
        toast.info(`Preview: ${nextScenario.name}`);
    };

    const handleDiscardDrafts = () => {
        setDraftTasks([]);
        setActivePreviewId(null);
        toast.info("Planeación automática descartada");
    };

    const handleSaveAllPlanning = async () => {
        if (draftTasks.length === 0 && changedTasks.length === 0) return;

        toast.loading("Guardando planeación...", { id: "save-planning" });

        try {
            await batchSavePlanning(draftTasks as any[], changedTasks as any[]);

            toast.success("Planeación guardada con éxito", { id: "save-planning" });
            setDraftTasks([]);
            // After saving, the changed tasks are no longer "changed" relative to the saved state.
            // The router.refresh() will re-fetch tasks, effectively resetting the changedTasks state.
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar la planeación", { id: "save-planning" });
        }
    };

    // Save zoomLevel preference
    const handleZoomChange = (newZoom: number | ((prev: number) => number)) => {
        setZoomLevel(prev => {
            const resolvedZoom = typeof newZoom === 'function' ? newZoom(prev) : newZoom;
            updateGanttPref({ zoomLevel: resolvedZoom });
            return resolvedZoom;
        });
    };

    // Close settings dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isSettingsOpen]);

    // State lifted from GanttSVG
    const [savedTasks, setSavedTasks] = useState<PlanningTask[]>(tasks);
    const [optimisticTasks, setOptimisticTasks] = useState<PlanningTask[]>(tasks);
    const [history, setHistory] = useState<PlanningTask[][]>([]);

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
    const [future, setFuture] = useState<PlanningTask[][]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [cascadeMode, setCascadeMode] = useState(false);

    // Lock/Unlock handler
    const handleToggleLock = async (taskId: string, locked: boolean) => {
        // Optimistic update
        setOptimisticTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, locked } : t
        ));
        try {
            await toggleTaskLocked(taskId, locked);
        } catch {
            // Revert on error
            setOptimisticTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, locked: !locked } : t
            ));
            toast.error("Error al cambiar bloqueo");
        }
    };

    // List of all tasks (real + draft) for the Gantt chart
    const allTasks = useMemo(() => [...optimisticTasks, ...draftTasks], [optimisticTasks, draftTasks]);

    // Wrapper for setOptimisticTasks - Handles both real and draft tasks
    const handleTasksChange = (newTasks: React.SetStateAction<PlanningTask[]>) => {
        const resolvedTasks = typeof newTasks === "function"
            ? (newTasks as any)(allTasks)
            : newTasks;

        // Separate real tasks from draft tasks to keep their states independent
        // This is important because draft tasks aren't in the database yet
        const real = resolvedTasks.filter((t: any) => !t.isDraft);
        const drafts = resolvedTasks.filter((t: any) => t.isDraft);

        setOptimisticTasks(real);
        setDraftTasks(drafts);
    };

    const handleHistorySnapshot = (previousState: PlanningTask[]) => {
        setHistory(h => [...h, previousState]);
        setFuture([]); // Clear redo history on new action
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        setFuture(f => [...f, allTasks]); // Save current (combined) to future
        setHistory(newHistory);
        handleTasksChange(previousState); // Use wrapper to split real/draft
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];
        const newFuture = future.slice(0, -1);

        setHistory(h => [...h, allTasks]); // Save current (combined) to history
        setFuture(newFuture);
        handleTasksChange(nextState); // Use wrapper to split real/draft
    };


    // Detect Changes logic (Moved up for dependencies)
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
        });
    }, [optimisticTasks, savedTasks]);

    // Sync props to state
    React.useEffect(() => {
        setSavedTasks(tasks);
        // Only reset optimistic state if we don't have pending changes
        // This prevents losing work on accidental re-renders
        if (changedTasks.length === 0) {
            setOptimisticTasks(tasks);
        }
    }, [tasks, changedTasks.length]);

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

    // Handlers
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

    const handleDiscard = () => {
        setIsDiscardConfirmOpen(true);
    };

    const confirmDiscard = () => {
        handleDiscardDrafts(); // Clear Auto-Plan drafts ONLY on confirmation
        setOptimisticTasks(savedTasks);
        setHistory([]); // Clear history on discard
        setIsDiscardConfirmOpen(false);
    };

    // Derive unique machine names from both machines table and tasks
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

    const [selectedMachines, setSelectedMachines] = useState<Set<string>>(
        new Set(allMachineNames)
    );
    const [isMachineFilterOpen, setIsMachineFilterOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize selectedMachines from preferences once dependencies are ready
    useEffect(() => {
        if (prefsInitialized && ganttPrefs.selectedMachines && ganttPrefs.selectedMachines.length > 0) {
            // Filter to only include machines that actually exist
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
            if (newSet.has(machineName)) {
                newSet.delete(machineName);
            } else {
                newSet.add(machineName);
            }
            // Save to preferences
            updateGanttPref({ selectedMachines: Array.from(newSet) });
            return newSet;
        });
    };

    // --- MODAL STATE (Lifted) ---
    const [modalData, setModalData] = React.useState<any>(null);

    const selectAllMachines = () => {
        setSelectedMachines(new Set(allMachineNames));
        updateGanttPref({ selectedMachines: allMachineNames });
    };

    const clearAllMachines = () => {
        setSelectedMachines(new Set());
        updateGanttPref({ selectedMachines: [] });
    };

    // --- HELP TOUR HANDLER ---
    const { startTour, driverObj } = useTour();

    const handleStartTour = () => {
        const isDemo = optimisticTasks.length === 0;

        if (isDemo) {
            // Create a mock task for demonstration
            const demoTask: any = {
                id: "demo-task-1",
                order_id: "demo-order-1",
                machine: machines[0]?.name || "CNC-01",
                operator: "Juan Demo",
                planned_date: new Date().toISOString(),
                planned_end: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 hours
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: "Tarea de demostración",
                status: "planned",
                production_orders: {
                    id: "demo-order-1",
                    // code: "ORD-DEMO", // Removed invalid property
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
                } as any // Cast to any to avoid strict type checking on demo data
            };
            setOptimisticTasks([demoTask]);
        }

        const cleanup = () => {
            if (isDemo) {
                setOptimisticTasks([]);
            }
            setModalData(null); // Ensure modal closes
        };

        const steps: TourStep[] = [
            {
                element: "#planning-gantt-area",
                popover: { title: "Área de Gantt", description: "Visualiza y gestiona la producción. Haz DOBLE CLIC en un espacio vacío para crear una tarea, o en una tarea existente para editarla.", side: "top", align: "center" }
            },
            {
                element: "#planning-view-modes",
                popover: { title: "Modos de Vista", description: "Cambia la escala de tiempo entre Hora, Día y Semana para ver mas detalle o el panorama general.", side: "bottom", align: "start" }
            },
            {
                element: "#planning-machine-filter",
                popover: { title: "Filtro de Máquinas", description: "Selecciona qué máquinas quieres ver en el diagrama.", side: "bottom" }
            },
            {
                element: "#planning-search",
                popover: { title: "Buscador de Piezas", description: "Resalta rápidamente las tareas relacionadas con una pieza o código específico.", side: "bottom" }
            },
            {
                element: "#planning-settings",
                popover: { title: "Configuración", description: "Personaliza la visualización, como mostrar/ocultar líneas de dependencia.", side: "bottom" }
            },
            {
                element: "#planning-fullscreen",
                popover: { title: "Pantalla Completa", description: "Maximiza el área de trabajo para tener una mejor visión de toda la planta.", side: "left" }
            },
            // Transition Step to Modal (Index 6)
            {
                element: "#planning-gantt-area",
                popover: { title: "Creación de Tareas", description: "Al hacer doble clic, se abrirá el formulario de tarea. ¡Vamos a verlo!", side: "top" },
                onHighlightStarted: () => {
                    // Backtracking: Ensure modal is closed if we return to this step
                    setModalData(null);
                }
            },
            // Step 7: Open Modal Explicitly
            {
                element: "#task-modal-content",
                popover: { title: "Formulario de Tarea", description: "Aquí se abrirá el formulario. Llénalo con la información del trabajo.", side: "left", align: "center" },
                onHighlightStarted: () => {
                    // Open modal immediately so it is ready for next steps
                    setModalData({
                        machine: machines[0]?.name || "CNC-01",
                        time: Date.now(),
                        operator: "Juan Demo",
                        isDemo: true // Flag to disable animation for instant rendering
                    });
                }
            },
            // Modal Steps (Index 8+)
            {
                element: "#task-modal-order",
                popover: { title: "Selección de Pieza", description: "Busca y selecciona la orden de producción o pieza a maquinar.", side: "right" }
            },
            {
                element: "#task-modal-start",
                popover: { title: "Inicio Programado", description: "Define la fecha y hora de inicio. Puedes usar el calendario o escribir la hora.", side: "right" }
            },
            {
                element: "#task-modal-end",
                popover: { title: "Fin Estimado", description: "El sistema calculará el fin automáticamente, pero puedes ajustarlo manualmente.", side: "right" }
            },
            {
                element: "#task-modal-operator",
                popover: { title: "Asignación de Operador", description: "Asigna un operador responsable a esta tarea.", side: "top" }
            },
            {
                element: "#task-modal-save",
                popover: { title: "Guardar Cambios", description: "Guarda la tarea para reflejarla en el tablero de todos los usuarios.", side: "top" }
            }
        ];

        startTour(steps, cleanup);
    };

    // Synchronize state if fullscreen is exited via Esc key
    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Close dropdowns (Machine Filter + Filter Panel) on click outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;

            // Machine Filter
            if (isMachineFilterOpen && !target.closest('.machine-filter-dropdown')) {
                setIsMachineFilterOpen(false);
            }

            // Floating Filter Panel (Exclude clicks inside the panel AND inside Popovers/Dialogs (Portals))
            if (isFilterPanelOpen && filterPanelRef.current && !filterPanelRef.current.contains(target)) {
                // Check if click is inside a Popover/Dialog content (radix-ui portals)
                const isInsidePortal = target.closest('[data-radix-popper-content-wrapper]') ||
                    target.closest('[role="dialog"]') ||
                    target.closest('.p-DayPicker'); // Calendar specific

                if (!isInsidePortal) {
                    setIsFilterPanelOpen(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside); // mousedown handles interaction better than click for some UI
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMachineFilterOpen, isFilterPanelOpen]);

    // Show skeleton while preferences are loading
    if (!prefsInitialized) {
        return <ProductionViewSkeleton />;
    }

    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-64px)] w-full flex flex-col bg-background"
        >
            {!isFullscreen && (
                <div className="px-6 pt-6 -mb-2">
                    <DashboardHeader
                        title="Planeación de Producción"
                        description="Planificador de maquinados con vista Gantt interactiva"
                        icon={<CalendarIcon className="w-8 h-8" />}
                        colorClass="text-red-500"
                        bgClass="bg-red-500/10"
                        backUrl="/dashboard/produccion"
                        onHelp={handleStartTour}
                    />
                </div>
            )}
            {/* Compact Header */}
            <div className="flex-none px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm z-10 flex flex-wrap items-center gap-3">
                {/* View Mode Buttons - Moved to Gantt Header */}



                {/* Automation & Evaluation Buttons */}
                <div className="flex items-center gap-1.5" id="planning-automation">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEvalListOpen(!isEvalListOpen)}
                        className={`h-9 font-bold text-xs gap-2 px-3 transition-all active:scale-95 shadow-sm ${showEvaluated
                            ? "border-blue-500/50 bg-blue-500/5 text-blue-600"
                            : ordersPendingEvaluation.length > 0
                                ? "border-amber-500/50 bg-amber-500/5 text-amber-600"
                                : "border-border text-muted-foreground"
                            }`}
                    >
                        <ClipboardList className={`w-4 h-4 ${showEvaluated ? "text-blue-500" : ordersPendingEvaluation.length > 0 ? "text-amber-500" : ""}`} />
                        <span className="hidden sm:inline">
                            {showEvaluated ? `Evaluadas` : `Evaluar`}
                        </span>
                        {ordersPendingEvaluation.length > 0 && (
                            <span className={cn(
                                "text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                                showEvaluated ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                            )}>
                                {ordersPendingEvaluation.length}
                            </span>
                        )}
                    </Button>

                    <Button
                        size="sm"
                        className="h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs gap-2 shadow-md"
                        onClick={handleAutoPlan}
                    >
                        <Wand2 className="w-4 h-4" />
                        <span className="hidden md:inline">Auto-Plan</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsComparisonOpen(true)}
                        className={`h-9 font-bold text-xs gap-2 transition-all ${savedScenarios.length > 0 ? "border-primary/30 text-primary" : "text-muted-foreground"}`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        <span className="hidden lg:inline">Escenarios</span>
                        {savedScenarios.length > 0 && (
                            <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                                {savedScenarios.length}
                            </span>
                        )}
                    </Button>

                    {activePreviewId && (
                        <div className="flex items-center bg-muted/30 rounded-lg border border-border/50 px-1 py-0.5 gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => handleCyclePreview(-1)} className="h-6 w-6 p-0 rounded-md">
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-[9px] font-bold text-primary/80 uppercase max-w-[60px] truncate hidden sm:inline">
                                {savedScenarios.find(s => s.id === activePreviewId)?.name}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => handleCyclePreview(1)} className="h-6 w-6 p-0 rounded-md">
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Save Controls */}
                {(changedTasks.length > 0 || draftTasks.length > 0) && (
                    <div className="flex items-center gap-1.5 border-l border-border pl-2 ml-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[10px] font-bold gap-1 text-muted-foreground hover:text-red-500"
                            onClick={handleDiscard}
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Descartar</span>
                        </Button>
                        <Button
                            size="sm"
                            className="h-9 bg-black hover:bg-black/90 text-white font-black text-xs gap-2 shadow-lg shadow-black/20"
                            onClick={handleSaveAllPlanning}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Guardar</span>
                            {changedTasks.length + draftTasks.length > 0 && (
                                <span className="bg-white/20 px-1.5 rounded-full text-[10px]">
                                    {changedTasks.length + draftTasks.length}
                                </span>
                            )}
                        </Button>
                    </div>
                )}

            </div >

            {/* Bottom Content - Timeline with margins */}
            < div className="flex-1 overflow-hidden relative p-4 flex flex-col" id="planning-gantt-area" >
                <div className="flex-1 w-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
                    <GanttSVG
                        initialMachines={machines}
                        initialOrders={orders}
                        // Tasks are now managed by parent
                        // We merge real tasks with draft tasks for visual preview
                        optimisticTasks={allTasks}
                        setOptimisticTasks={handleTasksChange}
                        onHistorySnapshot={handleHistorySnapshot}
                        hideEmptyMachines={hideEmptyMachines}
                        startControls={
                            <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/50">
                                <button
                                    onClick={() => handleViewModeChange("hour")}
                                    className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all", viewMode === "hour" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                                >
                                    Hora
                                </button>
                                <button
                                    onClick={() => handleViewModeChange("day")}
                                    className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all", viewMode === "day" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                                >
                                    Día
                                </button>
                                <button
                                    onClick={() => handleViewModeChange("week")}
                                    className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all", viewMode === "week" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                                >
                                    Semana
                                </button>
                            </div>
                        }
                        endControls={
                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="w-[150px] relative group">
                                    <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="w-full pl-7 pr-2 py-1 rounded-md border border-border bg-background/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all h-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {/* Machine Filter Dropdown */}
                                <div className="relative machine-filter-dropdown">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMachineFilterOpen(!isMachineFilterOpen);
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-xs"
                                        title={`Filtrar Máquinas (${selectedMachines.size}/${allMachineNames.length})`}
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        <span className="hidden xl:inline">Máquinas</span>
                                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isMachineFilterOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isMachineFilterOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-background border border-border rounded-lg shadow-xl z-[9999] overflow-hidden">
                                            <div className="p-2 border-b border-border space-y-2">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={selectAllMachines}
                                                        className="flex-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                                                    >
                                                        Todas
                                                    </button>
                                                    <button
                                                        onClick={clearAllMachines}
                                                        className="flex-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                                                    >
                                                        Ninguna
                                                    </button>
                                                </div>
                                                <label className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded cursor-pointer transition-colors border-t border-border mt-1 pt-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ocultar vacías</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={hideEmptyMachines}
                                                        onChange={(e) => {
                                                            const val = e.target.checked;
                                                            setHideEmptyMachines(val);
                                                            updateGanttPref({ hideEmptyMachines: val });
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-border text-[#EC1C21] focus:ring-[#EC1C21]/20 accent-[#EC1C21]"
                                                    />
                                                </label>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                                {allMachineNames.map(machineName => (
                                                    <label
                                                        key={machineName}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedMachines.has(machineName)}
                                                            onChange={() => toggleMachine(machineName)}
                                                            className="w-4 h-4 rounded border-border text-[#EC1C21] focus:ring-[#EC1C21]/20 accent-[#EC1C21]"
                                                        />
                                                        <span className="text-sm">{machineName}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Settings Menu */}
                                <div className="relative" ref={settingsRef}>
                                    <button
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className={`p-1.5 rounded-lg border border-border transition-colors ${isSettingsOpen ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                                        title="Ajustes de Visualización"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>

                                    {isSettingsOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-[9999] p-2 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Visualización</div>

                                            <label className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                                <span className="text-sm">Lineas de Dependencia</span>
                                                <input
                                                    type="checkbox"
                                                    checked={showDependencies}
                                                    onChange={(e) => handleShowDependenciesChange(e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-[#EC1C21] focus:ring-[#EC1C21] accent-[#EC1C21]"
                                                />
                                            </label>

                                            <label className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                                <span className="text-sm">Arrastre en Cascada</span>
                                                <input
                                                    type="checkbox"
                                                    checked={cascadeMode}
                                                    onChange={(e) => setCascadeMode(e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-[#EC1C21] focus:ring-[#EC1C21] accent-[#EC1C21]"
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        }
                        searchQuery={searchQuery}
                        viewMode={viewMode}
                        isFullscreen={isFullscreen}
                        selectedMachines={selectedMachines}
                        operators={operators}
                        showDependencies={showDependencies}
                        zoomLevel={zoomLevel} // Pass zoom level
                        setZoomLevel={handleZoomChange} // Pass setter for zoom controls
                        modalData={modalData}
                        setModalData={setModalData}
                        onToggleLock={handleToggleLock}
                        cascadeMode={cascadeMode}
                        container={containerRef.current}
                        onToggleFullscreen={toggleFullscreen}
                    />
                </div>
            </div >

            {/* Evaluation List Sidebar (Simple) */}
            {
                isEvalListOpen && (
                    <div
                        className={cn(
                            "fixed right-0 bottom-0 w-[450px] bg-background/95 backdrop-blur-md border-l border-border shadow-2xl z-[1000] flex flex-col animate-in slide-in-from-right-8 duration-300",
                            isFullscreen ? "top-0" : "top-[64px]"
                        )}
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-[#EC1C21]" />
                                Piezas por Evaluar
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setIsEvalListOpen(false)} className="h-8 w-8 rounded-full hover:bg-muted">
                                <XCircle className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Tabs Segmentado */}
                        <div className="px-3 pt-3">
                            <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                                <button
                                    onClick={() => setShowEvaluated(false)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${!showEvaluated
                                        ? "bg-background text-primary shadow-sm ring-1 ring-border"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    Por Evaluar
                                </button>
                                <button
                                    onClick={() => setShowEvaluated(true)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${showEvaluated
                                        ? "bg-background text-primary shadow-sm ring-1 ring-border"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    Evaluadas
                                </button>
                            </div>
                        </div>

                        {/* Search and Floating Filter Panel Toggle */}
                        <div className="p-4 border-b border-border space-y-3 bg-muted/5">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                        value={evalSearchQuery}
                                        onChange={(e) => setEvalSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="relative" ref={filterPanelRef}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            "h-9 px-3 gap-2 font-bold text-[10px] uppercase transition-all shadow-sm",
                                            isFilterPanelOpen ? "bg-primary text-white border-primary" : "bg-background"
                                        )}
                                        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                                    >
                                        <ListFilter className="w-3.5 h-3.5" />
                                        <span>Opciones</span>
                                        {activeFiltersCount > 0 && (
                                            <span className="flex items-center justify-center min-w-[16px] h-4 rounded-full bg-white text-primary text-[9px] font-black px-1 shadow-sm">
                                                {activeFiltersCount}
                                            </span>
                                        )}
                                    </Button>

                                    {/* Floating Filter Panel */}
                                    {isFilterPanelOpen && (
                                        <div className="absolute top-0 right-full mr-2 w-72 bg-popover border border-border rounded-2xl shadow-2xl z-[1500] p-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between border-b border-border pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Filter className="w-3.5 h-3.5 text-primary" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Filtros Avanzados</span>
                                                    </div>
                                                    {activeFiltersCount > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                                                            onClick={clearAllFilters}
                                                        >
                                                            Limpiar
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Client Filter */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Cliente</label>
                                                    <CustomDropdown
                                                        options={uniqueClients.map(c => ({ label: c, value: c }))}
                                                        value={clientFilter}
                                                        onChange={setClientFilter}
                                                        className="w-full h-8"
                                                        searchable={true}
                                                        multiple={true}
                                                        placeholder="Todos"
                                                    />
                                                </div>

                                                {/* Treatment Filter */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Tratamiento</label>
                                                    <CustomDropdown
                                                        options={[
                                                            { label: "Todos", value: "all" },
                                                            { label: "Con Tratamiento", value: "yes" },
                                                            { label: "Sin Tratamiento", value: "no" }
                                                        ]}
                                                        value={treatmentFilter}
                                                        onChange={setTreatmentFilter}
                                                        className="w-full h-8"
                                                    />
                                                </div>

                                                {/* Date Filter */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Fecha</label>
                                                    <div className="flex gap-1.5">
                                                        <CustomDropdown
                                                            options={[
                                                                { label: "Sin Fecha", value: "none" },
                                                                { label: "Solicitud", value: "request" },
                                                                { label: "Entrega", value: "delivery" }
                                                            ]}
                                                            value={evalFilterType}
                                                            onChange={(val: any) => setEvalFilterType(val)}
                                                            className="flex-1 h-8 text-[10px]"
                                                        />
                                                        {evalFilterType !== "none" && (
                                                            <CustomDropdown
                                                                options={[
                                                                    { label: "Antes", value: "before" },
                                                                    { label: "Después", value: "after" }
                                                                ]}
                                                                value={evalDateOperator}
                                                                onChange={(val: any) => setEvalDateOperator(val)}
                                                                className="w-20 h-8 text-[10px]"
                                                            />
                                                        )}
                                                    </div>
                                                    {evalFilterType !== "none" && (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "w-full justify-start text-left font-normal h-8 text-[10px]",
                                                                        !evalDateValue && "text-muted-foreground"
                                                                    )}
                                                                >
                                                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                                                    {evalDateValue ? (
                                                                        moment(evalDateValue).format("DD [de] MMMM, YYYY")
                                                                    ) : (
                                                                        <span>Seleccionar fecha</span>
                                                                    )}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 z-[2000]" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={evalDateValue ? moment(evalDateValue).toDate() : undefined}
                                                                    onSelect={(date) => setEvalDateValue(date ? moment(date).format("YYYY-MM-DD") : "")}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                </div>

                                                {/* Sort Section */}
                                                <div className="space-y-1.5 pt-2 border-t border-border">
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Orden</label>
                                                    <div className="flex gap-1.5">
                                                        <CustomDropdown
                                                            options={[
                                                                { label: "Prioridad", value: "auto" },
                                                                { label: "Fecha", value: "date" },
                                                                { label: "Código", value: "code" },
                                                                { label: "Mixto", value: "both" }
                                                            ]}
                                                            value={evalSortBy}
                                                            onChange={setEvalSortBy}
                                                            className="flex-1 h-8 text-[10px]"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 border-border/60 hover:bg-primary/5"
                                                            onClick={() => setEvalSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                                                        >
                                                            {evalSortDirection === "asc" ? <ArrowUpAZ className="w-3.5 h-3.5" /> : <ArrowDownZA className="w-3.5 h-3.5" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {ordersPendingEvaluation.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/5 rounded-3xl border border-dashed border-border/60 mx-2 mt-4">
                                    <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center shadow-sm mb-4 border border-border/40">
                                        <ClipboardList className="w-8 h-8 text-muted-foreground opacity-40" />
                                    </div>
                                    <h4 className="text-sm font-bold text-foreground">¡Todo al día!</h4>
                                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px]">
                                        {showEvaluated
                                            ? "No se han encontrado piezas evaluadas con los filtros actuales."
                                            : "No hay piezas pendientes de evaluación por ahora."}
                                    </p>
                                </div>
                            ) : (
                                ordersPendingEvaluation.map(order => {
                                    const deliveryDate = (order as any).projects?.delivery_date;
                                    const companyName = (order as any).projects?.company;
                                    const blueprintUrl = (order as any).drawing_url;

                                    return (
                                        <div
                                            key={order.id}
                                            className="p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div
                                                    className="cursor-pointer flex-1"
                                                    onClick={() => {
                                                        const idx = ordersPendingEvaluation.findIndex(o => o.id === order.id);
                                                        setEvalNavigationList([...ordersPendingEvaluation]);
                                                        setSelectedEvalIndex(idx);
                                                        setSelectedOrderForEval(order);
                                                        setIsEvalModalOpen(true);
                                                    }}
                                                >
                                                    <div className="text-xs font-black uppercase text-primary mb-0.5 tracking-tight">
                                                        {order.part_code}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 pr-6">
                                                        {order.part_name}
                                                    </div>
                                                </div>

                                                {/* Action Buttons & Date in one line */}
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    {blueprintUrl && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-md bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors border border-primary/20"
                                                            title="Ver Plano"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const fileId = extractDriveFileId(blueprintUrl);
                                                                if (fileId) {
                                                                    setPreviewFileId(fileId);
                                                                } else {
                                                                    window.open(blueprintUrl, '_blank');
                                                                }
                                                            }}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    {deliveryDate && (
                                                        <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded border border-border/50">
                                                            {moment(deliveryDate).format("DD MMM")}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                                                <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[180px]">
                                                    {companyName || "Sin Empresa"}
                                                </div>
                                                <div className="flex gap-2">
                                                    {showEvaluated && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                                            title="Limpiar Evaluación"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIdToClearEval(order.id);
                                                            }}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    {!showEvaluated && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-[9px] font-black uppercase text-primary/70 hover:text-primary hover:bg-primary/5 rounded-md"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedOrderForEval(order);
                                                                setIsEvalModalOpen(true);
                                                            }}
                                                        >
                                                            Evaluar
                                                        </Button>
                                                    )}
                                                    {showEvaluated && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-[9px] font-black uppercase text-primary/70 hover:text-primary hover:bg-primary/5 rounded-md"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedOrderForEval(order);
                                                                setIsEvalModalOpen(true);
                                                            }}
                                                        >
                                                            Ver/Editar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )
            }

            {/* Evaluation Modal */}
            <EvaluationModal
                isOpen={isEvalModalOpen}
                onClose={() => setIsEvalModalOpen(false)}
                order={selectedOrderForEval as any}
                machines={machines}
                onSuccess={(newSteps) => {
                    if (selectedEvalIndex !== -1 && evalNavigationList[selectedEvalIndex]) {
                        const updatedList = [...evalNavigationList];
                        const updatedItem = { ...updatedList[selectedEvalIndex] } as any;
                        updatedItem.evaluation = newSteps;
                        updatedList[selectedEvalIndex] = updatedItem;
                        setEvalNavigationList(updatedList);
                    }
                    router.refresh();
                }}
                onNext={handleNextEval}
                onPrevious={handlePrevEval}
                hasNext={selectedEvalIndex < evalNavigationList.length - 1}
                hasPrevious={selectedEvalIndex > 0}
                container={containerRef.current}
            />

            {/* PDF/Drive Preview Modal */}
            <Dialog open={!!previewFileId} onOpenChange={(open) => !open && setPreviewFileId(null)}>
                <DialogContent
                    container={containerRef.current}
                    className="max-w-5xl h-[90vh] p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl z-[10002]"
                >
                    <div className="relative w-full h-full flex flex-col">
                        <div className="p-4 bg-muted/10 border-b border-border flex items-center justify-between">
                            <DialogTitle className="text-sm font-bold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Vista Previa de Plano
                            </DialogTitle>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                                    onClick={() => window.open(`https://drive.google.com/file/d/${previewFileId}/view`, '_blank')}
                                    title="Abrir en pestaña nueva"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => setPreviewFileId(null)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-muted/5">
                            {previewFileId && (
                                <iframe
                                    src={`https://drive.google.com/file/d/${previewFileId}/preview`}
                                    className="w-full h-full border-none"
                                    allow="autoplay"
                                    title="Blueprint Preview"
                                ></iframe>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Auto-Plan Configuration Dialog */}
            <AutoPlanDialog
                isOpen={isAutoPlanDialogOpen}
                onClose={() => setIsAutoPlanDialogOpen(false)}
                orders={orders}
                tasks={[...tasks]}
                machines={machines.map(m => m.name)}
                onSaveScenario={handleSaveScenario}
                scenarioCount={savedScenarios.length}
                container={containerRef.current}
            />

            {/* Scenario Comparison Panel */}
            <ScenarioComparison
                isOpen={isComparisonOpen}
                onClose={() => setIsComparisonOpen(false)}
                scenarios={savedScenarios}
                onPreview={handlePreviewScenario}
                onApply={handleApplyScenario}
                onDelete={handleDeleteScenario}
                activePreviewId={activePreviewId}
                container={containerRef.current}
            />

            {/* Clear Evaluation Confirmation */}
            <AlertDialog open={!!idToClearEval} onOpenChange={(open) => !open && setIdToClearEval(null)}>
                <AlertDialogContent container={containerRef.current} className="z-[10003]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Limpiar Evaluación
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas limpiar la evaluación de esta pieza? Volverá a aparecer en la lista de 'Por Evaluar' y se quitará de la planeación actual.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => idToClearEval && confirmClearEvaluation(idToClearEval)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Limpiar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Discard Changes Confirmation */}
            <AlertDialog open={isDiscardConfirmOpen} onOpenChange={setIsDiscardConfirmOpen}>
                <AlertDialogContent container={containerRef.current} className="z-[10003]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-primary" />
                            Descartar Cambios
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas descartar todos los cambios no guardados? Esta acción revertirá el Gantt a su último estado guardado y no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Continuar Editando</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDiscard}
                            className="bg-primary hover:bg-primary/90 text-white"
                        >
                            Descartar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
