import Link from "next/link";
import { Calendar, ArrowRight, Wrench, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const TOOLS = [
    {
        name: "Planeación",
        description: "Planificador de maquinados con vista Gantt interactiva",
        href: "/dashboard/produccion/planeacion",
        icon: Calendar,
        color: "bg-primary/10 text-primary",
        status: "Disponible",
        roles: ["admin", "produccion"],
    },
    {
        name: "Maquinados",
        description: "Control de tiempos de maquinado y seguimiento personal",
        href: "/dashboard/produccion/maquinados",
        icon: Wrench,
        color: "bg-blue-500/10 text-blue-500",
        status: "Disponible",
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
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                    <Wrench className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Producción</h1>
                    <p className="text-muted-foreground">Herramientas para el área de producción</p>
                </div>
            </div>

            {/* Tools Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTools.map((tool) => (
                    <Link
                        key={tool.href}
                        href={tool.href}
                        className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl hover:border-primary/30 transition-all duration-300"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${tool.color}`}>
                                <tool.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                                {tool.status}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                            {tool.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {tool.description}
                        </p>

                        <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
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
