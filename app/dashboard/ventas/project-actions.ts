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
    const padding = Math.max(4, nextSequence.toString().length);
    const nextSequenceStr = nextSequence.toString().padStart(padding, "0");

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
        start_date: string;
        delivery_date: string;
        status: string;
    },
    items: Array<{
        part_code: string;
        part_name: string;
        quantity: number;
        unit?: string;
        design_no?: string;
        material?: string;
        image?: string;
        drawing_url?: string;
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
            company: projectData.company_name, // Mapping client name to text column
            requestor: projectData.requestor,
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
            image: item.image,
            drawing_url: item.drawing_url,
            unit: item.unit,
            design_no: item.design_no,
            genral_status: "A1-INGENIERIA",
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

    return { success: true, projectId: project.id };
}
