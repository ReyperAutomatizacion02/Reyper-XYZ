"use client";

import React, { useState, useMemo } from "react";
import { GanttSVG } from "./gantt-svg";
import { Wrench, Clock, Play, Square } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { recordCheckIn, recordCheckOut } from "@/app/dashboard/produccion/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { getProductionTaskColor } from "@/utils/production-colors";
import { createClient } from "@/utils/supabase/client";
import { useMachiningTour } from "@/hooks/use-machining-tour";
import { DashboardHeader } from "@/components/dashboard-header";
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
import { GanttPlanningTask } from "./types";

interface MachiningViewProps {
    initialTasks: GanttPlanningTask[];
    operatorName: string;
}

export function MachiningView({ initialTasks, operatorName }: MachiningViewProps) {
    // All hooks must be at the top and always execute in the same order
    const router = useRouter();
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [checkoutTaskId, setCheckoutTaskId] = useState<string | null>(null);

    // --- TOUR & DEMO LOGIC ---
    const { demoMode, handleStartTour, filteredTasks, allMachineNames } = useMachiningTour({
        initialTasks,
        operatorName,
    });

    // Identify active task from today's filtered tasks (or demo task)
    const activeTask = useMemo(() => {
        return filteredTasks.find((t) => t.check_in && !t.check_out);
    }, [filteredTasks]);

    // Get active task color - always calculate, even if null
    const activeTaskColor = useMemo(() => {
        if (!activeTask) return null;
        return getProductionTaskColor(activeTask);
    }, [activeTask]);

    const handleCheckIn = async (taskId: string) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await recordCheckIn(taskId);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Error al registrar inicio");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCheckOut = (taskId: string) => {
        if (isSaving) return;
        setCheckoutTaskId(taskId);
    };

    const confirmCheckOut = async () => {
        if (!checkoutTaskId || isSaving) return;
        setIsSaving(true);
        try {
            await recordCheckOut(checkoutTaskId);
            // Defer refresh to avoid hooks error
            setTimeout(() => {
                router.refresh();
            }, 100);
        } catch (error) {
            console.error(error);
            alert("Error al registrar fin");
        } finally {
            setIsSaving(false);
            setCheckoutTaskId(null);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden bg-background font-sans">
            <div id="machining-header" className="z-10 border-b border-border bg-card px-6 pt-4 shadow-sm">
                <DashboardHeader
                    title="Maquinados"
                    description={`OPERADOR: ${operatorName}`}
                    icon={<Wrench className="h-8 w-8" />}
                    backUrl="/dashboard/produccion"
                    colorClass="text-blue-500"
                    bgClass="bg-blue-500/10"
                    className="mb-4 text-sm"
                    onHelp={handleStartTour}
                    children={
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                EN LÍNEA
                            </span>
                        </div>
                    }
                />
            </div>

            {/* Focus Panel */}
            {activeTask && activeTaskColor ? (
                <div
                    id="active-task-panel"
                    className={`relative flex flex-none items-center justify-between overflow-hidden px-6 py-4 ${demoMode === "none" ? "duration-500 animate-in slide-in-from-top" : ""}`}
                    style={{
                        backgroundColor: `${activeTaskColor}15`,
                    }}
                >
                    {/* Blur/Glow Background */}
                    <div
                        className="absolute inset-0 opacity-20 blur-2xl"
                        style={{
                            backgroundColor: activeTaskColor,
                        }}
                    />

                    <div className="relative z-10 flex items-center gap-8">
                        <div id="active-task-info" className="flex flex-col">
                            <span
                                className="mb-1 text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: `${activeTaskColor}dd` }}
                            >
                                Tarea en Proceso
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-foreground">
                                    {activeTask.production_orders?.part_code}
                                </span>
                                <span
                                    className="rounded-full px-4 py-1 text-sm font-bold text-white shadow-sm"
                                    style={{ backgroundColor: activeTaskColor }}
                                >
                                    {activeTask.production_orders?.part_name}
                                </span>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-border" />

                        <div className="flex flex-col">
                            <span className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                Inicio de Registro
                            </span>
                            <span className="text-base font-black text-foreground">
                                {format(new Date(activeTask.check_in!), "HH:mm 'hrs'")}
                            </span>
                        </div>
                    </div>

                    <Button
                        id="finish-task-btn"
                        onClick={() => handleCheckOut(activeTask.id)}
                        disabled={isSaving}
                        className="relative z-10 h-14 rounded-2xl px-10 text-base font-black shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                        style={{
                            backgroundColor: activeTaskColor,
                            color: "white",
                        }}
                    >
                        <Square className="mr-3 h-5 w-5 fill-current" />
                        FINALIZAR MAQUINADO
                    </Button>
                </div>
            ) : (
                <div className="flex flex-none items-center justify-between border-b border-border bg-muted/20 px-6 py-3">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase italic tracking-[0.15em]">
                            Haz doble click en una tarea del calendario para iniciar registro
                        </span>
                    </div>
                </div>
            )}

            <div id="machining-gantt-area" className="relative flex-1 overflow-hidden bg-muted/5">
                <GanttSVG
                    initialMachines={[]}
                    initialOrders={[]}
                    optimisticTasks={filteredTasks}
                    setOptimisticTasks={() => {}}
                    onHistorySnapshot={() => {}}
                    searchQuery={""} // Search removed
                    viewMode="hour" // Always hourly
                    isFullscreen={false}
                    selectedMachines={new Set(allMachineNames)}
                    operators={[operatorName]}
                    showDependencies={true}
                    zoomLevel={zoomLevel} // Use local zoom
                    setZoomLevel={setZoomLevel}
                    readOnly={true}
                    hideDateNavigation={true} // Restricted to Today
                    onTaskDoubleClick={(task) => {
                        if (!task.check_in) {
                            handleCheckIn(task.id);
                        } else if (!task.check_out) {
                            handleCheckOut(task.id);
                        }
                    }}
                />

                {!activeTask && filteredTasks.length > 0 && (
                    <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2">
                        <div className="flex animate-bounce items-center gap-4 rounded-full border border-border bg-background/90 px-8 py-4 shadow-2xl backdrop-blur-md">
                            <div className="rounded-full bg-blue-500 p-2 text-white shadow-lg shadow-blue-500/30">
                                <Play className="ml-0.5 h-4 w-4 fill-current" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">
                                Selecciona una pieza para iniciar
                            </span>
                        </div>
                    </div>
                )}

                {filteredTasks.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 top-32 flex flex-col items-center justify-center p-6 pb-20 text-center">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                            <Clock className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-foreground">
                            No hay tareas para hoy
                        </h3>
                        <p className="max-w-sm text-sm font-medium uppercase text-muted-foreground">
                            No tienes piezas planificadas para el día de hoy o todas han sido completadas
                            satisfactoriamente.
                        </p>
                    </div>
                )}
            </div>

            <AlertDialog open={!!checkoutTaskId} onOpenChange={(open) => !open && setCheckoutTaskId(null)}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase text-red-500">
                            ¿Finalizar Maquinado?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium text-muted-foreground">
                            Esta acción registrará la hora de término y marcará la tarea como completada. Asegúrate de
                            que has terminado el trabajo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="text-xs font-bold uppercase">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCheckOut}
                            disabled={isSaving}
                            className="bg-red-600 text-xs font-bold uppercase text-white hover:bg-red-700"
                        >
                            Sí, Finalizar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
