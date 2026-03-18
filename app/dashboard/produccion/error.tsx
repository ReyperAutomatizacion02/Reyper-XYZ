"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function ProduccionError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Producción"
            message="No se pudo cargar la información de producción. Intenta de nuevo."
            reset={reset}
        />
    );
}
