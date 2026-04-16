import { Database } from "@/utils/supabase/types";

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

export type MachineStep = {
    type?: "machine";
    machine: string;
    /** Total computed hours — used by the scheduler. */
    hours: number;
    /** Set-up inicial (once per batch). Undefined on legacy records. */
    setup_time?: number;
    /** Machining time per piece. Undefined on legacy records. */
    machining_time?: number;
    /** Set-up per piece change (applies to pieces 2…n). Undefined on legacy records. */
    piece_change_time?: number;
};

export type EvaluationStep = MachineStep | { type: "treatment"; treatment_id: string; treatment: string; days: number };

/** Returns true if the step is a treatment (external supplier) step.
 *  Detects all formats:
 *  - new:    { type: "treatment", treatment_id: "...", treatment: "...", days: N }
 *  - legacy: { type: "treatment", treatment: "...", days: N }   (no treatment_id)
 *  - oldest: { treatment: "...", days: N }                      (no type, no treatment_id) */
export function isTreatmentStep(
    s: EvaluationStep
): s is { type: "treatment"; treatment_id: string; treatment: string; days: number } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (s as any).type === "treatment" || !!(s as any).treatment_id || ("treatment" in s && !("machine" in s));
}

/** Returns true if the step is a machine (maquinado) step.
 *  Inverse of isTreatmentStep — narrows EvaluationStep to MachineStep. */
export function isMachineStep(s: EvaluationStep): s is MachineStep {
    return !isTreatmentStep(s);
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
