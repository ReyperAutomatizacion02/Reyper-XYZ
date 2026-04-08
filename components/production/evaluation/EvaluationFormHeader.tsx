"use client";

import React from "react";
import { ChevronLeft, ChevronRight, FileText, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Database } from "@/utils/supabase/types";
import { EvaluationStep, isTreatmentStep } from "@/lib/scheduling-utils";

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
    steps: EvaluationStep[];
}

const isStepComplete = (s: EvaluationStep) =>
    isTreatmentStep(s) ? !!s.treatment_id && s.days > 0 : !!s.machine && s.hours > 0;

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
    steps,
}: EvaluationFormHeaderProps) {
    const completedSteps = steps.filter(isStepComplete);
    const totalDefinedSteps = steps.filter((s) => !isStepComplete(s) || true).length - 1; // exclude trailing empty
    const completedCount = completedSteps.length;

    // Build a short summary label: "CNC-01, Tratamiento, CNC-02"
    const stepSummary = completedSteps
        .map((s) => (isTreatmentStep(s) ? s.treatment || "Tratamiento" : s.machine))
        .filter(Boolean)
        .join(" → ");

    const orderProgress = totalOrders > 0 ? ((selectedEvalIndex + 1) / totalOrders) * 100 : 0;

    return (
        <div className="shrink-0 bg-gradient-to-br from-red-600 to-red-700 text-white">
            <div className="flex items-center justify-between p-4 pb-3">
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

            {/* Progress section */}
            <div className="space-y-2 px-4 pb-3">
                {/* Order counter + step summary */}
                <div className="flex items-center justify-between">
                    {totalOrders > 1 ? (
                        <span
                            className="text-[11px] font-semibold text-red-100"
                            aria-label={`Orden ${selectedEvalIndex + 1} de ${totalOrders}`}
                        >
                            Orden {selectedEvalIndex + 1}{" "}
                            <span className="font-normal opacity-70">de {totalOrders}</span>
                        </span>
                    ) : (
                        <span className="text-[11px] text-red-200">1 orden</span>
                    )}
                    <span className="text-[11px] text-red-200" aria-live="polite">
                        {completedCount === 0
                            ? "Sin pasos definidos"
                            : `${completedCount} paso${completedCount !== 1 ? "s" : ""} definido${completedCount !== 1 ? "s" : ""}`}
                    </span>
                </div>

                {/* Order-level progress bar */}
                {totalOrders > 1 && (
                    <div
                        className="h-1 w-full overflow-hidden rounded-full bg-white/20"
                        role="progressbar"
                        aria-valuenow={selectedEvalIndex + 1}
                        aria-valuemin={1}
                        aria-valuemax={totalOrders}
                        aria-label={`Progreso: orden ${selectedEvalIndex + 1} de ${totalOrders}`}
                    >
                        <div
                            className="h-full rounded-full bg-white/80 transition-all duration-300"
                            style={{ width: `${orderProgress}%` }}
                        />
                    </div>
                )}

                {/* Step summary chips */}
                {stepSummary && (
                    <p className="truncate text-[10px] font-medium text-red-200" title={stepSummary}>
                        {stepSummary}
                    </p>
                )}
            </div>
        </div>
    );
}
