import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";

dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ITEMS_DB_ID = process.env.NOTION_ITEMS_DB_ID;

if (!NOTION_TOKEN || !ITEMS_DB_ID) throw new Error("Missing env vars");

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url: string, options: any, retries = 5, backoff = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return await res.json();

            // If server error or rate limit, retry
            if ([500, 502, 503, 504, 429].includes(res.status)) {
                console.warn(`⚠️ Error ${res.status}. Reintentando en ${backoff / 1000}s... (Intento ${i + 1}/${retries})`);
                await wait(backoff);
                backoff *= 2; // Exponential backoff
                continue;
            }

            throw new Error(await res.text());
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`⚠️ Error de red: ${e.message}. Reintentando...`);
            await wait(backoff);
            backoff *= 2;
        }
    }
}

async function fetchNotion(cursor?: string) {
    return await fetchWithRetry(`https://api.notion.com/v1/databases/${ITEMS_DB_ID}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            page_size: 100,
            start_cursor: cursor
            // NO FILTER
        })
    });
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

async function run() {
    console.log("🚀 Sincronizando TODAS las Partidas (Sin filtros)...");

    // 1. Cargar Mapa de Proyectos
    console.log("Cargando mapa de proyectos...");
    const projectMap = new Map<string, string>();
    let dbPage = 0;
    while (true) {
        const { data } = await supabase.from("projects").select("id, notion_id").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(p => { if (p.notion_id) projectMap.set(p.notion_id, p.id); });
        if (data.length < 1000) break;
        dbPage++;
    }
    console.log(`Mapa cargado: ${projectMap.size} proyectos.`);

    // 2. Fetch Notion
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let count = 0;

    while (hasMore) {
        const resp: any = await fetchNotion(cursor);
        const batch = await Promise.all(resp.results.map(async (page: any) => {
            const props = page.properties;
            const rel = props["01- BDCODIGO P E PRO"]?.relation;
            if (!rel || rel.length === 0) return null;
            const sId = projectMap.get(rel[0].id);
            if (!sId) return null; // Skip if project not found

            let finalImageUrl: string | null = null;
            const imageProp = props["07-A MOSTRAR"]?.files;
            if (imageProp && imageProp.length > 0) {
                const notionImgUrl = imageProp[0].file?.url || imageProp[0].external?.url;
                if (notionImgUrl) {
                    finalImageUrl = await syncNotionImage(page.id, notionImgUrl);
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

        const clean = batch.filter((i: any) => i !== null);

        // Deduplicate batch by part_code
        const uniqueBatch = Array.from(new Map(clean.map((item: any) => [item.part_code, item])).values());

        if (uniqueBatch.length > 0) {
            const { error } = await supabase.from("production_orders").upsert(uniqueBatch as any[], { onConflict: 'part_code' });
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
