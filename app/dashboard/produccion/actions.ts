"use server";

import { createClient } from "@/utils/supabase/server";
import moment from "moment";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateTaskSchedule(taskId: string, start: string, end: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await (supabase.from("planning" as any) as any)
        .update({
            planned_date: start,
            planned_end: end,
        })
        .eq("id", taskId);

    if (error) {
        console.error("Error updating task:", error);
        throw new Error("Failed to update task");
    }

    revalidatePath("/dashboard/produccion");
}

export async function scheduleNewTask(orderId: string, machineId: string, start: string, durationHours: number = 2) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get machine name because the Notion-synced table uses names
    const { data: machine } = await supabase.from("machines").select("name").eq("id", machineId).single();
    if (!machine) throw new Error("Machine not found");

    // Calculate end time on server? OR modify to accept end time string?
    // Client should calculate end time to be safe with local timezone.
    // However, keeping duration logic for now but parsing start string is hard.
    // If start is string, we can't easily do math on it without parsing.
    // But we want to avoid server timezone. 
    // Best: Client sends both start and end strings.
    // But strictly following signature:

    // For creating new task, usually usage is from a specific action.
    // I will convert string to Timestamp to add duration, then to ISO? 
    // If I use new Date(start), I get Server Date. 
    // This function seems risky. 
    // But USER ONLY complained about REDIMENSIONAR (Resize/Move).
    // I will only update updateTaskSchedule signature to be safe.

    // Actually, I'll revert changing scheduleNewTask signature to avoid breaking other calls I don't see.
    // I'll only change updateTaskSchedule.

    // Wait, I already selected lines including scheduleNewTask. 
    // I will keep scheduleNewTask as is (Date) but verify it later.
    // I'll only change updateTaskSchedule.

    const end = new Date(new Date(start).getTime() + durationHours * 60 * 60 * 1000);

    const { error } = await (supabase.from("planning" as any) as any)
        .insert({
            order_id: orderId,
            machine: machine.name,
            planned_date: start,
            planned_end: end.toISOString(), // This might be issue if logic used elsewhere
        });


    if (error) {
        console.error("Error creating task:", error);
        throw new Error("Failed to create task");
    }

    // Update order status if needed - using general_status from types
    await supabase.from("production_orders").update({ genral_status: 'En Proceso' }).eq('id', orderId);

    revalidatePath("/dashboard/produccion");
}

export async function createPlanningTask(orderId: string, machine: string, start: string, end: string, operator?: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await (supabase.from("planning" as any) as any)
        .insert({
            order_id: orderId,
            machine: machine,
            planned_date: start,
            planned_end: end,
            operator: operator || null,
        });

    if (error) {
        console.error("Error creating planning task:", error);
        throw new Error("Failed to create task");
    }

    revalidatePath("/dashboard/produccion");
}

export async function updateTaskDetails(taskId: string, orderId: string, machine: string, start: string, end: string, operator?: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await (supabase.from("planning" as any) as any)
        .update({
            order_id: orderId,
            machine: machine,
            planned_date: start,
            planned_end: end,
            operator: operator || null,
        })
        .eq("id", taskId);

    if (error) {
        console.error("Error updating planning task:", error);
        throw new Error("Failed to update task");
    }

    revalidatePath("/dashboard/produccion");
}

export async function recordCheckIn(taskId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await (supabase.from("planning" as any) as any)
        .update({
            check_in: moment().format('YYYY-MM-DD HH:mm:ss'),
        })
        .eq("id", taskId);

    if (error) {
        console.error("Error recording check-in:", error);
        throw new Error("Failed to record check-in");
    }

    revalidatePath("/dashboard/produccion/maquinados");
}

export async function recordCheckOut(taskId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await (supabase.from("planning" as any) as any)
        .update({
            check_out: moment().format('YYYY-MM-DD HH:mm:ss'),
        })
        .eq("id", taskId);

    if (error) {
        console.error("Error recording check-out:", error);
        throw new Error("Failed to record check-out");
    }

    revalidatePath("/dashboard/produccion/maquinados");
}
