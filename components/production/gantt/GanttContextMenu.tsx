"use client";

import React from "react";
import { Lock, Unlock, FileText } from "lucide-react";
import { format, isBefore } from "date-fns";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

interface GanttContextMenuProps {
    contextMenu: { x: number; y: number; task: PlanningTask } | null;
    currentTime: Date;
    onClose: () => void;
    onViewDetails: (task: PlanningTask) => void;
    onToggleLock?: (taskId: string, locked: boolean) => void;
}

export function GanttContextMenu({
    contextMenu,
    currentTime,
    onClose,
    onViewDetails,
    onToggleLock,
}: GanttContextMenuProps) {
    if (!contextMenu) return null;

    const task = contextMenu.task;
    const now = currentTime || new Date();
    const isFinishedOrRunning = !!task.check_in || !!task.check_out || isBefore(new Date(task.planned_date!), now);
    const currentIsLocked = task.locked === true || (task.locked !== false && isFinishedOrRunning);

    return (
        <div
            className="fixed z-dropdown min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md duration-100 animate-in fade-in zoom-in-95"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="mb-1 border-b border-border/50 px-2 py-1.5 text-xs font-semibold text-foreground">
                Acciones
            </div>
            <button
                onClick={() => {
                    onViewDetails(task);
                    onClose();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
            >
                <FileText className="h-3.5 w-3.5" />
                <span>Ver Detalles</span>
            </button>
            {onToggleLock && !task.isDraft && (
                <button
                    onClick={() => {
                        onToggleLock(task.id, !currentIsLocked);
                        onClose();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                >
                    {currentIsLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>{currentIsLocked ? "Desbloquear" : "Bloquear"}</span>
                </button>
            )}
        </div>
    );
}
