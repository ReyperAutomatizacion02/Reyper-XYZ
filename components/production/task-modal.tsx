"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, User, Box, Save, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createPlanningTask, updateTaskDetails } from "@/app/dashboard/produccion/actions";
import { Database } from "@/utils/supabase/types";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
    } | null;
    orders: Order[];
    operators: string[];
    onSuccess: () => void;
}

// Custom Time Picker Component (24h strict - Custom Dropdown)
function CustomTimePicker({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) {
    const [hour, minute] = value ? value.split(':') : ["00", "00"];
    const [openStack, setOpenStack] = useState<'none' | 'hour' | 'minute'>('none');

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    return (
        <div className={`flex items-center gap-1 ${className} relative`}>
            {openStack !== 'none' && (
                <div className="fixed inset-0 z-[100]" onClick={() => setOpenStack('none')} />
            )}

            {/* Hour Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === 'hour' ? 'none' : 'hour')}
                    className={`w-full bg-muted/40 hover:bg-muted/60 text-foreground border transition-all rounded-lg py-2 flex flex-col items-center justify-center gap-0.5 outline-none focus:ring-2 focus:ring-primary/20 ${openStack === 'hour' ? 'border-primary ring-2 ring-primary/20 bg-background' : 'border-transparent'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{hour}</span>
                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${openStack === 'hour' ? 'rotate-180' : ''}`} />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Hora</span>
                </button>

                {openStack === 'hour' && (
                    <div className="absolute top-full left-0 w-20 -ml-0 mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-xl z-[101] flex flex-col p-1 gap-0.5 no-scrollbar">
                        {hours.map(h => (
                            <button
                                key={h}
                                type="button"
                                onClick={() => { onChange(`${h}:${minute}`); setOpenStack('none'); }}
                                className={`text-sm py-1.5 rounded-md font-bold transition-colors ${h === hour ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <span className="text-muted-foreground/30 font-black text-xl pb-3">:</span>

            {/* Minute Dropdown */}
            <div className="relative w-20">
                <button
                    type="button"
                    onClick={() => setOpenStack(openStack === 'minute' ? 'none' : 'minute')}
                    className={`w-full bg-muted/40 hover:bg-muted/60 text-foreground border transition-all rounded-lg py-2 flex flex-col items-center justify-center gap-0.5 outline-none focus:ring-2 focus:ring-primary/20 ${openStack === 'minute' ? 'border-primary ring-2 ring-primary/20 bg-background' : 'border-transparent'}`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold leading-none">{minute}</span>
                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${openStack === 'minute' ? 'rotate-180' : ''}`} />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Min</span>
                </button>

                {openStack === 'minute' && (
                    <div className="absolute top-full right-0 w-20 -mr-0 mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-xl z-[101] flex flex-col p-1 gap-0.5 no-scrollbar">
                        {minutes.map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { onChange(`${hour}:${m}`); setOpenStack('none'); }}
                                className={`text-sm py-1.5 rounded-md font-bold transition-colors ${m === minute ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
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

export function TaskModal({ isOpen, onClose, initialData, orders, operators, onSuccess }: TaskModalProps) {

    // Main Component

    const [formData, setFormData] = useState({
        orderId: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        operator: ""
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const isEditMode = !!initialData?.id;



    // Prepare options for selects (Moved to top to strictly follow Rules of Hooks)
    // 1. Start with global orders
    // 2. Inject the active order from the task if it exists (deduplicating by ID)
    const orderOptions = React.useMemo(() => {
        const globalOptions = orders.map(o => ({
            label: `${o.part_code} - ${o.part_name || "Sin nombre"} (${o.quantity} pzas)`,
            value: o.id
        }));

        if (initialData?.activeOrder) {
            const exists = orders.some(o => o.id === initialData!.activeOrder!.id);
            if (!exists) {
                console.log("[TaskModal] Injecting missing active order into options:", initialData.activeOrder.part_code);
                globalOptions.unshift({
                    label: `${initialData.activeOrder.part_code} - ${initialData.activeOrder.part_name || "Sin nombre"} (${initialData.activeOrder.quantity} pzas)`,
                    value: initialData.activeOrder.id
                });
            }
        }
        return globalOptions;
    }, [orders, initialData]);

    const operatorOptions = React.useMemo(() => operators.map(op => ({
        label: op,
        value: op
    })), [operators]);

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
            let op = initialData.operator || "";
            let ord = initialData.orderId || "";

            if (initialData.start) {
                const [d, t] = initialData.start.split("T");
                startD = d;
                startT = t;
            } else if (initialData.time) {
                const date = new Date(initialData.time);
                const pad = (n: number) => n < 10 ? '0' + n : n;
                startD = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                startT = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
            }

            if (initialData.end) {
                const [d, t] = initialData.end.split("T");
                endD = d;
                endT = t;
            } else if (startD && startT) {
                // Default 2 hours
                const dStart = new Date(`${startD}T${startT}`);
                const dEnd = new Date(dStart.getTime() + 2 * 60 * 60 * 1000);
                const pad = (n: number) => n < 10 ? '0' + n : n;
                endD = `${dEnd.getFullYear()}-${pad(dEnd.getMonth() + 1)}-${pad(dEnd.getDate())}`;
                endT = `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}`;
            }

            console.log("[TaskModal] Initializing with data:", {
                initialOrderId: ord,
                initialPartCode: initialData.partCode,
                availableOrdersCount: orders.length,
                hasActiveOrderInjected: !!initialData.activeOrder
            });

            // Robust matching: Try ID first, then Part Code as fallback
            let matchedOrderId = ord;
            if (ord) {
                const foundById = orders.find(o => o.id.trim() === ord.trim());
                if (foundById) {
                    matchedOrderId = foundById.id;
                    console.log("[TaskModal] Match found by ID:", matchedOrderId);
                } else if (initialData.partCode) {
                    const foundByCode = orders.find(o =>
                        o.part_code?.trim().toLowerCase() === initialData.partCode?.trim().toLowerCase()
                    );
                    if (foundByCode) {
                        matchedOrderId = foundByCode.id;
                        console.warn("[TaskModal] Match found by Part Code fallback (ID mismatch!):", matchedOrderId);
                    }
                }
            }

            if (!matchedOrderId && initialData.partCode && !ord) {
                // If it's a new task but we have a code hint (unlikely but possible)
                const foundByCode = orders.find(o =>
                    o.part_code?.trim().toLowerCase() === initialData.partCode?.trim().toLowerCase()
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
            if (!formData.orderId || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
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
                await createPlanningTask(
                    formData.orderId,
                    initialData.machine,
                    startStr,
                    endStr,
                    formData.operator
                );
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

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {isEditMode ? (
                            <>
                                <span className="text-blue-500">✏️</span>
                                Editar Registro
                            </>
                        ) : (
                            <>
                                <span className="text-green-500">✨</span>
                                Nuevo Registro
                            </>
                        )}
                        <span className="text-xs font-normal text-muted-foreground ml-2 px-2 py-1 bg-muted rounded-full border border-border">
                            {initialData.machine}
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto pb-32">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm animate-pulse">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <Box className="w-4 h-4" />
                            PIEZA / PARTIDA
                        </label>
                        <SearchableSelect
                            options={orderOptions}
                            value={formData.orderId}
                            onChange={(val) => setFormData({ ...formData, orderId: val })}
                            placeholder="Buscar pieza..."
                        />
                    </div>

                    <div className="space-y-6 pt-4 border-t border-border/50">
                        {/* Start Block */}
                        <div className="space-y-3 p-4 bg-muted/40 rounded-xl border border-border/60">
                            <label className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                <Calendar className="w-4 h-4" />
                                Inicio del Maquinado
                            </label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="date"
                                    required
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-base focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
                                />
                                <div className="w-40">
                                    <CustomTimePicker
                                        value={formData.startTime}
                                        onChange={(val) => setFormData({ ...formData, startTime: val })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* End Block */}
                        <div className="space-y-3 p-4 bg-muted/40 rounded-xl border border-border/60">
                            <label className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                <Clock className="w-4 h-4" />
                                Fin del Maquinado
                            </label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="date"
                                    required
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-base focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm"
                                />
                                <div className="w-40">
                                    <CustomTimePicker
                                        value={formData.endTime}
                                        onChange={(val) => setFormData({ ...formData, endTime: val })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50">
                        <label className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <User className="w-4 h-4" />
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

                    <div className="pt-6 flex gap-3 border-t border-border/50 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-border rounded-xl hover:bg-muted transition-colors font-semibold text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-[2] px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    {isEditMode ? "Actualizar Registro" : "Guardar Registro"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
