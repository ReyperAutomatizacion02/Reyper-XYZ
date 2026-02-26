"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    console.log("Saving update to Supabase:", { id, updates }); // Debug log

    const { data, error } = await supabase
        .from("system_updates")
        .update(updates)
        .eq("id", id)
        .select();

    if (error) {
        console.error("Error updating system update:", error);
        throw new Error(error.message);
    }

    if (!data || data.length === 0) {
        console.warn("No update was made. It's possible RLS is blocking the update or the ID is incorrect.");
        return null;
    }

    console.log("Update successful, returned data:", data[0]);
    revalidatePath("/dashboard/actualizaciones");
    return data[0] as SystemUpdate;
}
