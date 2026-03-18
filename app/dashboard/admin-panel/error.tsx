"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function AdminPanelError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorDisplay
            title="Error en Panel de Administración"
            message="No se pudo cargar el panel de administración. Intenta de nuevo."
            reset={reset}
        />
    );
}
