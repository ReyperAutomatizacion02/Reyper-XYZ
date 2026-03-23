import { FilePlus, ShoppingCart, Clock, History, Users2, FolderKanban, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { DashboardHeader } from "@/components/dashboard-header";
import { ToolCard } from "@/components/tool-card";
import { PERMISSIONS } from "@/lib/config/permissions";

const salesTools = [
    {
        name: "Nueva Cotización",
        description: "Crear y guardar nuevas cotizaciones.",
        href: "/dashboard/ventas/cotizador",
        icon: FilePlus,
        colorClass: "text-red-500",
        bgClass: "bg-red-500/10",
        permission: PERMISSIONS.VENTAS_COTIZADOR,
    },
    {
        name: "Nuevo Proyecto",
        description: "Generar códigos de proyecto y partidas automáticamente.",
        href: "/dashboard/ventas/nuevo-proyecto",
        icon: FilePlus,
        colorClass: "text-orange-500",
        bgClass: "bg-orange-500/10",
        permission: PERMISSIONS.VENTAS_NUEVO_PROYECTO,
    },
    {
        name: "Historial de Cotizaciones",
        description: "Consultar y gestionar cotizaciones pasadas.",
        href: "/dashboard/ventas/historial",
        icon: History,
        colorClass: "text-blue-500",
        bgClass: "bg-blue-500/10",
        permission: PERMISSIONS.VENTAS_HISTORIAL,
    },
    {
        name: "Clientes y Usuarios",
        description: "Gestionar catálogo de clientes y usuarios solicitantes.",
        href: "/dashboard/ventas/clientes-usuarios",
        icon: Users2,
        colorClass: "text-indigo-500",
        bgClass: "bg-indigo-500/10",
        permission: PERMISSIONS.VENTAS_CLIENTES,
    },
    {
        name: "Proyectos Activos",
        description: "Monitoreo en tiempo real de proyectos en curso.",
        href: "/dashboard/ventas/proyectos",
        icon: FolderKanban,
        colorClass: "text-orange-500",
        bgClass: "bg-orange-500/10",
        permission: PERMISSIONS.VENTAS_PROYECTOS,
    },
    {
        name: "Auditoría de Datos",
        description: "Control de integridad y campos faltantes.",
        href: "/dashboard/ventas/auditoria",
        icon: ShieldCheck,
        colorClass: "text-emerald-500",
        bgClass: "bg-emerald-500/10",
        permission: PERMISSIONS.VENTAS_AUDITORIA,
    },
];

export default async function SalesPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("roles, permissions")
        .eq("id", user?.id ?? "")
        .single();

    const userRoles: string[] = profile?.roles || [];
    const userPermissions: string[] | null = profile?.permissions ?? null;
    const isAdmin = userRoles.includes("admin");

    const filteredTools = salesTools.filter((tool) => {
        if (isAdmin) return true;
        if (userPermissions !== null) return userPermissions.includes(tool.permission);
        // Legacy fallback: mostrar todas las herramientas de ventas (ya tienen el rol)
        return true;
    });

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6">
            <DashboardHeader
                title="Ventas"
                description="Gestión de cotizaciones y clientes"
                icon={<ShoppingCart className="h-8 w-8 text-red-500" />}
                backUrl="/dashboard"
                iconClassName="bg-red-500/10 text-red-500"
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTools.map((tool) => (
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

                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
                    <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">Más herramientas próximamente</p>
                </div>
            </div>
        </div>
    );
}
