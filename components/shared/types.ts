/**
 * Shared types for production-item components.
 * ProductionItemType covers all fields that ProductionItemDetail and
 * ProductionItemSummary access from the item prop — including join-computed
 * fields (treatment_name) and legacy aliases (status, urgency_level).
 */

export interface ProductionItemType {
    id: string;
    part_name?: string | null;
    part_code?: string | null;
    quantity?: number | null;
    material?: string | null;
    general_status?: string | null;
    status?: string | null; // legacy alias for general_status
    urgencia?: boolean | null;
    urgency_level?: string | null; // legacy: "Urgente" string flag
    image?: string | null;
    drawing_url?: string | null;
    model_url?: string | null;
    render_url?: string | null;
    treatment_id?: string | null;
    treatment?: string | null;
    treatment_name?: string | null; // populated by Supabase join: production_treatments(name)
    material_confirmation?: string | null;
}

/** Catalog entry shape returned by getCatalogData() */
export interface CatalogEntry {
    id: string;
    name: string;
}

/** Valid field keys for hiddenFields / readOnlyFields props */
export type ItemFieldKey =
    | "name"
    | "status"
    | "urgency"
    | "quantity"
    | "material"
    | "material_confirmation"
    | "treatment"
    | "drawing_url"
    | "render_url"
    | "assets";
