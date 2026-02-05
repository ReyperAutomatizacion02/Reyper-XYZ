
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, FileBox, Ruler } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";

export default async function DisenoDashboardPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <DashboardHeader
                title="Diseño e Ingeniería"
                description="Gestión de planos, modelos CAD y especificaciones técnicas"
                icon={<PenTool className="w-8 h-8" />}
                backUrl="/dashboard"
                colorClass="text-pink-600"
                bgClass="bg-pink-600/10"
            />

            <div className="flex flex-col items-center justify-center p-12 border rounded-2xl border-dashed border-border bg-muted/10 min-h-[400px]">
                <div className="p-4 rounded-full bg-pink-500/10 mb-4">
                    <PenTool className="h-10 w-10 text-pink-500" />
                </div>
                <h2 className="text-xl font-bold">Sin herramientas activas</h2>
                <p className="text-muted-foreground text-center max-w-sm mt-2">
                    Actualmente no hay módulos habilitados para esta área. Las herramientas de gestión de planos y control de versiones se implementarán en la Fase 3.
                </p>
            </div>
        </div>
    );
}
