"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { extractDriveFileId } from "@/lib/drive-utils";
import { FileText, ZoomIn, ZoomOut, Maximize, X, RotateCw, Download, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef } from "react";
import { Box, Maximize2, AlertTriangle, RotateCcw } from "lucide-react";

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'model-viewer': any;
        }
    }
}

interface DrawingViewerProps {
    url: string | null;
    onClose: () => void;
    title?: string;
    /** 
     * Force the viewer to treat the URL as an image, PDF or 3D model.
     * If not provided, it will attempt to detect based on the URL string.
     */
    type?: "image" | "pdf" | "3d";
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
}

export interface DrawingContentProps {
    url: string;
    title?: string;
    type?: "image" | "pdf" | "3d";
    onClose?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    isInline?: boolean;
}

export function DrawingViewerContent({
    url,
    title = "Visor de Plano",
    type,
    onClose,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
    isInline = false
}: DrawingContentProps) {
    const { theme } = useTheme();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [resetKey, setResetKey] = useState(0);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [zoomPercent, setZoomPercent] = useState(100);
    const viewerRef = useRef<any>(null);

    const INITIAL_ORBIT = "0deg 75deg 105%";

    useEffect(() => {
        if (!url) return;
        setLoadError(false);
        setZoomPercent(100);

        if (!document.querySelector('script[src*="model-viewer"]')) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
            script.onload = () => setScriptLoaded(true);
            document.head.appendChild(script);
        } else {
            setScriptLoaded(true);
        }
    }, [url]);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const handleError = (error: any) => {
            console.error("3D Model loading error:", error);
            setLoadError(true);
        };

        viewer.addEventListener('error', handleError);
        return () => {
            viewer.removeEventListener('error', handleError);
        };
    }, [scriptLoaded, url]);

    // 1. Process Google Drive URLs (convert to /preview)
    const driveId = extractDriveFileId(url);
    const isDrive = !!driveId;
    const finalUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : url;

    const cleanUrl = finalUrl.split('#')[0];

    // 2. Logic to detect if it's an image
    const isImage = type === "image" || (!type && (
        cleanUrl.toLowerCase().endsWith('.jpg') ||
        cleanUrl.toLowerCase().endsWith('.jpeg') ||
        cleanUrl.toLowerCase().endsWith('.png') ||
        cleanUrl.toLowerCase().endsWith('.gif') ||
        cleanUrl.toLowerCase().endsWith('.webp') ||
        url.includes('/public/partidas/items/') ||
        (url.startsWith('blob:') && !url.includes('#pdf'))
    ));

    // 3. Logic to detect if it's a 3D model
    const is3D = type === "3d" || (!type && (
        cleanUrl.toLowerCase().endsWith('.glb') ||
        cleanUrl.toLowerCase().endsWith('.gltf')
    ));

    // 4. Logic to detect if it's a "Page/PDF" viewer (iframe)
    const isIframeViewer = !is3D && (type === "pdf" || (!isImage && (
        isDrive ||
        cleanUrl.toLowerCase().endsWith('.pdf') ||
        url.includes('#pdf')
    )));

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);
    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setResetKey(prev => prev + 1);
    };

    const handlePrint = () => {
        const printWindow = window.open(cleanUrl, '_blank');
        if (printWindow) {
            printWindow.addEventListener('load', () => {
                printWindow.print();
            }, true);
        }
    };

    const containerClasses = isInline
        ? "flex flex-col w-full h-full bg-background overflow-hidden"
        : "max-w-none w-screen h-screen p-0 gap-0 overflow-hidden bg-background border-none flex flex-col rounded-none";

    return (
        <div className={containerClasses}>
            <div className="p-4 border-b border-border bg-background/80 backdrop-blur-xl flex flex-row items-center justify-between space-y-0 sticky top-0 z-[100]">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        {is3D ? <Box className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-sm font-black truncate uppercase tracking-tight leading-none mb-1">
                            {title}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-medium truncate opacity-70">
                            {is3D ? "Modelo 3D Interactivo • GLB/GLTF" : (isImage ? "Vista de Imagen (Herramientas de Zoom activas)" : (isDrive ? "Visor de Google Drive" : "Documento PDF"))}
                        </p>
                    </div>
                </div>

                {/* Navigation Controls */}
                {(onNext || onPrevious) && (
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border mx-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrevious}
                            disabled={!hasPrevious}
                            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            disabled={!hasNext}
                            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                <div className="flex items-center gap-1 sm:gap-2">
                    {(isImage || is3D) && (
                        <div className="flex items-center bg-muted/50 rounded-lg px-1 sm:px-2 border border-border mr-2">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            viewerRef.current.zoom(-1);
                                            setZoomPercent(prev => Math.max(25, prev - 25));
                                        }
                                    } else {
                                        handleZoomOut();
                                    }
                                }} 
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground w-10 sm:w-12 text-center select-none">
                                {is3D ? `${zoomPercent}%` : `${Math.round(zoom * 100)}%`}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            viewerRef.current.zoom(1);
                                            setZoomPercent(prev => Math.min(500, prev + 25));
                                        }
                                    } else {
                                        handleZoomIn();
                                    }
                                }} 
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            const orbit = viewerRef.current.getCameraOrbit();
                                            const newTheta = orbit.theta + (Math.PI / 2);
                                            viewerRef.current.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
                                        }
                                    } else {
                                        handleRotate();
                                    }
                                }} 
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            viewerRef.current.cameraOrbit = INITIAL_ORBIT;
                                            viewerRef.current.fieldOfView = "auto";
                                            setZoomPercent(100);
                                        }
                                    } else {
                                        handleReset();
                                    }
                                }} 
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                            >
                                <Maximize className="w-3.5 h-3.5" />
                            </Button>
                            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                            {!is3D && (
                                <>
                                    <Button variant="ghost" size="icon" onClick={handlePrint} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground">
                                        <Printer className="w-3.5 h-3.5" />
                                    </Button>
                                    <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                                </>
                            )}
                            <a href={cleanUrl} download className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                                <Download className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    )}
                    {onClose && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={onClose}
                            className="h-7 w-7 sm:h-8 sm:w-8 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                        >
                            <X className="w-4 h-4 sm:w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex-1 w-full relative bg-background overflow-hidden flex items-center justify-center">
                {loadError ? (
                    <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold uppercase tracking-tight">Error al cargar el archivo</h3>
                            <p className="text-muted-foreground text-sm">
                                Parece que el archivo es inválido o no se puede procesar.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 border-border"
                            onClick={() => {
                                setLoadError(false);
                                if (onClose) onClose();
                            }}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Cerrar y reintentar
                        </Button>
                    </div>
                ) : is3D ? (
                    scriptLoaded ? (
                        <div className="w-full h-full relative">
                            <model-viewer
                                ref={viewerRef}
                                src={url}
                                alt={`Modelo 3D de ${title}`}
                                auto-rotate
                                camera-controls
                                shadow-intensity="1.5"
                                environment-image="neutral"
                                exposure="1.2"
                                interaction-prompt="none"
                                style={{ width: '100%', height: '100%', outline: 'none' }}
                                className="w-full h-full"
                                camera-orbit={INITIAL_ORBIT}
                                touch-action="none"
                                interpolation-decay="200"
                            >
                                <div slot="progress-bar" className="bg-[#EC1C21] h-1" />
                            </model-viewer>
                            {/* Instruction Overlay */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/50 backdrop-blur-md border border-border rounded-full text-[10px] text-muted-foreground uppercase font-medium pointer-events-none flex items-center gap-4 z-10 transition-opacity animate-in fade-in duration-500">
                                <span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3" /> Arrastra para rotar</span>
                                <span className="flex items-center gap-1.5"><Maximize2 className="w-3 h-3" /> Scroll para zoom</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="w-8 h-8 border-4 border-muted border-t-[#EC1C21] rounded-full animate-spin" />
                            <p className="text-sm font-medium">Cargando visor 3D...</p>
                        </div>
                    )
                ) : isIframeViewer ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                        <iframe
                            src={finalUrl}
                            className="w-full h-full border-none"
                            title="Visor de Archivo"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-4 sm:p-8">
                        <motion.div
                            key={resetKey}
                            drag
                            dragMomentum={false}
                            animate={{ scale: zoom, rotate: rotation }}
                            transition={{ type: "spring", damping: 30, stiffness: 200 }}
                            className="cursor-grab active:cursor-grabbing flex items-center justify-center origin-center"
                        >
                            <img
                                src={cleanUrl}
                                alt="Plano"
                                className="max-w-full max-h-full object-contain shadow-2xl pointer-events-none select-none rounded-lg"
                                style={{ maxHeight: '90vh' }}
                            />
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function DrawingViewer({
    url,
    onClose,
    title,
    type,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious
}: DrawingViewerProps) {
    if (!url) return null;

    return (
        <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 overflow-hidden bg-background border-none flex flex-col rounded-none">
                <DrawingViewerContent
                    url={url}
                    title={title}
                    type={type}
                    onClose={onClose}
                    onNext={onNext}
                    onPrevious={onPrevious}
                    hasNext={hasNext}
                    hasPrevious={hasPrevious}
                />
            </DialogContent>
        </Dialog>
    );
}
