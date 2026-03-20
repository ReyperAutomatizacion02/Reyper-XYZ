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
                className="max-w-5xl h-[90vh] p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl z-[10002]"
            >
                <div className="relative w-full h-full flex flex-col">
                    <div className="p-4 bg-muted/10 border-b border-border flex items-center justify-between">
                        <DialogTitle className="text-sm font-bold flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Vista Previa de Plano
                        </DialogTitle>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')}
                                title="Abrir en pestaña nueva"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-muted/5">
                        {fileId && (
                            <iframe
                                src={`https://drive.google.com/file/d/${fileId}/preview`}
                                className="w-full h-full border-none"
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
