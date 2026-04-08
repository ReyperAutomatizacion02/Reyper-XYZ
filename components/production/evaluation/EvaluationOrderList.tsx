"use client";

import React, { useState } from "react";
import { ChevronDown, ClipboardList, FlaskConical, Pin, PinOff, Trash2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EvaluationStep, isTreatmentStep, MachineStep, OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";
import { AnimatePresence, motion } from "framer-motion";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationOrderListProps {
    orders: Order[];
    pinnedOrderIds: Set<string>;
    showEvaluated: boolean;
    onSelectOrder: (order: Order) => void;
    onTogglePin: (orderId: string) => void;
    onClearEvaluation: (orderId: string) => void;
}

function fmtH(hours: number): string {
    if (hours <= 0) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function StepBreakdown({ step, quantity }: { step: EvaluationStep; quantity: number }) {
    if (isTreatmentStep(step)) {
        return (
            <div className="flex items-center justify-between rounded-md bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5">
                    <FlaskConical className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        {step.treatment || "Tratamiento"}
                    </span>
                </div>
                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">{step.days}d</span>
            </div>
        );
    }

    const ms = step as MachineStep;
    const isNewFormat = ms.machining_time !== undefined;
    const qty = Math.max(1, quantity);
    const isMulti = qty > 1;

    return (
        <div className="space-y-1 rounded-md border border-border/40 bg-muted/20 px-2.5 py-2">
            {/* Step header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Wrench className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase text-foreground/80">{ms.machine}</span>
                </div>
                <span className="text-[10px] font-black text-foreground">{fmtH(ms.hours)}</span>
            </div>

            {/* Breakdown rows — only for new format */}
            {isNewFormat && (
                <div className="space-y-0.5 border-t border-border/30 pt-1.5">
                    <BreakdownRow color="sky" label="Set Up Inicial" value={fmtH(ms.setup_time ?? 0)} sub="× 1" />
                    {isMulti && (
                        <BreakdownRow
                            color="violet"
                            label="Set Up / cambio"
                            value={fmtH((ms.piece_change_time ?? 0) * (qty - 1))}
                            sub={`× ${qty - 1}`}
                        />
                    )}
                    <BreakdownRow
                        color="emerald"
                        label="Maquinado"
                        value={fmtH((ms.machining_time ?? 0) * qty)}
                        sub={`× ${qty}`}
                    />
                </div>
            )}
        </div>
    );
}

function BreakdownRow({
    color,
    label,
    value,
    sub,
}: {
    color: "sky" | "violet" | "emerald";
    label: string;
    value: string;
    sub: string;
}) {
    const cls = {
        sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
        violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
        emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    }[color];

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
                <span className={`rounded px-1 py-0.5 text-[8px] font-black uppercase ${cls}`}>{label}</span>
                <span className="text-[8px] text-muted-foreground/60">{sub}</span>
            </div>
            <span className="text-[10px] font-bold tabular-nums text-foreground/70">{value}</span>
        </div>
    );
}

export function EvaluationOrderList({
    orders,
    pinnedOrderIds,
    showEvaluated,
    onSelectOrder,
    onTogglePin,
    onClearEvaluation,
}: EvaluationOrderListProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    if (orders.length === 0) {
        return (
            <div className="mx-2 mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/5 p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border/40 bg-background shadow-sm">
                    <ClipboardList className="h-8 w-8 text-muted-foreground opacity-40" />
                </div>
                <h4 className="text-sm font-bold text-foreground">¡Todo al día!</h4>
                <p className="mt-1 max-w-[180px] text-[11px] text-muted-foreground">
                    {showEvaluated
                        ? "No se han encontrado piezas evaluadas con los filtros actuales."
                        : "No hay piezas pendientes de evaluación por ahora."}
                </p>
            </div>
        );
    }

    return (
        <>
            {orders.map((order) => {
                const deliveryDate = (order as OrderWithRelations).projects?.delivery_date;
                const companyName = (order as OrderWithRelations).projects?.company;
                const isPinned = pinnedOrderIds.has(order.id);
                const isExpanded = expandedIds.has(order.id);

                const evaluation = (order.evaluation as EvaluationStep[] | null) ?? [];
                const completeSteps = evaluation.filter((s) =>
                    isTreatmentStep(s) ? !!s.treatment_id && s.days > 0 : !!s.machine && s.hours > 0
                );
                const hasBreakdown = showEvaluated && completeSteps.length > 0;
                const quantity = Math.max(1, order.quantity ?? 1);

                return (
                    <div
                        key={order.id}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-md",
                            isPinned ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10" : "border-border"
                        )}
                    >
                        {isPinned && <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />}

                        <div className="p-3">
                            <div className="mb-2 flex items-start justify-between">
                                <div className="flex-1 cursor-pointer pl-1" onClick={() => onSelectOrder(order)}>
                                    <div className="mb-0.5 flex items-center gap-1.5">
                                        {isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                                        <div className="text-xs font-black uppercase tracking-tight text-primary">
                                            {order.part_code}
                                        </div>
                                    </div>
                                    <div className="line-clamp-2 pr-6 text-[11px] font-bold leading-tight text-foreground">
                                        {order.part_name}
                                    </div>
                                </div>

                                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                                    {deliveryDate && (
                                        <div className="whitespace-nowrap rounded border border-border/50 bg-muted/50 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                                            {format(new Date(deliveryDate), "dd MMM", { locale: es })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border/50 pt-2">
                                <div className="max-w-[150px] truncate text-[10px] font-medium text-muted-foreground">
                                    {companyName || "Sin Empresa"}
                                </div>
                                <div className="flex gap-1.5">
                                    {hasBreakdown && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-6 w-6 rounded-md transition-colors",
                                                isExpanded
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                            title={isExpanded ? "Ocultar desglose" : "Ver desglose de tiempos"}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpand(order.id);
                                            }}
                                        >
                                            <ChevronDown
                                                className={cn(
                                                    "h-3.5 w-3.5 transition-transform duration-200",
                                                    isExpanded && "rotate-180"
                                                )}
                                            />
                                        </Button>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-6 w-6 rounded-md transition-colors",
                                            isPinned
                                                ? "text-amber-500 hover:bg-amber-100 hover:text-amber-700"
                                                : "text-muted-foreground hover:bg-amber-50 hover:text-amber-500"
                                        )}
                                        title={isPinned ? "Desfijar" : "Fijar al tope"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTogglePin(order.id);
                                        }}
                                    >
                                        {isPinned ? (
                                            <PinOff className="h-3.5 w-3.5" />
                                        ) : (
                                            <Pin className="h-3.5 w-3.5" />
                                        )}
                                    </Button>

                                    {showEvaluated && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                            title="Limpiar Evaluación"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClearEvaluation(order.id);
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 rounded-md px-2 text-[9px] font-black uppercase text-primary/70 hover:bg-primary/5 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectOrder(order);
                                        }}
                                    >
                                        {showEvaluated ? "Ver/Editar" : "Evaluar"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Collapsible breakdown */}
                        <AnimatePresence initial={false}>
                            {isExpanded && hasBreakdown && (
                                <motion.div
                                    key="breakdown"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-1.5 border-t border-border/50 bg-muted/20 px-3 py-2.5">
                                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                                            Desglose de tiempos · {quantity} pieza{quantity !== 1 ? "s" : ""}
                                        </p>
                                        {completeSteps.map((step, i) => (
                                            <StepBreakdown key={i} step={step} quantity={quantity} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </>
    );
}
