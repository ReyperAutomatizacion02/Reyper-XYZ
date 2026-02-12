import moment from "moment";
import { Database } from "@/utils/supabase/types";

export type Order = Database["public"]["Tables"]["production_orders"]["Row"];
export type PlanningTask = Database["public"]["Tables"]["planning"]["Row"];

export interface EvaluationStep {
    machine: string;
    hours: number;
}

export interface SchedulingResult {
    tasks: Partial<PlanningTask>[];
    skipped: {
        order: Order;
        reason: string;
    }[];
    metrics: ScenarioMetrics;
}

export interface ScenarioMetrics {
    totalOrders: number;
    totalTasks: number;
    totalHours: number;
    lateOrders: number;
    avgLeadTimeDays: number;
    machineUtilization: Record<string, number>; // machine: hours
}

export interface SavedScenario {
    id: string;
    name: string;
    strategy: string;
    config: StrategyConfig;
    tasks: Partial<PlanningTask>[];
    skipped: { order: Order; reason: string }[];
    metrics: ScenarioMetrics;
    created_by: string | null;
    created_at: string;
    applied_at: string | null;
}

export type SchedulingStrategy = "DELIVERY_DATE" | "FAB_TIME" | "FAST_TRACK" | "TREATMENTS" | "CRITICAL_PATH" | "PROJECT_GROUP" | "MATERIAL_OPTIMIZATION";

export interface StrategyConfig {
    mainStrategy: SchedulingStrategy;
    onlyWithCAD: boolean;
    onlyWithBlueprint: boolean;
    onlyWithMaterial: boolean;
    requireTreatment: boolean;
}

export type PriorityLevel = "CRITICAL" | "SOON" | "NORMAL" | "PLENTY";

/**
 * Categorizes an order by its delivery date urgency.
 */
export function getPriorityLevel(deliveryDate: string | null): PriorityLevel {
    if (!deliveryDate) return "NORMAL";

    const now = moment().startOf('day');
    const delivery = moment(deliveryDate).startOf('day');
    const diffDays = delivery.diff(now, 'days');

    if (diffDays < 0) return "CRITICAL"; // Overdue
    if (diffDays <= 3) return "SOON";    // Within 3 days
    if (diffDays <= 10) return "NORMAL"; // 4-10 days
    return "PLENTY";                    // More than 10 days
}

/**
 * Helper: Get priority score based on General Status.
 * Lower number = Higher Priority.
 */
export function getStatusPriority(status: string): number {
    switch (status) {
        case 'A8-MATERIAL DISPONIBLE': return 2;
        case 'A7-ESPERANDO MATERIAL': return 3;
        case 'A5-VERIFICAR MATERIAL': return 4;
        case 'A0-ESPERANDO MATERIAL': return 5;
        case 'A0-NUEVO PROYECTO': return 5;
        default: return 99; // Low priority for others
    }
}

/**
 * Comparator function for sorting orders by Priority (Status > Delivery Date).
 */
export function compareOrdersByPriority(a: Order, b: Order): number {
    // 1. Sort by Status Priority
    const prioA = getStatusPriority((a as any).genral_status);
    const prioB = getStatusPriority((b as any).genral_status);

    if (prioA !== prioB) {
        return prioA - prioB; // Lower priority number first
    }

    // 2. Sort by Delivery Date (Urgency) - Earlier date first
    const getDeliveryDate = (item: any) => {
        if (item.delivery_date) return moment(item.delivery_date).valueOf();
        if (item.projects && item.projects.delivery_date) return moment(item.projects.delivery_date).valueOf();
        return Number.MAX_SAFE_INTEGER;
    };

    const dateA = getDeliveryDate(a);
    const dateB = getDeliveryDate(b);

    return dateA - dateB;
}

/**
 * Filter and sort orders for scheduling based on a specific strategy.
 */
export function prepareOrdersForScheduling(orders: Order[], config: StrategyConfig): Order[] {
    return (orders as any[])
        .filter(order => {
            // Must have evaluation
            const evalData = order.evaluation as any;
            if (!evalData || !Array.isArray(evalData) || evalData.length === 0) {
                return false;
            }

            // CAD Ready filter (3D Model)
            if (config.onlyWithCAD) {
                const hasCAD = !!order.drive_file_id || !!(order as any).projects?.drive_folder_id;
                if (!hasCAD) return false;
            }

            // Blueprint Ready filter (Plano)
            if (config.onlyWithBlueprint) {
                // For now assuming drive_file_id exists means blueprint is linked
                const hasBlueprint = !!order.drive_file_id;
                if (!hasBlueprint) return false;
            }

            // Material Ready filter
            if (config.onlyWithMaterial) {
                if (order.genral_status !== 'A8-MATERIAL DISPONIBLE') return false;
            }

            // Requires Treatment filter
            if (config.requireTreatment) {
                const hasTreatment = order.treatment && order.treatment !== "" && order.treatment !== "N/A";
                if (!hasTreatment) return false;
            }

            return true;
        })
        .sort((a, b) => {
            const getHours = (o: any) => (o.evaluation as any[]).reduce((sum, s) => sum + (s.hours || 0), 0);

            switch (config.mainStrategy) {
                case "FAB_TIME":
                    return getHours(b) - getHours(a); // Longest first

                case "FAST_TRACK":
                    return getHours(a) - getHours(b); // Shortest first

                case "CRITICAL_PATH": {
                    const hasTreatA = a.treatment && a.treatment !== "" && a.treatment !== "N/A" ? 0 : 1;
                    const hasTreatB = b.treatment && b.treatment !== "" && b.treatment !== "N/A" ? 0 : 1;
                    if (hasTreatA !== hasTreatB) return hasTreatA - hasTreatB;
                    return compareOrdersByPriority(a, b);
                }

                case "PROJECT_GROUP": {
                    const projA = a.project_id || "";
                    const projB = b.project_id || "";
                    if (projA !== projB) return projA.localeCompare(projB);
                    return compareOrdersByPriority(a, b);
                }

                case "MATERIAL_OPTIMIZATION": {
                    const matA = a.material || "";
                    const matB = b.material || "";
                    if (matA !== matB) return matA.localeCompare(matB);
                    return compareOrdersByPriority(a, b);
                }

                case "TREATMENTS": {
                    const treatA = a.treatment || "";
                    const treatB = b.treatment || "";
                    return treatA.localeCompare(treatB);
                }

                case "DELIVERY_DATE":
                default:
                    return compareOrdersByPriority(a, b);
            }
        });
}

/**
 * Moves a date to the next valid working minute.
 * Work Hours: Mon-Sat, 06:00 - 22:00.
 */
export function getNextValidWorkTime(date: moment.Moment): moment.Moment {
    let current = moment(date);

    // Loop until valid
    while (true) {
        const hour = current.hour();
        const day = current.day(); // 0 = Sunday, 1 = Monday...

        // Rule 1: No Sundays
        if (day === 0) {
            current.add(1, 'day').startOf('day').hour(6);
            continue;
        }

        // Rule 2: Before 6 AM -> Move to 6 AM same day
        if (hour < 6) {
            current.hour(6).minute(0).second(0).millisecond(0);
            continue;
        }

        // Rule 3: After 10 PM (22:00) -> Move to 6 AM next day
        if (hour >= 22) {
            current.add(1, 'day').startOf('day').hour(6);
            continue;
        }

        // If we are here, it's a valid time
        break;
    }
    return current;
}

/**
 * Snaps a date to the next 15-minute interval (ceiling).
 * If already at a 15-minute mark (and 0 seconds), stays there.
 * e.g. 14:04 -> 14:15. 14:15:00 -> 14:15.
 */
export function snapToNext15Minutes(date: moment.Moment): moment.Moment {
    const current = moment(date);
    const minutes = current.minutes();
    const seconds = current.seconds();
    const ms = current.milliseconds();

    // If already at a 15-min mark exactly, return it
    if (minutes % 15 === 0 && seconds === 0 && ms === 0) {
        return current;
    }

    const remainder = 15 - (minutes % 15);
    return current.add(remainder, "minutes").startOf("minute").seconds(0).milliseconds(0);
}

/**
 * Generates automated planning tasks with shift splitting logic.
 */
export function generateAutomatedPlanning(
    orders: Order[],
    existingTasks: PlanningTask[],
    machines: string[],
    config: StrategyConfig = {
        mainStrategy: "DELIVERY_DATE",
        onlyWithCAD: false,
        onlyWithBlueprint: false,
        onlyWithMaterial: false,
        requireTreatment: false
    }
): SchedulingResult {
    console.log("[AutoPlan] Starting with", orders.length, "orders, strategy:", config.mainStrategy);
    const preparedOrders = prepareOrdersForScheduling(orders, config);
    console.log("[AutoPlan] Prepared orders:", preparedOrders.length);

    const draftTasks: any[] = [];
    const skipped: { order: Order; reason: string }[] = [];

    // Start scheduling from "Next valid slot" relative to Now
    // 1. Snap Now to next 15m
    const nowSnapped = snapToNext15Minutes(moment());
    // 2. Ensure that snapped time is within working hours
    const globalStart = getNextValidWorkTime(nowSnapped);

    // Initial tasks to consider for collisions and current state
    // We filter out "flexible" tasks: future, not locked, and not started.
    // This allows them to be re-planned from scratch.
    const allKnownTasks = [...existingTasks]
        .filter(t => {
            const isFuture = moment(t.planned_date).isSameOrAfter(globalStart);
            const isLocked = t.locked === true;
            const hasStarted = !!t.check_in;
            const isFixed = isLocked || hasStarted || !isFuture;
            return isFixed;
        })
        .map(t => ({
            ...t,
            startMs: moment(t.planned_date).valueOf(),
            endMs: moment(t.planned_end).valueOf()
        }));

    for (const order of preparedOrders) {
        const evaluation = (order as any).evaluation as any as EvaluationStep[];
        let pieceDependencyEndTime = moment(globalStart);

        const pieceTasks: any[] = [];
        let pieceSkipped = false;

        // Get all fixed tasks for THIS specific order, sorted by time
        const pieceFixedTasks = allKnownTasks
            .filter(t => t.order_id === order.id)
            .sort((a, b) => a.startMs - b.startMs);

        // Track which fixed tasks we've "consumed" during matching
        let fixedTaskIdx = 0;

        for (let i = 0; i < evaluation.length; i++) {
            const step = evaluation[i];
            const register = (i + 1).toString();

            if (!machines.includes(step.machine)) {
                skipped.push({ order, reason: `Máquina desconocida: ${step.machine}` });
                pieceSkipped = true;
                break;
            }

            // SEQUENCE MATCHING: Try to find if this evaluation step is already covered by a "fixed" task.
            // We look for the next available fixed task that matches the machine.
            let matchedTask: any = null;
            while (fixedTaskIdx < pieceFixedTasks.length) {
                const potentialMatch = pieceFixedTasks[fixedTaskIdx];
                if (potentialMatch.machine === step.machine) {
                    matchedTask = potentialMatch;
                    fixedTaskIdx++; // We match strictly in sequence
                    break;
                }
                // If it doesn't match the machine, it might be an extra task or a discrepency.
                // We keep moving fixedTaskIdx to stay in sync with the physical sequence.
                fixedTaskIdx++;
            }

            if (matchedTask) {
                // STEP IS COVERED by a solid/fixed task
                const taskEnd = moment(matchedTask.endMs);
                if (taskEnd.isAfter(pieceDependencyEndTime)) {
                    pieceDependencyEndTime = taskEnd;
                }
                // No more planning needed for this step as it's "solid"
                continue;
            }

            // IF NO MATCH: Plan this step normally, starting after the last dependency
            let remainingHours = step.hours;
            let currentSearchStart = getNextValidWorkTime(moment(pieceDependencyEndTime));

            while (remainingHours > 0) {
                currentSearchStart = getNextValidWorkTime(currentSearchStart);
                const shiftEnd = moment(currentSearchStart).hour(22).minute(0).second(0);
                const hoursInShift = shiftEnd.diff(currentSearchStart, 'hours', true);

                if (hoursInShift < 0.25) {
                    currentSearchStart = getNextValidWorkTime(shiftEnd.add(1, 'minute'));
                    continue;
                }

                const segmentDuration = Math.min(remainingHours, hoursInShift);
                const proposedEnd = moment(currentSearchStart).add(segmentDuration, 'hours');

                // 5. Check for collisions (Machine Busy OR Piece Busy elsewhere)
                const collision = allKnownTasks.find(t =>
                    (t.machine === step.machine || t.order_id === order.id) &&
                    t.startMs < proposedEnd.valueOf() &&
                    t.endMs > currentSearchStart.valueOf()
                );

                if (collision) {
                    currentSearchStart = moment(collision.endMs);
                    continue;
                }

                // Create Draft Segment
                const newTask: any = {
                    id: `draft-${order.id}-${step.machine}-${register}-${Math.random().toString(36).substr(2, 5)}`,
                    order_id: order.id,
                    machine: step.machine,
                    register: register,
                    planned_date: currentSearchStart.format('YYYY-MM-DDTHH:mm:ss'),
                    planned_end: proposedEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    status: 'pending',
                    production_orders: order,
                    isDraft: true,
                    startMs: currentSearchStart.valueOf(),
                    endMs: proposedEnd.valueOf()
                };

                pieceTasks.push(newTask);
                allKnownTasks.push(newTask); // Add to local obstacles for subsequent checks

                remainingHours -= segmentDuration;
                currentSearchStart = moment(proposedEnd);
            }

            // This step is now "done" (either skipped, matched, or planned)
            pieceDependencyEndTime = currentSearchStart;
        }

        if (!pieceSkipped) {
            draftTasks.push(...pieceTasks);
        }
    }

    // Calculate Metrics
    const metrics: ScenarioMetrics = {
        totalOrders: preparedOrders.length,
        totalTasks: draftTasks.length,
        totalHours: draftTasks.reduce((sum, t) => {
            const start = moment(t.planned_date);
            const end = moment(t.planned_end);
            return sum + end.diff(start, 'hours', true);
        }, 0),
        lateOrders: 0,
        avgLeadTimeDays: 0,
        machineUtilization: {}
    };

    // Calculate lateness and lead time
    let totalLeadTimeMs = 0;
    preparedOrders.forEach(order => {
        const orderTasks = draftTasks.filter(t => t.order_id === order.id);
        if (orderTasks.length === 0) return;

        const lastTaskEnd = orderTasks.reduce((max, t) => {
            const end = moment(t.planned_end);
            return end.isAfter(max) ? end : max;
        }, moment(0));

        const deliveryDate = (order as any).delivery_date || (order as any).projects?.delivery_date;
        if (deliveryDate && lastTaskEnd.isAfter(moment(deliveryDate))) {
            metrics.lateOrders++;
        }

        const start = moment(order.created_at);
        totalLeadTimeMs += lastTaskEnd.diff(start);
    });

    if (metrics.totalOrders > 0) {
        metrics.avgLeadTimeDays = totalLeadTimeMs / metrics.totalOrders / (1000 * 60 * 60 * 24);
    }

    // Machine Utilization
    machines.forEach(m => {
        metrics.machineUtilization[m] = draftTasks
            .filter(t => t.machine === m)
            .reduce((sum, t) => sum + moment(t.planned_end).diff(moment(t.planned_date), 'hours', true), 0);
    });

    return {
        tasks: draftTasks,
        skipped,
        metrics
    };
}

/**
 * Shifts all tasks in a scenario by a given number of work days.
 * Positive = forward, negative = backward.
 * Respects work hours (Mon-Sat 06:00-22:00) and avoids collisions.
 */
export function shiftScenarioTasks(
    scenarioTasks: Partial<PlanningTask>[],
    offsetDays: number,
    existingTasks: PlanningTask[],
    machines: string[]
): Partial<PlanningTask>[] {
    if (offsetDays === 0 || scenarioTasks.length === 0) return scenarioTasks;

    // Calculate the offset: find earliest task start and shift it by N work days
    const starts = scenarioTasks
        .filter(t => t.planned_date)
        .map(t => moment(t.planned_date));

    if (starts.length === 0) return scenarioTasks;

    const earliestStart = moment.min(starts);

    // Calculate the target start by adding/subtracting work days
    let targetStart = moment(earliestStart);
    let daysToMove = Math.abs(offsetDays);
    const direction = offsetDays > 0 ? 1 : -1;

    while (daysToMove > 0) {
        targetStart.add(direction, 'day');
        // Skip Sundays
        if (targetStart.day() !== 0) {
            daysToMove--;
        }
    }

    // Ensure target is within work hours
    targetStart = getNextValidWorkTime(targetStart.hour(6).minute(0).second(0));

    // Calculate the offset in milliseconds
    const offsetMs = targetStart.valueOf() - earliestStart.valueOf();

    // Build collision map from existing (non-draft) tasks
    const existingTasksMap = existingTasks
        .filter(t => !(t as any).isDraft)
        .map(t => ({
            machine: t.machine,
            order_id: t.order_id,
            startMs: moment(t.planned_date).valueOf(),
            endMs: moment(t.planned_end).valueOf()
        }));

    // Shift each task
    return scenarioTasks.map(task => {
        if (!task.planned_date || !task.planned_end) return task;

        let newStart = getNextValidWorkTime(moment(task.planned_date).add(offsetMs, 'ms'));
        const duration = moment(task.planned_end).diff(moment(task.planned_date), 'minutes');

        // Calculate new end respecting work hours
        let remaining = duration;
        let cursor = moment(newStart);

        while (remaining > 0) {
            cursor = getNextValidWorkTime(cursor);
            const shiftEnd = moment(cursor).hour(22).minute(0).second(0);
            const availableMinutes = shiftEnd.diff(cursor, 'minutes');

            if (availableMinutes <= 0) {
                cursor.add(1, 'day').startOf('day').hour(6);
                continue;
            }

            const segmentMinutes = Math.min(remaining, availableMinutes);
            remaining -= segmentMinutes;

            if (remaining > 0) {
                cursor = moment(shiftEnd);
            } else {
                cursor = moment(cursor).add(segmentMinutes, 'minutes');
            }
        }

        const newEnd = cursor;

        // Check for collisions and nudge forward if needed
        const collision = existingTasksMap.find(t =>
            (t.machine === task.machine || (task.order_id && t.order_id === task.order_id)) &&
            t.startMs < newEnd.valueOf() &&
            t.endMs > newStart.valueOf()
        );

        if (collision) {
            // Nudge start past the collision
            newStart = getNextValidWorkTime(moment(collision.endMs));
            // Recalculate end from new start
            let rem = duration;
            let c = moment(newStart);
            while (rem > 0) {
                c = getNextValidWorkTime(c);
                const se = moment(c).hour(22).minute(0).second(0);
                const avail = se.diff(c, 'minutes');
                if (avail <= 0) { c.add(1, 'day').startOf('day').hour(6); continue; }
                const seg = Math.min(rem, avail);
                rem -= seg;
                c = rem > 0 ? moment(se) : moment(c).add(seg, 'minutes');
            }
            return {
                ...task,
                planned_date: newStart.format('YYYY-MM-DDTHH:mm:ss'),
                planned_end: c.format('YYYY-MM-DDTHH:mm:ss'),
            };
        }

        return {
            ...task,
            planned_date: newStart.format('YYYY-MM-DDTHH:mm:ss'),
            planned_end: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
        };
    });
}

/**
 * Shifts a set of tasks so that the earliest one starts at or after the targetTime,
 * respecting work hours, maintaining internal sequences, and avoiding collisions.
 */
export function shiftTasksToCurrent(
    tasks: Partial<PlanningTask>[],
    targetTime: moment.Moment,
    existingTasks: PlanningTask[],
    _machines: string[] // legacy
): Partial<PlanningTask>[] {
    if (tasks.length === 0) return tasks;

    // 1. Determine "Fixed" tasks for collision detection (locked or in progress or past)
    const nowSnapped = snapToNext15Minutes(moment());
    const globalStart = getNextValidWorkTime(nowSnapped);

    const obstacles = existingTasks
        .filter(t => {
            const isFuture = moment(t.planned_date).isSameOrAfter(globalStart);
            const isLocked = t.locked === true;
            const hasStarted = !!t.check_in;
            // Any started task is FIXED and MUST be an obstacle
            const isFixed = isLocked || hasStarted || !isFuture;
            return isFixed;
        })
        .map(t => ({
            machine: t.machine,
            order_id: t.order_id,
            startMs: moment(t.planned_date).valueOf(),
            endMs: moment(t.planned_end).valueOf()
        }));

    // 2. Group tasks by piece (order_id) and sort chronologically within each piece
    const tasksByPiece: Record<string, Partial<PlanningTask>[]> = {};
    tasks.forEach(t => {
        if (!t.order_id) return;
        if (!tasksByPiece[t.order_id]) tasksByPiece[t.order_id] = [];
        tasksByPiece[t.order_id].push(t);
    });

    Object.values(tasksByPiece).forEach(pieceTasks => {
        pieceTasks.sort((a, b) => moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf());
    });

    // 3. Find global shift based on the earliest task in the ENTIRE scenario
    const allStarts = tasks.filter(t => t.planned_date).map(t => moment(t.planned_date).valueOf());
    if (allStarts.length === 0) return tasks;
    const earliestOriginalMs = Math.min(...allStarts);

    // Target start for the very first task
    const shiftTargetStart = getNextValidWorkTime(snapToNext15Minutes(targetTime));
    const globalOffsetMs = shiftTargetStart.valueOf() - earliestOriginalMs;

    const resultTasks: Partial<PlanningTask>[] = [];
    const piecePointers: Record<string, moment.Moment> = {}; // Tracks when each piece is free for its next step

    // 4. Flatten all tasks and sort by original date to process them in "logical" order
    const sortedAllTasks = [...tasks].sort((a, b) =>
        moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf()
    );

    for (const task of sortedAllTasks) {
        if (!task.planned_date || !task.planned_end || !task.order_id) {
            resultTasks.push(task);
            continue;
        }

        const originalStart = moment(task.planned_date);
        const originalEnd = moment(task.planned_end);
        const durationMinutes = originalEnd.diff(originalStart, 'minutes');

        // Initial proposed start: Apply global offset
        let proposedStart = moment(originalStart).add(globalOffsetMs, 'ms');

        // Piece Constraint: Must start AFTER the previous step of the same piece
        if (piecePointers[task.order_id] && proposedStart.isBefore(piecePointers[task.order_id])) {
            proposedStart = moment(piecePointers[task.order_id]);
        }

        // Snap and Validate Start
        proposedStart = getNextValidWorkTime(snapToNext15Minutes(proposedStart));

        let finalStart = moment(proposedStart);
        let finalEnd = moment(proposedStart);

        // Keep searching for a valid slot if collisions exist
        let foundSlot = false;
        while (!foundSlot) {
            // Calculate end respecting work hours
            let rem = durationMinutes;
            let cur = moment(finalStart);
            while (rem > 0) {
                cur = getNextValidWorkTime(cur);
                const shiftEnd = moment(cur).hour(22).minute(0).second(0).millisecond(0);
                const avail = shiftEnd.diff(cur, 'minutes');

                if (avail <= 0) {
                    cur.add(1, 'day').startOf('day').hour(6);
                    continue;
                }

                const segment = Math.min(rem, avail);
                rem -= segment;
                cur = rem > 0 ? moment(shiftEnd) : moment(cur).add(segment, 'minutes');
            }
            finalEnd = cur;

            // Check Collision with fixed tasks AND already shifted draft tasks
            const collision = obstacles.find(f =>
                (f.machine === task.machine || (task.order_id && f.order_id === task.order_id)) &&
                f.startMs < finalEnd.valueOf() &&
                f.endMs > finalStart.valueOf()
            );

            if (collision) {
                // Jump past collision and snap again
                finalStart = getNextValidWorkTime(snapToNext15Minutes(moment(collision.endMs)));
            } else {
                foundSlot = true;
            }
        }

        const updatedTask = {
            ...task,
            planned_date: finalStart.format('YYYY-MM-DDTHH:mm:ss'),
            planned_end: finalEnd.format('YYYY-MM-DDTHH:mm:ss'),
        };

        resultTasks.push(updatedTask);
        piecePointers[task.order_id] = moment(finalEnd);

        // Add this task to obstacles so later tasks in the same scenario avoid it
        obstacles.push({
            machine: updatedTask.machine || null,
            order_id: updatedTask.order_id || null,
            startMs: finalStart.valueOf(),
            endMs: finalEnd.valueOf()
        });
    }

    return resultTasks;
}
