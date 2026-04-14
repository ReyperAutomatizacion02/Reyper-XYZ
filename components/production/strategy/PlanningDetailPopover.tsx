"use client";

import React from "react";
import { Info, X } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type SchedulingResult } from "@/lib/scheduling-utils";
import { type OrderStatus } from "./types";

interface PlanningDetailPopoverProps {
    liveDraftResult: SchedulingResult;
    orderStatuses: OrderStatus[];
    machineLoad: [string, number][];
    maxMachineHours: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PlanningDetailPopover({
    liveDraftResult,
    orderStatuses,
    machineLoad,
    maxMachineHours,
    containerRef,
}: PlanningDetailPopoverProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    title="Ver desglose de planeación"
                >
                    <Info className="h-3.5 w-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent container={containerRef.current} className="z-[10001] w-96 overflow-hidden p-0" align="end">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Desglose de Planeación
                    </p>
                </div>
                <div className="custom-scrollbar max-h-[400px] overflow-y-auto">
                    {/* Orders section */}
                    <div className="px-4 py-3">
                        <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            Órdenes ({orderStatuses.length})
                        </p>
                        <div className="space-y-1.5">
                            {orderStatuses.map(({ order, isLate, lastEnd, deliveryDate, diffDays }) => (
                                <div
                                    key={order.id}
                                    className={cn(
                                        "rounded-lg border px-3 py-2 transition-colors",
                                        isLate ? "border-red-500/20 bg-red-500/5" : "border-green-500/20 bg-green-500/5"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-[11px] font-bold leading-none">
                                            {order.part_code}
                                            {order.part_name && (
                                                <span className="ml-1 font-normal text-muted-foreground">
                                                    · {order.part_name}
                                                </span>
                                            )}
                                        </p>
                                        <span
                                            className={cn(
                                                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black leading-none",
                                                isLate ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-600"
                                            )}
                                        >
                                            {isLate ? "Con retraso" : "A tiempo"}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-3 text-[9px]">
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase leading-none text-muted-foreground">
                                                Entrega
                                            </span>
                                            <span className="mt-0.5 font-bold text-foreground">
                                                {deliveryDate ? format(deliveryDate, "dd/MM/yyyy") : "—"}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground">→</span>
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase leading-none text-muted-foreground">
                                                Previsto
                                            </span>
                                            <span
                                                className={cn(
                                                    "mt-0.5 font-bold",
                                                    isLate ? "text-red-500" : "text-green-600"
                                                )}
                                            >
                                                {format(lastEnd, "dd/MM/yyyy")}
                                            </span>
                                        </div>
                                        {diffDays !== null && (
                                            <span
                                                className={cn(
                                                    "ml-auto shrink-0 font-black",
                                                    isLate ? "text-red-500" : "text-green-600"
                                                )}
                                            >
                                                {isLate
                                                    ? `${Math.abs(diffDays)}d tarde`
                                                    : diffDays === 0
                                                      ? "justo"
                                                      : `${diffDays}d margen`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {orderStatuses.length === 0 && (
                                <p className="text-[10px] text-muted-foreground">Sin órdenes planificadas</p>
                            )}
                        </div>
                    </div>

                    {/* Machine load section */}
                    {machineLoad.length > 0 && (
                        <>
                            <div className="mx-4 border-t border-border/50" />
                            <div className="px-4 py-3">
                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    Carga por Máquina
                                </p>
                                <div className="space-y-2">
                                    {machineLoad.map(([machine, hours]) => (
                                        <div key={machine} className="space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold">{machine}</span>
                                                <span className="text-[10px] font-black text-primary">
                                                    {hours.toFixed(1)}h
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary/60 transition-all"
                                                    style={{
                                                        width: `${Math.min(100, (hours / maxMachineHours) * 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Skipped orders section */}
                    {liveDraftResult.skipped.length > 0 && (
                        <>
                            <div className="mx-4 border-t border-border/50" />
                            <div className="px-4 py-3">
                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    Omitidas ({liveDraftResult.skipped.length})
                                </p>
                                <div className="space-y-1">
                                    {liveDraftResult.skipped.map(({ order, reason }, i) => (
                                        <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
                                            <X className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="truncate text-[10px] font-bold">{order.part_code}</p>
                                                <p className="text-[9px] text-muted-foreground">{reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
