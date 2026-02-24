"use client";

import { useState } from "react";

import { Box, Copy, FileEdit, FolderPlus, Loader2, Printer, Trash2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DrawingViewer } from "./drawing-viewer";

interface QuoteSummary {
    id: string;
    quote_number: number;
    issue_date: string;
    total: number;
    currency: string;
    status: string;
    quote_type: "services" | "pieces";
    client: { name: string };
    contact: { name: string };
}

// ----------------------------------------------------------------------
// Diálogo de Borrado (Invalidación de Folio)
// ----------------------------------------------------------------------
export function DeleteQuoteDialog({
    quote,
    isOpen,
    onOpenChange,
    deleteReason,
    setDeleteReason,
    isDeleting,
    onDelete
}: {
    quote: QuoteSummary | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    deleteReason: string;
    setDeleteReason: (val: string) => void;
    isDeleting: boolean;
    onDelete: (id: string) => void;
}) {
    if (!quote) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-red-500 font-bold uppercase">
                        Borrar Cotización COT-{quote.quote_number}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Esta acción invalidará el folio permanentemente. Debes proporcionar una razón para este fallo.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Razón del Borrado</label>
                    <Textarea
                        placeholder="EJ. ERROR EN PRECIOS, CLIENTE CANCELÓ, ETC..."
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value.toUpperCase())}
                        className="bg-background border-border uppercase text-sm"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" className="hover:bg-muted font-bold text-xs" onClick={() => {
                        setDeleteReason("");
                        onOpenChange(false);
                    }}>CANCELAR</Button>
                    <Button
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 font-bold text-xs"
                        disabled={isDeleting || !deleteReason.trim()}
                        onClick={() => onDelete(quote.id)}
                    >
                        {isDeleting ? "BORRANDO..." : "CONFIRMAR BORRADO"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ----------------------------------------------------------------------
// Diálogo de Cancelación de Cotización
// ----------------------------------------------------------------------
export function CancelQuoteDialog({
    quote,
    isOpen,
    onOpenChange,
    onCancel
}: {
    quote: QuoteSummary | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel: (id: string) => void;
}) {
    if (!quote) return null;

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-500 font-bold uppercase">¿Cancelar Cotización COT-{quote.quote_number}?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                        Esta acción marcará la cotización como CANCELADA. Podrás seguir viéndola en el historial filtrando por este estado.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="bg-muted hover:bg-muted font-bold text-xs" onClick={() => onOpenChange(false)}>VOLVER</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                        onClick={() => onCancel(quote.id)}
                    >
                        CONFIRMAR CANCELACIÓN
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ----------------------------------------------------------------------
// Diálogo de Conversión a Proyecto
// ----------------------------------------------------------------------
export function ConvertQuoteDialog({
    quote,
    isOpen,
    onOpenChange,
    projectNameInput,
    setProjectNameInput,
    convertingId,
    onConvert,
    quoteItems, // NEW PROP
    partNames, // NEW PROP
    setPartNames // NEW PROP
}: {
    quote: QuoteSummary | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    projectNameInput: string;
    setProjectNameInput: (val: string) => void;
    convertingId: string | null;
    onConvert: () => void;
    quoteItems: any[]; // NEW
    partNames: Record<string, string>; // NEW
    setPartNames: (val: Record<string, string>) => void; // NEW
}) {
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);

    if (!quote) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-green-500 font-bold uppercase flex items-center gap-2">
                        <FolderPlus className="w-5 h-5" />
                        Convertir a Proyecto
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Define el nombre del nuevo proyecto basado en la cotización <span className="text-red-500 font-bold">COT-{quote.quote_number}</span> para <span className="font-bold">{quote.client?.name}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            Nombre del Proyecto <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="EJ. MOLDE DE INYECCIÓN - PROYECTO X"
                            value={projectNameInput}
                            onChange={(e) => setProjectNameInput(e.target.value.toUpperCase())}
                            className="bg-background border-border flex-1 uppercase font-bold text-sm"
                            autoFocus
                        />
                    </div>

                    {quoteItems.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 border-b border-border pb-1">
                                Nombrar Partidas de Producción
                            </label>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 rounded-md border border-border/50 p-3 bg-muted/10">
                                {quoteItems.map((item, index) => (
                                    <div key={item.id} className="flex gap-3 items-start">
                                        <div className="flex-none flex items-center justify-center w-7 h-7 text-xs font-bold text-muted-foreground bg-background rounded-md border border-border mt-1 transition-colors">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground line-clamp-1 italic mr-2" title={item.description}>
                                                    Original: {item.description}
                                                </span>
                                                {item.drawing_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewerUrl(item.drawing_url)}
                                                        className="flex-none flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 font-bold uppercase transition-colors bg-transparent border-none p-0 cursor-pointer"
                                                        title="Ver plano en visor interno"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Ver Plano
                                                    </button>
                                                )}
                                            </div>
                                            <Input
                                                placeholder="NOMBRE DE PARTIDA EN PRODUCCIÓN"
                                                value={partNames[item.id] || ""}
                                                onChange={(e) => setPartNames({ ...partNames, [item.id]: e.target.value.toUpperCase() })}
                                                className="bg-background border-border text-xs uppercase font-bold focus:border-green-500 transition-colors h-8"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-1 text-xs">
                        <p className="font-bold text-muted-foreground uppercase">Este proceso realizará:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li>Generación automática de folio de proyecto.</li>
                            <li>Migración de partidas a producción con los nombres especificados.</li>
                            <li>Marca la cotización como <span className="text-green-500 font-bold">APROBADA</span>.</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        className="hover:bg-muted font-bold text-xs"
                        onClick={() => onOpenChange(false)}
                    >
                        CANCELAR
                    </Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-8"
                        disabled={convertingId !== null || !projectNameInput.trim()}
                        onClick={onConvert}
                    >
                        {convertingId ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                CONVIRTIENDO...
                            </>
                        ) : (
                            "CONFIRMAR CONVERSIÓN"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <DrawingViewer
                url={viewerUrl}
                onClose={() => setViewerUrl(null)}
            />
        </Dialog>
    );
}
