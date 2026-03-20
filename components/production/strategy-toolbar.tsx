"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Save,
    Search,
    Sparkles,
} from "lucide-react";
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
    type: 'OVERLAP' | 'MISSING_OPERATOR';
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
    changedTasksCount: number;
    draftTasksCount: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const STRATEGIES = ["NONE", "URGENCY", "DELIVERY_DATE", "CRITICAL_PATH", "PROJECT_GROUP", "FAB_TIME", "FAST_TRACK", "TREATMENTS", "MATERIAL_OPTIMIZATION"] as const;

const STRATEGY_LABELS: Record<string, string> = {
    NONE: "Manual",
    URGENCY: "Urgencia",
    DELIVERY_DATE: "Entrega",
    CRITICAL_PATH: "Ruta Crítica",
    PROJECT_GROUP: "Proyecto",
    FAB_TIME: "Carga",
    FAST_TRACK: "Express",
    TREATMENTS: "Tratamientos",
    MATERIAL_OPTIMIZATION: "Material",
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
    changedTasksCount,
    draftTasksCount,
    containerRef,
}: StrategyToolbarProps) {
    const cycleStrategy = (direction: 1 | -1) => {
        const idx = STRATEGIES.indexOf(activeStrategy as typeof STRATEGIES[number]);
        const next = STRATEGIES[(idx + direction + STRATEGIES.length) % STRATEGIES.length];
        onStrategyChange(next as SchedulingStrategy | "NONE");
    };

    return (
        <div className="flex flex-col gap-3 px-6 pb-4 bg-background">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-2xl border border-border/50 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar pb-1 md:pb-0 px-2 shrink-0">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 px-1">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Estrategia</span>
                        </div>

                        <div className="flex items-center bg-muted/50 rounded-xl border border-border/50 p-0.5 shadow-inner min-w-[200px] group select-none">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-background shadow-none shrink-0"
                                onClick={() => cycleStrategy(-1)}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>

                            <div
                                className="flex-1 flex flex-col items-center justify-center cursor-pointer px-3 py-0.5 transition-all active:scale-95"
                                onDoubleClick={() => onStrategyChange("NONE")}
                                title="Doble clic para volver a Manual"
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeStrategy}
                                        initial={{ opacity: 0, scale: 0.95, y: 2 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -2 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                        className={cn(
                                            "text-[10px] font-black uppercase tracking-tight text-center",
                                            activeStrategy === "NONE" ? "text-muted-foreground" : "text-primary"
                                        )}
                                    >
                                        {STRATEGY_LABELS[activeStrategy] || "Manual"}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-background shadow-none shrink-0"
                                onClick={() => cycleStrategy(1)}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Planning Alerts */}
                    <div className="h-10 border-l border-border/50 mx-1" />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-9 w-9 rounded-xl transition-all duration-300 relative",
                                    planningAlerts.length > 0
                                        ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)]"
                                        : "text-muted-foreground opacity-40 hover:opacity-100"
                                )}
                            >
                                <AlertTriangle className={cn("w-5 h-5", planningAlerts.length > 0 && "animate-pulse")} />
                                {planningAlerts.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white ring-2 ring-background shadow-md">
                                        {planningAlerts.length}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent container={containerRef.current} className="w-80 p-0 overflow-hidden z-[10001]" align="start">
                            <div className="p-3 border-b border-border bg-muted/30">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider">Alertas de Planeación</h4>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Se detectaron {planningAlerts.length} posibles inconvenientes en el cronograma actual.
                                </p>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1 custom-scrollbar">
                                {planningAlerts.length === 0 ? (
                                    <div className="py-8 text-center flex flex-col items-center gap-2 opacity-50">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                        <p className="text-[10px] uppercase font-bold tracking-widest">Sin alertas detectadas</p>
                                    </div>
                                ) : (
                                    planningAlerts.map((alert, idx) => (
                                        <div
                                            key={idx}
                                            className="flex flex-col p-2 rounded-lg border border-border/50 bg-background hover:bg-muted/30 transition-colors group cursor-default"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border leading-none shrink-0",
                                                    alert.type === 'OVERLAP'
                                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                )}>
                                                    {alert.type === 'OVERLAP' ? 'Solapamiento' : 'Carga'}
                                                </span>
                                                <span className="text-[9px] font-black text-muted-foreground uppercase truncate">
                                                    {alert.task.machine}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: getProductionTaskColor(alert.task) }}
                                                />
                                                <span className="text-[11px] font-bold truncate">
                                                    {alert.task.production_orders?.part_code} - {alert.task.production_orders?.part_name}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                                                {alert.details}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-full mt-2 text-[9px] font-black uppercase tracking-widest gap-1.5 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                                                onClick={() => onLocateTask(alert.task.id)}
                                            >
                                                <Search className="w-3 h-3" />
                                                Localizar
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex items-center gap-4 px-4 border-l border-border ml-2 flex-wrap justify-end">
                    {liveDraftResult && activeStrategy !== "NONE" && (
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="flex flex-col items-end min-w-[70px]">
                                <span className="text-[9px] font-black text-muted-foreground uppercase leading-none">A tiempo</span>
                                <span className={cn(
                                    "text-xs font-black leading-tight",
                                    liveDraftResult.metrics.lateOrders > 0 ? "text-red-500" : "text-green-500"
                                )}>
                                    {liveDraftResult.metrics.totalOrders - liveDraftResult.metrics.lateOrders}/{liveDraftResult.metrics.totalOrders}
                                </span>
                            </div>
                            <div className="flex flex-col items-end min-w-[60px]">
                                <span className="text-[9px] font-black text-muted-foreground uppercase leading-none">Carga</span>
                                <span className="text-xs font-black leading-tight text-primary">
                                    {liveDraftResult.metrics.totalHours.toFixed(0)}h
                                </span>
                            </div>
                            <Button
                                size="sm"
                                onClick={onSaveAllPlanning}
                                disabled={liveDraftResult.tasks.length === 0}
                                className="h-8 bg-[#EC1C21] hover:bg-[#EC1C21]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-tight ml-2 shadow-lg shadow-[#EC1C21]/20 transition-all hover:scale-[1.05] active:scale-95"
                            >
                                Aplicar
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center px-4 border-l border-border ml-2 gap-3 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleEvalList}
                            className={cn(
                                "h-8 font-black text-[10px] uppercase gap-2 px-4 transition-all rounded-xl shadow-sm border-border/60",
                                isEvalListOpen ? "bg-[#EC1C21] text-white border-[#EC1C21]" : "hover:bg-muted"
                            )}
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Por Evaluar</span>
                            {ordersPendingEvalCount > 0 && (
                                <span className={cn(
                                    "text-white text-[9px] font-black rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 animate-in zoom-in duration-300",
                                    isEvalListOpen ? "bg-white text-[#EC1C21]" : "bg-[#EC1C21]"
                                )}>
                                    {ordersPendingEvalCount}
                                </span>
                            )}
                        </Button>

                        {activeStrategy === "NONE" && (changedTasksCount > 0 || draftTasksCount > 0) && (
                            <Button
                                size="sm"
                                onClick={onSaveAllPlanning}
                                className="h-8 bg-black hover:bg-black/90 text-white rounded-xl text-[10px] font-black uppercase tracking-tight shadow-lg shadow-black/10"
                            >
                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                Guardar
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
