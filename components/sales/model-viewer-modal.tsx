"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    X,
    Download,
    Maximize2,
    RotateCcw,
    AlertTriangle,
    Box,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Separator } from "@/components/ui/separator";

// Implementation note: model-viewer is a web component
// We use 'auto auto auto' for orbit to avoid strict limits,
// though phi is naturally limited by the component to prevent flipping.
// To allow "360 in all directions" we ensure camera-controls is active.

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "model-viewer": any;
        }
    }
}

interface ModelViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
}

export function ModelViewerModal({
    isOpen,
    onClose,
    url,
    title,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
}: ModelViewerModalProps) {
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [loadError, setLoadError] = useState<boolean>(false);
    const viewerRef = useRef<any>(null);
    const [zoomPercent, setZoomPercent] = useState(100);

    // Initial state for rotation/zoom
    const INITIAL_ORBIT = "0deg 75deg 105%";

    useEffect(() => {
        if (!isOpen) return;
        setZoomPercent(100);
        setLoadError(false);

        if (!document.querySelector('script[src*="model-viewer"]')) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
            script.onload = () => setScriptLoaded(true);
            document.head.appendChild(script);
        } else {
            setScriptLoaded(true);
        }
    }, [isOpen]);

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
    }, [scriptLoaded, isOpen]);

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title.replace(/\s+/g, "_")}.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex h-screen w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-none bg-background p-0 transition-all duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                <DialogHeader className="sticky top-0 z-dropdown flex flex-row items-center justify-between space-y-0 border-b border-border bg-background/80 p-4 backdrop-blur-xl">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                            <Box className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <DialogTitle className="mb-1 truncate text-sm font-black uppercase leading-none tracking-tight">
                                {title}
                            </DialogTitle>
                            <p className="truncate text-[10px] font-medium text-muted-foreground opacity-70">
                                Visor 3D Interactivo • GLB/GLTF
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
                                title="Anterior"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onNext}
                                disabled={!hasNext}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:h-8 sm:w-8"
                                title="Siguiente"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* 3D Tools Grid - Consistent with DrawingViewer */}
                        <div className="mr-2 flex items-center rounded-lg border border-border bg-muted/50 px-1 sm:px-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        viewerRef.current.zoom(-1);
                                        // Approximate zoom tracking for UI
                                        setZoomPercent((prev) => Math.max(25, prev - 25));
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                title="Zoom Out"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="w-10 select-none text-center font-mono text-[9px] text-muted-foreground sm:w-12 sm:text-[10px]">
                                {zoomPercent}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        viewerRef.current.zoom(1);
                                        setZoomPercent((prev) => Math.min(500, prev + 25));
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                title="Zoom In"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Separator orientation="vertical" className="mx-0.5 h-4 bg-border sm:mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        const orbit = viewerRef.current.getCameraOrbit();
                                        // Force horizontal rotation by 90 degrees
                                        const newTheta = orbit.theta + Math.PI / 2;
                                        viewerRef.current.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                title="Rotar 90°"
                            >
                                <RotateCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        viewerRef.current.cameraOrbit = INITIAL_ORBIT;
                                        viewerRef.current.fieldOfView = "auto";
                                        setZoomPercent(100);
                                    }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                title="Resetear Cámara"
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                            <Separator orientation="vertical" className="mx-0.5 h-4 bg-border sm:mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDownload}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                                title="Descargar"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={onClose}
                            className="h-7 w-7 rounded-lg bg-red-600 text-white shadow-lg hover:bg-red-700 sm:h-8 sm:w-8"
                            title="Cerrar"
                        >
                            <X className="h-4 h-5 w-4 sm:w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
                    {loadError ? (
                        <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold uppercase tracking-tight">Error al cargar el modelo</h3>
                                <p className="text-sm text-muted-foreground">
                                    Parece que el archivo es inválido o le faltan dependencias.
                                </p>
                                <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-left">
                                    <p className="text-[11px] font-bold uppercase leading-relaxed text-brand">
                                        💡 Recomendación: Usa el formato .GLB
                                    </p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                        El formato .glb es auto-contenido y funciona mejor en la web.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-4 border-border"
                                onClick={() => {
                                    setLoadError(false);
                                    onClose();
                                }}
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Cerrar y reintentar
                            </Button>
                        </div>
                    ) : scriptLoaded ? (
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
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-brand" />
                            <p className="text-sm font-medium">Cargando visor 3D...</p>
                        </div>
                    )}

                    {/* Instruction Overlay matching standard viewer */}
                    {!loadError && scriptLoaded && (
                        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-background/50 px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground backdrop-blur-md">
                            <span className="flex items-center gap-1.5">
                                <RotateCcw className="h-3 w-3" /> Arrastra para rotar
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Maximize2 className="h-3 w-3" /> Scroll para zoom
                            </span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
