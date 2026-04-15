"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPlanningTask } from "@/app/dashboard/produccion/actions";
import { Database } from "@/utils/supabase/types";
import { Clock, X } from "lucide-react";
import { format, addHours } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateSelector } from "@/components/ui/date-selector";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: {
        machine: string;
        time: number;
    } | null;
    orders: Order[];
    onSuccess: () => void;
}

// Internal TimePicker Component
interface TimePickerProps {
    date: Date | undefined;
    onChange: (newDate: Date) => void;
}

function TimePicker({ date, onChange }: TimePickerProps) {
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

    const currentHour = date ? format(date, "HH") : "00";
    const currentMinute = date ? format(date, "mm") : "00";

    const handleHourChange = (val: string) => {
        const newDate = date ? new Date(date) : new Date();
        newDate.setHours(parseInt(val));
        onChange(newDate);
    };

    const handleMinuteChange = (val: string) => {
        const newDate = date ? new Date(date) : new Date();
        newDate.setMinutes(parseInt(val));
        onChange(newDate);
    };

    return (
        <div className="flex items-center gap-2 pt-6">
            {" "}
            {/* Added padding top to align with DateSelector's button below label */}
            <div className="flex flex-col items-center gap-1">
                <Select value={currentHour} onValueChange={handleHourChange}>
                    <SelectTrigger className="h-10 w-[70px] border-border bg-muted/50">
                        <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {hours.map((h) => (
                            <SelectItem key={h} value={h}>
                                {h}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Hora</span>
            </div>
            <span className="pb-6 font-bold text-muted-foreground">:</span>
            <div className="flex flex-col items-center gap-1">
                <Select value={currentMinute} onValueChange={handleMinuteChange}>
                    <SelectTrigger className="h-10 w-[70px] border-border bg-muted/50">
                        <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {minutes.map((m) => (
                            <SelectItem key={m} value={m}>
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Min</span>
            </div>
        </div>
    );
}

export function CreateTaskModal({ isOpen, onClose, initialData, orders, onSuccess }: CreateTaskModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Separate states for dates to handle the UI components easier
    const [selectedOrder, setSelectedOrder] = useState("");
    const [operator, setOperator] = useState("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && initialData) {
            const start = new Date(initialData.time);
            const end = addHours(start, 2);

            setStartDate(start);
            setEndDate(end);
            setSelectedOrder("");
            setOperator("");
            setFormError(null);
        }
    }, [isOpen, initialData]);

    // ESC to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Focus trap
    useEffect(() => {
        if (!isOpen) return;
        const el = dialogRef.current;
        if (!el) return;
        el.focus();

        const focusable = el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        const trap = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        el.addEventListener("keydown", trap);
        return () => el.removeEventListener("keydown", trap);
    }, [isOpen]);

    if (!isOpen || !initialData) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !startDate || !endDate) {
            setFormError("Completa los campos requeridos: pieza, fecha de inicio y fin.");
            return;
        }

        setFormError(null);
        setIsLoading(true);
        try {
            await createPlanningTask(
                selectedOrder,
                initialData.machine,
                format(startDate, "yyyy-MM-dd'T'HH:mm"),
                format(endDate, "yyyy-MM-dd'T'HH:mm"),
                operator
            );
            onSuccess();
            onClose();
        } catch (error) {
            console.error("[CreateTaskModal] error:", error);
            toast.error("No se pudo crear la tarea. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-eval-sidebar flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
            aria-hidden="true"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-task-modal-title"
                tabIndex={-1}
                className="w-full max-w-lg overflow-visible rounded-xl border border-border bg-card shadow-2xl duration-200 animate-in zoom-in-95 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Changed overflow-hidden to visible for DateSelector popover */}
                <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-muted/30 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <h3
                            id="create-task-modal-title"
                            className="flex items-center gap-2 text-lg font-bold text-foreground"
                        >
                            <span className="text-primary" aria-hidden="true">
                                ✨
                            </span>{" "}
                            Nuevo Registro
                        </h3>
                        {initialData && (
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                {initialData.machine}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 p-6">
                    {/* Partida Selection */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Pieza / Partida
                        </Label>
                        <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                            <SelectTrigger className="h-10 w-full border-border bg-muted/50">
                                <SelectValue placeholder="Buscar pieza..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {orders.map((order) => (
                                    <SelectItem key={order.id} value={order.id}>
                                        <span className="mr-2 font-mono font-bold">{order.part_code}</span>
                                        {order.part_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Start Date & Time */}
                    <div className="space-y-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <DateSelector label="Inicio del Maquinado" date={startDate} onSelect={setStartDate} />
                            </div>
                            <TimePicker date={startDate} onChange={(d) => setStartDate(d)} />
                        </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="space-y-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <DateSelector label="Fin Estimado" date={endDate} onSelect={setEndDate} />
                            </div>
                            <TimePicker date={endDate} onChange={(d) => setEndDate(d)} />
                        </div>
                    </div>

                    {/* Operator */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Operador
                        </Label>
                        <Input
                            type="text"
                            className="h-10 w-full border-border bg-muted/50"
                            placeholder="Nombre del operador..."
                            value={operator}
                            onChange={(e) => setOperator(e.target.value)}
                        />
                    </div>

                    {formError && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="h-10 rounded-lg">
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-10 rounded-lg bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                        >
                            {isLoading ? "Guardando..." : "Guardar Registro"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
