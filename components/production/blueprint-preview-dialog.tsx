"use client";

import React from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface BlueprintPreviewDialogProps {
    fileId: string | null;
    onClose: () => void;
    container?: HTMLDivElement | null;
}

export function BlueprintPreviewDialog({ fileId, onClose, container }: BlueprintPreviewDialogProps) {
    return (
        <Dialog open={!!fileId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                container={container}
                className="z-popover h-[90vh] max-w-5xl overflow-hidden rounded-2xl border-none bg-background p-0 shadow-2xl"
            >
                <div className="relative flex h-full w-full flex-col">
                    <div className="flex items-center justify-between border-b border-border bg-muted/10 p-4">
                        <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                            <FileText className="h-4 w-4 text-primary" />
                            Vista Previa de Plano
                        </DialogTitle>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(`https://drive.google.com/file/d/${fileId}/view`, "_blank")}
                                title="Abrir en pestaña nueva"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-muted/5">
                        {fileId && (
                            <iframe
                                src={`https://drive.google.com/file/d/${fileId}/preview`}
                                className="h-full w-full border-none"
                                allow="autoplay"
                                title="Blueprint Preview"
                            ></iframe>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
