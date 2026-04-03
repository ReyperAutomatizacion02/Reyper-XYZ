"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { ArrowDownZA, ArrowUpAZ, ChevronDown, Filter, ListFilter, Pin, PinOff, Search, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateSelector } from "@/components/ui/date-selector";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { OrderWithRelations } from "@/lib/scheduling-utils";
import { Database } from "@/utils/supabase/types";
import { EvaluationFiltersState } from "../hooks/use-evaluation-filters";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface EvaluationFilterPanelProps {
    filters: EvaluationFiltersState;
    ordersPendingEvaluation: Order[];
}

export function EvaluationFilterPanel({ filters, ordersPendingEvaluation }: EvaluationFilterPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPinSectionExpanded, setIsPinSectionExpanded] = useState(false);
    const [pinSearch, setPinSearch] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);

    const {
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
        clearAllFilters,
        activeFiltersCount,
        uniqueClients,
        pinnedOrderIds,
        togglePin,
    } = filters;

    // Close panel on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (isOpen && panelRef.current && !panelRef.current.contains(target)) {
                const isInsidePortal =
                    target.closest("[data-radix-popper-content-wrapper]") ||
                    target.closest('[role="dialog"]') ||
                    target.closest(".p-DayPicker");
                if (!isInsidePortal) setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const projectsForPin = useMemo(() => {
        const map = new Map<string, { code: string; company: string | null; orderIds: string[] }>();
        ordersPendingEvaluation.forEach((o) => {
            const rel = (o as OrderWithRelations).projects;
            const code = rel?.code;
            if (!code) return;
            if (!map.has(code)) map.set(code, { code, company: rel?.company ?? null, orderIds: [] });
            map.get(code)!.orderIds.push(o.id);
        });
        return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [ordersPendingEvaluation]);

    const toggleProjectPin = (orderIds: string[], allPinned: boolean) => {
        orderIds.forEach((id) => {
            const isPinned = pinnedOrderIds.has(id);
            if (allPinned && isPinned) togglePin(id);
            else if (!allPinned && !isPinned) togglePin(id);
        });
    };

    const pinnedProjectCount = projectsForPin.filter((p) => p.orderIds.every((id) => pinnedOrderIds.has(id))).length;

    return (
        <div className="relative" ref={panelRef}>
            <Button
                variant="outline"
                size="sm"
                className={cn(
                    "h-9 gap-2 px-3 text-[10px] font-bold uppercase shadow-sm transition-all",
                    isOpen ? "border-primary bg-primary text-white" : "bg-background"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <ListFilter className="h-3.5 w-3.5" />
                <span>Opciones</span>
                {activeFiltersCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-primary shadow-sm">
                        {activeFiltersCount}
                    </span>
                )}
            </Button>

            {isOpen && (
                <div className="absolute right-full top-0 z-[1500] mr-2 w-72 rounded-2xl border border-border bg-popover p-4 shadow-2xl duration-200 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                        {/* Header */}
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

                        {/* Pinned projects — collapsible */}
                        <div className="space-y-1.5 border-b border-border pb-3">
                            <button
                                type="button"
                                onClick={() => setIsPinSectionExpanded(!isPinSectionExpanded)}
                                className="group flex w-full items-center justify-between"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                                        Fijados
                                    </span>
                                    {pinnedProjectCount > 0 && (
                                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] leading-none text-white">
                                            {pinnedProjectCount}
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
                                                    (p.company ?? "").toLowerCase().includes(q)
                                                );
                                            })
                                            .map((project) => {
                                                const allPinned = project.orderIds.every((id) =>
                                                    pinnedOrderIds.has(id)
                                                );
                                                const somePinned =
                                                    !allPinned && project.orderIds.some((id) => pinnedOrderIds.has(id));
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
                                                                toggleProjectPin(project.orderIds, allPinned)
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

                        {/* Cliente filter */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Cliente</label>
                            <CustomDropdown
                                options={uniqueClients.map((c) => ({ label: c, value: c }))}
                                value={clientFilter}
                                onChange={setClientFilter}
                                className="h-8 w-full"
                                searchable={true}
                                multiple={true}
                                placeholder="Todos"
                            />
                        </div>

                        {/* Tratamiento filter */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Tratamiento</label>
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

                        {/* Fecha filter */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Fecha</label>
                            <div className="flex gap-1.5">
                                <CustomDropdown
                                    options={[
                                        { label: "Sin Fecha", value: "none" },
                                        { label: "Solicitud", value: "request" },
                                        { label: "Entrega", value: "delivery" },
                                    ]}
                                    value={evalFilterType}
                                    onChange={(val: unknown) =>
                                        setEvalFilterType(val as "none" | "request" | "delivery")
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
                                        onChange={(val: unknown) => setEvalDateOperator(val as "before" | "after")}
                                        className="h-8 w-20 text-[10px]"
                                    />
                                )}
                            </div>
                            {evalFilterType !== "none" && (
                                <DateSelector
                                    date={evalDateValue ? new Date(evalDateValue) : undefined}
                                    onSelect={(date) => setEvalDateValue(date ? format(date, "yyyy-MM-dd") : "")}
                                    placeholder="Seleccionar fecha"
                                    buttonClassName="h-8 text-[10px]"
                                />
                            )}
                        </div>

                        {/* Order / sort */}
                        <div className="space-y-1.5 border-t border-border pt-2">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Orden</label>
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
                                    onClick={() => setEvalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
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
    );
}
