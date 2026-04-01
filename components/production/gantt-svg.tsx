"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Image from "next/image";
// import { useRouter } from "next/navigation"; // Removed
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Lock, Unlock, FileText, FlaskConical } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { TaskModal } from "./task-modal";
import { getProductionTaskColor, buildColorMap } from "@/utils/production-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { snapToNearest15Minutes } from "@/lib/scheduling-utils";
import { es } from "date-fns/locale";
import {
    format,
    startOfDay,
    endOfDay,
    startOfISOWeek,
    endOfISOWeek,
    startOfMonth,
    endOfMonth,
    addDays,
    addHours,
    addMinutes,
    addWeeks,
    addMonths,
    addMilliseconds,
    subDays,
    isBefore,
    isAfter,
    differenceInMinutes,
    differenceInMilliseconds,
    getHours,
    getDay,
    getDate,
    getISOWeek,
    set,
} from "date-fns";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

export interface GanttSVGProps {
    initialMachines: Machine[];
    initialOrders: Order[];
    // initialTasks: PlanningTask[]; // Removed
    optimisticTasks: PlanningTask[]; // Added
    setOptimisticTasks: (value: React.SetStateAction<PlanningTask[]>) => void;
    searchQuery: string;
    viewMode: "hour" | "day" | "week";
    isFullscreen: boolean;
    selectedMachines: Set<string>;
    operators: string[];
    showDependencies: boolean;
    zoomLevel: number;
    setZoomLevel: (level: number | ((prev: number) => number)) => void;
    onHistorySnapshot: (state: PlanningTask[]) => void;
    readOnly?: boolean;
    onTaskDoubleClick?: (task: PlanningTask) => void;
    hideDateNavigation?: boolean;
    hideEmptyMachines?: boolean;
    modalData?: any;
    setModalData?: (data: any) => void;
    onToggleLock?: (taskId: string, locked: boolean) => void;
    cascadeMode?: boolean;
    container?: HTMLElement | null;
    startControls?: React.ReactNode;
    endControls?: React.ReactNode;
    focusTaskId?: string | null;
    projectFilter?: string[];
}

// Constants for the SVG Engine
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 50;
const SIDEBAR_WIDTH = 200;

// Width per unit based on view mode
const VIEW_MODE_CONFIG = {
    hour: { width: 100, unit: "hour" as const, format: "HH:mm" },
    day: { width: 150, unit: "day" as const, format: "DD MMM" },
    week: { width: 200, unit: "week" as const, format: "DD MMM" },
};

export function GanttSVG({
    initialMachines,
    initialOrders,
    optimisticTasks,
    setOptimisticTasks,
    searchQuery,
    viewMode,
    isFullscreen,
    selectedMachines,
    operators,
    showDependencies,
    zoomLevel,
    setZoomLevel,
    onHistorySnapshot,
    readOnly = false,
    onTaskDoubleClick,
    hideDateNavigation = false,
    hideEmptyMachines = false,
    modalData: externalModalData,
    setModalData: externalSetModalData,
    onToggleLock,
    cascadeMode = false,
    container,
    startControls,
    endControls,
    focusTaskId,
    projectFilter,
}: GanttSVGProps) {
    // View mode configuration
    const config = VIEW_MODE_CONFIG[viewMode];
    const UNIT_WIDTH = config.width * zoomLevel; // Apply Zoom

    // 1. Time Window State with view-specific date filter
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [dateRangeStart, setDateRangeStart] = useState(() => subDays(startOfDay(new Date()), 7));
    const [dateRangeEnd, setDateRangeEnd] = useState(() => addDays(startOfDay(new Date()), 14));

    // Calculate timeWindow based on viewMode
    const timeWindow = useMemo(() => {
        if (viewMode === "hour") {
            return {
                start: startOfDay(selectedDate),
                end: addHours(endOfDay(selectedDate), 1),
            };
        } else if (viewMode === "day") {
            return {
                start: startOfDay(dateRangeStart),
                end: endOfDay(dateRangeEnd),
            };
        } else {
            return {
                start: startOfISOWeek(dateRangeStart),
                end: endOfISOWeek(dateRangeEnd),
            };
        }
    }, [viewMode, selectedDate, dateRangeStart, dateRangeEnd]);

    // Automatically set default ranges when switching views
    useEffect(() => {
        if (viewMode === "day") {
            setDateRangeStart(startOfISOWeek(new Date()));
            setDateRangeEnd(endOfISOWeek(new Date()));
        } else if (viewMode === "week") {
            setDateRangeStart(startOfMonth(new Date()));
            setDateRangeEnd(endOfMonth(new Date()));
        }
        // For 'hour', we rely on selectedDate which defaults to today.
    }, [viewMode]);

    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    // Local state fallback if not provided (though we expect it provided)
    const [localModalData, setLocalModalData] = useState<any>(null);

    // Effective state
    const modalData = externalModalData !== undefined ? externalModalData : localModalData;
    const setModalData = externalSetModalData || setLocalModalData;

    const [draggingTask, setDraggingTask] = useState<{
        id: string;
        startX: number;
        initialX: number;
        initialDuration: number; // Added to fix duration drift
        cascadeIds?: string[];
    } | null>(null);
    const [resizingTask, setResizingTask] = useState<{
        id: string;
        startX: number;
        initialWidth: number;
        initialStart?: number;
        direction?: "left" | "right";
        dayStart?: number;
        dayEnd?: number;
    } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: PlanningTask } | null>(null);
    // Removed local state: savedTasks, optimisticTasks, isSaving

    // IDs of tasks that are currently overlapping with the dragged/resized task
    const [conflictingTaskIds, setConflictingTaskIds] = useState<Set<string>>(new Set());

    const [hoveredTask, setHoveredTask] = useState<PlanningTask | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; mode: "above" | "below" }>({
        x: 0,
        y: 0,
        mode: "below",
    });
    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll suppression refs
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>(undefined);

    // Initialize current time on client and update every minute
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Helper: Handle Scroll/Wheel events to suppress tooltips
    const handleScrollInteraction = () => {
        if (!isScrollingRef.current) {
            isScrollingRef.current = true;
            setHoveredTask(null);
        }

        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
        }, 150);
    };

    const snapshotRef = useRef<PlanningTask[]>([]); // Store state before interaction

    // Global Scroll Listener (in case window scrolls)
    useEffect(() => {
        window.addEventListener("scroll", handleScrollInteraction, { capture: true });
        return () => window.removeEventListener("scroll", handleScrollInteraction, { capture: true });
    }, []);

    // Auto-scroll to today on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayX = timeToX(new Date());
            // Center today in the viewport
            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollTo = Math.max(0, todayX - containerWidth / 3);
            scrollContainerRef.current.scrollLeft = scrollTo;
        }
    }, [viewMode, scrollContainerRef.current]); // Add dependencies if needed, or keep empty for mount only logic. Kept logical.

    // Removed Detect Changes logic (moved to parent)
    // Removed handleSave, handleDiscard logic (moved to parent)

    // 2. Project-aware color map — built once from all tasks to avoid same-project collisions
    const taskColorMap = useMemo(() => buildColorMap(optimisticTasks), [optimisticTasks]);

    // 3. Filter machines and tasks
    const filteredMachines = useMemo(() => {
        const uniqueNames = new Set([
            ...initialMachines.map((m) => m.name),
            ...optimisticTasks.map((t) => t.machine).filter((n): n is string => !!n),
        ]);
        // "Sin Máquina" only for non-treatment null-machine tasks
        if (optimisticTasks.some((t) => !t.machine && !(t as any).is_treatment)) uniqueNames.add("Sin Máquina");

        const machineMachines = Array.from(uniqueNames)
            .filter((name) => {
                const isSelected = selectedMachines.has(name);
                if (!isSelected) return false;

                // When a project filter is active, always hide machines with no project tasks
                if (hideEmptyMachines || projectFilter?.length || searchQuery) {
                    const q = searchQuery?.toLowerCase();
                    const hasTasksInWindow = optimisticTasks.some((t) => {
                        if (t.check_in && t.check_out) return false; // exclude completed tasks
                        const isThisMachine =
                            t.machine === name || (name === "Sin Máquina" && !t.machine && !(t as any).is_treatment);
                        if (!isThisMachine) return false;
                        if (projectFilter?.length && !projectFilter.includes(t.production_orders?.project_id ?? ""))
                            return false;
                        if (
                            q &&
                            !t.production_orders?.part_code?.toLowerCase().includes(q) &&
                            !t.production_orders?.part_name?.toLowerCase().includes(q)
                        )
                            return false;
                        const taskStart = new Date(t.planned_date!);
                        const taskEnd = new Date(t.planned_end!);
                        return isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
                    });
                    return hasTasksInWindow;
                }
                return true;
            })
            .sort();

        // Add "TRATAMIENTO" row at the end when there are treatment tasks visible
        const q = searchQuery?.toLowerCase();
        const hasTreatmentTasksInWindow = optimisticTasks.some((t) => {
            if (!(t as any).is_treatment) return false;
            if (t.check_in && t.check_out) return false; // exclude completed tasks
            if (projectFilter?.length && !projectFilter.includes(t.production_orders?.project_id ?? "")) return false;
            if (
                q &&
                !t.production_orders?.part_code?.toLowerCase().includes(q) &&
                !t.production_orders?.part_name?.toLowerCase().includes(q)
            )
                return false;
            const taskStart = new Date(t.planned_date!);
            const taskEnd = new Date(t.planned_end!);
            return isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
        });
        if (hasTreatmentTasksInWindow) machineMachines.push("TRATAMIENTO");

        return machineMachines;
    }, [initialMachines, optimisticTasks, selectedMachines, hideEmptyMachines, projectFilter, searchQuery, timeWindow]);

    // Filter tasks by machine, search, project, AND visible time window
    const filteredTasks = useMemo(() => {
        return optimisticTasks.filter((task) => {
            // Hide completed tasks (both check_in and check_out captured) — they clutter the Gantt
            if (task.check_in && task.check_out) return false;

            // Project filter (applied to all task types)
            if (projectFilter?.length && !projectFilter.includes(task.production_orders?.project_id ?? ""))
                return false;

            // Treatment tasks are always included when they have dates (rendered in TRATAMIENTO row)
            if ((task as any).is_treatment) {
                const taskStart = new Date(task.planned_date!);
                const taskEnd = new Date(task.planned_end!);
                const matchesSearch =
                    !searchQuery ||
                    task.production_orders?.part_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    task.production_orders?.part_name?.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesSearch && isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);
            }
            // Machine filter
            const matchesMachine = task.machine
                ? selectedMachines.has(task.machine)
                : selectedMachines.has("Sin Máquina");

            // Search filter
            const matchesSearch =
                !searchQuery ||
                task.production_orders?.part_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.production_orders?.part_name?.toLowerCase().includes(searchQuery.toLowerCase());

            // Time window filter - task must overlap with visible period
            const taskStart = new Date(task.planned_date!);
            const taskEnd = new Date(task.planned_end!);
            const matchesTime = isAfter(taskEnd, timeWindow.start) && isBefore(taskStart, timeWindow.end);

            return matchesMachine && matchesSearch && matchesTime;
        });
    }, [optimisticTasks, selectedMachines, searchQuery, projectFilter, timeWindow]);

    // 3. Absolute Coordinate Math (Critical for Alignment)
    const timeToX = (time: string | number | Date) => {
        if (!time) return 0;
        const mTime = new Date(time);
        const startMs = timeWindow.start.getTime();
        const currentMs = mTime.getTime();

        // Calculate difference based on view mode
        if (viewMode === "hour") {
            const diffHours = (currentMs - startMs) / (1000 * 60 * 60);
            return diffHours * UNIT_WIDTH;
        } else if (viewMode === "day") {
            const diffDays = (currentMs - startMs) / (1000 * 60 * 60 * 24);
            return diffDays * UNIT_WIDTH;
        } else {
            const diffWeeks = (currentMs - startMs) / (1000 * 60 * 60 * 24 * 7);
            return diffWeeks * UNIT_WIDTH;
        }
    };

    const xToTime = (x: number): Date => {
        const msPerUnit =
            viewMode === "hour" ? 1000 * 60 * 60 : viewMode === "day" ? 1000 * 60 * 60 * 24 : 1000 * 60 * 60 * 24 * 7;

        const diffMs = (x / UNIT_WIDTH) * msPerUnit;
        return addMilliseconds(timeWindow.start, diffMs);
    };

    const totalWidth = useMemo(() => {
        const diffMs = timeWindow.end.getTime() - timeWindow.start.getTime();
        if (viewMode === "hour") {
            return (diffMs / (1000 * 60 * 60)) * UNIT_WIDTH;
        } else if (viewMode === "day") {
            return (diffMs / (1000 * 60 * 60 * 24)) * UNIT_WIDTH;
        } else {
            return (diffMs / (1000 * 60 * 60 * 24 * 7)) * UNIT_WIDTH;
        }
    }, [timeWindow, viewMode, UNIT_WIDTH]);

    // Resolve treatment type name from a task (works for both draft and saved tasks)
    // Defined here (before taskLanes) so it can be used in lane allocation.
    const getTreatmentTypeName = (task: PlanningTask): string | null => {
        if ((task as any).treatment_type) return (task as any).treatment_type as string;
        const reg = task.register;
        if (!reg) return null;
        const m = reg.match(/^(\d+)-T$/);
        if (!m) return null;
        const stepIdx = parseInt(m[1]) - 1;
        const evaluation = (task.production_orders as any)?.evaluation as any[] | null;
        if (!evaluation || stepIdx < 0 || stepIdx >= evaluation.length) return null;
        return (evaluation[stepIdx]?.treatment as string) || null;
    };

    // Lane Allocation System
    // - Non-treatment tasks: grouped by machine + day (existing behavior)
    // - Treatment tasks: grouped by treatment TYPE so each type occupies its own dedicated lane band,
    //   preventing visual overlap between different treatment types.
    const taskLanes = useMemo(() => {
        const lanes: Map<string, number> = new Map();

        // ── Non-treatment tasks: group by machine|day ──
        const machineDayTaskGroups: Map<string, PlanningTask[]> = new Map();
        filteredTasks.forEach((task) => {
            if ((task as any).is_treatment) return;
            const machine = task.machine || "Sin Máquina";
            const day = format(new Date(task.planned_date!), "yyyy-MM-dd");
            const key = `${machine}|${day}`;
            if (!machineDayTaskGroups.has(key)) machineDayTaskGroups.set(key, []);
            machineDayTaskGroups.get(key)!.push(task);
        });

        machineDayTaskGroups.forEach((tasks) => {
            const sorted = [...tasks].sort(
                (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
            );
            const laneEnds: number[] = [];
            sorted.forEach((task) => {
                const taskStart = new Date(task.planned_date!).getTime();
                const taskEnd = new Date(task.planned_end!).getTime();
                let assignedLane = 0;
                for (let i = 0; i < laneEnds.length; i++) {
                    if (laneEnds[i] <= taskStart) {
                        assignedLane = i;
                        break;
                    }
                    assignedLane = i + 1;
                }
                if (assignedLane >= laneEnds.length) laneEnds.push(taskEnd);
                else laneEnds[assignedLane] = taskEnd;
                lanes.set(task.id, assignedLane);
            });
        });

        // ── Treatment tasks: each type gets its own dedicated lane band ──
        const treatmentByType = new Map<string, PlanningTask[]>();
        filteredTasks.forEach((task) => {
            if (!(task as any).is_treatment || !task.planned_date || !task.planned_end) return;
            const type = getTreatmentTypeName(task) || "__unknown__";
            if (!treatmentByType.has(type)) treatmentByType.set(type, []);
            treatmentByType.get(type)!.push(task);
        });

        // Sort types alphabetically so lane assignment is deterministic
        const sortedTypes = Array.from(treatmentByType.keys()).sort();
        let laneOffset = 0;
        sortedTypes.forEach((type) => {
            const tasks = treatmentByType.get(type)!;
            const sorted = [...tasks].sort(
                (a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime()
            );
            const laneEnds: number[] = [];
            let maxLane = 0;
            sorted.forEach((task) => {
                const taskStart = new Date(task.planned_date!).getTime();
                const taskEnd = new Date(task.planned_end!).getTime();
                let assignedLane = 0;
                for (let i = 0; i < laneEnds.length; i++) {
                    if (laneEnds[i] <= taskStart) {
                        assignedLane = i;
                        break;
                    }
                    assignedLane = i + 1;
                }
                if (assignedLane >= laneEnds.length) laneEnds.push(taskEnd);
                else laneEnds[assignedLane] = taskEnd;
                lanes.set(task.id, laneOffset + assignedLane);
                maxLane = Math.max(maxLane, assignedLane);
            });
            laneOffset += maxLane + 1;
        });

        return lanes;
    }, [filteredTasks]);

    // PRE-CALCULATE UTILIZATION FOR ALL MACHINES (Rules of Hooks Fix)
    const machineUtilizations = useMemo(() => {
        const stats = new Map<string, number>();
        const SHIFT_START = 6;
        const SHIFT_END = 22;
        const SHIFT_HOURS = SHIFT_END - SHIFT_START; // 16 hours

        filteredMachines.forEach((m) => {
            if (m === "TRATAMIENTO") {
                stats.set(m, 0);
                return;
            } // No utilization for treatment row
            const machineTasks = optimisticTasks.filter(
                (t) => !(t as any).is_treatment && (t.machine === m || (m === "Sin Máquina" && !t.machine))
            );
            if (machineTasks.length === 0) {
                stats.set(m, 0);
                return;
            }

            const viewStart = startOfDay(timeWindow.start);
            const viewEnd = endOfDay(addHours(timeWindow.end, -2));

            let totalShiftHours = 0;
            let occupiedHours = 0;

            let currentDayIter = new Date(viewStart);
            while (isBefore(currentDayIter, viewEnd)) {
                totalShiftHours += SHIFT_HOURS;

                const dayShiftStart = set(currentDayIter, {
                    hours: SHIFT_START,
                    minutes: 0,
                    seconds: 0,
                    milliseconds: 0,
                });
                const dayShiftEnd = set(currentDayIter, { hours: SHIFT_END, minutes: 0, seconds: 0, milliseconds: 0 });

                const dailyTasks = machineTasks
                    .filter((task) => {
                        const taskStart = new Date(task.planned_date!);
                        const taskEnd = new Date(task.planned_end!);
                        return isBefore(taskStart, dayShiftEnd) && isAfter(taskEnd, dayShiftStart);
                    })
                    .sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());

                let currentLaneEnd = 0;
                dailyTasks.forEach((task) => {
                    const taskStart = new Date(task.planned_date!);
                    const taskEnd = new Date(task.planned_end!);
                    if (taskStart.getTime() >= currentLaneEnd) {
                        if (isBefore(taskStart, dayShiftEnd) && isAfter(taskEnd, dayShiftStart)) {
                            const overlapStart = isAfter(taskStart, dayShiftStart) ? taskStart : dayShiftStart;
                            const overlapEnd = isBefore(taskEnd, dayShiftEnd) ? taskEnd : dayShiftEnd;

                            if (isAfter(overlapEnd, overlapStart)) {
                                occupiedHours += differenceInMilliseconds(overlapEnd, overlapStart) / (1000 * 60 * 60);
                                currentLaneEnd = taskEnd.getTime();
                            }
                        }
                        currentLaneEnd = Math.max(currentLaneEnd, taskEnd.getTime());
                    }
                });

                currentDayIter = addDays(currentDayIter, 1);
            }

            const ut = totalShiftHours === 0 ? 0 : Math.min(100, Math.round((occupiedHours / totalShiftHours) * 100));
            stats.set(m, ut);
        });

        return stats;
    }, [optimisticTasks, timeWindow, filteredMachines]);

    // Constants for bar sizing
    const BAR_HEIGHT = 36;
    const BAR_GAP = 4;
    const ROW_PADDING = 8;
    const BATCH_INDICATOR_HEIGHT = 20; // extra px at the bottom of TRATAMIENTO for batch labels

    // Calculate max lanes per machine (global across all days)
    const machineLaneCounts = useMemo(() => {
        const counts: Map<string, number> = new Map();

        filteredTasks.forEach((task) => {
            const machine = (task as any).is_treatment ? "TRATAMIENTO" : task.machine || "Sin Máquina";
            const lane = taskLanes.get(task.id) || 0;
            const current = counts.get(machine) || 0;
            counts.set(machine, Math.max(current, lane + 1));
        });

        return counts;
    }, [filteredTasks, taskLanes]);

    // Group treatment tasks by type → used for the per-type legend strip and extra row height.
    // All treatment types are included (not just batches) so the legend always shows.
    const treatmentBatchGroups = useMemo(() => {
        const groups = new Map<string, PlanningTask[]>();
        filteredTasks.forEach((task) => {
            if (!(task as any).is_treatment || !task.planned_date || !task.planned_end) return;
            const name = getTreatmentTypeName(task);
            if (!name) return;
            const key = name.toLowerCase().trim();
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(task);
        });
        return groups;
    }, [filteredTasks]);

    // Calculate machine height based on its max lanes
    const getMachineHeight = (machine: string) => {
        const lanes = machineLaneCounts.get(machine) || 1;
        const base = ROW_PADDING * 2 + lanes * BAR_HEIGHT + (lanes - 1) * BAR_GAP;
        // Reserve extra space at the bottom of the TRATAMIENTO row for batch indicators
        return machine === "TRATAMIENTO" && treatmentBatchGroups.size > 0 ? base + BATCH_INDICATOR_HEIGHT : base;
    };

    // Dynamic Y offsets - each machine height based on its max lanes
    const machineYOffsets = useMemo(() => {
        const offsets: Map<string, number> = new Map();
        let currentY = 0;

        filteredMachines.forEach((machine) => {
            offsets.set(machine, currentY);
            currentY += getMachineHeight(machine);
        });

        return offsets;
    }, [filteredMachines, machineLaneCounts, treatmentBatchGroups]);

    // Dynamic total height
    const totalHeight = useMemo(() => {
        let height = 0;
        filteredMachines.forEach((machine) => {
            height += getMachineHeight(machine);
        });
        return height;
    }, [filteredMachines, machineLaneCounts, treatmentBatchGroups]);

    // Calculate Dependency Lines
    const dependencyLines = useMemo(() => {
        const lines: React.ReactNode[] = [];
        const tasksByOrder = new Map<string, PlanningTask[]>();

        // Group by Order
        filteredTasks.forEach((task) => {
            if (task.order_id) {
                const oid = String(task.order_id);
                if (!tasksByOrder.has(oid)) {
                    tasksByOrder.set(oid, []);
                }
                tasksByOrder.get(oid)!.push(task);
            }
        });

        // Generate Lines
        tasksByOrder.forEach((groupTasks, orderId) => {
            if (groupTasks.length < 2) return;

            // Sort by start date
            groupTasks.sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());

            for (let i = 0; i < groupTasks.length - 1; i++) {
                const startTask = groupTasks[i];
                const endTask = groupTasks[i + 1];

                // Treatment tasks live in the "TRATAMIENTO" row, not "Sin Máquina"
                const startMachine = (startTask as any).is_treatment
                    ? "TRATAMIENTO"
                    : startTask.machine || "Sin Máquina";
                const endMachine = (endTask as any).is_treatment ? "TRATAMIENTO" : endTask.machine || "Sin Máquina";

                // Skip lines whose machine rows aren't in the current view
                if (!machineYOffsets.has(startMachine) || !machineYOffsets.has(endMachine)) continue;

                // Get Coordinates
                const startY =
                    (machineYOffsets.get(startMachine) || 0) +
                    ROW_PADDING +
                    (taskLanes.get(startTask.id) || 0) * (BAR_HEIGHT + BAR_GAP) +
                    BAR_HEIGHT / 2;
                const endY =
                    (machineYOffsets.get(endMachine) || 0) +
                    ROW_PADDING +
                    (taskLanes.get(endTask.id) || 0) * (BAR_HEIGHT + BAR_GAP) +
                    BAR_HEIGHT / 2;

                const startX = timeToX(new Date(startTask.planned_end!));
                const endX = timeToX(new Date(endTask.planned_date!));

                // Determine line type:
                // - "continuation": two segments of the same step (same register, same machine)
                // - "treatment": one of the tasks is a treatment step
                // - "step": normal dependency between different production steps
                const isContinuation =
                    !!(startTask as any).register &&
                    startTask.register === endTask.register &&
                    startMachine === endMachine;
                const involvesTreatment = !!(startTask as any).is_treatment || !!(endTask as any).is_treatment;

                // All dependency lines use the order's color (consistent with task bars)
                const lineColor = getProductionTaskColor(startTask, taskColorMap);

                // Bezier Curve
                const controlOffset = Math.min(Math.abs(endX - startX) / 2, 50);
                const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

                lines.push(
                    <path
                        key={`dep-${startTask.id}-${endTask.id}`}
                        d={path}
                        stroke={lineColor}
                        strokeWidth={isContinuation ? 1 : 1.5}
                        strokeOpacity={isContinuation ? 0.25 : involvesTreatment ? 0.6 : 0.4}
                        strokeDasharray={isContinuation ? "4 3" : "none"}
                        fill="none"
                        className="pointer-events-none"
                    />
                );
            }
        });

        return lines;
    }, [filteredTasks, machineYOffsets, taskLanes, viewMode, dateRangeStart, timeToX, showDependencies]); // Re-calc on zoom (timeToX changes) and toggle

    // 4. Interaction Handlers
    const handleCanvasDoubleClick = (e: React.MouseEvent) => {
        if (readOnly || draggingTask) return;
        const rect = e.currentTarget.getBoundingClientRect();
        // The click is relative to the scroll container (already excludes sidebar)
        // Just add scroll position to get the SVG coordinate
        const x = e.clientX - rect.left + scrollPos.x;
        const y = e.clientY - rect.top + scrollPos.y;

        // Dynamic Machine Detection based on variable row heights
        let foundMachine = null;
        let currentY = 0;
        for (const m of filteredMachines) {
            const h = getMachineHeight(m);
            if (y >= currentY && y < currentY + h) {
                foundMachine = m;
                break;
            }
            currentY += h;
        }

        // Convert X to time and snap to nearest 15 minutes
        const rawTime = xToTime(x);
        const snappedTime = snapToNearest15Minutes(rawTime);

        if (foundMachine) {
            // Block creating treatment tasks on weekends
            if (foundMachine === "TRATAMIENTO") {
                const day = getDay(snappedTime);
                if (day === 0 || day === 6) return;
            }
            setModalData({
                machine: foundMachine,
                time: snappedTime.valueOf(),
            });
        }
    };

    const onMouseDown = (e: React.MouseEvent, task: PlanningTask) => {
        const now = currentTime || new Date();
        const isFinishedOrRunning = !!task.check_in || !!task.check_out || isBefore(new Date(task.planned_date!), now);
        const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

        if (readOnly) return;
        if (isLocked) return;
        e.stopPropagation();
        setHoveredTask(null);

        snapshotRef.current = optimisticTasks;

        const cascadeIds: string[] = [];
        if (cascadeMode) {
            const taskEnd = new Date(task.planned_end!);
            const sameMachine = optimisticTasks
                .filter((t) => t.machine === task.machine && t.id !== task.id)
                .filter((t) => {
                    const isFinishedOrRunning =
                        !!t.check_in || !!t.check_out || isBefore(new Date(t.planned_date!), now);
                    const isLocked = !t.isDraft && (t.locked === true || (t.locked !== false && isFinishedOrRunning));
                    return !isLocked;
                })
                .sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());

            for (const t of sameMachine) {
                if (!isBefore(new Date(t.planned_date!), taskEnd)) {
                    cascadeIds.push(t.id);
                }
            }
        }

        setDraggingTask({
            id: task.id,
            startX: e.clientX,
            initialX: timeToX(task.planned_date!),
            initialDuration: new Date(task.planned_end!).getTime() - new Date(task.planned_date!).getTime(),
            cascadeIds,
        });
    };

    const onResizeStart = (e: React.MouseEvent, task: PlanningTask, direction: "left" | "right") => {
        const now = currentTime || new Date();
        const isFinishedOrRunning = !!task.check_in || !!task.check_out || isBefore(new Date(task.planned_date!), now);
        const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

        if (readOnly) return;
        if (isLocked) return;
        e.stopPropagation();
        setHoveredTask(null);

        snapshotRef.current = optimisticTasks;

        const startDay = startOfDay(new Date(task.planned_date!)).getTime();
        const endDay = endOfDay(new Date(task.planned_date!)).getTime();

        setResizingTask({
            id: task.id,
            startX: e.clientX,
            initialWidth: timeToX(task.planned_end!) - timeToX(task.planned_date!),
            initialStart: timeToX(task.planned_date!),
            direction,
            dayStart: startDay,
            dayEnd: endDay,
        });
    };

    /** Compute which tasks overlap with the active task and update conflictingTaskIds. */
    const updateConflicts = (activeId: string, tasks: PlanningTask[]) => {
        const active = tasks.find((t) => t.id === activeId);
        if (!active?.planned_date || !active?.planned_end || !active.machine) {
            setConflictingTaskIds(new Set());
            return;
        }
        const s1 = new Date(active.planned_date).getTime();
        const e1 = new Date(active.planned_end).getTime();
        const conflicts = new Set<string>();
        tasks.forEach((other) => {
            if (other.id === activeId || other.machine !== active.machine) return;
            if (!other.planned_date || !other.planned_end) return;
            const s2 = new Date(other.planned_date).getTime();
            const e2 = new Date(other.planned_end).getTime();
            if (s1 < e2 && e1 > s2) {
                conflicts.add(other.id);
                conflicts.add(activeId);
            }
        });
        setConflictingTaskIds(conflicts);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (draggingTask) {
            const deltaX = e.clientX - draggingTask.startX;
            const newX = draggingTask.initialX + deltaX;
            let newStartTime = xToTime(newX);

            // Snap to 15 mins
            newStartTime = snapToNearest15Minutes(newStartTime);

            // Treatment tasks: no weekends
            const isDraggingTreatment = optimisticTasks.some(
                (t) => t.id === draggingTask.id && (t as any).is_treatment
            );
            if (isDraggingTreatment) newStartTime = snapTreatmentToWeekday(newStartTime);

            const originalStart = xToTime(draggingTask.initialX);
            const deltaMs = newStartTime.getTime() - originalStart.getTime();

            setOptimisticTasks((prev) => {
                const updated = prev.map((t) => {
                    if (t.id === draggingTask.id) {
                        return {
                            ...t,
                            planned_date: format(newStartTime, "yyyy-MM-dd'T'HH:mm:ss"),
                            planned_end: format(
                                addMilliseconds(newStartTime, draggingTask.initialDuration),
                                "yyyy-MM-dd'T'HH:mm:ss"
                            ),
                        };
                    }
                    if (draggingTask.cascadeIds?.includes(t.id)) {
                        const origStart = new Date(snapshotRef.current.find((s) => s.id === t.id)?.planned_date!);
                        const origEnd = new Date(snapshotRef.current.find((s) => s.id === t.id)?.planned_end!);
                        return {
                            ...t,
                            planned_date: format(addMilliseconds(origStart, deltaMs), "yyyy-MM-dd'T'HH:mm:ss"),
                            planned_end: format(addMilliseconds(origEnd, deltaMs), "yyyy-MM-dd'T'HH:mm:ss"),
                        };
                    }
                    return t;
                });
                updateConflicts(draggingTask.id, updated);
                return updated;
            });
        } else if (resizingTask) {
            const deltaX = e.clientX - resizingTask.startX;
            const direction = resizingTask.direction || "right";
            const limitStart = resizingTask.dayStart ? new Date(resizingTask.dayStart) : null;
            const limitEnd = resizingTask.dayEnd ? new Date(resizingTask.dayEnd) : null;
            const isResizingTreatment = optimisticTasks.some(
                (t) => t.id === resizingTask.id && (t as any).is_treatment
            );

            setOptimisticTasks((prev) => {
                const updated = prev.map((t) => {
                    if (t.id === resizingTask.id) {
                        if (direction === "right") {
                            const newWidth = Math.max(10, resizingTask.initialWidth + deltaX);
                            let newEndTime = xToTime(timeToX(t.planned_date!) + newWidth);
                            newEndTime = snapToNearest15Minutes(newEndTime);
                            if (isResizingTreatment) newEndTime = snapTreatmentToWeekday(newEndTime);

                            if (limitEnd && isAfter(newEndTime, limitEnd)) {
                                newEndTime = new Date(limitEnd);
                            }

                            const currentStart = new Date(t.planned_date!);
                            if (differenceInMinutes(newEndTime, currentStart) < 15) {
                                newEndTime = addMinutes(currentStart, 15);
                            }

                            return { ...t, planned_end: format(newEndTime, "yyyy-MM-dd'T'HH:mm:ss") };
                        } else {
                            const newX =
                                (resizingTask.initialStart || 0) + Math.min(deltaX, resizingTask.initialWidth - 10);
                            let newStartDate = xToTime(newX);
                            newStartDate = snapToNearest15Minutes(newStartDate);
                            if (isResizingTreatment) newStartDate = snapTreatmentToWeekday(newStartDate);

                            if (limitStart && isBefore(newStartDate, limitStart)) {
                                newStartDate = new Date(limitStart);
                            }

                            const currentEnd = new Date(t.planned_end!);
                            if (differenceInMinutes(currentEnd, newStartDate) < 15) {
                                newStartDate = addMinutes(currentEnd, -15);
                            }

                            return { ...t, planned_date: format(newStartDate, "yyyy-MM-dd'T'HH:mm:ss") };
                        }
                    }
                    return t;
                });
                updateConflicts(resizingTask.id, updated);
                return updated;
            });
        }
    };

    const onMouseUp = async () => {
        // If changed, commit history
        if (draggingTask || resizingTask) {
            const hasChanged = JSON.stringify(snapshotRef.current) !== JSON.stringify(optimisticTasks);
            if (hasChanged) {
                onHistorySnapshot(snapshotRef.current);
            }
        }

        // Clear interaction state and conflict highlights
        setDraggingTask(null);
        setResizingTask(null);
        setConflictingTaskIds(new Set());
    };

    // 5. Grid Helpers - Generate columns based on view mode
    /** Snap a treatment date to the next weekday (Mon-Fri) if it falls on Sat/Sun */
    const snapTreatmentToWeekday = (date: Date): Date => {
        const day = getDay(date); // 0=Sun, 6=Sat
        if (day === 6) return addDays(date, 2); // Sat → Mon
        if (day === 0) return addDays(date, 1); // Sun → Mon
        return date;
    };

    /** Weekend shading rects for the TRATAMIENTO row (all view modes) */
    const treatmentWeekendRects = useMemo(() => {
        if (!machineYOffsets.has("TRATAMIENTO")) return [] as { x: number; width: number; y: number; height: number }[];
        const rects: { x: number; width: number; y: number; height: number }[] = [];
        const treatY = machineYOffsets.get("TRATAMIENTO")!;
        const rowH = getMachineHeight("TRATAMIENTO");
        let day = startOfDay(timeWindow.start);
        while (isBefore(day, timeWindow.end)) {
            const d = getDay(day);
            if (d === 0 || d === 6) {
                const x1 = timeToX(day);
                const x2 = timeToX(addDays(day, 1));
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1, y: treatY, height: rowH });
            }
            day = addDays(day, 1);
        }
        return rects;
    }, [machineYOffsets, timeWindow, timeToX, machineLaneCounts, treatmentBatchGroups]);

    /** Off-hours rectangles for hour view: 00:00-06:00 and 22:00-24:00 each day */
    const offHourRects = useMemo(() => {
        if (viewMode !== "hour") return [];
        const rects: { x: number; width: number }[] = [];
        let day = startOfDay(timeWindow.start);
        while (isBefore(day, timeWindow.end)) {
            // Before shift: 00:00 – 06:00
            const nightStart = day;
            const nightEnd = set(day, { hours: 6, minutes: 0, seconds: 0, milliseconds: 0 });
            if (isBefore(nightStart, timeWindow.end) && isAfter(nightEnd, timeWindow.start)) {
                const x1 = timeToX(nightStart);
                const x2 = timeToX(nightEnd);
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1 });
            }
            // After shift: 22:00 – 24:00 (next midnight)
            const eveningStart = set(day, { hours: 22, minutes: 0, seconds: 0, milliseconds: 0 });
            const eveningEnd = addDays(day, 1);
            if (isBefore(eveningStart, timeWindow.end) && isAfter(eveningEnd, timeWindow.start)) {
                const x1 = timeToX(eveningStart);
                const x2 = timeToX(eveningEnd);
                if (x2 > x1) rects.push({ x: x1, width: x2 - x1 });
            }
            day = addDays(day, 1);
        }
        return rects;
    }, [viewMode, timeWindow, timeToX]);

    const timeColumns = useMemo(() => {
        const columns = [];
        let curr = new Date(timeWindow.start);

        while (isBefore(curr, timeWindow.end)) {
            const h = getHours(curr);
            const isOffHour = viewMode === "hour" && (h < 6 || h >= 22);
            const isSpecial =
                viewMode === "hour"
                    ? getHours(curr) === 0
                    : viewMode === "day"
                      ? getDay(curr) === 1 // Monday
                      : getDate(curr) === 1; // First of month

            columns.push({
                time: new Date(curr),
                x: timeToX(curr),
                label:
                    viewMode === "hour"
                        ? format(curr, "HH:mm")
                        : viewMode === "day"
                          ? format(curr, "dd MMM", { locale: es })
                          : `Sem ${getISOWeek(curr)}`,
                dateLabel: format(curr, "dd MMM", { locale: es }),
                isSpecial,
                isOffHour,
            });

            if (viewMode === "hour") {
                curr = addHours(curr, 1);
            } else if (viewMode === "day") {
                curr = addDays(curr, 1);
            } else {
                curr = addWeeks(curr, 1);
            }
        }
        return columns;
    }, [timeWindow.start, timeWindow.end, viewMode, zoomLevel, UNIT_WIDTH]);

    // Date navigation functions
    const navigateDate = (direction: "prev" | "next" | "today") => {
        if (viewMode === "hour") {
            // Hour view: navigate by day
            if (direction === "today") {
                setSelectedDate(startOfDay(new Date()));
                setTimeout(() => scrollToNow(), 100);
            } else {
                const shift = direction === "prev" ? -1 : 1;
                setSelectedDate((prev) => addDays(prev, shift));
            }
        } else {
            if (direction === "today") {
                if (viewMode === "day") {
                    setDateRangeStart(startOfISOWeek(new Date()));
                    setDateRangeEnd(endOfISOWeek(new Date()));
                } else {
                    setDateRangeStart(startOfMonth(new Date()));
                    setDateRangeEnd(endOfMonth(new Date()));
                }
                setTimeout(() => scrollToNow(), 100);
            } else {
                const shiftDir = direction === "prev" ? -1 : 1;

                if (viewMode === "day") {
                    setDateRangeStart((prev) => startOfISOWeek(addWeeks(prev, shiftDir)));
                    setDateRangeEnd((prev) => endOfISOWeek(addWeeks(prev, shiftDir)));
                } else {
                    setDateRangeStart((prev) => startOfMonth(addMonths(prev, shiftDir)));
                    setDateRangeEnd((prev) => endOfMonth(addMonths(prev, shiftDir)));
                }
            }
        }
    };

    // Close Context Menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // Scroll to current time position
    const scrollToNow = () => {
        if (!scrollContainerRef.current) return;

        const now = new Date();
        const nowX = timeToX(now);
        const containerWidth = scrollContainerRef.current.clientWidth;

        // Center "now" in the viewport (approximately 1/3 from left)
        const scrollX = Math.max(0, nowX - containerWidth / 3);

        scrollContainerRef.current.scrollTo({
            left: scrollX,
            behavior: "smooth",
        });
    };

    // Scroll to and highlight focused task
    useEffect(() => {
        if (!focusTaskId || !scrollContainerRef.current) return;

        const task = optimisticTasks.find((t) => t.id === focusTaskId);
        if (!task || !task.planned_date) return;

        const x = timeToX(task.planned_date);
        const machine = (task as any).is_treatment ? "TRATAMIENTO" : task.machine || "Sin Máquina";
        const yOffset = machineYOffsets.get(machine) || 0;
        const lane = taskLanes.get(task.id) || 0;
        const y = yOffset + lane * 40 + 10; // 10 is padding in g group

        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        container.scrollTo({
            left: Math.max(0, x - containerWidth / 3),
            top: Math.max(0, y - containerHeight / 2),
            behavior: "smooth",
        });
    }, [focusTaskId, optimisticTasks, timeToX, machineYOffsets, taskLanes]);

    return (
        <div className="relative flex flex-1 select-none flex-col overflow-hidden bg-background">
            {/* Gantt Header Bar */}
            <div className="z-[50] flex h-10 flex-none items-center gap-2 border-b border-border bg-muted/30 px-4">
                {/* Start Controls (View Mode Buttons) */}
                {startControls}

                {/* Date Navigation - right of view buttons */}
                {!hideDateNavigation && (
                    <>
                        <div className="h-6 w-px bg-border" />
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigateDate("prev")}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Anterior"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => navigateDate("today")}
                                className="flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-primary transition-colors hover:bg-primary/20"
                                title="Volver a hoy"
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-tight">Hoy</span>
                            </button>
                            <button
                                onClick={() => navigateDate("next")}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Siguiente"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {viewMode === "hour" ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            className="flex items-center gap-1.5 rounded-md p-1 text-[10px] font-black uppercase tracking-tight text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            title="Seleccionar fecha"
                                        >
                                            {format(selectedDate, "EEEE - dd/MMMM/yyyy", { locale: es }).toUpperCase()}
                                            <ChevronRight className="h-3 w-3 rotate-90 opacity-40" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        container={container}
                                        className="z-[10001] w-auto p-0"
                                        align="start"
                                        side="bottom"
                                        sideOffset={10}
                                    >
                                        <CalendarUI
                                            mode="single"
                                            selected={selectedDate}
                                            defaultMonth={selectedDate}
                                            onSelect={(date) => date && setSelectedDate(date)}
                                            initialFocus
                                            locale={es}
                                            className="rounded-xl border-border bg-background/95 shadow-2xl backdrop-blur-md"
                                        />
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="h-7 min-w-[100px] justify-start rounded-md border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium shadow-sm hover:border-primary/40 focus:border-primary"
                                            >
                                                <Calendar className="mr-1.5 h-3 w-3 text-muted-foreground" />
                                                <span className="capitalize">
                                                    {format(dateRangeStart, "EEEE dd/MM/yyyy", { locale: es })}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            container={container}
                                            className="z-[10001] w-auto p-0"
                                            align="start"
                                        >
                                            <CalendarUI
                                                mode="single"
                                                selected={dateRangeStart}
                                                defaultMonth={dateRangeStart}
                                                onSelect={(date) => date && setDateRangeStart(date)}
                                                initialFocus
                                                locale={es}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <span className="text-[10px] font-bold text-muted-foreground">→</span>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="h-7 min-w-[100px] justify-start rounded-md border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium shadow-sm hover:border-primary/40 focus:border-primary"
                                            >
                                                <Calendar className="mr-1.5 h-3 w-3 text-muted-foreground" />
                                                <span className="capitalize">
                                                    {format(dateRangeEnd, "EEEE dd/MM/yyyy", { locale: es })}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            container={container}
                                            className="z-[10001] w-auto p-0"
                                            align="end"
                                        >
                                            <CalendarUI
                                                mode="single"
                                                selected={dateRangeEnd}
                                                defaultMonth={dateRangeEnd}
                                                onSelect={(date) => date && setDateRangeEnd(date)}
                                                initialFocus
                                                locale={es}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Spacer to push remaining items right */}
                <div className="flex-1" />

                {/* End Controls (Search, Filters, Zoom, Fullscreen, Settings) */}
                {endControls}
            </div>

            <div className="relative flex flex-1 overflow-hidden">
                {/* Fixed Machine Sidebar */}
                <div className="z-[40] flex w-[200px] flex-shrink-0 flex-col border-r border-border bg-background shadow-2xl transition-colors dark:bg-[#0a0a0a]">
                    {/* Sidebar Header */}
                    <div className="flex h-[50px] flex-shrink-0 items-center border-b border-border bg-muted/30 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">
                        Máquinas
                    </div>
                    {/* Machine List - scrolls with Y */}
                    <div className="flex-1 overflow-hidden">
                        <div className="flex flex-col" style={{ transform: `translateY(${-scrollPos.y}px)` }}>
                            {filteredMachines.map((m, i) => {
                                const isTreatmentRow = m === "TRATAMIENTO";
                                const utilization = machineUtilizations.get(m) || 0;

                                let badgeColor = "bg-muted text-muted-foreground";
                                if (utilization > 85) badgeColor = "bg-green-500/20 text-green-600";
                                else if (utilization > 50) badgeColor = "bg-blue-500/20 text-blue-600";
                                else if (utilization > 0) badgeColor = "bg-gray-500/20 text-gray-600";

                                return (
                                    <div
                                        key={i}
                                        className={`flex flex-shrink-0 items-center justify-between border-b border-border/10 px-4 text-[11px] font-black uppercase tracking-tight transition-colors ${
                                            isTreatmentRow
                                                ? "border-t border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                                                : `text-foreground/70 hover:bg-muted/50 hover:text-foreground ${i % 2 === 1 ? "bg-foreground/[0.03]" : ""}`
                                        }`}
                                        style={{ height: getMachineHeight(m) }}
                                    >
                                        <span className="mr-2 flex items-center gap-1.5 truncate" title={m}>
                                            {isTreatmentRow && <FlaskConical className="h-3 w-3 shrink-0" />}
                                            {m}
                                        </span>
                                        {!isTreatmentRow && utilization > 0 && (
                                            <span
                                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${badgeColor}`}
                                            >
                                                {utilization}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Header + Grid) */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Time Header - Fixed at top, scrolls with X */}
                    <div className="relative h-[50px] flex-shrink-0 overflow-hidden border-b border-border bg-background/90 backdrop-blur-md">
                        <div
                            className="absolute left-0 top-0 h-full"
                            style={{
                                width: totalWidth,
                                transform: `translateX(${-scrollPos.x}px)`,
                            }}
                        >
                            {timeColumns.map((col, i) => (
                                <div
                                    key={i}
                                    className={`flex h-full flex-col items-center justify-center border-r border-border/30 text-[9px] font-black transition-colors ${col.isSpecial ? "border-primary/20 bg-primary/10 text-primary" : col.isOffHour ? "bg-foreground/[0.04] text-foreground/20" : "text-foreground/40"}`}
                                    style={{
                                        width: UNIT_WIDTH,
                                        position: "absolute",
                                        left: col.x,
                                        top: 0,
                                    }}
                                >
                                    {viewMode === "hour" && (
                                        <div className="text-[7px] uppercase text-foreground/30">{col.dateLabel}</div>
                                    )}
                                    <div className={`text-[10px] ${col.isSpecial ? "font-black text-primary" : ""}`}>
                                        {col.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SVG Content Area - Scrolls both X and Y */}
                    <div
                        ref={scrollContainerRef}
                        className="relative flex-1 overflow-auto bg-background/5 dark:bg-[#050505]"
                        onScroll={(e) => {
                            setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop });
                            handleScrollInteraction(); // Use reusable handler
                        }}
                        onWheel={handleScrollInteraction} // Capture wheel events early
                        onDoubleClick={handleCanvasDoubleClick}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        <svg width={totalWidth} height={totalHeight} style={{ display: "block" }}>
                            <defs>
                                <pattern
                                    id="draftPattern"
                                    patternUnits="userSpaceOnUse"
                                    width="10"
                                    height="10"
                                    patternTransform="rotate(45)"
                                >
                                    <line
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="10"
                                        stroke="white"
                                        strokeOpacity="0.15"
                                        strokeWidth="4"
                                    />
                                </pattern>
                            </defs>
                            {/* Vertical Grid Lines */}
                            {timeColumns.map((col, i) => (
                                <line
                                    key={`vline-${i}`}
                                    x1={col.x}
                                    y1={0}
                                    x2={col.x}
                                    y2={totalHeight}
                                    className={col.isSpecial ? "stroke-primary/30" : "stroke-foreground/10"}
                                    strokeWidth={col.isSpecial ? 2 : 1}
                                />
                            ))}

                            {/* Alternating Machine Backgrounds */}
                            {filteredMachines.map((machine, i) => {
                                const y = machineYOffsets.get(machine) || 0;
                                const height = getMachineHeight(machine);
                                return i % 2 === 1 ? (
                                    <rect
                                        key={`bg-${i}`}
                                        x={0}
                                        y={y}
                                        width={totalWidth}
                                        height={height}
                                        className="fill-foreground/[0.03]"
                                    />
                                ) : null;
                            })}

                            {/* Off-Hours Shading (hour view only: 00-06 and 22-24) */}
                            {offHourRects.map((r, i) => (
                                <rect
                                    key={`offhour-${i}`}
                                    x={r.x}
                                    y={0}
                                    width={r.width}
                                    height={totalHeight}
                                    className="pointer-events-none fill-foreground/[0.06]"
                                />
                            ))}

                            {/* Weekend shading for TRATAMIENTO row */}
                            {treatmentWeekendRects.map((r, i) => (
                                <rect
                                    key={`treat-weekend-${i}`}
                                    x={r.x}
                                    y={r.y}
                                    width={r.width}
                                    height={r.height}
                                    fill="#ef4444"
                                    fillOpacity={0.07}
                                    className="pointer-events-none"
                                />
                            ))}

                            {/* Tasks */}

                            {/* Treatment batch indicators – rendered behind everything else */}
                            {machineYOffsets.has("TRATAMIENTO") &&
                                Array.from(treatmentBatchGroups.entries()).map(([typeKey, batchTasks]) => {
                                    const minStartMs = Math.min(
                                        ...batchTasks.map((t) => new Date(t.planned_date!).getTime())
                                    );
                                    const maxEndMs = Math.max(
                                        ...batchTasks.map((t) => new Date(t.planned_end!).getTime())
                                    );
                                    const bx = timeToX(new Date(minStartMs));
                                    const bw = Math.max(timeToX(new Date(maxEndMs)) - bx, 0);
                                    const treatY = machineYOffsets.get("TRATAMIENTO")!;
                                    const rowH = getMachineHeight("TRATAMIENTO");
                                    const stripY = treatY + rowH - BATCH_INDICATOR_HEIGHT + 2;
                                    const displayName = getTreatmentTypeName(batchTasks[0]) || typeKey;
                                    const orderCount = new Set(batchTasks.map((t) => t.order_id)).size;
                                    const label =
                                        orderCount > 1
                                            ? `🧪 Lote: ${displayName} · ${orderCount} órdenes`
                                            : `🧪 ${displayName}`;
                                    return (
                                        <g key={`batch-${typeKey}`} className="pointer-events-none">
                                            {/* Faint window behind all bars for this type */}
                                            <rect
                                                x={bx}
                                                y={treatY}
                                                width={bw}
                                                height={rowH - BATCH_INDICATOR_HEIGHT}
                                                fill="#6366f1"
                                                fillOpacity={0.05}
                                            />
                                            {/* Indicator strip at the bottom */}
                                            <rect
                                                x={bx}
                                                y={stripY}
                                                width={bw}
                                                height={15}
                                                rx={3}
                                                fill="#6366f1"
                                                fillOpacity={0.18}
                                                stroke="#6366f1"
                                                strokeOpacity={0.45}
                                                strokeWidth={1}
                                            />
                                            <text
                                                x={bx + 6}
                                                y={stripY + 11}
                                                fontSize={9}
                                                fontWeight={700}
                                                fill="#6366f1"
                                                fillOpacity={0.9}
                                            >
                                                {label}
                                            </text>
                                        </g>
                                    );
                                })}

                            {/* Dependency Lines (Behind tasks) */}
                            {showDependencies && dependencyLines}

                            {filteredTasks.map((task) => {
                                const isTreatmentTask = !!(task as any).is_treatment;
                                const machine = isTreatmentTask ? "TRATAMIENTO" : task.machine || "Sin Máquina";
                                const machineY = machineYOffsets.get(machine) || 0;
                                const lane = taskLanes.get(task.id) || 0;

                                const x = timeToX(task.planned_date!);
                                const width = Math.max(timeToX(task.planned_end!) - x, 0);

                                // Fixed bar height, positioned by lane within dynamic row
                                const y = machineY + ROW_PADDING + lane * (BAR_HEIGHT + BAR_GAP);
                                const height = BAR_HEIGHT;

                                const isDragging = draggingTask?.id === task.id;
                                const isResizing = resizingTask?.id === task.id;
                                const activeTask = isDragging || isResizing;
                                const isFinishedOrRunning =
                                    !!task.check_in ||
                                    !!task.check_out ||
                                    isBefore(new Date(task.planned_date!), currentTime);
                                // Treatment tasks are always non-draggable (informational only)
                                const isLocked =
                                    isTreatmentTask ||
                                    (!task.isDraft &&
                                        (task.locked === true || (task.locked !== false && isFinishedOrRunning)));

                                const isCascadeGhost = draggingTask?.cascadeIds?.includes(task.id);
                                const isConflicting = conflictingTaskIds.has(task.id);

                                // All tasks (including treatments) use the order's hash color for consistency
                                const color = isConflicting ? "#ef4444" : getProductionTaskColor(task, taskColorMap);
                                const isFocused = focusTaskId === task.id;

                                return (
                                    <motion.g
                                        key={task.id}
                                        id={task.id}
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: isCascadeGhost ? 1.0 : activeTask ? 0.9 : 1,
                                            cursor: isLocked ? "not-allowed" : isDragging ? "grabbing" : "grab",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!draggingTask && !resizingTask && !isScrollingRef.current) {
                                                setHoveredTask(task);
                                            }
                                            // Don't set position here, rely on mouse move
                                        }}
                                        onMouseLeave={() => setHoveredTask(null)}
                                        onClick={(e) => {
                                            if (readOnly) return;
                                            // For touch devices, show tooltip on tap
                                            if (!draggingTask && !resizingTask) {
                                                setHoveredTask(task);
                                            }
                                        }}
                                        onMouseMove={(e) => {
                                            if (hoveredTask?.id === task.id || !hoveredTask) {
                                                const TOOLTIP_WIDTH = 320;
                                                const TOOLTIP_THRESHOLD = 400; // If closer than this to bottom, flip up

                                                let x = e.clientX + 15;
                                                // Default to 'below': y is passed to 'top'
                                                let y = e.clientY + 15;
                                                let mode: "above" | "below" = "below";

                                                const spaceBelow = window.innerHeight - e.clientY;

                                                // Check right edge
                                                if (x + TOOLTIP_WIDTH + 20 > window.innerWidth) {
                                                    x = e.clientX - TOOLTIP_WIDTH - 15;
                                                }

                                                // Check bottom edge - Switch to ABOVE mode
                                                if (spaceBelow < TOOLTIP_THRESHOLD) {
                                                    mode = "above";
                                                    // For 'above', y is passed to 'bottom'
                                                    y = spaceBelow + 15;
                                                }

                                                setTooltipPos({ x, y, mode });
                                            }
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, task });
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (onTaskDoubleClick) {
                                                onTaskDoubleClick(task);
                                            } else {
                                                setModalData(task);
                                            }
                                        }}
                                    >
                                        {/* Conflict flash indicator */}
                                        {isConflicting && !activeTask && (
                                            <motion.rect
                                                x={x}
                                                y={y}
                                                width={width}
                                                height={height}
                                                rx={8}
                                                animate={{
                                                    opacity: [0.4, 0.8, 0.4],
                                                }}
                                                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                                                style={{
                                                    fill: "#ef4444",
                                                    transformOrigin: "center",
                                                    transformBox: "fill-box",
                                                    filter: "drop-shadow(0 0 8px #ef4444)",
                                                }}
                                            />
                                        )}

                                        {/* Task Pulse Animation Layer (Focus or Active) */}
                                        {(activeTask || isFocused) && (
                                            <motion.rect
                                                x={x}
                                                y={y}
                                                width={width}
                                                height={height}
                                                rx={8}
                                                initial={{ scale: 1, opacity: 0.8 }}
                                                animate={{
                                                    scale: [1, 1.25, 1],
                                                    opacity: [0.6, 0, 0.6],
                                                    strokeWidth: isFocused ? [4, 20, 4] : [2, 12, 2],
                                                }}
                                                transition={{
                                                    duration: isFocused ? 0.8 : 1.2,
                                                    repeat: Infinity,
                                                    ease: "easeOut",
                                                }}
                                                style={{
                                                    fill: "none",
                                                    stroke: isFocused ? "#EC1C21" : "#fff",
                                                    transformOrigin: "center",
                                                    transformBox: "fill-box",
                                                    filter: isFocused
                                                        ? "drop-shadow(0 0 20px #EC1C21)"
                                                        : "drop-shadow(0 0 15px #fff)",
                                                }}
                                            />
                                        )}

                                        <motion.rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            rx={8}
                                            stroke={activeTask ? "white" : "none"}
                                            strokeWidth={activeTask ? 3 : 0}
                                            animate={
                                                activeTask
                                                    ? {
                                                          scale: [1, 1.08, 1],
                                                          filter: [
                                                              `brightness(1.2) drop-shadow(0 0 15px ${color})`,
                                                              `brightness(1.5) drop-shadow(0 0 35px ${color})`,
                                                              `brightness(1.2) drop-shadow(0 0 15px ${color})`,
                                                          ],
                                                      }
                                                    : {}
                                            }
                                            transition={
                                                activeTask
                                                    ? {
                                                          duration: 1.2,
                                                          repeat: Infinity,
                                                          ease: "easeInOut",
                                                      }
                                                    : {}
                                            }
                                            style={{
                                                fill: color,
                                                fillOpacity: task.isDraft ? 0.85 : 1, // Slight transparency to show pattern but keep it solid
                                                filter: !activeTask
                                                    ? "drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
                                                    : undefined,
                                                stroke: isLocked
                                                    ? color
                                                    : isCascadeGhost
                                                      ? "#fff"
                                                      : activeTask
                                                        ? "white"
                                                        : task.isDraft
                                                          ? "white"
                                                          : "rgba(255,255,255,0.2)",
                                                strokeWidth: isLocked
                                                    ? 2.5
                                                    : isCascadeGhost
                                                      ? 2
                                                      : activeTask
                                                        ? 2
                                                        : task.isDraft
                                                          ? 2
                                                          : 1,
                                                strokeDasharray: isCascadeGhost ? "4 2" : task.isDraft ? "4 2" : "none",
                                                transformOrigin: "center",
                                                transformBox: "fill-box",
                                            }}
                                        />
                                        {/* Draft Pattern Overlay */}
                                        {task.isDraft && (
                                            <rect
                                                x={x}
                                                y={y}
                                                width={width}
                                                height={height}
                                                rx={6}
                                                fill="url(#draftPattern)"
                                                className="pointer-events-none"
                                            />
                                        )}
                                        {/* Interaction Shield (Underneath Resize Handle) */}
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            fill="rgba(0,0,0,0)" // Explicit transparent fill to capture events
                                            className={
                                                isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
                                            }
                                            onMouseDown={(e) => onMouseDown(e, task)}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (draggingTask || resizingTask) return;
                                                if (onTaskDoubleClick) {
                                                    onTaskDoubleClick(task);
                                                } else {
                                                    setModalData({
                                                        id: task.id,
                                                        machine: task.machine || "Sin Máquina",
                                                        start: format(
                                                            new Date(task.planned_date!),
                                                            "yyyy-MM-dd'T'HH:mm"
                                                        ),
                                                        end: format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm"),
                                                        operator: task.operator || "",
                                                        orderId: task.order_id || "",
                                                        activeOrder: task.production_orders,
                                                    });
                                                }
                                            }}
                                        />

                                        <foreignObject
                                            x={x}
                                            y={y}
                                            width={width > 12 ? width - 12 : width}
                                            height={height}
                                            className="pointer-events-none"
                                        >
                                            <div className="flex h-full flex-col justify-center overflow-hidden px-2 text-white">
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {isLocked && <Lock className="h-2.5 w-2.5 flex-shrink-0" />}
                                                    <div
                                                        className={cn(
                                                            "truncate text-[10px] font-black uppercase leading-none",
                                                            task.isDraft ? "text-white" : "text-white"
                                                        )}
                                                        style={{
                                                            textShadow: task.isDraft
                                                                ? "0 1px 3px rgba(0,0,0,0.5)"
                                                                : "none",
                                                        }}
                                                    >
                                                        {task.production_orders?.part_code || "S/N"}
                                                    </div>
                                                </div>

                                                {width > 100 && (
                                                    <div className="mt-1 self-start whitespace-nowrap rounded-sm bg-black/10 px-1 py-0.5 text-[8px] font-bold opacity-90">
                                                        {format(new Date(task.planned_date!), "HH:mm")} -{" "}
                                                        {format(new Date(task.planned_end!), "HH:mm")}
                                                    </div>
                                                )}
                                            </div>
                                        </foreignObject>

                                        {/* Resize Handle Left - hidden when locked */}
                                        {!isLocked && (
                                            <rect
                                                x={x}
                                                y={y}
                                                width={12}
                                                height={height}
                                                fill="transparent"
                                                className="cursor-ew-resize transition-colors hover:fill-white/20"
                                                onMouseDown={(e) => onResizeStart(e, task, "left")}
                                            />
                                        )}

                                        {/* Resize Handle Right - hidden when locked */}
                                        {!isLocked && (
                                            <rect
                                                x={x + width - 12}
                                                y={y}
                                                width={12}
                                                height={height}
                                                fill="transparent"
                                                className="cursor-ew-resize transition-colors hover:fill-white/20"
                                                onMouseDown={(e) => onResizeStart(e, task, "right")}
                                            />
                                        )}
                                    </motion.g>
                                );
                            })}

                            {/* Today Marker - Only render on client to avoid hydration mismatch */}
                            {currentTime && (
                                <line
                                    x1={timeToX(currentTime)}
                                    y1={0}
                                    x2={timeToX(currentTime)}
                                    y2={totalHeight}
                                    stroke="#EC1C21"
                                    strokeWidth="2"
                                    strokeDasharray="4 2"
                                />
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Reuse Existing Modal */}
            <TaskModal
                isOpen={!!modalData}
                onClose={() => setModalData(null)}
                initialData={modalData}
                orders={initialOrders}
                operators={operators}
                onSuccess={() => {
                    setModalData(null);
                    // router.refresh(); // Removed, parent handles refresh on save, modal just closes or parent needs to re-fetch if modal does direct updates (it does).
                    // Actually, if modal saves directly, we might need to trigger a refresh.
                    // But 'router' is not defined here anymore.
                    // For now, let's just close it. If modal updates server, we might need a prop to trigger refresh.
                    window.location.reload(); // Temporary fallback or just leave it closed.
                    // Better: just remove router.refresh() as the component doesn't have router.
                }}
                container={container}
            />

            {/* Floating Save Bar REMOVED - Moved to Header */}

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredTask && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="pointer-events-none fixed z-[100]"
                        style={{
                            left: tooltipPos.x,
                            top: tooltipPos.mode === "below" ? tooltipPos.y : undefined,
                            bottom: tooltipPos.mode === "above" ? tooltipPos.y : undefined,
                        }}
                    >
                        <div className="min-w-[240px] max-w-[320px] rounded-lg border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-md">
                            {/* Image */}
                            {hoveredTask.production_orders?.image && (
                                <div className="relative mb-3 h-40 w-full overflow-hidden rounded-md bg-muted">
                                    <Image
                                        src={hoveredTask.production_orders.image}
                                        alt={hoveredTask.production_orders?.part_name || "Pieza"}
                                        fill
                                        sizes="320px"
                                        className="object-cover"
                                    />
                                </div>
                            )}
                            <div className="mb-2 flex items-center gap-2">
                                <div
                                    className="h-3 w-3 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: getProductionTaskColor(hoveredTask, taskColorMap) }}
                                />
                                <div className="truncate text-xs font-black uppercase text-foreground">
                                    {hoveredTask.production_orders?.part_code || "S/N"}
                                </div>
                            </div>
                            <div className="mb-3 line-clamp-2 text-[10px] text-foreground/70">
                                {hoveredTask.production_orders?.part_name || "Sin nombre"}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <div>
                                    <div className="uppercase tracking-wider text-foreground/40">Máquina</div>
                                    <div className="font-semibold text-foreground">
                                        {hoveredTask.machine || "Sin asignar"}
                                    </div>
                                </div>
                                <div>
                                    <div className="uppercase tracking-wider text-foreground/40">Operador</div>
                                    <div className="font-semibold text-foreground">
                                        {hoveredTask.operator || "Sin asignar"}
                                    </div>
                                </div>
                                <div>
                                    <div className="uppercase tracking-wider text-foreground/40">Inicio</div>
                                    <div className="font-semibold text-foreground">
                                        {format(new Date(hoveredTask.planned_date!), "dd/MM HH:mm")}
                                    </div>
                                </div>
                                <div>
                                    <div className="uppercase tracking-wider text-foreground/40">Fin</div>
                                    <div className="font-semibold text-foreground">
                                        {format(new Date(hoveredTask.planned_end!), "dd/MM HH:mm")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Context Menu Portal */}
            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md duration-100 animate-in fade-in zoom-in-95"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-1 border-b border-border/50 px-2 py-1.5 text-xs font-semibold text-foreground">
                        Acciones
                    </div>
                    <button
                        onClick={() => {
                            const task = contextMenu.task;
                            setModalData({
                                id: task.id,
                                machine: task.machine || "Sin Máquina",
                                start: format(new Date(task.planned_date!), "yyyy-MM-dd'T'HH:mm"),
                                end: format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm"),
                                operator: task.operator || "",
                                orderId: task.order_id || "",
                                activeOrder: task.production_orders,
                            });
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Ver Detalles</span>
                    </button>
                    {onToggleLock && !contextMenu.task.isDraft && (
                        <button
                            onClick={() => {
                                const now = currentTime || new Date();
                                const isFinishedOrRunning =
                                    !!contextMenu.task.check_in ||
                                    !!contextMenu.task.check_out ||
                                    isBefore(new Date(contextMenu.task.planned_date!), now);
                                const currentIsLocked =
                                    contextMenu.task.locked === true ||
                                    (contextMenu.task.locked !== false && isFinishedOrRunning);
                                onToggleLock(contextMenu.task.id, !currentIsLocked);
                                setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                        >
                            {contextMenu.task.locked === true ||
                            (contextMenu.task.locked !== false &&
                                (!!contextMenu.task.check_in ||
                                    !!contextMenu.task.check_out ||
                                    isBefore(new Date(contextMenu.task.planned_date!), currentTime || new Date()))) ? (
                                <Unlock className="h-3.5 w-3.5" />
                            ) : (
                                <Lock className="h-3.5 w-3.5" />
                            )}
                            <span>
                                {contextMenu.task.locked === true ||
                                (contextMenu.task.locked !== false &&
                                    (!!contextMenu.task.check_in ||
                                        !!contextMenu.task.check_out ||
                                        isBefore(new Date(contextMenu.task.planned_date!), currentTime || new Date())))
                                    ? "Desbloquear"
                                    : "Bloquear"}
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
