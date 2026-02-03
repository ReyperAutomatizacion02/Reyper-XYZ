"use client";

import React, { useState, useEffect, useRef } from "react";
import moment from "moment";
import { createPlanningTask } from "@/app/dashboard/produccion/actions";
import { Database } from "@/utils/supabase/types";
import { CalendarIcon, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { motion, AnimatePresence } from "framer-motion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

// Custom Date Selector Component - EXACT COPY from project-form.tsx
function DateSelector({
    date,
    onSelect,
    label
}: {
    date: Date | undefined;
    onSelect: (d: Date | undefined) => void;
    label: string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <Label className="text-muted-foreground font-medium text-xs uppercase tracking-wider">{label}</Label>
            <Button
                type="button"
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal bg-muted/50 hover:bg-card border-border shadow-sm transition-all duration-200 h-10",
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
                        <div
                            className="fixed inset-0 z-[9998] bg-transparent"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Calendar Container - Strictly below the button with minimal margin */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute top-full mt-1 left-0 z-[9999] bg-popover border rounded-xl shadow-xl w-auto overflow-hidden ring-1 ring-border/20"
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
        <div className="flex items-center gap-2 pt-6"> {/* Added padding top to align with DateSelector's button below label */}
            <div className="flex flex-col gap-1 items-center">
                <Select value={currentHour} onValueChange={handleHourChange}>
                    <SelectTrigger className="w-[70px] bg-muted/50 border-border h-10">
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
                <span className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Hora</span>
            </div>
            <span className="text-muted-foreground font-bold pb-6">:</span>
            <div className="flex flex-col gap-1 items-center">
                <Select value={currentMinute} onValueChange={handleMinuteChange}>
                    <SelectTrigger className="w-[70px] bg-muted/50 border-border h-10">
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
                <span className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Min</span>
            </div>
        </div>
    );
}

export function CreateTaskModal({ isOpen, onClose, initialData, orders, onSuccess }: CreateTaskModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Separate states for dates to handle the UI components easier
    const [selectedOrder, setSelectedOrder] = useState("");
    const [operator, setOperator] = useState("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        if (isOpen && initialData) {
            const startMoment = moment(initialData.time);
            const endMoment = moment(startMoment).add(2, 'hours');

            setStartDate(startMoment.toDate());
            setEndDate(endMoment.toDate());
            setSelectedOrder("");
            setOperator("");
        }
    }, [isOpen, initialData]);

    if (!isOpen || !initialData) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !startDate || !endDate) {
            alert("Por favor completa los campos requeridos");
            return;
        }

        setIsLoading(true);
        try {
            await createPlanningTask(
                selectedOrder,
                initialData.machine,
                moment(startDate).format("YYYY-MM-DDTHH:mm"),
                moment(endDate).format("YYYY-MM-DDTHH:mm"),
                operator
            );
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Error al crear el registro");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-visible animate-in zoom-in-95 duration-200"> {/* Changed overflow-hidden to visible for DateSelector popover */}
                <div className="bg-muted/30 px-6 py-4 border-b border-border flex justify-between items-center rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                            <span className="text-primary">✨</span> Nuevo Registro
                        </h3>
                        {initialData && (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono text-muted-foreground border border-border">
                                {initialData.machine}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Partida Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Pieza / Partida
                        </Label>
                        <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                            <SelectTrigger className="w-full bg-muted/50 border-border h-10">
                                <SelectValue placeholder="Buscar pieza..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {orders.map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                        <span className="font-mono font-bold mr-2">{order.part_code}</span>
                                        {order.part_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Start Date & Time */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <DateSelector
                                    label="Inicio del Maquinado"
                                    date={startDate}
                                    onSelect={setStartDate}
                                />
                            </div>
                            <TimePicker date={startDate} onChange={(d) => setStartDate(d)} />
                        </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <DateSelector
                                    label="Fin Estimado"
                                    date={endDate}
                                    onSelect={setEndDate}
                                />
                            </div>
                            <TimePicker date={endDate} onChange={(d) => setEndDate(d)} />
                        </div>
                    </div>

                    {/* Operator */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Operador</Label>
                        <Input
                            type="text"
                            className="w-full bg-muted/50 border-border h-10"
                            placeholder="Nombre del operador..."
                            value={operator}
                            onChange={e => setOperator(e.target.value)}
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="h-10 rounded-lg"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-8 font-semibold shadow-lg shadow-primary/20"
                        >
                            {isLoading ? "Guardando..." : "Guardar Registro"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
