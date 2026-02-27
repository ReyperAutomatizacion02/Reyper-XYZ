"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Maximize2, RotateCcw, AlertTriangle } from "lucide-react";
import { useEffect, useState, useRef } from "react";

// Declaration for model-viewer custom element
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
}

export function ModelViewerModal({ isOpen, onClose, url, title }: ModelViewerModalProps) {
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [loadError, setLoadError] = useState<boolean>(false);
    const viewerRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;

        setLoadError(false);

        // Load model-viewer script if not already present
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
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-0 overflow-hidden flex flex-col gap-0 border-none bg-slate-950">
                <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                        <DialogTitle className="text-white text-lg font-bold uppercase tracking-tight">
                            Visor 3D: {title}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Interactúa con el modelo usando el ratón para rotar y zoom.
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-slate-400 hover:text-white h-8 w-8"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 flex items-center justify-center">
                    {loadError ? (
                        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-white font-bold uppercase tracking-tight">Error al cargar el modelo</h3>
                                <p className="text-slate-400 text-sm">
                                    Parece que el archivo es inválido o le faltan dependencias (como archivos .bin).
                                </p>
                                <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg mt-4">
                                    <p className="text-[#EC1C21] text-[11px] font-bold uppercase leading-relaxed">
                                        💡 Recomendación: Usa el formato .GLB
                                    </p>
                                    <p className="text-slate-500 text-[10px] mt-1">
                                        El formato .glb es auto-contenido y funciona mejor en la web.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                    setLoadError(false);
                                    // Hack to retry
                                    const currentUrl = url;
                                    onClose();
                                    setTimeout(() => {
                                        // User would have to reopen manually or we could trigger it, 
                                        // but manual is safer for state.
                                    }, 100);
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
                            shadow-intensity="1"
                            environment-image="neutral"
                            exposure="1"
                            interaction-prompt="auto"
                            style={{ width: '100%', height: '100%', outline: 'none' }}
                            className="w-full h-full"
                        >
                            <div slot="progress-bar" className="bg-[#EC1C21] h-1" />
                        </model-viewer>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-700 border-t-[#EC1C21] rounded-full animate-spin" />
                            <p className="text-sm font-medium">Cargando visor 3D...</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-center gap-8">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        <Maximize2 className="w-3 h-3" /> Scroll para Zoom
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        <RotateCcw className="w-3 h-3" /> Click y arrastra para Rotar
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

