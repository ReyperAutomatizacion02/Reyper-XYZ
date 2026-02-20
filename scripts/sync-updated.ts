import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";
import moment from "moment";

// --- CONFIGURATION ---
dotenv.config({ path: ".env.local" });

const NOTION_TOKEN = process.env.NOTION_TOKEN as string;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID as string;
const ITEMS_DB_ID = process.env.NOTION_ITEMS_DB_ID as string;
const PLANNING_DB_ID = process.env.NOTION_PLANNING_DB_ID as string;

if (!NOTION_TOKEN || !PROJECTS_DB_ID || !ITEMS_DB_ID || !PLANNING_DB_ID) {
    throw new Error("Missing Notion configuration in .env.local");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY) in .env.local");
}

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- CLI ARGS ---
const args = process.argv.slice(2);
const DAYS_BACK = (args.indexOf("--days") !== -1) ? (parseInt(args[args.indexOf("--days") + 1]) || 3) : 3;
const SINCE_DATE = args.includes("--today") ? moment().format("YYYY-MM-DD") : ((args.indexOf("--since") !== -1) ? args[args.indexOf("--since") + 1] : null);
const UNTIL_DATE = args.includes("--today") ? moment().format("YYYY-MM-DD") : ((args.indexOf("--until") !== -1) ? args[args.indexOf("--until") + 1] : null);
const FULL_SYNC = args.includes("--full") || args.includes("--all");

const RUN_PJ = args.includes("--projects") || (!args.includes("--items") && !args.includes("--planning") && !args.includes("--full") && !args.includes("--all")) || FULL_SYNC;
const RUN_IT = args.includes("--items") || (!args.includes("--projects") && !args.includes("--planning") && !args.includes("--full") && !args.includes("--all")) || FULL_SYNC;
const RUN_PL = args.includes("--planning") || (!args.includes("--projects") && !args.includes("--items") && !args.includes("--full") && !args.includes("--all")) || FULL_SYNC;

// --- UTILS ---

async function fetchWithRetry(url: string, options: any, retries = 5, backoff = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return await res.json();
            if ([429, 502, 503, 504].includes(res.status)) {
                const wait = res.status === 429 ? 5000 : backoff;
                console.warn(`   ⚠️ Notion ${res.status}. Reintentando en ${wait / 1000}s... (Intento ${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, wait));
                backoff *= 2;
                continue;
            }
            throw new Error(`API Error: ${res.status} ${await res.text()}`);
        } catch (e: any) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, backoff));
            backoff *= 2;
        }
    }
}

async function queryNotion(dbId: string, filter?: any, cursor?: string, sorts?: any[]) {
    const body: any = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    if (sorts) body.sorts = sorts;
    return await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
}

async function getNotionPage(pageId: string) {
    return await fetchWithRetry(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28"
        }
    });
}

function buildFilter(sinceISO: string, untilISO: string | null, propName: string = 'SYSTEM') {
    if (FULL_SYNC) return undefined;

    let base: any;
    if (propName === 'SYSTEM') {
        base = {
            timestamp: "last_edited_time",
            last_edited_time: { on_or_after: sinceISO }
        };
        if (untilISO) base.last_edited_time.on_or_before = untilISO;
    } else {
        // Notion allows filtering properties of type 'last_edited_time'
        base = {
            property: propName,
            last_edited_time: { on_or_after: sinceISO }
        };
        if (untilISO) base.last_edited_time.on_or_before = untilISO;
    }
    return base;
}

function formatTime(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const m = moment(dateStr);
    if (!m.isValid()) return dateStr;
    if (dateStr.length === 10) return dateStr;
    const local = dateStr.match(/[Z+\-]/) ? m : moment(`${dateStr}-06:00`);
    return local.format("YYYY-MM-DDTHH:mm:ss");
}

function cleanName(name: string | null | undefined) {
    if (!name) return null;
    return name.replace(/^[0-9]+-/, '');
}

async function syncImage(id: string, url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = (res.headers.get("content-type") || "image/jpeg").split("/")[1] || "jpg";
        const path = `items/${id}.${ext}`;
        await supabase.storage.from("partidas").upload(path, blob, { contentType: res.headers.get("content-type") || "image/jpeg", upsert: true });
        return supabase.storage.from("partidas").getPublicUrl(path).data.publicUrl;
    } catch { return null; }
}

async function fetchAll(query: any) {
    let all: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < step) break;
        from += step;
    }
    return all;
}

// --- MAIN SYNC ---

async function run() {
    // 1. Thresholds (Ajustado para GMT-6)
    let since = moment().utcOffset("-06:00").subtract(DAYS_BACK, 'days').startOf('day').toISOString();
    if (args.includes("--today")) {
        since = moment().utcOffset("-06:00").startOf('day').toISOString();
    }
    if (args.find(a => a.startsWith("--since="))) {
        since = moment(args.find(a => a.startsWith("--since="))!.split("=")[1]).utcOffset("-06:00").startOf('day').toISOString();
    }

    let until = UNTIL_DATE ? moment(UNTIL_DATE).endOf('day').toISOString() : null;

    console.log(`\n🚀 INICIANDO SINCRONIZACIÓN OPTIMIZADA`);
    console.log(`📅 Rango: ${moment(since).format("L")} - ${until ? moment(until).format("L") : "Ahora"}`);
    if (FULL_SYNC) console.log(`🔥 MODO FULL SYNC ACTIVO`);
    if (args.includes("--today")) console.log(`✨ FILTRANDO SOLO POR HOY`);

    // 2. Load context
    console.log("🔍 Cargando contexto local (esto puede tardar un poco)...");
    const projectMap = new Map<string, string>();
    const projectStatusMap = new Map<string, string>();
    const orderMap = new Map<string, any>();
    const machines = new Set<string>();

    const [pjs, itm, maq] = await Promise.all([
        fetchAll(supabase.from("projects").select("id, notion_id, status")),
        fetchAll(supabase.from("production_orders").select("id, notion_id, genral_status, image, part_code")),
        supabase.from("machines").select("name")
    ]);

    console.log(`🔍 [DEBUG] RAW COUNT - PJS: ${pjs.length} | ITM: ${itm.length}`);

    pjs?.forEach(p => { if (p.notion_id) { projectMap.set(p.notion_id, p.id); projectStatusMap.set(p.id, p.status || 'inactive'); } });
    itm?.forEach(i => { if (i.notion_id) orderMap.set(i.notion_id, i); });
    maq.data?.forEach(m => machines.add(m.name.trim()));

    console.log(`📍 DB Local: ${projectMap.size} PJS | ${orderMap.size} ITM | ${machines.size} MAQ.`);

    let stats = { pjs: 0, itm: 0, pln: 0, skp: 0 };

    // PHASE 1: PROJECTS
    if (RUN_PJ) {
        console.log("\n📁 Fase 1: Proyectos (Propiedad: ULTIMA EDICION)...");
        let hasMore = true, cursor: string | undefined;
        const filter = buildFilter(since, until, "ULTIMA EDICION");
        const sorts = [{ property: "ULTIMA EDICION", direction: "descending" }];
        if (filter) console.log(`   📡 Filtro:`, JSON.stringify(filter));

        while (hasMore) {
            const resp: any = await queryNotion(PROJECTS_DB_ID, filter, cursor, sorts);
            let processedInBatch = 0;
            const batch = resp.results.map((p: any) => {
                const modTime = p.properties["ULTIMA EDICION"]?.last_edited_time || p.last_edited_time;
                if (!FULL_SYNC && moment(modTime).isBefore(since)) return null;

                const code = p.properties["CODIGO PROYECTO E"]?.title?.[0]?.plain_text;
                if (!code) return null;
                processedInBatch++;
                const data: any = {
                    code,
                    name: p.properties[" NOMBRE DE PROYECTO"]?.rich_text?.[0]?.plain_text || null,
                    company: cleanName(p.properties["01-EMPRESA."]?.select?.name),
                    requestor: cleanName(p.properties["SOLICITA"]?.select?.name),
                    start_date: p.properties["01-FECHA DE SOLICITUD"]?.date?.start || null,
                    delivery_date: p.properties["01-FECHA DE ENTREGA X CLIENTE"]?.date?.start || null,
                    notion_id: p.id,
                    last_edited_at: modTime,
                    status: 'active'
                };

                const existingId = projectMap.get(p.id);
                if (existingId) {
                    data.status = projectStatusMap.get(existingId) || 'active';
                } else {
                    data.status = 'active';
                }
                return data;
            }).filter(Boolean);

            if (batch.length) {
                const { data: saved } = await supabase.from("projects").upsert(batch, { onConflict: 'notion_id' }).select("id, notion_id");
                saved?.forEach(s => projectMap.set(s.notion_id!, s.id));
                stats.pjs += batch.length;
                console.log(`   ✅ Batch Proyectos: +${batch.length}`);
            }

            if (!FULL_SYNC && processedInBatch === 0 && resp.results.length > 0) {
                console.log("   ⏹️  Fase 1: No se hallaron más modificaciones recientes en este lote. Finalizando.");
                hasMore = false;
            } else {
                hasMore = resp.has_more; cursor = resp.next_cursor;
            }
        }
    }

    // PHASE 2: ITEMS (Partidas)
    if (RUN_IT) {
        console.log("\n📦 Fase 2: Partidas (Propiedad: ZAUX-FECHA ULTIMA EDICION)...");
        let hasMore = true, cursor: string | undefined;
        const filter = buildFilter(since, until, "ZAUX-FECHA ULTIMA EDICION");
        const sorts = [{ property: "ZAUX-FECHA ULTIMA EDICION", direction: "descending" }];
        if (filter) console.log(`   📡 Filtro:`, JSON.stringify(filter));

        while (hasMore) {
            try {
                const resp: any = await queryNotion(ITEMS_DB_ID, filter, cursor, sorts);
                const batch = [];
                let processedInBatch = 0;

                if (!resp.results || resp.results.length === 0) break;

                for (const p of resp.results) {
                    const modTime = p.properties["ZAUX-FECHA ULTIMA EDICION"]?.last_edited_time || p.last_edited_time;

                    if (!FULL_SYNC && moment(modTime).isBefore(since)) {
                        continue;
                    }

                    processedInBatch++;
                    const props = p.properties;
                    const code = props["01-CODIGO PIEZA"]?.title?.[0]?.plain_text || "S/N";
                    const rel = props["01-BDCODIGO P E PRO"]?.relation?.[0]?.id || props["01- BDCODIGO P E PRO"]?.relation?.[0]?.id;

                    if (!rel) {
                        console.log(`   ❌ Item ${code}: Relación faltante.`);
                        stats.skp++;
                        continue;
                    }

                    let sPjId = projectMap.get(rel);
                    if (!sPjId) {
                        console.log(`   🔍 [${code}] Proyecto faltante en DB. Recuperando de Notion...`);
                        try {
                            const pPage: any = await getNotionPage(rel);
                            const pCode = pPage.properties["CODIGO PROYECTO E"]?.title?.[0]?.plain_text;
                            if (pCode) {
                                const { data: newP } = await supabase.from("projects").upsert({
                                    code: pCode,
                                    name: pPage.properties["NOMBRE DE PROYECTO"]?.rich_text?.[0]?.plain_text || null,
                                    company: cleanName(pPage.properties["01-EMPRESA."]?.select?.name),
                                    requestor: cleanName(pPage.properties["SOLICITA"]?.select?.name),
                                    start_date: pPage.properties["01-FECHA DE SOLICITUD"]?.date?.start || null,
                                    delivery_date: pPage.properties["01-FECHA DE ENTREGA X CLIENTE"]?.date?.start || null,
                                    notion_id: pPage.id,
                                    last_edited_at: pPage.last_edited_time,
                                    status: 'active'
                                }, { onConflict: 'notion_id' }).select("id").single();
                                if (newP) { sPjId = newP.id; projectMap.set(rel, sPjId); stats.pjs++; }
                            }
                        } catch { console.log(`   ❌ No se pudo recuperar proyecto ${rel}`); }
                    }

                    if (!sPjId) {
                        console.log(`   ❌ [${code}] Partida omitida: Proyecto relacionado (${rel}) no encontrado/recuperado.`);
                        stats.skp++;
                        continue;
                    }

                    const genStatus = props["06-ESTATUS GENERAL"]?.select?.name || "";
                    const isDone = genStatus.startsWith("D7") || genStatus.startsWith("D8") || genStatus.includes("CANCELAD");

                    // Reactive activation
                    if (!isDone && projectStatusMap.get(sPjId) !== 'active') {
                        await supabase.from("projects").update({ status: 'active' }).eq("id", sPjId);
                        projectStatusMap.set(sPjId, 'active');
                    }

                    const existing = orderMap.get(p.id);
                    const files = props["07-A MOSTRAR"]?.files;
                    let img = existing?.image || null;
                    if (!img && files?.length) {
                        const url = files[0].file?.url || files[0].external?.url;
                        if (url) {
                            img = await syncImage(p.id, url);
                            if (img) process.stdout.write(".");
                        }
                    }

                    const data = {
                        part_code: code,
                        part_name: props["01-NOMBRE DE LA PIEZA"]?.rich_text?.[0]?.plain_text || null,
                        genral_status: genStatus || null,
                        material: props["01-MATERIAL PIEZA"]?.select?.name || null,
                        material_confirmation: props["06-CONFIRMACION O CAMBIO DE MATERIAL"]?.select?.name || null,
                        quantity: props["01-CANTIDAD F.*"]?.number || 0,
                        project_id: sPjId,
                        notion_id: p.id,
                        last_edited_at: modTime,
                        image: img,
                        treatment: props["06-ESPECIFICACION DE TRATAMIENTO"]?.select?.name || null,
                        model_url: props["07-URL 3D"]?.url || null,
                        drawing_url: props["01-URL PLANO"]?.url || null,
                        design_no: props["01-No. DISEÑO"]?.rich_text?.[0]?.plain_text || null
                    };

                    batch.push(data);
                }

                if (batch.length) {
                    const { error } = await supabase.from("production_orders").upsert(batch, { onConflict: 'notion_id' });
                    if (error) console.log(`   ❌ Error upsert partidas: ${error.message}`);
                    else {
                        stats.itm += batch.length;
                        process.stdout.write(`   🚀 Batch Partidas: +${batch.length}\n`);
                    }
                }

                if (!FULL_SYNC && processedInBatch === 0) {
                    console.log("   ⏹️  Fase 2: No se hallaron más modificaciones recientes. Finalizando.");
                    hasMore = false;
                } else {
                    hasMore = resp.has_more; cursor = resp.next_cursor;
                }
            } catch (e: any) {
                console.error(`   ❌ Error crítico en lote de Partidas: ${e.message}`);
                break;
            }
        }
    }

    // PHASE 3: PLANNING
    if (RUN_PL) {
        console.log("\n📅 Fase 3: Planeación (Propiedad: FECHA ULTIMA EDICION)...");
        let hasMore = true, cursor: string | undefined;
        const filter = buildFilter(since, until, "FECHA ULTIMA EDICION");
        const sorts = [{ property: "FECHA ULTIMA EDICION", direction: "descending" }];
        if (filter) console.log(`   📡 Filtro:`, JSON.stringify(filter));

        while (hasMore) {
            try {
                const resp: any = await queryNotion(PLANNING_DB_ID, filter, cursor, sorts);
                const batch = [];
                let processedInBatch = 0;

                if (!resp.results || resp.results.length === 0) break;

                for (const p of resp.results) {
                    const modTime = p.properties["FECHA ULTIMA EDICION"]?.last_edited_time || p.last_edited_time;

                    if (!FULL_SYNC && moment(modTime).isBefore(since)) continue;

                    processedInBatch++;
                    const props = p.properties;
                    const rel = props["PARTIDA"]?.relation?.[0]?.id;
                    if (!rel) { stats.skp++; continue; }

                    const oId = typeof orderMap.get(rel) === 'object' ? orderMap.get(rel)?.id : orderMap.get(rel);
                    if (!oId) { stats.skp++; continue; }

                    const date = props["FECHA PLANEADA"]?.date;
                    const machine = props["MAQUINA"]?.select?.name?.trim();

                    if (machine && !machines.has(machine)) {
                        await supabase.from("machines").upsert({ name: machine }, { onConflict: 'name' });
                        machines.add(machine);
                    }

                    batch.push({
                        register: props["N"]?.title?.[0]?.plain_text || null,
                        machine: machine || null,
                        operator: props["OPERADOR"]?.select?.name || null,
                        planned_date: formatTime(date?.start),
                        planned_end: formatTime(date?.end),
                        check_in: formatTime(props["CHECK IN"]?.date?.start),
                        check_out: formatTime(props["CHECK OUT"]?.date?.start),
                        order_id: oId,
                        notion_id: p.id,
                        last_edited_at: modTime
                    });
                }

                if (batch.length) {
                    await supabase.from("planning").upsert(batch, { onConflict: 'notion_id' });
                    stats.pln += batch.length;
                    console.log(`   🚀 Batch Planeación: +${batch.length}`);
                }

                if (!FULL_SYNC && processedInBatch === 0) {
                    console.log("   ⏹️  Fase 3: No se hallaron más modificaciones recientes. Finalizando.");
                    hasMore = false;
                } else {
                    hasMore = resp.has_more; cursor = resp.next_cursor;
                }
            } catch (e: any) {
                console.error(`   ❌ Error crítico en lote de Planeación: ${e.message}`);
                break;
            }
        }
    }

    // PHASE 4: RECOVERY & CONSISTENCY
    console.log("\n🔄 Fase 4: Consistencia de Estados...");
    try {
        const { data: active } = await supabase.from("production_orders")
            .select("project_id")
            .not("genral_status", "ilike", "D7%")
            .not("genral_status", "ilike", "D8%")
            .not("genral_status", "ilike", "%CANCELAD%");

        if (active?.length) {
            const ids = Array.from(new Set(active.map(a => a.project_id).filter(Boolean))) as string[];
            console.log(`   📋 ${ids.length} Proyectos con partidas activas hallados.`);
            await supabase.from("projects").update({ status: 'active' }).in("id", ids).neq("status", "active");
            process.stdout.write("   ✅ Estados de proyectos sincronizados.\n");
        }
    } catch (e: any) {
        console.error(`   ❌ Error en consistencia: ${e.message}`);
    }

    console.log(`\n✨ SINCRONIZACIÓN FINALIZADA`);
    console.log(`📊 PJS: ${stats.pjs} | ITM: ${stats.itm} | PLN: ${stats.pln} | SKP: ${stats.skp}`);
}

run().catch(e => {
    console.error(`\n💀 ERROR FATAL: ${e.message}`);
    process.exit(1);
});
