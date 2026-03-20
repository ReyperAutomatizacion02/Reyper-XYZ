"use client";

import React, { useRef } from "react";
import {
    AlertTriangle,
    ArrowDownZA,
    ArrowUpAZ,
    ClipboardList,
    FileText,
    Filter,
    ListFilter,
    Search,
    Trash2,
    XCircle,
    Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { extractDriveFileId } from "@/lib/drive-utils";
import { OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";
import { EvaluationFiltersState } from "./hooks/use-evaluation-filters";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isFullscreen: boolean;
    filters: EvaluationFiltersState;
    onOpenEvaluation: (order: Order, index: number, list: Order[]) => void;
    onClearEvaluation: (orderId: string) => void;
    onPreviewBlueprint: (fileId: string) => void;
}

export function EvaluationSidebar({
    isOpen,
    onClose,
    isFullscreen,
    filters,
    onOpenEvaluation,
    onClearEvaluation,
    onPreviewBlueprint,
}: EvaluationSidebarProps) {
    const [isFilterPanelOpen, setIsFilterPanelOpen] = React.useState(false);
    const filterPanelRef = useRef<HTMLDivElement>(null);

    // Close filter panel on click outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (isFilterPanelOpen && filterPanelRef.current && !filterPanelRef.current.contains(target)) {
                const isInsidePortal = target.closest('[data-radix-popper-content-wrapper]') ||
                    target.closest('[role="dialog"]') ||
                    target.closest('.p-DayPicker');
                if (!isInsidePortal) {
                    setIsFilterPanelOpen(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFilterPanelOpen]);

    if (!isOpen) return null;

    const {
        evalSearchQuery, setEvalSearchQuery,
        evalFilterType, setEvalFilterType,
        evalDateValue, setEvalDateValue,
        evalDateOperator, setEvalDateOperator,
        clientFilter, setClientFilter,
        treatmentFilter, setTreatmentFilter,
        evalSortDirection, setEvalSortDirection,
        evalSortBy, setEvalSortBy,
        showEvaluated, setShowEvaluated,
        clearAllFilters,
        activeFiltersCount,
        ordersPendingEvaluation,
        uniqueClients,
    } = filters;

    return (
        <div
            className={cn(
                "fixed right-0 bottom-0 w-[450px] bg-background/95 backdrop-blur-md border-l border-border shadow-2xl z-[1000] flex flex-col animate-in slide-in-from-right-8 duration-300",
                isFullscreen ? "top-0" : "top-[64px]"
            )}
        >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="font-bold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#EC1C21]" />
                    Piezas por Evaluar
                </h3>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
                    <XCircle className="w-4 h-4" />
                </Button>
            </div>

            {/* Tabs */}
            <div className="px-3 pt-3">
                <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => setShowEvaluated(false)}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${!showEvaluated
                            ? "bg-background text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Por Evaluar
                    </button>
                    <button
                        onClick={() => setShowEvaluated(true)}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${showEvaluated
                            ? "bg-background text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Evaluadas
                    </button>
                </div>
            </div>

            {/* Search and Filter Toggle */}
            <div className="p-4 border-b border-border space-y-3 bg-muted/5">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                            value={evalSearchQuery}
                            onChange={(e) => setEvalSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative" ref={filterPanelRef}>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-9 px-3 gap-2 font-bold text-[10px] uppercase transition-all shadow-sm",
                                isFilterPanelOpen ? "bg-primary text-white border-primary" : "bg-background"
                            )}
                            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        >
                            <ListFilter className="w-3.5 h-3.5" />
                            <span>Opciones</span>
                            {activeFiltersCount > 0 && (
                                <span className="flex items-center justify-center min-w-[16px] h-4 rounded-full bg-white text-primary text-[9px] font-black px-1 shadow-sm">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </Button>

                        {/* Floating Filter Panel */}
                        {isFilterPanelOpen && (
                            <div className="absolute top-0 right-full mr-2 w-72 bg-popover border border-border rounded-2xl shadow-2xl z-[1500] p-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-3.5 h-3.5 text-primary" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Filtros Avanzados</span>
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

                                    {/* Client Filter */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Cliente</label>
                                        <CustomDropdown
                                            options={uniqueClients.map(c => ({ label: c, value: c }))}
                                            value={clientFilter}
                                            onChange={setClientFilter}
                                            className="w-full h-8"
                                            searchable={true}
                                            multiple={true}
                                            placeholder="Todos"
                                        />
                                    </div>

                                    {/* Treatment Filter */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Tratamiento</label>
                                        <CustomDropdown
                                            options={[
                                                { label: "Todos", value: "all" },
                                                { label: "Con Tratamiento", value: "yes" },
                                                { label: "Sin Tratamiento", value: "no" }
                                            ]}
                                            value={treatmentFilter}
                                            onChange={setTreatmentFilter}
                                            className="w-full h-8"
                                        />
                                    </div>

                                    {/* Date Filter */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Fecha</label>
                                        <div className="flex gap-1.5">
                                            <CustomDropdown
                                                options={[
                                                    { label: "Sin Fecha", value: "none" },
                                                    { label: "Solicitud", value: "request" },
                                                    { label: "Entrega", value: "delivery" }
                                                ]}
                                                value={evalFilterType}
                                                onChange={(val: any) => setEvalFilterType(val)}
                                                className="flex-1 h-8 text-[10px]"
                                            />
                                            {evalFilterType !== "none" && (
                                                <CustomDropdown
                                                    options={[
                                                        { label: "Antes", value: "before" },
                                                        { label: "Después", value: "after" }
                                                    ]}
                                                    value={evalDateOperator}
                                                    onChange={(val: any) => setEvalDateOperator(val)}
                                                    className="w-20 h-8 text-[10px]"
                                                />
                                            )}
                                        </div>
                                        {evalFilterType !== "none" && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal h-8 text-[10px]",
                                                            !evalDateValue && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                                        {evalDateValue ? (
                                                            format(new Date(evalDateValue), "dd 'de' MMMM, yyyy", { locale: es })
                                                        ) : (
                                                            <span>Seleccionar fecha</span>
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 z-[2000]" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={evalDateValue ? new Date(evalDateValue) : undefined}
                                                        onSelect={(date) => setEvalDateValue(date ? format(date, "yyyy-MM-dd") : "")}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>

                                    {/* Sort Section */}
                                    <div className="space-y-1.5 pt-2 border-t border-border">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Orden</label>
                                        <div className="flex gap-1.5">
                                            <CustomDropdown
                                                options={[
                                                    { label: "Prioridad", value: "auto" },
                                                    { label: "Fecha", value: "date" },
                                                    { label: "Código", value: "code" },
                                                    { label: "Mixto", value: "both" }
                                                ]}
                                                value={evalSortBy}
                                                onChange={setEvalSortBy}
                                                className="flex-1 h-8 text-[10px]"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 border-border/60 hover:bg-primary/5"
                                                onClick={() => setEvalSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                                            >
                                                {evalSortDirection === "asc" ? <ArrowUpAZ className="w-3.5 h-3.5" /> : <ArrowDownZA className="w-3.5 h-3.5" />}
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
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {ordersPendingEvaluation.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/5 rounded-3xl border border-dashed border-border/60 mx-2 mt-4">
                        <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center shadow-sm mb-4 border border-border/40">
                            <ClipboardList className="w-8 h-8 text-muted-foreground opacity-40" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">¡Todo al día!</h4>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px]">
                            {showEvaluated
                                ? "No se han encontrado piezas evaluadas con los filtros actuales."
                                : "No hay piezas pendientes de evaluación por ahora."}
                        </p>
                    </div>
                ) : (
                    ordersPendingEvaluation.map((order, idx) => {
                        const deliveryDate = (order as OrderWithRelations).projects?.delivery_date;
                        const companyName = (order as OrderWithRelations).projects?.company;
                        const blueprintUrl = order.drawing_url;

                        return (
                            <div
                                key={order.id}
                                className="p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group relative overflow-hidden"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div
                                        className="cursor-pointer flex-1"
                                        onClick={() => {
                                            onOpenEvaluation(order, idx, [...ordersPendingEvaluation]);
                                        }}
                                    >
                                        <div className="text-xs font-black uppercase text-primary mb-0.5 tracking-tight">
                                            {order.part_code}
                                        </div>
                                        <div className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 pr-6">
                                            {order.part_name}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {blueprintUrl && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-md bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors border border-primary/20"
                                                title="Ver Plano"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const fileId = extractDriveFileId(blueprintUrl);
                                                    if (fileId) {
                                                        onPreviewBlueprint(fileId);
                                                    } else {
                                                        window.open(blueprintUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {deliveryDate && (
                                            <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded border border-border/50">
                                                {format(new Date(deliveryDate), "dd MMM", { locale: es })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                                    <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[180px]">
                                        {companyName || "Sin Empresa"}
                                    </div>
                                    <div className="flex gap-2">
                                        {showEvaluated && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                                title="Limpiar Evaluación"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearEvaluation(order.id);
                                                }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[9px] font-black uppercase text-primary/70 hover:text-primary hover:bg-primary/5 rounded-md"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenEvaluation(order, idx, [...ordersPendingEvaluation]);
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
        </div>
    );
}
