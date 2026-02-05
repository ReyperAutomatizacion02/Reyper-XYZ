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
    throw new Error("Missing Notion configuration in .env.local");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY) in .env.local");
}

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CLI Arguments
const args = process.argv.slice(2);
const daysFlagIndex = args.indexOf("--days");
const DAYS_BACK = daysFlagIndex !== -1 ? parseInt(args[daysFlagIndex + 1]) || 3 : 3;

const RUN_PROJECTS = args.includes("--projects");
const RUN_ITEMS = args.includes("--items");
const RUN_PLANNING = args.includes("--planning");
const FULL_SYNC = args.includes("--full");

const sinceFlagIndex = args.indexOf("--since");
const SINCE_DATE = sinceFlagIndex !== -1 ? args[sinceFlagIndex + 1] : null;

const untilFlagIndex = args.indexOf("--until");
const UNTIL_DATE = untilFlagIndex !== -1 ? args[untilFlagIndex + 1] : null;

// If no specific flags are provided, run all
const runAll = !RUN_PROJECTS && !RUN_ITEMS && !RUN_PLANNING;
const shouldRunProjects = runAll || RUN_PROJECTS;
const shouldRunItems = runAll || RUN_ITEMS;
const shouldRunPlanning = runAll || RUN_PLANNING;

/**
 * Utility to fetch with retries and exponential backoff
 * Handles 429, 500, 502, 503, 504
 */
async function fetchWithRetry(url: string, options: any, retries = 5, backoff = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return await res.json();

            if ([429, 500, 502, 503, 504].includes(res.status)) {
                console.warn(`⚠️ Notion API error ${res.status}. Reintentando en ${backoff / 1000}s... (Intento ${i + 1}/${retries})`);
                await new Promise(res => setTimeout(res, backoff));
                backoff *= 2;
                continue;
            }

            throw new Error(`Notion API Error: ${res.status} ${await res.text()}`);
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`⚠️ Error de red: ${e.message}. Reintentando...`);
            await new Promise(res => setTimeout(res, backoff));
            backoff *= 2;
        }
    }
}

async function fetchNotionBatch(dbId: string, filter?: any, cursor?: string) {
    const body: any = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

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

function getThresholdISO() {
    if (SINCE_DATE) {
        const m = moment(SINCE_DATE).startOf('day');
        if (m.isValid()) {
            return m.toISOString();
        }
        console.warn(`⚠️ Fecha --since '${SINCE_DATE}' no es válida. Usando --days en su lugar.`);
    }
    const date = new Date();
    date.setDate(date.getDate() - DAYS_BACK);
    return date.toISOString();
}

function getUntilISO() {
    if (UNTIL_DATE) {
        const m = moment(UNTIL_DATE).endOf('day');
        if (m.isValid()) {
            return m.toISOString();
        }
        console.warn(`⚠️ Fecha --until '${UNTIL_DATE}' no es válida.`);
    }
    return null;
}

function buildNotionFilter(propertyName: string, sinceISO: string, untilISO: string | null) {
    if (FULL_SYNC) return undefined;

    const filters: any[] = [
        { property: propertyName, last_edited_time: { on_or_after: sinceISO } }
    ];

    if (untilISO) {
        filters.push({ property: propertyName, last_edited_time: { on_or_before: untilISO } });
    }

    return filters.length === 1 ? filters[0] : { and: filters };
}

/**
 * Handles Notion dates and ensures UTC-6 offset
 */
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

async function runSync() {
    const threshold = getThresholdISO();
    const until = getUntilISO();
    console.log(`\n🚀 INICIANDO SINCRONIZACIÓN DE REGISTROS ACTUALIZADOS`);

    let modeText = "";
    if (FULL_SYNC) modeText = "COMPLETO (Sin filtros)";
    else if (SINCE_DATE && UNTIL_DATE) modeText = `RANGO DE FECHAS (${SINCE_DATE} hasta ${UNTIL_DATE})`;
    else if (SINCE_DATE) modeText = `FECHA ESPECÍFICA (Desde: ${SINCE_DATE})`;
    else modeText = `INCREMENTAL (${DAYS_BACK} días)`;

    console.log(`📅 Modo: ${modeText}`);
    if (!FULL_SYNC) {
        console.log(`📅 Umbral Inicio: ${threshold}`);
        if (until) console.log(`📅 Umbral Fin: ${until}`);
    }

    const projectMap = new Map<string, string>(); // notion_id -> supabase_id
    const projectStatusMap = new Map<string, string>(); // supabase_id -> status
    const orderMap = new Map<string, string>(); // notion_id -> supabase_id
    const machinesSet = new Set<string>(); // machine names
    let stats = { projects: 0, items: 0, planning: 0, machines: 0, skipped: 0 };

    // --- PHASE 0: LOAD CONTEXT ---
    console.log("🔍 Cargando contexto de Supabase...");
    let dbPage = 0;
    while (true) {
        const { data } = await supabase.from("projects").select("id, notion_id, status").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(p => {
            if (p.notion_id) projectMap.set(p.notion_id, p.id);
            projectStatusMap.set(p.id, p.status || 'unknown');
        });
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
    while (true) {
        const { data } = await supabase.from("machines").select("name").range(dbPage * 1000, (dbPage + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        data.forEach(m => machinesSet.add(m.name));
        if (data.length < 1000) break;
        dbPage++;
    }
    console.log(`📍 Maps cargados: ${projectMap.size} Proyectos, ${orderMap.size} Partidas, ${machinesSet.size} Máquinas.`);

    // --- PHASE 1: PROJECTS ---
    if (shouldRunProjects) {
        console.log("\n📁 Fase 1: Proyectos (Última edición)...");
        let hasMoreP = true;
        let cursorP: string | undefined = undefined;
        let batchTotal = 0;

        while (hasMoreP) {
            const pFilter = buildNotionFilter("Última edición", threshold, until);
            const resp: any = await fetchNotionBatch(PROJECTS_DB_ID, pFilter, cursorP);
            const batch = resp.results.map((page: any) => {
                const code = page.properties["CODIGO PROYECTO E"]?.title?.[0]?.plain_text;
                if (!code) {
                    console.log(`⚠️ Saltando proyecto sin código (ID: ${page.id})`);
                    return null;
                }

                const projectData: any = {
                    code,
                    name: page.properties["NOMBRE DE PROYECTO"]?.rich_text?.[0]?.plain_text || null,
                    company: page.properties["01-EMPRESA."]?.select?.name || null,
                    requestor: page.properties["SOLICITA"]?.select?.name || null,
                    start_date: page.properties["01-FECHA DE SOLICITUD"]?.date?.start || null,
                    delivery_date: page.properties["01-FECHA DE ENTREGA X CLIENTE"]?.date?.start || null,
                    notion_id: page.id,
                    last_edited_at: page.last_edited_time
                };

                // SMART STATUS: Set 'active' if new OR if current status is missing/unknown
                const currentSupaId = projectMap.get(page.id);
                const currentStatus = currentSupaId ? projectStatusMap.get(currentSupaId) : null;

                if (!currentSupaId || !currentStatus || currentStatus === 'unknown' || currentStatus === '') {
                    projectData.status = 'active';
                }

                return projectData;
            }).filter((i: any) => i !== null);

            // Deduplicate batch by notion_id
            const uniqueBatch = Array.from(new Map(batch.map((item: any) => [item.notion_id, item])).values());

            if (uniqueBatch.length > 0) {
                console.log(`📦 Procesando batch de ${uniqueBatch.length} proyectos...`);
                uniqueBatch.forEach((p: any) => console.log(`   - [${p.code}] ${p.name}${!projectMap.has(p.notion_id) ? " (NUEVO)" : ""}`));

                const { data, error } = await supabase.from("projects").upsert(uniqueBatch as any[], { onConflict: 'notion_id' }).select("id, notion_id");

                if (error) {
                    console.error(`❌ Error en batch de Proyectos: ${error.message} (Code: ${error.code})`);
                    console.log("⚠️ Intentando inserción uno por uno para detectar y aislar el conflicto...");

                    for (const item of uniqueBatch) {
                        const p = item as any;
                        const { data: singleData, error: singleError } = await supabase.from("projects").upsert(p, { onConflict: 'notion_id' }).select("id, notion_id");

                        if (singleError) {
                            console.error(`   ❌ FALLÓ PROYECTO [${p.code}] "${p.name}":`);
                            console.error(`      Error: ${singleError.message}`);
                            console.error(`      Notion ID: ${p.notion_id}`);
                        } else {
                            if (singleData && singleData[0]) {
                                projectMap.set(singleData[0].notion_id!, singleData[0].id);
                                if (p.status) projectStatusMap.set(singleData[0].id, p.status);
                                stats.projects++;
                                batchTotal++;
                                // console.log(`      ✅ Recuperado: [${p.code}]`);
                            }
                        }
                    }
                } else {
                    data?.forEach(p => {
                        projectMap.set(p.notion_id!, p.id);
                        const matchedItem = uniqueBatch.find((b: any) => b.notion_id === p.notion_id) as any;
                        if (matchedItem?.status) {
                            projectStatusMap.set(p.id, matchedItem.status);
                        }
                    });
                    stats.projects += uniqueBatch.length;
                    batchTotal += uniqueBatch.length;
                }
            }
            hasMoreP = resp.has_more; cursorP = resp.next_cursor;
        }
        console.log(`✅ Total Proyectos procesados en esta ventana: ${batchTotal}`);
    }

    // --- PHASE 2: PARTIDAS ---
    if (shouldRunItems) {
        console.log("\n📦 Fase 2: Partidas (ZAUX-FECHA ULTIMA EDICION)...");
        let hasMoreI = true;
        let cursorI: string | undefined = undefined;
        let batchTotal = 0;

        while (hasMoreI) {
            const iFilter = buildNotionFilter("ZAUX-FECHA ULTIMA EDICION", threshold, until);
            const resp: any = await fetchNotionBatch(ITEMS_DB_ID, iFilter, cursorI);
            const batch = await Promise.all(resp.results.map(async (page: any) => {
                const props = page.properties;
                const partCode = props["01-CODIGO PIEZA"]?.title?.[0]?.plain_text || "S/N";
                const partName = props["01-NOMBRE DE LA PIEZA"]?.rich_text?.[0]?.plain_text || "Sin Nombre";

                const rel = props["01- BDCODIGO P E PRO"]?.relation;
                if (!rel || rel.length === 0) {
                    console.log(`   ⚠️ [${partCode}] Saltada: No tiene relación con Proyecto en Notion.`);
                    stats.skipped++; return null;
                }

                const sId = projectMap.get(rel[0].id);
                if (!sId) {
                    console.log(`   ⚠️ [${partCode}] Saltada: El proyecto relacionado (${rel[0].id}) NO existe en Supabase.`);
                    stats.skipped++; return null;
                }

                // REACTIVE STATUS LOGIC
                const genStatusStr = props["06-ESTATUS GENERAL"]?.select?.name || "";
                const isFinalState = genStatusStr.toUpperCase().startsWith("D") || genStatusStr.toUpperCase().includes("CANCELAD");
                const currentPStatus = projectStatusMap.get(sId);

                if (!isFinalState && currentPStatus !== 'active') {
                    console.log(`   🔄 [${partCode}] RE-ACTIVANDO proyecto padre motivado por esta partida pendiente.`);
                    await supabase.from("projects").update({ status: 'active' }).eq("id", sId);
                    projectStatusMap.set(sId, 'active'); // Update local map
                }

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
            const clean = batch.filter(i => i !== null) as any[];
            if (clean.length > 0) {
                // Deduplicate by notion_id
                const uniqueBatch = Array.from(new Map(clean.map((item: any) => [item.notion_id, item])).values());

                const { data, error } = await supabase.from("production_orders").upsert(uniqueBatch as any[], { onConflict: 'notion_id' }).select("id, notion_id");

                if (error) {
                    console.error(`❌ Error en batch de Partidas: ${error.message}`);
                    console.log("⚠️ Intentando inserción uno por uno...");
                    for (const item of uniqueBatch) {
                        const i = item as any;
                        const { data: sData, error: sError } = await supabase.from("production_orders").upsert(i, { onConflict: 'notion_id' }).select("id, notion_id");
                        if (sError) {
                            console.error(`   ❌ FALLÓ PARTIDA [${i.part_code}]: ${sError.message}`);
                        } else if (sData && sData[0]) {
                            orderMap.set(sData[0].notion_id!, sData[0].id);
                            stats.items++;
                            batchTotal++;
                        }
                    }
                } else {
                    data?.forEach(o => orderMap.set(o.notion_id!, o.id));
                    stats.items += uniqueBatch.length;
                    batchTotal += uniqueBatch.length;
                    console.log(`🚀 Partidas sincronizadas en este batch: +${uniqueBatch.length}`);
                }
            }
            hasMoreI = resp.has_more; cursorI = resp.next_cursor;
        }
        console.log(`✅ Total Partidas procesadas en esta ventana: ${batchTotal}`);
    }

    // --- PHASE 3: PLANEACIÓN ---
    if (shouldRunPlanning) {
        console.log("\n📅 Fase 3: Planeación (FECHA ULTIMA EDICION)...");
        let hasMorePl = true;
        let cursorPl: string | undefined = undefined;
        while (hasMorePl) {
            const plFilter = buildNotionFilter("FECHA ULTIMA EDICION", threshold, until);
            const resp: any = await fetchNotionBatch(PLANNING_DB_ID, plFilter, cursorPl);
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
                    last_edited_at: page.last_edited_time
                };
            }).filter((i: any) => i !== null);

            if (batch.length > 0) {
                // Deduplicate by notion_id
                const uniqueBatch = Array.from(new Map(batch.map((item: any) => [item.notion_id, item])).values());

                const { error } = await supabase.from("planning").upsert(uniqueBatch as any[], { onConflict: 'notion_id' });

                if (error) {
                    console.error(`❌ Error en batch de Planeación: ${error.message}`);
                    console.log("⚠️ Intentando inserción uno por uno...");
                    for (const item of uniqueBatch) {
                        const pl = item as any;
                        const { error: sError } = await supabase.from("planning").upsert(pl, { onConflict: 'notion_id' });
                        if (sError) {
                            console.error(`   ❌ FALLÓ REGISTRO PLANEACIÓN [${pl.register || 'S/N'}]: ${sError.message}`);
                        } else {
                            stats.planning++;
                        }
                    }
                } else {
                    stats.planning += uniqueBatch.length;
                    console.log(`🚀 Planeación: +${uniqueBatch.length}`);

                    // Collect new machines
                    const newMachines = uniqueBatch
                        .map((p: any) => p.machine)
                        .filter((m): m is string => !!m && !machinesSet.has(m));

                    if (newMachines.length > 0) {
                        const uniqueNew = Array.from(new Set(newMachines));
                        console.log(`✨ Registrando ${uniqueNew.length} máquinas nuevas: ${uniqueNew.join(", ")}`);
                        const { error: mError } = await supabase
                            .from("machines")
                            .insert(uniqueNew.map(name => ({ name })));

                        if (!mError) {
                            uniqueNew.forEach(name => machinesSet.add(name));
                            stats.machines += uniqueNew.length;
                        }
                    }
                }
            }
            hasMorePl = resp.has_more; cursorPl = resp.next_cursor;
        }
    }

    console.log(`\n✨ SINCRONIZACIÓN FINALIZADA`);
    console.log(`📊 PJS: ${stats.projects} | ITM: ${stats.items} | PLN: ${stats.planning} | MAQ: ${stats.machines} | SKP: ${stats.skipped}`);
}

runSync().catch(console.error);
