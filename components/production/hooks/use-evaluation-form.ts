"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { EvaluationStep, MachineStep, isTreatmentStep } from "@/lib/scheduling-utils";
import { Database, type Json } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

interface ConfirmModalState {
    title: string;
    message: string;
    type: "warning" | "info";
    onConfirm: () => void;
}

interface UseEvaluationFormProps {
    selectedOrder: Order | null;
    onSelectOrder: (order: Order | null) => void;
    treatments: { id: string; name: string; avg_lead_days: number | null }[];
    ordersPendingEvaluation: Order[];
    onEvalSuccess: (orderId: string, steps: EvaluationStep[]) => void;
}

export function useEvaluationForm({
    selectedOrder,
    onSelectOrder,
    treatments,
    ordersPendingEvaluation,
    onEvalSuccess,
}: UseEvaluationFormProps) {
    const [steps, setSteps] = useState<EvaluationStep[]>([
        { type: "machine", machine: "", hours: 0, setup_time: 0, machining_time: 0, piece_change_time: 0 },
    ]);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
    const [showDrawing, setShowDrawing] = useState(false);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState(-1);

    const supabase = createClient();
    const router = useRouter();

    // Sync form when selected order changes
    useEffect(() => {
        if (selectedOrder) {
            const initialSteps = [...((selectedOrder.evaluation as EvaluationStep[] | null) || [])];
            const isComplete = (s: EvaluationStep) =>
                isTreatmentStep(s) ? !!s.treatment_id && s.days > 0 : !!s.machine && s.hours > 0;

            const emptyMachineStep = (): EvaluationStep => ({
                type: "machine",
                machine: "",
                hours: 0,
                setup_time: 0,
                machining_time: 0,
                piece_change_time: 0,
            });
            if (initialSteps.length === 0) {
                initialSteps.push(emptyMachineStep());
            } else {
                const last = initialSteps[initialSteps.length - 1];
                if (isComplete(last)) initialSteps.push(emptyMachineStep());
            }
            setSteps(initialSteps);

            const idx = ordersPendingEvaluation.findIndex((o) => o.id === selectedOrder.id);
            setSelectedEvalIndex(idx >= 0 ? idx : 0);
            setShowDrawing(!!selectedOrder.drawing_url);
        } else {
            setShowDrawing(false);
        }
    }, [selectedOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Step helpers ──────────────────────────────────────────────────────────

    /** Computes total hours from the three time components + order quantity. */
    const computeHours = (step: MachineStep, qty: number): number => {
        const setup = step.setup_time ?? 0;
        const machining = step.machining_time ?? 0;
        const pieceChange = step.piece_change_time ?? 0;
        // If all new fields are 0 but hours is set, it's a legacy step — keep it.
        if (setup === 0 && machining === 0 && pieceChange === 0 && step.hours > 0) return step.hours;
        return setup + machining * qty + pieceChange * Math.max(0, qty - 1);
    };

    const isStepComplete = (s: EvaluationStep) => {
        if (isTreatmentStep(s)) return !!s.treatment_id && s.days > 0;
        // New format: machine set + machining_time > 0
        if (s.machining_time !== undefined) return !!s.machine && s.machining_time > 0;
        // Legacy format: machine set + hours > 0
        return !!s.machine && s.hours > 0;
    };

    const isStepIncomplete = (s: EvaluationStep) => {
        if (isTreatmentStep(s)) return !!s.treatment_id && !(s.days > 0);
        if (s.machining_time !== undefined) return !!s.machine && !(s.machining_time > 0);
        return !!s.machine && !(s.hours > 0);
    };

    const toggleStepType = (index: number) => {
        const newSteps = [...steps];
        newSteps[index] = isTreatmentStep(newSteps[index])
            ? { type: "machine", machine: "", hours: 0, setup_time: 0, machining_time: 0, piece_change_time: 0 }
            : { type: "treatment", treatment_id: "", treatment: "", days: 0 };
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
        const qty = Math.max(1, selectedOrder?.quantity ?? 1);
        const updated: MachineStep = { ...step, [field]: value };
        updated.hours = computeHours(updated, qty);
        newSteps[index] = updated;
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({
                type: "machine",
                machine: "",
                hours: 0,
                setup_time: 0,
                machining_time: 0,
                piece_change_time: 0,
            });
        }
        setSteps(newSteps);
    };

    const handleTreatmentSelect = (index: number, treatmentId: string) => {
        const catalog = treatments.find((t) => t.id === treatmentId);
        const newSteps = [...steps];
        const prevStep = newSteps[index];
        const prevDays = isTreatmentStep(prevStep) && prevStep.days > 0 ? prevStep.days : (catalog?.avg_lead_days ?? 1);
        newSteps[index] = {
            type: "treatment",
            treatment_id: treatmentId,
            treatment: catalog?.name ?? "",
            days: prevDays,
        };
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const updateTreatmentDays = (index: number, days: number) => {
        const newSteps = [...steps];
        const step = newSteps[index];
        if (!isTreatmentStep(step)) return;
        newSteps[index] = { ...step, days };
        if (index === newSteps.length - 1 && isStepComplete(newSteps[index])) {
            newSteps.push({ type: "machine", machine: "", hours: 0 });
        }
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        const emptyStep: EvaluationStep = {
            type: "machine",
            machine: "",
            hours: 0,
            setup_time: 0,
            machining_time: 0,
            piece_change_time: 0,
        };
        if (newSteps.length === 0) {
            newSteps.push(emptyStep);
        } else {
            const last = newSteps[newSteps.length - 1];
            if (isStepComplete(last)) newSteps.push(emptyStep);
        }
        setSteps(newSteps);
    };

    // ── Save logic ────────────────────────────────────────────────────────────

    const saveToSupabase = async (validSteps: EvaluationStep[]) => {
        if (!selectedOrder) return;
        setIsSaving(true);
        try {
            const firstTreatment = validSteps.find(isTreatmentStep);
            const { error } = await supabase
                .from("production_orders")
                .update({
                    evaluation: validSteps as unknown as Json,
                    treatment_id: firstTreatment ? (firstTreatment as any).treatment_id || null : null,
                    treatment: firstTreatment ? (firstTreatment as any).treatment || null : null,
                })
                .eq("id", selectedOrder.id);

            if (error) throw error;

            toast.success("Evaluación guardada correctamente");
            onEvalSuccess(selectedOrder.id, validSteps);
            router.refresh();

            // Auto-advance to next
            if (selectedEvalIndex >= 0 && selectedEvalIndex < ordersPendingEvaluation.length - 1) {
                const next = ordersPendingEvaluation[selectedEvalIndex + 1];
                setSelectedEvalIndex(selectedEvalIndex + 1);
                onSelectOrder(next);
            } else {
                onSelectOrder(null);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Error desconocido";
            toast.error("Error al guardar: " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!selectedOrder) return;
        const validSteps = steps.filter(isStepComplete);
        const incompleteSteps = steps.filter(isStepIncomplete);

        if (validSteps.length === 0) {
            if (incompleteSteps.length > 0) {
                const s = incompleteSteps[0];
                const label = isTreatmentStep(s) ? `tratamiento "${s.treatment}"` : `máquina "${s.machine}"`;
                const hint = isTreatmentStep(s) ? "días" : "tiempo de maquinado";
                setConfirmModal({
                    title: "Información Incompleta",
                    message: `Has seleccionado ${label} pero no has asignado el ${hint}.`,
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
                message: `Hay ${incompleteSteps.length} paso(s) con selección pero sin tiempo. Se ignorarán.\n\n¿Continuar con ${validSteps.length} paso(s) válido(s)?`,
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

    // ── Navigation ────────────────────────────────────────────────────────────

    const handlePrev = () => {
        if (selectedEvalIndex <= 0) return;
        const idx = selectedEvalIndex - 1;
        setSelectedEvalIndex(idx);
        onSelectOrder(ordersPendingEvaluation[idx]);
    };

    const handleNext = () => {
        if (selectedEvalIndex >= ordersPendingEvaluation.length - 1) return;
        const idx = selectedEvalIndex + 1;
        setSelectedEvalIndex(idx);
        onSelectOrder(ordersPendingEvaluation[idx]);
    };

    const handleBack = () => {
        onSelectOrder(null);
        setShowDrawing(false);
    };

    return {
        // State
        steps,
        isSaving,
        confirmModal,
        setConfirmModal,
        showDrawing,
        setShowDrawing,
        selectedEvalIndex,
        // Step handlers
        toggleStepType,
        updateMachineStep,
        handleTreatmentSelect,
        updateTreatmentDays,
        removeStep,
        // Save
        handleSave,
        // Navigation
        handlePrev,
        handleNext,
        handleBack,
    };
}
