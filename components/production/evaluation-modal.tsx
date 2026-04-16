import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { X, Trash2, Wrench, ChevronRight, ChevronLeft, FileText, AlertTriangle, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { extractDriveFileId } from "@/lib/drive-utils";
import { type EvaluationStep, type MachineStep, isTreatmentStep } from "@/lib/scheduling-utils";
import { useEvaluationSave } from "./hooks/use-evaluation-save";
import { emptyMachineStep, isStepComplete, computeHours, formatHours } from "./evaluation-utils";

interface EvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: {
        id: string;
        part_code: string;
        part_name: string | null;
        quantity?: number | null;
        evaluation?: EvaluationStep[] | null;
        drawing_url?: string;
        urgencia?: boolean;
    } | null;
    machines: { name: string }[];
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    onSuccess: (steps: EvaluationStep[], urgencia?: boolean) => void;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    container?: HTMLElement | null;
}

export function EvaluationModal({
    isOpen,
    onClose,
    order,
    machines,
    treatments,
    onSuccess,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
    container,
}: EvaluationModalProps) {
    const [steps, setSteps] = useState<EvaluationStep[]>(order?.evaluation || [emptyMachineStep()]);
    const [urgencia, setUrgencia] = useState(order?.urgencia || false);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);

    const { isSaving, confirmModal, setConfirmModal, handleSave } = useEvaluationSave({
        order,
        urgencia,
        onSuccess,
        hasNext,
        onNext,
        onClose,
    });

    // Sync state when order changes
    React.useEffect(() => {
        if (order) {
            const initialSteps: EvaluationStep[] = [...(order.evaluation || [])];
            setUrgencia(order.urgencia || false);

            if (initialSteps.length === 0) {
                initialSteps.push(emptyMachineStep());
            } else {
                const lastStep = initialSteps[initialSteps.length - 1];
                if (lastStep && isStepComplete(lastStep)) {
                    initialSteps.push(emptyMachineStep());
                }
            }
            setSteps(initialSteps);
        }
    }, [order]);

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);

        if (newSteps.length === 0) {
            newSteps.push(emptyMachineStep());
        } else {
            const last = newSteps[newSteps.length - 1];
            if (isStepComplete(last)) {
                newSteps.push(emptyMachineStep());
            }
        }

        setSteps(newSteps);
    };

    const toggleStepType = (index: number) => {
        const newSteps = [...steps];
        const current = newSteps[index];
        if (isTreatmentStep(current)) {
            newSteps[index] = emptyMachineStep();
        } else {
            newSteps[index] = { type: "treatment", treatment_id: "", treatment: "", days: 0 };
        }
        setSteps(newSteps);
    };

    const updateMachineStep = (
        index: number,
        field: "machine" | "setup_time" | "machining_time" | "piece_change_time",
        value: string | number
    ) => {
        const newSteps = [...steps];
        const step = newSteps[index];
        if (isTreatmentStep(step)) return;
        const qty = Math.max(1, order?.quantity ?? 1);
        const updated: MachineStep = { ...step, [field]: value };
        updated.hours = computeHours(updated, qty);
        newSteps[index] = updated;

        const isLastStep = index === newSteps.length - 1;
        if (isLastStep && isStepComplete(newSteps[index])) {
            newSteps.push(emptyMachineStep());
        }
        setSteps(newSteps);
    };

    const updateTreatmentStep = (index: number, field: "treatment" | "days", value: string | number) => {
        const newSteps = [...steps];
        const step = newSteps[index];
        if (!isTreatmentStep(step)) return;
        newSteps[index] = { ...step, [field]: value } as EvaluationStep;

        const isLastStep = index === newSteps.length - 1;
        if (isLastStep && isStepComplete(newSteps[index])) {
            newSteps.push(emptyMachineStep());
        }
        setSteps(newSteps);
    };

    const handleTreatmentSelect = (index: number, treatmentId: string) => {
        const catalog = treatments.find((t) => t.id === treatmentId);
        const defaultDays = catalog?.avg_lead_days ?? 1;
        const newSteps = [...steps];
        const step = newSteps[index];
        if (!isTreatmentStep(step)) return;
        newSteps[index] = {
            type: "treatment",
            treatment_id: treatmentId,
            treatment: catalog?.name ?? "",
            days: step.days > 0 ? step.days : defaultDays,
        };

        const isLastStep = index === newSteps.length - 1;
        if (isLastStep && isStepComplete(newSteps[index])) {
            newSteps.push(emptyMachineStep());
        }
        setSteps(newSteps);
    };

    const hasDrawing = !!order?.drawing_url;
    const fileId = hasDrawing ? extractDriveFileId(order!.drawing_url!) : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                container={container}
                className={`${hasDrawing ? "sm:max-w-[95vw] lg:max-w-7xl" : "sm:max-w-[600px]"} z-modal flex h-[95vh] flex-col overflow-hidden rounded-2xl border-none bg-background p-0 shadow-2xl [&>button]:hidden`}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className={`flex flex-1 overflow-hidden ${hasDrawing ? "flex-row" : "flex-col"}`}>
                    {/* Left Panel: Blueprint Viewer (Only if exists) */}
                    {hasDrawing && (
                        <div className="flex h-full min-w-0 flex-1 flex-col border-r border-border bg-muted/5">
                            <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 p-4">
                                <h3 className="flex items-center gap-2 text-sm font-bold">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Plano de Fabricación
                                </h3>
                                {order?.drawing_url && !fileId && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px]"
                                        onClick={() => window.open(order?.drawing_url, "_blank")}
                                    >
                                        Abrir en pestaña nueva
                                    </Button>
                                )}
                            </div>
                            <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[#1a1a1a]">
                                {fileId ? (
                                    <iframe
                                        src={`https://drive.google.com/file/d/${fileId}/preview`}
                                        className="block h-full w-full border-none"
                                        allow="autoplay"
                                        title="Blueprint Preview"
                                    ></iframe>
                                ) : (
                                    <div className="m-4 flex max-w-sm flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-background/50 p-8 text-center shadow-inner">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 shadow-sm">
                                            <FileText className="h-8 w-8 text-amber-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold">Vista Previa No Disponible</h4>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                Este archivo no se puede visualizar directamente. Usa el botón de arriba
                                                para abrirlo en una pestaña nueva.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`${hasDrawing ? "w-[450px]" : "w-full"} flex flex-col`}>
                        {order && (
                            <DialogHeader className="relative shrink-0 bg-gradient-to-br from-red-600 to-red-700 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl border border-white/30 bg-white/20 p-3 shadow-inner backdrop-blur-sm">
                                            <Wrench className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <DialogTitle className="mb-1 text-xl font-black leading-none tracking-tight">
                                                {order.part_code}
                                            </DialogTitle>
                                            <DialogDescription className="text-xs font-medium leading-tight text-red-100 opacity-90">
                                                {order.part_name}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {hasPrevious && onPrevious && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onPrevious}
                                                className="h-7 w-7 text-white hover:bg-white/20"
                                                title="Anterior Piece"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {hasNext && onNext && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onNext}
                                                className="h-7 w-7 text-white hover:bg-white/20"
                                                title="Siguiente Piece"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <DialogClose asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="ml-2 h-7 w-7 text-white hover:bg-white/20"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </div>
                            </DialogHeader>
                        )}

                        <div className="flex flex-1 flex-col space-y-4 overflow-hidden p-6">
                            <div className="shrink-0 space-y-1">
                                <h2 className="text-base font-bold">Evaluar Pieza</h2>
                                <p className="text-[11px] text-muted-foreground">
                                    Asignación de máquinas, tratamientos y tiempos estimados
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500">
                                        <AlertTriangle className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] font-black uppercase leading-none text-red-700">
                                            Pedido Urgente
                                        </Label>
                                        <p className="text-[10px] font-medium text-red-600">
                                            Priorizar en planeación automática
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={urgencia}
                                    onCheckedChange={setUrgencia}
                                    className="data-[state=checked]:bg-red-600"
                                />
                            </div>

                            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                                {steps.map((step, index) => {
                                    const isTreatment = isTreatmentStep(step);
                                    return (
                                        <div
                                            key={index}
                                            className={`group relative flex items-start gap-3 border-b border-border/50 pb-4 last:border-0`}
                                        >
                                            {/* Type toggle button */}
                                            <div
                                                className="flex shrink-0 flex-col gap-1"
                                                style={{ paddingBottom: "2px" }}
                                            >
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground opacity-0">
                                                    T
                                                </Label>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStepType(index)}
                                                    title={isTreatment ? "Cambiar a Máquina" : "Cambiar a Tratamiento"}
                                                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                                                        isTreatment
                                                            ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                                                    }`}
                                                >
                                                    {isTreatment ? (
                                                        <FlaskConical className="h-4 w-4" />
                                                    ) : (
                                                        <Wrench className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>

                                            {isTreatment ? (
                                                <>
                                                    <div className="flex-1 space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-amber-600">
                                                            Paso {index + 1}: Tratamiento
                                                        </Label>
                                                        <SearchableSelect
                                                            value={step.treatment_id}
                                                            onChange={(val) => handleTreatmentSelect(index, val)}
                                                            placeholder="Seleccionar tratamiento"
                                                            options={treatments.map((t) => ({
                                                                value: t.id,
                                                                label:
                                                                    t.avg_lead_days != null
                                                                        ? `${t.name} (${t.avg_lead_days}d)`
                                                                        : t.name,
                                                            }))}
                                                        />
                                                    </div>

                                                    <div className="w-20 space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-amber-600">
                                                            Días
                                                        </Label>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                min="0.5"
                                                                step="0.5"
                                                                value={step.days || ""}
                                                                onChange={(e) =>
                                                                    updateTreatmentStep(
                                                                        index,
                                                                        "days",
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
                                                                className="h-9 border-amber-200 pr-6 text-xs focus:border-amber-500"
                                                            />
                                                            <FlaskConical className="absolute right-2 top-3 h-3 w-3 text-amber-400" />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex-1 space-y-2.5">
                                                    {/* Machine selector */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                                                            Paso {index + 1}: Máquina
                                                        </Label>
                                                        <SearchableSelect
                                                            value={step.machine}
                                                            onChange={(val) => updateMachineStep(index, "machine", val)}
                                                            placeholder="Seleccionar"
                                                            options={machines.map((m) => ({
                                                                value: m.name,
                                                                label: m.name,
                                                            }))}
                                                        />
                                                    </div>

                                                    {/* Time breakdown */}
                                                    {(() => {
                                                        const qty = Math.max(1, order?.quantity ?? 1);
                                                        const isMulti = qty > 1;
                                                        const mkInput = (
                                                            field:
                                                                | "setup_time"
                                                                | "machining_time"
                                                                | "piece_change_time",
                                                            val: number,
                                                            disabled?: boolean
                                                        ) => {
                                                            const h = Math.floor(val);
                                                            const m = Math.round((val % 1) * 60);
                                                            return (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        placeholder="0"
                                                                        disabled={disabled}
                                                                        value={h > 0 ? h : ""}
                                                                        onChange={(e) => {
                                                                            const newH = parseInt(e.target.value) || 0;
                                                                            updateMachineStep(
                                                                                index,
                                                                                field,
                                                                                newH + m / 60
                                                                            );
                                                                        }}
                                                                        className="h-8 w-11 px-1 text-center text-xs disabled:opacity-40"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                                        h
                                                                    </span>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="59"
                                                                        step="5"
                                                                        placeholder="0"
                                                                        disabled={disabled}
                                                                        value={m > 0 ? m : ""}
                                                                        onChange={(e) => {
                                                                            const newM = Math.min(
                                                                                59,
                                                                                parseInt(e.target.value) || 0
                                                                            );
                                                                            updateMachineStep(
                                                                                index,
                                                                                field,
                                                                                h + newM / 60
                                                                            );
                                                                        }}
                                                                        className="h-8 w-11 px-1 text-center text-xs disabled:opacity-40"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                                        m
                                                                    </span>
                                                                </div>
                                                            );
                                                        };
                                                        return (
                                                            <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">
                                                                        Set Up Inicial
                                                                    </Label>
                                                                    {mkInput("setup_time", step.setup_time ?? 0)}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">
                                                                        Maquinado / pieza
                                                                    </Label>
                                                                    {mkInput(
                                                                        "machining_time",
                                                                        step.machining_time ?? 0
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label
                                                                        className={`text-[9px] font-black uppercase ${isMulti ? "text-muted-foreground" : "text-muted-foreground/40"}`}
                                                                    >
                                                                        Set Up / cambio
                                                                    </Label>
                                                                    {mkInput(
                                                                        "piece_change_time",
                                                                        step.piece_change_time ?? 0,
                                                                        !isMulti
                                                                    )}
                                                                </div>
                                                                <div className="col-span-3 flex items-center justify-between pt-0.5">
                                                                    <span className="text-[9px] text-muted-foreground">
                                                                        {isMulti ? `${qty} piezas` : "1 pieza"}
                                                                    </span>
                                                                    <span className="text-[10px] font-black text-foreground/70">
                                                                        Total: {formatHours(step.hours)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeStep(index)}
                                                className="h-9 w-9 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border pt-4">
                                <Button
                                    onClick={() => handleSave(steps)}
                                    disabled={isSaving}
                                    className="h-11 w-full bg-brand font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90"
                                >
                                    {isSaving ? "GUARDANDO..." : "GUARDAR EVALUACIÓN"}
                                </Button>
                                <DialogClose asChild>
                                    <Button
                                        variant="ghost"
                                        disabled={isSaving}
                                        className="h-9 w-full text-xs font-bold"
                                    >
                                        CANCELAR
                                    </Button>
                                </DialogClose>
                            </div>
                        </div>
                    </div>
                </div>

                <AlertDialog open={!!confirmModal} onOpenChange={(open) => !open && setConfirmModal(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-black uppercase tracking-tight">
                                {confirmModal?.title}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="whitespace-pre-wrap leading-relaxed">
                                {confirmModal?.message}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                            <AlertDialogAction
                                onClick={confirmModal?.onConfirm}
                                className={confirmModal?.type === "warning" ? "bg-red-600 hover:bg-red-700" : ""}
                            >
                                {confirmModal?.type === "warning" ? "ENTENDIDO" : "CONTINUAR"}
                            </AlertDialogAction>
                            {confirmModal?.type === "info" && <AlertDialogCancel>CANCELAR</AlertDialogCancel>}
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
