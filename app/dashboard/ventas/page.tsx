import Link from "next/link";
import { FilePlus, ShoppingCart, ArrowRight, Clock, History, Users2, FolderKanban } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ToolCard } from "@/components/tool-card";

const salesTools = [
    {
        name: "Nueva Cotización",
        description: "Crear y guardar nuevas cotizaciones.",
        href: "/dashboard/ventas/cotizador",
        icon: FilePlus,
        colorClass: "text-red-500",
        bgClass: "bg-red-500/10",
    },
    {
        name: "Nuevo Proyecto",
        description: "Generar códigos de proyecto y partidas automáticamente.",
        href: "/dashboard/ventas/nuevo-proyecto",
        icon: FilePlus,
        colorClass: "text-orange-500",
        bgClass: "bg-orange-500/10",
    },
    {
        name: "Historial de Cotizaciones",
        description: "Consultar y gestionar cotizaciones pasadas.",
        href: "/dashboard/ventas/historial",
        icon: History,
        colorClass: "text-blue-500",
        bgClass: "bg-blue-500/10",
    },
    {
        name: "Clientes y Usuarios",
        description: "Gestionar catálogo de clientes y usuarios solicitantes.",
        href: "/dashboard/ventas/clientes-usuarios",
        icon: Users2,
        colorClass: "text-indigo-500",
        bgClass: "bg-indigo-500/10",
    },
    {
        name: "Proyectos Activos",
        description: "Monitoreo en tiempo real de proyectos en curso.",
        href: "/dashboard/ventas/proyectos",
        icon: FolderKanban,
        colorClass: "text-orange-500",
        bgClass: "bg-orange-500/10",
    },
];

export default function SalesPage() {
    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <DashboardHeader
                title="Ventas"
                description="Gestión de cotizaciones y clientes"
                icon={<ShoppingCart className="w-8 h-8 text-red-500" />} // Custom color for Sales
                backUrl="/dashboard"
                iconClassName="bg-red-500/10 text-red-500"
            />

            {/* Tools Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {salesTools.map((tool) => (
                    <ToolCard
                        key={tool.href}
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
