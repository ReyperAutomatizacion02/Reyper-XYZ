"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getProductionTaskColor } from "@/utils/production-colors";
import { type PlanningAlert } from "./types";

interface PlanningAlertsPopoverProps {
    planningAlerts: PlanningAlert[];
    onLocateTask: (taskId: string) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PlanningAlertsPopover({ planningAlerts, onLocateTask, containerRef }: PlanningAlertsPopoverProps) {
    return (
        <>
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
                        <AlertTriangle className={cn("h-5 w-5", planningAlerts.length > 0 && "animate-pulse")} />
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
                            <h4 className="text-xs font-bold uppercase tracking-wider">Alertas de Planeación</h4>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                            Se detectaron {planningAlerts.length} posibles inconvenientes en el cronograma actual.
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
                                            {alert.task.production_orders?.part_code} –{" "}
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
        </>
    );
}
