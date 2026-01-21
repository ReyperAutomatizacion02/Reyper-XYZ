import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ProductionView } from "@/components/production/production-view";

export default async function ProductionPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all necessary data in parallel
    const [machinesRes, ordersRes, tasksRes, operatorsRes] = await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase.from("production_orders").select("*").order("created_at"),
        supabase.from("planning").select("*, production_orders(*)"),
        supabase.from("planning").select("operator").not("operator", "is", null),
    ]);

    const machines = machinesRes.data || [];
    const orders = ordersRes.data || [];
    const tasks = tasksRes.data || [];
    const operators = Array.from(new Set((operatorsRes.data || []).map(t => t.operator as string))).sort();

    return (
        <ProductionView
            machines={machines}
            orders={orders}
            tasks={tasks}
            operators={operators}
        />
    );
}
