"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
    ConvertQuoteToProjectSchema,
    UpdateProjectSchema,
    UpdateProductionOrderSchema,
    CatalogEntrySchema,
    ClientEntrySchema,
    UpdateClientSchema,
    ContactEntrySchema,
    UpdateContactSchema,
    ContactBatchSchema,
    IdSchema,
    SaveQuoteSchema,
    UpdateQuoteSchema as UpdateQuoteValidation,
    DeleteQuoteSchema,
    QuoteStatusSchema,
} from "@/lib/validations/sales";
import { QUOTE_STATUS, ITEM_STATUS } from "@/lib/constants/status";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { deleteQuoteFilesInternal } from "@/lib/storage-utils";

const VENTAS_ROLES = ["admin", "ventas"];

// --- CREATE ACTIONS ---

export async function createClientEntry(
    name: string,
    prefix?: string,
    business_name?: string,
    is_active: boolean = true
) {
    const parsed = ClientEntrySchema.parse({ name, prefix, business_name, is_active });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_clients").insert(parsed).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createContactEntry(name: string, client_id?: string, is_active: boolean = true) {
    const parsed = ContactEntrySchema.parse({ name, client_id, is_active });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_contacts").insert(parsed).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createContactBatch(names: string[], client_id?: string, is_active: boolean = true) {
    const parsed = ContactBatchSchema.parse({ names, client_id, is_active });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    const records = parsed.names.map((name) => ({
        name,
        client_id: parsed.client_id,
        is_active: parsed.is_active,
    }));

    const { error } = await supabase.from("sales_contacts").insert(records);
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

export async function updateClientEntry(
    id: string,
    name: string,
    prefix?: string | null,
    business_name?: string | null,
    is_active: boolean = true
) {
    const parsed = UpdateClientSchema.parse({ id, name, prefix, business_name, is_active });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { error } = await supabase
        .from("sales_clients")
        .update({
            name: parsed.name,
            prefix: parsed.prefix,
            business_name: parsed.business_name,
            is_active: parsed.is_active,
        })
        .eq("id", parsed.id);
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

export async function deleteClientEntry(id: string) {
    const { id: validId } = IdSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { error } = await supabase.from("sales_clients").delete().eq("id", validId);
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

export async function updateContactEntry(
    id: string,
    name: string,
    client_id?: string | null,
    is_active: boolean = true
) {
    const parsed = UpdateContactSchema.parse({ id, name, client_id, is_active });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { error } = await supabase
        .from("sales_contacts")
        .update({ name: parsed.name, client_id: parsed.client_id, is_active: parsed.is_active })
        .eq("id", parsed.id);
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

export async function deleteContactEntry(id: string) {
    const { id: validId } = IdSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { error } = await supabase.from("sales_contacts").delete().eq("id", validId);
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

export async function createPositionEntry(name: string) {
    const parsed = CatalogEntrySchema.parse({ name });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_positions").insert({ name: parsed.name }).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createAreaEntry(name: string) {
    const parsed = CatalogEntrySchema.parse({ name });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_areas").insert({ name: parsed.name }).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createUnitEntry(name: string) {
    const parsed = CatalogEntrySchema.parse({ name });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_units").insert({ name: parsed.name }).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createMaterialEntry(name: string) {
    const parsed = CatalogEntrySchema.parse({ name });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase.from("sales_materials").insert({ name: parsed.name }).select("id").single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function createTreatmentEntry(name: string) {
    const parsed = CatalogEntrySchema.parse({ name });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);
    const { data, error } = await supabase
        .from("production_treatments")
        .insert({ name: parsed.name })
        .select("id")
        .single();
    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data?.id;
}

export async function saveQuote(quoteData: Record<string, unknown>, items: Record<string, unknown>[]) {
    const parsed = SaveQuoteSchema.parse({ quoteData, items });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    // 1. Insert Quote
    const { data: quote, error: quoteError } = await supabase
        .from("sales_quotes")
        .insert({
            ...parsed.quoteData,
        })
        .select("id, quote_number")
        .single();

    if (quoteError) {
        console.error("[ventas] saveQuote:", quoteError.message);
        throw new Error("Error al guardar la cotización.");
    }

    // 2. Insert Items
    const itemsWithQuoteId = parsed.items.map((item, index) => ({
        ...item,
        quote_id: quote.id,
        sort_order: index,
    }));

    if (itemsWithQuoteId.length > 0) {
        const { error: itemsError } = await supabase.from("sales_quote_items").insert(itemsWithQuoteId);
        if (itemsError) {
            // Optional: Delete quote if items fail
            await supabase.from("sales_quotes").delete().eq("id", quote.id);
            console.error("[ventas] saveQuote items:", itemsError.message);
            throw new Error("Error al guardar las partidas de la cotización.");
        }
    }

    return { id: quote.id, quote_number: quote.quote_number };
}

// --- FETCH ACTIONS ---

export async function getCatalogData() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const [clients, contacts, positions, areas, units, materials, statuses, treatments] = await Promise.all([
        supabase.from("sales_clients").select("id, name, prefix, business_name, is_active").order("name"),
        supabase.from("sales_contacts").select("id, name, client_id, is_active").order("name"),
        supabase.from("sales_positions").select("id, name").order("name"),
        supabase.from("sales_areas").select("id, name").order("name"),
        supabase.from("sales_units").select("id, name").order("name"),
        supabase.from("sales_materials").select("id, name").order("name"),
        supabase.from("production_statuses").select("id, name").order("name"),
        supabase.from("production_treatments").select("id, name").order("name"),
    ]);

    return {
        clients: clients.data || [],
        contacts: contacts.data || [],
        positions: positions.data || [],
        areas: areas.data || [],
        units: units.data || [],
        materials: materials.data || [],
        statuses: statuses.data || [],
        treatments: treatments.data || [],
    };
}

export async function getQuotesHistory() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data, error } = await supabase
        .from("sales_quotes")
        .select(
            `
            id,
            quote_number,
            issue_date,
            total,
            currency,
            status,
            quote_type,
            client:sales_clients(name),
            contact:sales_contacts(name)
        `
        )
        .in("status", ["active", "approved", "cancelled"])
        .order("quote_number", { ascending: false });

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return data;
}

export async function getActiveProjects() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data, error } = await supabase
        .from("projects")
        .select(
            `
            id, 
            code, 
            name, 
            company, 
            requestor, 
            start_date, 
            delivery_date, 
            status,
            requestor_id,
            company_id,
            production_orders(id)
        `
        )
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    return (data ?? []).map((project) => ({
        ...project,
        parts_count: project.production_orders?.length || 0,
    }));
}

export async function getAuditData() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select(
            `
            id, 
            code, 
            name, 
            company, 
            requestor, 
            start_date, 
            delivery_date, 
            status,
            requestor_id,
            company_id,
            production_orders (
                id,
                part_code,
                part_name,
                quantity,
                general_status,
                material,
                material_id,
                status_id,
                unit,
                treatment,
                treatment_id,
                design_no,
                drawing_url,
                model_url,
                render_url
            )
        `
        )
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    if (projectsError) throw new Error(projectsError.message);

    return projects;
}

export async function getFilterOptions() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const [companiesResult, requestorsResult] = await Promise.all([
        client.rpc("get_distinct_active_companies") as Promise<{ data: { company: string }[] | null }>,
        client.rpc("get_distinct_active_requestors") as Promise<{ data: { requestor: string }[] | null }>,
    ]);

    return {
        clients: (companiesResult.data ?? []).map((r) => r.company),
        requestors: (requestorsResult.data ?? []).map((r) => r.requestor),
    };
}

export async function getProjectDetails(projectId: string) {
    const { id: validId } = IdSchema.parse({ id: projectId });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data: items, error } = await supabase
        .from("production_orders")
        .select(
            "id, part_code, part_name, quantity, general_status, image, material, material_id, status_id, unit, treatment, treatment_id, production_treatments(name), design_no, urgencia, drawing_url, model_url, render_url, material_confirmation"
        )
        .eq("project_id", validId)
        .order("part_code", { ascending: true });

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return items.map((item) => ({ ...item, status: item.general_status }));
}

export async function getQuoteById(id: string) {
    const { id: validId } = IdSchema.parse({ id });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data: quote, error } = await supabase
        .from("sales_quotes")
        .select("*, client:sales_clients(name), contact:sales_contacts(name), sales_quote_items(*)")
        .eq("id", validId)
        .single();

    if (error) throw new Error(error.message);

    // Rename embedded relation to `items` for backward compatibility, and sort by sort_order
    const items = (quote.sales_quote_items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const { sales_quote_items: _, ...rest } = quote;
    return { ...rest, items };
}

export async function updateQuote(id: string, quoteData: Record<string, unknown>, items: Record<string, unknown>[]) {
    const parsed = UpdateQuoteValidation.parse({ id, quoteData, items });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    // 1. Get old items to check for orphaned drawings
    const { data: oldItems } = await supabase.from("sales_quote_items").select("drawing_url").eq("quote_id", id);

    // 2. Update Quote Info
    const { error: quoteError } = await supabase
        .from("sales_quotes")
        .update({
            ...parsed.quoteData,
        })
        .eq("id", parsed.id);

    if (quoteError) {
        console.error("[ventas] updateQuote:", quoteError.message);
        throw new Error("Error al actualizar la cotización.");
    }

    // 3. Delete old items and insert fresh ones (Simplest way to sync)
    await supabase.from("sales_quote_items").delete().eq("quote_id", parsed.id);

    const itemsWithQuoteId = parsed.items.map((item, index) => ({
        ...item,
        quote_id: parsed.id,
        sort_order: index,
    }));

    if (itemsWithQuoteId.length > 0) {
        const { error: itemsError } = await supabase.from("sales_quote_items").insert(itemsWithQuoteId);
        if (itemsError) {
            console.error("[ventas] updateQuote items:", itemsError.message);
            throw new Error("Error al actualizar las partidas.");
        }
    }

    // 4. Cleanup orphaned storage files
    if (oldItems && oldItems.length > 0) {
        // Function to extract the actual storage path from various Supabase URL formats
        const getFilename = (url: any): string | null => {
            if (!url || typeof url !== "string") return null;
            try {
                // Remove everything before the last slash and strip query/fragments
                const clean = decodeURIComponent(url).split(/[?#]/)[0];
                return clean.split("/").pop() || null;
            } catch (e) {
                return null;
            }
        };

        const oldFiles = oldItems.map((i) => getFilename(i.drawing_url)).filter(Boolean) as string[];
        const newFiles = parsed.items.map((i) => getFilename(i.drawing_url)).filter(Boolean) as string[];

        // SAFETY CHECK: If the UI has items with drawings, but we couldn't parse ANY of them,
        // or if our extraction count doesn't match the items with drawings, abort to be safe.
        const itemsWithRemoteDrawings = parsed.items.filter(
            (i) => i.drawing_url && !i.drawing_url.startsWith("blob:") && !i.drawing_url.startsWith("data:")
        );

        if (itemsWithRemoteDrawings.length > 0 && newFiles.length < itemsWithRemoteDrawings.length) {
            console.error("Storage cleanup aborted: Could not parse all referenced drawing filenames correctly.");
            return { id };
        }

        const filesToDelete = oldFiles.filter((f) => !newFiles.includes(f));

        if (filesToDelete.length > 0) {
            const pathsToDelete = filesToDelete.map((f) => `${id}/${f}`);
            const { error: storageError } = await supabase.storage.from("quotes").remove(pathsToDelete);

            if (storageError) {
                console.error("Error cleaning up orphaned storage files:", storageError);
            }
        }
    }

    return { id: parsed.id };
}

export async function deleteQuote(id: string, reason: string) {
    const parsed = DeleteQuoteSchema.parse({ id, reason });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    // Solo hacemos el soft delete (cambio de estado).
    // La eliminación física de archivos será manejada por un Webhook de DB (Hard Delete).
    const { error } = await supabase
        .from("sales_quotes")
        .update({
            status: "deleted",
            deleted_at: new Date().toISOString(),
            deleted_reason: parsed.reason,
        })
        .eq("id", parsed.id);

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}

/**
 * Server action: Deletes all files in the storage bucket for a specific quote.
 * Requires authenticated user with ventas/admin role.
 * Verifies the quote exists and is accessible to the user before delegating to admin deletion.
 */
export async function deleteQuoteFiles(quoteId: string) {
    const { id: validQuoteId } = IdSchema.parse({ id: quoteId });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    // Verificar que la cotización existe y es accesible (RLS aplica aquí)
    const { data: quote } = await supabase.from("sales_quotes").select("id").eq("id", validQuoteId).single();

    if (!quote) {
        throw new Error("Cotización no encontrada o sin permisos.");
    }

    await deleteQuoteFilesInternal(validQuoteId);
}

export async function getNextProjectCode(clientPrefix: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireAuth(supabase);

    const { data, error } = await supabase
        .from("projects")
        .select("code")
        .like("code", `${clientPrefix}-%`)
        .order("code", { ascending: false })
        .limit(1);

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }

    let nextNum = 1;
    if (data && data.length > 0) {
        const lastCode = data[0].code;
        const lastNum = parseInt(lastCode.split("-")[1]);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }

    return `${clientPrefix}-${String(nextNum).padStart(4, "0")}`;
}

export async function convertQuoteToProject(
    quoteId: string,
    projectName?: string,
    partNames?: { quoteItemId: string; name: string }[] // NEW PARAM
) {
    try {
        // Zod validation
        const parsedData = ConvertQuoteToProjectSchema.safeParse({
            quote_id: quoteId,
            client_prefix: "TEMP",
            company_name: "TEMP",
        });

        if (!parsedData.success) {
            console.error("Validation error converting quote:", parsedData.error);
            return { success: false, error: "Datos de entrada inválidos." };
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        await requireRole(supabase, VENTAS_ROLES);

        // 1. Get Quote and Items
        const quote = await getQuoteById(quoteId);
        if (!quote) throw new Error("Cotización no encontrada.");
        if (quote.status === QUOTE_STATUS.APPROVED) throw new Error("La cotización ya fue aprobada.");
        if (!quote.client_id) throw new Error("La cotización no tiene un cliente asignado.");
        if (!quote.contact_id) throw new Error("La cotización no tiene un contacto asignado.");

        // 2. Get Client Prefix
        const { data: client, error: clientError } = await supabase
            .from("sales_clients")
            .select("name, prefix")
            .eq("id", quote.client_id)
            .single();

        if (clientError || !client || !client.prefix) throw new Error("Prefijo de cliente no encontrado.");

        const projectCode = await getNextProjectCode(client.prefix);
        const finalProjectName = projectName || `COT-${quote.quote_number}`;

        // 3. Get Contact Name
        const { data: contact, error: contactError } = await supabase
            .from("sales_contacts")
            .select("name")
            .eq("id", quote.contact_id)
            .single();

        if (contactError) {
            console.error("[ventas] convertQuote contact:", contactError.message);
            throw new Error("Nombre de contacto no encontrado.");
        }

        // 4. Create Project
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .insert({
                code: projectCode,
                name: finalProjectName,
                company: client.name,
                company_id: quote.client_id,
                requestor: contact.name, // Store Name in requestor
                requestor_id: quote.contact_id, // Store ID in new column
                start_date: new Date().toISOString().split("T")[0],
                delivery_date: quote.delivery_date,
                status: "active",
            })
            .select("id")
            .single();

        if (projectError) {
            console.error("[ventas] convertQuote project:", projectError.message);
            throw new Error("Error al crear el proyecto.");
        }

        // 5. Transform Quote Items to Production Orders
        let parentCounter = 0;
        let childCounter = 0;

        const productionOrders = quote.items.map((item: any) => {
            if (!item.is_sub_item) {
                parentCounter++;
                childCounter = 0;
            } else {
                childCounter++;
            }

            const lotPart = String(parentCounter).padStart(2, "0");
            const subPart = String(childCounter).padStart(2, "0");
            const partCode = `${projectCode}-${lotPart}.${subPart}`;

            // Find custom name if provided, else use description
            const customPartNameObj = partNames?.find((pn) => pn.quoteItemId === item.id);
            const finalPartName =
                customPartNameObj?.name && customPartNameObj.name.trim() !== ""
                    ? customPartNameObj.name
                    : item.description;

            return {
                project_id: project.id,
                part_code: partCode,
                part_name: finalPartName, // USE CUSTOM OR FALLBACK
                quantity: item.quantity,
                material: "POR DEFINIR", // Default
                general_status: ITEM_STATUS.RE_ORDER_POINT, // Default start status uses constant
                design_no: item.design_no,
                drawing_url: item.drawing_url,
                unit: item.unit,
            };
        });

        if (productionOrders.length > 0) {
            const { error: itemsError } = await supabase.from("production_orders").insert(productionOrders);
            if (itemsError) {
                console.error("[ventas] convertQuote items:", itemsError.message);
                throw new Error("Error al crear las partidas del proyecto.");
            }
        }

        // 6. Mark Quote as Approved
        const { error: updateError } = await supabase
            .from("sales_quotes")
            .update({ status: QUOTE_STATUS.APPROVED })
            .eq("id", quoteId);
        if (updateError) {
            console.error("[ventas] convertQuote status:", updateError.message);
            throw new Error("Error al actualizar el estatus de la cotización.");
        }

        return { success: true, projectCode, projectId: project.id };
    } catch (e: any) {
        console.error("[ventas] convertQuoteToProject:", e.message);
        return {
            success: false,
            error:
                e.message?.startsWith("Error") ||
                e.message?.includes("cotización") ||
                e.message?.includes("cliente") ||
                e.message?.includes("contacto")
                    ? e.message
                    : "Error al convertir la cotización a proyecto.",
        };
    }
}

export async function updateQuoteStatus(id: string, status: string) {
    const parsed = QuoteStatusSchema.parse({ id, status });
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await requireRole(supabase, VENTAS_ROLES);

    const { error } = await supabase.from("sales_quotes").update({ status: parsed.status }).eq("id", parsed.id);

    if (error) {
        console.error("[ventas]", error.message);
        throw new Error("Error en la operación. Intenta de nuevo.");
    }
    return { success: true };
}
export async function updateProject(
    id: string,
    data: {
        name?: string;
        start_date?: string;
        delivery_date?: string;
        status?: string;
        company?: string;
        company_id?: string;
        requestor?: string;
        requestor_id?: string;
    }
) {
    try {
        const parsedData = UpdateProjectSchema.safeParse({ id, ...data });
        if (!parsedData.success) {
            console.error("Validation error in updateProject:", parsedData.error);
            return { success: false, error: "Datos del proyecto requeridos o inválidos." };
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        await requireRole(supabase, VENTAS_ROLES);

        const { id: validId, ...safeFields } = parsedData.data;
        const { error } = await supabase.from("projects").update(safeFields).eq("id", validId);

        if (error) {
            console.error("[ventas]", error.message);
            throw new Error("Error en la operación. Intenta de nuevo.");
        }
        return { success: true };
    } catch (e: any) {
        console.error("[ventas] updateProject:", e.message);
        return { success: false, error: "Error al actualizar el proyecto." };
    }
}

export async function updateProductionOrder(
    id: string,
    data: {
        part_name?: string;
        material?: string;
        quantity?: number;
        general_status?: string;
        treatment_id?: string | null;
        treatment_name?: string | null;
        urgencia?: boolean;
        image?: string | null;
        drawing_url?: string | null;
        model_url?: string | null;
        render_url?: string | null;
        material_confirmation?: string | null;
    }
) {
    try {
        const parsedData = UpdateProductionOrderSchema.safeParse({ id, ...data });
        if (!parsedData.success) {
            console.error("Validation error in updateProductionOrder:", parsedData.error);
            return { success: false, error: "Datos de la partida requeridos o inválidos." };
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        await requireRole(supabase, VENTAS_ROLES);

        const { id: validId, ...safeFields } = parsedData.data;
        const { error } = await supabase.from("production_orders").update(safeFields).eq("id", validId);

        if (error) {
            console.error("[ventas]", error.message);
            throw new Error("Error en la operación. Intenta de nuevo.");
        }
        return { success: true };
    } catch (e: any) {
        console.error("[ventas] updateProductionOrder:", e.message);
        return { success: false, error: "Error al actualizar la partida." };
    }
}
