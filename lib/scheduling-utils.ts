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
 * e.g. 14:04 -> 14:15. 14:15:01 -> 14:30.
 */
function snapToNext15Minutes(date: moment.Moment): moment.Moment {
    const current = moment(date);
    const remainder = 15 - (current.minute() % 15);
    // Always move forward to next slot
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

    // Virtual timelines to keep track of newly added draft tasks
    // Sort tasks by start time for faster collision checks
    const allKnownTasks = [...existingTasks].map(t => ({
        ...t,
        startMs: moment(t.planned_date).valueOf(),
        endMs: moment(t.planned_end).valueOf()
    }));

    // Start scheduling from "Next valid slot" relative to Now
    // 1. Snap Now to next 15m
    const nowSnapped = snapToNext15Minutes(moment());
    // 2. Ensure that snapped time is within working hours
    const globalStart = getNextValidWorkTime(nowSnapped);

    for (const order of preparedOrders) {
        const evaluation = (order as any).evaluation as any as EvaluationStep[];
        let dependencyEndTime = moment(globalStart);

        const pieceTasks: any[] = [];
        let pieceSkipped = false;

        for (const step of evaluation) {
            if (!machines.includes(step.machine)) {
                skipped.push({ order, reason: `Máquina desconocida: ${step.machine}` });
                pieceSkipped = true;
                break;
            }

            // Deduplication & Partial Planning:
            const relatedTasks = allKnownTasks.filter(t =>
                t.order_id === order.id &&
                t.machine === step.machine
            );

            const totalPlannedHours = relatedTasks.reduce((sum, t) => {
                const start = moment(t.planned_date);
                const end = moment(t.planned_end);
                return sum + end.diff(start, 'hours', true);
            }, 0);

            let remainingHours = step.hours - totalPlannedHours;

            // If we have existing tasks, ensure new planning starts AFTER them
            if (relatedTasks.length > 0) {
                const latestEnd = relatedTasks.reduce((max, t) => {
                    const end = moment(t.planned_end);
                    return end.isAfter(max) ? end : max;
                }, moment(dependencyEndTime));

                // If fully planned (tolerance 0.1 hours)
                if (remainingHours < 0.1) {
                    dependencyEndTime = latestEnd;
                    continue;
                }

                // Start searching after the existing work
                dependencyEndTime = latestEnd;
            }
            // Pointer for where we are trying to schedule this step
            // Must begin after the previous step (dependency) finished
            let currentSearchStart = getNextValidWorkTime(moment(dependencyEndTime));

            while (remainingHours > 0) {
                // 1. Ensure currentSearchStart is valid (Mon-Sat 6-22)
                currentSearchStart = getNextValidWorkTime(currentSearchStart);

                // 2. Determine end of current shift (Today 22:00)
                const shiftEnd = moment(currentSearchStart).hour(22).minute(0).second(0);

                // 3. Calculate max available time in this shift
                const hoursInShift = shiftEnd.diff(currentSearchStart, 'hours', true);

                // If hardly any time left (< 15 mins), just skip to next day
                if (hoursInShift < 0.25) {
                    currentSearchStart = getNextValidWorkTime(shiftEnd.add(1, 'minute'));
                    continue;
                }

                // 4. Proposed segment duration
                const segmentDuration = Math.min(remainingHours, hoursInShift);
                const proposedEnd = moment(currentSearchStart).add(segmentDuration, 'hours');

                // 5. Check for collisions in [currentSearchStart, proposedEnd]
                const collision = allKnownTasks.find(t =>
                    t.machine === step.machine &&
                    t.startMs < proposedEnd.valueOf() &&
                    t.endMs > currentSearchStart.valueOf()
                );

                if (collision) {
                    // Jump past the collision
                    currentSearchStart = moment(collision.endMs);
                    // Check validity again (might push to night/sunday) in next loop
                    continue;
                }

                // 6. No collision! Create segment.
                const newTask: any = {
                    id: `draft-${order.id}-${step.machine}-${Math.random().toString(36).substr(2, 5)}`,
                    order_id: order.id,
                    machine: step.machine,
                    planned_date: currentSearchStart.format('YYYY-MM-DDTHH:mm:ss'),
                    planned_end: proposedEnd.format('YYYY-MM-DDTHH:mm:ss'),
                    status: 'pending',
                    production_orders: order,
                    isDraft: true,
                    // Store helper for collision checking
                    startMs: currentSearchStart.valueOf(),
                    endMs: proposedEnd.valueOf()
                };

                pieceTasks.push(newTask);
                allKnownTasks.push(newTask);

                // Update loop state
                remainingHours -= segmentDuration;
                currentSearchStart = moment(proposedEnd);

                // If we finished a segment exactly at 22:00, next loop will move start to next day automatically
            }

            // Update dependency time for next step of THIS piece
            // It finishes when the LAST segment finishes
            dependencyEndTime = currentSearchStart;
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
            t.machine === task.machine &&
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
