import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";

dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;

if (!NOTION_TOKEN || !PROJECTS_DB_ID) throw new Error("Missing env vars");

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fetchNotion(cursor?: string) {
    const res = await fetch(`https://api.notion.com/v1/databases/${PROJECTS_DB_ID}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            page_size: 100,
            start_cursor: cursor,
            // NO FILTER - GET EVERYTHING
        })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function run() {
    console.log("🚀 Sincronizando TODOS los Proyectos (Sin filtros)...");
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let count = 0;

    while (hasMore) {
        const resp: any = await fetchNotion(cursor);
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
                status: 'active', // Default to active, trigger will fix later if needed
                notion_id: page.id,
                created_at: page.created_time,
                last_edited_at: page.last_edited_time
            };
        }).filter((i: any) => i !== null);

        // Deduplicate batch by code
        const uniqueBatch = Array.from(new Map(batch.map((item: any) => [item.code, item])).values());

        if (uniqueBatch.length > 0) {
            const { error } = await supabase.from("projects").upsert(uniqueBatch as any[], { onConflict: 'code' });
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
