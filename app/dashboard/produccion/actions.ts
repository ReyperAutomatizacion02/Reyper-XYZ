"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateTaskSchedule(taskId: string, start: Date, end: Date) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
        .from("scheduled_tasks")
        .update({
            start_time: start.toISOString(),
            end_time: end.toISOString(),
        })
        .eq("id", taskId);

    if (error) {
        console.error("Error updating task:", error);
        throw new Error("Failed to update task");
    }

    revalidatePath("/dashboard/produccion");
}

export async function scheduleNewTask(orderId: string, machineId: string, start: Date, durationHours: number = 2) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const { error } = await supabase
        .from("scheduled_tasks")
        .insert({
            order_id: orderId,
            machine_id: machineId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: "scheduled"
        });

    if (error) {
        console.error("Error creating task:", error);
        throw new Error("Failed to create task");
    }

    // Update order status to in_progress or scheduled if needed
    await supabase.from("production_orders").update({ status: 'scheduled' }).eq('id', orderId);

    revalidatePath("/dashboard/produccion");
}
