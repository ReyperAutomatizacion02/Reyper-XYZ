"use client";

import { useCallback } from "react";
import { useTour } from "@/hooks/use-tour";
import { type GanttPlanningTask } from "@/components/production/types";
import { type GanttModalData } from "@/components/production/types";
import { PRODUCTION_TOUR_STEPS } from "@/lib/constants/production-tour-steps";

interface UseProductionTourProps {
    machines: { name: string }[];
    hasOptimisticTasks: boolean;
    setOptimisticTasks: (tasks: GanttPlanningTask[]) => void;
    setModalData: (data: GanttModalData | null) => void;
}

function createDemoTask(machineName: string): GanttPlanningTask {
    const now = new Date();
    // Demo-only stub — intentionally incomplete shape cast via unknown
    return {
        id: "demo-task-1",
        order_id: "demo-order-1",
        machine: machineName,
        operator: "Juan Demo",
        planned_date: now.toISOString(),
        planned_end: new Date(now.getTime() + 1000 * 60 * 60 * 4).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        notes: "Tarea de demostración",
        status: "planned",
        locked: false,
        check_in: null,
        check_out: null,
        last_edited_at: null,
        notion_id: null,
        is_treatment: false,
        treatment_type: null,
        register: null,
        isDraft: false,
        production_orders: {
            id: "demo-order-1",
            part_code: "PZA-DEMO-001",
            part_name: "Pieza Demo",
            quantity: 10,
        },
    } as unknown as GanttPlanningTask;
}

export function useProductionTour({
    machines,
    hasOptimisticTasks,
    setOptimisticTasks,
    setModalData,
}: UseProductionTourProps) {
    const { startTour } = useTour();

    const handleStartTour = useCallback(() => {
        const isDemo = !hasOptimisticTasks;
        const firstMachine = machines[0]?.name ?? "CNC-01";

        if (isDemo) {
            setOptimisticTasks([createDemoTask(firstMachine)]);
        }

        const cleanup = () => {
            if (isDemo) setOptimisticTasks([]);
            setModalData(null);
        };

        // Merge dynamic callbacks into the static step definitions
        const steps = PRODUCTION_TOUR_STEPS.map((step, index) => {
            if (index === 6) {
                return { ...step, onHighlightStarted: () => setModalData(null) };
            }
            if (index === 7) {
                return {
                    ...step,
                    onHighlightStarted: () =>
                        setModalData({
                            machine: firstMachine,
                            time: Date.now(),
                            operator: "Juan Demo",
                            isDemo: true,
                        }),
                };
            }
            return step;
        });

        startTour(steps, cleanup);
    }, [machines, hasOptimisticTasks, setOptimisticTasks, setModalData, startTour]);

    return { handleStartTour };
}
