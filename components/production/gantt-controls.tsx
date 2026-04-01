"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Filter, Maximize2, Minimize2, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProjectOption {
    id: string;
    code: string;
    company: string | null;
}

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
    availableProjects: ProjectOption[];
    projectFilter: string[];
    onProjectFilterChange: (ids: string[]) => void;
    zoomLevel: number;
    onZoomChange: (level: number | ((prev: number) => number)) => void;
    isFullscreen: boolean;
    onToggleFullscreen?: () => void;
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
    availableProjects,
    projectFilter,
    onProjectFilterChange,
    zoomLevel,
    onZoomChange,
    isFullscreen,
    onToggleFullscreen,
}: GanttControlsProps) {
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isMachinesExpanded, setIsMachinesExpanded] = useState(false);
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");
    const [machineSearch, setMachineSearch] = useState("");
    const [panelPos, setPanelPos] = useState<{
        top?: number;
        bottom?: number;
        right: number;
        maxHeight: number;
    }>({ top: 0, right: 0, maxHeight: 400 });

    const filtersRef = useRef<HTMLDivElement>(null);
    const filterButtonRef = useRef<HTMLButtonElement>(null);

    const computePanelPos = useCallback(() => {
        if (!filterButtonRef.current) return;
        const rect = filterButtonRef.current.getBoundingClientRect();
        const PANEL_WIDTH = 288; // w-72
        const GAP = 8;
        const rawRight = window.innerWidth - rect.right;
        const right = Math.max(GAP, Math.min(rawRight, window.innerWidth - PANEL_WIDTH - GAP));
        const spaceBelow = window.innerHeight - rect.bottom - GAP;
        const spaceAbove = rect.top - GAP;
        const MIN_HEIGHT = 200;
        if (spaceBelow >= MIN_HEIGHT || spaceBelow >= spaceAbove) {
            setPanelPos({ top: rect.bottom + GAP, right, maxHeight: Math.max(MIN_HEIGHT, spaceBelow) });
        } else {
            setPanelPos({
                bottom: window.innerHeight - rect.top + GAP,
                right,
                maxHeight: Math.max(MIN_HEIGHT, spaceAbove),
            });
        }
    }, []);

    // Keep panel anchored to button while open (handles page scroll and window resize)
    useEffect(() => {
        if (!isFiltersOpen) return;
        window.addEventListener("scroll", computePanelPos, true);
        window.addEventListener("resize", computePanelPos);
        return () => {
            window.removeEventListener("scroll", computePanelPos, true);
            window.removeEventListener("resize", computePanelPos);
        };
    }, [isFiltersOpen, computePanelPos]);

    const activeFilterCount =
        (searchQuery ? 1 : 0) +
        (projectFilter.length > 0 ? 1 : 0) +
        (selectedMachines.size < allMachineNames.length ? 1 : 0);

    const filteredProjects = availableProjects.filter((p) => {
        const q = projectSearch.toLowerCase();
        return !q || p.code.toLowerCase().includes(q) || (p.company ?? "").toLowerCase().includes(q);
    });

    const filteredMachines = allMachineNames.filter(
        (name) => !machineSearch || name.toLowerCase().includes(machineSearch.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isFiltersOpen && filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
                setIsFiltersOpen(false);
            }
        };
        if (isFiltersOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFiltersOpen]);

    function toggleProject(id: string) {
        onProjectFilterChange(
            projectFilter.includes(id) ? projectFilter.filter((x) => x !== id) : [...projectFilter, id]
        );
    }

    return { startControls: renderStartControls(), endControls: renderEndControls() };

    function renderStartControls() {
        return (
            <div
                id="planning-view-modes"
                className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 p-0.5"
            >
                {(["hour", "day", "week"] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => onViewModeChange(mode)}
                        className={cn(
                            "rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                            viewMode === mode
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
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
            <div className="flex items-center gap-1.5">
                {/* Unified Filters + Settings Panel */}
                <div className="relative" ref={filtersRef}>
                    <Button
                        id="planning-machine-filter"
                        ref={filterButtonRef}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (!isFiltersOpen) computePanelPos();
                            setIsFiltersOpen(!isFiltersOpen);
                        }}
                        className={cn(
                            "h-8 gap-2 rounded-xl border-border/60 px-3 text-[10px] font-bold uppercase",
                            activeFilterCount > 0 && "border-primary/50 bg-primary/5 text-primary"
                        )}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Filtros</span>
                        {activeFilterCount > 0 && (
                            <span className="min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[9px] leading-none text-white">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>

                    <AnimatePresence>
                        {isFiltersOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                transition={{ duration: 0.13 }}
                                className="flex w-72 flex-col rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-md"
                                style={{
                                    position: "fixed",
                                    top: panelPos.top,
                                    bottom: panelPos.bottom,
                                    right: panelPos.right,
                                    maxHeight: panelPos.maxHeight,
                                    zIndex: 9999,
                                }}
                            >
                                {/* Panel header — sticky */}
                                <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        Filtros y Configuración
                                    </span>
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={() => {
                                                onSearchChange("");
                                                onProjectFilterChange([]);
                                                onSelectAllMachines();
                                            }}
                                            className="text-[9px] font-bold text-muted-foreground transition-colors hover:text-destructive"
                                        >
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>

                                {/* Scrollable body */}
                                <div className="custom-scrollbar space-y-4 overflow-y-auto px-4 pb-4">
                                    {/* Piece search */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Pieza
                                        </span>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => onSearchChange(e.target.value)}
                                                placeholder="Buscar por código o nombre..."
                                                className="h-8 w-full rounded-xl border border-border/60 bg-background pl-8 pr-8 text-[10px] transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => onSearchChange("")}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Projects — collapsible multi-select */}
                                    {availableProjects.length > 0 && (
                                        <div className="space-y-1.5">
                                            <button
                                                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                                                className="group flex w-full items-center justify-between"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                                                        Proyectos
                                                    </span>
                                                    {projectFilter.length > 0 && (
                                                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] leading-none text-white">
                                                            {projectFilter.length}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown
                                                    className={cn(
                                                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                                        isProjectsExpanded && "rotate-180"
                                                    )}
                                                />
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {isProjectsExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.18 }}
                                                        className="overflow-hidden"
                                                    >
                                                        {/* Search within projects */}
                                                        <div className="relative mb-2">
                                                            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                                            <input
                                                                type="text"
                                                                value={projectSearch}
                                                                onChange={(e) => setProjectSearch(e.target.value)}
                                                                placeholder="Buscar proyecto..."
                                                                className="h-7 w-full rounded-lg border border-border/60 bg-background pl-7 pr-7 text-[10px] transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                            />
                                                            {projectSearch && (
                                                                <button
                                                                    onClick={() => setProjectSearch("")}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {projectFilter.length > 0 && (
                                                            <div className="mb-1 flex justify-end">
                                                                <button
                                                                    onClick={() => onProjectFilterChange([])}
                                                                    className="text-[9px] font-bold text-muted-foreground hover:underline"
                                                                >
                                                                    Limpiar
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div className="space-y-0.5">
                                                            {filteredProjects.map((project) => {
                                                                const isChecked = projectFilter.includes(project.id);
                                                                return (
                                                                    <label
                                                                        key={project.id}
                                                                        className={cn(
                                                                            "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all",
                                                                            isChecked
                                                                                ? "bg-primary/10"
                                                                                : "hover:bg-muted/50"
                                                                        )}
                                                                    >
                                                                        <div
                                                                            className={cn(
                                                                                "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-all",
                                                                                isChecked
                                                                                    ? "border-primary bg-primary"
                                                                                    : "border-border bg-background group-hover:border-primary/60"
                                                                            )}
                                                                        >
                                                                            {isChecked && (
                                                                                <svg
                                                                                    viewBox="0 0 10 7"
                                                                                    className="h-2.5 w-2.5"
                                                                                    fill="none"
                                                                                    stroke="white"
                                                                                    strokeWidth="1.8"
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                >
                                                                                    <path d="M1 3.5L3.5 6L9 1" />
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => toggleProject(project.id)}
                                                                            className="sr-only"
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <div
                                                                                className={cn(
                                                                                    "truncate text-[11px] leading-none transition-colors",
                                                                                    isChecked
                                                                                        ? "font-semibold text-primary"
                                                                                        : "font-bold text-foreground/80 group-hover:text-foreground"
                                                                                )}
                                                                            >
                                                                                {project.code}
                                                                            </div>
                                                                            {project.company && (
                                                                                <div className="mt-0.5 truncate text-[9px] text-muted-foreground">
                                                                                    {project.company}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* Machines — collapsible */}
                                    <div className="space-y-1.5">
                                        <button
                                            onClick={() => setIsMachinesExpanded(!isMachinesExpanded)}
                                            className="group flex w-full items-center justify-between"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                                                    Máquinas
                                                </span>
                                                {selectedMachines.size < allMachineNames.length && (
                                                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] leading-none text-white">
                                                        {selectedMachines.size}/{allMachineNames.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronDown
                                                className={cn(
                                                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                                    isMachinesExpanded && "rotate-180"
                                                )}
                                            />
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isMachinesExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="overflow-hidden"
                                                >
                                                    {/* Search within machines */}
                                                    <div className="relative mb-2">
                                                        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            value={machineSearch}
                                                            onChange={(e) => setMachineSearch(e.target.value)}
                                                            placeholder="Buscar máquina..."
                                                            className="h-7 w-full rounded-lg border border-border/60 bg-background pl-7 pr-7 text-[10px] transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                        />
                                                        {machineSearch && (
                                                            <button
                                                                onClick={() => setMachineSearch("")}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="mb-1 flex justify-end gap-2">
                                                        <button
                                                            onClick={onSelectAllMachines}
                                                            className="text-[9px] font-bold text-primary hover:underline"
                                                        >
                                                            Todas
                                                        </button>
                                                        <button
                                                            onClick={onClearAllMachines}
                                                            className="text-[9px] font-bold text-muted-foreground hover:underline"
                                                        >
                                                            Ninguna
                                                        </button>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {filteredMachines.map((name) => {
                                                            const isChecked = selectedMachines.has(name);
                                                            return (
                                                                <label
                                                                    key={name}
                                                                    className={cn(
                                                                        "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all",
                                                                        isChecked
                                                                            ? "bg-primary/10"
                                                                            : "hover:bg-muted/50"
                                                                    )}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-all",
                                                                            isChecked
                                                                                ? "border-primary bg-primary"
                                                                                : "border-border bg-background group-hover:border-primary/60"
                                                                        )}
                                                                    >
                                                                        {isChecked && (
                                                                            <svg
                                                                                viewBox="0 0 10 7"
                                                                                className="h-2.5 w-2.5"
                                                                                fill="none"
                                                                                stroke="white"
                                                                                strokeWidth="1.8"
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                            >
                                                                                <path d="M1 3.5L3.5 6L9 1" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => onToggleMachine(name)}
                                                                        className="sr-only"
                                                                    />
                                                                    <span
                                                                        className={cn(
                                                                            "truncate text-[11px] leading-none transition-colors",
                                                                            isChecked
                                                                                ? "font-semibold text-primary"
                                                                                : "font-medium text-foreground/80 group-hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        {name}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-border/50" />

                                    {/* Settings — collapsible */}
                                    <div className="space-y-1.5">
                                        <button
                                            onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                                            className="group flex w-full items-center justify-between"
                                        >
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                                                Configuración de Vista
                                            </span>
                                            <ChevronDown
                                                className={cn(
                                                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                                    isSettingsExpanded && "rotate-180"
                                                )}
                                            />
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isSettingsExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-3 pt-1">
                                                        {[
                                                            {
                                                                label: "Dependencias",
                                                                desc: "Mostrar líneas de conexión",
                                                                value: showDependencies,
                                                                toggle: () =>
                                                                    onShowDependenciesChange(!showDependencies),
                                                            },
                                                            {
                                                                label: "Máquinas Vacías",
                                                                desc: "Ocultar si no tienen tareas",
                                                                value: hideEmptyMachines,
                                                                toggle: () =>
                                                                    onHideEmptyMachinesChange(!hideEmptyMachines),
                                                            },
                                                            {
                                                                label: "Modo Cascada",
                                                                desc: "Mover tareas consecutivas",
                                                                value: cascadeMode,
                                                                toggle: () => onCascadeModeChange(!cascadeMode),
                                                            },
                                                        ].map(({ label, desc, value, toggle }) => (
                                                            <div
                                                                key={label}
                                                                className="flex items-center justify-between"
                                                            >
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[11px] font-bold">
                                                                        {label}
                                                                    </span>
                                                                    <span className="text-[9px] leading-none text-muted-foreground">
                                                                        {desc}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    onClick={toggle}
                                                                    className={cn(
                                                                        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-all duration-300",
                                                                        value ? "bg-primary" : "bg-muted"
                                                                    )}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-300",
                                                                            value ? "left-5" : "left-1"
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-6 w-px bg-border" />

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                    <button
                        onClick={() => onZoomChange((prev) => Math.max(viewMode === "week" ? 0.8 : 0.5, prev - 0.25))}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
                        title="Reducir Zoom"
                    >
                        <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <div
                        className="flex w-12 cursor-pointer select-none justify-center px-1"
                        title="Doble click para restablecer (100%)"
                        onDoubleClick={() => onZoomChange(1)}
                    >
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                    </div>
                    <button
                        onClick={() => onZoomChange((prev) => Math.min(viewMode === "week" ? 10 : 3, prev + 0.25))}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
                        title="Aumentar Zoom"
                    >
                        <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Fullscreen Button */}
                {onToggleFullscreen && (
                    <button
                        id="planning-fullscreen"
                        onClick={onToggleFullscreen}
                        className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                        title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                    >
                        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                )}
            </div>
        );
    }
}
