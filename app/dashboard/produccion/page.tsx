import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { GanttWrapper } from "@/components/production/gantt-wrapper";
import { PlannerSidebar } from "@/components/production/planner-sidebar";

export default async function ProductionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all necessary data in parallel
    const [machinesRes, ordersRes, tasksRes] = await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase.from("production_orders").select("*").order("created_at"),
        supabase.from("scheduled_tasks").select("*, production_orders(part_number, part_name), machines(name)"),
    ]);

    const machines = machinesRes.data || [];
    const orders = ordersRes.data || [];
    const tasks = tasksRes.data || [];

    return (
        <div className="h-full w-full flex overflow-hidden">
            <PlannerSidebar orders={orders} machines={machines} />

            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-none p-4 border-b border-border bg-background/50 backdrop-blur-sm z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Planeación de Producción</h1>
                        <p className="text-sm text-muted-foreground">Gestiona y programa las órdenes de trabajo por máquina.</p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <GanttWrapper
                        initialMachines={machines}
                        initialOrders={orders}
                        initialTasks={tasks}
                    />
                </div>
            </div>
        </div>
    );
}
