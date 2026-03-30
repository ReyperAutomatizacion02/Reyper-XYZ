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
    shiftTasksToCurrent,
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
    mainStrategy: "CRITICAL_PATH",
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

    it("sorts by CRITICAL_PATH strategy (treatment first, longest pre-treatment first)", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, mainStrategy: "CRITICAL_PATH" };
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

    it("sorts treatment orders before non-treatment orders", () => {
        const config: StrategyConfig = { ...DEFAULT_CONFIG, mainStrategy: "CRITICAL_PATH" };
        const noTreat = makeOrder({ treatment: null });
        const withTreat = makeOrder({ treatment: "Anodizado" });
        const result = prepareOrdersForScheduling([noTreat, withTreat], config);
        expect(result[0].treatment).toBe("Anodizado");
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

    it("consolida piezas en un lote: 3pzs×2steps → 1 batch por máquina (no 6 tasks)", () => {
        const order = makeOrder({
            quantity: 3,
            evaluation: [
                { machine: "CNC-1", hours: 2 },
                { machine: "CNC-2", hours: 1 },
            ] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1", "CNC-2"], DEFAULT_CONFIG);

        // Consolidated: 3×2h=6h on CNC-1, 3×1h=3h on CNC-2 → 1 segment each (fits in shift)
        // May split into 2 segments if crosses shift boundary, but never 3+ for <16h batches
        const cnc1Tasks = result.tasks.filter((t) => t.machine === "CNC-1");
        const cnc2Tasks = result.tasks.filter((t) => t.machine === "CNC-2");
        expect(cnc1Tasks.length).toBeGreaterThanOrEqual(1);
        expect(cnc2Tasks.length).toBeGreaterThanOrEqual(1);

        // Total machine hours must match quantity × step hours
        const cnc1Hours = cnc1Tasks.reduce(
            (sum, t) => sum + (new Date(t.planned_end!).getTime() - new Date(t.planned_date!).getTime()) / 3600000,
            0
        );
        const cnc2Hours = cnc2Tasks.reduce(
            (sum, t) => sum + (new Date(t.planned_end!).getTime() - new Date(t.planned_date!).getTime()) / 3600000,
            0
        );
        expect(cnc1Hours).toBeCloseTo(6, 1); // 3 pzs × 2h
        expect(cnc2Hours).toBeCloseTo(3, 1); // 3 pzs × 1h

        // All CNC-1 segments must finish before any CNC-2 segment starts (batch ordering)
        const lastCnc1End = Math.max(...cnc1Tasks.map((t) => new Date(t.planned_end!).getTime()));
        const firstCnc2Start = Math.min(...cnc2Tasks.map((t) => new Date(t.planned_date!).getTime()));
        expect(firstCnc2Start).toBeGreaterThanOrEqual(lastCnc1End);
    });

    it("usa el número de paso como register para lotes (sin sufijo de pieza)", () => {
        const order = makeOrder({
            quantity: 2,
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        // All segments of the consolidated batch share the same step register "1"
        const registers = result.tasks.map((t) => t.register);
        registers.forEach((r) => expect(r).toBe("1"));
        expect(registers).not.toContain("1-1");
        expect(registers).not.toContain("1-2");
    });

    it("usa register '1' también para órdenes de 1 pieza", () => {
        const order = makeOrder({
            quantity: 1,
            evaluation: [{ machine: "CNC-1", hours: 1 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        expect(result.tasks[0].register).toBe("1");
    });

    it("los segmentos del lote no se solapan entre sí (splits de turno son secuenciales)", () => {
        const order = makeOrder({
            quantity: 3,
            evaluation: [{ machine: "CNC-1", hours: 2 }] as unknown as import("@/utils/supabase/types").Json,
        });
        const result = generateAutomatedPlanning([order], [], ["CNC-1"], DEFAULT_CONFIG);

        const tasks = result.tasks.sort(
            (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
        );

        // Each segment must start at or after the previous one ends
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

// ── shiftTasksToCurrent ──

describe("shiftTasksToCurrent", () => {
    it("machine tasks after treatment stay within work hours (regression: no overnight bars)", () => {
        // Scenario that triggered the bug:
        // Machine step 1 ends at 10am Thu.
        // Treatment is 1 day (10am Thu → 10am Fri in calendar time).
        // Machine step 2 has two segments originally at 10am–22:00 Fri and 6am–8am Sat.
        // shiftTasksToCurrent must NOT merge them into one overnight-spanning task.
        const orderId = "order-regression";
        const machineTask1: Partial<PlanningTask> = {
            id: "t1",
            order_id: orderId,
            machine: "CNC-1",
            planned_date: "2026-03-19T06:00:00", // Thursday 6am
            planned_end: "2026-03-19T10:00:00", // Thursday 10am
        };
        const treatmentTask: any = {
            id: "t2",
            order_id: orderId,
            machine: null,
            is_treatment: true,
            planned_date: "2026-03-19T10:00:00", // treatment starts Thu 10am
            planned_end: "2026-03-20T10:00:00", // treatment ends Fri 10am (1 calendar day)
        };
        // Two machine segments after treatment
        const machineTask2a: Partial<PlanningTask> = {
            id: "t3",
            order_id: orderId,
            machine: "CNC-1",
            planned_date: "2026-03-20T10:00:00", // Fri 10am
            planned_end: "2026-03-20T22:00:00", // Fri 10pm (12h segment)
        };
        const machineTask2b: Partial<PlanningTask> = {
            id: "t4",
            order_id: orderId,
            machine: "CNC-1",
            planned_date: "2026-03-21T06:00:00", // Sat 6am
            planned_end: "2026-03-21T10:00:00", // Sat 10am (4h segment)
        };

        const targetTime = new Date("2026-03-19T06:00:00"); // Same as earliest task
        const result = shiftTasksToCurrent(
            [machineTask1, treatmentTask, machineTask2a, machineTask2b],
            targetTime,
            [],
            ["CNC-1"]
        );

        // All non-treatment tasks must start and end within work hours (6:00–22:00)
        const machineTasks = result.filter((t) => !(t as any).is_treatment);
        for (const task of machineTasks) {
            const start = new Date(task.planned_date!);
            const end = new Date(task.planned_end!);
            expect(getHours(start)).toBeGreaterThanOrEqual(6);
            expect(getHours(start)).toBeLessThan(22);
            // End can be exactly 22:00 but never past midnight
            expect(getHours(end)).toBeLessThanOrEqual(22);
            expect(getDay(start)).not.toBe(0); // Not Sunday
        }
    });

    it("treatment task preserves calendar duration (not work-hours duration)", () => {
        const orderId = "order-treatment-duration";
        const treatmentTask: any = {
            id: "treat1",
            order_id: orderId,
            machine: null,
            is_treatment: true,
            planned_date: "2026-03-19T10:00:00", // Thu 10am
            planned_end: "2026-03-21T10:00:00", // Sat 10am = exactly 2 calendar days
        };

        const targetTime = new Date("2026-03-19T10:00:00");
        const result = shiftTasksToCurrent([treatmentTask], targetTime, [], []);

        const shifted = result[0];
        const start = new Date(shifted.planned_date!);
        const end = new Date(shifted.planned_end!);
        const calendarDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        // Must be 2 calendar days, NOT inflated to ~3 work-days
        expect(calendarDays).toBeCloseTo(2, 1);
    });
});
