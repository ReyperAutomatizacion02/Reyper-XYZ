"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { isBefore } from "date-fns";
import { Database } from "@/utils/supabase/types";
import {
    generateAutomatedPlanning,
    SchedulingResult,
    SchedulingStrategy,
    getNextValidWorkTime,
    snapToNext15Minutes,
    OrderWithRelations,
    WorkShift,
} from "@/lib/scheduling-utils";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
    startMs?: number;
    endMs?: number;
};

interface UseStrategyDraftProps {
    initialOrders: OrderWithRelations[];
    optimisticTasks: PlanningTask[];
    draftTasks: PlanningTask[];
    setDraftTasks: (tasks: PlanningTask[]) => void;
    machines: Machine[];
    shifts: WorkShift[];
}

// Strategy filters are fixed — not user-configurable in the current UI
const STRATEGY_FILTERS = {
    onlyWithCAD: false,
    onlyWithBlueprint: false,
    onlyWithMaterial: false,
    requireTreatment: false,
};

export function useStrategyDraft({
    initialOrders,
    optimisticTasks,
    draftTasks,
    setDraftTasks,
    machines,
    shifts,
}: UseStrategyDraftProps) {
    const [activeStrategy, setActiveStrategy] = useState<SchedulingStrategy | "NONE">("NONE");
    const [localOrders, setLocalOrders] = useState<OrderWithRelations[]>(initialOrders);
    const [liveDraftResult, setLiveDraftResult] = useState<SchedulingResult | null>(null);
    const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync orders from server refresh
    useEffect(() => {
        setLocalOrders(initialOrders);
    }, [initialOrders]);

    // Recompute the live draft whenever strategy or relevant inputs change
    useEffect(() => {
        if (activeStrategy === "NONE") {
            setLiveDraftResult(null);
            return;
        }

        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);

        draftDebounceRef.current = setTimeout(() => {
            const result = generateAutomatedPlanning(
                localOrders,
                optimisticTasks,
                machines.map((m) => m.name),
                { mainStrategy: activeStrategy, ...STRATEGY_FILTERS },
                shifts
            );
            setLiveDraftResult(result);
        }, 400);

        return () => {
            if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        };
    }, [activeStrategy, localOrders, optimisticTasks, machines, shifts]);

    // Merge real tasks + live draft + manually-tweaked drafts into a single display list
    const allTasks = useMemo((): PlanningTask[] => {
        if (activeStrategy !== "NONE" && liveDraftResult) {
            const generatedDrafts = liveDraftResult.tasks.map((t) => ({ ...t, isDraft: true }) as PlanningTask);
            const manuallyTweakedIds = new Set(draftTasks.map((d) => d.order_id));
            const reconciledDrafts = [
                ...draftTasks.filter((d) => d.isDraft),
                ...generatedDrafts.filter((g) => !manuallyTweakedIds.has(g.order_id)),
            ];

            const nowSnapped = snapToNext15Minutes(new Date());
            const globalStart = getNextValidWorkTime(nowSnapped, shifts);

            const fixedTasks = optimisticTasks.filter((t) => {
                const isFuture = !isBefore(new Date(t.planned_date!), globalStart);
                return t.locked === true || !!t.check_in || !isFuture;
            });

            const flexibleTasks = optimisticTasks.filter((t) => {
                const isFuture = !isBefore(new Date(t.planned_date!), globalStart);
                return !t.locked && !t.check_in && isFuture;
            });

            const activePieceIds = new Set(reconciledDrafts.map((t) => t.order_id));
            return [
                ...fixedTasks,
                ...flexibleTasks.filter((t) => !activePieceIds.has(t.order_id)),
                ...reconciledDrafts,
            ];
        }

        const draftOrderIds = new Set(draftTasks.map((d) => d.order_id));
        return [...optimisticTasks.filter((t) => !draftOrderIds.has(t.order_id)), ...draftTasks];
    }, [optimisticTasks, draftTasks, activeStrategy, liveDraftResult, shifts]);

    const handleStrategyChange = (strategy: SchedulingStrategy | "NONE") => {
        setActiveStrategy(strategy);
        if (strategy !== "NONE") {
            setDraftTasks([]);
        }
    };

    return {
        activeStrategy,
        localOrders,
        setLocalOrders,
        liveDraftResult,
        allTasks,
        handleStrategyChange,
    };
}
