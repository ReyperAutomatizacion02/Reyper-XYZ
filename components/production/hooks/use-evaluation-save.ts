import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Json } from "@/utils/supabase/types";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { type EvaluationStep, isTreatmentStep } from "@/lib/scheduling-utils";
import { isStepComplete, isStepIncomplete } from "../evaluation-utils";

export interface ConfirmModalState {
    title: string;
    message: string;
    type: "warning" | "info";
    onConfirm: () => void;
}

interface UseEvaluationSaveParams {
    order: { id: string; urgencia?: boolean } | null;
    urgencia: boolean;
    onSuccess: (steps: EvaluationStep[], urgencia?: boolean) => void;
    hasNext?: boolean;
    onNext?: () => void;
    onClose: () => void;
}

export function useEvaluationSave({ order, urgencia, onSuccess, hasNext, onNext, onClose }: UseEvaluationSaveParams) {
    const [isSaving, setIsSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
    const supabase = createClient();
    const router = useRouter();

    const saveToSupabase = async (validSteps: EvaluationStep[]) => {
        if (!order) return;
        setIsSaving(true);
        try {
            const firstTreatment = validSteps.find(isTreatmentStep);
            const { error } = await supabase
                .from("production_orders")
                .update({
                    evaluation: validSteps as unknown as Json,
                    urgencia,
                    treatment_id: firstTreatment?.treatment_id ?? null,
                    treatment: firstTreatment?.treatment ?? null,
                })
                .eq("id", order.id);

            if (error) throw error;

            toast.success("Evaluación guardada correctamente");
            onSuccess(validSteps, urgencia);
            router.refresh();

            if (hasNext && onNext) {
                onNext();
            } else {
                onClose();
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Error desconocido";
            console.error("[useEvaluationSave]", e);
            toast.error("Error al guardar la evaluación: " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = (steps: EvaluationStep[]) => {
        if (!order) return;

        const validSteps = steps.filter(isStepComplete);
        const incompleteSteps = steps.filter(isStepIncomplete);

        if (validSteps.length === 0) {
            if (incompleteSteps.length > 0) {
                const s = incompleteSteps[0];
                const label = isTreatmentStep(s) ? `tratamiento "${s.treatment}"` : `máquina "${s.machine}"`;
                setConfirmModal({
                    title: "Información Incompleta",
                    message: `Has seleccionado ${label} pero no has asignado el tiempo. Por favor ingresa el tiempo estimado para poder guardar.`,
                    type: "warning",
                    onConfirm: () => setConfirmModal(null),
                });
            } else {
                toast.error("Por favor completa al menos un paso válido");
            }
            return;
        }

        if (incompleteSteps.length > 0) {
            setConfirmModal({
                title: "¿Continuar con pasos incompletos?",
                message: `Hay ${incompleteSteps.length} paso(s) con selección pero sin tiempo asignado. Estos pasos se ignorarán.\n\n¿Deseas continuar y guardar solo los ${validSteps.length} paso(s) válidos?`,
                type: "info",
                onConfirm: () => {
                    setConfirmModal(null);
                    saveToSupabase(validSteps);
                },
            });
            return;
        }

        saveToSupabase(validSteps);
    };

    return { isSaving, confirmModal, setConfirmModal, handleSave };
}
