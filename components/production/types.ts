import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];

/**
 * PlanningTask enriched with all runtime fields that Supabase returns
 * but that are not reflected in the base generated type.
 *
 * - `is_treatment`    — true when the task row represents a treatment slot, not a machine slot
 * - `treatment_type`  — name of the treatment (e.g. "Nitrurado"), set by scheduling-utils
 * - `register`        — shared key linking consecutive tasks of the same part/process
 * - `isDraft`         — client-only flag: task exists only in optimistic state, not yet saved
 * - `startMs/endMs`   — pre-computed millisecond timestamps used by scheduling utils
 * - `cascadeIds`      — client-only: sibling task IDs that move together in cascade mode
 */
export type GanttPlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    is_treatment?: boolean | null;
    treatment_type?: string | null;
    register?: string | null;
    isDraft?: boolean;
    startMs?: number;
    endMs?: number;
    cascadeIds?: string[];
};

/**
 * Data shape passed to TaskModal via setModalData.
 * Matches TaskModalProps["initialData"] (non-null) from task-modal.tsx.
 */
export type GanttModalData = {
    id?: string;
    machine: string;
    time?: number;
    start?: string;
    end?: string;
    operator?: string;
    orderId?: string;
    partCode?: string;
    activeOrder?: Order | null;
    isDemo?: boolean;
};
