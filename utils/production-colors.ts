import { Database } from "@/utils/supabase/types";

type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Database["public"]["Tables"]["production_orders"]["Row"] | null;
};

export const PROJECT_COLORS = [
    '#6366f1', // Indigo 500
    '#3b82f6', // Blue 500
    '#0ea5e9', // Sky 500
    '#06b6d4', // Cyan 500
    '#14b8a6', // Teal 500
    '#10b981', // Emerald 500
    '#84cc16', // Lime 500
    '#eab308', // Yellow 500
    '#f59e0b', // Amber 500
    '#f97316', // Orange 500
    '#ef4444', // Red 500
    '#f43f5e', // Rose 500
    '#ec4899', // Pink 500
    '#d946ef', // Fuchsia 500
    '#a855f7', // Purple 500
    '#8b5cf6', // Violet 500
];

/**
 * Consistently returns a color for a task based on its production order ID.
 */
export function getProductionTaskColor(task: PlanningTask): string {
    const id = task.order_id || task.production_orders?.id || task.id;

    // Simple hash to index the colors
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % PROJECT_COLORS.length;
    return PROJECT_COLORS[index];
}
