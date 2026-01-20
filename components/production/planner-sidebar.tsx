"use client";

import { useState } from "react";
import { Database } from "@/utils/supabase/types";
import { Search, CalendarPlus, Package } from "lucide-react";
import { scheduleNewTask } from "@/app/dashboard/produccion/actions";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type Machine = Database["public"]["Tables"]["machines"]["Row"];

interface PlannerSidebarProps {
    orders: Order[];
    machines: Machine[];
}

export function PlannerSidebar({ orders, machines }: PlannerSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const pendingOrders = orders.filter(
        (o) => o.part_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleScheduleClick = (order: Order) => {
        // Determine the machine (first available or let user pick)
        // For MVP, we'll schedule to the first machine starting "now"
        const machine = machines[0];
        if (!machine) return alert("No hay máquinas disponibles");

        const now = new Date();
        // Default 1 day duration
        scheduleNewTask(order.id, machine.id, now, 24)
            .catch(err => alert("Error al programar: " + err.message));
    };

    return (
        <div className="w-80 border-r border-border bg-card flex flex-col h-full z-20 shadow-xl">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Por Programar
                </h2>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar No. Parte..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {pendingOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-foreground">{order.part_number}</span>
                            <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">Qty: {order.quantity}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{order.part_name}</p>

                        <button
                            onClick={() => handleScheduleClick(order)}
                            className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white py-2 rounded-lg text-xs font-semibold transition-all opacity-100"
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Programar Ahora
                        </button>

                        {/* Status indicator strip */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500" />
                    </div>
                ))}

                {pendingOrders.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        No hay partidas pendientes.
                    </div>
                )}
            </div>
        </div>
    );
}
