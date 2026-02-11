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
        <div className={`text-center py-2 px-3 rounded-xl transition-all ${isBest ? "bg-green-500/10 ring-1 ring-green-500/20" : ""}`}>
            <div className={`text-sm font-black ${isBest ? "text-green-600" : ""}`}>{value}</div>
            <div className="text-[9px] text-muted-foreground uppercase font-bold">{unit}</div>
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
    container
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
                <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                <DialogPrimitive.Content
                    className="fixed z-[10001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 outline-none p-4"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div
                        className="bg-background rounded-3xl shadow-2xl overflow-hidden border-none flex flex-col relative"
                        style={{
                            width: "min(95vw, 1200px)",
                            height: "min(85vh, 800px)",
                        }}
                    >
                        <DialogPrimitive.Title className="sr-only">
                            Comparación de Escenarios
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                            Compara las métricas de cada escenario generado.
                        </DialogPrimitive.Description>


                        <div className="h-full flex flex-col">
                            {/* Header */}
                            <div className="shrink-0 p-6 pb-4 border-b border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <BarChart3 className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight uppercase">Comparar Escenarios</h2>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            {scenarios.length} escenario{scenarios.length !== 1 ? "s" : ""} guardado{scenarios.length !== 1 ? "s" : ""}. Se eliminan automáticamente después de 7 días.
                                        </p>
                                    </div>
                                </div>
                                <DialogPrimitive.Close className="rounded-full p-1.5 opacity-70 hover:opacity-100 transition-opacity hover:bg-muted">
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </DialogPrimitive.Close>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {scenarios.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="p-4 bg-muted rounded-full mb-4">
                                            <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-tight mb-1">
                                            Sin escenarios
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-xs">
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
                                                        <th className="text-left py-3 px-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Escenario</th>
                                                        <th className="text-center py-3 px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                            <div className="flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> Tareas</div>
                                                        </th>
                                                        <th className="text-center py-3 px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                            <div className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Horas</div>
                                                        </th>
                                                        <th className="text-center py-3 px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                            <div className="flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Tardías</div>
                                                        </th>
                                                        <th className="text-center py-3 px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                            <div className="flex items-center justify-center gap-1"><Calendar className="w-3 h-3" /> Lead Time</div>
                                                        </th>
                                                        <th className="text-center py-3 px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {scenarios.map((s) => (
                                                        <tr
                                                            key={s.id}
                                                            className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${activePreviewId === s.id ? "bg-primary/5 ring-1 ring-primary/10 rounded-lg" : ""
                                                                }`}
                                                        >
                                                            <td className="py-4 px-4">
                                                                <div className="flex items-center gap-3 min-w-[200px]">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-black uppercase tracking-tight line-clamp-1">{s.name}</span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {formatDate(s.created_at)} · {s.metrics.totalOrders} piezas
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 mt-1">
                                                                            {s.applied_at && (
                                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Aplicado
                                                                                </span>
                                                                            )}
                                                                            {activePreviewId === s.id && (
                                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                                                    <Eye className="w-2.5 h-2.5" /> Preview
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-3">
                                                                <MetricCell
                                                                    value={String(s.metrics.totalTasks)}
                                                                    unit="pasos"
                                                                    isBest={bestTasks === s.id}
                                                                />
                                                            </td>
                                                            <td className="py-4 px-3">
                                                                <MetricCell
                                                                    value={s.metrics.totalHours.toFixed(1)}
                                                                    unit="hrs"
                                                                    isBest={bestHours === s.id}
                                                                />
                                                            </td>
                                                            <td className="py-4 px-3">
                                                                <MetricCell
                                                                    value={String(s.metrics.lateOrders)}
                                                                    unit="piezas"
                                                                    isBest={bestLate === s.id}
                                                                />
                                                            </td>
                                                            <td className="py-4 px-3">
                                                                <MetricCell
                                                                    value={s.metrics.avgLeadTimeDays.toFixed(1)}
                                                                    unit="días"
                                                                    isBest={bestLead === s.id}
                                                                />
                                                            </td>
                                                            <td className="py-4 px-3">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => onPreview(s)}
                                                                        className={`h-8 w-8 p-0 rounded-xl ${activePreviewId === s.id ? "bg-primary/10 text-primary" : ""}`}
                                                                        title="Previsualizar en el Gantt"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleApply(s)}
                                                                        disabled={applyingId === s.id}
                                                                        className="h-8 w-8 p-0 rounded-xl text-green-600 hover:bg-green-500/10"
                                                                        title="Aplicar este escenario"
                                                                    >
                                                                        {applyingId === s.id ? (
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Play className="w-3.5 h-3.5" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setDeletingScenario({ id: s.id, name: s.name })}
                                                                        disabled={isDeleting}
                                                                        className="h-8 w-8 p-0 rounded-xl text-red-500 hover:bg-red-500/10"
                                                                        title="Eliminar escenario"
                                                                    >
                                                                        {isDeleting && deletingScenario?.id === s.id ? (
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="w-3.5 h-3.5" />
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
                                        {activePreviewId && (() => {
                                            const activeScenario = scenarios.find(s => s.id === activePreviewId);
                                            if (!activeScenario) return null;
                                            const entries = Object.entries(activeScenario.metrics.machineUtilization || {}).filter(([, h]) => h > 0);
                                            if (entries.length === 0) return null;
                                            return (
                                                <div className="bg-muted/30 rounded-3xl border border-border/50 p-5 mt-4">
                                                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3 flex items-center gap-2">
                                                        <BarChart3 className="w-3 h-3" /> Utilización por Máquina — {activeScenario.name}
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {entries.sort(([, a], [, b]) => b - a).map(([machine, hours]) => (
                                                            <div key={machine} className="bg-background rounded-2xl p-3 border border-border/30">
                                                                <div className="text-[10px] font-black uppercase tracking-tight text-muted-foreground truncate">{machine}</div>
                                                                <div className="text-sm font-black text-primary mt-0.5">{(hours as number).toFixed(1)} <span className="text-[10px] text-muted-foreground font-bold">hrs</span></div>
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
                <AlertDialogContent container={container} className="rounded-3xl border-none shadow-2xl max-w-[400px]">
                    <AlertDialogHeader className="items-center text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                            <Trash2 className="w-8 h-8 text-[#EC1C21]" />
                        </div>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">¿Eliminar Escenario?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            Vas a eliminar <span className="text-foreground font-bold">"{deletingScenario?.name}"</span>.
                            Esta acción es permanente y no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
                        <AlertDialogCancel className="rounded-xl border-none bg-muted hover:bg-muted/80 font-bold px-6">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="rounded-xl bg-[#EC1C21] hover:bg-[#EC1C21]/90 text-white font-black px-6 shadow-lg shadow-red-500/20"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Sí, Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DialogPrimitive.Root>
    );
}
