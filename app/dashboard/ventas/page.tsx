import Link from "next/link";
import { FilePlus, ShoppingCart, ArrowRight, Clock, History, Users2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";

const salesTools = [
    {
        name: "Nueva Cotización",
        description: "Crear y guardar nuevas cotizaciones.",
        href: "/dashboard/ventas/cotizador",
        icon: FilePlus,
        color: "bg-red-500/10 text-red-500",
        status: "Disponible",
    },
    {
        name: "Nuevo Proyecto",
        description: "Generar códigos de proyecto y partidas automáticamente.",
        href: "/dashboard/ventas/nuevo-proyecto",
        icon: FilePlus,
        color: "bg-orange-500/10 text-orange-500",
        status: "Nuevo",
    },
    {
        href: "/dashboard/ventas/historial",
        icon: History,
        color: "bg-blue-500/10 text-blue-500",
        status: "Disponible",
    },
    {
        name: "Clientes y Usuarios",
        description: "Gestionar catálogo de clientes y usuarios solicitantes.",
        href: "/dashboard/ventas/clientes-usuarios",
        icon: Users2,
        color: "bg-indigo-500/10 text-indigo-500",
        status: "Nuevo",
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
                    <Link
                        key={tool.href}
                        href={tool.href}
                        className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl hover:border-red-500/30 transition-all duration-300"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${tool.color}`}>
                                <tool.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                                {tool.status}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold mb-2 group-hover:text-red-500 transition-colors">
                            {tool.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {tool.description}
                        </p>

                        <div className="flex items-center text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            Abrir herramienta
                            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
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
