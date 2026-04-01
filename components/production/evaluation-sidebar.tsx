"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import {
    AlertTriangle,
    ArrowDownZA,
    ArrowUpAZ,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    Filter,
    FlaskConical,
    Info,
    ListFilter,
    Pin,
    PinOff,
    Search,
    Trash2,
    Wrench,
    X,
    XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DateSelector } from "@/components/ui/date-selector";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { extractDriveFileId } from "@/lib/drive-utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { OrderWithRelations, EvaluationStep, isTreatmentStep } from "@/lib/scheduling-utils";
import { Database, type Json } from "@/utils/supabase/types";
import { EvaluationFiltersState } from "./hooks/use-evaluation-filters";
import { DrawingViewerContent } from "@/components/sales/drawing-viewer";
import { AnimatePresence, motion } from "framer-motion";
import { useSidebar } from "@/components/sidebar-context";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface ConfirmModalState {
    title: string;
    message: string;
    type: "warning" | "info";
    onConfirm: () => void;
}

interface EvaluationSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isFullscreen: boolean;
    filters: EvaluationFiltersState;
    onClearEvaluation: (orderId: string) => void;
    // Replaces EvaluationModal:
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
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isPinSectionExpanded, setIsPinSectionExpanded] = useState(false);
    const [pinSearch, setPinSearch] = useState("");
    const filterPanelRef = useRef<HTMLDivElement>(null);
    const { isCollapsed } = useSidebar();

    // Form state
    const [steps, setSteps] = useState<EvaluationStep[]>([{ type: "machine", machine: "", hours: 0 }]);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
    const [showDrawing, setShowDrawing] = useState(false);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState(-1);

    const supabase = createClient();
    const router = useRouter();

    // Sync form state when selected order changes
    useEffect(() => {
        if (selectedOrder) {
            const initialSteps = [...((selectedOrder.evaluation as EvaluationStep[] | null) || [])];

            const isComplete = (s: EvaluationStep) =>
                isTreatmentStep(s) ? !!s.treatment_id && s.days > 0 : !!s.machine && s.hours > 0;

            if (initialSteps.length === 0) {
                initialSteps.push({ type: "machine", machine: "", hours: 0 });
            } else {
                const last = initialSteps[initialSteps.length - 1];
                if (isComplete(last)) {
                    initialSteps.push({ type: "machine", machine: "", hours: 0 });
                }
            }
            setSteps(initialSteps);

            const idx = filters.ordersPendingEvaluation.findIndex((o) => o.id === selectedOrder.id);
            setSelectedEvalIndex(idx >= 0 ? idx : 0);

            // Auto-open drawing if available
            setShowDrawing(!!selectedOrder.drawing_url);
        } else {
            setShowDrawing(false);
        }
    }, [selectedOrder?.id]);

    // Close filter panel on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (isFilterPanelOpen && filterPanelRef.current && !filterPanelRef.current.contains(target)) {
                const isInsidePortal =
                    target.closest("[data-radix-popper-content-wrapper]") ||
                    target.closest('[role="dialog"]') ||
                    target.closest(".p-DayPicker");
                if (!isInsidePortal) setIsFilterPanelOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFilterPanelOpen]);

    // Must be before early return to satisfy Rules of Hooks
    const projectsForPin = useMemo(() => {
        const map = new Map<string, { code: string; company: string | null; orderIds: string[] }>();
        filters.ordersPendingEvaluation.forEach((o) => {
            const rel = (o as OrderWithRelations).projects;
            const code = rel?.code;
            if (!code) return;
            if (!map.has(code)) map.set(code, { code, company: rel?.company ?? null, orderIds: [] });
            map.get(code)!.orderIds.push(o.id);
        });
        return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [filters.ordersPendingEvaluation]);

    if (!isOpen) return null;

    // ---- Form helpers ----

    const isStepComplete = (s: EvaluationStep) =>
        isTreatmentStep(s) ? !!s.treatment_id && s.days > 0 : !!s.machine && s.hours > 0;

    const isStepIncomplete = (s: EvaluationStep) =>
        isTreatmentStep(s) ? !!s.treatment_id && !(s.days > 0) : !!s.machine && !(s.hours > 0);

    const toggleStepType = (index: number) => {
        const newSteps = [...steps];
        newSteps[index] = isTreatmentStep(newSteps[index])
            ? { type: "machine", machine: "", hours: 0 }
            : { type: "treatment", treatment_id: "", treatment: "", days: 0 };
        setSteps(newSteps);
    };

    const updateMachineStep = (index: number, field: "machine" | "hours", value: string | number) => {
        const newSteps = [...steps];
        const step = newSteps[index];
        if (isTreatmentStep(step)) return;
        newSteps[index] = { ...step, [field]: value } as EvaluationStep;
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const handleTreatmentSelect = (index: number, treatmentId: string) => {
        const catalog = treatments.find((t) => t.id === treatmentId);
        const newSteps = [...steps];
        const prevStep = newSteps[index];
        const prevDays = isTreatmentStep(prevStep) && prevStep.days > 0 ? prevStep.days : (catalog?.avg_lead_days ?? 1);
        newSteps[index] = {
            type: "treatment",
            treatment_id: treatmentId,
            treatment: catalog?.name ?? "",
            days: prevDays,
        };
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const updateTreatmentDays = (index: number, days: number) => {
        const newSteps = [...steps];
        const step = newSteps[index];
        if (!isTreatmentStep(step)) return;
        newSteps[index] = { ...step, days };
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        if (newSteps.length === 0) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        } else {
            const last = newSteps[newSteps.length - 1];
            if (isStepComplete(last)) newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!selectedOrder) return;

        const validSteps = steps.filter(isStepComplete);
        const incompleteSteps = steps.filter(isStepIncomplete);

        if (validSteps.length === 0) {
            if (incompleteSteps.length > 0) {
                const s = incompleteSteps[0];
                const label = isTreatmentStep(s) ? `tratamiento "${s.treatment}"` : `máquina "${s.machine}"`;
                setConfirmModal({
                    title: "Información Incompleta",
                    message: `Has seleccionado ${label} pero no has asignado el tiempo.`,
                    type: "warning",
                    onConfirm: () => setConfirmModal(null),
                });
            } else {
                toast.error("Por favor completa al menos un paso válido");
            }
            return;
        }

        if (incompleteSteps.length > 0) {
            setConfirmModal({
                title: "¿Continuar con pasos incompletos?",
                message: `Hay ${incompleteSteps.length} paso(s) con selección pero sin tiempo. Se ignorarán.\n\n¿Continuar con ${validSteps.length} paso(s) válido(s)?`,
                type: "info",
                onConfirm: () => {
                    setConfirmModal(null);
                    saveToSupabase(validSteps);
                },
            });
            return;
        }

        saveToSupabase(validSteps);
    };

    const saveToSupabase = async (validSteps: EvaluationStep[]) => {
        if (!selectedOrder) return;
        setIsSaving(true);
        try {
            // Sync treatment_id / treatment name from first treatment step (if any)
            const firstTreatment = validSteps.find(isTreatmentStep);
            const { error } = await supabase
                .from("production_orders")
                .update({
                    evaluation: validSteps as unknown as Json,
                    treatment_id: firstTreatment ? (firstTreatment as any).treatment_id || null : null,
                    treatment: firstTreatment ? (firstTreatment as any).treatment || null : null,
                })
                .eq("id", selectedOrder.id);

            if (error) throw error;

            toast.success("Evaluación guardada correctamente");
            onEvalSuccess(selectedOrder.id, validSteps);
            router.refresh();

            // Auto-advance to next
            if (selectedEvalIndex >= 0 && selectedEvalIndex < filters.ordersPendingEvaluation.length - 1) {
                const next = filters.ordersPendingEvaluation[selectedEvalIndex + 1];
                setSelectedEvalIndex(selectedEvalIndex + 1);
                onSelectOrder(next);
            } else {
                onSelectOrder(null);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Error desconocido";
            toast.error("Error al guardar: " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrev = () => {
        if (selectedEvalIndex <= 0) return;
        const idx = selectedEvalIndex - 1;
        setSelectedEvalIndex(idx);
        onSelectOrder(filters.ordersPendingEvaluation[idx]);
    };

    const handleNext = () => {
        if (selectedEvalIndex >= filters.ordersPendingEvaluation.length - 1) return;
        const idx = selectedEvalIndex + 1;
        setSelectedEvalIndex(idx);
        onSelectOrder(filters.ordersPendingEvaluation[idx]);
    };

    const handleBack = () => {
        onSelectOrder(null);
        setShowDrawing(false);
    };

    const {
        evalSearchQuery,
        setEvalSearchQuery,
        evalFilterType,
        setEvalFilterType,
        evalDateValue,
        setEvalDateValue,
        evalDateOperator,
        setEvalDateOperator,
        clientFilter,
        setClientFilter,
        treatmentFilter,
        setTreatmentFilter,
        evalSortDirection,
        setEvalSortDirection,
        evalSortBy,
        setEvalSortBy,
        showEvaluated,
        setShowEvaluated,
        clearAllFilters,
        activeFiltersCount,
        ordersPendingEvaluation,
        uniqueClients,
        pinnedOrderIds,
        togglePin,
        searchSuggestions,
    } = filters;

    const toggleProjectPin = (orderIds: string[], allPinned: boolean) => {
        orderIds.forEach((id) => {
            const isPinned = pinnedOrderIds.has(id);
            if (allPinned && isPinned) togglePin(id);
            else if (!allPinned && !isPinned) togglePin(id);
        });
    };

    const hasDrawing = !!selectedOrder?.drawing_url;
    const drawingFileId = hasDrawing ? extractDriveFileId(selectedOrder!.drawing_url!) : null;
    const drawingUrl = selectedOrder?.drawing_url ?? null;

    return (
        <>
            {/* Side Drawing Panel — appears to the left of the sidebar */}
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

                            {/* Search & Filter */}
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
                                    <div className="relative" ref={filterPanelRef}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "h-9 gap-2 px-3 text-[10px] font-bold uppercase shadow-sm transition-all",
                                                isFilterPanelOpen
                                                    ? "border-primary bg-primary text-white"
                                                    : "bg-background"
                                            )}
                                            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                                        >
                                            <ListFilter className="h-3.5 w-3.5" />
                                            <span>Opciones</span>
                                            {activeFiltersCount > 0 && (
                                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-primary shadow-sm">
                                                    {activeFiltersCount}
                                                </span>
                                            )}
                                        </Button>

                                        {isFilterPanelOpen && (
                                            <div className="absolute right-full top-0 z-[1500] mr-2 w-72 rounded-2xl border border-border bg-popover p-4 shadow-2xl duration-200 animate-in fade-in slide-in-from-right-4">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Filter className="h-3.5 w-3.5 text-primary" />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                                Filtros Avanzados
                                                            </span>
                                                        </div>
                                                        {activeFiltersCount > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                                                                onClick={clearAllFilters}
                                                            >
                                                                Limpiar
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {/* Fijados — collapsible */}
                                                    <div className="space-y-1.5 border-b border-border pb-3">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setIsPinSectionExpanded(!isPinSectionExpanded)
                                                            }
                                                            className="group flex w-full items-center justify-between"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                                                                    Fijados
                                                                </span>
                                                                {projectsForPin.filter((p) =>
                                                                    p.orderIds.every((id) => pinnedOrderIds.has(id))
                                                                ).length > 0 && (
                                                                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] leading-none text-white">
                                                                        {
                                                                            projectsForPin.filter((p) =>
                                                                                p.orderIds.every((id) =>
                                                                                    pinnedOrderIds.has(id)
                                                                                )
                                                                            ).length
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <ChevronDown
                                                                className={cn(
                                                                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                                                    isPinSectionExpanded && "rotate-180"
                                                                )}
                                                            />
                                                        </button>

                                                        {isPinSectionExpanded && (
                                                            <div className="space-y-1.5">
                                                                <div className="relative">
                                                                    <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                                                    <input
                                                                        type="text"
                                                                        value={pinSearch}
                                                                        onChange={(e) => setPinSearch(e.target.value)}
                                                                        placeholder="Buscar proyecto..."
                                                                        className="h-7 w-full rounded-lg border border-border/60 bg-background pl-7 pr-7 text-[10px] transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                                    />
                                                                    {pinSearch && (
                                                                        <button
                                                                            onClick={() => setPinSearch("")}
                                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto">
                                                                    {projectsForPin
                                                                        .filter((p) => {
                                                                            if (!pinSearch) return true;
                                                                            const q = pinSearch.toLowerCase();
                                                                            return (
                                                                                p.code.toLowerCase().includes(q) ||
                                                                                (p.company ?? "")
                                                                                    .toLowerCase()
                                                                                    .includes(q)
                                                                            );
                                                                        })
                                                                        .map((project) => {
                                                                            const allPinned = project.orderIds.every(
                                                                                (id) => pinnedOrderIds.has(id)
                                                                            );
                                                                            const somePinned =
                                                                                !allPinned &&
                                                                                project.orderIds.some((id) =>
                                                                                    pinnedOrderIds.has(id)
                                                                                );
                                                                            return (
                                                                                <label
                                                                                    key={project.code}
                                                                                    className={cn(
                                                                                        "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all",
                                                                                        allPinned
                                                                                            ? "bg-amber-50/60 dark:bg-amber-950/20"
                                                                                            : "hover:bg-muted/50"
                                                                                    )}
                                                                                >
                                                                                    <div
                                                                                        className={cn(
                                                                                            "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-all",
                                                                                            allPinned
                                                                                                ? "border-amber-500 bg-amber-500"
                                                                                                : somePinned
                                                                                                  ? "border-amber-400 bg-amber-100"
                                                                                                  : "border-border bg-background group-hover:border-amber-400/60"
                                                                                        )}
                                                                                    >
                                                                                        {allPinned && (
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
                                                                                        {somePinned && !allPinned && (
                                                                                            <div className="h-1.5 w-1.5 rounded-sm bg-amber-500" />
                                                                                        )}
                                                                                    </div>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={allPinned}
                                                                                        onChange={() =>
                                                                                            toggleProjectPin(
                                                                                                project.orderIds,
                                                                                                allPinned
                                                                                            )
                                                                                        }
                                                                                        className="sr-only"
                                                                                    />
                                                                                    <div className="min-w-0">
                                                                                        <div
                                                                                            className={cn(
                                                                                                "truncate text-[11px] leading-none transition-colors",
                                                                                                allPinned
                                                                                                    ? "font-semibold text-amber-700 dark:text-amber-400"
                                                                                                    : somePinned
                                                                                                      ? "font-medium text-amber-600/80"
                                                                                                      : "font-medium text-foreground/80 group-hover:text-foreground"
                                                                                            )}
                                                                                        >
                                                                                            {project.code}
                                                                                        </div>
                                                                                        {project.company && (
                                                                                            <div className="mt-0.5 truncate text-[9px] text-muted-foreground">
                                                                                                {project.company}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    {projectsForPin.filter((p) => {
                                                                        if (!pinSearch) return true;
                                                                        const q = pinSearch.toLowerCase();
                                                                        return (
                                                                            p.code.toLowerCase().includes(q) ||
                                                                            (p.company ?? "").toLowerCase().includes(q)
                                                                        );
                                                                    }).length === 0 && (
                                                                        <p className="py-3 text-center text-[10px] text-muted-foreground">
                                                                            Sin resultados
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold uppercase text-muted-foreground">
                                                            Cliente
                                                        </label>
                                                        <CustomDropdown
                                                            options={uniqueClients.map((c) => ({
                                                                label: c,
                                                                value: c,
                                                            }))}
                                                            value={clientFilter}
                                                            onChange={setClientFilter}
                                                            className="h-8 w-full"
                                                            searchable={true}
                                                            multiple={true}
                                                            placeholder="Todos"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold uppercase text-muted-foreground">
                                                            Tratamiento
                                                        </label>
                                                        <CustomDropdown
                                                            options={[
                                                                { label: "Todos", value: "all" },
                                                                { label: "Con Tratamiento", value: "yes" },
                                                                { label: "Sin Tratamiento", value: "no" },
                                                            ]}
                                                            value={treatmentFilter}
                                                            onChange={setTreatmentFilter}
                                                            className="h-8 w-full"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold uppercase text-muted-foreground">
                                                            Fecha
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            <CustomDropdown
                                                                options={[
                                                                    { label: "Sin Fecha", value: "none" },
                                                                    { label: "Solicitud", value: "request" },
                                                                    { label: "Entrega", value: "delivery" },
                                                                ]}
                                                                value={evalFilterType}
                                                                onChange={(val: unknown) =>
                                                                    setEvalFilterType(
                                                                        val as "none" | "request" | "delivery"
                                                                    )
                                                                }
                                                                className="h-8 flex-1 text-[10px]"
                                                            />
                                                            {evalFilterType !== "none" && (
                                                                <CustomDropdown
                                                                    options={[
                                                                        { label: "Antes", value: "before" },
                                                                        { label: "Después", value: "after" },
                                                                    ]}
                                                                    value={evalDateOperator}
                                                                    onChange={(val: unknown) =>
                                                                        setEvalDateOperator(val as "before" | "after")
                                                                    }
                                                                    className="h-8 w-20 text-[10px]"
                                                                />
                                                            )}
                                                        </div>
                                                        {evalFilterType !== "none" && (
                                                            <DateSelector
                                                                date={
                                                                    evalDateValue ? new Date(evalDateValue) : undefined
                                                                }
                                                                onSelect={(date) =>
                                                                    setEvalDateValue(
                                                                        date ? format(date, "yyyy-MM-dd") : ""
                                                                    )
                                                                }
                                                                placeholder="Seleccionar fecha"
                                                                buttonClassName="h-8 text-[10px]"
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5 border-t border-border pt-2">
                                                        <label className="text-[9px] font-bold uppercase text-muted-foreground">
                                                            Orden
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            <CustomDropdown
                                                                options={[
                                                                    { label: "Prioridad", value: "auto" },
                                                                    { label: "Fecha", value: "date" },
                                                                    { label: "Código", value: "code" },
                                                                    { label: "Mixto", value: "both" },
                                                                ]}
                                                                value={evalSortBy}
                                                                onChange={setEvalSortBy}
                                                                className="h-8 flex-1 text-[10px]"
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 border-border/60 p-0 hover:bg-primary/5"
                                                                onClick={() =>
                                                                    setEvalSortDirection((prev) =>
                                                                        prev === "asc" ? "desc" : "asc"
                                                                    )
                                                                }
                                                            >
                                                                {evalSortDirection === "asc" ? (
                                                                    <ArrowUpAZ className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <ArrowDownZA className="h-3.5 w-3.5" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Order List */}
                            <div className="flex-1 space-y-2 overflow-y-auto p-2">
                                {ordersPendingEvaluation.length === 0 ? (
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
                                ) : (
                                    ordersPendingEvaluation.map((order) => {
                                        const deliveryDate = (order as OrderWithRelations).projects?.delivery_date;
                                        const companyName = (order as OrderWithRelations).projects?.company;
                                        const isPinned = pinnedOrderIds.has(order.id);

                                        return (
                                            <div
                                                key={order.id}
                                                className={cn(
                                                    "group relative overflow-hidden rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md",
                                                    isPinned
                                                        ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10"
                                                        : "border-border"
                                                )}
                                            >
                                                {isPinned && (
                                                    <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />
                                                )}
                                                <div className="mb-2 flex items-start justify-between">
                                                    <div
                                                        className="flex-1 cursor-pointer pl-1"
                                                        onClick={() => onSelectOrder(order)}
                                                    >
                                                        <div className="mb-0.5 flex items-center gap-1.5">
                                                            {isPinned && (
                                                                <Pin className="h-3 w-3 shrink-0 text-amber-500" />
                                                            )}
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
                                                                {format(new Date(deliveryDate), "dd MMM", {
                                                                    locale: es,
                                                                })}
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
                                                                togglePin(order.id);
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
                                        );
                                    })
                                )}
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
                            {/* Form Header */}
                            <div className="shrink-0 bg-gradient-to-br from-red-600 to-red-700 p-4 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleBack}
                                            className="h-8 w-8 text-white hover:bg-white/20"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="rounded-xl border border-white/30 bg-white/20 p-2.5">
                                            <Wrench className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-lg font-black leading-none tracking-tight">
                                                {selectedOrder.part_code}
                                            </div>
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
                                                onClick={() => setShowDrawing((v) => !v)}
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
                                                onClick={handlePrev}
                                                className="h-7 w-7 text-white hover:bg-white/20"
                                                title="Anterior"
                                            >
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {selectedEvalIndex < filters.ordersPendingEvaluation.length - 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleNext}
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

                                {/* Nav counter */}
                                {selectedEvalIndex >= 0 && filters.ordersPendingEvaluation.length > 1 && (
                                    <div className="ml-[88px] mt-2">
                                        <span className="text-[10px] font-medium text-red-200">
                                            {selectedEvalIndex + 1} / {filters.ordersPendingEvaluation.length}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Form Body */}
                            <div className="flex-1 space-y-4 overflow-y-auto p-5">
                                <div className="space-y-1">
                                    <h2 className="text-sm font-bold">Evaluar Pieza</h2>
                                    <p className="text-[11px] text-muted-foreground">
                                        Asignación de máquinas y tiempos estimados
                                    </p>
                                </div>

                                {/* Steps */}
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                        Pasos de Proceso
                                    </Label>
                                    <div className="space-y-3">
                                        {steps.map((step, index) => {
                                            const isTreatment = isTreatmentStep(step);
                                            return (
                                                <div
                                                    key={index}
                                                    className="flex items-end gap-2 border-b border-border/50 pb-3 last:border-0"
                                                >
                                                    {/* Type toggle */}
                                                    <div className="flex shrink-0 flex-col gap-1">
                                                        <Label className="text-[10px] uppercase opacity-0">T</Label>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleStepType(index)}
                                                            title={
                                                                isTreatment
                                                                    ? "Cambiar a Máquina"
                                                                    : "Cambiar a Tratamiento"
                                                            }
                                                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                                                                isTreatment
                                                                    ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                                                            }`}
                                                        >
                                                            {isTreatment ? (
                                                                <FlaskConical className="h-4 w-4" />
                                                            ) : (
                                                                <Wrench className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    {isTreatment ? (
                                                        <>
                                                            <div className="flex-1 space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-amber-600">
                                                                    Paso {index + 1}: Tratamiento
                                                                </Label>
                                                                <SearchableSelect
                                                                    value={step.treatment_id}
                                                                    onChange={(val) =>
                                                                        handleTreatmentSelect(index, val)
                                                                    }
                                                                    placeholder="Seleccionar"
                                                                    options={treatments.map((t) => ({
                                                                        value: t.id,
                                                                        label:
                                                                            t.avg_lead_days != null
                                                                                ? `${t.name} (${t.avg_lead_days}d)`
                                                                                : t.name,
                                                                    }))}
                                                                />
                                                            </div>
                                                            <div className="w-20 space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-amber-600">
                                                                    Días
                                                                </Label>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        min="0.5"
                                                                        step="0.5"
                                                                        value={step.days || ""}
                                                                        onChange={(e) =>
                                                                            updateTreatmentDays(
                                                                                index,
                                                                                parseFloat(e.target.value) || 0
                                                                            )
                                                                        }
                                                                        className="h-9 border-amber-200 pr-6 text-xs focus:border-amber-500"
                                                                    />
                                                                    <FlaskConical className="absolute right-2 top-3 h-3 w-3 text-amber-400" />
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex-1 space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                                                    Paso {index + 1}: Máquina
                                                                </Label>
                                                                <SearchableSelect
                                                                    value={step.machine}
                                                                    onChange={(val) =>
                                                                        updateMachineStep(index, "machine", val)
                                                                    }
                                                                    placeholder="Seleccionar"
                                                                    options={machines.map((m) => ({
                                                                        value: m.name,
                                                                        label: m.name,
                                                                    }))}
                                                                />
                                                            </div>
                                                            <div className="shrink-0 space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                                                    Tiempo
                                                                </Label>
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        placeholder="0"
                                                                        value={
                                                                            Math.floor(step.hours) > 0
                                                                                ? Math.floor(step.hours)
                                                                                : ""
                                                                        }
                                                                        onChange={(e) => {
                                                                            const h = parseInt(e.target.value) || 0;
                                                                            const m = Math.round((step.hours % 1) * 60);
                                                                            updateMachineStep(
                                                                                index,
                                                                                "hours",
                                                                                h + m / 60
                                                                            );
                                                                        }}
                                                                        className="h-9 w-14 px-2 text-center text-xs"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                                        h
                                                                    </span>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="59"
                                                                        step="5"
                                                                        placeholder="0"
                                                                        value={
                                                                            Math.round((step.hours % 1) * 60) > 0
                                                                                ? Math.round((step.hours % 1) * 60)
                                                                                : ""
                                                                        }
                                                                        onChange={(e) => {
                                                                            const m = Math.min(
                                                                                59,
                                                                                parseInt(e.target.value) || 0
                                                                            );
                                                                            const h = Math.floor(step.hours);
                                                                            updateMachineStep(
                                                                                index,
                                                                                "hours",
                                                                                h + m / 60
                                                                            );
                                                                        }}
                                                                        className="h-9 w-14 px-2 text-center text-xs"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                                        m
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeStep(index)}
                                                        className="h-9 w-9 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
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
