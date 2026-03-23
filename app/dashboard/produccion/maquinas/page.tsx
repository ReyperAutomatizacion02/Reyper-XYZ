import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MaquinasClient } from "./client";

export default async function MaquinasPage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("roles, permissions")
        .eq("id", user.id)
        .single();

    const userRoles: string[] = profile?.roles || [];
    const isAdmin = userRoles.includes("admin");
    const isProduccion = userRoles.includes("produccion");

    if (!isAdmin && !isProduccion) {
        redirect("/dashboard/produccion");
    }

    const { data: machines } = await supabase
        .from("machines")
        .select("id, name, brand, model, serial_number, location, is_active, cover_image_url, created_at")
        .order("name", { ascending: true });

    return <MaquinasClient machines={machines || []} />;
}
