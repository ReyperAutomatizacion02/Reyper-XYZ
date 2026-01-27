"use client";

import React, { useState, useEffect } from "react";
import { MachiningView } from "./machining-view";
import { Database } from "@/utils/supabase/types";
import { createClient } from "@/utils/supabase/client";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface MachiningRealtimeWrapperProps {
    initialTasks: PlanningTask[];
    operatorName: string;
}

export function MachiningRealtimeWrapper({
    initialTasks,
    operatorName
}: MachiningRealtimeWrapperProps) {
    const [tasks, setTasks] = useState<PlanningTask[]>(initialTasks);
    const [isUpdating, setIsUpdating] = useState(false);

    // Poll for updates every 5 seconds
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                setIsUpdating(true);
                const supabase = createClient();
                const { data: updatedTasks, error } = await supabase
                    .from('planning')
                    .select(`
                        *,
                        production_orders (*)
                    `)
                    .eq('operator', operatorName)
                    .order('planned_date', { ascending: true });

                if (!error && updatedTasks) {
                    setTasks(updatedTasks as PlanningTask[]);
                }
            } catch (error) {
                console.error('Error fetching tasks:', error);
            } finally {
                setIsUpdating(false);
            }
        };

        // Initial fetch after mount
        const initialTimer = setTimeout(fetchTasks, 2000);

        // Set up polling interval
        const interval = setInterval(fetchTasks, 5000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [operatorName]);

    // Generate a stable key based on task IDs and their check status
    // This will only change when tasks are added/removed or when check_in/check_out changes
    const tasksKey = tasks
        .map(t => `${t.id}-${t.check_in}-${t.check_out}`)
        .join('|');

    return (
        <div className="relative w-full h-full">
            {/* Subtle loading indicator */}
            {isUpdating && (
                <div className="absolute top-2 right-2 z-50">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                </div>
            )}

            {/* MachiningView with key-based remounting for smooth updates */}
            <MachiningView
                key={tasksKey}
                initialTasks={tasks}
                operatorName={operatorName}
            />
        </div>
    );
}
