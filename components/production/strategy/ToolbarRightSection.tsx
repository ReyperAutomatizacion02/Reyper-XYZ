"use client";

import React from "react";
import { ClipboardList, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type SchedulingStrategy, type SchedulingResult } from "@/lib/scheduling-utils";
import { PlanningDetailPopover } from "./PlanningDetailPopover";
import { type OrderStatus } from "./types";

interface ToolbarRightSectionProps {
    liveDraftResult: SchedulingResult | null;
    activeStrategy: SchedulingStrategy | "NONE";
    orderStatuses: OrderStatus[];
    machineLoad: [string, number][];
    maxMachineHours: number;
    onSaveAllPlanning: () => void;
    isEvalListOpen: boolean;
    onToggleEvalList: () => void;
    ordersPendingEvalCount: number;
    showEvaluated: boolean;
    changedTasksCount: number;
    draftTasksCount: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ToolbarRightSection({
    liveDraftResult,
    activeStrategy,
    orderStatuses,
    machineLoad,
    maxMachineHours,
    onSaveAllPlanning,
    isEvalListOpen,
    onToggleEvalList,
    ordersPendingEvalCount,
    showEvaluated,
    changedTasksCount,
    draftTasksCount,
    containerRef,
}: ToolbarRightSectionProps) {
    return (
        <div className="ml-2 flex flex-wrap items-center justify-end gap-4 border-l border-border px-4">
            {liveDraftResult && activeStrategy !== "NONE" && (
                <div className="flex shrink-0 items-center gap-4">
                    <div className="flex min-w-[70px] flex-col items-end">
                        <span className="text-[9px] font-black uppercase leading-none text-muted-foreground">
                            A tiempo
                        </span>
                        <span
                            className={cn(
                                "text-xs font-black leading-tight",
                                liveDraftResult.metrics.lateOrders > 0 ? "text-red-500" : "text-green-500"
                            )}
                        >
                            {liveDraftResult.metrics.totalOrders - liveDraftResult.metrics.lateOrders}/
                            {liveDraftResult.metrics.totalOrders}
                        </span>
                    </div>
                    <div className="flex min-w-[60px] flex-col items-end">
                        <span className="text-[9px] font-black uppercase leading-none text-muted-foreground">
                            Carga
                        </span>
                        <span className="text-xs font-black leading-tight text-primary">
                            {liveDraftResult.metrics.totalHours.toFixed(0)}h
                        </span>
                    </div>

                    <PlanningDetailPopover
                        liveDraftResult={liveDraftResult}
                        orderStatuses={orderStatuses}
                        machineLoad={machineLoad}
                        maxMachineHours={maxMachineHours}
                        containerRef={containerRef}
                    />

                    <Button
                        size="sm"
                        onClick={onSaveAllPlanning}
                        disabled={liveDraftResult.tasks.length === 0}
                        className="ml-2 h-8 rounded-xl bg-[#EC1C21] text-[10px] font-black uppercase tracking-tight text-white shadow-lg shadow-[#EC1C21]/20 transition-all hover:scale-[1.05] hover:bg-[#EC1C21]/90 active:scale-95"
                    >
                        Aplicar
                    </Button>
                </div>
            )}

            <div className="ml-2 flex shrink-0 items-center gap-3 border-l border-border px-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleEvalList}
                    className={cn(
                        "h-8 gap-2 rounded-xl border-border/60 px-4 text-[10px] font-black uppercase shadow-sm transition-all",
                        isEvalListOpen ? "border-[#EC1C21] bg-[#EC1C21] text-white" : "hover:bg-muted"
                    )}
                >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>{showEvaluated ? "Evaluadas" : "Por Evaluar"}</span>
                    {ordersPendingEvalCount > 0 && (
                        <span
                            className={cn(
                                "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black text-white duration-300 animate-in zoom-in",
                                isEvalListOpen ? "bg-white text-[#EC1C21]" : "bg-[#EC1C21]"
                            )}
                        >
                            {ordersPendingEvalCount}
                        </span>
                    )}
                </Button>

                {activeStrategy === "NONE" && (changedTasksCount > 0 || draftTasksCount > 0) && (
                    <Button
                        size="sm"
                        onClick={onSaveAllPlanning}
                        className="h-8 rounded-xl bg-black text-[10px] font-black uppercase tracking-tight text-white shadow-lg shadow-black/10 hover:bg-black/90"
                    >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Guardar
                    </Button>
                )}
            </div>
        </div>
    );
}
