"use client";

import { useState, useRef, useCallback } from "react";
import {
    format,
    addMilliseconds,
    addDays,
    addMinutes,
    differenceInMinutes,
    isBefore,
    isAfter,
    getDay,
    startOfDay,
    endOfDay,
} from "date-fns";
import { Database } from "@/utils/supabase/types";
import { snapToNearest15Minutes } from "@/lib/scheduling-utils";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

interface DraggingState {
    id: string;
    startX: number;
    initialX: number;
    initialDuration: number;
    cascadeIds?: string[];
}

interface ResizingState {
    id: string;
    startX: number;
    initialWidth: number;
    initialStart?: number;
    direction?: "left" | "right";
    dayStart?: number;
    dayEnd?: number;
}

interface UseGanttDragDropProps {
    optimisticTasks: PlanningTask[];
    setOptimisticTasks: (value: React.SetStateAction<PlanningTask[]>) => void;
    cascadeMode: boolean;
    readOnly: boolean;
    currentTime: Date;
    timeToX: (time: string | number | Date) => number;
    xToTime: (x: number) => Date;
    onHistorySnapshot: (state: PlanningTask[]) => void;
}

/** Snap a treatment date to the next weekday (Mon–Fri) if it falls on Sat/Sun */
function snapTreatmentToWeekday(date: Date): Date {
    const day = getDay(date); // 0=Sun, 6=Sat
    if (day === 6) return addDays(date, 2); // Sat → Mon
    if (day === 0) return addDays(date, 1); // Sun → Mon
    return date;
}

export function useGanttDragDrop({
    optimisticTasks,
    setOptimisticTasks,
    cascadeMode,
    readOnly,
    currentTime,
    timeToX,
    xToTime,
    onHistorySnapshot,
}: UseGanttDragDropProps) {
    const [draggingTask, setDraggingTask] = useState<DraggingState | null>(null);
    const [resizingTask, setResizingTask] = useState<ResizingState | null>(null);
    const [conflictingTaskIds, setConflictingTaskIds] = useState<Set<string>>(new Set());
    const snapshotRef = useRef<PlanningTask[]>([]);

    const updateConflicts = useCallback((activeId: string, tasks: PlanningTask[]) => {
        const active = tasks.find((t) => t.id === activeId);
        if (!active?.planned_date || !active?.planned_end || !active.machine) {
            setConflictingTaskIds(new Set());
            return;
        }
        const s1 = new Date(active.planned_date).getTime();
        const e1 = new Date(active.planned_end).getTime();
        const conflicts = new Set<string>();
        tasks.forEach((other) => {
            if (other.id === activeId || other.machine !== active.machine) return;
            if (!other.planned_date || !other.planned_end) return;
            const s2 = new Date(other.planned_date).getTime();
            const e2 = new Date(other.planned_end).getTime();
            if (s1 < e2 && e1 > s2) {
                conflicts.add(other.id);
                conflicts.add(activeId);
            }
        });
        setConflictingTaskIds(conflicts);
    }, []);

    const onMouseDown = useCallback(
        (e: React.MouseEvent, task: PlanningTask) => {
            const now = currentTime || new Date();
            const isFinishedOrRunning =
                !!task.check_in || !!task.check_out || isBefore(new Date(task.planned_date!), now);
            const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

            if (readOnly || isLocked) return;
            e.stopPropagation();

            snapshotRef.current = optimisticTasks;

            const cascadeIds: string[] = [];
            if (cascadeMode) {
                const taskEnd = new Date(task.planned_end!);
                const sameMachine = optimisticTasks
                    .filter((t) => t.machine === task.machine && t.id !== task.id)
                    .filter((t) => {
                        const tFinishedOrRunning =
                            !!t.check_in || !!t.check_out || isBefore(new Date(t.planned_date!), now);
                        const tLocked = !t.isDraft && (t.locked === true || (t.locked !== false && tFinishedOrRunning));
                        return !tLocked;
                    })
                    .sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());

                for (const t of sameMachine) {
                    if (!isBefore(new Date(t.planned_date!), taskEnd)) cascadeIds.push(t.id);
                }
            }

            setDraggingTask({
                id: task.id,
                startX: e.clientX,
                initialX: timeToX(task.planned_date!),
                initialDuration: new Date(task.planned_end!).getTime() - new Date(task.planned_date!).getTime(),
                cascadeIds,
            });
        },
        [readOnly, cascadeMode, optimisticTasks, currentTime, timeToX]
    );

    const onResizeStart = useCallback(
        (e: React.MouseEvent, task: PlanningTask, direction: "left" | "right") => {
            const now = currentTime || new Date();
            const isFinishedOrRunning =
                !!task.check_in || !!task.check_out || isBefore(new Date(task.planned_date!), now);
            const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

            if (readOnly || isLocked) return;
            e.stopPropagation();

            snapshotRef.current = optimisticTasks;

            const startDay = startOfDay(new Date(task.planned_date!)).getTime();
            const endDay = endOfDay(new Date(task.planned_date!)).getTime();

            setResizingTask({
                id: task.id,
                startX: e.clientX,
                initialWidth: timeToX(task.planned_end!) - timeToX(task.planned_date!),
                initialStart: timeToX(task.planned_date!),
                direction,
                dayStart: startDay,
                dayEnd: endDay,
            });
        },
        [readOnly, optimisticTasks, currentTime, timeToX]
    );

    const onMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (draggingTask) {
                const deltaX = e.clientX - draggingTask.startX;
                const newX = draggingTask.initialX + deltaX;
                let newStartTime = xToTime(newX);
                newStartTime = snapToNearest15Minutes(newStartTime);

                const isDraggingTreatment = optimisticTasks.some(
                    (t) => t.id === draggingTask.id && (t as any).is_treatment
                );
                if (isDraggingTreatment) newStartTime = snapTreatmentToWeekday(newStartTime);

                const originalStart = xToTime(draggingTask.initialX);
                const deltaMs = newStartTime.getTime() - originalStart.getTime();

                setOptimisticTasks((prev) => {
                    const updated = prev.map((t) => {
                        if (t.id === draggingTask.id) {
                            return {
                                ...t,
                                planned_date: format(newStartTime, "yyyy-MM-dd'T'HH:mm:ss"),
                                planned_end: format(
                                    addMilliseconds(newStartTime, draggingTask.initialDuration),
                                    "yyyy-MM-dd'T'HH:mm:ss"
                                ),
                            };
                        }
                        if (draggingTask.cascadeIds?.includes(t.id)) {
                            const origStart = new Date(snapshotRef.current.find((s) => s.id === t.id)?.planned_date!);
                            const origEnd = new Date(snapshotRef.current.find((s) => s.id === t.id)?.planned_end!);
                            return {
                                ...t,
                                planned_date: format(addMilliseconds(origStart, deltaMs), "yyyy-MM-dd'T'HH:mm:ss"),
                                planned_end: format(addMilliseconds(origEnd, deltaMs), "yyyy-MM-dd'T'HH:mm:ss"),
                            };
                        }
                        return t;
                    });
                    updateConflicts(draggingTask.id, updated);
                    return updated;
                });
            } else if (resizingTask) {
                const deltaX = e.clientX - resizingTask.startX;
                const direction = resizingTask.direction || "right";
                const limitStart = resizingTask.dayStart ? new Date(resizingTask.dayStart) : null;
                const limitEnd = resizingTask.dayEnd ? new Date(resizingTask.dayEnd) : null;
                const isResizingTreatment = optimisticTasks.some(
                    (t) => t.id === resizingTask.id && (t as any).is_treatment
                );

                setOptimisticTasks((prev) => {
                    const updated = prev.map((t) => {
                        if (t.id === resizingTask.id) {
                            if (direction === "right") {
                                const newWidth = Math.max(10, resizingTask.initialWidth + deltaX);
                                let newEndTime = xToTime(timeToX(t.planned_date!) + newWidth);
                                newEndTime = snapToNearest15Minutes(newEndTime);
                                if (isResizingTreatment) newEndTime = snapTreatmentToWeekday(newEndTime);
                                if (limitEnd && isAfter(newEndTime, limitEnd)) newEndTime = new Date(limitEnd);
                                const currentStart = new Date(t.planned_date!);
                                if (differenceInMinutes(newEndTime, currentStart) < 15)
                                    newEndTime = addMinutes(currentStart, 15);
                                return { ...t, planned_end: format(newEndTime, "yyyy-MM-dd'T'HH:mm:ss") };
                            } else {
                                const newX =
                                    (resizingTask.initialStart || 0) + Math.min(deltaX, resizingTask.initialWidth - 10);
                                let newStartDate = xToTime(newX);
                                newStartDate = snapToNearest15Minutes(newStartDate);
                                if (isResizingTreatment) newStartDate = snapTreatmentToWeekday(newStartDate);
                                if (limitStart && isBefore(newStartDate, limitStart))
                                    newStartDate = new Date(limitStart);
                                const currentEnd = new Date(t.planned_end!);
                                if (differenceInMinutes(currentEnd, newStartDate) < 15)
                                    newStartDate = addMinutes(currentEnd, -15);
                                return { ...t, planned_date: format(newStartDate, "yyyy-MM-dd'T'HH:mm:ss") };
                            }
                        }
                        return t;
                    });
                    updateConflicts(resizingTask.id, updated);
                    return updated;
                });
            }
        },
        [draggingTask, resizingTask, optimisticTasks, setOptimisticTasks, xToTime, timeToX, updateConflicts]
    );

    const onMouseUp = useCallback(() => {
        if (draggingTask || resizingTask) {
            const hasChanged = JSON.stringify(snapshotRef.current) !== JSON.stringify(optimisticTasks);
            if (hasChanged) onHistorySnapshot(snapshotRef.current);
        }
        setDraggingTask(null);
        setResizingTask(null);
        setConflictingTaskIds(new Set());
    }, [draggingTask, resizingTask, optimisticTasks, onHistorySnapshot]);

    return {
        draggingTask,
        resizingTask,
        conflictingTaskIds,
        onMouseDown,
        onResizeStart,
        onMouseMove,
        onMouseUp,
    };
}
