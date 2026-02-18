"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { FileText, ZoomIn, ZoomOut, Maximize, X, RotateCw, Download, Printer } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface DrawingViewerProps {
    url: string | null;
    onClose: () => void;
    title?: string;
    /** 
     * Force the viewer to treat the URL as an image or PDF.
     * If not provided, it will attempt to detect based on the URL string.
     */
    type?: "image" | "pdf";
}

export function DrawingViewer({ url, onClose, title = "Visor de Plano", type }: DrawingViewerProps) {
    if (!url) return null;
    const { theme } = useTheme();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [resetKey, setResetKey] = useState(0);

    const cleanUrl = url.split('#')[0];

    const isPdf = type === "pdf" || (!type && (
        cleanUrl.toLowerCase().endsWith('.pdf') ||
        url.includes('#pdf')
    ));

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

    return (
        <Dialog open={!!url} onOpenChange={(open) => {
            if (!open) {
                handleReset();
                onClose();
            }
        }}>
            <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 overflow-hidden bg-background border-none flex flex-col rounded-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
                <DialogHeader className="p-4 border-b border-border bg-background/80 backdrop-blur-xl flex flex-row items-center justify-between space-y-0 sticky top-0 z-[100]">
                    <DialogTitle className="text-foreground flex items-center gap-3 text-sm uppercase font-black tracking-widest">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="truncate max-w-[200px] sm:max-w-md">{title}</span>
                    </DialogTitle>
                    <div className="flex items-center gap-1 sm:gap-2">
                        {!isPdf && (
                            <div className="flex items-center bg-muted/50 rounded-lg px-1 sm:px-2 border border-border mr-2">
                                <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" title="Zoom Out">
                                    <ZoomOut className="w-4 h-4" />
                                </Button>
                                <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground w-10 sm:w-12 text-center select-none">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" title="Zoom In">
                                    <ZoomIn className="w-4 h-4" />
                                </Button>
                                <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                                <Button variant="ghost" size="icon" onClick={handleRotate} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" title="Rotar">
                                    <RotateCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleReset} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" title="Ajustar">
                                    <Maximize className="w-3.5 h-3.5" />
                                </Button>
                                <Separator orientation="vertical" className="h-4 bg-border mx-0.5 sm:mx-1" />
                                <Button variant="ghost" size="icon" onClick={handlePrint} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" title="Imprimir">
                                    <Printer className="w-3.5 h-3.5" />
                                </Button>
                                <a href={cleanUrl} download title="Descargar" className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                                    <Download className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        )}
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
                <div className="flex-1 w-full relative bg-background overflow-hidden flex items-center justify-center">
                    {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                            <iframe
                                src={url.startsWith('blob:') ? cleanUrl : cleanUrl}
                                className="w-full h-full border-none shadow-2xl"
                                title="Visor de Archivo"
                                style={{
                                    minHeight: '100%',
                                    width: '100%'
                                }}
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
                                    style={{
                                        width: 'auto',
                                        height: 'auto',
                                        maxHeight: '90vh'
                                    }}
                                />
                            </motion.div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/50 backdrop-blur-md border border-border rounded-full text-[10px] text-muted-foreground uppercase font-medium pointer-events-none">
                                Usa el mouse para arrastrar • Herramientas en encabezado
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
