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
    '#22c55e', // Green 500
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
    '#4f46e5', // Indigo 600
    '#2563eb', // Blue 600
    '#0284c7', // Sky 600
    '#0891b2', // Cyan 600
    '#0d9488', // Teal 600
    '#059669', // Emerald 600
    '#16a34a', // Green 600
    '#65a30d', // Lime 600
    '#ca8a04', // Yellow 600
    '#d97706', // Amber 600
    '#ea580c', // Orange 600
    '#dc2626', // Red 600
    '#e11d48', // Rose 600
    '#db2777', // Pink 600
    '#9333ea', // Purple 600
];

/**
 * Consistently returns a color for a task based on its production order ID.
 */
export function getProductionTaskColor(task: PlanningTask): string {
    // Priority: real order id > production_orders id > raw task id
    let id = task.order_id || task.production_orders?.id || task.id;

    // If it's a draft ID like "draft-order-uuid...", extract the core ID to keep colors consistent
    if (id.startsWith('draft-')) {
        const parts = id.split('-');
        if (parts.length > 1) {
            // Usually draft-{order_id}-{machine}...
            id = parts[1];
        }
    }

    // Improved 32-bit FNV-1a hash with salt for better distribution
    let hash = 2166136261;
    const SALT = "reyper-xyz-v2";
    const saltedId = id + SALT;

    for (let i = 0; i < saltedId.length; i++) {
        hash ^= saltedId.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }

    const index = hash % PROJECT_COLORS.length;
    return PROJECT_COLORS[index];
}
