import {
    startOfDay,
    addHours,
    addMinutes,
    differenceInDays,
    differenceInMinutes,
    differenceInMilliseconds,
    isBefore,
    isAfter,
    format,
} from "date-fns";
import logger from "@/utils/logger";
import {
    type Order,
    type PlanningTask,
    type OrderWithRelations,
    type MachineStep,
    type EvaluationStep,
    type SchedulingResult,
    type ScenarioMetrics,
    type StrategyConfig,
    type PriorityLevel,
    isTreatmentStep,
} from "./types";
import {
    type WorkShift,
    DEFAULT_SHIFTS,
    getShiftEnd,
    getNextValidWorkTime,
    snapToNext15Minutes,
    snapTreatmentToWeekday,
    treatmentEndDate,
} from "./work-shifts";

export type {
    Order,
    PlanningTask,
    OrderWithRelations,
    MachineStep,
    EvaluationStep,
    SchedulingResult,
    ScenarioMetrics,
    StrategyConfig,
    PriorityLevel,
    WorkShift,
};

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
 * Returns the total machine hours for steps BEFORE the first treatment step.
 * Multiplied by quantity to reflect real scheduling load.
 * Used to sort treatment-group orders so the heaviest job goes first, reducing
 * the chance that the bottleneck order gets pushed to the next day.
 */
function getPreTreatmentHours(o: Order): number {
    const evaluation = o.evaluation as EvaluationStep[] | null;
    if (!evaluation) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quantity = Math.max(1, (o as any).quantity ?? 1);
    let hours = 0;
    for (const step of evaluation) {
        if (isTreatmentStep(step)) break;
        const machineStep = step as MachineStep;
        // New format: hours already includes quantity factor.
        // Legacy format (no machining_time): hours is per-piece, multiply by qty.
        const isNewFormat = machineStep.machining_time !== undefined;
        hours += isNewFormat ? machineStep.hours || 0 : (machineStep.hours || 0) * quantity;
    }
    return hours;
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
            // CRITICAL_PATH sort:
            // 1. Orders with treatment come FIRST — they need the earliest machine slots
            //    so that all parts of the same treatment batch are ready at the same time.
            const hasTreatA = a.treatment && a.treatment !== "" && a.treatment !== "N/A" ? 0 : 1;
            const hasTreatB = b.treatment && b.treatment !== "" && b.treatment !== "N/A" ? 0 : 1;
            if (hasTreatA !== hasTreatB) return hasTreatA - hasTreatB;

            // 2. Orders in the same treatment group: longest pre-treatment job goes first.
            //    This ensures the bottleneck piece gets the earliest machine slots, so the
            //    whole batch is ready to ship to the supplier as soon as possible.
            if (hasTreatA === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const treatA = (a as any).treatment || "";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const treatB = (b as any).treatment || "";
                if (treatA === treatB) {
                    const diff = getPreTreatmentHours(b) - getPreTreatmentHours(a);
                    if (diff !== 0) return diff;
                }
            }

            // 3. Fall back to standard priority (urgencia → status → delivery date)
            return compareOrdersByPriority(a, b);
        });
}

/** Helper to calculate end date respecting active work shifts */
export function calculateWorkEnd(start: Date, durationMinutes: number, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
    let remaining = durationMinutes;
    let cursor = new Date(start);

    while (remaining > 0) {
        cursor = getNextValidWorkTime(cursor, shifts);
        const shiftEnd = getShiftEnd(cursor, shifts);
        const availableMinutes = differenceInMinutes(shiftEnd, cursor);

        if (availableMinutes <= 0) {
            cursor = addMinutes(shiftEnd, 1);
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
 * Generates automated planning tasks with shift splitting logic.
 */
export function generateAutomatedPlanning(
    orders: Order[],
    existingTasks: PlanningTask[],
    machines: string[],
    config: StrategyConfig = {
        mainStrategy: "CRITICAL_PATH",
        onlyWithCAD: false,
        onlyWithBlueprint: false,
        onlyWithMaterial: false,
        requireTreatment: false,
    },
    shifts: WorkShift[] = DEFAULT_SHIFTS,
    onProgress?: (current: number, total: number) => void
): SchedulingResult {
    logger.info(`[AutoPlan] Starting with ${orders.length} orders, strategy: ${config.mainStrategy}`);
    const preparedOrders = prepareOrdersForScheduling(orders, config);
    logger.info(`[AutoPlan] Prepared orders: ${preparedOrders.length}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draftTasks: any[] = [];
    const skipped: { order: Order; reason: string }[] = [];

    // Start scheduling from "Next valid slot" relative to Now
    const nowSnapped = snapToNext15Minutes(new Date());
    const globalStart = getNextValidWorkTime(nowSnapped, shifts);

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

    for (const [orderIndex, order] of preparedOrders.entries()) {
        onProgress?.(orderIndex + 1, preparedOrders.length);
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
                const treatmentStart = snapTreatmentToWeekday(new Date(batchEndTime));
                const treatmentEnd = treatmentEndDate(treatmentStart, step.days);
                const register = `${stepNumber}-T`;

                // One treatment record per order (whole batch goes to treatment together)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const treatmentTask: any = {
                    id: `draft-${order.id}-treatment-${register}-${Math.random().toString(36).substr(2, 5)}`,
                    order_id: order.id,
                    machine: null,
                    is_treatment: true,
                    register: register,
                    // treatment_type is used post-loop to consolidate same-type treatments
                    treatment_type: step.treatment,
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

            // ── Machine step (consolidated batch) ──
            // Instead of one task per piece, we schedule the full batch as one continuous
            // block (hours × quantity) and split only at shift boundaries (6am–10pm).
            // e.g. CNC 2hr × 20pzs = 40hr → 2–3 shift-split segments, not 20 tasks.
            if (!machines.includes(step.machine)) {
                skipped.push({ order, reason: `Máquina desconocida: ${step.machine}` });
                pieceSkipped = true;
                break;
            }

            // New format: step.hours already = setup + machining×qty + change×(qty-1).
            // Legacy format (no machining_time): step.hours is per-piece, multiply by qty.
            const isNewFormat = (step as MachineStep).machining_time !== undefined;
            const totalStepHours = isNewFormat ? step.hours : step.hours * quantity;
            const register = `${stepNumber}`;

            // Consume all existing fixed tasks for this step's machine (split segments
            // from a previous save count as partial coverage of the batch).
            const fixedTasksForStep = pieceFixedTasks.filter(
                (t) => t.machine === step.machine && !usedFixedTaskIds.has(t.id as string)
            );
            fixedTasksForStep.forEach((t) => usedFixedTaskIds.add(t.id as string));

            let stepEndTime = new Date(batchEndTime);
            let coveredHours = 0;
            for (const ft of fixedTasksForStep) {
                coveredHours += (ft.endMs - ft.startMs) / (1000 * 60 * 60);
                if (isAfter(new Date(ft.endMs), stepEndTime)) {
                    stepEndTime = new Date(ft.endMs);
                }
            }

            // Schedule remaining hours as shift-split segments
            let remainingHours = Math.max(0, totalStepHours - coveredHours);
            let currentSearchStart = getNextValidWorkTime(snapToNext15Minutes(new Date(stepEndTime)), shifts);

            while (remainingHours > 1e-9) {
                currentSearchStart = getNextValidWorkTime(currentSearchStart, shifts);
                const shiftEnd = getShiftEnd(currentSearchStart, shifts);
                const hoursInShift = differenceInMilliseconds(shiftEnd, currentSearchStart) / (1000 * 60 * 60);

                if (hoursInShift < 0.25) {
                    currentSearchStart = getNextValidWorkTime(addMinutes(shiftEnd, 1), shifts);
                    continue;
                }

                const segmentDuration = Math.min(remainingHours, hoursInShift);
                // Clamp to shiftEnd to prevent floating-point overflow past the shift boundary.
                // addHours with a fractional value can produce a time 1–2 ms past shiftEnd.
                const proposedEnd = new Date(
                    Math.min(addHours(currentSearchStart, segmentDuration).getTime(), shiftEnd.getTime())
                );

                // Only avoid collisions from OTHER orders on the same machine.
                // Same-order sequencing is handled by batchEndTime / stepEndTime.
                // Use the earliest-ENDING collision so we jump the minimum distance
                // and don't skip over valid slots that open up before a longer task ends.
                let collision: (typeof allKnownTasks)[0] | null = null;
                for (const t of allKnownTasks) {
                    if (
                        t.machine === step.machine &&
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (t as any).order_id !== order.id &&
                        t.startMs < proposedEnd.getTime() &&
                        t.endMs > currentSearchStart.getTime()
                    ) {
                        if (!collision || t.endMs < collision.endMs) collision = t;
                    }
                }

                if (collision) {
                    currentSearchStart = snapToNext15Minutes(new Date(collision.endMs));
                    continue;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            batchEndTime = new Date(stepEndTime);
        }

        if (!pieceSkipped) {
            draftTasks.push(...pieceTasks);
        }
    }

    // ── Post-process: consolidate same-type treatment tasks ──
    // Phase 1 – Align: all orders with the same treatment are sent to the supplier
    //   together, so every treatment task of the same type is moved to start when
    //   the LAST order in the group finishes its pre-treatment machining.
    // Phase 2 – Re-sequence: post-treatment machine steps are removed and
    //   re-scheduled from scratch, one full order at a time (the order that was
    //   ready for treatment first gets the machine first after the batch returns).
    //   This guarantees sequential machining with no interleaving between orders.
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const treatmentTasksByType = new Map<string, any[]>();
        for (const task of draftTasks) {
            if (!task.is_treatment || !task.treatment_type) continue;
            const key = (task.treatment_type as string).toLowerCase().trim();
            if (!treatmentTasksByType.has(key)) treatmentTasksByType.set(key, []);
            treatmentTasksByType.get(key)!.push(task);
        }

        for (const [, treatmentGroup] of treatmentTasksByType) {
            const uniqueOrders = new Set<string>(treatmentGroup.map((t: any) => t.order_id as string));
            if (uniqueOrders.size < 2) continue;

            // ── Phase 1: Align all treatment tasks to the latest "machine-ready" time ──
            // IMPORTANT: Do NOT use treatTask.startMs directly — it may be stale.
            // When an order has multiple treatment types (e.g. TreatA → Machine → TreatB),
            // a previous treatment group's Phase 2 may have re-scheduled the intermediate
            // machine step to a later time WITHOUT updating TreatB.startMs.  Reading the
            // stale value would make TreatB appear to start before that machine step ends,
            // causing a visible overlap on the Gantt.
            // Instead, scan draftTasks for the actual end of the last machine task that
            // precedes this treatment step; fall back to treatTask.startMs only when no
            // machine task exists before it (e.g. the treatment is the very first step).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const getActualReadyTime = (treatTask: any): number => {
                const ordId = treatTask.order_id as string;
                const tStepNum = parseInt((treatTask.register as string).replace("-T", ""));
                let maxEnd = 0;
                for (const dt of draftTasks) {
                    if ((dt as any).order_id !== ordId) continue;
                    if ((dt as any).is_treatment || !(dt as any).machine) continue;
                    if (parseInt((dt as any).register || "0") < tStepNum && (dt as any).endMs > maxEnd) {
                        maxEnd = (dt as any).endMs as number;
                    }
                }
                return maxEnd > 0 ? maxEnd : (treatTask.startMs as number);
            };

            // Capture actual ready time per order — used both to compute maxStartMs and
            // to establish Phase 2 priority (the order ready earliest goes first).
            const originalStartByOrder = new Map<string, number>(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                treatmentGroup.map((t: any) => [t.order_id as string, getActualReadyTime(t)])
            );
            const maxStartMs = Math.max(...Array.from(originalStartByOrder.values()));

             
            for (const t of treatmentGroup) {
                const alignedStart = snapTreatmentToWeekday(new Date(maxStartMs));
                // Recalculate end using working days from the original step definition
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const evalSteps = (t.production_orders as any)?.evaluation as any[] | null;
                const stepIdx = parseInt((t.register as string).replace("-T", "")) - 1;
                const workingDays: number = evalSteps?.[stepIdx]?.days ?? 1;
                const alignedEnd = treatmentEndDate(alignedStart, workingDays);
                t.planned_date = format(alignedStart, "yyyy-MM-dd'T'HH:mm:ss");
                t.planned_end = format(alignedEnd, "yyyy-MM-dd'T'HH:mm:ss");
                t.startMs = alignedStart.getTime();
                t.endMs = alignedEnd.getTime();
            }

            // Common treatment end (take max in case different orders have different days)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const treatmentEndMs = Math.max(...treatmentGroup.map((t: any) => t.endMs as number));

            // ── Phase 2: Re-schedule post-treatment machine steps ──
            // Priority: the order that finished pre-treatment machining first goes first.
            const sortedOrders = [...uniqueOrders].sort(
                (a, b) => (originalStartByOrder.get(a) || 0) - (originalStartByOrder.get(b) || 0)
            );

            // Collect IDs of post-treatment tasks to remove and replace.
            // IMPORTANT: only remove machine steps between THIS treatment and the NEXT
            // treatment step (if any).  Removing steps that belong to a later treatment
            // group would cause those tasks to disappear if that later group's
            // uniqueOrders < 2 (and therefore its Phase 2 is skipped).
            const toRemoveIds = new Set<string>();
            for (const orderId of sortedOrders) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const treatTask = treatmentGroup.find((t: any) => t.order_id === orderId)!;
                const treatStepNum = parseInt((treatTask.register as string).replace("-T", ""));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const evalForRemove = (treatTask.production_orders as any)?.evaluation as any[] | null;

                // Find the 1-indexed step number of the NEXT treatment after this one
                let nextTreatStepNum = (evalForRemove?.length ?? 0) + 1;
                if (evalForRemove) {
                    for (let si = treatStepNum; si < evalForRemove.length; si++) {
                        if (isTreatmentStep(evalForRemove[si])) {
                            nextTreatStepNum = si + 1; // 1-indexed
                            break;
                        }
                    }
                }

                for (const t of draftTasks) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ((t as any).order_id !== orderId) continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ((t as any).is_treatment || !(t as any).machine) continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const reg = parseInt((t as any).register || "0");
                    // Only remove steps between this treatment and the next treatment
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (reg > treatStepNum && reg < nextTreatStepNum) toRemoveIds.add((t as any).id);
                }
            }

            // Remove from draftTasks and allKnownTasks
            for (let i = draftTasks.length - 1; i >= 0; i--)
                if (toRemoveIds.has(draftTasks[i].id)) draftTasks.splice(i, 1);
            for (let i = allKnownTasks.length - 1; i >= 0; i--)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (toRemoveIds.has((allKnownTasks[i] as any).id)) allKnownTasks.splice(i, 1);

            // Per-machine availability tracker for this batch
            const machineEndTimes = new Map<string, number>();

            for (const orderId of sortedOrders) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const treatTask = treatmentGroup.find((t: any) => t.order_id === orderId)!;
                const treatStepNum = parseInt((treatTask.register as string).replace("-T", ""));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const evaluation = (treatTask.production_orders as any)?.evaluation as any[] | null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const quantity = Math.max(1, (treatTask.production_orders as any)?.quantity ?? 1);
                if (!evaluation) continue;

                // Cursor: this order cannot start post-treatment before treatmentEnd
                let orderCursor = treatmentEndMs;

                // Iterate evaluation steps that come after the treatment, stopping at next treatment
                for (let si = treatStepNum; si < evaluation.length; si++) {
                    const step = evaluation[si];
                    if (isTreatmentStep(step)) break; // stop at next treatment step

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const machine = (step as any).machine as string | undefined;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const totalHours = ((step as any).hours || 0) * quantity;
                    if (!machine || totalHours <= 0) continue;

                    const register = `${si + 1}`; // 1-indexed step number
                    let remainingHours = totalHours;
                    let cursor = getNextValidWorkTime(
                        snapToNext15Minutes(new Date(Math.max(orderCursor, machineEndTimes.get(machine) || 0))),
                        shifts
                    );

                    while (remainingHours > 1e-9) {
                        cursor = getNextValidWorkTime(cursor, shifts);
                        const shiftEnd = getShiftEnd(cursor, shifts);
                        const hoursInShift = differenceInMilliseconds(shiftEnd, cursor) / (1000 * 60 * 60);

                        if (hoursInShift < 0.25) {
                            cursor = getNextValidWorkTime(addMinutes(shiftEnd, 1), shifts);
                            continue;
                        }

                        const segDuration = Math.min(remainingHours, hoursInShift);
                        // Clamp to shiftEnd to prevent floating-point overflow.
                        const proposedEnd = new Date(
                            Math.min(addHours(cursor, segDuration).getTime(), shiftEnd.getTime())
                        );

                        // Avoid collisions with other orders on this machine.
                        // Pick the earliest-ending collision to minimise the jump distance.
                        let collision: (typeof allKnownTasks)[0] | null = null;
                        for (const t of allKnownTasks) {
                            if (
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (t as any).machine === machine &&
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (t as any).order_id !== orderId &&
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (t as any).startMs < proposedEnd.getTime() &&
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (t as any).endMs > cursor.getTime()
                            ) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                if (!collision || (t as any).endMs < (collision as any).endMs) collision = t;
                            }
                        }
                        if (collision) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            cursor = snapToNext15Minutes(new Date((collision as any).endMs));
                            continue;
                        }

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const newSeg: any = {
                            id: `draft-${orderId}-${machine}-${register}-bat-${Math.random()
                                .toString(36)
                                .substr(2, 5)}`,
                            order_id: orderId,
                            machine,
                            register,
                            planned_date: format(cursor, "yyyy-MM-dd'T'HH:mm:ss"),
                            planned_end: format(proposedEnd, "yyyy-MM-dd'T'HH:mm:ss"),
                            status: "pending",
                            production_orders: treatTask.production_orders,
                            isDraft: true,
                            startMs: cursor.getTime(),
                            endMs: proposedEnd.getTime(),
                        };

                        draftTasks.push(newSeg);
                        allKnownTasks.push(newSeg);
                        remainingHours -= segDuration;
                        cursor = new Date(proposedEnd);
                    }

                    // Advance cursors past this step's last segment
                    const stepEnd = draftTasks
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((t: any) => t.order_id === orderId && t.register === register)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .reduce((max: number, t: any) => Math.max(max, t.endMs as number), orderCursor);
                    machineEndTimes.set(machine, Math.max(machineEndTimes.get(machine) || 0, stepEnd));
                    orderCursor = Math.max(orderCursor, stepEnd);
                }

                // After re-scheduling this order's post-treatment steps, propagate the
                // new orderCursor to any SUBSEQUENT treatment tasks for the same order.
                // Without this, those treatment tasks keep their stale startMs from the
                // main loop — causing them to appear to start before the preceding machine
                // work finishes (visual overlap on the Gantt) and giving Phase 1 of later
                // treatment groups an incorrect alignment anchor.
                for (const dt of draftTasks) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ((dt as any).order_id !== orderId) continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!(dt as any).is_treatment) continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const dtRegNum = parseInt(((dt as any).register as string).replace("-T", ""));
                    if (dtRegNum <= treatStepNum) continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (orderCursor > (dt as any).startMs) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const duration = (dt as any).endMs - (dt as any).startMs;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (dt as any).startMs = orderCursor;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (dt as any).endMs = orderCursor + duration;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (dt as any).planned_date = format(new Date(orderCursor), "yyyy-MM-dd'T'HH:mm:ss");
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (dt as any).planned_end = format(new Date(orderCursor + duration), "yyyy-MM-dd'T'HH:mm:ss");
                    }
                }
            }
        }
    }

    // Calculate Metrics
    const metrics: ScenarioMetrics = {
        totalOrders: preparedOrders.length,
        totalTasks: draftTasks.length,
        totalHours: draftTasks.reduce((sum: number, t: any) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderTasks = draftTasks.filter((t: any) => t.order_id === order.id);
        if (orderTasks.length === 0) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            .filter((t: any) => t.machine === m && !t.is_treatment)
            .reduce(
                (sum: number, t: any) =>
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
