"use server";

import { createClient } from "@/utils/supabase/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
    ApproveUserSchema,
    RejectUserSchema,
    UpdateUserRolesSchema,
    UpsertEmployeeSchema,
    DeleteEmployeeSchema,
    UpsertWorkShiftSchema,
    DeleteWorkShiftSchema,
} from "@/lib/validations/admin";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/config/permissions";

/** Derive default permissions from roles. Used as a safety net so permissions
 *  is never saved as an empty array when roles are present. */
function deriveDefaultPermissions(roles: string[]): string[] {
    return Array.from(new Set(roles.flatMap((r) => ROLE_DEFAULT_PERMISSIONS[r] || [])));
}

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

type ValidRole = (typeof VALID_ROLES)[number];

// Helper to check if caller is admin
async function verifyAdmin(supabase: SupabaseClient, userId: string) {
    const { data: callerProfile, error } = await supabase
        .from("user_profiles")
        .select("roles")
        .eq("id", userId)
        .single();

    if (error || !callerProfile?.roles?.includes("admin")) {
        throw new Error("No autorizado");
    }
}

// Approve user with multiple roles and permissions
export async function approveUser(userId: string, roles: string[], permissions: string[], operatorName?: string) {
    const parsed = ApproveUserSchema.parse({ userId, roles, permissions, operatorName });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    // If no explicit permissions were provided, derive from roles so the new
    // permissions system always has something to work with (never saves []).
    const effectivePermissions =
        parsed.permissions.length > 0 ? parsed.permissions : deriveDefaultPermissions(parsed.roles);

    const { error } = await supabase
        .from("user_profiles")
        .update({
            is_approved: true,
            roles: parsed.roles,
            permissions: effectivePermissions,
            operator_name: parsed.operatorName || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.userId);

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

export async function rejectUser(userId: string) {
    const parsed = RejectUserSchema.parse({ userId });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    const { error } = await supabase.from("user_profiles").delete().eq("id", parsed.userId);

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

// Update user roles and permissions
export async function updateUserRoles(
    userId: string,
    newRoles: string[],
    permissions: string[],
    operatorName?: string
) {
    const parsed = UpdateUserRolesSchema.parse({ userId, newRoles, permissions, operatorName });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    await verifyAdmin(supabase, user.id);

    // Prevent removing admin from self if last admin
    if (parsed.userId === user.id && !parsed.newRoles.includes("admin")) {
        const { data: adminUsers } = await supabase.from("user_profiles").select("id").contains("roles", ["admin"]);

        if (adminUsers && adminUsers.length <= 1) {
            throw new Error("No puedes quitar el último administrador");
        }
    }

    // Guard: never save empty permissions — derive from roles if needed.
    const effectivePermissions =
        parsed.permissions.length > 0 ? parsed.permissions : deriveDefaultPermissions(parsed.newRoles);

    const { error } = await supabase
        .from("user_profiles")
        .update({
            roles: [...parsed.newRoles],
            permissions: effectivePermissions,
            operator_name: parsed.operatorName || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.userId);

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

/** Migrate a legacy user (permissions === null) to the new permissions system
 *  by assigning the default permissions for their current roles. */
export async function migrateUserToPermissions(userId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { data: profile, error: fetchError } = await supabase
        .from("user_profiles")
        .select("roles, permissions")
        .eq("id", userId)
        .single();

    if (fetchError || !profile) throw new Error("Usuario no encontrado");
    if (profile.permissions !== null) return { success: true, alreadyMigrated: true };

    const { ROLE_DEFAULT_PERMISSIONS } = await import("@/lib/config/permissions");
    const defaultPermissions = Array.from(
        new Set((profile.roles || []).flatMap((r: string) => ROLE_DEFAULT_PERMISSIONS[r] || []))
    );

    const { error } = await supabase
        .from("user_profiles")
        .update({ permissions: defaultPermissions, updated_at: new Date().toISOString() })
        .eq("id", userId);

    if (error) throw new Error("Error al migrar permisos");

    revalidatePath("/dashboard/admin-panel");
    return { success: true, alreadyMigrated: false };
}

/** Bulk-migrate all approved users that still have permissions === null.
 *  Returns the count of users migrated. */
export async function migrateAllLegacyUsers(): Promise<{ migrated: number }> {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { data: legacyUsers, error: fetchError } = await supabase
        .from("user_profiles")
        .select("id, roles")
        .eq("is_approved", true)
        .is("permissions", null);

    if (fetchError) throw new Error("Error al obtener usuarios legacy");
    if (!legacyUsers || legacyUsers.length === 0) return { migrated: 0 };

    let migrated = 0;
    for (const profile of legacyUsers) {
        const defaultPermissions = deriveDefaultPermissions(profile.roles || []);
        const { error } = await supabase
            .from("user_profiles")
            .update({ permissions: defaultPermissions, updated_at: new Date().toISOString() })
            .eq("id", profile.id);
        if (!error) migrated++;
    }

    revalidatePath("/dashboard/admin-panel");
    return { migrated };
}

export async function getPendingUsers() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data;
}

export async function getApprovedUsers() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
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
};

export async function getEmployees() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { data: employees, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name", { ascending: true });

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

    const {
        data: { user },
    } = await supabase.auth.getUser();
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

    const { data: result, error } = await supabase.from("employees").upsert(payload).select().single();

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    return { success: true, data: result };
}

export async function deleteEmployee(id: string) {
    const parsed = DeleteEmployeeSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { error } = await supabase.from("employees").delete().eq("id", parsed.id);

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    return { success: true };
}

// ── Work Shifts ───────────────────────────────────────────────────────────────

export type WorkShiftRow = {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    active: boolean;
    sort_order: number;
    created_at: string | null;
};

export async function upsertWorkShift(data: Partial<WorkShiftRow>) {
    const parsed = UpsertWorkShiftSchema.parse(data);
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const payload = {
        name: parsed.name,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        days_of_week: parsed.days_of_week,
        active: parsed.active,
        sort_order: parsed.sort_order,
        ...(parsed.id ? { id: parsed.id } : {}),
    };

    const { data: result, error } = await supabase.from("work_shifts").upsert(payload).select().single();

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    revalidatePath("/dashboard/produccion/planeacion");
    return { success: true, data: result };
}

export async function deleteWorkShift(id: string) {
    const parsed = DeleteWorkShiftSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    await verifyAdmin(supabase, user.id);

    const { error } = await supabase.from("work_shifts").delete().eq("id", parsed.id);

    if (error) {
        console.error("[admin]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    revalidatePath("/dashboard/admin-panel");
    revalidatePath("/dashboard/produccion/planeacion");
    return { success: true };
}
