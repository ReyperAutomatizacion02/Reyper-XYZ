"use client";

import React from "react";
import { ChevronLeft, ChevronRight, FileText, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationFormHeaderProps {
    selectedOrder: Order;
    hasDrawing: boolean;
    showDrawing: boolean;
    onToggleDrawing: () => void;
    selectedEvalIndex: number;
    totalOrders: number;
    onPrev: () => void;
    onNext: () => void;
    onBack: () => void;
    onClose: () => void;
}

export function EvaluationFormHeader({
    selectedOrder,
    hasDrawing,
    showDrawing,
    onToggleDrawing,
    selectedEvalIndex,
    totalOrders,
    onPrev,
    onNext,
    onBack,
    onClose,
}: EvaluationFormHeaderProps) {
    return (
        <div className="shrink-0 bg-gradient-to-br from-red-600 to-red-700 p-4 text-white">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="h-8 w-8 text-white hover:bg-white/20"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl border border-white/30 bg-white/20 p-2.5">
                        <Wrench className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <div className="text-lg font-black leading-none tracking-tight">{selectedOrder.part_code}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs font-medium text-red-100 opacity-90">
                            {selectedOrder.part_name}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {hasDrawing && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleDrawing}
                            className={cn(
                                "h-7 w-7 text-white transition-colors",
                                showDrawing ? "bg-white/30 hover:bg-white/40" : "hover:bg-white/20"
                            )}
                            title={showDrawing ? "Ocultar plano" : "Ver plano"}
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                    )}
                    {selectedEvalIndex > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrev}
                            className="h-7 w-7 text-white hover:bg-white/20"
                            title="Anterior"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {selectedEvalIndex < totalOrders - 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            className="h-7 w-7 text-white hover:bg-white/20"
                            title="Siguiente"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="ml-1 h-7 w-7 text-white hover:bg-white/20"
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {selectedEvalIndex >= 0 && totalOrders > 1 && (
                <div className="ml-[88px] mt-2">
                    <span className="text-[10px] font-medium text-red-200">
                        {selectedEvalIndex + 1} / {totalOrders}
                    </span>
                </div>
            )}
        </div>
    );
}
