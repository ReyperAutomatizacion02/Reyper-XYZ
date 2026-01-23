import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "../utils/supabase/types";

dotenv.config({ path: ".env.local" });

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function clearAll() {
    console.log("⚠️  INICIANDO BORRADO TOTAL DE DATOS ⚠️");
    console.log("------------------------------------------");

    // 1. Borrar Planeación (Hija de Partidas)
    console.log("🗑️  Borrando Planeación...");
    const { error: err1 } = await supabase.from("planning").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Hack to delete all
    if (err1) {
        console.error("❌ Error borrando planeación:", err1.message);
        return;
    }
    console.log("✅ Planeación borrada.");

    // 2. Borrar Partidas (Hija de Proyectos)
    console.log("🗑️  Borrando Partidas...");
    const { error: err2 } = await supabase.from("production_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err2) {
        console.error("❌ Error borrando partidas:", err2.message);
        return;
    }
    console.log("✅ Partidas borradas.");

    // 3. Borrar Proyectos (Padre)
    console.log("🗑️  Borrando Proyectos...");
    const { error: err3 } = await supabase.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err3) {
        console.error("❌ Error borrando proyectos:", err3.message);
        return;
    }
    console.log("✅ Proyectos borrados.");

    console.log("------------------------------------------");
    console.log("✨ BASE DE DATOS LIMPIA. LISTO PARA SINCRONIZAR.");
}

// Prompt user confirmation would be nice but difficult in non-interactive script via these tools. 
// We assume user knows what they are doing by running this specific script.
clearAll();
