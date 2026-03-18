"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function DisenoError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Diseño"
            message="No se pudo cargar la información de diseño. Intenta de nuevo."
            reset={reset}
        />
    );
}
