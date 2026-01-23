"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const VALID_ROLES = [
    "admin",
    "administracion",
    "recursos_humanos",
    "contabilidad",
    "compras",
    "ventas",
    "automatizacion",
    "diseno",
    "produccion",
    "calidad",
    "almacen",
] as const;

type ValidRole = typeof VALID_ROLES[number];

// Helper to check if caller is admin
async function verifyAdmin(supabase: any, userId: string) {
    const { data: callerProfile } = await supabase
        .from("user_profiles")
        .select("roles")
        .eq("id", userId)
        .single();

    if (!callerProfile?.roles?.includes("admin")) {
        throw new Error("No autorizado");
    }
}

// Approve user with multiple roles
export async function approveUser(userId: string, roles: string[]) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    // Validate all roles
    const validRoles = roles.filter(r => VALID_ROLES.includes(r as ValidRole));
    if (validRoles.length === 0) {
        throw new Error("Debe seleccionar al menos un rol válido");
    }

    const { error } = await supabase
        .from("user_profiles")
        .update({
            is_approved: true,
            roles: validRoles,
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

export async function rejectUser(userId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

// Update user roles (accepts array)
export async function updateUserRoles(userId: string, newRoles: string[]) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    // Validate all roles
    const validRoles = newRoles.filter(r => VALID_ROLES.includes(r as ValidRole));
    if (validRoles.length === 0) {
        throw new Error("Debe seleccionar al menos un rol válido");
    }

    // Prevent removing admin from self if last admin
    if (userId === user.id && !validRoles.includes("admin")) {
        const { data: adminUsers } = await supabase
            .from("user_profiles")
            .select("id")
            .contains("roles", ["admin"]);

        if (adminUsers && adminUsers.length <= 1) {
            throw new Error("No puedes quitar el último administrador");
        }
    }

    const { error } = await supabase
        .from("user_profiles")
        .update({
            roles: validRoles,
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

export async function getPendingUsers() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

export async function getApprovedUsers() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}
