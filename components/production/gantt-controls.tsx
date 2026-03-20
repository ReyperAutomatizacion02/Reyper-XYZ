"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Filter,
    Search,
    Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GanttControlsProps {
    viewMode: "hour" | "day" | "week";
    onViewModeChange: (mode: "hour" | "day" | "week") => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    allMachineNames: string[];
    selectedMachines: Set<string>;
    onToggleMachine: (name: string) => void;
    onSelectAllMachines: () => void;
    onClearAllMachines: () => void;
    showDependencies: boolean;
    onShowDependenciesChange: (value: boolean) => void;
    hideEmptyMachines: boolean;
    onHideEmptyMachinesChange: (value: boolean) => void;
    cascadeMode: boolean;
    onCascadeModeChange: (value: boolean) => void;
}

export function GanttControls({
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchChange,
    allMachineNames,
    selectedMachines,
    onToggleMachine,
    onSelectAllMachines,
    onClearAllMachines,
    showDependencies,
    onShowDependenciesChange,
    hideEmptyMachines,
    onHideEmptyMachinesChange,
    cascadeMode,
    onCascadeModeChange,
}: GanttControlsProps) {
    const [isMachineFilterOpen, setIsMachineFilterOpen] = React.useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Close settings on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };
        if (isSettingsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isSettingsOpen]);

    // Close machine filter on click outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (isMachineFilterOpen && !target.closest('.machine-filter-dropdown')) {
                setIsMachineFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMachineFilterOpen]);

    return { startControls: renderStartControls(), endControls: renderEndControls() };

    function renderStartControls() {
        return (
            <div id="planning-view-modes" className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border/50">
                {(["hour", "day", "week"] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => onViewModeChange(mode)}
                        className={cn(
                            "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                            viewMode === mode
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        {mode === "hour" ? "Hora" : mode === "day" ? "Día" : "Semana"}
                    </button>
                ))}
            </div>
        );
    }

    function renderEndControls() {
        return (
            <div className="flex items-center gap-2">
                {/* Search */}
                <div id="planning-search" className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar pieza..."
                        className="h-8 w-32 md:w-48 pl-8 pr-3 text-[10px] bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Machine Filter */}
                <div id="planning-machine-filter" className="relative machine-filter-dropdown">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMachineFilterOpen(!isMachineFilterOpen)}
                        className={cn(
                            "h-8 text-[10px] font-bold uppercase gap-2 px-3 rounded-xl border-border/60",
                            selectedMachines.size < allMachineNames.length && "border-primary/50 bg-primary/5 text-primary"
                        )}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Máquinas</span>
                        {selectedMachines.size < allMachineNames.length && (
                            <span className="bg-primary text-white text-[9px] px-1 rounded-full min-w-[14px]">
                                {selectedMachines.size}
                            </span>
                        )}
                    </Button>

                    <AnimatePresence>
                        {isMachineFilterOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl z-[100] p-3 backdrop-blur-md"
                            >
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar Máquinas</span>
                                    <div className="flex gap-2">
                                        <button onClick={onSelectAllMachines} className="text-[9px] font-bold text-primary hover:underline">Todas</button>
                                        <button onClick={onClearAllMachines} className="text-[9px] font-bold text-muted-foreground hover:underline">Ninguna</button>
                                    </div>
                                </div>
                                <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                    {allMachineNames.map(name => (
                                        <label
                                            key={name}
                                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                                        >
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMachines.has(name)}
                                                    onChange={() => onToggleMachine(name)}
                                                    className="peer h-4 w-4 appearance-none rounded border border-border checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                                />
                                                <CheckCircle2 className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                            </div>
                                            <span className="text-[11px] font-medium group-hover:text-foreground transition-colors">{name}</span>
                                        </label>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Settings Dropdown */}
                <div id="planning-settings" className="relative" ref={settingsRef}>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="h-8 w-8 p-0 rounded-xl border-border/60 shadow-sm"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                    </Button>

                    <AnimatePresence>
                        {isSettingsOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-[100] p-4 backdrop-blur-md"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 block px-1">Configuración de Vista</span>

                                <div className="space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-bold group-hover:text-primary transition-colors">Dependencias</span>
                                            <span className="text-[9px] text-muted-foreground leading-none">Mostrar líneas de conexión</span>
                                        </div>
                                        <div
                                            onClick={() => onShowDependenciesChange(!showDependencies)}
                                            className={cn(
                                                "w-9 h-5 rounded-full relative transition-all duration-300",
                                                showDependencies ? "bg-primary" : "bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm",
                                                showDependencies ? "left-5" : "left-1"
                                            )} />
                                        </div>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-bold group-hover:text-primary transition-colors">Máquinas Vacías</span>
                                            <span className="text-[9px] text-muted-foreground leading-none">Ocultar si no tienen tareas</span>
                                        </div>
                                        <div
                                            onClick={() => onHideEmptyMachinesChange(!hideEmptyMachines)}
                                            className={cn(
                                                "w-9 h-5 rounded-full relative transition-all duration-300",
                                                hideEmptyMachines ? "bg-primary" : "bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm",
                                                hideEmptyMachines ? "left-5" : "left-1"
                                            )} />
                                        </div>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer group border-t border-border/50 pt-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-bold group-hover:text-primary transition-colors">Modo Cascada</span>
                                            <span className="text-[9px] text-muted-foreground leading-none">Mover tareas consecutivas</span>
                                        </div>
                                        <div
                                            onClick={() => onCascadeModeChange(!cascadeMode)}
                                            className={cn(
                                                "w-9 h-5 rounded-full relative transition-all duration-300",
                                                cascadeMode ? "bg-primary" : "bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm",
                                                cascadeMode ? "left-5" : "left-1"
                                            )} />
                                        </div>
                                    </label>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }
}
