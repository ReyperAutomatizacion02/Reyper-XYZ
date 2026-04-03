"use client";

import React from "react";
import { AlertTriangle, Info, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractDriveFileId } from "@/lib/drive-utils";
import { EvaluationStep } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";
import { EvaluationFiltersState } from "./hooks/use-evaluation-filters";
import { useEvaluationForm } from "./hooks/use-evaluation-form";
import { DrawingViewerContent } from "@/components/sales/drawing-viewer";
import { AnimatePresence, motion } from "framer-motion";
import { useSidebar } from "@/components/sidebar-context";
import { EvaluationFilterPanel } from "./evaluation/EvaluationFilterPanel";
import { EvaluationOrderList } from "./evaluation/EvaluationOrderList";
import { EvaluationFormHeader } from "./evaluation/EvaluationFormHeader";
import { EvaluationStepRow } from "./evaluation/EvaluationStepRow";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isFullscreen: boolean;
    filters: EvaluationFiltersState;
    onClearEvaluation: (orderId: string) => void;
    selectedOrder: Order | null;
    onSelectOrder: (order: Order | null) => void;
    machines: { name: string }[];
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    onEvalSuccess: (orderId: string, steps: EvaluationStep[]) => void;
}

export function EvaluationSidebar({
    isOpen,
    onClose,
    isFullscreen,
    filters,
    onClearEvaluation,
    selectedOrder,
    onSelectOrder,
    machines,
    treatments,
    onEvalSuccess,
}: EvaluationSidebarProps) {
    const { isCollapsed } = useSidebar();

    const form = useEvaluationForm({
        selectedOrder,
        onSelectOrder,
        treatments,
        ordersPendingEvaluation: filters.ordersPendingEvaluation,
        onEvalSuccess,
    });

    const {
        steps,
        isSaving,
        confirmModal,
        setConfirmModal,
        showDrawing,
        setShowDrawing,
        selectedEvalIndex,
        toggleStepType,
        updateMachineStep,
        handleTreatmentSelect,
        updateTreatmentDays,
        removeStep,
        handleSave,
        handlePrev,
        handleNext,
        handleBack,
    } = form;

    const {
        evalSearchQuery,
        setEvalSearchQuery,
        showEvaluated,
        setShowEvaluated,
        ordersPendingEvaluation,
        pinnedOrderIds,
        togglePin,
    } = filters;

    const hasDrawing = !!selectedOrder?.drawing_url;
    const drawingUrl = selectedOrder?.drawing_url ?? null;

    if (!isOpen) return null;

    return (
        <>
            {/* Side Drawing Panel */}
            <AnimatePresence>
                {selectedOrder && showDrawing && drawingUrl && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={cn(
                            "fixed bottom-0 right-[450px] z-[999] border-r border-border bg-slate-100/90 backdrop-blur-sm",
                            isFullscreen ? "top-0" : "top-[64px]",
                            isCollapsed ? "left-[80px]" : "left-[288px]",
                            "max-lg:left-0"
                        )}
                    >
                        <DrawingViewerContent
                            url={drawingUrl}
                            title={selectedOrder.part_code}
                            onClose={() => setShowDrawing(false)}
                            isInline
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Sidebar */}
            <div
                className={cn(
                    "fixed bottom-0 right-0 z-[1000] flex w-[450px] flex-col border-l border-border bg-background/95 shadow-2xl backdrop-blur-md",
                    isFullscreen ? "top-0" : "top-[64px]"
                )}
            >
                <AnimatePresence mode="wait">
                    {!selectedOrder ? (
                        /* ── LIST VIEW ── */
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex h-full flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
                                <h3 className="flex items-center gap-2 text-sm font-bold">
                                    <AlertTriangle className="h-4 w-4 text-[#EC1C21]" />
                                    {showEvaluated ? "Piezas Evaluadas" : "Piezas por Evaluar"}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-8 w-8 rounded-full hover:bg-muted"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Tabs */}
                            <div className="px-3 pt-3">
                                <div className="flex rounded-lg border border-border/50 bg-muted/50 p-1">
                                    <button
                                        onClick={() => setShowEvaluated(false)}
                                        className={`flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase transition-all ${
                                            !showEvaluated
                                                ? "bg-background text-primary shadow-sm ring-1 ring-border"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Por Evaluar
                                    </button>
                                    <button
                                        onClick={() => setShowEvaluated(true)}
                                        className={`flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase transition-all ${
                                            showEvaluated
                                                ? "bg-background text-primary shadow-sm ring-1 ring-border"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Evaluadas
                                    </button>
                                </div>
                            </div>

                            {/* Search & Filters */}
                            <div className="space-y-3 border-b border-border bg-muted/5 p-4">
                                <div className="flex items-center gap-2">
                                    <div className="group relative flex-1">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            value={evalSearchQuery}
                                            onChange={(e) => setEvalSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <EvaluationFilterPanel
                                        filters={filters}
                                        ordersPendingEvaluation={ordersPendingEvaluation}
                                    />
                                </div>
                            </div>

                            {/* Order List */}
                            <div className="flex-1 space-y-2 overflow-y-auto p-2">
                                <EvaluationOrderList
                                    orders={ordersPendingEvaluation}
                                    pinnedOrderIds={pinnedOrderIds}
                                    showEvaluated={showEvaluated}
                                    onSelectOrder={onSelectOrder}
                                    onTogglePin={togglePin}
                                    onClearEvaluation={onClearEvaluation}
                                />
                            </div>
                        </motion.div>
                    ) : (
                        /* ── FORM VIEW ── */
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex h-full flex-col"
                        >
                            <EvaluationFormHeader
                                selectedOrder={selectedOrder}
                                hasDrawing={hasDrawing}
                                showDrawing={showDrawing}
                                onToggleDrawing={() => setShowDrawing((v) => !v)}
                                selectedEvalIndex={selectedEvalIndex}
                                totalOrders={filters.ordersPendingEvaluation.length}
                                onPrev={handlePrev}
                                onNext={handleNext}
                                onBack={handleBack}
                                onClose={onClose}
                            />

                            {/* Form Body */}
                            <div className="flex-1 space-y-4 overflow-y-auto p-5">
                                <div className="space-y-1">
                                    <h2 className="text-sm font-bold">Evaluar Pieza</h2>
                                    <p className="text-[11px] text-muted-foreground">
                                        Asignación de máquinas y tiempos estimados
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                        Pasos de Proceso
                                    </Label>
                                    <div className="space-y-3">
                                        {steps.map((step, index) => (
                                            <EvaluationStepRow
                                                key={index}
                                                step={step}
                                                index={index}
                                                machines={machines}
                                                treatments={treatments}
                                                onToggleType={toggleStepType}
                                                onUpdateMachine={updateMachineStep}
                                                onTreatmentSelect={handleTreatmentSelect}
                                                onUpdateDays={updateTreatmentDays}
                                                onRemove={removeStep}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Form Footer */}
                            <div className="shrink-0 space-y-2 border-t border-border p-4">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-11 w-full bg-[#EC1C21] font-black text-white shadow-lg shadow-red-500/20 hover:bg-[#EC1C21]/90"
                                >
                                    {isSaving ? "GUARDANDO..." : "GUARDAR EVALUACIÓN"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={isSaving}
                                    className="h-9 w-full text-xs font-bold"
                                >
                                    VOLVER A LA LISTA
                                </Button>
                            </div>

                            {/* Confirm overlay */}
                            {confirmModal && (
                                <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200 animate-in fade-in">
                                    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-border bg-background p-6 text-center shadow-2xl">
                                        <div
                                            className={`flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm ${
                                                confirmModal.type === "warning"
                                                    ? "border-red-500/20 bg-red-500/10"
                                                    : "border-primary/20 bg-primary/10"
                                            }`}
                                        >
                                            {confirmModal.type === "warning" ? (
                                                <AlertTriangle className="h-8 w-8 text-red-500" />
                                            ) : (
                                                <Info className="h-8 w-8 text-primary" />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-base font-black uppercase tracking-tight">
                                                {confirmModal.title}
                                            </h3>
                                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                                                {confirmModal.message}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex w-full flex-col gap-2">
                                            <Button
                                                onClick={confirmModal.onConfirm}
                                                className={`h-10 w-full text-xs font-black ${
                                                    confirmModal.type === "warning"
                                                        ? "bg-red-600 hover:bg-red-700"
                                                        : "bg-primary hover:bg-primary/90"
                                                }`}
                                            >
                                                {confirmModal.type === "warning" ? "ENTENDIDO" : "CONTINUAR"}
                                            </Button>
                                            {confirmModal.type === "info" && (
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setConfirmModal(null)}
                                                    className="h-10 w-full text-xs font-bold"
                                                >
                                                    CANCELAR
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
