"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * Calculates the next project code for a specific client prefix.
 * Looks for codes in the format "{clientPrefix}-{sequence}" (e.g., "85-1230").
 */
export async function getNextProjectCode(clientPrefix: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all project codes starting with the prefix
    const { data, error } = await supabase
        .from("projects")
        .select("code")
        .ilike("code", `${clientPrefix}-%`);

    if (error) {
        console.error("Error fetching project codes:", error);
        throw new Error("Error al consultar códigos de proyecto.");
    }

    if (!data || data.length === 0) {
        return `${clientPrefix}-0001`;
    }

    let maxSequence = 0;
    // Match codes like "PREFIX-0001" or "PREFIX-123"
    const regex = new RegExp(`^${clientPrefix}-(\\d+)$`);

    data.forEach((row) => {
        const match = row.code.match(regex);
        if (match) {
            const seq = parseInt(match[1], 10);
            if (!isNaN(seq) && seq > maxSequence) {
                maxSequence = seq;
            }
        }
    });

    const nextSequence = maxSequence + 1;
    // We want at least 4 digits, but if it goes beyond (e.g. 10000) it shouldn't cut off
    const nextSequenceStr = nextSequence.toString().padStart(4, "0");

    return `${clientPrefix}-${nextSequenceStr}`;
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
            status: projectData.status
        })
        .select("id")
        .single();

    if (projError) {
        console.error("Error creating project:", projError);
        throw new Error(`Error al crear proyecto: ${projError.message}`);
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
            genral_status: "A0-NUEVO PROYECTO",
            status_id: '3f454811-5b77-4b11-ab75-458e20c5ae6e', // Fixed status ID
        }));

        const { error: itemsError } = await supabase
            .from("production_orders")
            .insert(itemsPayload);

        if (itemsError) {
            // If items fail, we log it. Ideally we'd delete the project too.
            await supabase.from("projects").delete().eq("id", project.id);
            console.error("Error creating items:", itemsError);
            throw new Error(`Error al crear partidas: ${itemsError.message}`);
        }
    }

    // 3. Update Quote Status if this project comes from a quote
    if (projectData.source_quote_id) {
        const { error: quoteUpdateError } = await supabase
            .from("sales_quotes")
            .update({ status: 'approved' })
            .eq("id", projectData.source_quote_id);

        if (quoteUpdateError) {
            console.error("Error updating quote status:", quoteUpdateError);
            // We don't throw error to not fail the project creation, 
            // but we log it. It could be handled via webhook or manually.
        }
    }

    return { success: true, projectId: project.id };
}
