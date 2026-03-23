"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MachiningView } from "./machining-view";
import { Database } from "@/utils/supabase/types";
import { createClient } from "@/utils/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import logger from "@/utils/logger";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface MachiningRealtimeWrapperProps {
    initialTasks: PlanningTask[];
    operatorName: string;
}

export function MachiningRealtimeWrapper({ initialTasks, operatorName }: MachiningRealtimeWrapperProps) {
    const [tasks, setTasks] = useState<PlanningTask[]>(initialTasks);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchTasks = useCallback(async () => {
        try {
            logger.debug("Fetching tasks for operator:", operatorName);
            setIsUpdating(true);
            const supabase = createClient();

            // Note: Same query structure as the server component for consistency
            const { data: updatedTasks, error } = await supabase
                .from("planning")
                .select(
                    `
                    *,
                    production_orders (*)
                `
                )
                .order("planned_date", { ascending: false });

            if (error) {
                console.error("Error fetching tasks in RealtimeWrapper:", error);
                return;
            }

            let filteredTasks = updatedTasks || [];
            if (operatorName !== "Administrador") {
                filteredTasks = filteredTasks.filter((t) => t.operator === operatorName);
            }

            logger.debug("Fetched and filtered tasks count:", filteredTasks.length);
            setTasks(filteredTasks as PlanningTask[]);
        } catch (error) {
            console.error("Exception in fetchTasks:", error);
        } finally {
            setIsUpdating(false);
        }
    }, [operatorName]);

    // Initial fetch sync and refresh when operator changes
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Setup Realtime to listen for any changes in planning table
    useRealtime("planning", (payload) => {
        logger.debug("Real-time update received for planning table:", payload.eventType);
        fetchTasks();
    });

    // Also listen for production_orders since they are joined
    useRealtime("production_orders", (payload) => {
        logger.debug("Real-time update received for production_orders table:", payload.eventType);
        fetchTasks();
    });

    // Generate a stable key based on task IDs and their check status
    // This will only change when tasks are added/removed or when check_in/check_out changes
    const tasksKey = tasks.map((t) => `${t.id}-${t.check_in}-${t.check_out}`).join("|");

    return (
        <div className="relative h-full w-full">
            {/* Subtle loading indicator */}
            {isUpdating && (
                <div className="absolute right-2 top-2 z-50">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                </div>
            )}

            {/* MachiningView with key-based remounting for smooth updates */}
            <MachiningView key={tasksKey} initialTasks={tasks} operatorName={operatorName} />
        </div>
    );
}
