"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import {
    Wand2,
    Calendar,
    Clock,
    Zap,
    FileCheck,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    Info,
    LayoutDashboard,
    PieChart,
    Package,
    Layers,
    X,
    Save,
    Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
    Order,
    PlanningTask,
    SchedulingResult,
    SchedulingStrategy,
    generateAutomatedPlanning,
    WorkShift,
    DEFAULT_SHIFTS,
} from "@/lib/scheduling-utils";

interface AutoPlanDialogProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    tasks: PlanningTask[];
    machines: string[];
    shifts?: WorkShift[];
    onSaveScenario: (data: { name: string; strategy: string; config: any; result: SchedulingResult }) => Promise<void>;
    scenarioCount: number;
    container?: HTMLElement | null;
}

const STRATEGY_LABEL = "Ruta Crítica";

/* ── Toggle Switch ────────────────────────────────────────────── */
function FilterToggle({
    checked,
    onChange,
    icon: Icon,
    label,
    description,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    icon: React.ElementType;
    label: string;
    description: string;
}) {
    return (
        <label
            className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all ${
                checked ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border bg-background/50"
            }`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                    <div className="text-xs font-black uppercase tracking-tight">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{description}</div>
                </div>
            </div>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
            <div
                className={`relative h-5 w-8 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
            >
                <div
                    className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3" : ""}`}
                />
            </div>
        </label>
    );
}

/* ── Main Component ───────────────────────────────────────────── */
export function AutoPlanDialog({
    isOpen,
    onClose,
    orders,
    tasks,
    machines,
    shifts = DEFAULT_SHIFTS,
    onSaveScenario,
    scenarioCount,
    container,
}: AutoPlanDialogProps) {
    const mainStrategy: SchedulingStrategy = "CRITICAL_PATH";
    const [onlyWithCAD, setOnlyWithCAD] = useState(false);
    const [onlyWithBlueprint, setOnlyWithBlueprint] = useState(false);
    const [onlyWithMaterial, setOnlyWithMaterial] = useState(false);
    const [requireTreatment, setRequireTreatment] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [scenarioName, setScenarioName] = useState("");
    const suggestedName = `Escenario #${scenarioCount + 1}: ${STRATEGY_LABEL}`;

    const [result, setResult] = useState<ReturnType<typeof generateAutomatedPlanning> | null>(null);
    const [isComputing, setIsComputing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const computeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setResult(null);
            setProgress(null);
            return;
        }

        setResult(null);
        setIsComputing(true);
        setProgress(null);

        if (computeTimeoutRef.current) clearTimeout(computeTimeoutRef.current);

        computeTimeoutRef.current = setTimeout(() => {
            const computed = generateAutomatedPlanning(
                orders,
                tasks,
                machines,
                { mainStrategy, onlyWithCAD, onlyWithBlueprint, onlyWithMaterial, requireTreatment },
                shifts,
                (current, total) => setProgress({ current, total })
            );
            setResult(computed);
            setIsComputing(false);
            setProgress(null);
        }, 50);

        return () => {
            if (computeTimeoutRef.current) clearTimeout(computeTimeoutRef.current);
        };
    }, [
        isOpen,
        mainStrategy,
        onlyWithCAD,
        onlyWithBlueprint,
        onlyWithMaterial,
        requireTreatment,
        orders,
        tasks,
        machines,
        shifts,
    ]);

    const handleSave = async () => {
        if (!result) return;
        if (result.tasks.length === 0) {
            toast.warning("No se generaron tareas con esta configuración.");
            return;
        }
        setIsSaving(true);
        try {
            await onSaveScenario({
                name: scenarioName || suggestedName,
                strategy: mainStrategy,
                config: { mainStrategy, onlyWithCAD, onlyWithBlueprint, onlyWithMaterial, requireTreatment },
                result,
            });
            setScenarioName("");
            onClose();
        } catch (err) {
            console.error("[AutoPlanDialog] Error saving scenario:", err);
            toast.error("No se pudo guardar el escenario. Intenta de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
            <DialogPrimitive.Portal container={container}>
                {/* Overlay */}
                <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Content – using FIXED dimensions so nothing shifts */}
                <DialogPrimitive.Content
                    className="fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 p-4 outline-none"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {/* The actual dialog box */}
                    <div
                        className="relative flex flex-col overflow-hidden rounded-3xl border-none bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out"
                        style={{
                            width: "min(90vw, 1100px)",
                            height: "min(85vh, 850px)",
                        }}
                    >
                        {/* sr-only titles for accessibility */}
                        <DialogPrimitive.Title className="sr-only">Configuración de Auto-Plan</DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                            Ajusta los parámetros para generar un escenario de producción.
                        </DialogPrimitive.Description>

                        {/* Close button */}

                        {/* Two-panel layout with CSS Grid – height is fixed by parent */}
                        <div className="grid h-full grid-cols-1 md:grid-cols-[2fr_3fr]">
                            {/* ─── LEFT PANEL: Configuration ─── */}
                            <div className="flex h-full flex-col overflow-hidden border-r border-border bg-muted/30">
                                <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-primary/10 p-2">
                                                <Wand2 className="h-5 w-5 text-primary" />
                                            </div>
                                            <h2 className="text-lg font-black uppercase tracking-tight">
                                                Configuración
                                            </h2>
                                        </div>
                                        <DialogPrimitive.Close className="rounded-full p-1.5 opacity-70 transition-opacity hover:bg-muted hover:opacity-100">
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Close</span>
                                        </DialogPrimitive.Close>
                                    </div>
                                    <p className="mb-5 text-[10px] font-medium text-muted-foreground">
                                        Define las reglas de oro para este escenario de planeación.
                                    </p>

                                    {/* Strategy */}
                                    <div className="space-y-2">
                                        <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Estrategia de Ordenamiento
                                        </label>
                                        <div className="flex items-start gap-3 rounded-2xl border border-primary bg-background p-3 shadow-md ring-2 ring-primary/5">
                                            <div className="shrink-0 rounded-xl bg-primary p-2 text-white">
                                                <Wand2 className="h-4 w-4" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-xs font-black uppercase tracking-tight">
                                                    Ruta Crítica
                                                </div>
                                                <div className="text-[10px] leading-tight text-muted-foreground">
                                                    Prioriza piezas con tratamiento externo para que salgan rápido de
                                                    planta.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filters */}
                                    <div className="space-y-3 border-t border-border pt-4">
                                        <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Filtros de Exclusión
                                        </label>
                                        <FilterToggle
                                            checked={onlyWithCAD}
                                            onChange={setOnlyWithCAD}
                                            icon={Layers}
                                            label="Modelo 3D Listo"
                                            description="Solo piezas con archivo 3D."
                                        />
                                        <FilterToggle
                                            checked={onlyWithBlueprint}
                                            onChange={setOnlyWithBlueprint}
                                            icon={FileCheck}
                                            label="Tiene Plano (PDF)"
                                            description="Solo piezas con hoja de plano."
                                        />
                                        <FilterToggle
                                            checked={onlyWithMaterial}
                                            onChange={setOnlyWithMaterial}
                                            icon={Package}
                                            label="Material Disponible"
                                            description="Solo con material liberado."
                                        />
                                        <FilterToggle
                                            checked={requireTreatment}
                                            onChange={setRequireTreatment}
                                            icon={Layers}
                                            label="Requiere Tratamiento"
                                            description="Filtrar solo piezas con proceso."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ─── RIGHT PANEL: Results & Metrics ─── */}
                            <div className="relative flex h-full flex-col overflow-hidden bg-background">
                                {/* Decorative watermark */}
                                <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-5">
                                    <PieChart className="h-48 w-48" />
                                </div>

                                {/* Scrollable metrics area */}
                                <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6">
                                    <h3 className="mb-5 text-lg font-black uppercase tracking-tight">
                                        Métricas del Escenario
                                    </h3>

                                    {isComputing ? (
                                        <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
                                            <div className="rounded-full bg-primary/10 p-4">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                            <div className="w-full max-w-xs space-y-2">
                                                <p className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                                                    {progress
                                                        ? `Calculando pieza ${progress.current} de ${progress.total}…`
                                                        : "Preparando cálculo…"}
                                                </p>
                                                <Progress
                                                    value={
                                                        progress && progress.total > 0
                                                            ? Math.round((progress.current / progress.total) * 100)
                                                            : 0
                                                    }
                                                    className="h-1.5"
                                                />
                                            </div>
                                        </div>
                                    ) : result ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Capacity */}
                                            <div className="rounded-3xl border border-border/50 bg-muted/30 p-5">
                                                <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    <LayoutDashboard className="h-3 w-3" /> Capacidad Ocupada
                                                </div>
                                                <div className="text-2xl font-black text-primary">
                                                    {result.metrics.totalTasks}{" "}
                                                    <span className="text-xs font-bold uppercase text-muted-foreground">
                                                        Pasos
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-[10px] text-muted-foreground">
                                                    {result.metrics.totalHours.toFixed(1)} horas de maquinado.
                                                </div>
                                            </div>

                                            {/* Late orders */}
                                            <div
                                                className={`rounded-3xl border p-5 transition-all ${
                                                    result.metrics.lateOrders > 0
                                                        ? "border-red-500/20 bg-red-500/5"
                                                        : "border-green-500/20 bg-green-500/5"
                                                }`}
                                            >
                                                <div
                                                    className={`mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                                                        result.metrics.lateOrders > 0
                                                            ? "text-red-600"
                                                            : "text-green-600"
                                                    }`}
                                                >
                                                    <AlertTriangle className="h-3 w-3" /> Entregas Tardías
                                                </div>
                                                <div
                                                    className={`text-2xl font-black ${result.metrics.lateOrders > 0 ? "text-red-600" : "text-green-600"}`}
                                                >
                                                    {result.metrics.lateOrders}{" "}
                                                    <span className="text-xs font-bold uppercase opacity-60">
                                                        Piezas
                                                    </span>
                                                </div>
                                                <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                                                    {result.metrics.lateOrders > 0
                                                        ? "Hay piezas que no llegarán a tiempo."
                                                        : "Todas las piezas cumplen su fecha."}
                                                </div>
                                            </div>

                                            {/* Impact summary */}
                                            <div className="col-span-2 rounded-3xl border border-border/50 bg-muted/30 p-5">
                                                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    Impacto del Escenario
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="group flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-muted-foreground">
                                                                Piezas en el Plan
                                                            </span>
                                                            <div className="opacity-0 transition-opacity group-hover:opacity-100">
                                                                <Info className="h-3 w-3 text-muted-foreground" />
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black">
                                                            {result.metrics.totalOrders}{" "}
                                                            <span className="text-[10px] font-normal text-muted-foreground">
                                                                de {orders.length}
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-muted-foreground">
                                                            Lead Time (Tránsito)
                                                        </span>
                                                        <span className="text-xs font-black">
                                                            {result.metrics.avgLeadTimeDays.toFixed(1)} días
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-muted-foreground">
                                                            Horas Totales Estimadas
                                                        </span>
                                                        <span className="text-xs font-black">
                                                            {result.metrics.totalHours.toFixed(1)} hrs
                                                        </span>
                                                    </div>

                                                    {result.skipped.length > 0 && (
                                                        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/10 p-3">
                                                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                                                            <span className="text-[10px] font-bold uppercase leading-tight tracking-tight text-amber-700">
                                                                {result.skipped.length} piezas excluidas por los filtros
                                                                aplicados. Revisar métricas.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="mb-4 rounded-full bg-muted p-4">
                                                <LayoutDashboard className="h-8 w-8 text-muted-foreground/40" />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                                                Sin resultados disponibles.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Fixed action area pinned to bottom */}
                                <div className="relative z-20 shrink-0 space-y-4 border-t border-border/10 bg-background/80 p-6 pt-4 backdrop-blur-sm">
                                    {/* Scenario name input */}
                                    <div className="space-y-1.5">
                                        <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Nombre del Escenario
                                        </label>
                                        <input
                                            type="text"
                                            value={scenarioName}
                                            onChange={(e) => setScenarioName(e.target.value)}
                                            placeholder={suggestedName}
                                            className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-2.5 text-xs font-medium transition-all placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="rounded-2xl border border-dashed border-primary/10 bg-primary/5 p-3">
                                        <p className="text-[10px] font-medium leading-relaxed text-primary/80">
                                            <span className="mr-1 inline-block border-b border-primary/30 font-black uppercase">
                                                Guardar:
                                            </span>
                                            El escenario se guardará en Supabase para que puedas compararlo con otros.
                                            Los escenarios se eliminan automáticamente después de 7 días.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={handleSave}
                                            disabled={isSaving || isComputing || !result || result.tasks.length === 0}
                                            className="h-12 flex-1 gap-2 rounded-2xl bg-primary font-black uppercase tracking-tight text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <Save className="h-5 w-5" />
                                            )}
                                            {isSaving ? "Guardando..." : "Guardar Escenario"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={onClose}
                                            className="h-12 rounded-2xl px-6 text-xs font-bold uppercase text-muted-foreground"
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
