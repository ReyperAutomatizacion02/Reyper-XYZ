"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { GanttSVG } from "./gantt-svg";
import { Calendar, Maximize2, Minimize2, Search, ChevronDown, Filter, Save, RotateCcw, RotateCw, Settings, ZoomIn, ZoomOut } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import moment from "moment";
import { updateTaskSchedule } from "@/app/dashboard/produccion/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { ProductionViewSkeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { useTour, TourStep } from "@/hooks/use-tour";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface ProductionViewProps {
    machines: Machine[];
    orders: Order[];
    tasks: PlanningTask[];
    operators: string[];
}

export function ProductionView({ machines, orders, tasks, operators }: ProductionViewProps) {
    const router = useRouter();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // User preferences
    const { getGanttPrefs, updateGanttPref, isLoading: prefsLoading } = useUserPreferences();
    const ganttPrefs = getGanttPrefs();

    // Initialize states with defaults, will be updated from preferences
    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");
    const [showDependencies, setShowDependencies] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [prefsInitialized, setPrefsInitialized] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);


    // Initialize from preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !prefsInitialized) {
            if (ganttPrefs.viewMode) setViewMode(ganttPrefs.viewMode);
            if (ganttPrefs.showDependencies !== undefined) setShowDependencies(ganttPrefs.showDependencies);
            if (ganttPrefs.zoomLevel) setZoomLevel(ganttPrefs.zoomLevel);
            // Note: selectedMachines initialized in a separate effect below (needs allMachineNames)
            setPrefsInitialized(true);
        }
    }, [prefsLoading, prefsInitialized, ganttPrefs]);

    // Save viewMode preference
    const handleViewModeChange = (newMode: "hour" | "day" | "week") => {
        setViewMode(newMode);
        setZoomLevel(1); // Reset zoom on mode change
        updateGanttPref({ viewMode: newMode, zoomLevel: 1 });
    };

    // Save showDependencies preference
    const handleShowDependenciesChange = (value: boolean) => {
        setShowDependencies(value);
        updateGanttPref({ showDependencies: value });
    };

    // Save zoomLevel preference
    const handleZoomChange = (newZoom: number | ((prev: number) => number)) => {
        setZoomLevel(prev => {
            const resolvedZoom = typeof newZoom === 'function' ? newZoom(prev) : newZoom;
            updateGanttPref({ zoomLevel: resolvedZoom });
            return resolvedZoom;
        });
    };

    // Close settings on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isSettingsOpen]);

    // State lifted from GanttSVG
    const [savedTasks, setSavedTasks] = useState<PlanningTask[]>(tasks);
    const [optimisticTasks, setOptimisticTasks] = useState<PlanningTask[]>(tasks);
    const [history, setHistory] = useState<PlanningTask[][]>([]);
    const [future, setFuture] = useState<PlanningTask[][]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Wrapper for setOptimisticTasks - SIMPLE now, history managed by snapshot
    const handleTasksChange = (newTasks: React.SetStateAction<PlanningTask[]>) => {
        setOptimisticTasks(newTasks);
    };

    const handleHistorySnapshot = (previousState: PlanningTask[]) => {
        setHistory(h => [...h, previousState]);
        setFuture([]); // Clear redo history on new action
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        setFuture(f => [...f, optimisticTasks]); // Save current to future (Redo stack)
        setHistory(newHistory);
        setOptimisticTasks(previousState);
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];
        const newFuture = future.slice(0, -1);

        setHistory(h => [...h, optimisticTasks]); // Save current to history (Undo stack)
        setFuture(newFuture);
        setOptimisticTasks(nextState);
    };

    // Sync props to state
    React.useEffect(() => {
        setSavedTasks(tasks);
        setOptimisticTasks(tasks);
    }, [tasks]);

    // Detect Changes logic (Moved up for dependencies)
    const changedTasks = useMemo(() => {
        return optimisticTasks.filter(current => {
            const original = savedTasks.find(s => s.id === current.id);
            if (!original) return false;

            const format = "YYYY-MM-DDTHH:mm:ss";
            const currentStart = moment(current.planned_date).format(format);
            const originalStart = moment(original.planned_date).format(format);

            const currentEnd = moment(current.planned_end).format(format);
            const originalEnd = moment(original.planned_end).format(format);

            return currentStart !== originalStart || currentEnd !== originalEnd;
        });
    }, [optimisticTasks, savedTasks]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    handleRedo();
                } else if (e.key === 's') {
                    e.preventDefault();
                    if (changedTasks.length > 0) {
                        handleSave();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, future, optimisticTasks, isSaving, changedTasks]);

    // Handlers
    const handleSave = async () => {
        if (changedTasks.length === 0) return;
        setIsSaving(true);
        try {
            await Promise.all(changedTasks.map(task =>
                updateTaskSchedule(task.id, moment(task.planned_date).format("YYYY-MM-DDTHH:mm:ss"), moment(task.planned_end).format("YYYY-MM-DDTHH:mm:ss"))
            ));
            router.refresh();
        } catch (error) {
            console.error("Failed to save", error);
            alert("Error al guardar los cambios.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        if (confirm("¿Estás seguro de descartar los cambios no guardados?")) {
            setOptimisticTasks(savedTasks);
            setHistory([]); // Clear history on discard
        }
    };

    // Derive unique machine names from both machines table and tasks
    const allMachineNames = useMemo(() => {
        const names = new Set([
            ...machines.map(m => m.name),
            ...tasks.map(t => t.machine).filter((n): n is string => !!n)
        ]);
        if (tasks.some(t => !t.machine)) {
            names.add("Sin Máquina");
        }
        return Array.from(names).sort();
    }, [machines, tasks]);

    const [selectedMachines, setSelectedMachines] = useState<Set<string>>(
        new Set(allMachineNames)
    );
    const [isMachineFilterOpen, setIsMachineFilterOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize selectedMachines from preferences once dependencies are ready
    useEffect(() => {
        if (prefsInitialized && ganttPrefs.selectedMachines && ganttPrefs.selectedMachines.length > 0) {
            // Filter to only include machines that actually exist
            const validMachines = ganttPrefs.selectedMachines.filter(m => allMachineNames.includes(m));
            if (validMachines.length > 0) {
                setSelectedMachines(new Set(validMachines));
            }
        }
    }, [prefsInitialized, ganttPrefs.selectedMachines, allMachineNames]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const toggleMachine = (machineName: string) => {
        setSelectedMachines(prev => {
            const newSet = new Set(prev);
            if (newSet.has(machineName)) {
                newSet.delete(machineName);
            } else {
                newSet.add(machineName);
            }
            // Save to preferences
            updateGanttPref({ selectedMachines: Array.from(newSet) });
            return newSet;
        });
    };

    // --- MODAL STATE (Lifted) ---
    const [modalData, setModalData] = React.useState<any>(null);

    const selectAllMachines = () => {
        setSelectedMachines(new Set(allMachineNames));
        updateGanttPref({ selectedMachines: allMachineNames });
    };

    const clearAllMachines = () => {
        setSelectedMachines(new Set());
        updateGanttPref({ selectedMachines: [] });
    };

    // --- HELP TOUR HANDLER ---
    const { startTour, driverObj } = useTour();

    const handleStartTour = () => {
        const isDemo = optimisticTasks.length === 0;

        if (isDemo) {
            // Create a mock task for demonstration
            const demoTask: any = {
                id: "demo-task-1",
                order_id: "demo-order-1",
                machine: machines[0]?.name || "CNC-01",
                operator: "Juan Demo",
                planned_date: new Date().toISOString(),
                planned_end: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 hours
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: "Tarea de demostración",
                status: "planned",
                production_orders: {
                    id: "demo-order-1",
                    // code: "ORD-DEMO", // Removed invalid property
                    part_code: "PZA-DEMO-001",
                    part_name: "Pieza Demo",
                    quantity: 10,
                    client: "Cliente Demo",
                    status: "active",
                    created_at: new Date().toISOString(),
                    delivery_date: new Date(Date.now() + 86400000).toISOString(),
                    priority: "normal",
                    material: "Acero",
                    notes: ""
                } as any // Cast to any to avoid strict type checking on demo data
            };
            setOptimisticTasks([demoTask]);
        }

        const cleanup = () => {
            if (isDemo) {
                setOptimisticTasks([]);
            }
            setModalData(null); // Ensure modal closes
        };

        const steps: TourStep[] = [
            {
                element: "#planning-gantt-area",
                popover: { title: "Área de Gantt", description: "Visualiza y gestiona la producción. Haz DOBLE CLIC en un espacio vacío para crear una tarea, o en una tarea existente para editarla.", side: "top", align: "center" }
            },
            {
                element: "#planning-view-modes",
                popover: { title: "Modos de Vista", description: "Cambia la escala de tiempo entre Hora, Día y Semana para ver mas detalle o el panorama general.", side: "bottom", align: "start" }
            },
            {
                element: "#planning-machine-filter",
                popover: { title: "Filtro de Máquinas", description: "Selecciona qué máquinas quieres ver en el diagrama.", side: "bottom" }
            },
            {
                element: "#planning-search",
                popover: { title: "Buscador de Piezas", description: "Resalta rápidamente las tareas relacionadas con una pieza o código específico.", side: "bottom" }
            },
            {
                element: "#planning-settings",
                popover: { title: "Configuración", description: "Personaliza la visualización, como mostrar/ocultar líneas de dependencia.", side: "bottom" }
            },
            {
                element: "#planning-fullscreen",
                popover: { title: "Pantalla Completa", description: "Maximiza el área de trabajo para tener una mejor visión de toda la planta.", side: "left" }
            },
            // Transition Step to Modal (Index 6)
            {
                element: "#planning-gantt-area",
                popover: { title: "Creación de Tareas", description: "Al hacer doble clic, se abrirá el formulario de tarea. ¡Vamos a verlo!", side: "top" },
                onHighlightStarted: () => {
                    // Backtracking: Ensure modal is closed if we return to this step
                    setModalData(null);
                }
            },
            // Step 7: Open Modal Explicitly
            {
                element: "#task-modal-content",
                popover: { title: "Formulario de Tarea", description: "Aquí se abrirá el formulario. Llénalo con la información del trabajo.", side: "left", align: "center" },
                onHighlightStarted: () => {
                    // Open modal immediately so it is ready for next steps
                    setModalData({
                        machine: machines[0]?.name || "CNC-01",
                        time: Date.now(),
                        operator: "Juan Demo",
                        isDemo: true // Flag to disable animation for instant rendering
                    });
                }
            },
            // Modal Steps (Index 8+)
            {
                element: "#task-modal-order",
                popover: { title: "Selección de Pieza", description: "Busca y selecciona la orden de producción o pieza a maquinar.", side: "right" }
            },
            {
                element: "#task-modal-start",
                popover: { title: "Inicio Programado", description: "Define la fecha y hora de inicio. Puedes usar el calendario o escribir la hora.", side: "right" }
            },
            {
                element: "#task-modal-end",
                popover: { title: "Fin Estimado", description: "El sistema calculará el fin automáticamente, pero puedes ajustarlo manualmente.", side: "right" }
            },
            {
                element: "#task-modal-operator",
                popover: { title: "Asignación de Operador", description: "Asigna un operador responsable a esta tarea.", side: "top" }
            },
            {
                element: "#task-modal-save",
                popover: { title: "Guardar Cambios", description: "Guarda la tarea para reflejarla en el tablero de todos los usuarios.", side: "top" }
            }
        ];

        startTour(steps, cleanup);
    };

    // Synchronize state if fullscreen is exited via Esc key
    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isMachineFilterOpen && !(e.target as Element).closest('.machine-filter-dropdown')) {
                setIsMachineFilterOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [isMachineFilterOpen]);

    // Show skeleton while preferences are loading
    if (!prefsInitialized) {
        return <ProductionViewSkeleton />;
    }

    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-64px)] w-full flex flex-col bg-background"
        >
            {!isFullscreen && (
                <div className="px-6 pt-6 -mb-2">
                    <DashboardHeader
                        title="Planeación de Producción"
                        description="Planificador de maquinados con vista Gantt interactiva"
                        icon={<Calendar className="w-8 h-8" />}
                        backUrl="/dashboard/produccion"
                        colorClass="text-red-500"
                        bgClass="bg-red-500/10"
                        onHelp={handleStartTour}
                    />
                </div>
            )}
            {/* Compact Header */}
            <div className="flex-none px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm z-[200] flex flex-wrap items-center gap-3">
                {/* View Mode Buttons */}
                <div className="flex bg-muted rounded-lg p-0.5" id="planning-view-modes">
                    <button
                        onClick={() => handleViewModeChange("hour")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "hour" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Hora
                    </button>
                    <button
                        onClick={() => handleViewModeChange("day")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "day" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Día
                    </button>
                    <button
                        onClick={() => handleViewModeChange("week")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "week" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Semana
                    </button>
                </div>

                {/* Machine Filter Dropdown */}
                <div className="relative machine-filter-dropdown" id="planning-machine-filter">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMachineFilterOpen(!isMachineFilterOpen);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm"
                        title={`Filtrar Máquinas (${selectedMachines.size}/${allMachineNames.length})`}
                    >
                        <Filter className="w-4 h-4" />
                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isMachineFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMachineFilterOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-background border border-border rounded-lg shadow-xl z-[9999] overflow-hidden">
                            <div className="p-2 border-b border-border flex gap-2">
                                <button
                                    onClick={selectAllMachines}
                                    className="flex-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                                >
                                    Todas
                                </button>
                                <button
                                    onClick={clearAllMachines}
                                    className="flex-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                                >
                                    Ninguna
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                {allMachineNames.map(machineName => (
                                    <label
                                        key={machineName}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMachines.has(machineName)}
                                            onChange={() => toggleMachine(machineName)}
                                            className="w-4 h-4 rounded border-border text-[#EC1C21] focus:ring-[#EC1C21]/20 accent-[#EC1C21]"
                                        />
                                        <span className="text-sm">{machineName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[150px] max-w-xs relative group" id="planning-search">
                    <Search className="absolute left-2.5 top-1.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar pieza..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>



                {/* Settings Menu */}
                <div className="relative" ref={settingsRef} id="planning-settings">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`p-1.5 rounded-lg border border-border transition-colors ${isSettingsOpen ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                        title="Ajustes de Visualización"
                    >
                        <Settings className="w-4 h-4" />
                    </button>

                    {isSettingsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Visualización</div>

                            <label className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                <span className="text-sm">Lineas de Dependencia</span>
                                <input
                                    type="checkbox"
                                    checked={showDependencies}
                                    onChange={(e) => handleShowDependenciesChange(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#EC1C21] focus:ring-[#EC1C21] accent-[#EC1C21]"
                                />
                            </label>

                            {/* More settings can go here */}
                        </div>
                    )}
                </div>

                {/* Save Controls - Only visible when there are changes */}
                {changedTasks.length > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <span className="text-xs text-muted-foreground mr-1 hidden lg:inline-block">
                            {changedTasks.length} cambios
                        </span>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="h-7 px-2 text-xs"
                            title="Deshacer (Ctrl+Z)"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRedo}
                            disabled={future.length === 0}
                            className="h-7 px-2 text-xs"
                            title="Rehacer (Ctrl+Y)"
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDiscard}
                            disabled={isSaving}
                            className="h-7 px-2 text-xs"
                            title="Descartar Todos"
                        >
                            <span className="hidden sm:inline">Descartar</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-7 px-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                            title="Guardar Cambios"
                        >
                            <Save className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Fullscreen Button */}
                <button
                    id="planning-fullscreen"
                    onClick={toggleFullscreen}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg transition-all font-semibold text-xs"
                    title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                >
                    {isFullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                    ) : (
                        <Maximize2 className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Bottom Content - Timeline with margins */}
            <div className="flex-1 overflow-hidden relative p-4 flex flex-col" id="planning-gantt-area">
                <div className="flex-1 w-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
                    <GanttSVG
                        initialMachines={machines}
                        initialOrders={orders}
                        // Tasks are now managed by parent
                        optimisticTasks={optimisticTasks}
                        setOptimisticTasks={handleTasksChange}
                        onHistorySnapshot={handleHistorySnapshot}
                        searchQuery={searchQuery}
                        viewMode={viewMode}
                        isFullscreen={isFullscreen}
                        selectedMachines={selectedMachines}
                        operators={operators}
                        showDependencies={showDependencies}
                        zoomLevel={zoomLevel} // Pass zoom level
                        setZoomLevel={handleZoomChange} // Pass setter for zoom controls
                        modalData={modalData}
                        setModalData={setModalData}
                    />
                </div>
            </div>
        </div>
    );
}
