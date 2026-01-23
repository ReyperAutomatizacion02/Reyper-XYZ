import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPanelClient } from "./client";

export default async function AdminPanelPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("roles")
        .eq("id", user.id)
        .single();

    if (!profile?.roles?.includes("admin")) {
        redirect("/dashboard");
    }

    // Fetch pending users
    const { data: pendingUsers } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

    // Fetch approved users
    const { data: approvedUsers } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", true)
        .order("updated_at", { ascending: false });

    return (
        <AdminPanelClient
            pendingUsers={pendingUsers || []}
            approvedUsers={approvedUsers || []}
            currentUserId={user.id}
        />
    );
}
