"use client";

import React, { useState, useMemo } from "react";
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
import {
    Order,
    PlanningTask,
    SchedulingResult,
    SchedulingStrategy,
    generateAutomatedPlanning
} from "@/lib/scheduling-utils";

interface AutoPlanDialogProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    tasks: PlanningTask[];
    machines: string[];
    onSaveScenario: (data: { name: string; strategy: string; config: any; result: SchedulingResult }) => Promise<void>;
    scenarioCount: number;
    container?: HTMLElement | null;
}

const STRATEGIES: { id: SchedulingStrategy; label: string; icon: any; description: string }[] = [
    {
        id: "DELIVERY_DATE",
        label: "Prioridad x Entrega",
        icon: Calendar,
        description: "Prioriza piezas cuya fecha de entrega está más cerca o vencida."
    },
    {
        id: "CRITICAL_PATH",
        label: "Ruta Crítica",
        icon: Wand2,
        description: "Prioriza piezas con tratamiento externo para que salgan rápido de planta."
    },
    {
        id: "PROJECT_GROUP",
        label: "Por Proyecto",
        icon: Layers,
        description: "Agrupa todas las piezas de un mismo proyecto para entregarlos completos."
    },
    {
        id: "MATERIAL_OPTIMIZATION",
        label: "Optimización Material",
        icon: Package,
        description: "Agrupa por tipo de material para reducir cambios de herramienta y limpieza."
    },
    {
        id: "FAB_TIME",
        label: "Carga de Trabajo",
        icon: Clock,
        description: "Prioriza piezas con procesos más largos (Evitar cuellos de botella)."
    },
    {
        id: "FAST_TRACK",
        label: "Fast Track (Express)",
        icon: Zap,
        description: "Prioriza piezas cortas y rápidas para sacarlas rápido de planta."
    },
];

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
            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${checked
                ? "bg-primary/5 border-primary/20 shadow-sm"
                : "bg-background/50 border-border"
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                    <div className="text-xs font-black uppercase tracking-tight">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{description}</div>
                </div>
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only"
            />
            <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${checked ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? "translate-x-3" : ""}`} />
            </div>
        </label>
    );
}

/* ── Main Component ───────────────────────────────────────────── */
export function AutoPlanDialog({ isOpen, onClose, orders, tasks, machines, onSaveScenario, scenarioCount, container }: AutoPlanDialogProps) {
    const [mainStrategy, setMainStrategy] = useState<SchedulingStrategy>("DELIVERY_DATE");
    const [onlyWithCAD, setOnlyWithCAD] = useState(false);
    const [onlyWithBlueprint, setOnlyWithBlueprint] = useState(false);
    const [onlyWithMaterial, setOnlyWithMaterial] = useState(false);
    const [requireTreatment, setRequireTreatment] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const strategyLabel = STRATEGIES.find(s => s.id === mainStrategy)?.label || mainStrategy;
    const [scenarioName, setScenarioName] = useState("");

    // Auto-suggest name when strategy changes
    const suggestedName = `Escenario #${scenarioCount + 1}: ${strategyLabel}`;

    const result = useMemo(() => {
        if (!isOpen) return null;
        return generateAutomatedPlanning(orders, tasks, machines, {
            mainStrategy,
            onlyWithCAD,
            onlyWithBlueprint,
            onlyWithMaterial,
            requireTreatment
        });
    }, [isOpen, mainStrategy, onlyWithCAD, onlyWithBlueprint, onlyWithMaterial, requireTreatment, orders, tasks, machines]);

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
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
            <DialogPrimitive.Portal container={container}>
                {/* Overlay */}
                <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Content – using FIXED dimensions so nothing shifts */}
                <DialogPrimitive.Content
                    className="fixed z-[10001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 outline-none p-4"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {/* The actual dialog box */}
                    <div
                        className="bg-background rounded-3xl shadow-2xl overflow-hidden border-none data-[state=open]:animate-in data-[state=closed]:animate-out flex flex-col relative"
                        style={{
                            width: "min(90vw, 1100px)",
                            height: "min(85vh, 850px)",
                        }}
                    >
                        {/* sr-only titles for accessibility */}
                        <DialogPrimitive.Title className="sr-only">
                            Configuración de Auto-Plan
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                            Ajusta los parámetros para generar un escenario de producción.
                        </DialogPrimitive.Description>

                        {/* Close button */}

                        {/* Two-panel layout with CSS Grid – height is fixed by parent */}
                        <div className="h-full grid grid-cols-1 md:grid-cols-[2fr_3fr]">

                            {/* ─── LEFT PANEL: Configuration ─── */}
                            <div className="bg-muted/30 border-r border-border flex flex-col h-full overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-xl">
                                                <Wand2 className="w-5 h-5 text-primary" />
                                            </div>
                                            <h2 className="text-lg font-black tracking-tight uppercase">Configuración</h2>
                                        </div>
                                        <DialogPrimitive.Close className="rounded-full p-1.5 opacity-70 hover:opacity-100 transition-opacity hover:bg-muted">
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Close</span>
                                        </DialogPrimitive.Close>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium mb-5">
                                        Define las reglas de oro para este escenario de planeación.
                                    </p>

                                    {/* Strategies */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">
                                            Estrategia de Ordenamiento
                                        </label>
                                        <div className="grid gap-2">
                                            {STRATEGIES.map((s) => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setMainStrategy(s.id)}
                                                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all duration-200 group ${mainStrategy === s.id
                                                        ? "bg-background border-primary shadow-md ring-2 ring-primary/5"
                                                        : "bg-background/50 border-border hover:border-muted-foreground/30 hover:bg-background"
                                                        }`}
                                                >
                                                    <div
                                                        className={`p-2 rounded-xl shrink-0 transition-colors ${mainStrategy === s.id
                                                            ? "bg-primary text-white"
                                                            : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                                                            }`}
                                                    >
                                                        <s.icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-black uppercase tracking-tight">{s.label}</div>
                                                        <div className="text-[10px] text-muted-foreground leading-tight">{s.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Filters */}
                                    <div className="space-y-3 pt-4 border-t border-border">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">
                                            Filtros de Exclusión
                                        </label>
                                        <FilterToggle checked={onlyWithCAD} onChange={setOnlyWithCAD} icon={Layers} label="Modelo 3D Listo" description="Solo piezas con archivo 3D." />
                                        <FilterToggle checked={onlyWithBlueprint} onChange={setOnlyWithBlueprint} icon={FileCheck} label="Tiene Plano (PDF)" description="Solo piezas con hoja de plano." />
                                        <FilterToggle checked={onlyWithMaterial} onChange={setOnlyWithMaterial} icon={Package} label="Material Disponible" description="Solo con material liberado." />
                                        <FilterToggle checked={requireTreatment} onChange={setRequireTreatment} icon={Layers} label="Requiere Tratamiento" description="Filtrar solo piezas con proceso." />
                                    </div>
                                </div>
                            </div>

                            {/* ─── RIGHT PANEL: Results & Metrics ─── */}
                            <div className="flex flex-col h-full overflow-hidden bg-background relative">
                                {/* Decorative watermark */}
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <PieChart className="w-48 h-48" />
                                </div>

                                {/* Scrollable metrics area */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                                    <h3 className="text-lg font-black tracking-tight uppercase mb-5">Métricas del Escenario</h3>

                                    {result ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Capacity */}
                                            <div className="bg-muted/30 p-5 rounded-3xl border border-border/50">
                                                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                                    <LayoutDashboard className="w-3 h-3" /> Capacidad Ocupada
                                                </div>
                                                <div className="text-2xl font-black text-primary">
                                                    {result.metrics.totalTasks}{" "}
                                                    <span className="text-xs font-bold text-muted-foreground uppercase">Pasos</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    {result.metrics.totalHours.toFixed(1)} horas de maquinado.
                                                </div>
                                            </div>

                                            {/* Late orders */}
                                            <div
                                                className={`p-5 rounded-3xl border transition-all ${result.metrics.lateOrders > 0
                                                    ? "bg-red-500/5 border-red-500/20"
                                                    : "bg-green-500/5 border-green-500/20"
                                                    }`}
                                            >
                                                <div
                                                    className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${result.metrics.lateOrders > 0 ? "text-red-600" : "text-green-600"
                                                        }`}
                                                >
                                                    <AlertTriangle className="w-3 h-3" /> Entregas Tardías
                                                </div>
                                                <div className={`text-2xl font-black ${result.metrics.lateOrders > 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {result.metrics.lateOrders}{" "}
                                                    <span className="text-xs font-bold uppercase opacity-60">Piezas</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                                                    {result.metrics.lateOrders > 0
                                                        ? "Hay piezas que no llegarán a tiempo."
                                                        : "Todas las piezas cumplen su fecha."}
                                                </div>
                                            </div>

                                            {/* Impact summary */}
                                            <div className="bg-muted/30 p-5 rounded-3xl border border-border/50 col-span-2">
                                                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                                                    Impacto del Escenario
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-muted-foreground">Piezas en el Plan</span>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Info className="w-3 h-3 text-muted-foreground" />
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black">
                                                            {result.metrics.totalOrders}{" "}
                                                            <span className="text-[10px] text-muted-foreground font-normal">de {orders.length}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-muted-foreground">Lead Time (Tránsito)</span>
                                                        <span className="text-xs font-black">{result.metrics.avgLeadTimeDays.toFixed(1)} días</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-muted-foreground">Horas Totales Estimadas</span>
                                                        <span className="text-xs font-black">{result.metrics.totalHours.toFixed(1)} hrs</span>
                                                    </div>

                                                    {result.skipped.length > 0 && (
                                                        <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 border-dashed mt-2">
                                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                            <span className="text-[10px] text-amber-700 font-bold leading-tight uppercase tracking-tight">
                                                                {result.skipped.length} piezas excluidas por los filtros aplicados. Revisar métricas.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="p-4 bg-muted rounded-full mb-4">
                                                <LayoutDashboard className="w-8 h-8 text-muted-foreground/40" />
                                            </div>
                                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-tight">Cargando métricas...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Fixed action area pinned to bottom */}
                                <div className="shrink-0 p-6 pt-4 space-y-4 border-t border-border/10 bg-background/80 backdrop-blur-sm relative z-20">
                                    {/* Scenario name input */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">
                                            Nombre del Escenario
                                        </label>
                                        <input
                                            type="text"
                                            value={scenarioName}
                                            onChange={(e) => setScenarioName(e.target.value)}
                                            placeholder={suggestedName}
                                            className="w-full px-4 py-2.5 text-xs font-medium border border-border rounded-2xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50"
                                        />
                                    </div>
                                    <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10 border-dashed">
                                        <p className="text-[10px] text-primary/80 leading-relaxed font-medium">
                                            <span className="font-black uppercase mr-1 inline-block border-b border-primary/30">Guardar:</span>
                                            El escenario se guardará en Supabase para que puedas compararlo con otros. Los escenarios se eliminan automáticamente después de 7 días.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={handleSave}
                                            disabled={isSaving || !result || result.tasks.length === 0}
                                            className="flex-1 bg-primary hover:bg-primary/90 text-white font-black h-12 rounded-2xl shadow-lg shadow-primary/20 gap-2 uppercase tracking-tight disabled:opacity-50"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                            {isSaving ? "Guardando..." : "Guardar Escenario"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={onClose}
                                            className="px-6 font-bold h-12 rounded-2xl text-muted-foreground uppercase text-xs"
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
