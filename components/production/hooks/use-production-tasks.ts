"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Database } from "@/utils/supabase/types";
import {
    updateTaskSchedule,
    batchSavePlanning,
    toggleTaskLocked,
    clearOrderEvaluation,
} from "@/app/dashboard/produccion/actions";
import { getErrorMessage } from "@/lib/action-result";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
    startMs?: number;
    endMs?: number;
};

interface UseProductionTasksProps {
    initialTasks: PlanningTask[];
    initialOrders: Order[];
}

export function useProductionTasks({ initialTasks, initialOrders }: UseProductionTasksProps) {
    const router = useRouter();

    const [savedTasks, setSavedTasks] = useState<PlanningTask[]>(initialTasks);
    const [optimisticTasks, setOptimisticTasks] = useState<PlanningTask[]>(initialTasks);
    const [draftTasks, setDraftTasks] = useState<PlanningTask[]>([]);
    const [history, setHistory] = useState<PlanningTask[][]>([]);
    const [future, setFuture] = useState<PlanningTask[][]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync incoming props (server refresh) to local state, preserving in-flight edits
    useEffect(() => {
        setSavedTasks(initialTasks);
        setOptimisticTasks((prev) => {
            const hasUnsavedChanges = prev.some((t) => {
                const original = initialTasks.find((s) => s.id === t.id);
                if (!original) return false;
                const fmt = "yyyy-MM-dd'T'HH:mm:ss";
                return (
                    format(new Date(t.planned_date!), fmt) !== format(new Date(original.planned_date!), fmt) ||
                    format(new Date(t.planned_end!), fmt) !== format(new Date(original.planned_end!), fmt)
                );
            });
            return hasUnsavedChanges ? prev : initialTasks;
        });
    }, [initialTasks]);

    const changedTasks = useMemo(() => {
        return optimisticTasks.filter((current) => {
            const original = savedTasks.find((s) => s.id === current.id);
            if (!original) return false;
            const fmt = "yyyy-MM-dd'T'HH:mm:ss";
            return (
                format(new Date(current.planned_date!), fmt) !== format(new Date(original.planned_date!), fmt) ||
                format(new Date(current.planned_end!), fmt) !== format(new Date(original.planned_end!), fmt)
            );
        }) as PlanningTask[];
    }, [optimisticTasks, savedTasks]);

    // Splits a combined real+draft array back into their respective states
    const handleTasksChange = (newTasks: React.SetStateAction<PlanningTask[]>, currentAllTasks: PlanningTask[]) => {
        const resolved = typeof newTasks === "function" ? newTasks(currentAllTasks) : newTasks;
        setOptimisticTasks(resolved.filter((t) => !t.isDraft));
        setDraftTasks(resolved.filter((t) => t.isDraft));
    };

    const handleHistorySnapshot = (previousState: PlanningTask[]) => {
        setHistory((h) => [...h, previousState]);
        setFuture([]);
    };

    const handleUndo = (currentAllTasks: PlanningTask[]) => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setFuture((f) => [...f, currentAllTasks]);
        setHistory((h) => h.slice(0, -1));
        handleTasksChange(previousState, currentAllTasks);
    };

    const handleRedo = (currentAllTasks: PlanningTask[]) => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];
        setHistory((h) => [...h, currentAllTasks]);
        setFuture((f) => f.slice(0, -1));
        handleTasksChange(nextState, currentAllTasks);
    };

    const handleSave = async () => {
        if (changedTasks.length === 0) return;
        setIsSaving(true);
        try {
            await Promise.all(
                changedTasks.map((task) =>
                    updateTaskSchedule(
                        task.id,
                        format(new Date(task.planned_date!), "yyyy-MM-dd'T'HH:mm:ss"),
                        format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm:ss")
                    )
                )
            );
            router.refresh();
        } catch (error) {
            console.error("Failed to save", error);
            toast.error("Error al guardar los cambios.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAllPlanning = async () => {
        if (draftTasks.length === 0 && changedTasks.length === 0) return;
        toast.loading("Guardando planeación...", { id: "save-planning" });
        const result = await batchSavePlanning(draftTasks, changedTasks);
        if (result.success) {
            toast.success("Planeación guardada con éxito", { id: "save-planning" });
            setDraftTasks([]);
            router.refresh();
        } else {
            toast.error(getErrorMessage(result.error), { id: "save-planning" });
        }
    };

    const handleDiscardDrafts = () => {
        setDraftTasks([]);
        toast.info("Planeación automática descartada");
    };

    const confirmDiscard = () => {
        handleDiscardDrafts();
        setOptimisticTasks(savedTasks);
        setHistory([]);
    };

    const handleToggleLock = async (taskId: string, locked: boolean) => {
        setOptimisticTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, locked } : t)));
        const result = await toggleTaskLocked(taskId, locked);
        if (!result.success) {
            setOptimisticTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, locked: !locked } : t)));
            toast.error(getErrorMessage(result.error));
        }
    };

    const handleClearEvaluation = async (orderId: string) => {
        const result = await clearOrderEvaluation(orderId);
        if (result.success) {
            toast.success("Evaluación limpiada exitosamente");
            router.refresh();
        } else {
            toast.error(getErrorMessage(result.error));
        }
    };

    return {
        savedTasks,
        optimisticTasks,
        setOptimisticTasks,
        draftTasks,
        setDraftTasks,
        history,
        future,
        isSaving,
        changedTasks,
        handleTasksChange,
        handleHistorySnapshot,
        handleUndo,
        handleRedo,
        handleSave,
        handleSaveAllPlanning,
        handleDiscardDrafts,
        confirmDiscard,
        handleToggleLock,
        handleClearEvaluation,
    };
}
