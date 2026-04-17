import { NextResponse } from "next/server";
import { deleteQuoteFilesInternal } from "@/lib/storage-utils";
import logger from "@/utils/logger";

// Ensure this route is not statically optimized
export const dynamic = "force-dynamic";

// In-process rate limiter: max 30 requests per minute per IP.
// Sufficient for a server-to-server webhook called by Supabase infrastructure.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    if (entry.count >= RATE_LIMIT) return true;
    entry.count++;
    return false;
}

export async function POST(request: Request) {
    try {
        const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

        if (isRateLimited(ip)) {
            logger.warn(`[WEBHOOK] Rate limit excedido para IP: ${ip}`);
            return new NextResponse("Too Many Requests", { status: 429 });
        }

        // 1. Validate Secret Token to ensure the request comes from Supabase
        const authHeader = request.headers.get("Authorization");
        const expectedToken = process.env.SUPABASE_WEBHOOK_SECRET;

        // SEGURIDAD: Rechazar si el token no está configurado en el servidor
        if (!expectedToken) {
            console.error("[WEBHOOK] SUPABASE_WEBHOOK_SECRET no configurado. Rechazando request por seguridad.");
            return new NextResponse("Server misconfigured", { status: 500 });
        }

        if (authHeader !== `Bearer ${expectedToken}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 2. Parse the Webhook Payload
        const payload = await request.json();

        // 3. Check if it's a DELETE event from sales_quotes
        if (payload.type === "DELETE" && payload.table === "sales_quotes" && payload.old_record) {
            const quoteId = payload.old_record.id;

            if (!quoteId) {
                return new NextResponse("Bad Request: Missing quote ID in old_record", { status: 400 });
            }

            logger.info(
                `[WEBHOOK] Recibido evento DELETE para la cotización: ${quoteId}. Iniciando limpieza de Storage...`
            );

            // 4. Execute the deletion using our robust, Admin-powered function
            await deleteQuoteFilesInternal(quoteId);

            return NextResponse.json({
                success: true,
                message: `Archivos de cotización ${quoteId} eliminados correctamente.`,
            });
        }

        return new NextResponse("Ignorado: No es un evento DELETE de sales_quotes", { status: 200 });
    } catch (error: unknown) {
        logger.error("[WEBHOOK ERROR] Fallo al procesar la limpieza de Storage:", error);
        return new NextResponse("Error interno del servidor.", { status: 500 });
    }
}
