import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Internal utility — deletes all files in `quotes/{quoteId}/` using the Service Role Key.
 * NOT a server action. Must only be called from trusted server-side code
 * (e.g., after auth/role checks or from authenticated webhook routes).
 */
export async function deleteQuoteFilesInternal(quoteId: string) {
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[STORAGE] >>> INICIANDO LIMPIEZA DE CARPETA COTIZACIÓN: ${quoteId} (ADMIN)`);

    try {
        console.log(`[STORAGE] Listando archivos en 'quotes/${quoteId}'...`);
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from("quotes")
            .list(quoteId);

        if (listError) {
            console.error(`[STORAGE] [!] Error al listar 'quotes/${quoteId}':`, listError.message);
        } else if (files && files.length > 0) {
            const filesToRemove = files.map((f) => `${quoteId}/${f.name}`);
            console.log(`[STORAGE] Encontrados ${files.length} archivos en carpeta. Borrando uno a uno para mayor seguridad...`);

            for (const path of filesToRemove) {
                const { error: removeError } = await supabaseAdmin.storage.from("quotes").remove([path]);
                if (removeError) {
                    console.error(`[STORAGE] [FALLO] No se pudo borrar ${path} en 'quotes':`, removeError.message);
                } else {
                    console.log(`[STORAGE] [OK] Borrado exitoso: quotes/${path}`);
                }
            }
        } else {
            console.log(`[STORAGE] No se encontraron archivos directos en la carpeta 'quotes/${quoteId}'.`);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[STORAGE] [CRITICO] Excepción en limpieza de carpeta 'quotes':", message);
    }

    console.log(`[STORAGE] <<< FINALIZADA LIMPIEZA PARA COTIZACIÓN: ${quoteId}`);
}
