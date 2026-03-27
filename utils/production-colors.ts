import { Database } from "@/utils/supabase/types";

type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Database["public"]["Tables"]["production_orders"]["Row"] | null;
};

export const PROJECT_COLORS = [
    "#6366f1", // Indigo 500
    "#3b82f6", // Blue 500
    "#0ea5e9", // Sky 500
    "#06b6d4", // Cyan 500
    "#14b8a6", // Teal 500
    "#10b981", // Emerald 500
    "#22c55e", // Green 500
    "#84cc16", // Lime 500
    "#eab308", // Yellow 500
    "#f59e0b", // Amber 500
    "#f97316", // Orange 500
    "#ef4444", // Red 500
    "#f43f5e", // Rose 500
    "#ec4899", // Pink 500
    "#d946ef", // Fuchsia 500
    "#a855f7", // Purple 500
    "#8b5cf6", // Violet 500
    "#4f46e5", // Indigo 600
    "#2563eb", // Blue 600
    "#0284c7", // Sky 600
    "#0891b2", // Cyan 600
    "#0d9488", // Teal 600
    "#059669", // Emerald 600
    "#16a34a", // Green 600
    "#65a30d", // Lime 600
    "#ca8a04", // Yellow 600
    "#d97706", // Amber 600
    "#ea580c", // Orange 600
    "#dc2626", // Red 600
    "#e11d48", // Rose 600
    "#db2777", // Pink 600
    "#9333ea", // Purple 600
];

// SPREAD must be coprime to PROJECT_COLORS.length (31 is prime, so any 1–30 works).
// 7 spreads orders across the full spectrum before cycling back.
const SPREAD = 7;

function fnvHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
}

function extractOrderId(rawId: string): string {
    if (rawId.startsWith("draft-")) {
        const parts = rawId.split("-");
        if (parts.length > 1) return parts[1];
    }
    return rawId;
}

/**
 * Builds a stable order_id → color map from all tasks.
 *
 * Orders in the same project receive visually distinct colors by stepping
 * through the palette with a SPREAD offset. Orders across different projects
 * also start at different positions (derived from the project ID hash), so
 * inter-project collisions are minimised.
 */
export function buildColorMap(tasks: PlanningTask[]): Map<string, string> {
    const N = PROJECT_COLORS.length;
    const orderToProject = new Map<string, string>();

    for (const task of tasks) {
        const rawId = task.order_id || task.production_orders?.id || task.id;
        const orderId = extractOrderId(rawId);
        if (!orderToProject.has(orderId)) {
            const projectId = task.production_orders?.project_id ?? "no-project";
            orderToProject.set(orderId, projectId);
        }
    }

    // Group by project
    const projectToOrders = new Map<string, string[]>();
    for (const [orderId, projectId] of orderToProject) {
        const list = projectToOrders.get(projectId) ?? [];
        list.push(orderId);
        projectToOrders.set(projectId, list);
    }

    const colorMap = new Map<string, string>();
    for (const [projectId, orders] of projectToOrders) {
        orders.sort(); // deterministic ordering within project
        const base = fnvHash(projectId) % N;
        for (let i = 0; i < orders.length; i++) {
            const idx = (base + i * SPREAD) % N;
            colorMap.set(orders[i], PROJECT_COLORS[idx]);
        }
    }

    return colorMap;
}

/**
 * Returns a color for a single task.
 * Pass the colorMap built by buildColorMap() for project-aware, collision-free
 * assignment. Falls back to a simple hash when no map is provided.
 */
export function getProductionTaskColor(task: PlanningTask, colorMap?: Map<string, string>): string {
    const rawId = task.order_id || task.production_orders?.id || task.id;
    const id = extractOrderId(rawId);

    if (colorMap) {
        const mapped = colorMap.get(id);
        if (mapped) return mapped;
    }

    // Fallback: FNV-1a hash (used when no map is available, e.g. single-task views)
    const saltedId = id + "reyper-xyz-v2";
    let hash = 2166136261;
    for (let i = 0; i < saltedId.length; i++) {
        hash ^= saltedId.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}
