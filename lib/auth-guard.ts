"use server";

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verificación de autenticación para Server Actions.
 * Lanza un error si el usuario no está autenticado.
 * 
 * @returns El usuario autenticado.
 */
export async function requireAuth(supabase: SupabaseClient) {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("No autenticado");
    }

    return user;
}

/**
 * Verificación de autenticación + autorización por rol.
 * Lanza un error si el usuario no está autenticado o no tiene
 * al menos uno de los roles permitidos.
 * 
 * @param supabase - Instancia del cliente Supabase (con cookies del request).
 * @param allowedRoles - Roles que tienen permiso. "admin" siempre tiene acceso.
 * @returns `{ user, profile }` si la verificación es exitosa.
 */
export async function requireRole(supabase: SupabaseClient, allowedRoles: string[]) {
    const user = await requireAuth(supabase);

    const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("roles, is_approved")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        throw new Error("Perfil de usuario no encontrado");
    }

    if (!profile.is_approved) {
        throw new Error("Usuario no aprobado");
    }

    const userRoles: string[] = profile.roles || [];

    // Admin siempre tiene acceso
    if (userRoles.includes("admin")) {
        return { user, profile };
    }

    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const hasAccess = userRoles.some(role => allowedRoles.includes(role));

    if (!hasAccess) {
        throw new Error("No autorizado");
    }

    return { user, profile };
}
