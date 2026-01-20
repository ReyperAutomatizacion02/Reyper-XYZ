"use client";

import React, { useState, useMemo } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { Database } from "@/utils/supabase/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { updateTaskSchedule } from "@/app/dashboard/produccion/actions";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type ScheduledTask = Database["public"]["Tables"]["scheduled_tasks"]["Row"] & {
    production_orders: { part_number: string; part_name: string | null } | null;
    machines: { name: string } | null;
};

interface GanttWrapperProps {
    initialMachines: Machine[];
    initialOrders: Order[];
    initialTasks: ScheduledTask[];
}

export function GanttWrapper({ initialMachines, initialOrders, initialTasks }: GanttWrapperProps) {
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
    const [selectedMachineId, setSelectedMachineId] = useState<string>("all");

    // Helper to generate tasks from raw data
    const generateGanttTasks = (machineIdFilter: string) => {
        const ganttTasks: Task[] = [];
        const machinesToShow = machineIdFilter === "all"
            ? initialMachines
            : initialMachines.filter(m => m.id === machineIdFilter);

        machinesToShow.forEach((machine) => {
            ganttTasks.push({
                start: new Date(),
                end: new Date(),
                name: machine.name,
                id: `machine-${machine.id}`,
                type: "project",
                progress: 0,
                isDisabled: true,
                styles: { backgroundColor: "#f3f4f6", progressColor: "#f3f4f6", progressSelectedColor: "#f3f4f6" },
                hideChildren: false,
            });
        });

        initialTasks.forEach((t) => {
            if (!t.machine_id) return;
            // distinct filtering: if machine hidden, hide task
            const machineVisible = machinesToShow.some(m => m.id === t.machine_id);
            if (!machineVisible) return;

            ganttTasks.push({
                start: new Date(t.start_time),
                end: new Date(t.end_time),
                name: `${t.production_orders?.part_number} - ${t.production_orders?.part_name || ''}`,
                id: t.id,
                type: "task",
                project: `machine-${t.machine_id}`,
                progress: 0,
                styles: {
                    backgroundColor: initialMachines.find(m => m.id === t.machine_id)?.color || "#EC1C21",
                    progressColor: "#ffffff",
                },
            });
        });
        return ganttTasks;
    };

    const [tasks, setTasks] = useState<Task[]>(() => generateGanttTasks("all"));

    // When filter changes, update tasks
    const handleFilterChange = (machineId: string) => {
        setSelectedMachineId(machineId);
        setTasks(generateGanttTasks(machineId));
    };

    const handleTaskChange = async (task: Task) => {
        // Optimistic update
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));

        try {
            await updateTaskSchedule(task.id, task.start, task.end);
        } catch (error) {
            console.error("Failed to update task", error);
            // Revert on error (could implementation reload or better error handling)
            alert("Error al actualizar la tarea");
        }
    };

    const handleExpanderClick = (task: Task) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    };

    return (
        <div className="h-full w-full flex flex-col bg-card">
            <div className="p-2 border-b flex gap-2 justify-between bg-background/50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground ml-2">Máquina:</span>
                    <select
                        className="bg-transparent border border-border rounded-md text-sm p-1 focus:ring-primary focus:border-primary"
                        value={selectedMachineId}
                        onChange={(e) => handleFilterChange(e.target.value)}
                    >
                        <option value="all">Todas</option>
                        {initialMachines.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setViewMode(ViewMode.Hour)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === ViewMode.Hour ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Hora
                    </button>
                    <button
                        onClick={() => setViewMode(ViewMode.Day)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === ViewMode.Day ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Día
                    </button>
                    <button
                        onClick={() => setViewMode(ViewMode.Week)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === ViewMode.Week ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Semana
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {tasks.length > 0 ? (
                    <Gantt
                        tasks={tasks}
                        viewMode={viewMode}
                        onDateChange={handleTaskChange}
                        onExpanderClick={handleExpanderClick}
                        listCellWidth="155px"
                        columnWidth={viewMode === ViewMode.Hour ? 40 : 100}
                        locale="es"
                        barCornerRadius={4}
                        todayColor="rgba(236, 28, 33, 0.1)" // Transparent primary for "Today"

                        // Custom styles for the library (it uses inline styles mostly)
                        fontFamily="inherit"
                        fontSize="12px"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No hay tareas programadas.
                    </div>
                )}
            </div>
        </div>
    );
}
