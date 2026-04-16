"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, FileText, Upload, Loader2, ExternalLink, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawingViewer } from "../sales/drawing-viewer";
import { ModelViewerModal } from "../sales/model-viewer-modal";
import { toast } from "sonner";
import { uploadPartAsset } from "@/app/dashboard/ventas/upload-client";
import { isValidImageSrc } from "@/lib/utils";

interface ProductionItemAssetUploadProps {
    /** Current committed image URL (from item or after upload) */
    imageUrl: string;
    /** Current committed drawing URL (from item or after upload) */
    drawingUrl: string;
    /** Current committed render URL */
    renderUrl: string;
    /** Part display name, used for the visor title */
    partName: string;
    /** Whether the panel is in edit mode */
    isEditing: boolean;
    /** Whether this field is read-only even in edit mode */
    readOnly?: boolean;
    /** Called when the user uploads a new image */
    onImageChange: (url: string) => void;
    /** Called when the user uploads a new drawing */
    onDrawingChange: (url: string) => void;
    /** Called when the user uploads a new render */
    onRenderChange: (url: string) => void;
    /**
     * Optional external visor opener. When provided, clicking "View" items
     * will call this instead of opening the internal DrawingViewer.
     */
    onViewDrawing?: (url: string, title: string) => void;
}

export function ProductionItemAssetUpload({
    imageUrl,
    drawingUrl,
    renderUrl,
    partName,
    isEditing,
    readOnly = false,
    onImageChange,
    onDrawingChange,
    onRenderChange,
    onViewDrawing,
}: ProductionItemAssetUploadProps) {
    const [isUploading, setIsUploading] = useState<"image" | "drawing" | "render" | null>(null);
    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [visorType, setVisorType] = useState<"image" | "pdf" | "3d">();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const drawingInputRef = useRef<HTMLInputElement>(null);
    const renderInputRef = useRef<HTMLInputElement>(null);

    const isImageDrive = imageUrl?.includes("drive.google.com");
    const isDrawingDrive = drawingUrl?.includes("drive.google.com");

    function openVisor(url: string, type: "image" | "pdf" | "3d") {
        if (onViewDrawing) {
            onViewDrawing(url, partName);
        } else {
            setVisorUrl(url);
            setVisorType(type);
        }
    }

    async function handleUploadAsset(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "drawing") {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(type);
        const toastId = toast.loading(`Subiendo ${type === "image" ? "imagen" : "plano"}...`);

        try {
            const path = type === "image" ? "images" : "drawings";
            const publicUrl = await uploadPartAsset(file, path);
            if (publicUrl) {
                if (type === "image") onImageChange(publicUrl);
                else onDrawingChange(publicUrl);
                toast.success(`${type === "image" ? "Imagen" : "Plano"} cargado correctamente`, { id: toastId });
            }
        } catch {
            toast.error("Error al procesar el archivo", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = "";
        }
    }

    async function handleUploadRender(e: React.ChangeEvent<HTMLInputElement>) {
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
                onRenderChange(publicUrl);
                toast.success("Render 3D cargado correctamente", { id: toastId });
            }
        } catch {
            toast.error("Error al procesar el render", { id: toastId });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = "";
        }
    }

    return (
        <>
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

            {/* Asset Preview Card */}
            <div className="flex w-full justify-center">
                <div className="group relative flex aspect-video w-full max-w-[280px] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200/50 bg-slate-100 shadow-inner transition-all dark:border-slate-700/50 dark:bg-slate-800">
                    {isValidImageSrc(imageUrl) || drawingUrl ? (
                        <>
                            {isValidImageSrc(imageUrl) && !isImageDrive ? (
                                <Image
                                    src={imageUrl}
                                    alt={partName || "Imagen"}
                                    fill
                                    className="object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-40"
                                />
                            ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-slate-500 transition-opacity group-hover:opacity-30">
                                    <FileText className="h-10 w-10 text-brand opacity-60" />
                                    <span className="text-center text-[11px] font-bold uppercase tracking-widest">
                                        {drawingUrl ? "Visor de Plano" : "Visor de Archivos"}
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

                    {/* Hover Controls */}
                    {isEditing && !readOnly ? (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/40 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="h-8 flex-1 rounded-lg bg-brand px-4 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-brand-hover"
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
                                {drawingUrl && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 bg-white/90 p-0 text-brand hover:bg-white"
                                        onClick={() => openVisor(drawingUrl, isDrawingDrive ? "pdf" : "image")}
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
                            {drawingUrl && (
                                <Button
                                    size="sm"
                                    className="h-8 w-32 rounded-lg bg-brand px-5 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-brand-hover"
                                    onClick={() => openVisor(drawingUrl, isDrawingDrive ? "pdf" : "image")}
                                >
                                    <FileText className="mr-2 h-3.5 w-3.5" /> Plano
                                </Button>
                            )}
                            {imageUrl && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-32 rounded-lg border-none bg-white/90 px-5 text-[10px] font-bold uppercase text-slate-900 shadow-xl hover:bg-white"
                                    onClick={() => openVisor(imageUrl, isImageDrive ? "pdf" : "image")}
                                >
                                    <ImageIcon className="mr-2 h-3.5 w-3.5" /> Imagen
                                </Button>
                            )}
                            {renderUrl && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-32 rounded-lg border-none bg-slate-800 px-5 text-[10px] font-bold uppercase text-white shadow-xl hover:bg-slate-700"
                                    onClick={() => openVisor(renderUrl, "3d")}
                                >
                                    <Box className="mr-2 h-3.5 w-3.5" /> Visor 3D
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Internal Visor (used when onViewDrawing is not provided) */}
            <DrawingViewer
                onClose={() => {
                    setVisorUrl(null);
                    setVisorType(undefined);
                }}
                url={visorUrl ?? ""}
                title={partName}
                type={visorType}
            />
        </>
    );
}
