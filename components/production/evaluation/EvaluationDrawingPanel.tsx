import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractDriveFileId } from "@/lib/drive-utils";

interface EvaluationDrawingPanelProps {
    drawingUrl: string;
}

export function EvaluationDrawingPanel({ drawingUrl }: EvaluationDrawingPanelProps) {
    const fileId = extractDriveFileId(drawingUrl);

    return (
        <div className="flex h-full min-w-0 flex-1 flex-col border-r border-border bg-muted/5">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                    <FileText className="h-4 w-4 text-primary" />
                    Plano de Fabricación
                </h3>
                {!fileId && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => window.open(drawingUrl, "_blank")}
                    >
                        Abrir en pestaña nueva
                    </Button>
                )}
            </div>
            <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[#1a1a1a]">
                {fileId ? (
                    <iframe
                        src={`https://drive.google.com/file/d/${fileId}/preview`}
                        className="block h-full w-full border-none"
                        allow="autoplay"
                        title="Blueprint Preview"
                    />
                ) : (
                    <div className="m-4 flex max-w-sm flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-background/50 p-8 text-center shadow-inner">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 shadow-sm">
                            <FileText className="h-8 w-8 text-amber-500" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold">Vista Previa No Disponible</h4>
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                Este archivo no se puede visualizar directamente. Usa el botón de arriba para abrirlo en
                                una pestaña nueva.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
