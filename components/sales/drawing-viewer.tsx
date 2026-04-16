"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { extractDriveFileId } from "@/lib/drive-utils";
import {
    FileText,
    ZoomIn,
    ZoomOut,
    Maximize,
    X,
    RotateCw,
    Download,
    Printer,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useRef } from "react";
import { Box, Maximize2, AlertTriangle, RotateCcw } from "lucide-react";

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "model-viewer": any;
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
    isInline = false,
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

        viewer.addEventListener("error", handleError);
        return () => {
            viewer.removeEventListener("error", handleError);
        };
    }, [scriptLoaded, url]);

    // 1. Process Google Drive URLs (convert to /preview)
    const driveId = extractDriveFileId(url);
    const isDrive = !!driveId;
    const finalUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : url;

    const cleanUrl = finalUrl.split("#")[0];

    // 2. Logic to detect if it's an image
    const isImage =
        type === "image" ||
        (!type &&
            (cleanUrl.toLowerCase().endsWith(".jpg") ||
                cleanUrl.toLowerCase().endsWith(".jpeg") ||
                cleanUrl.toLowerCase().endsWith(".png") ||
                cleanUrl.toLowerCase().endsWith(".gif") ||
                cleanUrl.toLowerCase().endsWith(".webp") ||
                url.includes("/public/partidas/items/") ||
                (url.startsWith("blob:") && !url.includes("#pdf"))));

    // 3. Logic to detect if it's a 3D model
    const is3D =
        type === "3d" ||
        (!type && (cleanUrl.toLowerCase().endsWith(".glb") || cleanUrl.toLowerCase().endsWith(".gltf")));

    // 4. Logic to detect if it's a "Page/PDF" viewer (iframe)
    const isIframeViewer =
        !is3D &&
        (type === "pdf" || (!isImage && (isDrive || cleanUrl.toLowerCase().endsWith(".pdf") || url.includes("#pdf"))));

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 5));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setResetKey((prev) => prev + 1);
    };

    const handlePrint = () => {
        const printWindow = window.open(cleanUrl, "_blank");
        if (printWindow) {
            printWindow.addEventListener(
                "load",
                () => {
                    printWindow.print();
                },
                true
            );
        }
    };

    const containerClasses = isInline
        ? "flex flex-col w-full h-full bg-background overflow-hidden"
        : "max-w-none w-screen h-screen p-0 gap-0 overflow-hidden bg-background border-none flex flex-col rounded-none";

    return (
        <div className={containerClasses}>
            <div className="sticky top-0 z-dropdown flex flex-row items-center justify-between space-y-0 border-b border-border bg-background/80 p-4 backdrop-blur-xl">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                        {is3D ? (
                            <Box className="h-4 w-4 text-red-500" />
                        ) : (
                            <FileText className="h-4 w-4 text-red-500" />
                        )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <h3 className="mb-1 truncate text-sm font-black uppercase leading-none tracking-tight">
                            {title}
                        </h3>
                        <p className="truncate text-[10px] font-medium text-muted-foreground opacity-70">
                            {is3D
                                ? "Modelo 3D Interactivo • GLB/GLTF"
                                : isImage
                                  ? "Vista de Imagen (Herramientas de Zoom activas)"
                                  : isDrive
                                    ? "Visor de Google Drive"
                                    : "Documento PDF"}
                        </p>
                    </div>
                </div>

                {/* Navigation Controls */}
                {(onNext || onPrevious) && (
                    <div className="mx-2 flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrevious}
                            disabled={!hasPrevious}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:h-8 sm:w-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            disabled={!hasNext}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:h-8 sm:w-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <div className="flex items-center gap-1 sm:gap-2">
                    {(isImage || is3D) && (
                        <div className="mr-2 flex items-center rounded-lg border border-border bg-muted/50 px-1 sm:px-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            viewerRef.current.zoom(-1);
                                            setZoomPercent((prev) => Math.max(25, prev - 25));
                                        }
                                    } else {
                                        handleZoomOut();
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="w-10 select-none text-center font-mono text-[9px] text-muted-foreground sm:w-12 sm:text-[10px]">
                                {is3D ? `${zoomPercent}%` : `${Math.round(zoom * 100)}%`}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            viewerRef.current.zoom(1);
                                            setZoomPercent((prev) => Math.min(500, prev + 25));
                                        }
                                    } else {
                                        handleZoomIn();
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Separator orientation="vertical" className="mx-0.5 h-4 bg-border sm:mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (is3D) {
                                        if (viewerRef.current) {
                                            const orbit = viewerRef.current.getCameraOrbit();
                                            const newTheta = orbit.theta + Math.PI / 2;
                                            viewerRef.current.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
                                        }
                                    } else {
                                        handleRotate();
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                            >
                                <RotateCw className="h-3.5 w-3.5" />
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
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                            >
                                <Maximize className="h-3.5 w-3.5" />
                            </Button>
                            <Separator orientation="vertical" className="mx-0.5 h-4 bg-border sm:mx-1" />
                            {!is3D && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handlePrint}
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </Button>
                                    <Separator orientation="vertical" className="mx-0.5 h-4 bg-border sm:mx-1" />
                                </>
                            )}
                            <a
                                href={cleanUrl}
                                download
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:h-8 sm:w-8"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    )}
                    {onClose && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={onClose}
                            className="h-7 w-7 rounded-lg bg-red-600 text-white shadow-lg hover:bg-red-700 sm:h-8 sm:w-8"
                        >
                            <X className="h-4 h-5 w-4 sm:w-5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-background">
                {loadError ? (
                    <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold uppercase tracking-tight">Error al cargar el archivo</h3>
                            <p className="text-sm text-muted-foreground">
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
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Cerrar y reintentar
                        </Button>
                    </div>
                ) : is3D ? (
                    scriptLoaded ? (
                        <div className="relative h-full w-full">
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
                                style={{ width: "100%", height: "100%", outline: "none" }}
                                className="h-full w-full"
                                camera-orbit={INITIAL_ORBIT}
                                touch-action="none"
                                interpolation-decay="200"
                            >
                                <div slot="progress-bar" className="h-1 bg-brand" />
                            </model-viewer>
                            {/* Instruction Overlay */}
                            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-background/50 px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground backdrop-blur-md transition-opacity duration-500 animate-in fade-in">
                                <span className="flex items-center gap-1.5">
                                    <RotateCcw className="h-3 w-3" /> Arrastra para rotar
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Maximize2 className="h-3 w-3" /> Scroll para zoom
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-brand" />
                            <p className="text-sm font-medium">Cargando visor 3D...</p>
                        </div>
                    )
                ) : isIframeViewer ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-muted">
                        <iframe src={finalUrl} className="h-full w-full border-none" title="Visor de Archivo" />
                    </div>
                ) : (
                    <div className="flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-8">
                        <motion.div
                            key={resetKey}
                            drag
                            dragMomentum={false}
                            animate={{ scale: zoom, rotate: rotation }}
                            transition={{ type: "spring", damping: 30, stiffness: 200 }}
                            className="flex origin-center cursor-grab items-center justify-center active:cursor-grabbing"
                        >
                            <img
                                src={cleanUrl}
                                alt="Plano"
                                className="pointer-events-none max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
                                style={{ maxHeight: "90vh" }}
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
    hasPrevious,
}: DrawingViewerProps) {
    if (!url) return null;

    return (
        <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex h-screen w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-none bg-background p-0">
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
