import Link from "next/link";
import { Calendar, ArrowRight, Wrench, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { DashboardHeader } from "@/components/dashboard-header";
import { ToolCard } from "@/components/tool-card";

const TOOLS = [
    {
        name: "Planeación",
        description: "Planificador de maquinados con vista Gantt interactiva",
        href: "/dashboard/produccion/planeacion",
        icon: Calendar,
        colorClass: "text-red-500", // Primary/Brand Color
        bgClass: "bg-red-500/10",
        roles: ["admin", "produccion"],
    },
    {
        name: "Maquinados",
        description: "Control de tiempos de maquinado y seguimiento personal",
        href: "/dashboard/produccion/maquinados",
        icon: Wrench,
        colorClass: "text-blue-500", // Distinct color
        bgClass: "bg-blue-500/10",
        roles: ["admin", "operador"],
    },
];

export default async function ProductionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("roles")
        .eq("id", user?.id)
        .single();

    const userRoles = profile?.roles || [];
    const isAdmin = userRoles.includes("admin");

    const filteredTools = TOOLS.filter(tool =>
        isAdmin || tool.roles.some(role => userRoles.includes(role))
    );

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <DashboardHeader
                title="Producción"
                description="Herramientas para el área de producción"
                icon={<Wrench className="w-8 h-8 text-red-600" />}
                backUrl="/dashboard"
                iconClassName="bg-red-600/10 text-red-600"
            />

            {/* Tools Grid */}
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

                {/* Placeholder for future tools */}
                <div className="p-6 rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-center min-h-[200px]">
                    <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Más herramientas próximamente</p>
                </div>
            </div>
        </div>
    );
}
