"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function AlmacenError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Almacén"
            message="No se pudo cargar la información de almacén. Intenta de nuevo."
            reset={reset}
        />
    );
}
