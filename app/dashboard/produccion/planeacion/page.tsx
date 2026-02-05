import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ProductionView } from "@/components/production/production-view";
import { RealtimeRefresher } from "@/components/realtime-refresher";

export const dynamic = 'force-dynamic';

export default async function PlaneacionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all necessary data in parallel
    const [machinesRes, ordersRes, tasksRes, operatorsRes] = await Promise.all([
        supabase.from("machines").select("*").order("name").limit(1000),
        supabase.from("production_orders").select("*").order("created_at", { ascending: false }).limit(10000), // Latest 10k orders
        supabase.from("planning").select("*, production_orders(*)").order("planned_date", { ascending: false }).limit(10000), // Latest 10k tasks
        supabase.from("planning").select("operator").not("operator", "is", null).limit(10000),
    ]);

    const machines = machinesRes.data || [];
    const orders = ordersRes.data || [];
    const tasks = tasksRes.data || [];
    const operators = Array.from(new Set((operatorsRes.data || []).map(t => t.operator as string))).sort();

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
