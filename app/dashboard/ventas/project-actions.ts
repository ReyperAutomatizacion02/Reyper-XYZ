"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ClientPrefixSchema, CreateProjectSchema, CreateProjectItemSchema } from "@/lib/validations/sales";
import { STATUS_IDS } from "@/lib/constants/status";

export async function getNextProjectCode(clientPrefix: string) {
    const parsed = ClientPrefixSchema.parse({ clientPrefix });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Atomic code generation via PostgreSQL advisory lock — prevents race conditions
    // under concurrent inserts for the same client prefix.
    const { data, error } = await (supabase as any).rpc("get_next_project_code", {
        p_prefix: parsed.clientPrefix,
    });

    if (error) {
        console.error("Error generating project code:", error);
        throw new Error("Error al generar código de proyecto.");
    }

    return data as string;
}

/**
 * Creates a new project and its associated production orders (items).
 */
export async function createProjectAndItems(
    projectData: {
        code: string;
        name: string;
        client_id: string;
        company_name: string;
        requestor: string;
        requestor_id?: string;
        start_date: string;
        delivery_date: string;
        status: string;
        source_quote_id?: string;
    },
    items: Array<{
        part_code: string;
        part_name: string;
        quantity: number;
        unit?: string;
        design_no?: string;
        material?: string;
        material_id?: string;
        treatment_id?: string;
        treatment_name?: string;
        treatment?: string;
        image?: string;
        drawing_url?: string;
        is_sub_item?: boolean;
        description?: string;
    }>
) {
    const parsedProject = CreateProjectSchema.parse(projectData);
    const parsedItems = items.map((item) => CreateProjectItemSchema.parse(item));
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Create Project
    const { data: project, error: projError } = await supabase
        .from("projects")
        .insert({
            code: projectData.code,
            name: projectData.name,
            company: projectData.company_name,
            company_id: projectData.client_id, // Added company_id
            requestor: projectData.requestor,
            requestor_id: projectData.requestor_id,
            start_date: projectData.start_date,
            delivery_date: projectData.delivery_date,
            status: projectData.status,
        })
        .select("id")
        .single();

    if (projError) {
        console.error("Error creating project:", projError);
        throw new Error("Error al crear el proyecto.");
    }

    // 2. Create Items
    if (items.length > 0) {
        const itemsPayload = items.map((item) => ({
            project_id: project.id,
            part_code: item.part_code,
            part_name: item.part_name,
            quantity: item.quantity,
            material: item.material,
            material_id: item.material_id,
            treatment_id: item.treatment_id,
            treatment: item.treatment_name || item.treatment, // Ensure we check both names
            description: item.description,
            image: item.image,
            drawing_url: item.drawing_url,
            unit: item.unit,
            design_no: item.design_no,
            is_sub_item: item.is_sub_item || false,
            general_status: "A0-NUEVO PROYECTO",
            status_id: STATUS_IDS.NUEVO_PROYECTO,
        }));

        const { error: itemsError } = await supabase.from("production_orders").insert(itemsPayload);

        if (itemsError) {
            // If items fail, we log it. Ideally we'd delete the project too.
            await supabase.from("projects").delete().eq("id", project.id);
            console.error("Error creating items:", itemsError);
            throw new Error("Error al crear las partidas del proyecto.");
        }
    }

    // 3. Update Quote Status if this project comes from a quote
    if (projectData.source_quote_id) {
        const { error: quoteUpdateError } = await supabase
            .from("sales_quotes")
            .update({ status: "approved" })
            .eq("id", projectData.source_quote_id);

        if (quoteUpdateError) {
            console.error("Error updating quote status:", quoteUpdateError);
            // We don't throw error to not fail the project creation,
            // but we log it. It could be handled via webhook or manually.
        }
    }

    return { success: true, projectId: project.id };
}
