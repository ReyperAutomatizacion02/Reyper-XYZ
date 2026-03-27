import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPanelClient } from "./client";

export default async function AdminPanelPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if user is admin
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).single();

    if (!profile?.roles?.includes("admin")) {
        redirect("/dashboard");
    }

    // Fetch all data in parallel
    const [pendingRes, approvedRes, employeesRes, shiftsRes] = await Promise.all([
        supabase
            .from("user_profiles")
            .select("id, full_name, username, roles, permissions, is_approved, operator_name, created_at, updated_at")
            .eq("is_approved", false)
            .order("created_at", { ascending: false }),
        supabase
            .from("user_profiles")
            .select("id, full_name, username, roles, permissions, is_approved, operator_name, created_at, updated_at")
            .eq("is_approved", true)
            .order("updated_at", { ascending: false }),
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase.from("work_shifts").select("*").order("sort_order").order("start_time"),
    ]);

    return (
        <AdminPanelClient
            pendingUsers={pendingRes.data || []}
            approvedUsers={approvedRes.data || []}
            employees={employeesRes.data || []}
            shifts={shiftsRes.data || []}
            currentUserId={user.id}
        />
    );
}
