"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    AlertTriangle,
    ArrowDownZA,
    ArrowUpAZ,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    Filter,
    Info,
    ListFilter,
    Pin,
    PinOff,
    Search,
    Trash2,
    Wrench,
    XCircle,
    Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { extractDriveFileId } from "@/lib/drive-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { OrderWithRelations, EvaluationStep } from "@/lib/scheduling-utils";
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
    onEvalSuccess,
}: EvaluationSidebarProps) {
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const filterPanelRef = useRef<HTMLDivElement>(null);
    const { isCollapsed } = useSidebar();

    // Form state
    const [steps, setSteps] = useState<EvaluationStep[]>([{ machine: "", hours: 0 }]);
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

            if (initialSteps.length === 0) {
                initialSteps.push({ machine: "", hours: 0 });
            } else {
                const last = initialSteps[initialSteps.length - 1];
                if (last?.machine && last.hours > 0) {
                    initialSteps.push({ machine: "", hours: 0 });
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

    if (!isOpen) return null;

    // ---- Form helpers ----

    const updateStep = (index: number, field: keyof EvaluationStep, value: string | number) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        const current = newSteps[index];
        if (index === newSteps.length - 1 && current.machine && current.hours > 0) {
            newSteps.push({ machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        if (newSteps.length === 0) {
            newSteps.push({ machine: "", hours: 0 });
        } else {
            const last = newSteps[newSteps.length - 1];
            if (last.machine && last.hours > 0) newSteps.push({ machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!selectedOrder) return;

        const validSteps = steps.filter((s) => s.machine && s.hours > 0);
        const incompleteSteps = steps.filter((s) => s.machine && (!s.hours || s.hours <= 0));

        if (validSteps.length === 0) {
            if (incompleteSteps.length > 0) {
                setConfirmModal({
                    title: "Información Incompleta",
                    message: `Has seleccionado la máquina "${incompleteSteps[0].machine}" pero no has asignado las horas.`,
                    type: "warning",
                    onConfirm: () => setConfirmModal(null),
                });
            } else {
                toast.error("Por favor completa al menos un paso con máquina y horas válidas");
            }
            return;
        }

        if (incompleteSteps.length > 0) {
            setConfirmModal({
                title: "¿Continuar con pasos incompletos?",
                message: `Hay ${incompleteSteps.length} paso(s) con máquina pero sin horas. Se ignorarán.\n\n¿Continuar con ${validSteps.length} paso(s) válido(s)?`,
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
            const { error } = await supabase
                .from("production_orders")
                .update({ evaluation: validSteps as unknown as Json })
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
                                    Piezas por Evaluar
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
                                        {/* Search suggestions dropdown */}
                                        {searchSuggestions.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full z-[1600] mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-xl duration-150 animate-in fade-in slide-in-from-top-2">
                                                <div className="border-b border-border/50 bg-muted/30 px-3 py-1.5">
                                                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        <Pin className="h-3 w-3" />
                                                        Fijar al tope de la lista
                                                    </span>
                                                </div>
                                                {searchSuggestions.map((o) => (
                                                    <button
                                                        key={o.id}
                                                        onClick={() => togglePin(o.id)}
                                                        className="group/sug flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-[11px] font-black text-primary">
                                                                {o.part_code}
                                                            </div>
                                                            <div className="truncate text-[10px] text-muted-foreground">
                                                                {o.part_name}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-muted-foreground transition-colors group-hover/sug:text-primary">
                                                            <Pin className="h-3 w-3" />
                                                            Fijar
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
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
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "h-8 w-full justify-start text-left text-[10px] font-normal",
                                                                            !evalDateValue && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                                                        {evalDateValue ? (
                                                                            format(
                                                                                new Date(evalDateValue),
                                                                                "dd 'de' MMMM, yyyy",
                                                                                {
                                                                                    locale: es,
                                                                                }
                                                                            )
                                                                        ) : (
                                                                            <span>Seleccionar fecha</span>
                                                                        )}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent
                                                                    className="z-[2000] w-auto p-0"
                                                                    align="start"
                                                                >
                                                                    <Calendar
                                                                        mode="single"
                                                                        selected={
                                                                            evalDateValue
                                                                                ? new Date(evalDateValue)
                                                                                : undefined
                                                                        }
                                                                        onSelect={(date) =>
                                                                            setEvalDateValue(
                                                                                date ? format(date, "yyyy-MM-dd") : ""
                                                                            )
                                                                        }
                                                                        initialFocus
                                                                    />
                                                                </PopoverContent>
                                                            </Popover>
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
                                        Pasos de Maquinado
                                    </Label>
                                    <div className="space-y-3">
                                        {steps.map((step, index) => (
                                            <div
                                                key={index}
                                                className="flex items-end gap-3 border-b border-border/50 pb-3 last:border-0"
                                            >
                                                <div className="flex-1 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                                        Paso {index + 1}: Máquina
                                                    </Label>
                                                    <Select
                                                        value={step.machine}
                                                        onValueChange={(val) => updateStep(index, "machine", val)}
                                                    >
                                                        <SelectTrigger className="h-9 border-border bg-background text-xs transition-colors focus:border-red-500 focus:ring-0 focus:ring-offset-0">
                                                            <SelectValue placeholder="Seleccionar" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {machines.map((m) => (
                                                                <SelectItem
                                                                    key={m.name}
                                                                    value={m.name}
                                                                    className="text-xs"
                                                                >
                                                                    {m.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="w-20 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                                        Horas
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min="0.5"
                                                            step="0.5"
                                                            value={step.hours}
                                                            onChange={(e) =>
                                                                updateStep(index, "hours", parseFloat(e.target.value))
                                                            }
                                                            className="h-9 pr-6 text-xs"
                                                        />
                                                        <Clock className="absolute right-2 top-3 h-3 w-3 text-muted-foreground" />
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeStep(index)}
                                                    className="h-9 w-9 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
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
