"use client";

import React, { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, isAfter } from "date-fns";
import { type SchedulingStrategy, type SchedulingResult, type OrderWithRelations } from "@/lib/scheduling-utils";
import { OrderSelectionPopover } from "./strategy/OrderSelectionPopover";
import { PlanningAlertsPopover } from "./strategy/PlanningAlertsPopover";
import { ToolbarRightSection } from "./strategy/ToolbarRightSection";

export type { PlanningAlert } from "./strategy/types";

interface StrategyToolbarProps {
    activeStrategy: SchedulingStrategy | "NONE";
    onStrategyChange: (strategy: SchedulingStrategy | "NONE") => void;
    planningAlerts: import("./strategy/types").PlanningAlert[];
    onLocateTask: (taskId: string) => void;
    liveDraftResult: SchedulingResult | null;
    orders: OrderWithRelations[];
    eligibleOrders: OrderWithRelations[];
    excludedOrderIds: Set<string>;
    onToggleOrderExclusion: (id: string) => void;
    onSelectAllOrders: () => void;
    onDeselectAllOrders: () => void;
    onSaveAllPlanning: () => void;
    isEvalListOpen: boolean;
    onToggleEvalList: () => void;
    ordersPendingEvalCount: number;
    showEvaluated: boolean;
    changedTasksCount: number;
    draftTasksCount: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const STRATEGY_LABELS: Record<string, string> = {
    NONE: "Manual",
    CRITICAL_PATH: "Ruta Crítica",
};

export function StrategyToolbar({
    activeStrategy,
    onStrategyChange,
    planningAlerts,
    onLocateTask,
    liveDraftResult,
    orders,
    eligibleOrders,
    excludedOrderIds,
    onToggleOrderExclusion,
    onSelectAllOrders,
    onDeselectAllOrders,
    onSaveAllPlanning,
    isEvalListOpen,
    onToggleEvalList,
    ordersPendingEvalCount,
    showEvaluated,
    changedTasksCount,
    draftTasksCount,
    containerRef,
}: StrategyToolbarProps) {
    const toggleStrategy = () => {
        onStrategyChange(activeStrategy === "NONE" ? "CRITICAL_PATH" : "NONE");
    };

    const orderStatuses = useMemo(() => {
        if (!liveDraftResult || activeStrategy === "NONE") return [];
        return orders
            .map((order) => {
                const orderTasks = liveDraftResult.tasks.filter((t) => t.order_id === order.id);
                if (orderTasks.length === 0) return null;
                const lastEnd = orderTasks.reduce((max, t) => {
                    const end = new Date(t.planned_end!);
                    return end > max ? end : max;
                }, new Date(0));
                const deliveryDate = order.projects?.delivery_date ? new Date(order.projects.delivery_date) : null;
                const isLate = deliveryDate ? isAfter(lastEnd, deliveryDate) : false;
                const diffDays = deliveryDate ? differenceInCalendarDays(deliveryDate, lastEnd) : null;
                return { order, isLate, lastEnd, deliveryDate, diffDays };
            })
            .filter(
                (
                    x
                ): x is {
                    order: OrderWithRelations;
                    isLate: boolean;
                    lastEnd: Date;
                    deliveryDate: Date | null;
                    diffDays: number | null;
                } => x !== null
            );
    }, [liveDraftResult, orders, activeStrategy]);

    const machineLoad = useMemo(() => {
        if (!liveDraftResult) return [];
        return Object.entries(liveDraftResult.metrics.machineUtilization)
            .filter(([, h]) => h > 0)
            .sort(([, a], [, b]) => b - a);
    }, [liveDraftResult]);

    const maxMachineHours = machineLoad[0]?.[1] ?? 1;

    return (
        <div className="flex flex-col gap-3 bg-background px-6 pb-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 p-2 shadow-sm backdrop-blur-sm">
                <div className="custom-scrollbar flex shrink-0 items-center gap-6 overflow-x-auto px-2 pb-1 md:pb-0">
                    {/* Strategy toggle */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 px-1">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                                Estrategia
                            </span>
                        </div>
                        <Button
                            variant={activeStrategy === "NONE" ? "outline" : "default"}
                            size="sm"
                            onClick={toggleStrategy}
                            className={cn(
                                "h-8 rounded-xl px-4 text-[10px] font-black uppercase tracking-tight transition-all",
                                activeStrategy !== "NONE"
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground"
                            )}
                        >
                            {STRATEGY_LABELS[activeStrategy] || "Manual"}
                        </Button>
                    </div>

                    <OrderSelectionPopover
                        eligibleOrders={eligibleOrders}
                        excludedOrderIds={excludedOrderIds}
                        onToggleOrderExclusion={onToggleOrderExclusion}
                        onSelectAllOrders={onSelectAllOrders}
                        onDeselectAllOrders={onDeselectAllOrders}
                        containerRef={containerRef}
                    />

                    <PlanningAlertsPopover
                        planningAlerts={planningAlerts}
                        onLocateTask={onLocateTask}
                        containerRef={containerRef}
                    />
                </div>

                <ToolbarRightSection
                    liveDraftResult={liveDraftResult}
                    activeStrategy={activeStrategy}
                    orderStatuses={orderStatuses}
                    machineLoad={machineLoad}
                    maxMachineHours={maxMachineHours}
                    onSaveAllPlanning={onSaveAllPlanning}
                    isEvalListOpen={isEvalListOpen}
                    onToggleEvalList={onToggleEvalList}
                    ordersPendingEvalCount={ordersPendingEvalCount}
                    showEvaluated={showEvaluated}
                    changedTasksCount={changedTasksCount}
                    draftTasksCount={draftTasksCount}
                    containerRef={containerRef}
                />
            </div>
        </div>
    );
}
