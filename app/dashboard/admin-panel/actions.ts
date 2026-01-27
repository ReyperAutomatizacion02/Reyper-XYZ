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
    "operador",
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
export async function approveUser(userId: string, roles: string[], operatorName?: string) {
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
            operator_name: operatorName || null,
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
export async function updateUserRoles(userId: string, newRoles: string[], operatorName?: string) {
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
            operator_name: operatorName || null,
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

export type Employee = {
    id: string;
    full_name: string;
    employee_number: string | null;
    department: string | null;
    position: string | null;
    is_operator: boolean | null;
    is_active: boolean | null;
    created_at: string;
    updated_at: string;
}

export async function getEmployees() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) {
        console.error("Error fetching employees:", error);
        return [];
    }

    return employees as Employee[];
}

export async function upsertEmployee(data: Partial<Employee>) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    // Filter out only valid columns to avoid errors if extra props are passed
    const payload: any = {
        full_name: data.full_name,
        employee_number: data.employee_number || null,
        department: data.department || null,
        position: data.position || null,
        is_operator: data.is_operator ?? false,
        is_active: data.is_active ?? true,
        updated_at: new Date().toISOString(),
    };

    if (data.id) {
        payload.id = data.id;
    } else {
        // New record
        payload.created_at = new Date().toISOString();
    }

    const { data: result, error } = await supabase
        .from("employees")
        .upsert(payload)
        .select()
        .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/admin-panel");
    return { success: true, data: result };
}

export async function deleteEmployee(id: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}
