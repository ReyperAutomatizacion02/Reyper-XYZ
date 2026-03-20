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
    Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DrawingViewer } from "../sales/drawing-viewer";
import { ModelViewerModal } from "../sales/model-viewer-modal";
import { toast } from "sonner";
import { updateProductionOrder, getCatalogData, createMaterialEntry, createTreatmentEntry } from "@/app/dashboard/ventas/actions";
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
    onViewDrawing
}: ProductionItemDetailProps) {
    // Edit States
    const [editName, setEditName] = useState(item.part_name || "");
    const [editQuantity, setEditQuantity] = useState(item.quantity !== undefined && item.quantity !== null ? item.quantity : 1);
    const [editMaterial, setEditMaterial] = useState(item.material || "");
    const [editStatus, setEditStatus] = useState(item.genral_status || item.status || "");
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
        setEditStatus(item.genral_status || item.status || "");
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
                genral_status: editStatus,
                urgencia: editUrgency,
                treatment_id: editTreatmentId === "none" ? null : editTreatmentId,
                image: editImage,
                drawing_url: editDrawingUrl,
                model_url: editModelUrl,
                render_url: editRenderUrl,
                material_confirmation: editMaterialConfirmation
            });

            if (result.success) {
                toast.success("Partida actualizada correctamente");
                setIsEditing(false);
                if (onUpdate) onUpdate();
            } else {
                toast.error(result.error || "Error al actualizar");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'drawing') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(type);
        const toastId = toast.loading(`Subiendo ${type === 'image' ? 'imagen' : 'plano'}...`);

        try {
            const path = type === 'image' ? 'images' : 'drawings';
            const publicUrl = await uploadPartAsset(file, path);

            if (publicUrl) {
                if (type === 'image') setEditImage(publicUrl);
                else setEditDrawingUrl(publicUrl);
                toast.success(`${type === 'image' ? 'Imagen' : 'Plano'} cargado correctamente`, { id: toastId });
            }
        } catch (error) {
            toast.error("Error al procesar el archivo", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleUploadRender = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'glb' && ext !== 'gltf') {
            toast.error("Por favor sube un archivo con extensión .glb o .gltf");
            return;
        }

        setIsUploading('render');
        const toastId = toast.loading("Subiendo render 3D...");

        try {
            const publicUrl = await uploadPartAsset(file, 'renders');

            if (publicUrl) {
                setEditRenderUrl(publicUrl);
                toast.success("Render 3D cargado correctamente", { id: toastId });
            }
        } catch (error) {
            toast.error("Error al procesar el render", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = '';
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
    const isImageDrive = currentImage?.includes('drive.google.com');
    const isDrawingDrive = currentDrawing?.includes('drive.google.com');
    const isUrgent = item.urgencia || item.urgency_level === "Urgente";

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-800/60 transition-all flex flex-col gap-6">

            {/* Hidden File Inputs */}
            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleUploadAsset(e, 'image')} />
            <input type="file" ref={drawingInputRef} className="hidden" accept="application/pdf,image/*" onChange={(e) => handleUploadAsset(e, 'drawing')} />
            <input type="file" ref={renderInputRef} className="hidden" accept=".glb,.gltf" onChange={handleUploadRender} />

            <div className="flex flex-col gap-3">
                {/* Piece Name */}
                {!hiddenFields.includes('name') && (
                    <div>
                        {isEditing && !readOnlyFields.includes('name') ? (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Nombre de la Pieza</label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nombre de la pieza"
                                    maxLength={80}
                                    className="text-lg font-bold uppercase h-11 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl truncate"
                                />
                            </div>
                        ) : (
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase leading-snug">
                                {item.part_name}
                            </h1>
                        )}
                    </div>
                )}

                {/* Status and Urgency Row */}
                <div className="flex items-center justify-between gap-4 mt-0.5">
                    {!hiddenFields.includes('status') && (
                        <>
                            {isEditing && !readOnlyFields.includes('status') ? (
                                <div className="flex-1 max-w-[220px] space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Estatus del Proyecto</label>
                                    <ComboboxCreatable
                                        options={statuses.map(s => ({ value: s.name, label: s.name }))}
                                        value={editStatus}
                                        onSelect={setEditStatus}
                                        placeholder="Seleccionar Estatus"
                                        className="h-9 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-[11px]"
                                    />
                                </div>
                            ) : (
                                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 pointer-events-none shadow-sm shadow-black/5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                    {item.genral_status || item.status}
                                </Badge>
                            )}
                        </>
                    )}

                    {!hiddenFields.includes('urgency') && (
                        <div className="flex items-center gap-3">
                            {isEditing && !readOnlyFields.includes('urgency') ? (
                                <div className="flex flex-col items-start gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Grado de Urgencia</label>
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${editUrgency ? "text-[#EC1C21]" : "text-slate-400"}`}>
                                            {editUrgency ? "Urgente" : "Normal"}
                                        </span>
                                        <Switch
                                            checked={editUrgency}
                                            onCheckedChange={setEditUrgency}
                                            className="scale-75 origin-right data-[state=checked]:bg-[#EC1C21]"
                                        />
                                    </div>
                                </div>
                            ) : (
                                isUrgent ? (
                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 px-3 py-1.5 rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm shadow-red-500/5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#EC1C21] animate-ping" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#EC1C21]">URGENTE</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 opacity-60">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">NORMAL</span>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Assets (Images / Drawings / Renders) */}
            {!hiddenFields.includes('assets') && (
                <div className="flex justify-center w-full">
                    <div className="w-full max-w-[280px] aspect-video relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-200/50 dark:border-slate-700/50 shadow-inner group transition-all">
                        {(isValidImageSrc(currentImage) || currentDrawing) ? (
                            <>
                                {isValidImageSrc(currentImage) && !isImageDrive ? (
                                    <Image src={currentImage!} alt={editName || item.part_name || "Imagen"} fill className="object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 w-full p-4 h-full justify-center group-hover:opacity-30 transition-opacity text-slate-500">
                                        <FileText className="w-10 h-10 opacity-60 text-[#EC1C21]" />
                                        <span className="text-[11px] uppercase font-bold text-center tracking-widest">{currentDrawing ? "Visor de Plano" : "Visor de Archivos"}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2.5 text-slate-400 p-6 text-center">
                                <Upload className="w-8 h-8 opacity-30 stroke-[1.5]" />
                                <p className="text-[9px] font-bold uppercase tracking-widest leading-tight">Sin archivos<br />vinculados</p>
                            </div>
                        )}

                        {/* Controls */}
                        {isEditing && !readOnlyFields.includes('assets') ? (
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 z-20">
                                <div className="flex items-center gap-2">
                                    <Button size="sm" className="h-8 px-4 text-[10px] font-bold uppercase bg-[#EC1C21] hover:bg-[#D1181C] text-white shadow-xl rounded-lg flex-1" onClick={() => drawingInputRef.current?.click()} disabled={isUploading === 'drawing'}>
                                        {isUploading === 'drawing' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Upload className="w-3.5 h-3.5 mr-2" />} Cargar Plano
                                    </Button>
                                    {currentDrawing && (
                                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-[#EC1C21]" onClick={() => openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")}>
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <Button size="sm" variant="outline" className="h-8 px-6 text-[10px] font-bold uppercase bg-white/90 hover:bg-white text-slate-900 border-none shadow-xl rounded-lg w-full max-w-[160px]" onClick={() => imageInputRef.current?.click()} disabled={isUploading === 'image'}>
                                    {isUploading === 'image' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <ImageIcon className="w-3.5 h-3.5 mr-2" />} Imagen
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 px-6 text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-white border-none shadow-xl rounded-lg w-full max-w-[160px]" onClick={() => renderInputRef.current?.click()} disabled={isUploading === 'render'}>
                                    {isUploading === 'render' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Box className="w-3.5 h-3.5 mr-2" />} Render 3D
                                </Button>
                            </div>
                        ) : (
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 z-20">
                                {currentDrawing && <Button size="sm" className="h-8 px-5 text-[10px] font-bold uppercase bg-[#EC1C21] hover:bg-[#D1181C] text-white shadow-xl rounded-lg w-32" onClick={() => openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")}><FileText className="w-3.5 h-3.5 mr-2" /> Plano</Button>}
                                {currentImage && <Button size="sm" variant="outline" className="h-8 px-5 text-[10px] font-bold uppercase bg-white/90 hover:bg-white text-slate-900 border-none shadow-xl rounded-lg w-32" onClick={() => openVisor(currentImage, isImageDrive ? "pdf" : "image")}><ImageIcon className="w-3.5 h-3.5 mr-2" /> Imagen</Button>}
                                {item.render_url && <Button size="sm" variant="outline" className="h-8 px-5 text-[10px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-white border-none shadow-xl rounded-lg w-32" onClick={() => openVisor(item.render_url, "3d")}><Box className="w-3.5 h-3.5 mr-2" /> Visor 3D</Button>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Data Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 mt-2">
                {!hiddenFields.includes('quantity') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1"><Hash className="w-3 h-3 text-[#EC1C21]" /><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cantidad</label></div>
                        {isEditing && !readOnlyFields.includes('quantity') ? (
                            <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} max={99999} className="h-10 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl font-bold" />
                        ) : (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate">{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}</span></div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes('material') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1"><Layers className="w-3 h-3 text-[#EC1C21]" /><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material</label></div>
                        {isEditing && !readOnlyFields.includes('material') ? (
                            <ComboboxCreatable
                                options={materials.map(m => ({ value: m.name, label: m.name }))}
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
                                className="h-10 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate">{item.material || "No asignado"}</span></div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes('material_confirmation') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1">
                            <Check className="w-3 h-3 text-[#EC1C21]" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmación Material</label>
                        </div>
                        {isEditing && !readOnlyFields.includes('material_confirmation') ? (
                            <ComboboxCreatable
                                options={materials.map(m => ({ value: m.name, label: m.name }))}
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
                                className="h-10 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate">
                                    {item.material_confirmation || "Pte. Confirmar"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes('treatment') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1"><FlaskConical className="w-3 h-3 text-[#EC1C21]" /><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tratamiento</label></div>
                        {isEditing && !readOnlyFields.includes('treatment') ? (
                            <ComboboxCreatable
                                options={[{ value: "none", label: "SIN TRATAMIENTO" }, ...treatments.map(t => ({ value: t.id, label: t.name }))]}
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
                                className="h-10 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate">
                                    {item.treatment_name || item.treatment || "Sin tratamiento"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!hiddenFields.includes('drawing_url') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1"><ExternalLink className="w-3 h-3 text-[#EC1C21]" /><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plano (URL)</label></div>
                        <div className={cn("flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800", currentDrawing ? "hover:bg-slate-100 cursor-pointer" : "opacity-60")} onClick={() => currentDrawing && openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image")}>
                            <span className="text-[11px] font-bold uppercase truncate">{currentDrawing ? "Ver Plano" : "Sin Plano"}</span>
                        </div>
                    </div>
                )}

                {!hiddenFields.includes('render_url') && (
                    <div className="space-y-1.5 text-slate-500">
                        <div className="flex items-center gap-1.5 ml-1"><Box className="w-3 h-3 text-[#EC1C21]" /><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modelo 3D</label></div>
                        <div className={cn("flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800", item.render_url ? "hover:bg-slate-100 cursor-pointer" : "opacity-60")} onClick={() => item.render_url && openVisor(item.render_url, "3d")}>
                            <span className="text-[11px] font-bold uppercase truncate">{item.render_url ? "Ver 3D" : "Sin 3D"}</span>
                        </div>
                    </div>
                )}
            </div>

            <button id="trigger-save-item" onClick={handleSave} className="hidden" />
            <DrawingViewer onClose={() => { setVisorUrl(null); setVisorType(undefined); }} url={visorUrl ?? ""} title={editName || item.part_name} type={visorType} />
        </div>
    );
}
