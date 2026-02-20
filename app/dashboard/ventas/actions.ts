"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// --- CREATE ACTIONS ---

export async function createClientEntry(name: string, prefix?: string, business_name?: string, is_active: boolean = true) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_clients").insert({ name, prefix, business_name, is_active }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function createContactEntry(name: string, client_id?: string, is_active: boolean = true) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_contacts").insert({ name, client_id, is_active }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function createContactBatch(names: string[], client_id?: string, is_active: boolean = true) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!names || names.length === 0) return { success: false, error: "No names provided" };

    const records = names.map(name => ({
        name,
        client_id,
        is_active
    }));

    const { error } = await supabase.from("sales_contacts").insert(records);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function updateClientEntry(id: string, name: string, prefix?: string | null, business_name?: string | null, is_active: boolean = true) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.from("sales_clients").update({ name, prefix, business_name, is_active }).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function deleteClientEntry(id: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.from("sales_clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function updateContactEntry(id: string, name: string, client_id?: string | null, is_active: boolean = true) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.from("sales_contacts").update({ name, client_id, is_active }).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function deleteContactEntry(id: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.from("sales_contacts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}


export async function createPositionEntry(name: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_positions").insert({ name }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function createAreaEntry(name: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_areas").insert({ name }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function createUnitEntry(name: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_units").insert({ name }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function saveQuote(quoteData: any, items: any[]) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Insert Quote
    const { data: quote, error: quoteError } = await supabase
        .from("sales_quotes")
        .insert({
            ...quoteData,
        })
        .select("id, quote_number")
        .single();

    if (quoteError) throw new Error(quoteError.message);

    // 2. Insert Items
    const itemsWithQuoteId = items.map((item, index) => ({
        ...item,
        quote_id: quote.id,
        sort_order: index
    }));

    if (itemsWithQuoteId.length > 0) {
        const { error: itemsError } = await supabase.from("sales_quote_items").insert(itemsWithQuoteId);
        if (itemsError) {
            // Optional: Delete quote if items fail
            await supabase.from("sales_quotes").delete().eq("id", quote.id);
            throw new Error(itemsError.message);
        }
    }

    return { id: quote.id, quote_number: quote.quote_number };
}

// --- FETCH ACTIONS ---

export async function getCatalogData() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const [clients, contacts, positions, areas, units, materials, statuses, treatments] = await Promise.all([
        supabase.from("sales_clients").select("id, name, prefix, business_name, is_active").order("name"),
        supabase.from("sales_contacts").select("id, name, client_id, is_active").order("name"),
        supabase.from("sales_positions").select("id, name").order("name"),
        supabase.from("sales_areas").select("id, name").order("name"),
        supabase.from("sales_units").select("id, name").order("name"),
        supabase.from("sales_materials").select("id, name").order("name"),
        supabase.from("production_statuses").select("id, name").order("name"),
        supabase.from("production_treatments").select("id, name").order("name")
    ]);

    return {
        clients: clients.data || [],
        contacts: contacts.data || [],
        positions: positions.data || [],
        areas: areas.data || [],
        units: units.data || [],
        materials: materials.data || [],
        statuses: statuses.data || [],
        treatments: treatments.data || []
    };
}

export async function getQuotesHistory() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
        .from("sales_quotes")
        .select(`
            id,
            quote_number,
            issue_date,
            total,
            currency,
            status,
            quote_type,
            client:sales_clients(name),
            contact:sales_contacts(name)
        `)
        .in("status", ["active", "approved", "cancelled"])
        .order("quote_number", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

export async function getActiveProjects() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
        .from("projects")
        .select(`
            id, 
            code, 
            name, 
            company, 
            requestor, 
            start_date, 
            delivery_date, 
            status,
            requestor_id,
            company_id
        `)
        .eq("status", "active")
        .order("delivery_date", { ascending: true });

    if (error) throw new Error(error.message);

    return data;
}

export async function getFilterOptions() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch in parallel for performance
    const [clientsData, requestorsData] = await Promise.all([
        supabase.from("projects").select("company").eq("status", "active"),
        supabase.from("projects").select("requestor").eq("status", "active")
    ]);

    // Extract unique values
    const uniqueClients = Array.from(new Set(clientsData.data?.map(d => d.company).filter(Boolean))).sort();
    const uniqueRequestors = Array.from(new Set(requestorsData.data?.map(d => d.requestor).filter(Boolean))).sort();

    return {
        clients: uniqueClients,
        requestors: uniqueRequestors
    };
}

export async function getProjectDetails(projectId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: items, error } = await supabase
        .from("production_orders")
        .select("id, part_code, part_name, quantity, genral_status, image, material, material_id, status_id, unit, treatment, treatment_id, production_treatments(name), design_no, urgencia, drawing_url")
        .eq("project_id", projectId)
        .order("part_code", { ascending: true });

    if (error) throw new Error(error.message);
    return items.map((item: any) => ({ ...item, status: item.genral_status }));
}

export async function getQuoteById(id: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: quote, error: quoteError } = await supabase
        .from("sales_quotes")
        .select("*")
        .eq("id", id)
        .single();

    if (quoteError) throw new Error(quoteError.message);

    const { data: items, error: itemsError } = await supabase
        .from("sales_quote_items")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");

    if (itemsError) throw new Error(itemsError.message);

    return { ...quote, items };
}

export async function updateQuote(id: string, quoteData: any, items: any[]) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get old items to check for orphaned drawings
    const { data: oldItems } = await supabase
        .from("sales_quote_items")
        .select("drawing_url")
        .eq("quote_id", id);

    // 2. Update Quote Info
    const { error: quoteError } = await supabase
        .from("sales_quotes")
        .update({
            ...quoteData,
        })
        .eq("id", id);

    if (quoteError) throw new Error(quoteError.message);

    // 3. Delete old items and insert fresh ones (Simplest way to sync)
    await supabase.from("sales_quote_items").delete().eq("quote_id", id);

    const itemsWithQuoteId = items.map((item, index) => ({
        ...item,
        quote_id: id,
        sort_order: index
    }));

    if (itemsWithQuoteId.length > 0) {
        const { error: itemsError } = await supabase.from("sales_quote_items").insert(itemsWithQuoteId);
        if (itemsError) throw new Error(itemsError.message);
    }

    // 4. Cleanup orphaned storage files
    if (oldItems && oldItems.length > 0) {
        // Function to extract the actual storage path from various Supabase URL formats
        const getFilename = (url: any): string | null => {
            if (!url || typeof url !== 'string') return null;
            try {
                // Remove everything before the last slash and strip query/fragments
                const clean = decodeURIComponent(url).split(/[?#]/)[0];
                return clean.split('/').pop() || null;
            } catch (e) {
                return null;
            }
        };

        const oldFiles = oldItems.map(i => getFilename(i.drawing_url)).filter(Boolean) as string[];
        const newFiles = items.map(i => getFilename(i.drawing_url)).filter(Boolean) as string[];

        // SAFETY CHECK: If the UI has items with drawings, but we couldn't parse ANY of them,
        // or if our extraction count doesn't match the items with drawings, abort to be safe.
        const itemsWithRemoteDrawings = items.filter(i =>
            i.drawing_url &&
            !i.drawing_url.startsWith('blob:') &&
            !i.drawing_url.startsWith('data:')
        );

        if (itemsWithRemoteDrawings.length > 0 && newFiles.length < itemsWithRemoteDrawings.length) {
            console.error("Storage cleanup aborted: Could not parse all referenced drawing filenames correctly.");
            return { id };
        }

        const filesToDelete = oldFiles.filter(f => !newFiles.includes(f));

        if (filesToDelete.length > 0) {
            const pathsToDelete = filesToDelete.map(f => `${id}/${f}`);
            const { error: storageError } = await supabase.storage
                .from("quotes")
                .remove(pathsToDelete);

            if (storageError) {
                console.error("Error cleaning up orphaned storage files:", storageError);
            }
        }
    }

    return { id };
}

export async function deleteQuote(id: string, reason: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Storage Cleanup - Delete all files associated with this quote
    try {
        await deleteQuoteFiles(id);
    } catch (e) {
        console.error("Error deleting storage files for quote:", e);
        // We continue even if storage cleanup fails to ensure DB inconsistency is avoided
    }

    const { error } = await supabase
        .from("sales_quotes")
        .update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
            deleted_reason: reason
        })
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

/**
 * Deletes all files in the storage bucket for a specific quote.
 */
export async function deleteQuoteFiles(quoteId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // List all files in quotes/{quoteId}/
    const { data: files, error: listError } = await supabase.storage
        .from("quotes")
        .list(quoteId);

    if (listError) return; // If bucket or folder doesn't exist, nothing to do

    if (files && files.length > 0) {
        const filesToRemove = files.map((f) => `${quoteId}/${f.name}`);
        const { error: removeError } = await supabase.storage
            .from("quotes")
            .remove(filesToRemove);

        if (removeError) throw new Error("Error cleaning up storage: " + removeError.message);
    }
}

export async function getNextProjectCode(clientPrefix: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
        .from("projects")
        .select("code")
        .like("code", `${clientPrefix}-%`)
        .order("code", { ascending: false })
        .limit(1);

    if (error) throw new Error(error.message);

    let nextNum = 1;
    if (data && data.length > 0) {
        const lastCode = data[0].code;
        const lastNum = parseInt(lastCode.split("-")[1]);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }

    return `${clientPrefix}-${String(nextNum).padStart(4, '0')}`;
}

export async function convertQuoteToProject(quoteId: string, projectName?: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get Quote and Items
    const quote = await getQuoteById(quoteId);
    if (!quote) throw new Error("Quote not found");
    if (quote.status === "approved") throw new Error("Quote already approved");

    // 2. Get Client Prefix
    const { data: client, error: clientError } = await supabase
        .from("sales_clients")
        .select("name, prefix")
        .eq("id", quote.client_id)
        .single();

    if (clientError || !client) throw new Error("Client prefix not found");

    const projectCode = await getNextProjectCode(client.prefix);
    const finalProjectName = projectName || `COT-${quote.quote_number}`;

    // 3. Get Contact Name
    const { data: contact, error: contactError } = await supabase
        .from("sales_contacts")
        .select("name")
        .eq("id", quote.contact_id)
        .single();

    if (contactError) throw new Error("Contact name not found: " + contactError.message);

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
            start_date: new Date().toISOString().split('T')[0],
            delivery_date: quote.delivery_date,
            status: "active"
        })
        .select("id")
        .single();

    if (projectError) throw new Error("Error creating project: " + projectError.message);

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

        const lotPart = String(parentCounter).padStart(2, '0');
        const subPart = String(childCounter).padStart(2, '0');
        const partCode = `${projectCode}-${lotPart}.${subPart}`;

        return {
            project_id: project.id,
            part_code: partCode,
            part_name: item.description,
            quantity: item.quantity,
            material: "POR DEFINIR", // Default
            genral_status: "D0-PUNTO DE RE-ORDEN", // Default start status
            design_no: item.design_no,
            drawing_url: item.drawing_url,
            unit: item.unit
        };
    });

    if (productionOrders.length > 0) {
        const { error: itemsError } = await supabase.from("production_orders").insert(productionOrders);
        if (itemsError) throw new Error("Error creating project items: " + itemsError.message);
    }

    // 6. Mark Quote as Approved
    const { error: updateError } = await supabase.from("sales_quotes").update({ status: 'approved' }).eq("id", quoteId);
    if (updateError) throw new Error("Error updating quote status: " + updateError.message);

    return { success: true, projectCode, projectId: project.id };
}

export async function updateQuoteStatus(id: string, status: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
        .from("sales_quotes")
        .update({ status })
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}
export async function updateProject(id: string, data: {
    name?: string;
    start_date?: string;
    delivery_date?: string;
    status?: string;
    company?: string;
    company_id?: string;
    requestor?: string;
    requestor_id?: string;
}) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
        .from("projects")
        .update(data)
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function updateProductionOrder(id: string, data: {
    part_name?: string;
    quantity?: number;
    material?: string;
    material_id?: string;
    genral_status?: string;
    status_id?: string;
    unit?: string;
    treatment?: string;
    treatment_id?: string | null;
    design_no?: string;
    urgencia?: boolean;
    drawing_url?: string;
    image?: string;
}) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
        .from("production_orders")
        .update(data)
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}
