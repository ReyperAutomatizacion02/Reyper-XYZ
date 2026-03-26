import {
    startOfDay,
    addDays,
    addHours,
    addMinutes,
    addMilliseconds,
    differenceInDays,
    differenceInMinutes,
    differenceInMilliseconds,
    isBefore,
    isAfter,
    min as minDate,
    format,
    getHours,
    getDay,
    getMinutes,
    getSeconds,
    getMilliseconds,
    set,
} from "date-fns";
import { Database } from "@/utils/supabase/types";
import logger from "@/utils/logger";

export type Order = Database["public"]["Tables"]["production_orders"]["Row"];
export type PlanningTask = Database["public"]["Tables"]["planning"]["Row"];

/** Order with optional joined relations used in scheduling views */
export type OrderWithRelations = Order & {
    projects?: {
        delivery_date?: string | null;
        start_date?: string | null;
        drive_folder_id?: string | null;
        company?: string | null;
    } | null;
};

/** Planning task extended with draft flag used in scheduling UI */
export type PlanningTaskWithDraft = PlanningTask & { isDraft?: boolean };

export type EvaluationStep =
    | { type?: "machine"; machine: string; hours: number }
    | { type: "treatment"; treatment_id: string; treatment: string; days: number };

/** Returns true if the step is a treatment (external supplier) step.
 *  Detects all formats:
 *  - new:    { type: "treatment", treatment_id: "...", treatment: "...", days: N }
 *  - legacy: { type: "treatment", treatment: "...", days: N }   (no treatment_id)
 *  - oldest: { treatment: "...", days: N }                      (no type, no treatment_id) */
export function isTreatmentStep(
    s: EvaluationStep
): s is { type: "treatment"; treatment_id: string; treatment: string; days: number } {
    return (s as any).type === "treatment" || !!(s as any).treatment_id || ("treatment" in s && !("machine" in s));
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

export type SchedulingStrategy =
    | "DELIVERY_DATE"
    | "FAB_TIME"
    | "FAST_TRACK"
    | "TREATMENTS"
    | "CRITICAL_PATH"
    | "PROJECT_GROUP"
    | "MATERIAL_OPTIMIZATION"
    | "URGENCY";

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

    const now = startOfDay(new Date());
    // Append T00:00:00 to date-only strings to force local time parsing
    // (new Date("2026-03-20") parses as UTC midnight, causing off-by-one errors)
    const deliveryStr = deliveryDate.includes("T") ? deliveryDate : deliveryDate + "T00:00:00";
    const delivery = startOfDay(new Date(deliveryStr));
    const diffDays = differenceInDays(delivery, now);

    if (diffDays < 0) return "CRITICAL"; // Overdue
    if (diffDays <= 3) return "SOON"; // Within 3 days
    if (diffDays <= 10) return "NORMAL"; // 4-10 days
    return "PLENTY"; // More than 10 days
}

/**
 * Helper: Get priority score based on General Status.
 * Lower number = Higher Priority.
 */
export function getStatusPriority(status: string): number {
    switch (status) {
        case "A8-MATERIAL DISPONIBLE":
            return 2;
        case "A7-ESPERANDO MATERIAL":
            return 3;
        case "A5-VERIFICAR MATERIAL":
            return 4;
        case "A0-ESPERANDO MATERIAL":
            return 5;
        case "A0-NUEVO PROYECTO":
            return 5;
        default:
            return 99; // Low priority for others
    }
}

/**
 * Comparator function for sorting orders by Priority (Status > Delivery Date).
 */
export function compareOrdersByPriority(a: Order, b: Order): number {
    // 0. Manual Urgency Priority (The most important)
    const urgA = a.urgencia ? 0 : 1;
    const urgB = b.urgencia ? 0 : 1;
    if (urgA !== urgB) return urgA - urgB;

    // 1. Sort by Status Priority
    const prioA = getStatusPriority(a.general_status ?? "");
    const prioB = getStatusPriority(b.general_status ?? "");

    if (prioA !== prioB) {
        return prioA - prioB; // Lower priority number first
    }

    // 2. Sort by Delivery Date (Urgency) - Earlier date first
    const getDeliveryDate = (item: OrderWithRelations) => {
        if (item.projects?.delivery_date) return new Date(item.projects.delivery_date).getTime();
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
    return orders
        .filter((order) => {
            // Must have evaluation
            const evalData = order.evaluation;
            if (!evalData || !Array.isArray(evalData) || evalData.length === 0) {
                return false;
            }

            // CAD Ready filter (3D Model) — checks model_url
            if (config.onlyWithCAD) {
                if (!order.model_url) return false;
            }

            // Blueprint Ready filter (Plano) — checks drawing_url
            if (config.onlyWithBlueprint) {
                if (!order.drawing_url) return false;
            }

            // Material Ready filter
            if (config.onlyWithMaterial) {
                if (order.general_status !== "A8-MATERIAL DISPONIBLE") return false;
            }

            // Requires Treatment filter
            if (config.requireTreatment) {
                const hasTreatment = order.treatment && order.treatment !== "" && order.treatment !== "N/A";
                if (!hasTreatment) return false;
            }

            return true;
        })
        .sort((a, b) => {
            const getHoursTotal = (o: Order) =>
                (o.evaluation as EvaluationStep[] | null)?.reduce(
                    (sum: number, s: EvaluationStep) => sum + (isTreatmentStep(s) ? 0 : s.hours || 0),
                    0
                ) ?? 0;

            switch (config.mainStrategy) {
                case "FAB_TIME":
                    return getHoursTotal(b) - getHoursTotal(a); // Longest first

                case "FAST_TRACK":
                    return getHoursTotal(a) - getHoursTotal(b); // Shortest first

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
                case "URGENCY":
                // Urgency strategy actually just uses the fallback which now handles urgency first,
                // but we explicitly define it for clarity.
                default:
                    return compareOrdersByPriority(a, b);
            }
        });
}

/** Helper to set time components on a Date */
function setTime(date: Date, hours: number, minutes: number, seconds: number, ms: number = 0): Date {
    return set(date, { hours, minutes, seconds, milliseconds: ms });
}

/**
 * Moves a date to the next valid working minute.
 * Work Hours: Mon-Sat, 06:00 - 22:00.
 */
export function getNextValidWorkTime(date: Date): Date {
    let current = new Date(date);

    // Loop until valid
    while (true) {
        const hour = getHours(current);
        const day = getDay(current); // 0 = Sunday, 1 = Monday...

        // Rule 1: No Sundays
        if (day === 0) {
            current = setTime(startOfDay(addDays(current, 1)), 6, 0, 0);
            continue;
        }

        // Rule 2: Before 6 AM -> Move to 6 AM same day
        if (hour < 6) {
            current = setTime(current, 6, 0, 0);
            continue;
        }

        // Rule 3: After 10 PM (22:00) -> Move to 6 AM next day
        if (hour >= 22) {
            current = setTime(startOfDay(addDays(current, 1)), 6, 0, 0);
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
export function snapToNext15Minutes(date: Date): Date {
    const current = new Date(date);
    const minutes = getMinutes(current);
    const seconds = getSeconds(current);
    const ms = getMilliseconds(current);

    // If already at a 15-min mark exactly, return it
    if (minutes % 15 === 0 && seconds === 0 && ms === 0) {
        return current;
    }

    const remainder = 15 - (minutes % 15);
    return set(addMinutes(current, remainder), { seconds: 0, milliseconds: 0 });
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
        requireTreatment: false,
    }
): SchedulingResult {
    logger.info(`[AutoPlan] Starting with ${orders.length} orders, strategy: ${config.mainStrategy}`);
    const preparedOrders = prepareOrdersForScheduling(orders, config);
    logger.info(`[AutoPlan] Prepared orders: ${preparedOrders.length}`);

    const draftTasks: any[] = [];
    const skipped: { order: Order; reason: string }[] = [];

    // Start scheduling from "Next valid slot" relative to Now
    const nowSnapped = snapToNext15Minutes(new Date());
    const globalStart = getNextValidWorkTime(nowSnapped);

    // Initial tasks to consider for collisions and current state
    // We filter out "flexible" tasks: future, not locked, and not started.
    const allKnownTasks = [...existingTasks]
        .filter((t) => {
            const isFuture = !isBefore(new Date(t.planned_date!), globalStart);
            const isLocked = t.locked === true;
            const hasStarted = !!t.check_in;
            const isFixed = isLocked || hasStarted || !isFuture;
            return isFixed;
        })
        .map((t) => ({
            ...t,
            startMs: new Date(t.planned_date!).getTime(),
            endMs: new Date(t.planned_end!).getTime(),
        }));

    for (const order of preparedOrders) {
        const evaluation = order.evaluation as EvaluationStep[] | null;
        if (!evaluation || evaluation.length === 0) continue;

        const quantity = Math.max(1, order.quantity ?? 1);
        // batchEndTime tracks when ALL pieces of the current step finish,
        // so the next step can only start after the full batch is done (Option A).
        let batchEndTime = new Date(globalStart);

        const pieceTasks: Partial<PlanningTask>[] = [];
        let pieceSkipped = false;

        const pieceFixedTasks = allKnownTasks
            .filter((t) => t.order_id === order.id)
            .sort((a, b) => a.startMs - b.startMs);

        // Track which fixed tasks have already been consumed to avoid double-matching
        const usedFixedTaskIds = new Set<string>();

        for (let i = 0; i < evaluation.length; i++) {
            const step = evaluation[i];
            const stepNumber = i + 1;

            // ── Treatment step: no machine occupied, advance batchEndTime by calendar days ──
            if (isTreatmentStep(step)) {
                const treatmentStart = new Date(batchEndTime);
                const treatmentEnd = addDays(treatmentStart, step.days);
                const register = `${stepNumber}-T`;

                // One treatment record per order (whole batch goes to treatment together)
                const treatmentTask: any = {
                    id: `draft-${order.id}-treatment-${register}-${Math.random().toString(36).substr(2, 5)}`,
                    order_id: order.id,
                    machine: null,
                    is_treatment: true,
                    register: register,
                    planned_date: format(treatmentStart, "yyyy-MM-dd'T'HH:mm:ss"),
                    planned_end: format(treatmentEnd, "yyyy-MM-dd'T'HH:mm:ss"),
                    status: "pending",
                    production_orders: order,
                    isDraft: true,
                    startMs: treatmentStart.getTime(),
                    endMs: treatmentEnd.getTime(),
                };

                pieceTasks.push(treatmentTask);
                // Treatment tasks are NOT added to allKnownTasks for collision detection —
                // machines remain free for other orders during this time.
                batchEndTime = treatmentEnd;
                continue;
            }

            // ── Machine step ──
            if (!machines.includes(step.machine)) {
                skipped.push({ order, reason: `Máquina desconocida: ${step.machine}` });
                pieceSkipped = true;
                break;
            }

            // Match up to `quantity` existing fixed tasks for this step's machine
            const fixedTasksForStep = pieceFixedTasks.filter(
                (t) => t.machine === step.machine && !usedFixedTaskIds.has(t.id as string)
            );
            const matchedFixedTasks = fixedTasksForStep.slice(0, quantity);
            matchedFixedTasks.forEach((t) => usedFixedTaskIds.add(t.id as string));

            // stepEndTime tracks the maximum end across all pieces in this step
            let stepEndTime = new Date(batchEndTime);

            for (const matched of matchedFixedTasks) {
                const taskEnd = new Date(matched.endMs);
                if (isAfter(taskEnd, stepEndTime)) {
                    stepEndTime = taskEnd;
                }
            }

            // Schedule only the pieces without a matching fixed task
            for (let j = matchedFixedTasks.length + 1; j <= quantity; j++) {
                const register = quantity > 1 ? `${stepNumber}-${j}` : `${stepNumber}`;

                let remainingHours = step.hours;
                // Each piece starts searching from batchEndTime (end of previous step's batch).
                // Collision detection naturally sequences pieces on the same machine.
                let currentSearchStart = getNextValidWorkTime(new Date(batchEndTime));

                while (remainingHours > 0) {
                    currentSearchStart = getNextValidWorkTime(currentSearchStart);
                    const shiftEnd = setTime(currentSearchStart, 22, 0, 0);
                    const hoursInShift = differenceInMilliseconds(shiftEnd, currentSearchStart) / (1000 * 60 * 60);

                    if (hoursInShift < 0.25) {
                        currentSearchStart = getNextValidWorkTime(addMinutes(shiftEnd, 1));
                        continue;
                    }

                    const segmentDuration = Math.min(remainingHours, hoursInShift);
                    const proposedEnd = addHours(currentSearchStart, segmentDuration);

                    const collision = allKnownTasks.find(
                        (t) =>
                            (t.machine === step.machine || t.order_id === order.id) &&
                            t.startMs < proposedEnd.getTime() &&
                            t.endMs > currentSearchStart.getTime()
                    );

                    if (collision) {
                        currentSearchStart = new Date(collision.endMs);
                        continue;
                    }

                    const newTask: any = {
                        id: `draft-${order.id}-${step.machine}-${register}-${Math.random().toString(36).substr(2, 5)}`,
                        order_id: order.id,
                        machine: step.machine,
                        register: register,
                        planned_date: format(currentSearchStart, "yyyy-MM-dd'T'HH:mm:ss"),
                        planned_end: format(proposedEnd, "yyyy-MM-dd'T'HH:mm:ss"),
                        status: "pending",
                        production_orders: order,
                        isDraft: true,
                        startMs: currentSearchStart.getTime(),
                        endMs: proposedEnd.getTime(),
                    };

                    pieceTasks.push(newTask);
                    allKnownTasks.push(newTask);

                    remainingHours -= segmentDuration;
                    currentSearchStart = new Date(proposedEnd);
                }

                if (isAfter(currentSearchStart, stepEndTime)) {
                    stepEndTime = new Date(currentSearchStart);
                }
            }

            batchEndTime = new Date(stepEndTime);
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
            if (t.is_treatment) return sum; // Treatment days are not machine hours
            const startDate = new Date(t.planned_date!);
            const endDate = new Date(t.planned_end!);
            return sum + differenceInMilliseconds(endDate, startDate) / (1000 * 60 * 60);
        }, 0),
        lateOrders: 0,
        avgLeadTimeDays: 0,
        machineUtilization: {},
    };

    let totalLeadTimeMs = 0;
    preparedOrders.forEach((order) => {
        const orderTasks = draftTasks.filter((t) => t.order_id === order.id);
        if (orderTasks.length === 0) return;

        const lastTaskEnd = orderTasks.reduce((maxDate: Date, t: any) => {
            const end = new Date(t.planned_end!);
            return isAfter(end, maxDate) ? end : maxDate;
        }, new Date(0));

        const deliveryDate = (order as OrderWithRelations).projects?.delivery_date;
        if (deliveryDate && isAfter(lastTaskEnd, new Date(deliveryDate))) {
            metrics.lateOrders++;
        }

        const orderStart = new Date(order.created_at!);
        totalLeadTimeMs += lastTaskEnd.getTime() - orderStart.getTime();
    });

    if (metrics.totalOrders > 0) {
        metrics.avgLeadTimeDays = totalLeadTimeMs / metrics.totalOrders / (1000 * 60 * 60 * 24);
    }

    // Machine Utilization
    machines.forEach((m) => {
        metrics.machineUtilization[m] = draftTasks
            .filter((t) => t.machine === m && !t.is_treatment)
            .reduce(
                (sum, t) =>
                    sum +
                    differenceInMilliseconds(new Date(t.planned_end!), new Date(t.planned_date!)) / (1000 * 60 * 60),
                0
            );
    });

    return {
        tasks: draftTasks,
        skipped,
        metrics,
    };
}

/** Helper to calculate end date respecting work hours (06:00-22:00, Mon-Sat) */
function calculateWorkEnd(start: Date, durationMinutes: number): Date {
    let remaining = durationMinutes;
    let cursor = new Date(start);

    while (remaining > 0) {
        cursor = getNextValidWorkTime(cursor);
        const shiftEnd = setTime(cursor, 22, 0, 0);
        const availableMinutes = differenceInMinutes(shiftEnd, cursor);

        if (availableMinutes <= 0) {
            cursor = setTime(startOfDay(addDays(cursor, 1)), 6, 0, 0);
            continue;
        }

        const segmentMinutes = Math.min(remaining, availableMinutes);
        remaining -= segmentMinutes;

        if (remaining > 0) {
            cursor = new Date(shiftEnd);
        } else {
            cursor = addMinutes(cursor, segmentMinutes);
        }
    }
    return cursor;
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

    // Ensure target is within work hours
    targetStart = getNextValidWorkTime(setTime(targetStart, 6, 0, 0));

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

        let newStart = getNextValidWorkTime(addMilliseconds(new Date(task.planned_date!), offsetMs));
        const duration = differenceInMinutes(new Date(task.planned_end!), new Date(task.planned_date!));

        // Calculate new end respecting work hours
        let newEnd = calculateWorkEnd(newStart, duration);

        // Check for collisions and nudge forward if needed
        const collision = existingTasksMap.find(
            (t) =>
                (t.machine === task.machine || (task.order_id && t.order_id === task.order_id)) &&
                t.startMs < newEnd.getTime() &&
                t.endMs > newStart.getTime()
        );

        if (collision) {
            // Nudge start past the collision
            newStart = getNextValidWorkTime(new Date(collision.endMs));
            // Recalculate end from new start
            newEnd = calculateWorkEnd(newStart, duration);
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
    _machines: string[] // legacy
): Partial<PlanningTask>[] {
    if (tasks.length === 0) return tasks;

    // 1. Determine "Fixed" tasks for collision detection (locked or in progress or past)
    const nowSnapped = snapToNext15Minutes(new Date());
    const globalStart = getNextValidWorkTime(nowSnapped);

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
    const shiftTargetStart = getNextValidWorkTime(snapToNext15Minutes(targetTime));
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
        const isTreatmentTask = !!(task as any).is_treatment;
        const calendarDurationMs = differenceInMilliseconds(originalEnd, originalStart);
        const computeEnd = (start: Date): Date =>
            isTreatmentTask ? addMilliseconds(start, calendarDurationMs) : calculateWorkEnd(start, durationMinutes);

        // Initial proposed start: Apply global offset
        let proposedStart = addMilliseconds(originalStart, globalOffsetMs);

        // Piece Constraint: Must start AFTER the previous step of the same piece
        if (piecePointers[task.order_id] && isBefore(proposedStart, piecePointers[task.order_id])) {
            proposedStart = new Date(piecePointers[task.order_id]);
        }

        // Snap and Validate Start (treatment tasks still start at a valid work time)
        proposedStart = getNextValidWorkTime(snapToNext15Minutes(proposedStart));

        let finalStart = new Date(proposedStart);
        let finalEnd: Date;

        // Keep searching for a valid slot if collisions exist
        let foundSlot = false;
        while (!foundSlot) {
            // Calculate end: calendar duration for treatments, work-hours for machine tasks
            finalEnd = computeEnd(finalStart);

            // Check Collision with fixed tasks AND already shifted draft tasks
            const collision = obstacles.find(
                (f) =>
                    (f.machine === task.machine || (task.order_id && f.order_id === task.order_id)) &&
                    f.startMs < finalEnd!.getTime() &&
                    f.endMs > finalStart.getTime()
            );

            if (collision) {
                // Jump past collision and snap again
                finalStart = getNextValidWorkTime(snapToNext15Minutes(new Date(collision.endMs)));
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
