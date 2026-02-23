import { NextResponse } from 'next/server';
import { deleteQuoteFiles } from '@/app/dashboard/ventas/actions';

// Ensure this route is not statically optimized
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 1. Validate Secret Token to ensure the request comes from Supabase
        const authHeader = request.headers.get('Authorization');
        const expectedToken = process.env.SUPABASE_WEBHOOK_SECRET;

        // Si no hay token configurado en .env, permitimos por ahora pero avisamos (Idealmente siempre configurarlo)
        if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Parse the Webhook Payload
        const payload = await request.json();

        // 3. Check if it's a DELETE event from sales_quotes
        if (payload.type === 'DELETE' && payload.table === 'sales_quotes' && payload.old_record) {
            const quoteId = payload.old_record.id;

            if (!quoteId) {
                return new NextResponse('Bad Request: Missing quote ID in old_record', { status: 400 });
            }

            console.log(`[WEBHOOK] Recibido evento DELETE para la cotización: ${quoteId}. Iniciando limpieza de Storage...`);

            // 4. Execute the deletion using our robust, Admin-powered function
            await deleteQuoteFiles(quoteId);

            return NextResponse.json({ success: true, message: `Archivos de cotización ${quoteId} eliminados correctamente.` });
        }

        return new NextResponse('Ignorado: No es un evento DELETE de sales_quotes', { status: 200 });

    } catch (error: any) {
        console.error('[WEBHOOK ERROR] Fallo al procesar la limpieza de Storage:', error);
        return new NextResponse(`Error Interno: ${error.message}`, { status: 500 });
    }
}
