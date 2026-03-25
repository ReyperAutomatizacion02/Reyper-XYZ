import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { format, addDays, addHours, subDays, getHours, getDay, differenceInMinutes } from "date-fns";
import {
    getPriorityLevel,
    getStatusPriority,
    compareOrdersByPriority,
    prepareOrdersForScheduling,
    getNextValidWorkTime,
    snapToNext15Minutes,
    generateAutomatedPlanning,
    shiftScenarioTasks,
    isTreatmentStep,
    type Order,
    type PlanningTask,
    type StrategyConfig,
    type EvaluationStep,
} from "../scheduling-utils";

// ── Helpers ──

function makeOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        part_code: "P-001",
        general_status: "A8-MATERIAL DISPONIBLE",
        evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
        urgencia: false,
        created_at: "2026-03-01T06:00:00",
        description: null,
        design_no: null,
        drawing_url: null,
        image: null,
        is_sub_item: null,
        last_edited_at: null,
        material: null,
        material_confirmation: null,
        material_id: null,
        model_url: null,
        notion_id: null,
        part_name: null,
        project_id: null,
        quantity: 1,
        render_url: null,
        status_id: null,
        treatment: null,
        treatment_id: null,
        unit: null,
        ...overrides,
    } as Order;
}

function makeTask(overrides: Partial<PlanningTask> = {}): PlanningTask {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        order_id: null,
        machine: null,
        planned_date: null,
        planned_end: null,
        check_in: null,
        check_out: null,
        created_at: null,
        last_edited_at: null,
        locked: false,
        notion_id: null,
        operator: null,
        register: null,
        ...overrides,
    } as PlanningTask;
}

const DEFAULT_CONFIG: StrategyConfig = {
    mainStrategy: "DELIVERY_DATE",
    onlyWithCAD: false,
    onlyWithBlueprint: false,
    onlyWithMaterial: false,
    requireTreatment: false,
};

// ── getPriorityLevel ──

describe("getPriorityLevel", () => {
    it("returns NORMAL for null delivery date", () => {
        expect(getPriorityLevel(null)).toBe("NORMAL");
    });

    it("returns CRITICAL for overdue dates", () => {
        const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
        expect(getPriorityLevel(yesterday)).toBe("CRITICAL");
    });

    it("returns SOON for dates within 3 days", () => {
        const in2Days = format(addDays(new Date(), 2), "yyyy-MM-dd");
        expect(getPriorityLevel(in2Days)).toBe("SOON");
    });

    it("returns SOON for today (0 days diff)", () => {
        const today = format(new Date(), "yyyy-MM-dd");
        expect(getPriorityLevel(today)).toBe("SOON");
    });

    it("returns NORMAL for 4-10 day range", () => {
        const in7Days = format(addDays(new Date(), 7), "yyyy-MM-dd");
        expect(getPriorityLevel(in7Days)).toBe("NORMAL");
    });

    it("returns PLENTY for dates more than 10 days out", () => {
        const in15Days = format(addDays(new Date(), 15), "yyyy-MM-dd");
        expect(getPriorityLevel(in15Days)).toBe("PLENTY");
    });

    it("returns NORMAL for exactly 10 days", () => {
        const in10Days = format(addDays(new Date(), 10), "yyyy-MM-dd");
        expect(getPriorityLevel(in10Days)).toBe("NORMAL");
    });

    it("returns SOON for exactly 3 days", () => {
        const in3Days = format(addDays(new Date(), 3), "yyyy-MM-dd");
        expect(getPriorityLevel(in3Days)).toBe("SOON");
    });
});

// ── getStatusPriority ──

describe("getStatusPriority", () => {
    it("returns 2 for A8-MATERIAL DISPONIBLE", () => {
        expect(getStatusPriority("A8-MATERIAL DISPONIBLE")).toBe(2);
    });

    it("returns 3 for A7-ESPERANDO MATERIAL", () => {
        expect(getStatusPriority("A7-ESPERANDO MATERIAL")).toBe(3);
    });

    it("returns 4 for A5-VERIFICAR MATERIAL", () => {
        expect(getStatusPriority("A5-VERIFICAR MATERIAL")).toBe(4);
    });

    it("returns 5 for A0-ESPERANDO MATERIAL", () => {
        expect(getStatusPriority("A0-ESPERANDO MATERIAL")).toBe(5);
    });

    it("returns 5 for A0-NUEVO PROYECTO", () => {
        expect(getStatusPriority("A0-NUEVO PROYECTO")).toBe(5);
    });

    it("returns 99 for unknown statuses", () => {
        expect(getStatusPriority("RANDOM")).toBe(99);
        expect(getStatusPriority("")).toBe(99);
    });
});

// ── compareOrdersByPriority ──

describe("compareOrdersByPriority", () => {
    it("prioritizes urgent orders first", () => {
        const urgent = makeOrder({ urgencia: true });
        const normal = makeOrder({ urgencia: false });
        expect(compareOrdersByPriority(urgent, normal)).toBeLessThan(0);
    });

    it("sorts by status priority when urgency is equal", () => {
        const highPrio = makeOrder({ general_status: "A8-MATERIAL DISPONIBLE" });
        const lowPrio = makeOrder({ general_status: "A0-NUEVO PROYECTO" });
        expect(compareOrdersByPriority(highPrio, lowPrio)).toBeLessThan(0);
    });

    it("sorts by delivery date when status is equal", () => {
        const earlier = makeOrder({
            general_status: "A8-MATERIAL DISPONIBLE",
            projects: { delivery_date: "2026-03-10", start_date: null, drive_folder_id: null, company: null },
        } as Partial<Order>);
        const later = makeOrder({
            general_status: "A8-MATERIAL DISPONIBLE",
            projects: { delivery_date: "2026-03-20", start_date: null, drive_folder_id: null, company: null },
        } as Partial<Order>);
        expect(compareOrdersByPriority(earlier, later)).toBeLessThan(0);
    });

    it("returns 0 for identical priority orders without delivery dates", () => {
        const a = makeOrder({ general_status: "A8-MATERIAL DISPONIBLE" });
        const b = makeOrder({ general_status: "A8-MATERIAL DISPONIBLE" });
        expect(compareOrdersByPriority(a, b)).toBe(0);
    });
});

// ── getNextValidWorkTime ──

describe("getNextValidWorkTime", () => {
    it("returns same time if within work hours (Mon-Sat 6-22)", () => {
        const wed10 = new Date("2026-03-18T10:00:00");
        const result = getNextValidWorkTime(wed10);
        expect(format(result, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-03-18T10:00:00");
    });

    it("moves to 6 AM same day if before 6 AM on a weekday", () => {
        const earlyMon = new Date("2026-03-16T04:30:00"); // Monday 4:30 AM
        const result = getNextValidWorkTime(earlyMon);
        expect(getHours(result)).toBe(6);
        expect(format(result, "yyyy-MM-dd")).toBe("2026-03-16");
    });

    it("moves to next day 6 AM if after 22:00", () => {
        const lateTue = new Date("2026-03-17T23:00:00"); // Tuesday 11 PM
        const result = getNextValidWorkTime(lateTue);
        expect(format(result, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-03-18T06:00:00");
    });

    it("skips Sunday to Monday 6 AM", () => {
        const sunday = new Date("2026-03-22T10:00:00"); // Sunday
        expect(getDay(sunday)).toBe(0);
        const result = getNextValidWorkTime(sunday);
        expect(getDay(result)).toBe(1); // Monday
        expect(getHours(result)).toBe(6);
    });

    it("handles Saturday at 21:59 (still valid)", () => {
        const satEvening = new Date("2026-03-21T21:59:00"); // Saturday
        expect(getDay(satEvening)).toBe(6);
        const result = getNextValidWorkTime(satEvening);
        expect(format(result, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-03-21T21:59:00");
    });

    it("handles Saturday at 22:00 -> Monday 6 AM (skips Sunday)", () => {
        const sat22 = new Date("2026-03-21T22:00:00"); // Saturday 10 PM
        const result = getNextValidWorkTime(sat22);
        expect(getDay(result)).toBe(1); // Monday
        expect(getHours(result)).toBe(6);
    });

    it("moves from exact 6 AM to 6 AM (stays)", () => {
        const exact6 = new Date("2026-03-18T06:00:00"); // Wednesday
        const result = getNextValidWorkTime(exact6);
        expect(format(result, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-03-18T06:00:00");
    });
});

// ── snapToNext15Minutes ──

describe("snapToNext15Minutes", () => {
    it("snaps 14:04 to 14:15", () => {
        const date = new Date("2026-03-18T14:04:00");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm")).toBe("14:15");
    });

    it("keeps exact 15-minute mark (14:15:00.000)", () => {
        const date = new Date("2026-03-18T14:15:00.000");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm:ss")).toBe("14:15:00");
    });

    it("snaps 14:00 stays at 14:00 (exact mark)", () => {
        const date = new Date("2026-03-18T14:00:00.000");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm")).toBe("14:00");
    });

    it("snaps 14:31 to 14:45", () => {
        const date = new Date("2026-03-18T14:31:00");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm")).toBe("14:45");
    });

    it("snaps 14:46 to 15:00", () => {
        const date = new Date("2026-03-18T14:46:00");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm")).toBe("15:00");
    });

    it("snaps up if seconds > 0 even at 15-min mark", () => {
        const date = new Date("2026-03-18T14:15:01");
        const result = snapToNext15Minutes(date);
        expect(format(result, "HH:mm")).toBe("14:30");
    });
});

// ── prepareOrdersForScheduling ──

describe("prepareOrdersForScheduling", () => {
    it("filters out orders without evaluation", () => {
        const orders = [
            makeOrder({ evaluation: null }),
            makeOrder({ evaluation: [] as unknown as import("@/utils/supabase/types").Json }),
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = prepareOrdersForScheduling(orders, DEFAULT_CONFIG);
        expect(result).toHaveLength(1);
    });

    it("filters by CAD requirement (model_url)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, onlyWithCAD: true };
        const withCad = makeOrder({ model_url: "https://example.com/model" });
        const withoutCad = makeOrder({ model_url: null });
        const result = prepareOrdersForScheduling([withCad, withoutCad], config);
        expect(result).toHaveLength(1);
        expect(result[0].model_url).toBe("https://example.com/model");
    });

    it("filters by blueprint requirement (drawing_url)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, onlyWithBlueprint: true };
        const withBlueprint = makeOrder({ drawing_url: "https://example.com/drawing" });
        const withoutBlueprint = makeOrder({ drawing_url: null });
        const result = prepareOrdersForScheduling([withBlueprint, withoutBlueprint], config);
        expect(result).toHaveLength(1);
    });

    it("filters by material availability", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, onlyWithMaterial: true };
        const available = makeOrder({ general_status: "A8-MATERIAL DISPONIBLE" });
        const waiting = makeOrder({ general_status: "A7-ESPERANDO MATERIAL" });
        const result = prepareOrdersForScheduling([available, waiting], config);
        expect(result).toHaveLength(1);
        expect(result[0].general_status).toBe("A8-MATERIAL DISPONIBLE");
    });

    it("filters by treatment requirement", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, requireTreatment: true };
        const withTreat = makeOrder({ treatment: "Anodizado" });
        const withNA = makeOrder({ treatment: "N/A" });
        const withEmpty = makeOrder({ treatment: "" });
        const withNull = makeOrder({ treatment: null });
        const result = prepareOrdersForScheduling([withTreat, withNA, withEmpty, withNull], config);
        expect(result).toHaveLength(1);
        expect(result[0].treatment).toBe("Anodizado");
    });

    it("sorts by FAB_TIME strategy (longest first)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, mainStrategy: "FAB_TIME" };
        const short = makeOrder({
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const long = makeOrder({
            evaluation: [{ machine: "CNC-1", hours: 10 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = prepareOrdersForScheduling([short, long], config);
        const getHours = (o: Order) =>
            (o.evaluation as EvaluationStep[])?.reduce((s, e) => s + (isTreatmentStep(e) ? 0 : e.hours), 0) ?? 0;
        expect(getHours(result[0])).toBeGreaterThan(getHours(result[1]));
    });

    it("sorts by FAST_TRACK strategy (shortest first)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, mainStrategy: "FAST_TRACK" };
        const short = makeOrder({
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const long = makeOrder({
            evaluation: [{ machine: "CNC-1", hours: 10 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = prepareOrdersForScheduling([short, long], config);
        const getHours = (o: Order) =>
            (o.evaluation as EvaluationStep[])?.reduce((s, e) => s + (isTreatmentStep(e) ? 0 : e.hours), 0) ?? 0;
        expect(getHours(result[0])).toBeLessThan(getHours(result[1]));
    });

    it("sorts by PROJECT_GROUP strategy (groups by project_id)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, mainStrategy: "PROJECT_GROUP" };
        const projA1 = makeOrder({ project_id: "aaa" });
        const projB1 = makeOrder({ project_id: "bbb" });
        const projA2 = makeOrder({ project_id: "aaa" });
        const result = prepareOrdersForScheduling([projB1, projA1, projA2], config);
        expect(result[0].project_id).toBe("aaa");
        expect(result[1].project_id).toBe("aaa");
        expect(result[2].project_id).toBe("bbb");
    });
});

// ── generateAutomatedPlanning ──

describe("generateAutomatedPlanning", () => {
    it("generates tasks for orders with evaluation steps", () => {
        const orders = [
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1"], DEFAULT_CONFIG);

        expect(result.tasks.length).toBeGreaterThanOrEqual(1);
        expect(result.skipped).toHaveLength(0);
        expect(result.metrics.totalOrders).toBe(1);
        expect(result.metrics.totalHours).toBeCloseTo(2, 0);
    });

    it("skips orders with unknown machines", () => {
        const orders = [
            makeOrder({
                evaluation: [
                    { machine: "UNKNOWN-MACHINE", hours: 2 },
                ] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1"], DEFAULT_CONFIG);

        expect(result.tasks).toHaveLength(0);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].reason).toContain("UNKNOWN-MACHINE");
    });

    it("skips orders without evaluation", () => {
        const orders = [makeOrder({ evaluation: null })];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1"], DEFAULT_CONFIG);

        expect(result.tasks).toHaveLength(0);
        expect(result.metrics.totalOrders).toBe(0);
    });

    it("generates tasks within work hours (6:00-22:00)", () => {
        const orders = [
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 4 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1"], DEFAULT_CONFIG);

        for (const task of result.tasks) {
            const start = new Date(task.planned_date!);
            const end = new Date(task.planned_end!);
            expect(getHours(start)).toBeGreaterThanOrEqual(6);
            expect(getHours(end)).toBeLessThanOrEqual(22);
            expect(getDay(start)).not.toBe(0); // Not Sunday
        }
    });

    it("splits tasks across shifts when exceeding daily capacity", () => {
        const orders = [
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 20 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1"], DEFAULT_CONFIG);

        // 20 hours cannot fit in a single shift (16h max: 6-22)
        // So it should be split across at least 2 segments
        expect(result.tasks.length).toBeGreaterThanOrEqual(2);
    });

    it("avoids collisions with locked existing tasks", () => {
        const existingTask = makeTask({
            machine: "CNC-1",
            planned_date: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss"),
            planned_end: format(addHours(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss"),
            locked: true,
        });

        const orders = [
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];

        const result = generateAutomatedPlanning(orders, [existingTask], ["CNC-1"], DEFAULT_CONFIG);

        // New tasks should not overlap with the locked task
        for (const task of result.tasks) {
            const newStart = new Date(task.planned_date!).getTime();
            const newEnd = new Date(task.planned_end!).getTime();
            const existStart = new Date(existingTask.planned_date!).getTime();
            const existEnd = new Date(existingTask.planned_end!).getTime();

            const overlaps = newStart < existEnd && newEnd > existStart;
            expect(overlaps).toBe(false);
        }
    });

    it("handles multi-step evaluations (multiple machines per order)", () => {
        const orders = [
            makeOrder({
                evaluation: [
                    { machine: "CNC-1", hours: 2 },
                    { machine: "CNC-2", hours: 3 },
                ] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1", "CNC-2"], DEFAULT_CONFIG);

        expect(result.tasks.length).toBeGreaterThanOrEqual(2);

        // Second step should start after the first
        const step1End = new Date(result.tasks[0].planned_end!).getTime();
        const step2Start = new Date(result.tasks[result.tasks.length - 1].planned_date!).getTime();
        expect(step2Start).toBeGreaterThanOrEqual(step1End);
    });

    it("creates a treatment task for treatment steps (no machine blocked)", () => {
        const order = makeOrder({
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { type: "treatment", treatment: "Templado", days: 3 },
                { machine: "CNC-1", hours: 1 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        // Should have: 1 CNC task + 1 treatment task + 1 CNC task = 3
        expect(result.tasks.length).toBeGreaterThanOrEqual(3);

        const treatmentTasks = result.tasks.filter((t) => (t as any).is_treatment);
        const machineTasks = result.tasks.filter((t) => !(t as any).is_treatment);
        expect(treatmentTasks).toHaveLength(1);
        expect(machineTasks.length).toBeGreaterThanOrEqual(2);
    });

    it("does not block machines during treatment steps (other orders can schedule during treatment)", () => {
        const orderA = makeOrder({
            id: "order-a",
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { type: "treatment", treatment: "Templado", days: 3 },
                { machine: "CNC-1", hours: 1 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const orderB = makeOrder({
            id: "order-b",
            evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
        });

        const result = generateAutomatedPlanning([orderA, orderB], [], ["CNC-1"], DEFAULT_CONFIG);

        const orderATasks = result.tasks.filter((t) => t.order_id === "order-a" && !(t as any).is_treatment);
        const orderBTasks = result.tasks.filter((t) => t.order_id === "order-b");
        const orderATreatment = result.tasks.find((t) => t.order_id === "order-a" && (t as any).is_treatment);

        expect(orderATreatment).toBeDefined();

        // Order B should schedule during (or just after) the treatment window of Order A,
        // meaning it can start before Order A's last CNC task
        const orderBStart = Math.min(...orderBTasks.map((t) => new Date(t.planned_date!).getTime()));
        const orderALastCncStart = Math.max(...orderATasks.map((t) => new Date(t.planned_date!).getTime()));
        // B starts before A's last CNC step (B fills the treatment gap)
        expect(orderBStart).toBeLessThan(orderALastCncStart);
    });

    it("treatment step register uses step number with -T suffix", () => {
        const order = makeOrder({
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { type: "treatment", treatment: "Anodizado", days: 2 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);
        const treatmentTask = result.tasks.find((t) => (t as any).is_treatment);
        expect(treatmentTask?.register).toBe("2-T");
    });

    it("totalHours metric excludes treatment duration", () => {
        const order = makeOrder({
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { type: "treatment", treatment: "Templado", days: 3 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);
        // totalHours should only count the 2h CNC step, not the 3-day treatment
        expect(result.metrics.totalHours).toBeCloseTo(2, 0);
    });

    it("generates quantity×steps tasks for multi-piece orders (batch mode)", () => {
        const order = makeOrder({
            quantity: 3,
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { machine: "CNC-2", hours: 1 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1", "CNC-2"], DEFAULT_CONFIG);

        // 3 pieces × 2 steps = 6 tasks minimum (splits may add more)
        expect(result.tasks.length).toBeGreaterThanOrEqual(6);

        const cnc1Tasks = result.tasks.filter((t) => t.machine === "CNC-1");
        const cnc2Tasks = result.tasks.filter((t) => t.machine === "CNC-2");
        // Each machine gets at least 3 tasks (1 per piece); splits across shifts may add more
        expect(cnc1Tasks.length).toBeGreaterThanOrEqual(3);
        expect(cnc2Tasks.length).toBeGreaterThanOrEqual(3);

        // All CNC-1 tasks must finish before any CNC-2 task starts (batch ordering)
        const lastCnc1End = Math.max(...cnc1Tasks.map((t) => new Date(t.planned_end!).getTime()));
        const firstCnc2Start = Math.min(...cnc2Tasks.map((t) => new Date(t.planned_date!).getTime()));
        expect(firstCnc2Start).toBeGreaterThanOrEqual(lastCnc1End);
    });

    it("uses 'step-piece' register format for multi-piece orders", () => {
        const order = makeOrder({
            quantity: 2,
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        const registers = result.tasks.map((t) => t.register);
        expect(registers).toContain("1-1");
        expect(registers).toContain("1-2");
    });

    it("uses plain register format for single-piece orders (qty=1, backward compat)", () => {
        const order = makeOrder({
            quantity: 1,
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        expect(result.tasks[0].register).toBe("1");
    });

    it("schedules pieces sequentially on the same machine (no overlaps within a step)", () => {
        const order = makeOrder({
            quantity: 3,
            evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        const tasks = result.tasks.sort(
            (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
        );

        // Each task must start at or after the previous one ends
        for (let k = 1; k < tasks.length; k++) {
            const prevEnd = new Date(tasks[k - 1].planned_end!).getTime();
            const currStart = new Date(tasks[k].planned_date!).getTime();
            expect(currStart).toBeGreaterThanOrEqual(prevEnd);
        }
    });

    it("calculates machine utilization metrics", () => {
        const orders = [
            makeOrder({
                evaluation: [{ machine: "CNC-1", hours: 3 }] as unknown as import("@/utils/supabase/types").Json,
            }),
        ];
        const result = generateAutomatedPlanning(orders, [], ["CNC-1", "CNC-2"], DEFAULT_CONFIG);

        expect(result.metrics.machineUtilization["CNC-1"]).toBeCloseTo(3, 0);
        expect(result.metrics.machineUtilization["CNC-2"]).toBe(0);
    });
});

// ── shiftScenarioTasks ──

describe("shiftScenarioTasks", () => {
    it("returns unchanged tasks when offsetDays is 0", () => {
        const tasks = [
            {
                planned_date: "2026-03-18T08:00:00",
                planned_end: "2026-03-18T10:00:00",
                machine: "CNC-1",
            } as Partial<PlanningTask>,
        ];
        const result = shiftScenarioTasks(tasks, 0, [], ["CNC-1"]);
        expect(result).toBe(tasks); // Same reference
    });

    it("returns unchanged tasks when array is empty", () => {
        const result = shiftScenarioTasks([], 3, [], ["CNC-1"]);
        expect(result).toEqual([]);
    });

    it("shifts tasks forward by work days", () => {
        const tasks = [
            {
                planned_date: "2026-03-18T08:00:00", // Wednesday
                planned_end: "2026-03-18T10:00:00",
                machine: "CNC-1",
            } as Partial<PlanningTask>,
        ];
        const result = shiftScenarioTasks(tasks, 2, [], ["CNC-1"]);

        const newStart = new Date(result[0].planned_date!);
        // Wednesday + 2 work days = Friday
        expect(getDay(newStart)).toBe(5); // Friday
    });

    it("skips Sundays when shifting forward", () => {
        const tasks = [
            {
                planned_date: "2026-03-21T08:00:00", // Saturday
                planned_end: "2026-03-21T10:00:00",
                machine: "CNC-1",
            } as Partial<PlanningTask>,
        ];
        const result = shiftScenarioTasks(tasks, 1, [], ["CNC-1"]);

        const newStart = new Date(result[0].planned_date!);
        // Saturday + 1 work day should skip Sunday → Monday
        expect(getDay(newStart)).toBe(1); // Monday
    });

    it("maintains task duration after shift", () => {
        const tasks = [
            {
                planned_date: "2026-03-18T08:00:00",
                planned_end: "2026-03-18T10:00:00", // 2 hours
                machine: "CNC-1",
            } as Partial<PlanningTask>,
        ];
        const result = shiftScenarioTasks(tasks, 1, [], ["CNC-1"]);

        const start = new Date(result[0].planned_date!);
        const end = new Date(result[0].planned_end!);
        const durationMinutes = differenceInMinutes(end, start);
        expect(durationMinutes).toBe(120); // 2 hours
    });
});
