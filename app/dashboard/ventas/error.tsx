"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function VentasError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Ventas"
            message="No se pudo cargar la información de ventas. Intenta de nuevo."
            reset={reset}
        />
    );
}
