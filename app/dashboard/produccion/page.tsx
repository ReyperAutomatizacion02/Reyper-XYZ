import { Calendar, Wrench, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { DashboardHeader } from "@/components/dashboard-header";
import { ToolCard } from "@/components/tool-card";
import { PERMISSIONS } from "@/lib/config/permissions";

const TOOLS = [
    {
        name: "Planeación",
        description: "Planificador de maquinados con vista Gantt interactiva",
        href: "/dashboard/produccion/planeacion",
        icon: Calendar,
        colorClass: "text-red-500",
        bgClass: "bg-red-500/10",
        permission: PERMISSIONS.PRODUCCION_PLANEACION,
        legacyRoles: ["admin", "produccion"],
    },
    {
        name: "Maquinados",
        description: "Control de tiempos de maquinado y seguimiento personal",
        href: "/dashboard/produccion/maquinados",
        icon: Wrench,
        colorClass: "text-blue-500",
        bgClass: "bg-blue-500/10",
        permission: PERMISSIONS.PRODUCCION_MAQUINADOS,
        legacyRoles: ["admin", "operador"],
    },
];

export default async function ProductionPage() {
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

    const filteredTools = TOOLS.filter((tool) => {
        if (isAdmin) return true;
        if (userPermissions !== null) return userPermissions.includes(tool.permission);
        // Legacy fallback: filtrar por roles
        return tool.legacyRoles.some((role) => userRoles.includes(role));
    });

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6">
            <DashboardHeader
                title="Producción"
                description="Herramientas para el área de producción"
                icon={<Wrench className="h-8 w-8 text-red-600" />}
                backUrl="/dashboard"
                iconClassName="bg-red-600/10 text-red-600"
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
