"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { cn, isValidImageSrc } from "@/lib/utils";
import {
    Package,
    ImageIcon,
    FileText,
    Upload,
    Loader2,
    ExternalLink,
    Box,
    FileCode,
    Hash,
    Layers,
    FlaskConical,
    Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DrawingViewer } from "../sales/drawing-viewer";
import { ModelViewerModal } from "../sales/model-viewer-modal";
import { toast } from "sonner";
import {
    updateProductionOrder,
    getCatalogData,
    createMaterialEntry,
    createTreatmentEntry,
} from "@/app/dashboard/ventas/actions";
import { getErrorMessage } from "@/lib/action-result";
import { uploadPartAsset } from "@/app/dashboard/ventas/upload-client";
import { ComboboxCreatable } from "../sales/combobox-creatable";

interface ProductionItemDetailProps {
    item: any;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onUpdate?: () => void;
    hiddenFields?: string[];
    readOnlyFields?: string[];
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
    // Edit States
    const [editName, setEditName] = useState(item.part_name || "");
    const [editQuantity, setEditQuantity] = useState(
        item.quantity !== undefined && item.quantity !== null ? item.quantity : 1
    );
    const [editMaterial, setEditMaterial] = useState(item.material || "");
    const [editStatus, setEditStatus] = useState(item.general_status || item.status || "");
    const [editUrgency, setEditUrgency] = useState(item.urgencia || item.urgency_level === "Urgente" || false);
    const [editImage, setEditImage] = useState(item.image || "");
    const [editDrawingUrl, setEditDrawingUrl] = useState(item.drawing_url || "");
    const [editModelUrl, setEditModelUrl] = useState(item.model_url || "");
    const [editRenderUrl, setEditRenderUrl] = useState(item.render_url || "");
    const [editTreatmentId, setEditTreatmentId] = useState(item.treatment_id || "none");
    const [editMaterialConfirmation, setEditMaterialConfirmation] = useState(item.material_confirmation || "");

    // Catalog States
    const [materials, setMaterials] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [treatments, setTreatments] = useState<any[]>([]);

    // UI States
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState<string | null>(null); // 'image' or 'drawing'
    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [visorType, setVisorType] = useState<"image" | "pdf" | "3d">();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const drawingInputRef = useRef<HTMLInputElement>(null);
    const renderInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function loadCatalogs() {
            try {
                const data = await getCatalogData();
                setMaterials(data.materials || []);
                setStatuses(data.statuses || []);
                const treatmentList = data.treatments || [];
                setTreatments(treatmentList);
            } catch (error) {
                console.error("Error loading catalogs:", error);
            }
        }
        loadCatalogs();
    }, []);

    // Sync local state when item changes
    useEffect(() => {
        setEditName(item.part_name || "");
        setEditQuantity(item.quantity !== undefined && item.quantity !== null ? item.quantity : 1);
        setEditMaterial(item.material || "");
        setEditStatus(item.general_status || item.status || "");
        setEditUrgency(item.urgencia || item.urgency_level === "Urgente" || false);
        setEditImage(item.image || "");
        setEditDrawingUrl(item.drawing_url || "");
        setEditModelUrl(item.model_url || "");
        setEditRenderUrl(item.render_url || "");
        setEditTreatmentId(item.treatment_id || "none");
        setEditMaterialConfirmation(item.material_confirmation || "");
    }, [item]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateProductionOrder(item.id, {
                part_name: editName,
                quantity: editQuantity,
                material: editMaterial,
                general_status: editStatus,
                urgencia: editUrgency,
                treatment_id: editTreatmentId === "none" ? null : editTreatmentId,
                image: editImage,
                drawing_url: editDrawingUrl,
                model_url: editModelUrl,
                render_url: editRenderUrl,
                material_confirmation: editMaterialConfirmation,
            });

            if (result.success) {
                toast.success("Partida actualizada correctamente");
                setIsEditing(false);
                if (onUpdate) onUpdate();
            } else {
                toast.error(getErrorMessage(result.error));
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "drawing") => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(type);
        const toastId = toast.loading(`Subiendo ${type === "image" ? "imagen" : "plano"}...`);

        try {
            const path = type === "image" ? "images" : "drawings";
            const publicUrl = await uploadPartAsset(file, path);

            if (publicUrl) {
                if (type === "image") setEditImage(publicUrl);
                else setEditDrawingUrl(publicUrl);
                toast.success(`${type === "image" ? "Imagen" : "Plano"} cargado correctamente`, { id: toastId });
            }
        } catch (error) {
            toast.error("Error al procesar el archivo", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = "";
        }
    };

    const handleUploadRender = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext !== "glb" && ext !== "gltf") {
            toast.error("Por favor sube un archivo con extensión .glb o .gltf");
            return;
        }

        setIsUploading("render");
        const toastId = toast.loading("Subiendo render 3D...");

        try {
            const publicUrl = await uploadPartAsset(file, "renders");

            if (publicUrl) {
                setEditRenderUrl(publicUrl);
                toast.success("Render 3D cargado correctamente", { id: toastId });
            }
        } catch (error) {
            toast.error("Error al procesar el render", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = "";
        }
    };

    const openVisor = (url: string, type: "image" | "pdf" | "3d") => {
        if (onViewDrawing) {
            onViewDrawing(url, editName || item.part_name);
        } else {
            setVisorUrl(url);
            setVisorType(type);
        }
    };

    const currentImage = editImage || item.image;
    const currentDrawing = editDrawingUrl || item.drawing_url;
    const isImageDrive = currentImage?.includes("drive.google.com");
    const isDrawingDrive = currentDrawing?.includes("drive.google.com");
    const isUrgent = item.urgencia || item.urgency_level === "Urgente";

    return (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all dark:border-slate-800/60 dark:bg-slate-900">
            {/* Hidden File Inputs */}
            <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleUploadAsset(e, "image")}
            />
            <input
                type="file"
                ref={drawingInputRef}
                className="hidden"
                accept="application/pdf,image/*"
                onChange={(e) => handleUploadAsset(e, "drawing")}
            />
            <input
                type="file"
                ref={renderInputRef}
                className="hidden"
                accept=".glb,.gltf"
                onChange={handleUploadRender}
            />

            <div className="flex flex-col gap-3">
                {/* Piece Name */}
                {!hiddenFields.includes("name") && (
                    <div>
                        {isEditing && !readOnlyFields.includes("name") ? (
                            <div className="space-y-1.5 duration-300 animate-in fade-in slide-in-from-top-2">
                                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Nombre de la Pieza
                                </label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
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
                                        value={editStatus}
                                        onSelect={setEditStatus}
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
                                            className={`text-[10px] font-bold uppercase tracking-widest ${editUrgency ? "text-[#EC1C21]" : "text-slate-400"}`}
                                        >
                                            {editUrgency ? "Urgente" : "Normal"}
                                        </span>
                                        <Switch
                                            checked={editUrgency}
                                            onCheckedChange={setEditUrgency}
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

            {/* Assets (Images / Drawings / Renders) */}
            {!hiddenFields.includes("assets") && (
                <div className="flex w-full justify-center">
                    <div className="group relative flex aspect-video w-full max-w-[280px] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200/50 bg-slate-100 shadow-inner transition-all dark:border-slate-700/50 dark:bg-slate-800">
                        {isValidImageSrc(currentImage) || currentDrawing ? (
                            <>
                                {isValidImageSrc(currentImage) && !isImageDrive ? (
                                    <Image
                                        src={currentImage!}
                                        alt={editName || item.part_name || "Imagen"}
                                        fill
                                        className="object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-40"
                                    />
                                ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-slate-500 transition-opacity group-hover:opacity-30">
                                        <FileText className="h-10 w-10 text-[#EC1C21] opacity-60" />
                                        <span className="text-center text-[11px] font-bold uppercase tracking-widest">
                                            {currentDrawing ? "Visor de Plano" : "Visor de Archivos"}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2.5 p-6 text-center text-slate-400">
                                <Upload className="h-8 w-8 stroke-[1.5] opacity-30" />
                                <p className="text-[9px] font-bold uppercase leading-tight tracking-widest">
                                    Sin archivos
                                    <br />
                                    vinculados
                                </p>
                            </div>
                        )}

                        {/* Controls */}
                        {isEditing && !readOnlyFields.includes("assets") ? (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/40 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className="h-8 flex-1 rounded-lg bg-[#EC1C21] px-4 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-[#D1181C]"
                                        onClick={() => drawingInputRef.current?.click()}
                                        disabled={isUploading === "drawing"}
                                    >
                                        {isUploading === "drawing" ? (
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Upload className="mr-2 h-3.5 w-3.5" />
                                        )}{" "}
                                        Cargar Plano
                                    </Button>
                                    {currentDrawing && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 bg-white/90 p-0 text-[#EC1C21] hover:bg-white"
                                            onClick={() => openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full max-w-[160px] rounded-lg border-none bg-white/90 px-6 text-[10px] font-bold uppercase text-slate-900 shadow-xl hover:bg-white"
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={isUploading === "image"}
                                >
                                    {isUploading === "image" ? (
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <ImageIcon className="mr-2 h-3.5 w-3.5" />
                                    )}{" "}
                                    Imagen
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full max-w-[160px] rounded-lg border-none bg-slate-800 px-6 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-slate-700"
                                    onClick={() => renderInputRef.current?.click()}
                                    disabled={isUploading === "render"}
                                >
                                    {isUploading === "render" ? (
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Box className="mr-2 h-3.5 w-3.5" />
                                    )}{" "}
                                    Render 3D
                                </Button>
                            </div>
                        ) : (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/40 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
                                {currentDrawing && (
                                    <Button
                                        size="sm"
                                        className="h-8 w-32 rounded-lg bg-[#EC1C21] px-5 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-[#D1181C]"
                                        onClick={() => openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")}
                                    >
                                        <FileText className="mr-2 h-3.5 w-3.5" /> Plano
                                    </Button>
                                )}
                                {currentImage && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-32 rounded-lg border-none bg-white/90 px-5 text-[10px] font-bold uppercase text-slate-900 shadow-xl hover:bg-white"
                                        onClick={() => openVisor(currentImage, isImageDrive ? "pdf" : "image")}
                                    >
                                        <ImageIcon className="mr-2 h-3.5 w-3.5" /> Imagen
                                    </Button>
                                )}
                                {item.render_url && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-32 rounded-lg border-none bg-slate-800 px-5 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-slate-700"
                                        onClick={() => openVisor(item.render_url, "3d")}
                                    >
                                        <Box className="mr-2 h-3.5 w-3.5" /> Visor 3D
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(Number(e.target.value))}
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
                                value={editMaterial}
                                onSelect={setEditMaterial}
                                onCreate={async (val) => {
                                    try {
                                        await createMaterialEntry(val);
                                        const data = await getCatalogData();
                                        setMaterials(data.materials || []);
                                        return val;
                                    } catch {
                                        return null;
                                    }
                                }}
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
                                value={editMaterialConfirmation}
                                onSelect={setEditMaterialConfirmation}
                                onCreate={async (val) => {
                                    try {
                                        await createMaterialEntry(val);
                                        const data = await getCatalogData();
                                        setMaterials(data.materials || []);
                                        return val;
                                    } catch {
                                        return null;
                                    }
                                }}
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
                                value={editTreatmentId}
                                onSelect={setEditTreatmentId}
                                onCreate={async (val) => {
                                    try {
                                        const id = await createTreatmentEntry(val);
                                        const data = await getCatalogData();
                                        setTreatments(data.treatments || []);
                                        return id ?? null;
                                    } catch {
                                        return null;
                                    }
                                }}
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
                                currentDrawing && openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")
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
                                item.render_url ? "cursor-pointer hover:bg-slate-100" : "opacity-60"
                            )}
                            onClick={() => item.render_url && openVisor(item.render_url, "3d")}
                        >
                            <span className="truncate text-[11px] font-bold uppercase">
                                {item.render_url ? "Ver 3D" : "Sin 3D"}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <button id="trigger-save-item" onClick={handleSave} className="hidden" />
            <DrawingViewer
                onClose={() => {
                    setVisorUrl(null);
                    setVisorType(undefined);
                }}
                url={visorUrl ?? ""}
                title={editName || item.part_name}
                type={visorType}
            />
        </div>
    );
}
