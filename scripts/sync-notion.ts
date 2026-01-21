import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";
import moment from "moment";

dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN as string;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID as string;
const ITEMS_DB_ID = process.env.NOTION_ITEMS_DB_ID as string;
const PLANNING_DB_ID = process.env.NOTION_PLANNING_DB_ID as string;

if (!NOTION_TOKEN || !PROJECTS_DB_ID || !ITEMS_DB_ID || !PLANNING_DB_ID) {
    throw new Error("Missing Notion configuration (Token or Database IDs) in .env.local");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase credentials in .env.local");
}

const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const INCREMENTAL_SYNC = process.env.INCREMENTAL === "true" || process.argv.includes("--incremental");
const SKIP_PROJECTS = process.argv.includes("--skip-projects");
const SKIP_ITEMS = process.argv.includes("--skip-items");

async function fetchNotionBatch(dbId: string, filter?: any, cursor?: string) {
    const body: any = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
    return await res.json();
}

async function syncNotionImage(notionPageId: string, imageUrl: string): Promise<string | null> {
    try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return null;
        const blob = await imgRes.blob();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const extension = contentType.split("/")[1] || "jpg";
        const filePath = `items/${notionPageId}.${extension}`;
        await supabase.storage.from("partidas").upload(filePath, blob, { contentType, upsert: true });
        const { data: { publicUrl } } = supabase.storage.from("partidas").getPublicUrl(filePath);
        return publicUrl;
    } catch (e) {
        return null;
    }
}

function getThreshold() {
    const date = new Date();
    date.setHours(date.getHours() - 72); // 3 days as per rule
    return date.toISOString();
}

function getPlanningThreshold() {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30 days ago
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
}

/**
 * Handles Notion dates by ensuring they have the correct timezone offset (UTC-6)
 * if they are missing one. This prevents local times from being treated as UTC.
 */
function formatNotionDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;

    // Parse with moment
    const m = moment(dateStr);
    if (!m.isValid()) return dateStr;

    // If it's just a date without time (YYYY-MM-DD), keep it as is
    if (dateStr.length === 10) return dateStr;

    // We want the Supabase table to SHOW the same as the Gantt (local time).
    // To achieve this, we'll strip the offset and return a local ISO string.
    // Supplying internal UTC-6 if offset is missing.
    let localM = m;
    if (!dateStr.includes("+") && !dateStr.includes("Z") && !/-\d{2}:\d{2}$/.test(dateStr)) {
        localM = moment(`${dateStr}-06:00`);
    }

    const result = localM.format("YYYY-MM-DDTHH:mm:ss");

    // Diagnostic logging
    if (Math.random() < 0.1) {
        console.log(`[DEBUG] Date transform: ${dateStr} -> ${result}`);
    }

    return result;
}

async function runSync() {
    console.log(`\n🚀 INICIANDO SINCRONIZACIÓN REYPER (Modo: ${INCREMENTAL_SYNC ? "INCREMENTAL" : "COMPLETO"})`);

    const projectMap = new Map<string, string>(); // notion_id -> supabase_id
    const orderMap = new Map<string, string>();   // notion_id -> supabase_id (for planning)

    let stats = { projects: 0, items: 0, planning: 0, skipped: 0 };

    // --- PHASE 0: LOAD CONTEXT ---
    console.log("🔍 Cargando contexto de Supabase...");
    let dbPage = 0;
    while (true) {
        const { data } = await supabase.from("projects").select("id, notion_id").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(p => { if (p.notion_id) projectMap.set(p.notion_id, p.id); });
        if (data.length < 1000) break;
        dbPage++;
    }
    dbPage = 0;
    while (true) {
        const { data } = await supabase.from("production_orders").select("id, notion_id").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(o => { if (o.notion_id) orderMap.set(o.notion_id, o.id); });
        if (data.length < 1000) break;
        dbPage++;
    }
    console.log(`📍 Mapa: ${projectMap.size} Proyectos, ${orderMap.size} Partidas.`);

    // --- PHASE 1: PROJECTS ---
    if (!SKIP_PROJECTS) {
        console.log("\n📁 Fase 1: Proyectos...");
        let pFilter: any = { property: "🛠️ BD - PROYECTOS", relation: { is_not_empty: true } };
        if (INCREMENTAL_SYNC) pFilter = { and: [pFilter, { property: "Última edición", last_edited_time: { on_or_after: getThreshold() } }] };

        let hasMore = true;
        let cursor: string | undefined = undefined;
        while (hasMore) {
            const resp: any = await fetchNotionBatch(PROJECTS_DB_ID, pFilter, cursor);
            const batch = resp.results.map((page: any) => {
                const code = page.properties["CODIGO PROYECTO E"]?.title?.[0]?.plain_text;
                if (!code) return null;
                return {
                    code,
                    name: page.properties["NOMBRE DE PROYECTO"]?.rich_text?.[0]?.plain_text || null,
                    company: page.properties["01-EMPRESA."]?.select?.name || null,
                    requestor: page.properties["SOLICITA"]?.select?.name || null,
                    start_date: page.properties["01-FECHA DE SOLICITUD"]?.date?.start || null,
                    delivery_date: page.properties["01-FECHA DE ENTREGA X CLIENTE"]?.date?.start || null,
                    status: 'active',
                    notion_id: page.id,
                    last_edited_at: page.last_edited_time
                };
            }).filter((i: any) => i !== null);

            if (batch.length > 0) {
                const { data } = await supabase.from("projects").upsert(batch, { onConflict: 'code' }).select("id, notion_id");
                data?.forEach(p => projectMap.set(p.notion_id!, p.id));
                stats.projects += batch.length;
                console.log(`✅ Proyectos: +${batch.length} (Total: ${stats.projects})`);
            }
            hasMore = resp.has_more; cursor = resp.next_cursor;
        }
    }

    // --- PHASE 2: PARTIDAS ---
    if (!SKIP_ITEMS) {
        console.log("\n📦 Fase 2: Partidas e Imágenes...");
        let iFilter: any = { property: "01- BDCODIGO P E PRO", relation: { is_not_empty: true } };
        if (INCREMENTAL_SYNC) iFilter = { and: [iFilter, { property: "ZAUX-FECHA ULTIMA EDICION", last_edited_time: { on_or_after: getThreshold() } }] };

        let hasMore = true;
        let cursor: string | undefined = undefined;
        while (hasMore) {
            const resp: any = await fetchNotionBatch(ITEMS_DB_ID, iFilter, cursor);
            const batch = await Promise.all(resp.results.map(async (page: any) => {
                const props = page.properties;
                const rel = props["01- BDCODIGO P E PRO"]?.relation;
                if (!rel || rel.length === 0) { stats.skipped++; return null; }
                const sId = projectMap.get(rel[0].id);
                if (!sId) { stats.skipped++; return null; }

                let finalImageUrl: string | null = null;
                const imageProp = props["07-A MOSTRAR"]?.files;
                if (imageProp && imageProp.length > 0) {
                    const notionImgUrl = imageProp[0].file?.url || imageProp[0].external?.url;
                    if (notionImgUrl) {
                        finalImageUrl = await syncNotionImage(page.id, notionImgUrl);
                        if (finalImageUrl) process.stdout.write(".");
                    }
                }

                return {
                    part_code: props["01-CODIGO PIEZA"]?.title?.[0]?.plain_text || "S/N",
                    part_name: props["01-NOMBRE DE LA PIEZA"]?.rich_text?.[0]?.plain_text || null,
                    genral_status: props["06-ESTATUS GENERAL"]?.select?.name || null,
                    material: props["01-MATERIAL PIEZA"]?.select?.name || null,
                    material_confirmation: props["06-CONFIRMACION O CAMBIO DE MATERIAL"]?.select?.name || null,
                    quantity: props["01-CANTIDAD F.*"]?.number || 0,
                    project_id: sId,
                    notion_id: page.id,
                    last_edited_at: page.last_edited_time,
                    image: finalImageUrl
                };
            }));
            const clean = batch.filter(i => i !== null);
            if (clean.length > 0) {
                const { data } = await supabase.from("production_orders").upsert(clean, { onConflict: 'part_code' }).select("id, notion_id");
                data?.forEach(o => orderMap.set(o.notion_id!, o.id));
                stats.items += clean.length;
                console.log(`\n🚀 Partidas: +${clean.length} (Total: ${stats.items})`);
            }
            hasMore = resp.has_more; cursor = resp.next_cursor;
        }
    }

    // --- PHASE 3: PLANEACIÓN ---
    console.log(`\n📅 Fase 3: Planeación de Producción (Filtrado: ${INCREMENTAL_SYNC ? "Últimos 3 días" : "Último mes"})...`);

    // Filter planning by FECHA DE CREACION
    // Full sync: 30 days back
    // Incremental: 3 days back (getThreshold)
    const planningDateLimit = INCREMENTAL_SYNC ? getThreshold() : getPlanningThreshold();

    let plFilter: any = {
        property: "FECHA DE CREACION",
        created_time: { on_or_after: planningDateLimit }
    };

    // If incremental, also filter by last_edited_time for safety
    if (INCREMENTAL_SYNC) {
        plFilter = {
            and: [
                plFilter,
                {
                    timestamp: "last_edited_time",
                    last_edited_time: { on_or_after: getThreshold() }
                }
            ]
        };
    }

    let hasMorePl = true;
    let plCursor: string | undefined = undefined;
    while (hasMorePl) {
        const resp: any = await fetchNotionBatch(PLANNING_DB_ID, plFilter, plCursor);
        const batch = resp.results.map((page: any) => {
            const props = page.properties;
            const rel = props["PARTIDA"]?.relation;
            if (!rel || rel.length === 0) { stats.skipped++; return null; }
            const oId = orderMap.get(rel[0].id);
            if (!oId) { stats.skipped++; return null; }

            const plannedDate = props["FECHA PLANEADA"]?.date;

            return {
                register: props["N"]?.title?.[0]?.plain_text || null,
                machine: props["MAQUINA"]?.select?.name || null,
                operator: props["OPERADOR"]?.select?.name || null,
                planned_date: formatNotionDate(plannedDate?.start),
                planned_end: formatNotionDate(plannedDate?.end),
                check_in: formatNotionDate(props["CHECK IN"]?.date?.start),
                check_out: formatNotionDate(props["CHECK OUT"]?.date?.start),
                order_id: oId,
                notion_id: page.id,
                last_edited_at: page.created_time // Per rule use FECHA DE CREACION for last edited
            };
        }).filter((i: any) => i !== null);

        if (batch.length > 0) {
            const { error } = await (supabase.from("planning" as any) as any).upsert(batch, { onConflict: 'notion_id' });
            if (error) console.error("❌ Error Planeación:", error.message);
            else {
                stats.planning += batch.length;
                console.log(`🚀 Planeación: +${batch.length} (Total: ${stats.planning})`);
            }
        }
        hasMorePl = resp.has_more; plCursor = resp.next_cursor;
    }

    console.log(`\n✨ SINCRONIZACIÓN FINALIZADA`);
    console.log(`📊 PJS: ${stats.projects} | ITM: ${stats.items} | PLN: ${stats.planning} | SKP: ${stats.skipped}`);
}

runSync().catch(console.error);
