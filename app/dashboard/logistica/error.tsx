"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function LogisticaError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Logística"
            message="No se pudo cargar la información de logística. Intenta de nuevo."
            reset={reset}
        />
    );
}
