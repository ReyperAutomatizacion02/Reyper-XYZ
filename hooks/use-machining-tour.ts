"use client";

import { useState, useMemo, useCallback } from "react";
import { addHours, isSameDay, startOfDay, subMinutes } from "date-fns";
import { useTour, type TourStep } from "@/hooks/use-tour";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

type DemoMode = "none" | "pending" | "active";

const DEMO_MACHINE = "01-MILTRONICS";

function buildMachiningTourSteps(setDemoMode: (mode: DemoMode) => void): TourStep[] {
    return [
        {
            element: "#active-task-panel",
            padding: 15,
            popover: {
                title: "Tu Tarea en Tiempo Real",
                description:
                    "Desde el primer segundo, puedes ver aquí la información de tu pieza activa. Este panel te muestra el código, nombre y tiempo de inicio.",
                side: "bottom",
                align: "center",
            },
            onHighlightStarted: () => setDemoMode("pending"),
        },
        {
            element: "#demo-task-pending",
            padding: 10,
            popover: {
                title: "Seguimiento Visual",
                description:
                    "En el calendario, esta misma pieza aparece resaltada con color. Aquí puedes ver gráficamente cuánto tiempo llevas trabajando en ella.",
                side: "right",
                align: "center",
            },
            onHighlightStarted: () => setDemoMode("pending"),
        },
        {
            element: "#finish-task-btn",
            padding: 10,
            popover: {
                title: "Concluir Registro",
                description:
                    "Cuando termines físicamente el maquinado, pulsa este botón. Se cerrará el registro actual y la máquina quedará lista para lo que sigue.",
                side: "bottom",
                align: "center",
            },
            onHighlightStarted: () => setDemoMode("pending"),
            onDeselected: () => setDemoMode("none"),
        },
    ];
}

function createMachiningDemoTask(operatorName: string): PlanningTask {
    const now = new Date();
    // Demo-only stub — intentionally partial shape
    return {
        id: "demo-task-pending",
        created_at: now.toISOString(),
        machine: DEMO_MACHINE,
        operator: operatorName,
        order_id: "demo-order-1",
        planned_date: subMinutes(now, 30).toISOString(),
        planned_end: addHours(now, 2).toISOString(),
        check_in: subMinutes(now, 15).toISOString(),
        check_out: null,
        production_orders: {
            id: "demo-order-1",
            part_code: "DEMO-XYZ",
            part_name: "EJE DE TRANSMISIÓN",
            client: "MAQUINADOS REYPER",
        } as unknown as Order,
    } as unknown as PlanningTask;
}

interface UseMachiningTourProps {
    initialTasks: PlanningTask[];
    operatorName: string;
}

interface UseMachiningTourResult {
    demoMode: DemoMode;
    handleStartTour: () => void;
    filteredTasks: PlanningTask[];
    allMachineNames: string[];
}

export function useMachiningTour({ initialTasks, operatorName }: UseMachiningTourProps): UseMachiningTourResult {
    const { startTour } = useTour();
    const [demoMode, setDemoMode] = useState<DemoMode>("none");

    const handleStartTour = useCallback(() => {
        setDemoMode("pending");
        const steps = buildMachiningTourSteps(setDemoMode);
        // Delay 1000ms to allow initial animations to settle before highlighting
        setTimeout(() => {
            startTour(steps, () => setDemoMode("none"));
        }, 1000);
    }, [startTour]);

    const filteredTasks = useMemo((): PlanningTask[] => {
        if (demoMode !== "none") {
            return [createMachiningDemoTask(operatorName)];
        }
        const today = startOfDay(new Date());
        return initialTasks.filter((task) => {
            if (task.check_out) return false;
            return isSameDay(new Date(task.planned_date!), today);
        });
    }, [initialTasks, demoMode, operatorName]);

    const allMachineNames = useMemo((): string[] => {
        const names = new Set(initialTasks.map((t) => t.machine).filter((n): n is string => !!n));
        if (demoMode !== "none") names.add(DEMO_MACHINE);
        return Array.from(names);
    }, [initialTasks, demoMode]);

    return { demoMode, handleStartTour, filteredTasks, allMachineNames };
}
