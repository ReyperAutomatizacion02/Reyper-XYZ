"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorDisplayProps {
    title?: string;
    message?: string;
    reset: () => void;
}

export function ErrorDisplay({
    title = "Algo salió mal",
    message = "Ocurrió un error inesperado. Intenta de nuevo.",
    reset,
}: ErrorDisplayProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-muted-foreground text-center max-w-md">{message}</p>
            <Button onClick={reset} variant="default">
                Reintentar
            </Button>
        </div>
    );
}
