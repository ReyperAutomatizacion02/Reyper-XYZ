import React, { useState } from 'react';
import {
    Dialog, DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
// Assuming these exist, if not I'll adjust
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, Clock, Wrench, Save, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
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
    } | null;
    machines: { name: string }[];
    onSuccess: () => void;
}

export function EvaluationModal({ isOpen, onClose, order, machines, onSuccess }: EvaluationModalProps) {
    const [steps, setSteps] = useState<EvaluationStep[]>(
        order?.evaluation || [{ machine: "", hours: 0 }]
    );
    const [isSaving, setIsSaving] = useState(false);
    const supabase = createClient();

    // Sync state when order changes
    React.useEffect(() => {
        if (order) {
            setSteps(order.evaluation || [{ machine: "", hours: 0 }]);
        }
    }, [order]);

    const addStep = () => {
        setSteps([...steps, { machine: "", hours: 0 }]);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        if (newSteps.length === 0) newSteps.push({ machine: "", hours: 0 });
        setSteps(newSteps);
    };

    const updateStep = (index: number, field: keyof EvaluationStep, value: string | number) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!order) return;

        // Validation
        const invalidStep = steps.find(s => !s.machine || s.hours <= 0);
        if (invalidStep) {
            toast.error("Por favor completa todos los pasos con una máquina y horas válidas");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("production_orders")
                .update({ evaluation: steps })
                .eq("id", order.id);

            if (error) throw error;

            toast.success("Evaluación guardada correctamente");
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error(e);
            toast.error("Error al guardar la evaluación: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl z-[10001] max-h-[95vh] flex flex-col">
                <DialogHeader className="p-6 bg-gradient-to-br from-red-600 to-red-700 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 shadow-inner">
                            <Wrench className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black tracking-tight leading-none mb-1">
                                {order.part_code}
                            </DialogTitle>
                            <DialogDescription className="text-red-100 font-medium opacity-90 leading-tight">
                                {order.part_name}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                    <div className="space-y-1 shrink-0">
                        <h2 className="text-lg font-bold">Evaluar Pieza</h2>
                        <p className="text-sm text-muted-foreground">
                            Define los pasos de producción para {order.part_code}
                        </p>
                    </div>

                    <div className="space-y-4 flex-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {steps.map((step, index) => (
                            <div key={index} className="flex gap-3 items-end border-b pb-4 last:border-0">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs">Paso {index + 1}: Máquina</Label>
                                    <Select
                                        value={step.machine}
                                        onValueChange={(val) => updateStep(index, "machine", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {machines.map(m => (
                                                <SelectItem key={m.name} value={m.name}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-24 space-y-2">
                                    <Label className="text-xs">Horas</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={step.hours}
                                            onChange={(e) => updateStep(index, "hours", parseFloat(e.target.value))}
                                            className="pr-7"
                                        />
                                        <Clock className="w-3.5 h-3.5 absolute right-2 top-3 text-muted-foreground" />
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStep(index)}
                                    className="text-muted-foreground hover:text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={addStep}
                        className="w-full flex items-center gap-2 border-dashed shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Paso
                    </Button>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-auto shrink-0">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-[#EC1C21] hover:bg-[#EC1C21]/90">
                            {isSaving ? "Guardando..." : "Guardar Evaluación"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
