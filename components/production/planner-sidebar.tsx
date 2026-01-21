"use client";

import { Database } from "@/utils/supabase/types";
import { Package } from "lucide-react";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type Machine = Database["public"]["Tables"]["machines"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface PlannerSidebarProps {
    tasks: PlanningTask[];
    machines: Machine[];
    searchQuery?: string;
}

export function PlannerSidebar({ tasks, machines, searchQuery = "" }: PlannerSidebarProps) {
    const filteredTasks = tasks.filter((t) => {
        const order = t.production_orders;
        const search = searchQuery.toLowerCase();
        return (
            (order?.part_code?.toLowerCase() || "").includes(search) ||
            (order?.part_name?.toLowerCase() || "").includes(search) ||
            (t.machine?.toLowerCase() || "").includes(search)
        );
    });

    return (
        <div className="w-80 border-l border-border bg-card flex flex-col h-full z-20 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Registros
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                    {filteredTasks.length} partidas planificadas
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredTasks.map((task) => {
                    const order = task.production_orders;
                    if (!order) return null;

                    return (
                        <div key={task.id} className="p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors group relative overflow-hidden">
                            {order.image && (
                                <div className="mb-3 rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                                    <img
                                        src={order.image}
                                        alt={order.part_code}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-foreground">{order.part_code}</span>
                                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">Cant: {order.quantity}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{order.part_name}</p>

                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-[11px] font-semibold text-foreground truncate">
                                    {task.machine || "Sin máquina"}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {filteredTasks.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        No hay registros que coincidan.
                    </div>
                )}
            </div>
        </div>
    );
}
