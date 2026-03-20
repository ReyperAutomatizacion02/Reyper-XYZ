"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
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

interface ConfirmationDialogsProps {
    idToClearEval: string | null;
    onClearEvalCancel: () => void;
    onClearEvalConfirm: (orderId: string) => void;
    isDiscardConfirmOpen: boolean;
    onDiscardCancel: (open: boolean) => void;
    onDiscardConfirm: () => void;
    container?: HTMLDivElement | null;
}

export function ConfirmationDialogs({
    idToClearEval,
    onClearEvalCancel,
    onClearEvalConfirm,
    isDiscardConfirmOpen,
    onDiscardCancel,
    onDiscardConfirm,
    container,
}: ConfirmationDialogsProps) {
    return (
        <>
            {/* Clear Evaluation Confirmation */}
            <AlertDialog open={!!idToClearEval} onOpenChange={(open) => !open && onClearEvalCancel()}>
                <AlertDialogContent container={container} className="z-[10003]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Limpiar Evaluación
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas limpiar la evaluación de esta pieza? Volverá a aparecer en la lista de &apos;Por Evaluar&apos; y se quitará de la planeación actual.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => idToClearEval && onClearEvalConfirm(idToClearEval)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Limpiar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Discard Changes Confirmation */}
            <AlertDialog open={isDiscardConfirmOpen} onOpenChange={onDiscardCancel}>
                <AlertDialogContent container={container} className="z-[10003]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-primary" />
                            Descartar Cambios
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas descartar todos los cambios no guardados? Esta acción revertirá el Gantt a su último estado guardado y no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Continuar Editando</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onDiscardConfirm}
                            className="bg-primary hover:bg-primary/90 text-white"
                        >
                            Descartar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
