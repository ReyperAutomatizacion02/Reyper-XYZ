import {
    startOfDay,
    addDays,
    addMilliseconds,
    differenceInMinutes,
    differenceInMilliseconds,
    isBefore,
    format,
    getDay,
    min as minDate,
} from "date-fns";
import { type PlanningTask, type PlanningTaskWithDraft } from "./types";
import { type WorkShift, DEFAULT_SHIFTS, getShiftEnd, getNextValidWorkTime, snapToNext15Minutes } from "./work-shifts";
import { calculateWorkEnd } from "./planner";

/**
 * Shifts all tasks in a scenario by a given number of work days.
 * Positive = forward, negative = backward.
 * Respects work hours (Mon-Sat 06:00-22:00) and avoids collisions.
 */
export function shiftScenarioTasks(
    scenarioTasks: Partial<PlanningTask>[],
    offsetDays: number,
    existingTasks: PlanningTask[],
    machines: string[],
    shifts: WorkShift[] = DEFAULT_SHIFTS
): Partial<PlanningTask>[] {
    if (offsetDays === 0 || scenarioTasks.length === 0) return scenarioTasks;

    const starts = scenarioTasks.filter((t) => t.planned_date).map((t) => new Date(t.planned_date!));

    if (starts.length === 0) return scenarioTasks;

    const earliestStart = minDate(starts);

    // Calculate the target start by adding/subtracting work days
    let targetStart = new Date(earliestStart);
    let daysToMove = Math.abs(offsetDays);
    const direction = offsetDays > 0 ? 1 : -1;

    while (daysToMove > 0) {
        targetStart = addDays(targetStart, direction);
        // Skip Sundays
        if (getDay(targetStart) !== 0) {
            daysToMove--;
        }
    }

    // Ensure target is within work hours (start of first window on that day)
    targetStart = getNextValidWorkTime(startOfDay(targetStart), shifts);

    // Calculate the offset in milliseconds
    const offsetMs = targetStart.getTime() - earliestStart.getTime();

    // Build collision map from existing (non-draft) tasks
    const existingTasksMap = existingTasks
        .filter((t) => !(t as PlanningTaskWithDraft).isDraft)
        .map((t) => ({
            machine: t.machine,
            order_id: t.order_id,
            startMs: new Date(t.planned_date!).getTime(),
            endMs: new Date(t.planned_end!).getTime(),
        }));

    // Shift each task
    return scenarioTasks.map((task) => {
        if (!task.planned_date || !task.planned_end) return task;

        let newStart = getNextValidWorkTime(addMilliseconds(new Date(task.planned_date!), offsetMs), shifts);
        const duration = differenceInMinutes(new Date(task.planned_end!), new Date(task.planned_date!));

        // Calculate new end respecting work hours
        let newEnd = calculateWorkEnd(newStart, duration, shifts);

        // Check for collisions and nudge forward if needed
        const collision = existingTasksMap.find(
            (t) =>
                (t.machine === task.machine || (task.order_id && t.order_id === task.order_id)) &&
                t.startMs < newEnd.getTime() &&
                t.endMs > newStart.getTime()
        );

        if (collision) {
            // Nudge start past the collision
            newStart = getNextValidWorkTime(new Date(collision.endMs), shifts);
            // Recalculate end from new start
            newEnd = calculateWorkEnd(newStart, duration, shifts);
            return {
                ...task,
                planned_date: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
                planned_end: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
            };
        }

        return {
            ...task,
            planned_date: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
            planned_end: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
        };
    });
}

/**
 * Shifts a set of tasks so that the earliest one starts at or after the targetTime,
 * respecting work hours, maintaining internal sequences, and avoiding collisions.
 */
export function shiftTasksToCurrent(
    tasks: Partial<PlanningTask>[],
    targetTime: Date,
    existingTasks: PlanningTask[],
    _machines: string[], // legacy
    shifts: WorkShift[] = DEFAULT_SHIFTS
): Partial<PlanningTask>[] {
    if (tasks.length === 0) return tasks;

    // 1. Determine "Fixed" tasks for collision detection (locked or in progress or past)
    const nowSnapped = snapToNext15Minutes(new Date());
    const globalStart = getNextValidWorkTime(nowSnapped, shifts);

    const obstacles = existingTasks
        .filter((t) => {
            const taskDate = new Date(t.planned_date!);
            const isFuture = !isBefore(taskDate, globalStart);
            const isLocked = t.locked === true;
            const hasStarted = !!t.check_in;
            const isFixed = isLocked || hasStarted || !isFuture;
            return isFixed;
        })
        .map((t) => ({
            machine: t.machine,
            order_id: t.order_id,
            startMs: new Date(t.planned_date!).getTime(),
            endMs: new Date(t.planned_end!).getTime(),
        }));

    // 2. Group tasks by piece (order_id) and sort chronologically within each piece
    const tasksByPiece: Record<string, Partial<PlanningTask>[]> = {};
    tasks.forEach((t) => {
        if (!t.order_id) return;
        if (!tasksByPiece[t.order_id]) tasksByPiece[t.order_id] = [];
        tasksByPiece[t.order_id].push(t);
    });

    Object.values(tasksByPiece).forEach((pieceTasks) => {
        pieceTasks.sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());
    });

    // 3. Find global shift based on the earliest task in the ENTIRE scenario
    const allStarts = tasks.filter((t) => t.planned_date).map((t) => new Date(t.planned_date!).getTime());
    if (allStarts.length === 0) return tasks;
    const earliestOriginalMs = Math.min(...allStarts);

    // Target start for the very first task
    const shiftTargetStart = getNextValidWorkTime(snapToNext15Minutes(targetTime), shifts);
    const globalOffsetMs = shiftTargetStart.getTime() - earliestOriginalMs;

    const resultTasks: Partial<PlanningTask>[] = [];
    const piecePointers: Record<string, Date> = {}; // Tracks when each piece is free for its next step

    // 4. Flatten all tasks and sort by original date to process them in "logical" order
    const sortedAllTasks = [...tasks].sort(
        (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
    );

    for (const task of sortedAllTasks) {
        if (!task.planned_date || !task.planned_end || !task.order_id) {
            resultTasks.push(task);
            continue;
        }

        const originalStart = new Date(task.planned_date!);
        const originalEnd = new Date(task.planned_end!);
        const durationMinutes = differenceInMinutes(originalEnd, originalStart);
        // Treatment tasks span calendar time (e.g. 2 days at the supplier), not work-shift time.
        // Using calculateWorkEnd on them would inflate their duration to ~3 work-days instead of
        // 2 calendar days, pushing piecePointers too far and causing machine tasks after the
        // treatment to start late — their segments would then span overnight in the Gantt.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isTreatmentTask = !!(task as any).is_treatment;
        const calendarDurationMs = differenceInMilliseconds(originalEnd, originalStart);
        const computeEnd = (start: Date): Date =>
            isTreatmentTask
                ? addMilliseconds(start, calendarDurationMs)
                : calculateWorkEnd(start, durationMinutes, shifts);

        // Initial proposed start: Apply global offset
        let proposedStart = addMilliseconds(originalStart, globalOffsetMs);

        // Piece Constraint: Must start AFTER the previous step of the same piece
        if (piecePointers[task.order_id] && isBefore(proposedStart, piecePointers[task.order_id])) {
            proposedStart = new Date(piecePointers[task.order_id]);
        }

        // Snap and Validate Start (treatment tasks still start at a valid work time)
        proposedStart = getNextValidWorkTime(snapToNext15Minutes(proposedStart), shifts);

        let finalStart = new Date(proposedStart);
        let finalEnd: Date;

        // Keep searching for a valid slot if collisions exist
        let foundSlot = false;
        while (!foundSlot) {
            // Calculate end: calendar duration for treatments, work-hours for machine tasks
            finalEnd = computeEnd(finalStart);

            // Check Collision with fixed tasks AND already shifted draft tasks.
            // Treatment tasks (machine === null) must NOT block each other across orders —
            // multiple orders sharing the same treatment batch occupy the same time window
            // intentionally. Only block by same-order constraint for treatments.
            const collision = obstacles.find((f) => {
                const timeOverlap = f.startMs < finalEnd!.getTime() && f.endMs > finalStart.getTime();
                if (!timeOverlap) return false;
                if (isTreatmentTask) {
                    // Treatments only collide with tasks of the SAME order
                    return task.order_id ? f.order_id === task.order_id : false;
                }
                // Machine tasks collide with same machine OR same order
                return f.machine === task.machine || (task.order_id ? f.order_id === task.order_id : false);
            });

            if (collision) {
                // Jump past collision and snap again
                finalStart = getNextValidWorkTime(snapToNext15Minutes(new Date(collision.endMs)), shifts);
            } else {
                foundSlot = true;
            }
        }

        finalEnd = computeEnd(finalStart);

        const updatedTask = {
            ...task,
            planned_date: format(finalStart, "yyyy-MM-dd'T'HH:mm:ss"),
            planned_end: format(finalEnd, "yyyy-MM-dd'T'HH:mm:ss"),
        };

        resultTasks.push(updatedTask);
        piecePointers[task.order_id] = new Date(finalEnd);

        // Add this task to obstacles so later tasks in the same scenario avoid it
        obstacles.push({
            machine: updatedTask.machine || null,
            order_id: updatedTask.order_id || null,
            startMs: finalStart.getTime(),
            endMs: finalEnd.getTime(),
        });
    }

    return resultTasks;
}
