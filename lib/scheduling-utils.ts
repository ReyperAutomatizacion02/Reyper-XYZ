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
 * Filter and sort orders for scheduling.
 */
export function prepareOrdersForScheduling(orders: Order[]): Order[] {
    return (orders as any[])
        .filter(order => {
            // Must have evaluation
            const evalData = order.evaluation as any;
            if (!evalData || !Array.isArray(evalData) || evalData.length === 0) {
                // console.log(`[AutoPlan] Rejected ${order.part_code}: No evaluation`);
                return false;
            }
            // Accepted regardless of incomplete fields (will represent lower priority)
            console.log(`[AutoPlan] Accepted ${order.part_code} for ranking.`);
            return true;
        })
        .sort(compareOrdersByPriority);
}

/**
 * Finds the next available slot for a machine after a certain date.
 */
/**
 * Moves a date to the next valid working minute.
 * Work Hours: Mon-Sat, 06:00 - 22:00.
 */
function getNextValidWorkTime(date: moment.Moment): moment.Moment {
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
    machines: string[]
): SchedulingResult {
    console.log("[AutoPlan] Starting with", orders.length, "orders and", existingTasks.length, "tasks.");
    const preparedOrders = prepareOrdersForScheduling(orders);
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
            console.log(`[AutoPlan] Check Step: Order ${(order as any).part_code}, Machine ${step.machine}, Hours ${step.hours}`);
            if (!machines.includes(step.machine)) {
                console.warn(`[AutoPlan] Unknown machine: ${step.machine}`);
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
            console.log(`[AutoPlan] Order: ${(order as any).part_code}, Machine: ${step.machine}, StepHours: ${step.hours}, Planned: ${totalPlannedHours}, Remaining: ${remainingHours}`);

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
                // If for some reason searchStart > shiftEnd (bug), getNextValidWorkTime would have moved it.
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

    return {
        tasks: draftTasks,
        skipped
    };
}
