"use client";

import React from "react";
import { ListChecks } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type OrderWithRelations } from "@/lib/scheduling-utils";

interface OrderSelectionPopoverProps {
    eligibleOrders: OrderWithRelations[];
    excludedOrderIds: Set<string>;
    onToggleOrderExclusion: (id: string) => void;
    onSelectAllOrders: () => void;
    onDeselectAllOrders: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function OrderSelectionPopover({
    eligibleOrders,
    excludedOrderIds,
    onToggleOrderExclusion,
    onSelectAllOrders,
    onDeselectAllOrders,
    containerRef,
}: OrderSelectionPopoverProps) {
    if (eligibleOrders.length === 0) return null;

    return (
        <>
            <div className="mx-1 h-10 border-l border-border/50" />
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 px-1">
                    <ListChecks className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                        Partidas
                    </span>
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            className={cn(
                                "flex h-8 items-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase tracking-tight transition-all",
                                excludedOrderIds.size > 0
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                            )}
                        >
                            {excludedOrderIds.size > 0 ? (
                                <>
                                    {eligibleOrders.length - excludedOrderIds.size}/{eligibleOrders.length}
                                </>
                            ) : (
                                <>Todas ({eligibleOrders.length})</>
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        container={containerRef.current}
                        className="z-[10001] w-72 overflow-hidden p-0"
                        align="start"
                    >
                        <div className="border-b border-border bg-muted/30 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Selección de Partidas
                            </p>
                            <p className="mt-0.5 text-[9px] text-muted-foreground">
                                Elige qué partidas incluir en la estrategia
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-b border-border/50 px-4 py-2">
                            <button
                                onClick={onSelectAllOrders}
                                className="text-[9px] font-bold text-primary hover:underline"
                            >
                                Todas
                            </button>
                            <button
                                onClick={onDeselectAllOrders}
                                className="text-[9px] font-bold text-muted-foreground hover:underline"
                            >
                                Ninguna
                            </button>
                        </div>
                        <div className="custom-scrollbar max-h-72 overflow-y-auto py-2">
                            {eligibleOrders.map((order) => {
                                const isIncluded = !excludedOrderIds.has(order.id);
                                return (
                                    <label
                                        key={order.id}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors",
                                            isIncluded ? "bg-primary/5" : "hover:bg-muted/40"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-all",
                                                isIncluded ? "border-primary bg-primary" : "border-border bg-background"
                                            )}
                                        >
                                            {isIncluded && (
                                                <svg
                                                    viewBox="0 0 10 7"
                                                    className="h-2.5 w-2.5"
                                                    fill="none"
                                                    stroke="white"
                                                    strokeWidth="1.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M1 3.5L3.5 6L9 1" />
                                                </svg>
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={isIncluded}
                                            onChange={() => onToggleOrderExclusion(order.id)}
                                        />
                                        <div className="min-w-0">
                                            <p
                                                className={cn(
                                                    "truncate text-[11px] font-bold leading-none",
                                                    isIncluded
                                                        ? "text-foreground"
                                                        : "text-muted-foreground line-through"
                                                )}
                                            >
                                                {order.part_code}
                                            </p>
                                            {order.part_name && (
                                                <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                                                    {order.part_name}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </>
    );
}
