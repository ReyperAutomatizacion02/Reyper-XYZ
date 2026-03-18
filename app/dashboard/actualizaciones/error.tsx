"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function ActualizacionesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Actualizaciones"
            message="No se pudo cargar las actualizaciones. Intenta de nuevo."
            reset={reset}
        />
    );
}
