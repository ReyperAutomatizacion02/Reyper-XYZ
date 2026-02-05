"use client";

import React, { useState, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import { Wrench, Clock, Play, Square } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { recordCheckIn, recordCheckOut } from "@/app/dashboard/produccion/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import moment from "moment";
import { getProductionTaskColor } from "@/utils/production-colors";
import { createClient } from "@/utils/supabase/client";
import { useTour, TourStep } from "@/hooks/use-tour";
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

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface MachiningViewProps {
    initialTasks: PlanningTask[];
    operatorName: string;
}

export function MachiningView({ initialTasks, operatorName }: MachiningViewProps) {
    // All hooks must be at the top and always execute in the same order
    const router = useRouter();
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [checkoutTaskId, setCheckoutTaskId] = useState<string | null>(null);

    // --- TOUR & DEMO LOGIC ---
    const { startTour, driverObj } = useTour();
    const [demoMode, setDemoMode] = useState<"none" | "pending" | "active">("none");

    const handleStartTour = () => {
        // "pending" mode will now show exactly one active task
        setDemoMode("pending");

        const steps: TourStep[] = [
            {
                element: "#active-task-panel",
                padding: 15,
                popover: {
                    title: "Tu Tarea en Tiempo Real",
                    description: "Desde el primer segundo, puedes ver aquí la información de tu pieza activa. Este panel te muestra el código, nombre y tiempo de inicio.",
                    side: "bottom",
                    align: "center"
                },
                onHighlightStarted: () => setDemoMode("pending")
            },
            {
                element: "#demo-task-pending",
                padding: 10,
                popover: {
                    title: "Seguimiento Visual",
                    description: "En el calendario, esta misma pieza aparece resaltada con color. Aquí puedes ver gráficamente cuánto tiempo llevas trabajando en ella.",
                    side: "right",
                    align: "center"
                },
                onHighlightStarted: () => setDemoMode("pending")
            },
            {
                element: "#finish-task-btn",
                padding: 10,
                popover: {
                    title: "Concluir Registro",
                    description: "Cuando termines físicamente el maquinado, pulsa este botón. Se cerrará el registro actual y la máquina quedará lista para lo que sigue.",
                    side: "bottom",
                    align: "center"
                },
                onHighlightStarted: () => setDemoMode("pending"),
                onDeselected: () => {
                    setDemoMode("none");
                }
            }
        ];

        // Delay 1000ms to allow all initial animations to settle
        setTimeout(() => {
            startTour(steps, () => setDemoMode("none"));
        }, 1000);
    };

    // Filter tasks - Only show non-completed tasks for TODAY (OR DEMO)
    const filteredTasks = useMemo(() => {
        if (demoMode !== 'none') {
            const now = moment();

            // Exactly ONE task, active from start to satisfy all requirements
            const demoTask: any = {
                id: "demo-task-pending",
                created_at: now.toISOString(),
                machine: "01-MILTRONICS",
                operator: operatorName,
                order_id: "demo-order-1",
                part_code_id: "demo-part-1",
                planned_date: now.clone().subtract(30, 'minutes').toISOString(),
                planned_end: now.clone().add(2, 'hours').toISOString(),
                check_in: now.clone().subtract(15, 'minutes').toISOString(), // Active from start
                check_out: null,
                production_orders: {
                    id: "demo-order-1",
                    part_code: "DEMO-XYZ",
                    part_name: "EJE DE TRANSMISIÓN",
                    client: "MAQUINADOS REYPER"
                }
            };

            return [demoTask];
        }

        const today = moment().startOf('day');
        return initialTasks.filter(task => {
            const isCompleted = !!task.check_out;
            if (isCompleted) return false;

            const taskDate = moment(task.planned_date);
            return taskDate.isSame(today, 'day');
        });
    }, [initialTasks, demoMode, operatorName]);

    // Identify active task - ONLY from today's filtered tasks (OR DEMO)
    const activeTask = useMemo(() => {
        return filteredTasks.find(t => t.check_in && !t.check_out);
    }, [filteredTasks]);

    // For GanttSVG machine filters
    const allMachineNames = useMemo(() => {
        const names = new Set(initialTasks.map(t => t.machine).filter((n): n is string => !!n));

        // Inject Demo Machine if in tour mode
        if (demoMode !== 'none') {
            names.add("01-MILTRONICS");
        }

        return Array.from(names);
    }, [initialTasks, demoMode]);

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
        <div className="h-[calc(100vh-64px)] w-full flex flex-col bg-background overflow-hidden font-sans">
            <div id="machining-header" className="px-6 pt-4 bg-card border-b border-border shadow-sm z-10">
                <DashboardHeader
                    title="MAQUINADOS"
                    description={`OPERADOR: ${operatorName}`}
                    icon={<Wrench className="w-8 h-8" />}
                    backUrl="/dashboard/produccion"
                    colorClass="text-blue-500"
                    bgClass="bg-blue-500/10"
                    className="mb-4 text-sm"
                    onHelp={handleStartTour}
                    children={
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">EN LÍNEA</span>
                        </div>
                    }
                />
            </div>

            {/* Focus Panel */}
            {activeTask && activeTaskColor ? (
                <div
                    id="active-task-panel"
                    className={`flex-none px-6 py-4 flex items-center justify-between relative overflow-hidden ${demoMode === 'none' ? 'animate-in slide-in-from-top duration-500' : ''}`}
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

                    <div className="flex items-center gap-8 relative z-10">
                        <div id="active-task-info" className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: `${activeTaskColor}dd` }}>
                                Tarea en Proceso
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-foreground">{activeTask.production_orders?.part_code}</span>
                                <span
                                    className="text-sm font-bold px-4 py-1 rounded-full shadow-sm text-white"
                                    style={{ backgroundColor: activeTaskColor }}
                                >
                                    {activeTask.production_orders?.part_name}
                                </span>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-border" />

                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-muted-foreground">
                                Inicio de Registro
                            </span>
                            <span className="text-base font-black text-foreground">{moment(activeTask.check_in).format("HH:mm [hrs]")}</span>
                        </div>
                    </div>

                    <Button
                        id="finish-task-btn"
                        onClick={() => handleCheckOut(activeTask.id)}
                        disabled={isSaving}
                        className="font-black px-10 h-14 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-base relative z-10"
                        style={{
                            backgroundColor: activeTaskColor,
                            color: 'white'
                        }}
                    >
                        <Square className="w-5 h-5 mr-3 fill-current" />
                        FINALIZAR MAQUINADO
                    </Button>
                </div>
            ) : (
                <div className="flex-none bg-muted/20 px-6 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] italic">Haz doble click en una tarea del calendario para iniciar registro</span>
                    </div>
                </div>
            )}

            <div id="machining-gantt-area" className="flex-1 overflow-hidden relative bg-muted/5">
                <GanttSVG
                    initialMachines={[]}
                    initialOrders={[]}
                    optimisticTasks={filteredTasks}
                    setOptimisticTasks={() => { }}
                    onHistorySnapshot={() => { }}
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
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div className="bg-background/90 backdrop-blur-md border border-border rounded-full px-8 py-4 flex items-center gap-4 shadow-2xl animate-bounce">
                            <div className="p-2 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                            <span className="text-sm font-black tracking-tight uppercase">Selecciona una pieza para iniciar</span>
                        </div>
                    </div>
                )}

                {filteredTasks.length === 0 && (
                    <div className="absolute inset-0 top-32 flex flex-col items-center justify-center text-center p-6 pb-20 pointer-events-none">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                            <Clock className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-black tracking-tight mb-2 uppercase text-foreground">No hay tareas para hoy</h3>
                        <p className="text-sm text-muted-foreground font-medium max-w-sm uppercase">
                            No tienes piezas planificadas para el día de hoy o todas han sido completadas satisfactoriamente.
                        </p>
                    </div>
                )}
            </div>


            <AlertDialog open={!!checkoutTaskId} onOpenChange={(open) => !open && setCheckoutTaskId(null)}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase text-red-500">¿Finalizar Maquinado?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium text-base">
                            Esta acción registrará la hora de término y marcará la tarea como completada. Asegúrate de que has terminado el trabajo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="font-bold uppercase text-xs">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCheckOut}
                            disabled={isSaving}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs"
                        >
                            Sí, Finalizar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
