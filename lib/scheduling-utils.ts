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
        code?: string | null;
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

// ── Work Shifts ───────────────────────────────────────────────────────────────

export interface WorkShift {
    id: string;
    name: string;
    /** "HH:MM:SS" or "HH:MM" – Postgres TIME column */
    start_time: string;
    end_time: string;
    /** Day-of-week numbers: 0=Sun, 1=Mon … 6=Sat */
    days_of_week: number[];
    active: boolean;
    sort_order: number;
}

/** Default schedule matches the legacy hardcoded window: Mon-Sat 06:00-22:00 */
export const DEFAULT_SHIFTS: WorkShift[] = [
    {
        id: "default-1",
        name: "Turno 1",
        start_time: "06:00:00",
        end_time: "14:00:00",
        days_of_week: [1, 2, 3, 4, 5, 6],
        active: true,
        sort_order: 1,
    },
    {
        id: "default-2",
        name: "Turno 2",
        start_time: "14:00:00",
        end_time: "22:00:00",
        days_of_week: [1, 2, 3, 4, 5, 6],
        active: true,
        sort_order: 2,
    },
];

/** Parse "HH:MM:SS" or "HH:MM" to minutes from midnight */
function parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Returns merged [startMin, endMin] work windows for a given day-of-week.
 * Adjacent/overlapping shifts are merged into continuous blocks.
 */
function getMergedWindowsForDay(dayOfWeek: number, shifts: WorkShift[]): [number, number][] {
    const active = shifts.filter((s) => s.active && s.days_of_week.includes(dayOfWeek));
    if (active.length === 0) return [];

    const windows = active
        .map((s) => [parseTimeToMinutes(s.start_time), parseTimeToMinutes(s.end_time)] as [number, number])
        .sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [windows[0]];
    for (let i = 1; i < windows.length; i++) {
        const last = merged[merged.length - 1];
        if (windows[i][0] <= last[1]) {
            last[1] = Math.max(last[1], windows[i][1]);
        } else {
            merged.push(windows[i]);
        }
    }
    return merged;
}

/**
 * Returns the end of the work window that `cursor` falls within.
 * Call getNextValidWorkTime(cursor) first to guarantee cursor is in a valid window.
 */
export function getShiftEnd(cursor: Date, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
    const dayOfWeek = getDay(cursor);
    const currentMinutes = getHours(cursor) * 60 + getMinutes(cursor);
    const windows = getMergedWindowsForDay(dayOfWeek, shifts);
    const win = windows.find(([s, e]) => currentMinutes >= s && currentMinutes < e);
    if (!win) return cursor;
    return setTime(cursor, Math.floor(win[1] / 60), win[1] % 60, 0);
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

export type SchedulingStrategy = "CRITICAL_PATH";

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
 * Returns the total machine hours for steps BEFORE the first treatment step.
 * Multiplied by quantity to reflect real scheduling load.
 * Used to sort treatment-group orders so the heaviest job goes first, reducing
 * the chance that the bottleneck order gets pushed to the next day.
 */
function getPreTreatmentHours(o: Order): number {
    const evaluation = o.evaluation as EvaluationStep[] | null;
    if (!evaluation) return 0;
    const quantity = Math.max(1, (o as any).quantity ?? 1);
    let hours = 0;
    for (const step of evaluation) {
        if (isTreatmentStep(step)) break;
        hours += (step as any).hours || 0;
    }
    return hours * quantity;
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
                const treatA = (a as any).treatment || "";
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

/** Helper to set time components on a Date */
function setTime(date: Date, hours: number, minutes: number, seconds: number, ms: number = 0): Date {
    return set(date, { hours, minutes, seconds, milliseconds: ms });
}

/**
 * Moves a date to the next valid working minute according to active shifts.
 * Defaults to Mon-Sat 06:00-22:00 (two merged default shifts).
 */
export function getNextValidWorkTime(date: Date, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
    let current = new Date(date);

    // Safety: max 2 weeks of iterations to avoid infinite loops with invalid configs
    for (let attempt = 0; attempt < 14 * 96; attempt++) {
        const dayOfWeek = getDay(current);
        const currentMinutes = getHours(current) * 60 + getMinutes(current);
        const windows = getMergedWindowsForDay(dayOfWeek, shifts);

        if (windows.length > 0) {
            // Already inside a valid window?
            const inWindow = windows.find(([s, e]) => currentMinutes >= s && currentMinutes < e);
            if (inWindow) return current;

            // Next window later today?
            const nextWindow = windows.find(([s]) => s > currentMinutes);
            if (nextWindow) {
                return setTime(current, Math.floor(nextWindow[0] / 60), nextWindow[0] % 60, 0);
            }
        }

        // No work today (or past all windows) → advance to midnight of next day
        current = startOfDay(addDays(current, 1));
    }
    return current;
}

/**
 * Snaps a date to the next 15-minute interval (ceiling).
 * Used by the scheduling engine so tasks never start in the past.
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
 * Snaps a date to the nearest 15-minute interval (round).
 * Used for drag-and-drop UX so movements feel natural.
 * e.g. 14:04 -> 14:00. 14:08 -> 14:15. 14:52 -> 15:00.
 */
export function snapToNearest15Minutes(date: Date): Date {
    const roundedMinutes = Math.round(getMinutes(date) / 15) * 15;
    return set(new Date(date), { minutes: roundedMinutes, seconds: 0, milliseconds: 0 });
}

const TREATMENT_HOUR_START = 8;
const TREATMENT_HOUR_END = 18;

/**
 * Snap a date to the next valid treatment slot (Mon–Fri, 08:00–18:00).
 * - Weekday, time in [08:00, 18:00) → keep as-is (treatment starts immediately)
 * - Weekday, time < 08:00           → same day at 08:00
 * - Weekday, time >= 18:00          → next weekday at 08:00
 * - Saturday or Sunday              → next Monday at 08:00
 *   (weekend days are never treatment days, so hour context is discarded)
 */
export function snapTreatmentToWeekday(date: Date): Date {
    let result = new Date(date);
    const h = result.getHours() + result.getMinutes() / 60;

    // If outside treatment hours on a weekday → advance to next day at 08:00
    // (the machining end hour is not preserved when a day transition is required)
    if (getDay(result) !== 0 && getDay(result) !== 6 && h >= TREATMENT_HOUR_END) {
        result = addDays(result, 1);
        result = set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    // Skip weekend days → always land at 08:00 (weekend has no treatment context)
    if (getDay(result) === 0 || getDay(result) === 6) {
        while (getDay(result) === 0 || getDay(result) === 6) {
            result = addDays(result, 1);
        }
        return set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    // Weekday within range: clamp to 08:00 if before treatment start
    if (result.getHours() + result.getMinutes() / 60 < TREATMENT_HOUR_START) {
        result = set(result, { hours: TREATMENT_HOUR_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }

    return result;
}

/**
 * Add N working days (Mon–Fri) to a date, skipping Saturday and Sunday.
 * Days=0 returns the same date unchanged.
 */
export function addWorkingDays(date: Date, days: number): Date {
    let result = new Date(date);
    let remaining = Math.ceil(days);
    while (remaining > 0) {
        result = addDays(result, 1);
        const d = getDay(result);
        if (d !== 0 && d !== 6) remaining--;
    }
    return result;
}

/**
 * Compute treatment end: the same H:M as start, N working days later.
 * Each day is a full forward jump: days=2 starting Wed 9:45 → Fri 9:45
 * (Wed→Thu = day 1, Thu→Fri = day 2).
 */
export function treatmentEndDate(start: Date, days: number): Date {
    const lastDay = addWorkingDays(start, days);
    return set(lastDay, { hours: start.getHours(), minutes: start.getMinutes(), seconds: 0, milliseconds: 0 });
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
    shifts: WorkShift[] = DEFAULT_SHIFTS
): SchedulingResult {
    logger.info(`[AutoPlan] Starting with ${orders.length} orders, strategy: ${config.mainStrategy}`);
    const preparedOrders = prepareOrdersForScheduling(orders, config);
    logger.info(`[AutoPlan] Prepared orders: ${preparedOrders.length}`);

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
                const treatmentStart = snapTreatmentToWeekday(new Date(batchEndTime));
                const treatmentEnd = treatmentEndDate(treatmentStart, step.days);
                const register = `${stepNumber}-T`;

                // One treatment record per order (whole batch goes to treatment together)
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

            const totalStepHours = step.hours * quantity;
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
                treatmentGroup.map((t: any) => [t.order_id as string, getActualReadyTime(t)])
            );
            const maxStartMs = Math.max(...Array.from(originalStartByOrder.values()));

            for (const t of treatmentGroup) {
                const alignedStart = snapTreatmentToWeekday(new Date(maxStartMs));
                // Recalculate end using working days from the original step definition
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
                const treatTask = treatmentGroup.find((t: any) => t.order_id === orderId)!;
                const treatStepNum = parseInt((treatTask.register as string).replace("-T", ""));
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
                    if ((t as any).order_id !== orderId) continue;
                    if ((t as any).is_treatment || !(t as any).machine) continue;
                    const reg = parseInt((t as any).register || "0");
                    // Only remove steps between this treatment and the next treatment
                    if (reg > treatStepNum && reg < nextTreatStepNum) toRemoveIds.add((t as any).id);
                }
            }

            // Remove from draftTasks and allKnownTasks
            for (let i = draftTasks.length - 1; i >= 0; i--)
                if (toRemoveIds.has(draftTasks[i].id)) draftTasks.splice(i, 1);
            for (let i = allKnownTasks.length - 1; i >= 0; i--)
                if (toRemoveIds.has((allKnownTasks[i] as any).id)) allKnownTasks.splice(i, 1);

            // Per-machine availability tracker for this batch
            const machineEndTimes = new Map<string, number>();

            for (const orderId of sortedOrders) {
                const treatTask = treatmentGroup.find((t: any) => t.order_id === orderId)!;
                const treatStepNum = parseInt((treatTask.register as string).replace("-T", ""));
                const evaluation = (treatTask.production_orders as any)?.evaluation as any[] | null;
                const quantity = Math.max(1, (treatTask.production_orders as any)?.quantity ?? 1);
                if (!evaluation) continue;

                // Cursor: this order cannot start post-treatment before treatmentEnd
                let orderCursor = treatmentEndMs;

                // Iterate evaluation steps that come after the treatment, stopping at next treatment
                for (let si = treatStepNum; si < evaluation.length; si++) {
                    const step = evaluation[si];
                    if (isTreatmentStep(step)) break; // stop at next treatment step

                    const machine = (step as any).machine as string | undefined;
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
                                (t as any).machine === machine &&
                                (t as any).order_id !== orderId &&
                                (t as any).startMs < proposedEnd.getTime() &&
                                (t as any).endMs > cursor.getTime()
                            ) {
                                if (!collision || (t as any).endMs < (collision as any).endMs) collision = t;
                            }
                        }
                        if (collision) {
                            cursor = snapToNext15Minutes(new Date((collision as any).endMs));
                            continue;
                        }

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
                        .filter((t: any) => t.order_id === orderId && t.register === register)
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
                    if ((dt as any).order_id !== orderId) continue;
                    if (!(dt as any).is_treatment) continue;
                    const dtRegNum = parseInt(((dt as any).register as string).replace("-T", ""));
                    if (dtRegNum <= treatStepNum) continue;
                    if (orderCursor > (dt as any).startMs) {
                        const duration = (dt as any).endMs - (dt as any).startMs;
                        (dt as any).startMs = orderCursor;
                        (dt as any).endMs = orderCursor + duration;
                        (dt as any).planned_date = format(new Date(orderCursor), "yyyy-MM-dd'T'HH:mm:ss");
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

/** Helper to calculate end date respecting active work shifts */
function calculateWorkEnd(start: Date, durationMinutes: number, shifts: WorkShift[] = DEFAULT_SHIFTS): Date {
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
