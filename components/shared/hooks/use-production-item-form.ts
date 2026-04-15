"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    updateProductionOrder,
    getCatalogData,
    createMaterialEntry,
    createTreatmentEntry,
} from "@/app/dashboard/ventas/actions";
import { getErrorMessage } from "@/lib/action-result";
import { ProductionItemType, CatalogEntry } from "@/components/shared/types";

export interface ItemFormFields {
    name: string;
    quantity: number;
    material: string;
    status: string;
    urgency: boolean;
    image: string;
    drawingUrl: string;
    modelUrl: string;
    renderUrl: string;
    treatmentId: string;
    materialConfirmation: string;
}

function fieldsFromItem(item: ProductionItemType): ItemFormFields {
    return {
        name: item.part_name ?? "",
        quantity: item.quantity ?? 1,
        material: item.material ?? "",
        status: item.general_status ?? item.status ?? "",
        urgency: item.urgencia ?? item.urgency_level === "Urgente",
        image: item.image ?? "",
        drawingUrl: item.drawing_url ?? "",
        modelUrl: item.model_url ?? "",
        renderUrl: item.render_url ?? "",
        treatmentId: item.treatment_id ?? "none",
        materialConfirmation: item.material_confirmation ?? "",
    };
}

interface UseProductionItemFormOptions {
    item: ProductionItemType;
    setIsEditing: (val: boolean) => void;
    onUpdate?: () => void;
}

export function useProductionItemForm({ item, setIsEditing, onUpdate }: UseProductionItemFormOptions) {
    const [fields, setFields] = useState<ItemFormFields>(() => fieldsFromItem(item));
    const [materials, setMaterials] = useState<CatalogEntry[]>([]);
    const [statuses, setStatuses] = useState<CatalogEntry[]>([]);
    const [treatments, setTreatments] = useState<CatalogEntry[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync fields when item identity changes
    useEffect(() => {
        setFields(fieldsFromItem(item));
    }, [item]);

    // Load catalogs once on mount
    useEffect(() => {
        async function loadCatalogs() {
            try {
                const data = await getCatalogData();
                setMaterials(data.materials ?? []);
                setStatuses(data.statuses ?? []);
                setTreatments(data.treatments ?? []);
            } catch (error) {
                console.error("Error loading catalogs:", error);
            }
        }
        loadCatalogs();
    }, []);

    function setField<K extends keyof ItemFormFields>(key: K, value: ItemFormFields[K]) {
        setFields((prev) => ({ ...prev, [key]: value }));
    }

    async function reloadMaterials() {
        try {
            const data = await getCatalogData();
            setMaterials(data.materials ?? []);
        } catch {
            // silent — catalog reload is best-effort
        }
    }

    async function reloadTreatments() {
        try {
            const data = await getCatalogData();
            setTreatments(data.treatments ?? []);
        } catch {
            // silent — catalog reload is best-effort
        }
    }

    async function createMaterial(val: string): Promise<string | null> {
        try {
            await createMaterialEntry(val);
            await reloadMaterials();
            return val;
        } catch {
            return null;
        }
    }

    async function createTreatment(val: string): Promise<string | null> {
        try {
            const id = await createTreatmentEntry(val);
            await reloadTreatments();
            return id ?? null;
        } catch {
            return null;
        }
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const result = await updateProductionOrder(item.id, {
                part_name: fields.name,
                quantity: fields.quantity,
                material: fields.material,
                general_status: fields.status,
                urgencia: fields.urgency,
                treatment_id: fields.treatmentId === "none" ? null : fields.treatmentId,
                image: fields.image,
                drawing_url: fields.drawingUrl,
                model_url: fields.modelUrl,
                render_url: fields.renderUrl,
                material_confirmation: fields.materialConfirmation,
            });

            if (result.success) {
                toast.success("Partida actualizada correctamente");
                setIsEditing(false);
                onUpdate?.();
            } else {
                toast.error(getErrorMessage(result.error));
            }
        } catch {
            toast.error("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    }

    return {
        fields,
        setField,
        isSaving,
        handleSave,
        materials,
        statuses,
        treatments,
        createMaterial,
        createTreatment,
    };
}
