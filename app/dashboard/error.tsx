"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <ErrorDisplay reset={reset} />;
}
