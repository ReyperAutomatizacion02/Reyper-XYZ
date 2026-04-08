"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/action-result";

const ALLOWED_ROLES = ["admin", "logistica"];

const TreatmentSchema = z.object({
    name: z.string().min(1, "El nombre es requerido").max(200),
    avg_lead_days: z.coerce.number().min(0).default(1),
    suppliers: z.array(z.string().min(1)).default([]),
});

export type Treatment = {
    id: string;
    name: string;
    avg_lead_days: number;
    suppliers: string[];
    created_at: string;
    usage_count: number;
};

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getTreatments(): Promise<ActionResult<Treatment[]>> {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    try {
        await requireRole(supabase, ALLOWED_ROLES);
    } catch {
        return { success: false, error: { code: "PERMISSION_DENIED" } };
    }

    const { data, error } = await supabase
        .from("production_treatments")
        .select(
            `
            id,
            name,
            avg_lead_days,
            suppliers,
            created_at,
            production_orders(id)
        `
        )
        .order("name", { ascending: true });

    if (error) {
        console.error("[logistica:tratamientos] getTreatments:", error.message);
        return { success: false, error: { code: "NETWORK_ERROR" } };
    }

    const treatments: Treatment[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        avg_lead_days: Number(row.avg_lead_days ?? 1),
        suppliers: row.suppliers ?? [],
        created_at: row.created_at,
        usage_count: Array.isArray(row.production_orders) ? row.production_orders.length : 0,
    }));

    return { success: true, data: treatments };
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createTreatment(
    name: string,
    avg_lead_days: number,
    suppliers: string[]
): Promise<ActionResult<Treatment>> {
    const parsed = TreatmentSchema.safeParse({ name, avg_lead_days, suppliers });
    if (!parsed.success) {
        return {
            success: false,
            error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string> },
        };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    try {
        await requireRole(supabase, ALLOWED_ROLES);
    } catch {
        return { success: false, error: { code: "PERMISSION_DENIED" } };
    }

    // Check duplicate name
    const { data: existing } = await supabase
        .from("production_treatments")
        .select("id")
        .ilike("name", parsed.data.name)
        .maybeSingle();

    if (existing) {
        return { success: false, error: { code: "CONFLICT", message: "Ya existe un tratamiento con ese nombre." } };
    }

    const { data, error } = await supabase
        .from("production_treatments")
        .insert(parsed.data)
        .select("id, name, avg_lead_days, suppliers, created_at")
        .single();

    if (error) {
        console.error("[logistica:tratamientos] createTreatment:", error.message);
        return { success: false, error: { code: "NETWORK_ERROR" } };
    }

    revalidatePath("/dashboard/logistica/tratamientos");

    return {
        success: true,
        data: { ...data, suppliers: data.suppliers ?? [], avg_lead_days: Number(data.avg_lead_days), usage_count: 0 },
    };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateTreatment(
    id: string,
    name: string,
    avg_lead_days: number,
    suppliers: string[]
): Promise<ActionResult<Treatment>> {
    const parsed = TreatmentSchema.safeParse({ name, avg_lead_days, suppliers });
    if (!parsed.success) {
        return {
            success: false,
            error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string> },
        };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    try {
        await requireRole(supabase, ALLOWED_ROLES);
    } catch {
        return { success: false, error: { code: "PERMISSION_DENIED" } };
    }

    // Check duplicate name (excluding current)
    const { data: existing } = await supabase
        .from("production_treatments")
        .select("id")
        .ilike("name", parsed.data.name)
        .neq("id", id)
        .maybeSingle();

    if (existing) {
        return { success: false, error: { code: "CONFLICT", message: "Ya existe un tratamiento con ese nombre." } };
    }

    const { data, error } = await supabase
        .from("production_treatments")
        .update(parsed.data)
        .eq("id", id)
        .select("id, name, avg_lead_days, suppliers, created_at")
        .single();

    if (error) {
        console.error("[logistica:tratamientos] updateTreatment:", error.message);
        return { success: false, error: { code: "NETWORK_ERROR" } };
    }

    revalidatePath("/dashboard/logistica/tratamientos");

    return {
        success: true,
        data: { ...data, suppliers: data.suppliers ?? [], avg_lead_days: Number(data.avg_lead_days), usage_count: 0 },
    };
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteTreatment(id: string): Promise<ActionResult<void>> {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    try {
        await requireRole(supabase, ALLOWED_ROLES);
    } catch {
        return { success: false, error: { code: "PERMISSION_DENIED" } };
    }

    // Check if referenced by any order
    const { count } = await supabase
        .from("production_orders")
        .select("id", { count: "exact", head: true })
        .eq("treatment_id", id);

    if (count && count > 0) {
        return {
            success: false,
            error: {
                code: "CONFLICT",
                message: `Este tratamiento está en uso en ${count} partida${count !== 1 ? "s" : ""} y no puede eliminarse.`,
            },
        };
    }

    const { error } = await supabase.from("production_treatments").delete().eq("id", id);

    if (error) {
        console.error("[logistica:tratamientos] deleteTreatment:", error.message);
        return { success: false, error: { code: "NETWORK_ERROR" } };
    }

    revalidatePath("/dashboard/logistica/tratamientos");
    return { success: true, data: undefined };
}
