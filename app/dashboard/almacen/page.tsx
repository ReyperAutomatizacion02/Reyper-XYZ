
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Package, Truck, ClipboardList, PenTool, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";

import { ToolCard } from "@/components/tool-card";

export default async function AlmacenDashboardPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const tools = [
        {
            name: "Inventario General",
            description: "Gestión de herramientas, insertos, consumibles y stock.",
            icon: Package,
            href: "/dashboard/almacen/inventario",
            status: "Nuevo" as const,
            colorClass: "text-red-500",
            bgClass: "bg-red-500/10"
        },
        {
            name: "Solicitudes de Material",
            description: "Recepción y despacho de solicitudes de producción.",
            icon: ClipboardList,
            href: "#",
            status: "Próximamente" as const,
            disabled: true,
            colorClass: "text-red-500",
            bgClass: "bg-red-500/10"
        },
        {
            name: "Entradas y Salidas",
            description: "Registro de movimientos manuales y ajustes.",
            icon: Truck,
            href: "#",
            status: "Próximamente" as const,
            disabled: true,
            colorClass: "text-red-500",
            bgClass: "bg-red-500/10"
        }
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <DashboardHeader
                title="Almacén"
                description="Panel de control de inventarios y logística interna"
                icon={<Package className="w-8 h-8 text-red-600" />} // Standard Red Brand Color
                backUrl="/dashboard"
                iconClassName="bg-red-600/10 text-red-600"
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                    <ToolCard
                        key={tool.name}
                        name={tool.name}
                        description={tool.description}
                        href={tool.href}
                        icon={tool.icon}
                        colorClass={tool.colorClass}
                        bgClass={tool.bgClass}
                        disabled={tool.disabled}
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
