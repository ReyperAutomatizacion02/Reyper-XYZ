import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";
import moment from "moment";

dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PLANNING_DB_ID = process.env.NOTION_PLANNING_DB_ID;

if (!NOTION_TOKEN || !PLANNING_DB_ID) throw new Error("Missing env vars");

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatNotionDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const m = moment(dateStr);
    if (!m.isValid()) return dateStr;
    if (dateStr.length === 10) return dateStr;
    let localM = m;
    if (!dateStr.includes("+") && !dateStr.includes("Z") && !/-\d{2}:\d{2}$/.test(dateStr)) {
        localM = moment(`${dateStr}-06:00`);
    }
    return localM.format("YYYY-MM-DDTHH:mm:ss");
}

async function fetchNotion(cursor?: string) {
    // NO FILTER
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${PLANNING_DB_ID}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function run() {
    console.log("🚀 Sincronizando TODA la Planeación (Sin filtros)...");

    // 1. Cargar Mapa de Partidas
    console.log("Cargando mapa de partidas...");
    const orderMap = new Map<string, string>();
    let dbPage = 0;
    while (true) {
        const { data } = await supabase.from("production_orders").select("id, notion_id").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(o => { if (o.notion_id) orderMap.set(o.notion_id, o.id); });
        if (data.length < 1000) break;
        dbPage++;
    }
    console.log(`Mapa cargado: ${orderMap.size} partidas.`);

    // 2. Fetch Notion
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let count = 0;

    while (hasMore) {
        const resp: any = await fetchNotion(cursor);
        const batch = resp.results.map((page: any) => {
            const props = page.properties;
            const rel = props["PARTIDA"]?.relation;
            if (!rel || rel.length === 0) return null;
            const oId = orderMap.get(rel[0].id);
            if (!oId) return null; // Skip if order not found

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
                last_edited_at: page.created_time
            };
        }).filter((i: any) => i !== null);

        // Deduplicate batch by notion_id
        const uniqueBatch = Array.from(new Map(batch.map((item: any) => [item.notion_id, item])).values());

        if (uniqueBatch.length > 0) {
            const { error } = await supabase.from("planning").upsert(uniqueBatch as any[], { onConflict: 'notion_id' });
            if (error) console.error("Error upserting:", error);
            else count += uniqueBatch.length;
        }

        process.stdout.write(`\rProcesados: ${count}`);
        hasMore = resp.has_more;
        cursor = resp.next_cursor;
    }
    console.log("\n✅ Finalizado.");
}

run();
