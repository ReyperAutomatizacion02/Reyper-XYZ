"use client";

import { cn } from "@/lib/utils";
import { Package, Hash, Layers, FlaskConical, Check, ExternalLink, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ComboboxCreatable } from "../sales/combobox-creatable";
import { ProductionItemAssetUpload } from "./ProductionItemAssetUpload";
import { useProductionItemForm } from "./hooks/use-production-item-form";
import { ProductionItemType, ItemFieldKey } from "./types";

interface ProductionItemDetailProps {
    item: ProductionItemType;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onUpdate?: () => void;
    hiddenFields?: ItemFieldKey[];
    readOnlyFields?: ItemFieldKey[];
    onViewDrawing?: (url: string, title: string) => void;
}

export function ProductionItemDetail({
    item,
    isEditing,
    setIsEditing,
    onUpdate,
    hiddenFields = [],
    readOnlyFields = [],
    onViewDrawing,
}: ProductionItemDetailProps) {
    const { fields, setField, isSaving, handleSave, materials, statuses, treatments, createMaterial, createTreatment } =
        useProductionItemForm({ item, setIsEditing, onUpdate });

    const isUrgent = item.urgencia ?? item.urgency_level === "Urgente";
    const currentDrawing = fields.drawingUrl || item.drawing_url || "";
    const currentRender = fields.renderUrl || item.render_url || "";

    return (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all dark:border-slate-800/60 dark:bg-slate-900">
            <div className="flex flex-col gap-3">
                {/* Part Name */}
                {!hiddenFields.includes("name") && (
                    <div>
                        {isEditing && !readOnlyFields.includes("name") ? (
                            <div className="space-y-1.5 duration-300 animate-in fade-in slide-in-from-top-2">
                                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Nombre de la Pieza
                                </label>
                                <Input
                                    value={fields.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder="Nombre de la pieza"
                                    maxLength={80}
                                    className="h-11 truncate rounded-xl border-slate-200 bg-slate-50 text-lg font-bold uppercase focus:ring-[#EC1C21]"
                                />
                            </div>
                        ) : (
                            <h1 className="text-xl font-bold uppercase leading-snug tracking-tight text-slate-900 dark:text-white">
                                {item.part_name}
                            </h1>
                        )}
                    </div>
                )}

                {/* Status and Urgency Row */}
                <div className="mt-0.5 flex items-center justify-between gap-4">
                    {!hiddenFields.includes("status") && (
                        <>
                            {isEditing && !readOnlyFields.includes("status") ? (
                                <div className="max-w-[220px] flex-1 space-y-1 duration-300 animate-in fade-in slide-in-from-left-2">
                                    <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Estatus del Proyecto
                                    </label>
                                    <ComboboxCreatable
                                        options={statuses.map((s) => ({ value: s.name, label: s.name }))}
                                        value={fields.status}
                                        onSelect={(val) => setField("status", val)}
                                        placeholder="Seleccionar Estatus"
                                        className="h-9 rounded-xl border-slate-200 bg-slate-50 text-[11px] font-bold uppercase"
                                    />
                                </div>
                            ) : (
                                <Badge
                                    variant="secondary"
                                    className="pointer-events-none rounded-lg border border-slate-200/50 bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 shadow-sm shadow-black/5 dark:border-slate-700/50 dark:bg-slate-800"
                                >
                                    {item.general_status || item.status}
                                </Badge>
                            )}
                        </>
                    )}

                    {!hiddenFields.includes("urgency") && (
                        <div className="flex items-center gap-3">
                            {isEditing && !readOnlyFields.includes("urgency") ? (
                                <div className="flex flex-col items-start gap-1 duration-300 animate-in fade-in slide-in-from-right-2">
                                    <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Grado de Urgencia
                                    </label>
                                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
                                        <span
                                            className={`text-[10px] font-bold uppercase tracking-widest ${fields.urgency ? "text-[#EC1C21]" : "text-slate-400"}`}
                                        >
                                            {fields.urgency ? "Urgente" : "Normal"}
                                        </span>
                                        <Switch
                                            checked={fields.urgency}
                                            onCheckedChange={(val) => setField("urgency", val)}
                                            className="origin-right scale-75 data-[state=checked]:bg-[#EC1C21]"
                                        />
                                    </div>
                                </div>
                            ) : isUrgent ? (
                                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 shadow-sm shadow-red-500/5 dark:border-red-900/20 dark:bg-red-900/10">
                                    <div className="h-1.5 w-1.5 animate-ping rounded-full bg-[#EC1C21]" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#EC1C21]">
                                        URGENTE
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 opacity-60 dark:border-slate-800 dark:bg-slate-800/50">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        NORMAL
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Assets */}
            {!hiddenFields.includes("assets") && (
                <ProductionItemAssetUpload
                    imageUrl={fields.image}
                    drawingUrl={currentDrawing}
                    renderUrl={currentRender}
                    partName={fields.name || item.part_name || ""}
                    isEditing={isEditing}
                    readOnly={readOnlyFields.includes("assets")}
                    onImageChange={(url) => setField("image", url)}
                    onDrawingChange={(url) => setField("drawingUrl", url)}
                    onRenderChange={(url) => setField("renderUrl", url)}
                    onViewDrawing={onViewDrawing}
                />
            )}

            {/* Data Grid */}
            <div className="mt-2 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
                {!hiddenFields.includes("quantity") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <Hash className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Cantidad
                            </label>
                        </div>
                        {isEditing && !readOnlyFields.includes("quantity") ? (
                            <Input
                                type="number"
                                value={fields.quantity}
                                onChange={(e) => setField("quantity", Number(e.target.value))}
                                max={99999}
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 font-bold focus:ring-[#EC1C21]"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                                <span className="truncate text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200">
                                    {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes("material") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Material
                            </label>
                        </div>
                        {isEditing && !readOnlyFields.includes("material") ? (
                            <ComboboxCreatable
                                options={materials.map((m) => ({ value: m.name, label: m.name }))}
                                value={fields.material}
                                onSelect={(val) => setField("material", val)}
                                onCreate={createMaterial}
                                placeholder="Seleccionar..."
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold uppercase"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                                <span className="truncate text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200">
                                    {item.material || "No asignado"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes("material_confirmation") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Confirmación Material
                            </label>
                        </div>
                        {isEditing && !readOnlyFields.includes("material_confirmation") ? (
                            <ComboboxCreatable
                                options={materials.map((m) => ({ value: m.name, label: m.name }))}
                                value={fields.materialConfirmation}
                                onSelect={(val) => setField("materialConfirmation", val)}
                                onCreate={createMaterial}
                                placeholder="Seleccionar o crear..."
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold uppercase"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                                <span className="truncate text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200">
                                    {item.material_confirmation || "Pte. Confirmar"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes("treatment") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <FlaskConical className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Tratamiento
                            </label>
                        </div>
                        {isEditing && !readOnlyFields.includes("treatment") ? (
                            <ComboboxCreatable
                                options={[
                                    { value: "none", label: "SIN TRATAMIENTO" },
                                    ...treatments.map((t) => ({ value: t.id, label: t.name })),
                                ]}
                                value={fields.treatmentId}
                                onSelect={(val) => setField("treatmentId", val)}
                                onCreate={createTreatment}
                                placeholder="Seleccionar..."
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold uppercase"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                                <span className="truncate text-[11px] font-bold uppercase text-slate-700 dark:text-slate-200">
                                    {item.treatment_name || item.treatment || "Sin tratamiento"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes("drawing_url") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <ExternalLink className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Plano (URL)
                            </label>
                        </div>
                        <div
                            className={cn(
                                "flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50",
                                currentDrawing ? "cursor-pointer hover:bg-slate-100" : "opacity-60"
                            )}
                            onClick={() =>
                                currentDrawing && onViewDrawing?.(currentDrawing, fields.name || item.part_name || "")
                            }
                        >
                            <span className="truncate text-[11px] font-bold uppercase">
                                {currentDrawing ? "Ver Plano" : "Sin Plano"}
                            </span>
                        </div>
                    </div>
                )}

                {!hiddenFields.includes("render_url") && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="ml-1 flex items-center gap-1.5">
                            <Box className="h-3 w-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Modelo 3D
                            </label>
                        </div>
                        <div
                            className={cn(
                                "flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50",
                                currentRender ? "cursor-pointer hover:bg-slate-100" : "opacity-60"
                            )}
                        >
                            <span className="truncate text-[11px] font-bold uppercase">
                                {currentRender ? "Ver 3D" : "Sin 3D"}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden save trigger (preserves existing external callers) */}
            <button id="trigger-save-item" onClick={handleSave} className="hidden" />
        </div>
    );
}
