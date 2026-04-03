"use client";

import { useState, useEffect } from "react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

interface UseGanttSettingsProps {
    allMachineNames: string[];
}

export function useGanttSettings({ allMachineNames }: UseGanttSettingsProps) {
    const {
        getGanttPrefs,
        updateGanttPref,
        getEvalPrefs,
        updateEvalPref,
        isLoading: prefsLoading,
    } = useUserPreferences();
    const ganttPrefs = getGanttPrefs();

    const [viewMode, setViewMode] = useState<"hour" | "day" | "week">("day");
    const [showDependencies, setShowDependencies] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [hideEmptyMachines, setHideEmptyMachines] = useState(true);
    const [cascadeMode, setCascadeMode] = useState(false);
    const [projectFilter, setProjectFilter] = useState<string[]>([]);
    const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set(allMachineNames));
    const [prefsInitialized, setPrefsInitialized] = useState(false);

    // Initialize all settings from persisted preferences once loaded
    useEffect(() => {
        if (!prefsLoading && !prefsInitialized) {
            if (ganttPrefs.viewMode) setViewMode(ganttPrefs.viewMode);
            if (ganttPrefs.showDependencies !== undefined) setShowDependencies(ganttPrefs.showDependencies);
            if (ganttPrefs.zoomLevel) setZoomLevel(ganttPrefs.zoomLevel);
            if (ganttPrefs.hideEmptyMachines !== undefined) setHideEmptyMachines(ganttPrefs.hideEmptyMachines);
            if (ganttPrefs.projectFilter) setProjectFilter(ganttPrefs.projectFilter);
            if (ganttPrefs.cascadeMode !== undefined) setCascadeMode(ganttPrefs.cascadeMode);
            setPrefsInitialized(true);
        }
    }, [prefsLoading, prefsInitialized, ganttPrefs]);

    // Initialize selectedMachines from preferences after allMachineNames are available
    useEffect(() => {
        if (prefsInitialized && ganttPrefs.selectedMachines && ganttPrefs.selectedMachines.length > 0) {
            const validMachines = ganttPrefs.selectedMachines.filter((m) => allMachineNames.includes(m));
            if (validMachines.length > 0) {
                setSelectedMachines(new Set(validMachines));
            }
        }
    }, [prefsInitialized, ganttPrefs.selectedMachines, allMachineNames]);

    // --- Handlers (update local state + persist preference) ---

    const handleViewModeChange = (newMode: "hour" | "day" | "week") => {
        setViewMode(newMode);
        setZoomLevel(1);
        updateGanttPref({ viewMode: newMode, zoomLevel: 1 });
    };

    const handleShowDependenciesChange = (value: boolean) => {
        setShowDependencies(value);
        updateGanttPref({ showDependencies: value });
    };

    const handleHideEmptyMachinesChange = (value: boolean) => {
        setHideEmptyMachines(value);
        updateGanttPref({ hideEmptyMachines: value });
    };

    const handleProjectFilterChange = (newFilter: string[]) => {
        setProjectFilter(newFilter);
        updateGanttPref({ projectFilter: newFilter });
    };

    const handleCascadeModeChange = (value: boolean) => {
        setCascadeMode(value);
        updateGanttPref({ cascadeMode: value });
    };

    const handleZoomChange = (newZoom: number | ((prev: number) => number)) => {
        setZoomLevel((prev) => {
            const resolved = typeof newZoom === "function" ? newZoom(prev) : newZoom;
            updateGanttPref({ zoomLevel: resolved });
            return resolved;
        });
    };

    const toggleMachine = (machineName: string) => {
        setSelectedMachines((prev) => {
            const next = new Set(prev);
            if (next.has(machineName)) next.delete(machineName);
            else next.add(machineName);
            updateGanttPref({ selectedMachines: Array.from(next) });
            return next;
        });
    };

    const selectAllMachines = () => {
        setSelectedMachines(new Set(allMachineNames));
        updateGanttPref({ selectedMachines: allMachineNames });
    };

    const clearAllMachines = () => {
        setSelectedMachines(new Set());
        updateGanttPref({ selectedMachines: [] });
    };

    return {
        // State
        viewMode,
        showDependencies,
        zoomLevel,
        hideEmptyMachines,
        cascadeMode,
        projectFilter,
        selectedMachines,
        prefsInitialized,
        prefsLoading,
        // Prefs passthrough (needed by useEvaluationFilters)
        getEvalPrefs,
        updateEvalPref,
        // Handlers
        handleViewModeChange,
        handleShowDependenciesChange,
        handleHideEmptyMachinesChange,
        handleProjectFilterChange,
        handleCascadeModeChange,
        handleZoomChange,
        toggleMachine,
        selectAllMachines,
        clearAllMachines,
    };
}
