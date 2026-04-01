import { createClient as createAdminClient } from "@supabase/supabase-js";
import logger from "@/utils/logger";

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

    logger.info(`[STORAGE] >>> INICIANDO LIMPIEZA DE CARPETA COTIZACIÓN: ${quoteId} (ADMIN)`);

    try {
        logger.debug(`[STORAGE] Listando archivos en 'quotes/${quoteId}'...`);
        const { data: files, error: listError } = await supabaseAdmin.storage.from("quotes").list(quoteId);

        if (listError) {
            logger.error(`[STORAGE] [!] Error al listar 'quotes/${quoteId}':`, listError.message);
        } else if (files && files.length > 0) {
            const filesToRemove = files.map((f) => `${quoteId}/${f.name}`);
            logger.info(`[STORAGE] Encontrados ${files.length} archivos en carpeta. Borrando en batch...`);

            const { error: removeError } = await supabaseAdmin.storage.from("quotes").remove(filesToRemove);
            if (removeError) {
                logger.error(
                    `[STORAGE] [FALLO] No se pudo borrar archivos en 'quotes/${quoteId}':`,
                    removeError.message
                );
            } else {
                logger.debug(`[STORAGE] [OK] Borrado exitoso: ${filesToRemove.length} archivos en quotes/${quoteId}`);
            }
        } else {
            logger.debug(`[STORAGE] No se encontraron archivos directos en la carpeta 'quotes/${quoteId}'.`);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error("[STORAGE] [CRITICO] Excepción en limpieza de carpeta 'quotes':", message);
    }

    logger.info(`[STORAGE] <<< FINALIZADA LIMPIEZA PARA COTIZACIÓN: ${quoteId}`);
}
