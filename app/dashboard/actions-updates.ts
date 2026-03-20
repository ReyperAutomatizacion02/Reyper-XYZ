"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { UpdateSystemUpdateSchema } from "@/lib/validations/updates";

export interface SystemUpdate {
    id: string;
    sha: string;
    title: string;
    summary: string | null;
    content: string | null;
    category: string | null;
    author_name: string | null;
    github_url: string | null;
    images: string[] | null;
    image_captions: string[] | null;
    commit_date: string | null;
    created_at: string | null;
}

export async function getSystemUpdates() {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    await requireAuth(supabase);

    const { data, error } = await supabase
        .from("system_updates")
        .select("*")
        .order("commit_date", { ascending: false, nullsFirst: false });

    if (error) {
        console.error("Error fetching system updates:", error);
        return [];
    }

    return data as SystemUpdate[];
}

export async function updateSystemUpdate(id: string, updates: Partial<SystemUpdate>) {
    const parsed = UpdateSystemUpdateSchema.parse({ id, updates });
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    await requireRole(supabase, ["admin"]);

    console.log("Saving update to Supabase:", { id: parsed.id, updates: parsed.updates }); // Debug log

    const { data, error } = await supabase
        .from("system_updates")
        .update(parsed.updates)
        .eq("id", parsed.id)
        .select();

    if (error) {
        console.error("Error updating system update:", error);
        throw new Error("Error al actualizar el registro.");
    }

    if (!data || data.length === 0) {
        console.warn("No update was made. It's possible RLS is blocking the update or the ID is incorrect.");
        return null;
    }

    console.log("Update successful, returned data:", data[0]);
    revalidatePath("/dashboard/actualizaciones");
    return data[0] as SystemUpdate;
}
