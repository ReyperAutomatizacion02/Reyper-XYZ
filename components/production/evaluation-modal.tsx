import React, { useState } from 'react';
import {
    Dialog, DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
// Assuming these exist, if not I'll adjust
import { Button } from "@/components/ui/button";
import { X, Trash2, Clock, Wrench, Save, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, FileText, AlertTriangle, Info } from "lucide-react";
import * as moment from 'moment';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { extractDriveFileId } from "@/lib/drive-utils";

interface EvaluationStep {
    machine: string;
    hours: number;
}

interface EvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: {
        id: string;
        part_code: string;
        part_name: string;
        evaluation?: EvaluationStep[] | null;
        drawing_url?: string;
    } | null;
    machines: { name: string }[];
    onSuccess: (steps: EvaluationStep[]) => void;
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
    onSuccess,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
    container
}: EvaluationModalProps) {
    const [steps, setSteps] = useState<EvaluationStep[]>(
        order?.evaluation || [{ machine: "", hours: 0 }]
    );
    const [isSaving, setIsSaving] = useState(false);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        type: 'warning' | 'info';
        onConfirm: () => void;
    } | null>(null);
    const supabase = createClient();

    // Sync state when order changes
    React.useEffect(() => {
        if (order) {
            let initialSteps = [...(order.evaluation || [])];

            // Ensure there's always at least one step
            if (initialSteps.length === 0) {
                initialSteps.push({ machine: "", hours: 0 });
            } else {
                // If the last step is already complete, add an empty one at the end
                const lastStep = initialSteps[initialSteps.length - 1];
                if (lastStep && lastStep.machine && lastStep.hours > 0) {
                    initialSteps.push({ machine: "", hours: 0 });
                }
            }
            setSteps(initialSteps);
        }
    }, [order]);

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);

        // Ensure there's always at least one step, and always one empty if the rest are filled
        if (newSteps.length === 0) {
            newSteps.push({ machine: "", hours: 0 });
        } else {
            const lastRemaining = newSteps[newSteps.length - 1];
            if (lastRemaining.machine && lastRemaining.hours > 0) {
                newSteps.push({ machine: "", hours: 0 });
            }
        }

        setSteps(newSteps);
    };

    const updateStep = (index: number, field: keyof EvaluationStep, value: string | number) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };

        // Automatic step addition: If the current last step is filled, add a new empty one
        const currentStep = newSteps[index];
        const isLastStep = index === newSteps.length - 1;
        if (isLastStep && currentStep.machine && currentStep.hours > 0) {
            newSteps.push({ machine: "", hours: 0 });
        }

        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!order) return;

        const validSteps = steps.filter(s => s.machine && s.hours > 0);
        const incompleteSteps = steps.filter(s => s.machine && (!s.hours || s.hours <= 0));

        // Case 1: No valid steps at all
        if (validSteps.length === 0) {
            if (incompleteSteps.length > 0) {
                setConfirmModal({
                    title: "Información Incompleta",
                    message: `Has seleccionado la máquina "${incompleteSteps[0].machine}" pero no has asignado las horas. Por favor ingresa el tiempo estimado para poder guardar.`,
                    type: 'warning',
                    onConfirm: () => setConfirmModal(null)
                });
            } else {
                toast.error("Por favor completa al menos un paso con máquina y horas válidas");
            }
            return;
        }

        // Case 2: Some valid steps, but also some incomplete ones
        if (incompleteSteps.length > 0) {
            setConfirmModal({
                title: "¿Continuar con pasos incompletos?",
                message: `Hay ${incompleteSteps.length} paso(s) con máquina seleccionada pero sin horas. Estos pasos se ignorarán.\n\n¿Deseas continuar y guardar solo los ${validSteps.length} paso(s) válidos?`,
                type: 'info',
                onConfirm: () => {
                    setConfirmModal(null);
                    saveToSupabase(validSteps);
                }
            });
            return;
        }

        // Case 3: Everything is clean
        saveToSupabase(validSteps);
    };

    const saveToSupabase = async (validSteps: EvaluationStep[]) => {
        if (!order) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("production_orders")
                .update({ evaluation: validSteps })
                .eq("id", order.id);

            if (error) throw error;

            toast.success("Evaluación guardada correctamente");
            onSuccess(validSteps);

            // If we have a next item, we just update the order in the parent. 
            // The modal stays open because isOpen is still true.
            if (hasNext && onNext) {
                onNext();
            } else {
                onClose();
            }
        } catch (e: any) {
            console.error(e);
            toast.error("Error al guardar la evaluación: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const hasDrawing = !!(order as any)?.drawing_url;
    const fileId = hasDrawing ? extractDriveFileId((order as any).drawing_url) : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                container={container}
                className={`${hasDrawing ? 'sm:max-w-[95vw] lg:max-w-7xl' : 'sm:max-w-[600px]'} p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl z-[10001] h-[95vh] flex flex-col [&>button]:hidden`}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className={`flex flex-1 overflow-hidden ${hasDrawing ? 'flex-row' : 'flex-col'}`}>

                    {/* Left Panel: Blueprint Viewer (Only if exists) */}
                    {hasDrawing && (
                        <div className="flex-1 bg-muted/5 flex flex-col border-r border-border min-w-0 h-full">
                            <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between shrink-0">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Plano de Fabricación
                                </h3>
                                {(order as any).drawing_url && !fileId && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[10px] h-7"
                                        onClick={() => window.open((order as any).drawing_url, '_blank')}
                                    >
                                        Abrir en pestaña nueva
                                    </Button>
                                )}
                            </div>
                            <div className="flex-1 relative bg-[#1a1a1a] flex items-center justify-center overflow-hidden h-full w-full">
                                {fileId ? (
                                    <iframe
                                        src={`https://drive.google.com/file/d/${fileId}/preview`}
                                        className="w-full h-full border-none block"
                                        allow="autoplay"
                                        title="Blueprint Preview"
                                    ></iframe>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 text-center gap-4 bg-background/50 m-4 rounded-3xl border border-dashed border-border shadow-inner max-w-sm">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-sm">
                                            <FileText className="w-8 h-8 text-amber-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-sm">Vista Previa No Disponible</h4>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                Este archivo no se puede visualizar directamente. Usa el botón de arriba para abrirlo en una pestaña nueva.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`${hasDrawing ? 'w-[450px]' : 'w-full'} flex flex-col`}>
                        {order && (
                            <DialogHeader className="p-6 bg-gradient-to-br from-red-600 to-red-700 text-white relative shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 shadow-inner">
                                            <Wrench className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black tracking-tight leading-none mb-1">
                                                {order.part_code}
                                            </DialogTitle>
                                            <DialogDescription className="text-red-100 font-medium opacity-90 leading-tight text-xs">
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
                                                className="text-white hover:bg-white/20 h-7 w-7"
                                                title="Anterior Piece"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {hasNext && onNext && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onNext}
                                                className="text-white hover:bg-white/20 h-7 w-7"
                                                title="Siguiente Piece"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {/* Removed duplicated X here, relying on Dialog's default Close button or could keep this one if Dialog close is disabled */}
                                        {/* Note: I'll keep one but ensure it's the "only" one visually if possible, or use Radix close */}
                                        <DialogClose asChild>
                                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7 ml-2">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </div>
                            </DialogHeader>
                        )}

                        <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                            <div className="space-y-1 shrink-0">
                                <h2 className="font-bold text-base">Evaluar Pieza</h2>
                                <p className="text-[11px] text-muted-foreground">
                                    Asignación de máquinas y tiempos estimada
                                </p>
                            </div>

                            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {steps.map((step, index) => (
                                    <div key={index} className="flex gap-3 items-end border-b border-border/50 pb-4 last:border-0 relative group">
                                        <div className="flex-1 space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Paso {index + 1}: Máquina</Label>
                                            <Select
                                                value={step.machine}
                                                onValueChange={(val) => updateStep(index, "machine", val)}
                                            >
                                                <SelectTrigger className="h-9 text-xs focus:ring-0 focus:ring-offset-0 focus:border-red-500 border-border bg-background transition-colors">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {machines.map(m => (
                                                        <SelectItem key={m.name} value={m.name} className="text-xs">
                                                            {m.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-20 space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Horas</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="0.5"
                                                    step="0.5"
                                                    value={step.hours}
                                                    onChange={(e) => updateStep(index, "hours", parseFloat(e.target.value))}
                                                    className="pr-6 h-9 text-xs"
                                                />
                                                <Clock className="w-3 h-3 absolute right-2 top-3 text-muted-foreground" />
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeStep(index)}
                                            className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>


                            <div className="flex flex-col gap-2 pt-4 border-t border-border mt-auto shrink-0">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full bg-[#EC1C21] hover:bg-[#EC1C21]/90 text-white font-black h-11 shadow-lg shadow-red-500/20"
                                >
                                    {isSaving ? "GUARDANDO..." : "GUARDAR EVALUACIÓN"}
                                </Button>
                                <DialogClose asChild>
                                    <Button variant="ghost" disabled={isSaving} className="w-full h-9 text-xs font-bold">
                                        CANCELAR
                                    </Button>
                                </DialogClose>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Confirm Modal */}
                {confirmModal && (
                    <div className="absolute inset-0 z-[20000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-background border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center gap-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm ${confirmModal.type === 'warning' ? 'bg-red-500/10 border-red-500/20' : 'bg-primary/10 border-primary/20'}`}>
                                {confirmModal.type === 'warning' ? (
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                ) : (
                                    <Info className="w-8 h-8 text-primary" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-black text-lg tracking-tight uppercase">{confirmModal.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {confirmModal.message}
                                </p>
                            </div>
                            <div className="flex flex-col w-full gap-2 mt-2">
                                <Button
                                    onClick={confirmModal.onConfirm}
                                    className={`w-full font-black text-xs h-10 ${confirmModal.type === 'warning' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
                                >
                                    {confirmModal.type === 'warning' ? 'ENTENDIDO' : 'CONTINUAR'}
                                </Button>
                                {confirmModal.type === 'info' && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => setConfirmModal(null)}
                                        className="w-full font-bold text-xs h-10"
                                    >
                                        CANCELAR
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
