"use client";

import React, { useState, useEffect } from "react";
import moment from "moment";
import { createPlanningTask } from "@/app/dashboard/produccion/actions";
import { Database } from "@/utils/supabase/types";

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

export function CreateTaskModal({ isOpen, onClose, initialData, orders, onSuccess }: CreateTaskModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        orderId: "",
        operator: "",
        start: "",
        end: ""
    });

    useEffect(() => {
        if (isOpen && initialData) {
            const startMoment = moment(initialData.time);
            // Default duration 2 hours
            const endMoment = moment(startMoment).add(2, 'hours');

            setFormData({
                orderId: "",
                operator: "",
                start: startMoment.format("YYYY-MM-DDTHH:mm"),
                end: endMoment.format("YYYY-MM-DDTHH:mm")
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen || !initialData) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.orderId || !formData.start || !formData.end) {
            alert("Por favor completa los campos requeridos");
            return;
        }

        setIsLoading(true);
        try {
            await createPlanningTask(
                formData.orderId,
                initialData.machine,
                formData.start, // Send raw local string? Server action expects string?
                formData.end,
                formData.operator
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
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-primary/10 px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-bold text-lg">Nuevo Registro</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Presets */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-muted p-2 rounded">
                            <span className="block text-xs text-muted-foreground">Máquina</span>
                            <span className="font-semibold">{initialData.machine}</span>
                        </div>
                        <div className="bg-muted p-2 rounded">
                            <span className="block text-xs text-muted-foreground">Hora Inicio (Clic)</span>
                            <span className="font-semibold">{moment(initialData.time).format("HH:mm")}</span>
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Partida / Pieza <span className="text-red-500">*</span></label>
                        <select
                            className="w-full p-2 rounded border border-input bg-background"
                            value={formData.orderId}
                            onChange={e => setFormData({ ...formData, orderId: e.target.value })}
                            required
                        >
                            <option value="">Seleccionar pieza...</option>
                            {orders.map(order => (
                                <option key={order.id} value={order.id}>
                                    {order.part_code} - {order.part_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Inicio <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                className="w-full p-2 rounded border border-input bg-background"
                                value={formData.start}
                                onChange={e => setFormData({ ...formData, start: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fin <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                className="w-full p-2 rounded border border-input bg-background"
                                value={formData.end}
                                onChange={e => setFormData({ ...formData, end: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Operador</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded border border-input bg-background"
                            placeholder="Nombre del operador..."
                            value={formData.operator}
                            onChange={e => setFormData({ ...formData, operator: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded text-sm font-medium hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 rounded text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? "Guardando..." : "Crear Registro"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
