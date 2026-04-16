"use client";

import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import {
    Eye,
    Play,
    Trash2,
    X,
    BarChart3,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Loader2,
    TrendingUp,
    ArrowRight,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SavedScenario, ScenarioMetrics } from "@/lib/scheduling-utils";

interface ScenarioComparisonProps {
    isOpen: boolean;
    onClose: () => void;
    scenarios: SavedScenario[];
    onPreview: (scenario: SavedScenario) => void;
    onApply: (scenario: SavedScenario) => Promise<void>;
    onDelete: (scenarioId: string) => Promise<void>;
    activePreviewId: string | null;
    container?: HTMLElement | null;
}

function getBestMetric(scenarios: SavedScenario[], key: keyof ScenarioMetrics, lower = true): string | null {
    if (scenarios.length < 2) return null;
    let bestId = scenarios[0].id;
    let bestVal = scenarios[0].metrics[key] as number;
    for (const s of scenarios) {
        const val = s.metrics[key] as number;
        if (lower ? val < bestVal : val > bestVal) {
            bestVal = val;
            bestId = s.id;
        }
    }
    return bestId;
}

function MetricCell({ value, unit, isBest }: { value: string; unit: string; isBest: boolean }) {
    return (
        <div
            className={`rounded-xl px-3 py-2 text-center transition-all ${isBest ? "bg-green-500/10 ring-1 ring-green-500/20" : ""}`}
        >
            <div className={`text-sm font-black ${isBest ? "text-green-600" : ""}`}>{value}</div>
            <div className="text-[9px] font-bold uppercase text-muted-foreground">{unit}</div>
        </div>
    );
}

export function ScenarioComparison({
    isOpen,
    onClose,
    scenarios,
    onPreview,
    onApply,
    onDelete,
    activePreviewId,
    container,
}: ScenarioComparisonProps) {
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [deletingScenario, setDeletingScenario] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const bestTasks = getBestMetric(scenarios, "totalTasks", false);
    const bestHours = getBestMetric(scenarios, "totalHours", false);
    const bestLate = getBestMetric(scenarios, "lateOrders", true);
    const bestLead = getBestMetric(scenarios, "avgLeadTimeDays", true);

    const handleApply = async (scenario: SavedScenario) => {
        setApplyingId(scenario.id);
        try {
            await onApply(scenario);
        } finally {
            setApplyingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deletingScenario) return;
        setIsDeleting(true);
        try {
            await onDelete(deletingScenario.id);
            setDeletingScenario(null);
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
            <DialogPrimitive.Portal container={container}>
                <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                <DialogPrimitive.Content
                    className="fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 p-4 outline-none"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div
                        className="relative flex flex-col overflow-hidden rounded-3xl border-none bg-background shadow-2xl"
                        style={{
                            width: "min(95vw, 1200px)",
                            height: "min(85vh, 800px)",
                        }}
                    >
                        <DialogPrimitive.Title className="sr-only">Comparación de Escenarios</DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                            Compara las métricas de cada escenario generado.
                        </DialogPrimitive.Description>

                        <div className="flex h-full flex-col">
                            {/* Header */}
                            <div className="flex shrink-0 items-center justify-between border-b border-border/50 p-6 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-primary/10 p-2">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black uppercase tracking-tight">
                                            Comparar Escenarios
                                        </h2>
                                        <p className="text-[10px] font-medium text-muted-foreground">
                                            {scenarios.length} escenario{scenarios.length !== 1 ? "s" : ""} guardado
                                            {scenarios.length !== 1 ? "s" : ""}. Se eliminan automáticamente después de
                                            7 días.
                                        </p>
                                    </div>
                                </div>
                                <DialogPrimitive.Close className="rounded-full p-1.5 opacity-70 transition-opacity hover:bg-muted hover:opacity-100">
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </DialogPrimitive.Close>
                            </div>

                            {/* Content */}
                            <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
                                {scenarios.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-center">
                                        <div className="mb-4 rounded-full bg-muted p-4">
                                            <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="mb-1 text-sm font-bold uppercase tracking-tight text-muted-foreground">
                                            Sin escenarios
                                        </p>
                                        <p className="max-w-xs text-xs text-muted-foreground">
                                            Genera escenarios desde el Auto-Plan para compararlos aquí.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Comparison Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            Escenario
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <TrendingUp className="h-3 w-3" /> Tareas
                                                            </div>
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Clock className="h-3 w-3" /> Horas
                                                            </div>
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <AlertTriangle className="h-3 w-3" /> Tardías
                                                            </div>
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Calendar className="h-3 w-3" /> Lead Time
                                                            </div>
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            Acciones
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {scenarios.map((s) => (
                                                        <tr
                                                            key={s.id}
                                                            className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
                                                                activePreviewId === s.id
                                                                    ? "rounded-lg bg-primary/5 ring-1 ring-primary/10"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <td className="px-4 py-4">
                                                                <div className="flex min-w-[200px] items-center gap-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="line-clamp-1 text-xs font-black uppercase tracking-tight">
                                                                            {s.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {formatDate(s.created_at)} ·{" "}
                                                                            {s.metrics.totalOrders} piezas
                                                                        </span>
                                                                        <div className="mt-1 flex items-center gap-1.5">
                                                                            {s.applied_at && (
                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-bold text-green-600">
                                                                                    <CheckCircle2 className="h-2.5 w-2.5" />{" "}
                                                                                    Aplicado
                                                                                </span>
                                                                            )}
                                                                            {activePreviewId === s.id && (
                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                                                                                    <Eye className="h-2.5 w-2.5" />{" "}
                                                                                    Preview
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-4">
                                                                <MetricCell
                                                                    value={String(s.metrics.totalTasks)}
                                                                    unit="pasos"
                                                                    isBest={bestTasks === s.id}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-4">
                                                                <MetricCell
                                                                    value={s.metrics.totalHours.toFixed(1)}
                                                                    unit="hrs"
                                                                    isBest={bestHours === s.id}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-4">
                                                                <MetricCell
                                                                    value={String(s.metrics.lateOrders)}
                                                                    unit="piezas"
                                                                    isBest={bestLate === s.id}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-4">
                                                                <MetricCell
                                                                    value={s.metrics.avgLeadTimeDays.toFixed(1)}
                                                                    unit="días"
                                                                    isBest={bestLead === s.id}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-4">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => onPreview(s)}
                                                                        className={`h-8 w-8 rounded-xl p-0 ${activePreviewId === s.id ? "bg-primary/10 text-primary" : ""}`}
                                                                        title="Previsualizar en el Gantt"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleApply(s)}
                                                                        disabled={applyingId === s.id}
                                                                        className="h-8 w-8 rounded-xl p-0 text-green-600 hover:bg-green-500/10"
                                                                        title="Aplicar este escenario"
                                                                    >
                                                                        {applyingId === s.id ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Play className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            setDeletingScenario({
                                                                                id: s.id,
                                                                                name: s.name,
                                                                            })
                                                                        }
                                                                        disabled={isDeleting}
                                                                        className="h-8 w-8 rounded-xl p-0 text-red-500 hover:bg-red-500/10"
                                                                        title="Eliminar escenario"
                                                                    >
                                                                        {isDeleting && deletingScenario?.id === s.id ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Machine utilization details for previewed scenario */}
                                        {activePreviewId &&
                                            (() => {
                                                const activeScenario = scenarios.find((s) => s.id === activePreviewId);
                                                if (!activeScenario) return null;
                                                const entries = Object.entries(
                                                    activeScenario.metrics.machineUtilization || {}
                                                ).filter(([, h]) => h > 0);
                                                if (entries.length === 0) return null;
                                                return (
                                                    <div className="mt-4 rounded-3xl border border-border/50 bg-muted/30 p-5">
                                                        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <BarChart3 className="h-3 w-3" /> Utilización por Máquina —{" "}
                                                            {activeScenario.name}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                                            {entries
                                                                .sort(([, a], [, b]) => b - a)
                                                                .map(([machine, hours]) => (
                                                                    <div
                                                                        key={machine}
                                                                        className="rounded-2xl border border-border/30 bg-background p-3"
                                                                    >
                                                                        <div className="truncate text-[10px] font-black uppercase tracking-tight text-muted-foreground">
                                                                            {machine}
                                                                        </div>
                                                                        <div className="mt-0.5 text-sm font-black text-primary">
                                                                            {(hours as number).toFixed(1)}{" "}
                                                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                                                hrs
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>

            {/* Premium Delete Confirmation */}
            <AlertDialog open={!!deletingScenario} onOpenChange={(open) => !open && setDeletingScenario(null)}>
                <AlertDialogContent container={container} className="max-w-[400px] rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader className="items-center text-center">
                        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                            <Trash2 className="h-8 w-8 text-brand" />
                        </div>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">
                            ¿Eliminar Escenario?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            Vas a eliminar <span className="font-bold text-foreground">"{deletingScenario?.name}"</span>
                            . Esta acción es permanente y no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-3 sm:justify-center">
                        <AlertDialogCancel className="rounded-xl border-none bg-muted px-6 font-bold hover:bg-muted/80">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="rounded-xl bg-brand px-6 font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sí, Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DialogPrimitive.Root>
    );
}
