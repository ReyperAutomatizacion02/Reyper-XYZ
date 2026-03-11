"use client";

import { Truck, FolderKanban, MapPin, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ToolCard } from "@/components/tool-card";

const logisticsTools = [
    {
        name: "Proyectos Activos",
        description: "Monitoreo en tiempo real de estatus y entregas de piezas.",
        href: "/dashboard/logistica/proyectos",
        icon: FolderKanban,
        colorClass: "text-blue-500",
        bgClass: "bg-blue-500/10",
    },
    // Future tools as placeholders
    {
        name: "Gestión de Envíos",
        description: "Control de transportes y guías de mensajería.",
        href: "#",
        icon: Truck,
        colorClass: "text-slate-400",
        bgClass: "bg-slate-100",
        disabled: true
    },
    {
        name: "Destinos y Rutas",
        description: "Administración de puntos de entrega y rutas frecuentes.",
        href: "#",
        icon: MapPin,
        colorClass: "text-slate-400",
        bgClass: "bg-slate-100",
        disabled: true
    }
];

export default function LogisticaPage() {
    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <DashboardHeader
                title="Logística"
                description="Gestión de envíos y seguimiento de proyectos"
                icon={<Truck className="w-8 h-8 text-[#EC1C21]" />}
                backUrl="/dashboard"
                iconClassName="bg-red-500/10 text-[#EC1C21]"
            />

            {/* Tools Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {logisticsTools.map((tool) => (
                    <ToolCard
                        key={tool.name}
                        name={tool.name}
                        description={tool.description}
                        href={tool.href}
                        icon={tool.icon}
                        colorClass={tool.colorClass}
                        bgClass={tool.bgClass}
                    />
                ))}

                {/* Placeholder for future tools */}
                <div className="p-6 rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-center min-h-[200px]">
                    <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Más herramientas próximamente</p>
                </div>
            </div>
        </div>
    );
}
