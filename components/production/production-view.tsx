"use client";

import React, { useState, useRef, useMemo } from "react";
import { GanttSVG } from "./gantt-svg";
import { Maximize2, Minimize2, Search, ChevronDown, Filter } from "lucide-react";
import { Database } from "@/utils/supabase/types";

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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");

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
            return newSet;
        });
    };

    const selectAllMachines = () => {
        setSelectedMachines(new Set(allMachineNames));
    };

    const clearAllMachines = () => {
        setSelectedMachines(new Set());
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

    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-64px)] w-full flex flex-col bg-background"
        >
            {/* Compact Header */}
            <div className="flex-none px-4 py-2 border-b border-border bg-background/50 backdrop-blur-sm z-[200] flex items-center gap-3">
                {/* View Mode Buttons */}
                <div className="flex bg-muted rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode("hour")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "hour" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Hora
                    </button>
                    <button
                        onClick={() => setViewMode("day")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "day" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Día
                    </button>
                    <button
                        onClick={() => setViewMode("week")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === "week" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Semana
                    </button>
                </div>

                {/* Machine Filter Dropdown */}
                <div className="relative machine-filter-dropdown">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMachineFilterOpen(!isMachineFilterOpen);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm"
                    >
                        <Filter className="w-4 h-4" />
                        <span>Máquinas ({selectedMachines.size}/{allMachineNames.length})</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isMachineFilterOpen ? 'rotate-180' : ''}`} />
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
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                        />
                                        <span className="text-sm">{machineName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="flex-1 max-w-xs relative group">
                    <Search className="absolute left-2.5 top-1.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar pieza..."
                        className="w-full pl-8 pr-3 py-1 rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg transition-all font-semibold text-xs"
                    title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                >
                    {isFullscreen ? (
                        <><Minimize2 className="w-4 h-4" /> Salir</>
                    ) : (
                        <><Maximize2 className="w-4 h-4" /> Pantalla Completa</>
                    )}
                </button>
            </div>

            {/* Bottom Content - Timeline with margins */}
            <div className="flex-1 overflow-y-auto relative p-4">
                <div className="min-h-full w-full rounded-lg border border-border bg-card flex flex-col">
                    <GanttSVG
                        initialMachines={machines}
                        initialOrders={orders}
                        initialTasks={tasks}
                        searchQuery={searchQuery}
                        viewMode={viewMode}
                        isFullscreen={isFullscreen}
                        selectedMachines={selectedMachines}
                        operators={operators}
                    />
                </div>
            </div>
        </div>
    );
}
