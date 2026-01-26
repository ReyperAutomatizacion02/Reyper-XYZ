"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// --- CREATE ACTIONS ---

export async function createClientEntry(name: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_clients").insert({ name }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
}

export async function createContactEntry(name: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.from("sales_contacts").insert({ name }).select("id").single();
    if (error) throw new Error(error.message);
    return data?.id;
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
        .insert(quoteData)
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

    const [clients, contacts, positions, areas, units] = await Promise.all([
        supabase.from("sales_clients").select("id, name").order("name"),
        supabase.from("sales_contacts").select("id, name").order("name"),
        supabase.from("sales_positions").select("id, name").order("name"),
        supabase.from("sales_areas").select("id, name").order("name"),
        supabase.from("sales_units").select("id, name").order("name")
    ]);

    return {
        clients: clients.data || [],
        contacts: contacts.data || [],
        positions: positions.data || [],
        areas: areas.data || [],
        units: units.data || []
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
            client:sales_clients(name),
            contact:sales_contacts(name)
        `)
        .eq("status", "active")
        .order("quote_number", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
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

    // 1. Update Quote Info
    const { error: quoteError } = await supabase
        .from("sales_quotes")
        .update(quoteData)
        .eq("id", id);

    if (quoteError) throw new Error(quoteError.message);

    // 2. Delete old items and insert fresh ones (Simplest way to sync)
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

    return { id };
}

export async function deleteQuote(id: string, reason: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
