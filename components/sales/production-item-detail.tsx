"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
    Package,
    Building2,
    AlertCircle,
    Image as ImageIcon,
    FileText,
    Eye,
    Upload,
    Trash2,
    Loader2,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Check,
    Hash,
    Layers,
    FlaskConical
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DrawingViewer } from "./drawing-viewer";
import { toast } from "sonner";
import { updateProductionOrder, getCatalogData } from "@/app/dashboard/ventas/actions";
import { uploadPartAsset } from "@/app/dashboard/ventas/upload-client";

interface ProductionItemDetailProps {
    item: any;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onUpdate?: () => void;
}

export function ProductionItemDetail({
    item,
    isEditing,
    setIsEditing,
    onUpdate
}: ProductionItemDetailProps) {
    // Edit States
    const [editName, setEditName] = useState(item.part_name || "");
    const [editQuantity, setEditQuantity] = useState(item.quantity || 1);
    const [editMaterial, setEditMaterial] = useState(item.material || "");
    const [editStatus, setEditStatus] = useState(item.genral_status || item.status || "");
    const [editUrgency, setEditUrgency] = useState(item.urgencia || item.urgency_level === "Urgente" || false);
    const [editImage, setEditImage] = useState(item.image || "");
    const [editDrawingUrl, setEditDrawingUrl] = useState(item.drawing_url || "");
    const [editTreatmentId, setEditTreatmentId] = useState(item.treatment_id || "none");

    // Catalog States
    const [materials, setMaterials] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [treatments, setTreatments] = useState<any[]>([]);

    // UI States
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState<string | null>(null); // 'image' or 'drawing'
    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [visorType, setVisorType] = useState<"image" | "pdf">();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const drawingInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function loadCatalogs() {
            try {
                const data = await getCatalogData();
                setMaterials(data.materials || []);
                setStatuses(data.statuses || []);
                const treatmentList = (data as any).treatments || [];
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
        setEditQuantity(item.quantity || 1);
        setEditMaterial(item.material || "");
        setEditStatus(item.genral_status || item.status || "");
        setEditUrgency(item.urgencia || item.urgency_level === "Urgente" || false);
        setEditImage(item.image || "");
        setEditDrawingUrl(item.drawing_url || "");
        setEditTreatmentId(item.treatment_id || "none");
    }, [item]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateProductionOrder(item.id, {
                part_name: editName,
                quantity: editQuantity,
                material: editMaterial,
                genral_status: editStatus,
                urgency_level: editUrgency ? "Urgente" : "Normal",
                treatment_id: editTreatmentId === "none" ? null : editTreatmentId,
                image: editImage,
                drawing_url: editDrawingUrl
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'drawing') => {
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
            // Reset input
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteImage = () => {
        setEditImage("");
        toast.info("Imagen removida");
    };

    const handleDeleteDrawing = () => {
        setEditDrawingUrl("");
        toast.info("Vínculo de plano removido");
    };

    const openVisor = (url: string, type: "image" | "pdf") => {
        setVisorUrl(url);
        setVisorType(type);
    };

    const currentImage = editImage || item.image;
    const currentDrawing = editDrawingUrl || item.drawing_url;
    const isImageDrive = currentImage?.includes('drive.google.com');
    const isDrawingDrive = currentDrawing?.includes('drive.google.com');
    const isUrgent = item.urgencia || item.urgency_level === "Urgente";

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-800/60 transition-all flex flex-col gap-6">

            {/* Hidden File Inputs */}
            <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'image')}
            />
            <input
                type="file"
                ref={drawingInputRef}
                className="hidden"
                accept="application/pdf,image/*"
                onChange={(e) => handleFileSelect(e, 'drawing')}
            />

            {/* Name, Status and Urgency Header Area */}
            <div className="flex flex-col gap-3">
                {/* Piece Name */}
                <div>
                    {isEditing ? (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Nombre de la Pieza</label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Nombre de la pieza"
                                className="text-lg font-bold uppercase h-11 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl"
                            />
                        </div>
                    ) : (
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase leading-snug">
                            {item.part_name}
                        </h1>
                    )}
                </div>

                {/* Status and Urgency Row */}
                <div className="flex items-center justify-between gap-4 mt-0.5">
                    {isEditing ? (
                        <div className="flex-1 max-w-[220px] space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Estatus del Proyecto</label>
                            <Select value={editStatus} onValueChange={setEditStatus}>
                                <SelectTrigger className="h-9 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl font-bold uppercase text-[11px]">
                                    <SelectValue placeholder="Seleccionar Estatus" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl overflow-hidden border-slate-200">
                                    {statuses.map(s => (
                                        <SelectItem key={s.id} value={s.name} className="uppercase font-bold text-[11px]">{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 pointer-events-none shadow-sm shadow-black/5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                            {item.genral_status || item.status}
                        </Badge>
                    )}

                    {/* Urgency Trigger/Indicator */}
                    <div className="flex items-center gap-3">
                        {isEditing ? (
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
                </div>
            </div>

            {/* Compact Image Cover (16:9 small and centered) */}
            <div className="flex justify-center w-full">
                <div
                    className="w-full max-w-[280px] aspect-video relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-200/50 dark:border-slate-700/50 shadow-inner group transition-all"
                >
                    {(currentImage || currentDrawing) ? (
                        <>
                            {currentImage && !isImageDrive ? (
                                <Image
                                    src={currentImage}
                                    alt={editName || item.part_name || "Imagen de partida"}
                                    fill
                                    className="object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 w-full p-4 h-full justify-center group-hover:opacity-30 transition-opacity">
                                    <div className="flex flex-col items-center gap-2 text-slate-500">
                                        <FileText className="w-10 h-10 opacity-60 group-hover:scale-110 transition-transform text-[#EC1C21]" />
                                        <span className="text-[11px] uppercase font-bold text-center tracking-widest leading-none">
                                            {currentDrawing ? "Visor de Plano" : "Visor de Archivos"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2.5 text-slate-400 p-6 text-center">
                            <Upload className="w-8 h-8 opacity-30 stroke-[1.5]" />
                            <p className="text-[9px] font-bold uppercase tracking-widest leading-tight">Sin archivos<br />vinculados</p>
                        </div>
                    )}

                    {/* Overlay Controls */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-4 z-10 bg-black/50 backdrop-blur-[2px]">
                        {isEditing ? (
                            <>
                                {/* Hybrid Controls for Editing */}
                                <Button
                                    size="sm"
                                    className="h-8 px-4 text-[10px] font-bold uppercase bg-[#EC1C21] hover:bg-[#D1181C] text-white shadow-xl rounded-lg w-32"
                                    onClick={() => drawingInputRef.current?.click()}
                                    disabled={isUploading === 'drawing'}
                                >
                                    {isUploading === 'drawing' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
                                    {currentDrawing ? "Sustituir Plano" : "Subir Plano"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-4 text-[10px] font-bold uppercase bg-white/90 hover:bg-white text-slate-900 border-none shadow-xl rounded-lg w-32"
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={isUploading === 'image'}
                                >
                                    {isUploading === 'image' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
                                    {currentImage ? "Sustituir Imagen" : "Subir Imagen"}
                                </Button>
                            </>
                        ) : (
                            <>
                                {/* View Buttons for Read Only */}
                                {currentDrawing && (
                                    <Button
                                        size="sm"
                                        className="h-8 px-5 text-[10px] font-bold uppercase bg-[#EC1C21] hover:bg-[#D1181C] text-white shadow-xl rounded-lg w-28"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openVisor(currentDrawing, isDrawingDrive ? "pdf" : "image");
                                        }}
                                    >
                                        <FileText className="w-3.5 h-3.5 mr-2" /> Plano
                                    </Button>
                                )}
                                {currentImage && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-5 text-[10px] font-bold uppercase bg-white/90 hover:bg-white text-slate-900 border-none shadow-xl rounded-lg w-28"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openVisor(currentImage, isImageDrive ? "pdf" : "image");
                                        }}
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 mr-2" /> Imagen
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Data Grid: Inline Editing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 mt-2">

                {/* Quantity */}
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 ml-1">
                        <Hash className="w-3 h-3 text-[#EC1C21]" />
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cantidad</label>
                    </div>
                    {isEditing ? (
                        <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            className="h-10 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl font-bold"
                        />
                    ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{item.quantity} unidades</span>
                        </div>
                    )}
                </div>

                {/* Material */}
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 ml-1">
                        <Layers className="w-3 h-3 text-[#EC1C21]" />
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material</label>
                    </div>
                    {isEditing ? (
                        <Select value={editMaterial} onValueChange={setEditMaterial}>
                            <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl font-bold uppercase">
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl overflow-hidden border-slate-200">
                                {materials.map(m => (
                                    <SelectItem key={m.id} value={m.name} className="uppercase font-bold text-xs">{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase">{item.material || "No asignado"}</span>
                        </div>
                    )}
                </div>

                {/* Treatment */}
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 ml-1">
                        <FlaskConical className="w-3 h-3 text-[#EC1C21]" />
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tratamiento</label>
                    </div>
                    {isEditing ? (
                        <Select value={editTreatmentId} onValueChange={setEditTreatmentId}>
                            <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl font-bold uppercase">
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl overflow-hidden border-slate-200">
                                <SelectItem value="none" className="uppercase font-bold text-xs">Sin tratamiento</SelectItem>
                                {treatments.map(t => (
                                    <SelectItem key={t.id} value={t.id} className="uppercase font-bold text-xs">{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase">{item.treatment_name || item.treatment || "Sin tratamiento"}</span>
                        </div>
                    )}
                </div>

                {/* Drawing / Plano URL */}
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 ml-1">
                        <ExternalLink className="w-3 h-3 text-[#EC1C21]" />
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vínculo de Plano (URL)</label>
                    </div>
                    {isEditing ? (
                        <div className="relative group">
                            <Input
                                value={editDrawingUrl}
                                onChange={(e) => setEditDrawingUrl(e.target.value)}
                                placeholder="URL del Plano (G-Drive u otro)"
                                className="h-10 bg-slate-50 border-slate-200 focus:ring-[#EC1C21] rounded-xl pr-10 text-[11px] font-medium"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {editDrawingUrl && (
                                    <button onClick={handleDeleteDrawing} className="text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <div className="p-1 text-slate-300">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 transition-all",
                                currentDrawing ? "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer active:scale-[0.98]" : "opacity-60"
                            )}
                            onClick={() => {
                                if (currentDrawing) {
                                    window.open(currentDrawing, '_blank', 'noopener,noreferrer');
                                }
                            }}
                            title={currentDrawing ? "Click para abrir plano en una nueva pestaña" : "Sin plano vinculado"}
                        >
                            <span className={`text-[11px] font-bold uppercase truncate max-w-[150px] ${currentDrawing ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                                {currentDrawing ? (isDrawingDrive ? "Plano G-Drive" : "Plano Vinculado") : "Sin Plano"}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Action Hidden Trigger */}
            <button id="trigger-save-item" onClick={handleSave} className="hidden" />

            {/* Drawing Viewer Modal */}
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
