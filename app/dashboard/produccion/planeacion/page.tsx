import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import moment from "moment";
import { ProductionView } from "@/components/production/production-view";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { compareOrdersByPriority } from "@/lib/scheduling-utils";

export const dynamic = 'force-dynamic';

export default async function PlaneacionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Date range filter: 90 days back (for recent history) + 180 days forward
    const rangeStart = moment().subtract(90, "days").format("YYYY-MM-DD");
    const rangeEnd = moment().add(180, "days").format("YYYY-MM-DD");

    // Fetch all necessary data in parallel
    const [machinesRes, ordersRes, tasksRes] = await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase.from("production_orders")
            .select("*, projects(company, delivery_date)")
            .neq("genral_status", "D7-ENTREGADA")
            .neq("genral_status", "D8-CANCELADA")
            .neq("material", "ENSAMBLE")
            .order("created_at", { ascending: false }),
        supabase.from("planning")
            .select("*, production_orders(*)")
            .gte("planned_date", rangeStart)
            .lte("planned_date", rangeEnd)
            .order("planned_date", { ascending: false }),
    ]);

    const machines = machinesRes.data || [];
    const rawOrders = ordersRes.data || [];
    const tasks = tasksRes.data || [];
    // Derive operators from fetched tasks instead of a separate query
    const operators = Array.from(new Set(
        tasks.map(t => t.operator as string).filter(Boolean)
    )).sort();

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
