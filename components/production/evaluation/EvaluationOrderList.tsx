"use client";

import React from "react";
import { ClipboardList, Pin, PinOff, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationOrderListProps {
    orders: Order[];
    pinnedOrderIds: Set<string>;
    showEvaluated: boolean;
    onSelectOrder: (order: Order) => void;
    onTogglePin: (orderId: string) => void;
    onClearEvaluation: (orderId: string) => void;
}

export function EvaluationOrderList({
    orders,
    pinnedOrderIds,
    showEvaluated,
    onSelectOrder,
    onTogglePin,
    onClearEvaluation,
}: EvaluationOrderListProps) {
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

                return (
                    <div
                        key={order.id}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md",
                            isPinned ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10" : "border-border"
                        )}
                    >
                        {isPinned && <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />}

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

                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                            <div className="max-w-[150px] truncate text-[10px] font-medium text-muted-foreground">
                                {companyName || "Sin Empresa"}
                            </div>
                            <div className="flex gap-1.5">
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
                                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
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
                );
            })}
        </>
    );
}
