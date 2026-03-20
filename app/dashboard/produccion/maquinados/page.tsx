import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import moment from "moment";
import { MachiningRealtimeWrapper } from "@/components/production/machining-realtime-wrapper";

export const dynamic = 'force-dynamic';

export default async function MaquinadosPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!profile || !profile.roles || (!profile.roles.includes("operador") && !profile.roles.includes("admin"))) {
        redirect("/dashboard");
    }

    const operatorName = profile.operator_name;

    // Date range: 30 days back + 60 days forward (operator view focuses on near-term)
    const rangeStart = moment().subtract(30, "days").format("YYYY-MM-DD");
    const rangeEnd = moment().add(60, "days").format("YYYY-MM-DD");

    // Fetch tasks for this operator
    let tasksQuery = supabase
        .from("planning")
        .select("*, production_orders(*)")
        .gte("planned_date", rangeStart)
        .lte("planned_date", rangeEnd)
        .order("planned_date", { ascending: false });

    if (!profile.roles?.includes("admin")) {
        if (!operatorName) {
            return (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] p-6 text-center">
                    <h1 className="text-2xl font-bold mb-2">Usuario no vinculado</h1>
                    <p className="text-muted-foreground">Tu cuenta no tiene un nombre de operador asignado. Por favor, contacta al administrador.</p>
                </div>
            );
        }
        tasksQuery = tasksQuery.eq("operator", operatorName);
    }

    const { data: tasks } = await tasksQuery;

    return (
        <MachiningRealtimeWrapper
            initialTasks={tasks || []}
            operatorName={operatorName || "Administrador"}
        />
    );
}
