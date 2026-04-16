"use client";

import { Truck, FolderKanban, MapPin, Clock, FlaskConical } from "lucide-react";
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
    {
        name: "Tratamientos",
        description: "Catálogo de tratamientos y acabados superficiales con proveedores y tiempos de entrega.",
        href: "/dashboard/logistica/tratamientos",
        icon: FlaskConical,
        colorClass: "text-violet-500",
        bgClass: "bg-violet-500/10",
    },
    // Future tools as placeholders
    {
        name: "Gestión de Envíos",
        description: "Control de transportes y guías de mensajería.",
        href: "#",
        icon: Truck,
        colorClass: "text-slate-400",
        bgClass: "bg-slate-100",
        disabled: true,
    },
    {
        name: "Destinos y Rutas",
        description: "Administración de puntos de entrega y rutas frecuentes.",
        href: "#",
        icon: MapPin,
        colorClass: "text-slate-400",
        bgClass: "bg-slate-100",
        disabled: true,
    },
];

export default function LogisticaPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6 duration-500 animate-in fade-in">
            <DashboardHeader
                title="Logística"
                description="Gestión de envíos y seguimiento de proyectos"
                icon={<Truck className="h-8 w-8 text-brand" />}
                backUrl="/dashboard"
                iconClassName="bg-red-500/10 text-brand"
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
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
                    <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">Más herramientas próximamente</p>
                </div>
            </div>
        </div>
    );
}
