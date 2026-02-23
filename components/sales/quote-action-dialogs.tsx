"use client";

import { Box, Copy, FileEdit, FolderPlus, Loader2, Printer, Trash2, XCircle } from "lucide-react";
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
    onConvert
}: {
    quote: QuoteSummary | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    projectNameInput: string;
    setProjectNameInput: (val: string) => void;
    convertingId: string | null;
    onConvert: () => void;
}) {
    if (!quote) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-green-500 font-bold uppercase flex items-center gap-2">
                        <FolderPlus className="w-5 h-5" />
                        Convertir a Proyecto
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Define el nombre del nuevo proyecto basado en la cotización <span className="text-red-500 font-bold">COT-{quote.quote_number}</span> para <span className="font-bold">{quote.client?.name}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            Nombre del Proyecto <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="EJ. MOLDE DE INYECCIÓN - PROYECTO X"
                            value={projectNameInput}
                            onChange={(e) => setProjectNameInput(e.target.value.toUpperCase())}
                            className="bg-background border-border focus:border-green-500 transition-colors uppercase font-bold"
                            autoFocus
                        />
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-2 text-xs">
                        <p className="font-bold text-muted-foreground uppercase">Este proceso realizará:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Generación automática de folio de proyecto.</li>
                            <li>Migración de partidas a producción.</li>
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
        </Dialog>
    );
}
