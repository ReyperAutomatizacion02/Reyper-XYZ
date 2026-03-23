"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Calendar as CalendarIcon,
    Clock,
    User,
    Box,
    Save,
    Trash2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Edit,
} from "lucide-react";
import { createPlanningTask, updateTaskDetails } from "@/app/dashboard/produccion/actions";
import { Database } from "@/utils/supabase/types";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import logger from "@/utils/logger";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label"; // Ensure Label is imported if used inside DateSelector or elsewhere

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: {
        id?: string; // If present, edit mode
        machine: string;
        time?: number; // timestamp for start
        start?: string; // "YYYY-MM-DD HH:mm"
        end?: string;
        operator?: string;
        orderId?: string;
        partCode?: string; // Fallback hint
        activeOrder?: Order | null; // Injected order to guarantee visibility
        isDemo?: boolean; // Tour mode flag
    } | null;
    orders: Order[];
    operators: string[];
    onSuccess: () => void;
    container?: HTMLElement | null;
}

// Custom Date Selector Component - EXACT COPY from project-form.tsx
function DateSelector({
    date,
    onSelect,
    label,
}: {
    date: Date | undefined;
    onSelect: (d: Date | undefined) => void;
    label: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative space-y-2" ref={containerRef}>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
            <Button
                type="button"
                variant={"outline"}
                className={cn(
                    "h-11 w-full justify-start border-border bg-muted/50 text-left font-normal shadow-sm transition-all duration-200 hover:bg-card", // Matched height with TimePicker inputs
                    !date && "text-muted-foreground"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon className="mr-2 h-4 w-4 text-red-500" />
                {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar</span>}
            </Button>

            {/* Manual Popover */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Fixed Backdrop for click-outside closing */}
                        <div className="fixed inset-0 z-[9998] bg-transparent" onClick={() => setIsOpen(false)} />

                        {/* Calendar Container - Strictly below the button with minimal margin */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute left-0 top-full z-[9999] mt-1 w-auto overflow-hidden rounded-xl border bg-popover shadow-xl ring-1 ring-border/20"
                        >
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => {
                                    onSelect(d);
                                    setIsOpen(false);
                                }}
                                initialFocus
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// Custom Time Picker Component (24h strict - Custom Dropdown)
function CustomTimePicker({
    value,
    onChange,
    className,
}: {
    value: string;
    onChange: (val: string) => void;
    className?: string;
}) {
    const [hour, minute] = value ? value.split(":") : ["00", "00"];
    const [openStack, setOpenStack] = useState<"none" | "hour" | "minute">("none");
    const hourListRef = useRef<HTMLDivElement>(null);
    const minuteListRef = useRef<HTMLDivElement>(null);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = ["00", "15", "30", "45"]; // 15-minute intervals

    // Auto-scroll logic
    useEffect(() => {
        if (openStack === "hour" && hourListRef.current) {
            const selectedButton = hourListRef.current.querySelector(`#hour-${hour}`) as HTMLElement;
            if (selectedButton) {
                // Calculate position to center: elementTop - containerHeight/2 + elementHeight/2
                // Or simpler: scrollIntoView
                selectedButton.scrollIntoView({ block: "center", behavior: "instant" });
            }
        } else if (openStack === "minute" && minuteListRef.current) {
            const selectedButton = minuteListRef.current.querySelector(`#minute-${minute}`) as HTMLElement;
            if (selectedButton) {
                selectedButton.scrollIntoView({ block: "center", behavior: "instant" });
            }
        }
    }, [openStack, hour, minute]);

    return (
        <div className={`flex items-center gap-1 ${className} relative`}>
            {openStack !== "none" && <div className="fixed inset-0 z-[100]" onClick={() => setOpenStack("none")} />}

            {/* Hour Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === "hour" ? "none" : "hour")}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/40 py-2 text-foreground outline-none transition-all hover:bg-muted/60 focus:ring-2 focus:ring-primary/20 ${openStack === "hour" ? "border-primary bg-background ring-2 ring-primary/20" : "border-transparent"}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{hour}</span>
                        <ChevronDown
                            className={`h-3 w-3 text-muted-foreground transition-transform ${openStack === "hour" ? "rotate-180" : ""}`}
                        />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Hora</span>
                </button>

                {openStack === "hour" && (
                    <div
                        ref={hourListRef}
                        className="no-scrollbar absolute left-0 top-full z-[101] -ml-0 mt-1 flex max-h-48 w-20 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
                    >
                        {hours.map((h) => (
                            <button
                                key={h}
                                id={`hour-${h}`}
                                type="button"
                                onClick={() => {
                                    onChange(`${h}:${minute}`);
                                    setOpenStack("none");
                                }}
                                className={`rounded-md py-1.5 text-sm font-bold transition-colors ${h === hour ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <span className="pb-3 text-xl font-black text-muted-foreground/30">:</span>

            {/* Minute Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === "minute" ? "none" : "minute")}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/40 py-2 text-foreground outline-none transition-all hover:bg-muted/60 focus:ring-2 focus:ring-primary/20 ${openStack === "minute" ? "border-primary bg-background ring-2 ring-primary/20" : "border-transparent"}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{minute}</span>
                        <ChevronDown
                            className={`h-3 w-3 text-muted-foreground transition-transform ${openStack === "minute" ? "rotate-180" : ""}`}
                        />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Min</span>
                </button>

                {openStack === "minute" && (
                    <div
                        ref={minuteListRef}
                        className="no-scrollbar absolute right-0 top-full z-[101] -mr-0 mt-1 flex max-h-48 w-20 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
                    >
                        {minutes.map((m) => (
                            <button
                                key={m}
                                id={`minute-${m}`}
                                type="button"
                                onClick={() => {
                                    onChange(`${hour}:${m}`);
                                    setOpenStack("none");
                                }}
                                className={`rounded-md py-1.5 text-sm font-bold transition-colors ${m === minute ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function TaskModal({ isOpen, onClose, initialData, orders, operators, onSuccess, container }: TaskModalProps) {
    // Main Component

    const [formData, setFormData] = useState({
        orderId: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        operator: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const isEditMode = !!initialData?.id;

    // Prepare options for selects
    const orderOptions = React.useMemo(() => {
        const globalOptions = orders.map((o) => ({
            label: `${o.part_code} - ${o.part_name || "Sin nombre"} (${o.quantity} pzas)`,
            value: o.id,
        }));

        if (initialData?.activeOrder) {
            const exists = orders.some((o) => o.id === initialData!.activeOrder!.id);
            if (!exists) {
                logger.debug(
                    "[TaskModal] Injecting missing active order into options:",
                    initialData.activeOrder.part_code
                );
                globalOptions.unshift({
                    label: `${initialData.activeOrder.part_code} - ${initialData.activeOrder.part_name || "Sin nombre"} (${initialData.activeOrder.quantity} pzas)`,
                    value: initialData.activeOrder.id,
                });
            }
        }
        return globalOptions;
    }, [orders, initialData]);

    const operatorOptions = React.useMemo(
        () =>
            operators.map((op) => ({
                label: op,
                value: op,
            })),
        [operators]
    );

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Initialize form when initialData changes
    useEffect(() => {
        if (isOpen && initialData) {
            let startD = "";
            let startT = "";
            let endD = "";
            let endT = "";
            const op = initialData.operator || "";
            const ord = initialData.orderId || "";

            if (initialData.start) {
                const [d, t] = initialData.start.split("T");
                startD = d;
                startT = t;
            } else if (initialData.time) {
                const date = new Date(initialData.time);
                // Fix timezone issue by using local values
                const pad = (n: number) => (n < 10 ? "0" + n : n);
                startD = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                startT = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
            }

            if (initialData.end) {
                const [d, t] = initialData.end.split("T");
                endD = d;
                endT = t;
            } else if (startD && startT) {
                // Default 2 hours based on start Date object
                const dStart = new Date(`${startD}T${startT}`);
                const dEnd = new Date(dStart.getTime() + 2 * 60 * 60 * 1000);
                const pad = (n: number) => (n < 10 ? "0" + n : n);
                endD = `${dEnd.getFullYear()}-${pad(dEnd.getMonth() + 1)}-${pad(dEnd.getDate())}`;
                endT = `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}`;
            }

            logger.debug("[TaskModal] Initializing with data:", {
                initialOrderId: ord,
                initialPartCode: initialData.partCode,
                availableOrdersCount: orders.length,
                hasActiveOrderInjected: !!initialData.activeOrder,
            });

            // Robust matching: Try ID first, then Part Code as fallback
            let matchedOrderId = ord;
            if (ord) {
                const foundById = orders.find((o) => o.id.trim() === ord.trim());
                if (foundById) {
                    matchedOrderId = foundById.id;
                    logger.debug("[TaskModal] Match found by ID:", matchedOrderId);
                } else if (initialData.partCode) {
                    const foundByCode = orders.find(
                        (o) => o.part_code?.trim().toLowerCase() === initialData.partCode?.trim().toLowerCase()
                    );
                    if (foundByCode) {
                        matchedOrderId = foundByCode.id;
                        console.warn("[TaskModal] Match found by Part Code fallback (ID mismatch!):", matchedOrderId);
                    }
                }
            }

            if (!matchedOrderId && initialData.partCode && !ord) {
                // If it's a new task but we have a code hint (unlikely but possible)
                const foundByCode = orders.find(
                    (o) => o.part_code?.trim().toLowerCase() === initialData.partCode?.trim().toLowerCase()
                );
                if (foundByCode) matchedOrderId = foundByCode.id;
            }

            setFormData({
                orderId: matchedOrderId,
                startDate: startD,
                startTime: startT,
                endDate: endD,
                endTime: endT,
                operator: op,
            });
            setError("");
        }
    }, [isOpen, initialData, orders]);

    if (!isOpen || !initialData) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (
                !formData.orderId ||
                !formData.startDate ||
                !formData.startTime ||
                !formData.endDate ||
                !formData.endTime
            ) {
                throw new Error("Por favor completa los campos requeridos");
            }

            const startStr = `${formData.startDate}T${formData.startTime}`;
            const endStr = `${formData.endDate}T${formData.endTime}`;

            if (new Date(endStr) <= new Date(startStr)) {
                throw new Error("La fecha de fin debe ser posterior al inicio");
            }

            if (isEditMode && initialData.id) {
                await updateTaskDetails(
                    initialData.id,
                    formData.orderId,
                    initialData.machine,
                    startStr,
                    endStr,
                    formData.operator
                );
            } else {
                await createPlanningTask(formData.orderId, initialData.machine, startStr, endStr, formData.operator);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al guardar");
        } finally {
            setIsLoading(false);
        }
    };

    // Helper functions for DateSelector integration
    const handleStartDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData((prev) => ({ ...prev, startDate: format(date, "yyyy-MM-dd") }));
        }
    };

    const handleEndDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData((prev) => ({ ...prev, endDate: format(date, "yyyy-MM-dd") }));
        }
    };

    // Parse string dates back to Date objects for DateSelector
    // Note: append T00:00:00 to ensure local time is treated correctly or use strict parsing if needed
    // Actually, "yyyy-MM-dd" input to new Date() implies UTC in some browsers, but "yyyy/MM/dd" or simple parsing is safer.
    // However, DateSelector expects a Date object.
    // We can use the date-fns parse or simple new Date(str + 'T12:00:00') to avoid timezone shifts on just the date.
    // Let's use simple string splitting to be safe.
    const getSafeDate = (dateStr: string) => {
        if (!dateStr) return undefined;
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    const modalContent = (
        <div
            className={cn(
                "fixed inset-0 z-[10000] overflow-y-auto bg-black/50 backdrop-blur-sm",
                // Only animate if NOT demo mode to ensure instant availability for tour driver
                !initialData?.isDemo && "duration-200 animate-in fade-in"
            )}
            onClick={onClose}
        >
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div
                    id="task-modal-content"
                    className="w-full max-w-lg rounded-xl border border-border/50 bg-card shadow-2xl duration-200 animate-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-muted/30 p-4">
                        <h3 className="flex items-center gap-2 text-lg font-bold">
                            {isEditMode ? (
                                <>
                                    <Edit className="h-5 w-5 text-[#EC1C21]" />
                                    Editar Registro
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5 text-[#EC1C21]" />
                                    Nuevo Registro
                                </>
                            )}
                            <span className="ml-2 rounded-full border border-border bg-muted px-2 py-1 text-xs font-normal text-muted-foreground">
                                {initialData.machine}
                            </span>
                        </h3>
                        <button onClick={onClose} className="rounded-full p-1 transition-colors hover:bg-muted">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 p-6">
                        {error && (
                            <div className="animate-pulse rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2" id="task-modal-order">
                            <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Box className="h-4 w-4" />
                                PIEZA / PARTIDA
                            </label>
                            <SearchableSelect
                                options={orderOptions}
                                value={formData.orderId}
                                onChange={(val) => setFormData({ ...formData, orderId: val })}
                                placeholder="Buscar pieza..."
                            />
                        </div>

                        <div className="space-y-6 border-t border-border/50 pt-4">
                            {/* Start Block */}
                            <div
                                className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4"
                                id="task-modal-start"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="flex-1">
                                        <DateSelector
                                            label="Inicio del Maquinado"
                                            date={getSafeDate(formData.startDate)}
                                            onSelect={handleStartDateChange}
                                        />
                                    </div>
                                    <div className="w-40 pt-6">
                                        {" "}
                                        {/* Added padding to align with DateSelector button */}
                                        <CustomTimePicker
                                            value={formData.startTime}
                                            onChange={(val) => setFormData({ ...formData, startTime: val })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* End Block */}
                            <div
                                className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4"
                                id="task-modal-end"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="flex-1">
                                        <DateSelector
                                            label="Fin del Maquinado"
                                            date={getSafeDate(formData.endDate)}
                                            onSelect={handleEndDateChange}
                                        />
                                    </div>
                                    <div className="w-40 pt-6">
                                        <CustomTimePicker
                                            value={formData.endTime}
                                            onChange={(val) => setFormData({ ...formData, endTime: val })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 border-t border-border/50 pt-2" id="task-modal-operator">
                            <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <User className="h-4 w-4" />
                                OPERADOR ASIGNADO
                            </label>
                            <SearchableSelect
                                options={operatorOptions}
                                value={formData.operator}
                                onChange={(val) => setFormData({ ...formData, operator: val })}
                                placeholder="Seleccionar operador..."
                                onCreate={(val) => setFormData({ ...formData, operator: val })}
                            />
                        </div>

                        <div className="mt-4 flex gap-3 border-t border-border/50 pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                            >
                                Cancelar
                            </button>
                            <button
                                id="task-modal-save"
                                type="submit"
                                disabled={isLoading}
                                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" />
                                        {isEditMode ? "Actualizar Registro" : "Guardar Registro"}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, container || document.body);
}
