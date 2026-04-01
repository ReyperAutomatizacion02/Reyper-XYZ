"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Save, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getProductionTaskColor } from "@/utils/production-colors";
import { SchedulingStrategy, SchedulingResult } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

interface PlanningAlert {
    type: "OVERLAP" | "MISSING_OPERATOR";
    task: PlanningTask;
    details: string;
}

interface StrategyToolbarProps {
    activeStrategy: SchedulingStrategy | "NONE";
    onStrategyChange: (strategy: SchedulingStrategy | "NONE") => void;
    planningAlerts: PlanningAlert[];
    onLocateTask: (taskId: string) => void;
    liveDraftResult: SchedulingResult | null;
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

    return (
        <div className="flex flex-col gap-3 bg-background px-6 pb-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 p-2 shadow-sm backdrop-blur-sm">
                <div className="custom-scrollbar flex shrink-0 items-center gap-6 overflow-x-auto px-2 pb-1 md:pb-0">
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

                    {/* Planning Alerts */}
                    <div className="mx-1 h-10 border-l border-border/50" />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "relative h-9 w-9 rounded-xl transition-all duration-300",
                                    planningAlerts.length > 0
                                        ? "bg-amber-500/10 text-amber-500 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)] hover:bg-amber-500/20"
                                        : "text-muted-foreground opacity-40 hover:opacity-100"
                                )}
                            >
                                <AlertTriangle
                                    className={cn("h-5 w-5", planningAlerts.length > 0 && "animate-pulse")}
                                />
                                {planningAlerts.length > 0 && (
                                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white shadow-md ring-2 ring-background">
                                        {planningAlerts.length}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            container={containerRef.current}
                            className="z-[10001] w-80 overflow-hidden p-0"
                            align="start"
                        >
                            <div className="border-b border-border bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider">
                                        Alertas de Planeación
                                    </h4>
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                    Se detectaron {planningAlerts.length} posibles inconvenientes en el cronograma
                                    actual.
                                </p>
                            </div>
                            <div className="custom-scrollbar flex max-h-[300px] flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
                                {planningAlerts.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-8 text-center opacity-50">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">
                                            Sin alertas detectadas
                                        </p>
                                    </div>
                                ) : (
                                    planningAlerts.map((alert, idx) => (
                                        <div
                                            key={idx}
                                            className="group flex cursor-default flex-col rounded-lg border border-border/50 bg-background p-2 transition-colors hover:bg-muted/30"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase leading-none",
                                                        alert.type === "OVERLAP"
                                                            ? "border-red-500/20 bg-red-500/10 text-red-500"
                                                            : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                                                    )}
                                                >
                                                    {alert.type === "OVERLAP" ? "Solapamiento" : "Carga"}
                                                </span>
                                                <span className="truncate text-[9px] font-black uppercase text-muted-foreground">
                                                    {alert.task.machine}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div
                                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: getProductionTaskColor(alert.task) }}
                                                />
                                                <span className="truncate text-[11px] font-bold">
                                                    {alert.task.production_orders?.part_code} -{" "}
                                                    {alert.task.production_orders?.part_name}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                                {alert.details}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2 h-6 w-full gap-1.5 text-[9px] font-black uppercase tracking-widest transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                                                onClick={() => onLocateTask(alert.task.id)}
                                            >
                                                <Search className="h-3 w-3" />
                                                Localizar
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

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
            </div>
        </div>
    );
}
