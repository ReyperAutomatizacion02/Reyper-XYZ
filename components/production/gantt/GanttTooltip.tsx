"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

const DAY_SHORT: Record<string, string> = {
    lunes: "LUN",
    martes: "MAR",
    miércoles: "MIÉ",
    jueves: "JUE",
    viernes: "VIE",
    sábado: "SÁB",
    domingo: "DOM",
};

function formatDateTime(date: Date): string {
    const dayName = format(date, "EEEE", { locale: es }).toLowerCase();
    const short = DAY_SHORT[dayName] ?? dayName.slice(0, 3).toUpperCase();
    return `${short} ${format(date, "dd/MM HH:mm")}`;
}

function formatDuration(start: Date, end: Date): string {
    const totalMinutes = differenceInMinutes(end, start);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

interface GanttTooltipProps {
    hoveredTask: PlanningTask | null;
    tooltipPos: { x: number; y: number; mode: "above" | "below" };
    getColor: (task: PlanningTask) => string;
}

export function GanttTooltip({ hoveredTask, tooltipPos, getColor }: GanttTooltipProps) {
    return (
        <AnimatePresence>
            {hoveredTask && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pointer-events-none fixed z-[100]"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.mode === "below" ? tooltipPos.y : undefined,
                        bottom: tooltipPos.mode === "above" ? tooltipPos.y : undefined,
                    }}
                >
                    <div className="min-w-[240px] max-w-[320px] rounded-lg border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-md">
                        {hoveredTask.production_orders?.image && (
                            <div className="relative mb-3 h-40 w-full overflow-hidden rounded-md bg-muted">
                                <Image
                                    src={hoveredTask.production_orders.image}
                                    alt={hoveredTask.production_orders?.part_name || "Pieza"}
                                    fill
                                    sizes="320px"
                                    className="object-cover"
                                />
                            </div>
                        )}
                        <div className="mb-2 flex items-center gap-2">
                            <div
                                className="h-3 w-3 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: getColor(hoveredTask) }}
                            />
                            <div className="truncate text-xs font-black uppercase text-foreground">
                                {hoveredTask.production_orders?.part_code || "S/N"}
                            </div>
                        </div>
                        <div className="mb-3 line-clamp-2 text-[10px] text-foreground/70">
                            {hoveredTask.production_orders?.part_name || "Sin nombre"}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                            <div>
                                <div className="uppercase tracking-wider text-foreground/40">Máquina</div>
                                <div className="font-semibold text-foreground">
                                    {hoveredTask.machine || "Sin asignar"}
                                </div>
                            </div>
                            <div>
                                <div className="uppercase tracking-wider text-foreground/40">Operador</div>
                                <div className="font-semibold text-foreground">
                                    {hoveredTask.operator || "Sin asignar"}
                                </div>
                            </div>
                            <div>
                                <div className="uppercase tracking-wider text-foreground/40">Inicio</div>
                                <div className="font-semibold text-foreground">
                                    {formatDateTime(new Date(hoveredTask.planned_date!))}
                                </div>
                            </div>
                            <div>
                                <div className="uppercase tracking-wider text-foreground/40">Fin</div>
                                <div className="font-semibold text-foreground">
                                    {formatDateTime(new Date(hoveredTask.planned_end!))}
                                </div>
                            </div>
                            <div className="col-span-2 mt-0.5 flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
                                <div className="uppercase tracking-wider text-foreground/40">Duración</div>
                                <div className="font-black text-foreground">
                                    {formatDuration(
                                        new Date(hoveredTask.planned_date!),
                                        new Date(hoveredTask.planned_end!)
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
