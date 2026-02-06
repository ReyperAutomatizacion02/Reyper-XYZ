import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ProductionView } from "@/components/production/production-view";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { compareOrdersByPriority } from "@/lib/scheduling-utils";

export const dynamic = 'force-dynamic';

export default async function PlaneacionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all necessary data in parallel
    const [machinesRes, ordersRes, tasksRes, operatorsRes] = await Promise.all([
        supabase.from("machines").select("*").order("name").limit(1000),
        supabase.from("production_orders")
            .select("*, projects(company, delivery_date)")
            .neq("genral_status", "D7-ENTREGADA")
            .neq("genral_status", "D8-CANCELADA")
            .neq("material", "ENSAMBLE")
            .order("created_at", { ascending: false })
            .limit(5000),
        supabase.from("planning").select("*, production_orders(*)").order("planned_date", { ascending: false }).limit(5000),
        supabase.from("planning").select("operator").not("operator", "is", null).limit(5000),
    ]);

    const machines = machinesRes.data || [];
    const rawOrders = ordersRes.data || [];
    const tasks = tasksRes.data || [];
    const operators = Array.from(new Set((operatorsRes.data || []).map(t => t.operator as string))).sort();

    // Sort orders by priority for initial view
    const orders = rawOrders.sort(compareOrdersByPriority);

    console.log(`[PlaneacionPage] Fetched ${orders.length} orders. Errors:`,
        ordersRes.error ? ordersRes.error : "none"
    );

    return (
        <>
            <RealtimeRefresher table="production_orders" />
            <RealtimeRefresher table="planning" />
            <ProductionView
                machines={machines}
                orders={orders}
                tasks={tasks}
                operators={operators}
            />
        </>
    );
}
