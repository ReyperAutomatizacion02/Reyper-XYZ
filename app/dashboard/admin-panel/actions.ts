"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
    ApproveUserSchema,
    RejectUserSchema,
    UpdateUserRolesSchema,
    UpsertEmployeeSchema,
    DeleteEmployeeSchema,
} from "@/lib/validations/admin";

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
    const parsed = ApproveUserSchema.parse({ userId, roles, operatorName });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    const { error } = await supabase
        .from("user_profiles")
        .update({
            is_approved: true,
            roles: parsed.roles,
            operator_name: parsed.operatorName || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.userId);

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

export async function rejectUser(userId: string) {
    const parsed = RejectUserSchema.parse({ userId });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", parsed.userId);

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

// Update user roles (accepts array)
export async function updateUserRoles(userId: string, newRoles: string[], operatorName?: string) {
    const parsed = UpdateUserRolesSchema.parse({ userId, newRoles, operatorName });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    // Prevent removing admin from self if last admin
    if (parsed.userId === user.id && !parsed.newRoles.includes("admin")) {
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
            roles: [...parsed.newRoles],
            operator_name: parsed.operatorName || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.userId);

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }

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

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }
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

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }
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
    created_at: string | null;
    updated_at: string | null;
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
    const parsed = UpsertEmployeeSchema.parse(data);
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const payload = {
        full_name: parsed.full_name,
        employee_number: parsed.employee_number || null,
        department: parsed.department || null,
        position: parsed.position || null,
        is_operator: parsed.is_operator,
        is_active: parsed.is_active,
        updated_at: new Date().toISOString(),
        ...(parsed.id ? { id: parsed.id } : { created_at: new Date().toISOString() }),
    };

    const { data: result, error } = await supabase
        .from("employees")
        .upsert(payload)
        .select()
        .single();

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }

    revalidatePath("/dashboard/admin-panel");
    return { success: true, data: result };
}

export async function deleteEmployee(id: string) {
    const parsed = DeleteEmployeeSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", parsed.id);

    if (error) { console.error("[admin]", error.message); throw new Error("Error en la operación. Intenta de nuevo."); }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}
