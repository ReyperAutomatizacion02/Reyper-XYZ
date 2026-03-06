"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Maximize2, RotateCcw, AlertTriangle, Box, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Separator } from "@/components/ui/separator";

// Implementation note: model-viewer is a web component
// We use 'auto auto auto' for orbit to avoid strict limits, 
// though phi is naturally limited by the component to prevent flipping.
// To allow "360 in all directions" we ensure camera-controls is active.

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'model-viewer': any;
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
    hasPrevious
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

        viewer.addEventListener('error', handleError);
        return () => {
            viewer.removeEventListener('error', handleError);
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
            <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 overflow-hidden bg-background border-none flex flex-col rounded-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 transition-all duration-500">
                <DialogHeader className="p-4 border-b border-border bg-background/80 backdrop-blur-xl flex flex-row items-center justify-between space-y-0 sticky top-0 z-[100]">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                            <Box className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <DialogTitle className="text-sm font-black truncate uppercase tracking-tight leading-none mb-1">
                                {title}
                            </DialogTitle>
                            <p className="text-[10px] text-muted-foreground font-medium truncate opacity-70">
                                Visor 3D Interactivo • GLB/GLTF
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
                                title="Anterior"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onNext}
                                disabled={!hasNext}
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                title="Siguiente"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* 3D Tools Grid - Consistent with DrawingViewer */}
                        <div className="flex items-center bg-muted/50 rounded-lg px-1 sm:px-2 border border-border mr-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        viewerRef.current.zoom(-1);
                                        // Approximate zoom tracking for UI
                                        setZoomPercent(prev => Math.max(25, prev - 25));
                                    }
                                }}
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground w-10 sm:w-12 text-center select-none">
                                {zoomPercent}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        viewerRef.current.zoom(1);
                                        setZoomPercent(prev => Math.min(500, prev + 25));
                                    }
                                }}
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (viewerRef.current) {
                                        const orbit = viewerRef.current.getCameraOrbit();
                                        // Force horizontal rotation by 90 degrees
                                        const newTheta = orbit.theta + (Math.PI / 2);
                                        viewerRef.current.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
                                    }
                                }}
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                title="Rotar 90°"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
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
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                title="Resetear Cámara"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </Button>
                            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDownload}
                                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                title="Descargar"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={onClose}
                            className="h-7 w-7 sm:h-8 sm:w-8 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                            title="Cerrar"
                        >
                            <X className="w-4 h-4 sm:w-5 h-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 relative bg-background overflow-hidden flex items-center justify-center">
                    {loadError ? (
                        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold uppercase tracking-tight">Error al cargar el modelo</h3>
                                <p className="text-muted-foreground text-sm">
                                    Parece que el archivo es inválido o le faltan dependencias.
                                </p>
                                <div className="bg-muted/50 border border-border p-3 rounded-lg mt-4 text-left">
                                    <p className="text-[#EC1C21] text-[11px] font-bold uppercase leading-relaxed">
                                        💡 Recomendación: Usa el formato .GLB
                                    </p>
                                    <p className="text-muted-foreground text-[10px] mt-1">
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
                                <RotateCcw className="w-4 h-4 mr-2" />
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
                            style={{ width: '100%', height: '100%', outline: 'none' }}
                            className="w-full h-full"
                            camera-orbit={INITIAL_ORBIT}
                            touch-action="none"
                            interpolation-decay="200"
                        >
                            <div slot="progress-bar" className="bg-[#EC1C21] h-1" />
                        </model-viewer>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="w-8 h-8 border-4 border-muted border-t-[#EC1C21] rounded-full animate-spin" />
                            <p className="text-sm font-medium">Cargando visor 3D...</p>
                        </div>
                    )}

                    {/* Instruction Overlay matching standard viewer */}
                    {!loadError && scriptLoaded && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/50 backdrop-blur-md border border-border rounded-full text-[10px] text-muted-foreground uppercase font-medium pointer-events-none flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3" /> Arrastra para rotar</span>
                            <span className="flex items-center gap-1.5"><Maximize2 className="w-3 h-3" /> Scroll para zoom</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

