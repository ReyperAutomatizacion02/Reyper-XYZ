"use client";

import { useMemo } from "react";
import {
    format,
    startOfDay,
    endOfDay,
    addDays,
    addHours,
    isBefore,
    isAfter,
    differenceInMilliseconds,
    set,
    getDay,
} from "date-fns";
import { Database } from "@/utils/supabase/types";
import { buildColorMap } from "@/utils/production-colors";
import { type GanttPlanningTask } from "../types";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type PlanningTask = GanttPlanningTask;

// Bar sizing constants (exported so GanttTaskBar can import them)
export const BAR_HEIGHT = 36;
export const BAR_GAP = 4;
export const ROW_PADDING = 8;
export const BATCH_INDICATOR_HEIGHT = 20;

interface UseGanttLayoutProps {
    optimisticTasks: PlanningTask[];
    initialMachines: Machine[];
    selectedMachines: Set<string>;
    searchQuery: string;
    projectFilter?: string[];
    hideEmptyMachines?: boolean;
    timeWindow: { start: Date; end: Date };
    timeToX: (time: string | number | Date) => number;
}

/** Resolve the treatment type name from a task (handles both draft and saved tasks). */
export function getTreatmentTypeName(task: PlanningTask): string | null {
    if (task.treatment_type) return task.treatment_type;
    const reg = task.register;
    if (!reg) return null;
    const m = reg.match(/^(\d+)-T$/);
    if (!m) return null;
    const stepIdx = parseInt(m[1]) - 1;
    const evaluation = task.production_orders?.evaluation as { treatment?: string }[] | null;
    if (!evaluation || stepIdx < 0 || stepIdx >= evaluation.length) return null;
    return evaluation[stepIdx]?.treatment || null;
}

export function useGanttLayout({
    optimisticTasks,
    initialMachines,
    selectedMachines,
    searchQuery,
    projectFilter,
    hideEmptyMachines,
    timeWindow,
    timeToX,
}: UseGanttLayoutProps) {
    const taskColorMap = useMemo(() => buildColorMap(optimisticTasks), [optimisticTasks]);

    // --- Filtered machines ---
    const filteredMachines = useMemo(() => {
        const uniqueNames = new Set([
            ...initialMachines.map((m) => m.name),
            ...optimisticTasks.map((t) => t.machine).filter((n): n is string => !!n),
        ]);
        if (optimisticTasks.some((t) => !t.machine && !t.is_treatment)) uniqueNames.add("Sin Máquina");

        const machines = Array.from(uniqueNames)
            .filter((name) => {
                const isSelected = selectedMachines.has(name);
                if (!isSelected) return false;

                if (hideEmptyMachines || projectFilter?.length || searchQuery) {
                    const q = searchQuery?.toLowerCase();
                    const hasTasksInWindow = optimisticTasks.some((t) => {
                        if (t.check_in && t.check_out) return false;
                        const isThisMachine =
                            t.machine === name || (name === "Sin Máquina" && !t.machine && !t.is_treatment);
                        if (!isThisMachine) return false;
                        if (projectFilter?.length && !projectFilter.includes(t.production_orders?.project_id ?? ""))
                            return false;
                        if (
                            q &&
                            !t.production_orders?.part_code?.toLowerCase().includes(q) &&
                            !t.production_orders?.part_name?.toLowerCase().includes(q)
                        )
                            return false;
                        const taskStart = new Date(t.planned_date!);
                        const taskEnd = new Date(t.planned_end!);
                        return isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
                    });
                    return hasTasksInWindow;
                }
                return true;
            })
            .sort();

        // Add TRATAMIENTO row when there are visible treatment tasks
        const q = searchQuery?.toLowerCase();
        const hasTreatmentTasksInWindow = optimisticTasks.some((t) => {
            if (!t.is_treatment) return false;
            if (t.check_in && t.check_out) return false;
            if (projectFilter?.length && !projectFilter.includes(t.production_orders?.project_id ?? "")) return false;
            if (
                q &&
                !t.production_orders?.part_code?.toLowerCase().includes(q) &&
                !t.production_orders?.part_name?.toLowerCase().includes(q)
            )
                return false;
            const taskStart = new Date(t.planned_date!);
            const taskEnd = new Date(t.planned_end!);
            return isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
        });
        if (hasTreatmentTasksInWindow) machines.push("TRATAMIENTO");

        return machines;
    }, [initialMachines, optimisticTasks, selectedMachines, hideEmptyMachines, projectFilter, searchQuery, timeWindow]);

    // --- Filtered tasks ---
    const filteredTasks = useMemo(() => {
        return optimisticTasks.filter((task) => {
            if (task.check_in && task.check_out) return false;
            if (projectFilter?.length && !projectFilter.includes(task.production_orders?.project_id ?? ""))
                return false;

            if (task.is_treatment) {
                const taskStart = new Date(task.planned_date!);
                const taskEnd = new Date(task.planned_end!);
                const matchesSearch =
                    !searchQuery ||
                    task.production_orders?.part_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    task.production_orders?.part_name?.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesSearch && isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
            }

            const matchesMachine = task.machine
                ? selectedMachines.has(task.machine)
                : selectedMachines.has("Sin Máquina");
            const matchesSearch =
                !searchQuery ||
                task.production_orders?.part_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.production_orders?.part_name?.toLowerCase().includes(searchQuery.toLowerCase());
            const taskStart = new Date(task.planned_date!);
            const taskEnd = new Date(task.planned_end!);
            const matchesTime = isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);

            return matchesMachine && matchesSearch && matchesTime;
        });
    }, [optimisticTasks, selectedMachines, searchQuery, projectFilter, timeWindow]);

    // --- Lane allocation ---
    const taskLanes = useMemo(() => {
        const lanes: Map<string, number> = new Map();

        // Non-treatment tasks: group by machine|day
        const machineDayGroups: Map<string, PlanningTask[]> = new Map();
        filteredTasks.forEach((task) => {
            if (task.is_treatment) return;
            const machine = task.machine || "Sin Máquina";
            const day = format(new Date(task.planned_date!), "yyyy-MM-dd");
            const key = `${machine}|${day}`;
            if (!machineDayGroups.has(key)) machineDayGroups.set(key, []);
            machineDayGroups.get(key)!.push(task);
        });

        machineDayGroups.forEach((tasks) => {
            const sorted = [...tasks].sort(
                (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
            );
            const laneEnds: number[] = [];
            sorted.forEach((task) => {
                const taskStart = new Date(task.planned_date!).getTime();
                const taskEnd = new Date(task.planned_end!).getTime();
                let assignedLane = 0;
                for (let i = 0; i < laneEnds.length; i++) {
                    if (laneEnds[i] <= taskStart) {
                        assignedLane = i;
                        break;
                    }
                    assignedLane = i + 1;
                }
                if (assignedLane >= laneEnds.length) laneEnds.push(taskEnd);
                else laneEnds[assignedLane] = taskEnd;
                lanes.set(task.id, assignedLane);
            });
        });

        // Treatment tasks: each type gets its own dedicated lane band
        const treatmentByType = new Map<string, PlanningTask[]>();
        filteredTasks.forEach((task) => {
            if (!task.is_treatment || !task.planned_date || !task.planned_end) return;
            const type = getTreatmentTypeName(task) || "__unknown__";
            if (!treatmentByType.has(type)) treatmentByType.set(type, []);
            treatmentByType.get(type)!.push(task);
        });

        const sortedTypes = Array.from(treatmentByType.keys()).sort();
        let laneOffset = 0;
        sortedTypes.forEach((type) => {
            const tasks = treatmentByType.get(type)!;
            const sorted = [...tasks].sort(
                (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
            );
            const laneEnds: number[] = [];
            let maxLane = 0;
            sorted.forEach((task) => {
                const taskStart = new Date(task.planned_date!).getTime();
                const taskEnd = new Date(task.planned_end!).getTime();
                let assignedLane = 0;
                for (let i = 0; i < laneEnds.length; i++) {
                    if (laneEnds[i] <= taskStart) {
                        assignedLane = i;
                        break;
                    }
                    assignedLane = i + 1;
                }
                if (assignedLane >= laneEnds.length) laneEnds.push(taskEnd);
                else laneEnds[assignedLane] = taskEnd;
                lanes.set(task.id, laneOffset + assignedLane);
                maxLane = Math.max(maxLane, assignedLane);
            });
            laneOffset += maxLane + 1;
        });

        return lanes;
    }, [filteredTasks]);

    // --- Utilization ---
    const machineUtilizations = useMemo(() => {
        const stats = new Map<string, number>();
        const SHIFT_START = 6;
        const SHIFT_END = 22;
        const SHIFT_HOURS = SHIFT_END - SHIFT_START;

        filteredMachines.forEach((m) => {
            if (m === "TRATAMIENTO") {
                stats.set(m, 0);
                return;
            }
            const machineTasks = optimisticTasks.filter(
                (t) => !t.is_treatment && (t.machine === m || (m === "Sin Máquina" && !t.machine))
            );
            if (machineTasks.length === 0) {
                stats.set(m, 0);
                return;
            }

            const viewStart = startOfDay(timeWindow.start);
            const viewEnd = endOfDay(addHours(timeWindow.end, -2));
            let totalShiftHours = 0;
            let occupiedHours = 0;

            let currentDayIter = new Date(viewStart);
            while (isBefore(currentDayIter, viewEnd)) {
                totalShiftHours += SHIFT_HOURS;

                const dayShiftStart = set(currentDayIter, {
                    hours: SHIFT_START,
                    minutes: 0,
                    seconds: 0,
                    milliseconds: 0,
                });
                const dayShiftEnd = set(currentDayIter, {
                    hours: SHIFT_END,
                    minutes: 0,
                    seconds: 0,
                    milliseconds: 0,
                });

                const dailyTasks = machineTasks
                    .filter((task) => {
                        const taskStart = new Date(task.planned_date!);
                        const taskEnd = new Date(task.planned_end!);
                        return isBefore(taskStart, dayShiftEnd) && isAfter(taskEnd, dayShiftStart);
                    })
                    .sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());

                let currentLaneEnd = 0;
                dailyTasks.forEach((task) => {
                    const taskStart = new Date(task.planned_date!);
                    const taskEnd = new Date(task.planned_end!);
                    if (taskStart.getTime() >= currentLaneEnd) {
                        if (isBefore(taskStart, dayShiftEnd) && isAfter(taskEnd, dayShiftStart)) {
                            const overlapStart = isAfter(taskStart, dayShiftStart) ? taskStart : dayShiftStart;
                            const overlapEnd = isBefore(taskEnd, dayShiftEnd) ? taskEnd : dayShiftEnd;
                            if (isAfter(overlapEnd, overlapStart)) {
                                occupiedHours += differenceInMilliseconds(overlapEnd, overlapStart) / (1000 * 60 * 60);
                                currentLaneEnd = taskEnd.getTime();
                            }
                        }
                        currentLaneEnd = Math.max(currentLaneEnd, taskEnd.getTime());
                    }
                });

                currentDayIter = addDays(currentDayIter, 1);
            }

            stats.set(
                m,
                totalShiftHours === 0 ? 0 : Math.min(100, Math.round((occupiedHours / totalShiftHours) * 100))
            );
        });

        return stats;
    }, [optimisticTasks, timeWindow, filteredMachines]);

    // --- Lane counts and sizing ---
    const machineLaneCounts = useMemo(() => {
        const counts: Map<string, number> = new Map();
        filteredTasks.forEach((task) => {
            const machine = task.is_treatment ? "TRATAMIENTO" : task.machine || "Sin Máquina";
            const lane = taskLanes.get(task.id) || 0;
            const current = counts.get(machine) || 0;
            counts.set(machine, Math.max(current, lane + 1));
        });
        return counts;
    }, [filteredTasks, taskLanes]);

    const treatmentBatchGroups = useMemo(() => {
        const groups = new Map<string, PlanningTask[]>();
        filteredTasks.forEach((task) => {
            if (!task.is_treatment || !task.planned_date || !task.planned_end) return;
            const name = getTreatmentTypeName(task);
            if (!name) return;
            const key = name.toLowerCase().trim();
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(task);
        });
        return groups;
    }, [filteredTasks]);

    const getMachineHeight = useMemo(() => {
        return (machine: string) => {
            const lanes = machineLaneCounts.get(machine) || 1;
            const base = ROW_PADDING * 2 + lanes * BAR_HEIGHT + (lanes - 1) * BAR_GAP;
            return machine === "TRATAMIENTO" && treatmentBatchGroups.size > 0 ? base + BATCH_INDICATOR_HEIGHT : base;
        };
    }, [machineLaneCounts, treatmentBatchGroups]);

    const machineYOffsets = useMemo(() => {
        const offsets: Map<string, number> = new Map();
        let currentY = 0;
        filteredMachines.forEach((machine) => {
            offsets.set(machine, currentY);
            currentY += getMachineHeight(machine);
        });
        return offsets;
    }, [filteredMachines, getMachineHeight]);

    const totalHeight = useMemo(() => {
        let height = 0;
        filteredMachines.forEach((machine) => {
            height += getMachineHeight(machine);
        });
        return height;
    }, [filteredMachines, getMachineHeight]);

    // Weekend shading rectangles for the TRATAMIENTO row
    const treatmentWeekendRects = useMemo(() => {
        if (!machineYOffsets.has("TRATAMIENTO")) return [] as { x: number; width: number; y: number; height: number }[];
        const rects: { x: number; width: number; y: number; height: number }[] = [];
        const treatY = machineYOffsets.get("TRATAMIENTO")!;
        const rowH = getMachineHeight("TRATAMIENTO");
        let day = startOfDay(timeWindow.start);
        while (isBefore(day, timeWindow.end)) {
            const d = getDay(day);
            if (d === 0 || d === 6) {
                const x1 = timeToX(day);
                const x2 = timeToX(addDays(day, 1));
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1, y: treatY, height: rowH });
            }
            day = addDays(day, 1);
        }
        return rects;
    }, [machineYOffsets, timeWindow, timeToX, getMachineHeight]);

    return {
        taskColorMap,
        filteredMachines,
        filteredTasks,
        taskLanes,
        machineUtilizations,
        machineLaneCounts,
        treatmentBatchGroups,
        getMachineHeight,
        machineYOffsets,
        totalHeight,
        treatmentWeekendRects,
    };
}
