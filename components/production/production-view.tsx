"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import { Calendar as CalendarIcon } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { startOfDay, isBefore, isSameDay } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProductionViewSkeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { useProductionTour } from "@/hooks/use-production-tour";
import { toast } from "sonner";
import { SchedulingResult, OrderWithRelations, WorkShift, DEFAULT_SHIFTS } from "@/lib/scheduling-utils";
import { StrategyToolbar } from "./strategy-toolbar";
import { GanttStartControls, GanttEndControls, ProjectOption } from "./gantt-controls";
import { EvaluationSidebar } from "./evaluation-sidebar";
import { ConfirmationDialogs } from "./confirmation-dialogs";
import { useEvaluationFilters } from "./hooks/use-evaluation-filters";
import { useProductionTasks } from "./hooks/use-production-tasks";
import { useGanttSettings } from "./hooks/use-gantt-settings";
import { useStrategyDraft } from "./hooks/use-strategy-draft";

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

    // --- Derive static lists from props ---
    const allMachineNames = useMemo(() => {
        const names = new Set([
            ...machines.map((m) => m.name),
            ...tasks.map((t) => t.machine).filter((n): n is string => !!n),
        ]);
        if (tasks.some((t) => !t.machine)) names.add("Sin Máquina");
        return Array.from(names).sort();
    }, [machines, tasks]);

    const availableProjects = useMemo<ProjectOption[]>(() => {
        const seen = new Map<string, ProjectOption>();
        for (const order of orders) {
            if (!order.project_id || seen.has(order.project_id)) continue;
            seen.set(order.project_id, {
                id: order.project_id,
                code: order.projects?.code ?? order.project_id,
                company: order.projects?.company ?? null,
            });
        }
        return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [orders]);

    // --- Domain hooks ---
    const taskState = useProductionTasks({ initialTasks: tasks, initialOrders: orders });

    const settings = useGanttSettings({ allMachineNames });

    const strategy = useStrategyDraft({
        initialOrders: orders,
        optimisticTasks: taskState.optimisticTasks,
        draftTasks: taskState.draftTasks,
        setDraftTasks: taskState.setDraftTasks,
        machines,
        shifts,
    });

    const evalFilters = useEvaluationFilters(orders as OrderWithRelations[], {
        isLoading: settings.prefsLoading,
        getEvalPrefs: settings.getEvalPrefs,
        updateEvalPref: settings.updateEvalPref,
        updateEvalPrefNow: settings.updateEvalPrefNow,
    });

    // --- Simple UI state (intentionally kept local — no domain logic) ---
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
    const [isEvalListOpen, setIsEvalListOpen] = useState(false);
    const [selectedOrderForEval, setSelectedOrderForEval] = useState<Order | null>(null);
    const [idToClearEval, setIdToClearEval] = useState<string | null>(null);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
    const [modalData, setModalData] = useState<any>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Planning alerts ---
    const planningAlerts = useMemo(() => {
        const alerts: { type: "OVERLAP" | "MISSING_OPERATOR"; task: PlanningTask; details: string }[] = [];
        const now = new Date();
        const today = startOfDay(now);
        const flaggedIds = new Set<string>();
        const machineGroups: Record<string, PlanningTask[]> = {};

        strategy.allTasks.forEach((task) => {
            if (!task.machine || !task.planned_date || !task.planned_end) return;
            if (isBefore(new Date(task.planned_end!), now)) return;

            if (!machineGroups[task.machine]) machineGroups[task.machine] = [];
            machineGroups[task.machine].push(task);

            if (!task.operator?.trim() && isSameDay(new Date(task.planned_date!), today)) {
                alerts.push({ type: "MISSING_OPERATOR", task, details: "Sin operador asignado para hoy" });
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
                    if (!t1.planned_end || !t2.planned_date || !t2.planned_end) continue;
                    const s1 = new Date(t1.planned_date!);
                    const e1 = new Date(t1.planned_end);
                    const s2 = new Date(t2.planned_date!);
                    const e2 = new Date(t2.planned_end);
                    if (isBefore(s1, e2) && isBefore(s2, e1)) {
                        if (!flaggedIds.has(t1.id)) {
                            alerts.push({ type: "OVERLAP", task: t1, details: `Solapamiento en ${t1.machine}` });
                            flaggedIds.add(t1.id);
                        }
                        if (!flaggedIds.has(t2.id)) {
                            alerts.push({ type: "OVERLAP", task: t2, details: `Solapamiento en ${t2.machine}` });
                            flaggedIds.add(t2.id);
                        }
                    }
                }
            }
        });

        return alerts;
    }, [strategy.allTasks]);

    // --- Keyboard shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.key === "z") {
                e.preventDefault();
                taskState.handleUndo(strategy.allTasks);
            } else if (e.key === "y") {
                e.preventDefault();
                taskState.handleRedo(strategy.allTasks);
            } else if (e.key === "s" && taskState.changedTasks.length > 0) {
                e.preventDefault();
                if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
                saveDebounceRef.current = setTimeout(() => taskState.handleSave(), 400);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [taskState, strategy.allTasks]);

    // --- Fullscreen ---
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    // --- Focus task helper ---
    const locateTask = (taskId: string) => {
        setFocusTaskId(taskId);
        setTimeout(() => setFocusTaskId(null), 3000);
    };

    // --- Help tour ---
    const { handleStartTour } = useProductionTour({
        machines,
        hasOptimisticTasks: taskState.optimisticTasks.length > 0,
        setOptimisticTasks: taskState.setOptimisticTasks,
        setModalData,
    });

    if (!settings.prefsInitialized) {
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

            <StrategyToolbar
                activeStrategy={strategy.activeStrategy}
                onStrategyChange={strategy.handleStrategyChange}
                planningAlerts={planningAlerts}
                onLocateTask={locateTask}
                liveDraftResult={strategy.liveDraftResult as SchedulingResult | null}
                orders={strategy.localOrders as OrderWithRelations[]}
                eligibleOrders={strategy.eligibleOrders}
                excludedOrderIds={strategy.excludedOrderIds}
                onToggleOrderExclusion={strategy.toggleOrderExclusion}
                onSelectAllOrders={strategy.selectAllOrders}
                onDeselectAllOrders={strategy.deselectAllOrders}
                onSaveAllPlanning={taskState.handleSaveAllPlanning}
                isEvalListOpen={isEvalListOpen}
                onToggleEvalList={() => setIsEvalListOpen(!isEvalListOpen)}
                ordersPendingEvalCount={evalFilters.ordersPendingEvaluation.length}
                showEvaluated={evalFilters.showEvaluated}
                changedTasksCount={taskState.changedTasks.length}
                draftTasksCount={taskState.draftTasks.length}
                containerRef={containerRef}
            />

            <div className="relative flex flex-1 flex-col overflow-hidden p-4" id="planning-gantt-area">
                <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                    <GanttSVG
                        initialMachines={machines}
                        initialOrders={orders}
                        optimisticTasks={strategy.allTasks}
                        setOptimisticTasks={(newTasks) => taskState.handleTasksChange(newTasks, strategy.allTasks)}
                        onHistorySnapshot={taskState.handleHistorySnapshot}
                        hideEmptyMachines={settings.hideEmptyMachines}
                        searchQuery={searchQuery}
                        viewMode={settings.viewMode}
                        isFullscreen={isFullscreen}
                        selectedMachines={settings.selectedMachines}
                        operators={operators}
                        showDependencies={settings.showDependencies}
                        zoomLevel={settings.zoomLevel}
                        setZoomLevel={settings.handleZoomChange}
                        onTaskDoubleClick={(task) => {
                            setSelectedOrderForEval(task.production_orders);
                            setIsEvalListOpen(true);
                        }}
                        focusTaskId={focusTaskId}
                        projectFilter={settings.projectFilter}
                        startControls={
                            <GanttStartControls
                                viewMode={settings.viewMode}
                                onViewModeChange={settings.handleViewModeChange}
                            />
                        }
                        endControls={
                            <GanttEndControls
                                viewMode={settings.viewMode}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                allMachineNames={allMachineNames}
                                selectedMachines={settings.selectedMachines}
                                onToggleMachine={settings.toggleMachine}
                                onSelectAllMachines={settings.selectAllMachines}
                                onClearAllMachines={settings.clearAllMachines}
                                showDependencies={settings.showDependencies}
                                onShowDependenciesChange={settings.handleShowDependenciesChange}
                                hideEmptyMachines={settings.hideEmptyMachines}
                                onHideEmptyMachinesChange={settings.handleHideEmptyMachinesChange}
                                cascadeMode={settings.cascadeMode}
                                onCascadeModeChange={settings.handleCascadeModeChange}
                                availableProjects={availableProjects}
                                projectFilter={settings.projectFilter}
                                onProjectFilterChange={settings.handleProjectFilterChange}
                                onClearGanttFilters={settings.clearGanttFilters}
                                zoomLevel={settings.zoomLevel}
                                onZoomChange={settings.handleZoomChange}
                                isFullscreen={isFullscreen}
                                onToggleFullscreen={toggleFullscreen}
                            />
                        }
                        onToggleLock={taskState.handleToggleLock}
                        cascadeMode={settings.cascadeMode}
                        container={containerRef.current}
                    />
                </div>
            </div>

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
                    strategy.setLocalOrders((prev) =>
                        prev.map((o) =>
                            o.id === orderId ? { ...o, evaluation: newSteps as unknown as typeof o.evaluation } : o
                        )
                    );
                    if (strategy.activeStrategy !== "NONE") {
                        taskState.setDraftTasks((prev) => prev.filter((d) => d.order_id !== orderId));
                    }
                    router.refresh();
                }}
            />

            <ConfirmationDialogs
                idToClearEval={idToClearEval}
                onClearEvalCancel={() => setIdToClearEval(null)}
                onClearEvalConfirm={async (id) => {
                    await taskState.handleClearEvaluation(id);
                    setIdToClearEval(null);
                }}
                isDiscardConfirmOpen={isDiscardConfirmOpen}
                onDiscardCancel={setIsDiscardConfirmOpen}
                onDiscardConfirm={() => {
                    taskState.confirmDiscard();
                    setIsDiscardConfirmOpen(false);
                }}
                container={containerRef.current}
            />
        </div>
    );
}
