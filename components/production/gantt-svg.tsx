"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
// import { useRouter } from "next/navigation"; // Removed
import moment from "moment";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut, Lock, Unlock, Maximize2, Minimize2 } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { TaskModal } from "./task-modal";
import { getProductionTaskColor } from "@/utils/production-colors";

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
    setOptimisticTasks: React.Dispatch<React.SetStateAction<PlanningTask[]>>; // Added
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
    onToggleFullscreen?: () => void;
}

// Helper for 15-minute snapping
const roundToNearest15Minutes = (date: moment.Moment) => {
    const minutes = date.minute();
    const roundedMinutes = Math.round(minutes / 15) * 15;

    // This handles minute=60 automatically by overflowing to next hour
    return date.clone().minute(roundedMinutes).second(0).millisecond(0);
};

// Constants for the SVG Engine
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 50;
const SIDEBAR_WIDTH = 200;

// Width per unit based on view mode
const VIEW_MODE_CONFIG = {
    hour: { width: 100, unit: 'hour' as const, format: 'HH:mm' },
    day: { width: 150, unit: 'day' as const, format: 'DD MMM' },
    week: { width: 200, unit: 'week' as const, format: 'DD MMM' }
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
    onToggleFullscreen
}: GanttSVGProps) {
    // View mode configuration
    const config = VIEW_MODE_CONFIG[viewMode];
    const UNIT_WIDTH = config.width * zoomLevel; // Apply Zoom

    // 1. Time Window State with view-specific date filter
    const [selectedDate, setSelectedDate] = useState(() => moment().startOf('day'));
    const [dateRangeStart, setDateRangeStart] = useState(() => moment().startOf('day').subtract(7, 'days'));
    const [dateRangeEnd, setDateRangeEnd] = useState(() => moment().startOf('day').add(14, 'days'));

    // Calculate timeWindow based on viewMode
    const timeWindow = useMemo(() => {
        if (viewMode === 'hour') {
            // Hour view: show selected day only (24 hours)
            return {
                start: moment(selectedDate).startOf('day'),
                end: moment(selectedDate).endOf('day').add(1, 'hour')
            };
        } else if (viewMode === 'day') {
            // Day view: show date range
            return {
                start: moment(dateRangeStart).startOf('day'),
                end: moment(dateRangeEnd).endOf('day')
            };
        } else {
            // Week view: show weeks starting from Monday
            return {
                start: moment(dateRangeStart).startOf('isoWeek'),
                end: moment(dateRangeEnd).endOf('isoWeek')
            };
        }
    }, [viewMode, selectedDate, dateRangeStart, dateRangeEnd]);

    // Automatically set default ranges when switching views
    useEffect(() => {
        if (viewMode === 'day') {
            // "Vista de día" -> Calcular por la semana completa
            setDateRangeStart(moment().startOf('isoWeek'));
            setDateRangeEnd(moment().endOf('isoWeek'));
        } else if (viewMode === 'week') {
            // "Vista de semana" -> Calcular por el mes completo
            setDateRangeStart(moment().startOf('month'));
            setDateRangeEnd(moment().endOf('month'));
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
        id: string,
        startX: number,
        initialX: number,
        initialDuration: number, // Added to fix duration drift
        cascadeIds?: string[]
    } | null>(null);
    const [resizingTask, setResizingTask] = useState<{
        id: string,
        startX: number,
        initialWidth: number,
        initialStart?: number,
        direction?: 'left' | 'right',
        dayStart?: number,
        dayEnd?: number
    } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, task: PlanningTask } | null>(null);
    // Removed local state: savedTasks, optimisticTasks, isSaving

    const [hoveredTask, setHoveredTask] = useState<PlanningTask | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number, mode: 'above' | 'below' }>({ x: 0, y: 0, mode: 'below' });
    const [currentTime, setCurrentTime] = useState<moment.Moment>(() => moment());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll suppression refs
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>(undefined);

    // Initialize current time on client and update every minute
    useEffect(() => {
        setCurrentTime(moment());
        const timer = setInterval(() => setCurrentTime(moment()), 60000);
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
        window.addEventListener('scroll', handleScrollInteraction, { capture: true });
        return () => window.removeEventListener('scroll', handleScrollInteraction, { capture: true });
    }, []);

    // Auto-scroll to today on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayX = timeToX(moment());
            // Center today in the viewport
            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollTo = Math.max(0, todayX - containerWidth / 3);
            scrollContainerRef.current.scrollLeft = scrollTo;
        }
    }, [viewMode, scrollContainerRef.current]); // Add dependencies if needed, or keep empty for mount only logic. Kept logical.

    // Removed Detect Changes logic (moved to parent)
    // Removed handleSave, handleDiscard logic (moved to parent)



    // 2. Filter machines and tasks
    const filteredMachines = useMemo(() => {
        const uniqueNames = new Set([
            ...initialMachines.map(m => m.name),
            ...optimisticTasks.map(t => t.machine).filter((n): n is string => !!n)
        ]);
        if (optimisticTasks.some(t => !t.machine)) uniqueNames.add("Sin Máquina");

        return Array.from(uniqueNames)
            .filter(name => {
                const isSelected = selectedMachines.has(name);
                if (!isSelected) return false;

                if (hideEmptyMachines) {
                    // Check if machine has tasks in the current visible window
                    const hasTasksInWindow = optimisticTasks.some(t => {
                        const isThisMachine = (t.machine === name) || (name === "Sin Máquina" && !t.machine);
                        if (!isThisMachine) return false;

                        // Check overlap with visible window
                        const taskStart = moment(t.planned_date);
                        const taskEnd = moment(t.planned_end);
                        const windowStart = timeWindow.start;
                        const windowEnd = timeWindow.end;

                        return taskEnd.isAfter(windowStart) && taskStart.isBefore(windowEnd);
                    });
                    return hasTasksInWindow;
                }
                return true;
            })
            .sort();
    }, [initialMachines, optimisticTasks, selectedMachines, hideEmptyMachines, timeWindow]);

    // Filter tasks by machine, search, AND visible time window
    const filteredTasks = useMemo(() => {
        return optimisticTasks.filter(task => {
            // Machine filter
            const matchesMachine = task.machine ? selectedMachines.has(task.machine) : selectedMachines.has("Sin Máquina");

            // Search filter
            const matchesSearch = !searchQuery ||
                task.production_orders?.part_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.production_orders?.part_name?.toLowerCase().includes(searchQuery.toLowerCase());

            // Time window filter - task must overlap with visible period
            const taskStart = moment(task.planned_date);
            const taskEnd = moment(task.planned_end);
            const windowStart = timeWindow.start;
            const windowEnd = timeWindow.end;
            const matchesTime = taskEnd.isAfter(windowStart) && taskStart.isBefore(windowEnd);

            return matchesMachine && matchesSearch && matchesTime;
        });
    }, [optimisticTasks, selectedMachines, searchQuery, timeWindow]);

    // 3. Absolute Coordinate Math (Critical for Alignment)
    const timeToX = (time: string | number | Date | moment.Moment) => {
        if (!time) return 0;
        const mTime = moment(time);
        const startMs = timeWindow.start.valueOf();
        const currentMs = mTime.valueOf();

        // Calculate difference based on view mode
        if (viewMode === 'hour') {
            const diffHours = (currentMs - startMs) / (1000 * 60 * 60);
            return diffHours * UNIT_WIDTH;
        } else if (viewMode === 'day') {
            const diffDays = (currentMs - startMs) / (1000 * 60 * 60 * 24);
            return diffDays * UNIT_WIDTH;
        } else {
            const diffWeeks = (currentMs - startMs) / (1000 * 60 * 60 * 24 * 7);
            return diffWeeks * UNIT_WIDTH;
        }
    };

    const xToTime = (x: number) => {
        const msPerUnit = viewMode === 'hour' ? 1000 * 60 * 60
            : viewMode === 'day' ? 1000 * 60 * 60 * 24
                : 1000 * 60 * 60 * 24 * 7;

        const diffMs = (x / UNIT_WIDTH) * msPerUnit;
        return moment(timeWindow.start).add(diffMs, 'milliseconds');
    };

    const totalWidth = useMemo(() => {
        if (viewMode === 'hour') {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60) * UNIT_WIDTH;
        } else if (viewMode === 'day') {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60 * 24) * UNIT_WIDTH;
        } else {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60 * 24 * 7) * UNIT_WIDTH;
        }
    }, [timeWindow, viewMode, UNIT_WIDTH]); // Ensure UNIT_WIDTH is here

    // Lane Allocation System - Detect overlaps PER DAY and assign lanes
    const taskLanes = useMemo(() => {
        const lanes: Map<string, number> = new Map();

        // Group tasks by machine AND day
        const machineDayTaskGroups: Map<string, PlanningTask[]> = new Map();

        filteredTasks.forEach(task => {
            const machine = task.machine || "Sin Máquina";
            const day = moment(task.planned_date).format("YYYY-MM-DD");
            const key = `${machine}|${day}`;

            if (!machineDayTaskGroups.has(key)) {
                machineDayTaskGroups.set(key, []);
            }
            machineDayTaskGroups.get(key)!.push(task);
        });

        // For each machine-day group, allocate lanes
        machineDayTaskGroups.forEach((tasks) => {
            // Sort by start time
            const sorted = [...tasks].sort((a, b) =>
                moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf()
            );

            const laneEnds: number[] = []; // Track when each lane ends

            sorted.forEach(task => {
                const taskStart = moment(task.planned_date).valueOf();
                const taskEnd = moment(task.planned_end).valueOf();

                // Find first available lane
                let assignedLane = 0;
                for (let i = 0; i < laneEnds.length; i++) {
                    if (laneEnds[i] <= taskStart) {
                        assignedLane = i;
                        break;
                    }
                    assignedLane = i + 1;
                }

                // If all lanes are busy, create new lane
                if (assignedLane >= laneEnds.length) {
                    laneEnds.push(taskEnd);
                } else {
                    laneEnds[assignedLane] = taskEnd;
                }

                lanes.set(task.id, assignedLane);
            });
        });

        return lanes;
    }, [filteredTasks]);

    // PRE-CALCULATE UTILIZATION FOR ALL MACHINES (Rules of Hooks Fix)
    const machineUtilizations = useMemo(() => {
        const stats = new Map<string, number>();
        const SHIFT_START = 6;
        const SHIFT_END = 22;
        const SHIFT_HOURS = SHIFT_END - SHIFT_START; // 16 hours

        filteredMachines.forEach(m => {
            const machineTasks = optimisticTasks.filter(t => (t.machine === m) || (m === "Sin Máquina" && !t.machine));
            if (machineTasks.length === 0) {
                stats.set(m, 0);
                return;
            }

            const viewStart = timeWindow.start.clone().startOf('day');
            const viewEnd = timeWindow.end.clone().subtract(2, 'hours').endOf('day');

            let totalShiftHours = 0;
            let occupiedHours = 0;

            const currentDay = viewStart.clone();
            while (currentDay.isBefore(viewEnd)) {
                totalShiftHours += SHIFT_HOURS;

                const dayShiftStart = currentDay.clone().hour(SHIFT_START);
                const dayShiftEnd = currentDay.clone().hour(SHIFT_END);

                const dailyTasks = machineTasks
                    .filter(task => {
                        const taskStart = moment(task.planned_date);
                        const taskEnd = moment(task.planned_end);
                        return taskStart.isBefore(dayShiftEnd) && taskEnd.isAfter(dayShiftStart);
                    })
                    .sort((a, b) =>
                        moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf()
                    );

                let currentLaneEnd = 0;
                dailyTasks.forEach(task => {
                    const taskStart = moment(task.planned_date);
                    const taskEnd = moment(task.planned_end);
                    if (taskStart.valueOf() >= currentLaneEnd) {
                        if (taskStart.isBefore(dayShiftEnd) && taskEnd.isAfter(dayShiftStart)) {
                            const overlapStart = moment.max(taskStart, dayShiftStart);
                            const overlapEnd = moment.min(taskEnd, dayShiftEnd);

                            if (overlapEnd.isAfter(overlapStart)) {
                                occupiedHours += overlapEnd.diff(overlapStart, 'hours', true);
                                currentLaneEnd = taskEnd.valueOf();
                            }
                        }
                        currentLaneEnd = Math.max(currentLaneEnd, taskEnd.valueOf());
                    }
                });

                currentDay.add(1, 'days');
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

    // Calculate max lanes per machine (global across all days)
    const machineLaneCounts = useMemo(() => {
        const counts: Map<string, number> = new Map();

        filteredTasks.forEach(task => {
            const machine = task.machine || "Sin Máquina";
            const lane = taskLanes.get(task.id) || 0;
            const current = counts.get(machine) || 0;
            counts.set(machine, Math.max(current, lane + 1));
        });

        return counts;
    }, [filteredTasks, taskLanes]);

    // Calculate machine height based on its max lanes
    const getMachineHeight = (machine: string) => {
        const lanes = machineLaneCounts.get(machine) || 1;
        return ROW_PADDING * 2 + lanes * BAR_HEIGHT + (lanes - 1) * BAR_GAP;
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
    }, [filteredMachines, machineLaneCounts]);

    // Dynamic total height
    const totalHeight = useMemo(() => {
        let height = 0;
        filteredMachines.forEach(machine => {
            height += getMachineHeight(machine);
        });
        return height;
    }, [filteredMachines, machineLaneCounts]);



    // Calculate Dependency Lines
    const dependencyLines = useMemo(() => {
        const lines: React.ReactNode[] = [];
        const tasksByOrder = new Map<string, PlanningTask[]>();

        // Group by Order
        filteredTasks.forEach(task => {
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
            groupTasks.sort((a, b) => moment(a.planned_date).diff(moment(b.planned_date)));

            for (let i = 0; i < groupTasks.length - 1; i++) {
                const startTask = groupTasks[i];
                const endTask = groupTasks[i + 1];

                const startMachine = startTask.machine || "Sin Máquina";
                const endMachine = endTask.machine || "Sin Máquina";

                // Get Coordinates
                const startY = (machineYOffsets.get(startMachine) || 0) + ROW_PADDING + ((taskLanes.get(startTask.id) || 0) * (BAR_HEIGHT + BAR_GAP)) + (BAR_HEIGHT / 2);
                const endY = (machineYOffsets.get(endMachine) || 0) + ROW_PADDING + ((taskLanes.get(endTask.id) || 0) * (BAR_HEIGHT + BAR_GAP)) + (BAR_HEIGHT / 2);

                const startX = timeToX(moment(startTask.planned_end));
                const endX = timeToX(moment(endTask.planned_date));

                // Bezier Curve
                const controlOffset = Math.min(Math.abs(endX - startX) / 2, 50);
                const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

                lines.push(
                    <path
                        key={`dep-${startTask.id}-${endTask.id}`}
                        d={path}
                        stroke={getProductionTaskColor(startTask)}
                        strokeWidth="1.5"
                        strokeOpacity="0.4"
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
        const snappedTime = roundToNearest15Minutes(rawTime);

        if (foundMachine) {
            setModalData({
                machine: foundMachine,
                time: snappedTime.valueOf()
            });
        }
    };

    const onMouseDown = (e: React.MouseEvent, task: PlanningTask) => {
        const now = currentTime || moment();
        const isFinishedOrRunning = !!task.check_in || !!task.check_out || moment(task.planned_date).isBefore(now);
        const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

        if (readOnly) return;
        if (isLocked) return; // Locked tasks cannot be dragged
        e.stopPropagation();
        setHoveredTask(null); // Hide tooltip immediately

        // Capture Snapshot
        snapshotRef.current = optimisticTasks;

        // If cascade mode, capture consecutive tasks on the same machine
        let cascadeIds: string[] = [];
        if (cascadeMode) {
            const taskEnd = moment(task.planned_end);
            const sameMachine = optimisticTasks
                .filter(t => t.machine === task.machine && t.id !== task.id && !t.locked)
                .sort((a, b) => moment(a.planned_date).valueOf() - moment(b.planned_date).valueOf());
            // Find consecutive chain: tasks whose start >= current task end
            for (const t of sameMachine) {
                if (moment(t.planned_date).isSameOrAfter(taskEnd)) {
                    cascadeIds.push(t.id);
                }
            }
        }

        setDraggingTask({
            id: task.id,
            startX: e.clientX,
            initialX: timeToX(task.planned_date!),
            initialDuration: moment(task.planned_end).diff(moment(task.planned_date)), // Capture duration once
            cascadeIds
        });
    };

    const onResizeStart = (e: React.MouseEvent, task: PlanningTask, direction: 'left' | 'right') => {
        const now = currentTime || moment();
        const isFinishedOrRunning = !!task.check_in || !!task.check_out || moment(task.planned_date).isBefore(now);
        const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));

        if (readOnly) return;
        if (isLocked) return; // Locked tasks cannot be resized
        e.stopPropagation();
        setHoveredTask(null); // Hide tooltip immediately

        // Capture Snapshot
        snapshotRef.current = optimisticTasks;

        const startDay = moment(task.planned_date).startOf('day').valueOf();
        const endDay = moment(task.planned_date).endOf('day').valueOf();

        setResizingTask({
            id: task.id,
            startX: e.clientX,
            initialWidth: timeToX(task.planned_end!) - timeToX(task.planned_date!),
            initialStart: timeToX(task.planned_date!),
            direction,
            dayStart: startDay,
            dayEnd: endDay
        });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (draggingTask) {
            const deltaX = e.clientX - draggingTask.startX;
            const newX = draggingTask.initialX + deltaX;
            let newStartTime = xToTime(newX);

            // Snap to 15 mins
            newStartTime = roundToNearest15Minutes(newStartTime);

            // Calculate the delta in milliseconds for cascade
            const originalStart = moment(xToTime(draggingTask.initialX));
            const deltaMs = newStartTime.diff(originalStart);

            setOptimisticTasks(prev => prev.map(t => {
                if (t.id === draggingTask.id) {
                    // Use captured, constant duration to prevent drift
                    return {
                        ...t,
                        planned_date: newStartTime.format("YYYY-MM-DDTHH:mm:ss"),
                        planned_end: newStartTime.clone().add(draggingTask.initialDuration).format("YYYY-MM-DDTHH:mm:ss")
                    };
                }
                // Cascade: move consecutive tasks by the same delta
                if (draggingTask.cascadeIds?.includes(t.id)) {
                    const origStart = moment(snapshotRef.current.find(s => s.id === t.id)?.planned_date);
                    const origEnd = moment(snapshotRef.current.find(s => s.id === t.id)?.planned_end);
                    return {
                        ...t,
                        planned_date: origStart.clone().add(deltaMs).format("YYYY-MM-DDTHH:mm:ss"),
                        planned_end: origEnd.clone().add(deltaMs).format("YYYY-MM-DDTHH:mm:ss")
                    };
                }
                return t;
            }));
        } else if (resizingTask) {
            const deltaX = e.clientX - resizingTask.startX;
            const direction = resizingTask.direction || 'right';
            const limitStart = resizingTask.dayStart ? moment(resizingTask.dayStart) : null;
            const limitEnd = resizingTask.dayEnd ? moment(resizingTask.dayEnd) : null;

            setOptimisticTasks(prev => prev.map(t => {
                if (t.id === resizingTask.id) {
                    if (direction === 'right') {
                        const newWidth = Math.max(10, resizingTask.initialWidth + deltaX);
                        let newEndTime = xToTime(timeToX(t.planned_date!) + newWidth);

                        // Snap End Time
                        newEndTime = roundToNearest15Minutes(newEndTime);

                        // CLAMP to day end
                        if (limitEnd && newEndTime.isAfter(limitEnd)) {
                            newEndTime = limitEnd.clone();
                        }

                        // Ensure min duration (15 mins)
                        const currentStart = moment(t.planned_date);
                        if (newEndTime.diff(currentStart, 'minutes') < 15) {
                            newEndTime = currentStart.clone().add(15, 'minutes');
                        }

                        return { ...t, planned_end: newEndTime.format("YYYY-MM-DDTHH:mm:ss") };
                    } else {
                        // Left resize
                        // 1. Calculate ideal new X
                        let newX = (resizingTask.initialStart || 0) + Math.min(deltaX, resizingTask.initialWidth - 10);
                        let newStartDate = xToTime(newX);

                        // Snap Start Time
                        newStartDate = roundToNearest15Minutes(newStartDate);

                        // 2. CLAMP to day start
                        if (limitStart && newStartDate.isBefore(limitStart)) {
                            newStartDate = limitStart.clone();
                        }

                        // Re-validate against end time to ensure min width
                        const currentEnd = moment(t.planned_end);
                        if (currentEnd.diff(newStartDate, 'minutes') < 15) {
                            newStartDate = currentEnd.clone().subtract(15, 'minutes');
                        }

                        return { ...t, planned_date: newStartDate.format("YYYY-MM-DDTHH:mm:ss") };
                    }
                }
                return t;
            }));
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

        // Just clear interaction state. Changes remain in optimisticTasks until Save.
        setDraggingTask(null);
        setResizingTask(null);
    };

    // 5. Grid Helpers - Generate columns based on view mode
    const timeColumns = useMemo(() => {
        const columns = [];
        let curr = moment(timeWindow.start);

        while (curr.isBefore(timeWindow.end)) {
            const isSpecial = viewMode === 'hour'
                ? curr.hour() === 0
                : viewMode === 'day'
                    ? curr.day() === 1 // Monday
                    : curr.date() === 1; // First of month

            columns.push({
                time: curr.clone(),
                x: timeToX(curr),
                label: viewMode === 'hour'
                    ? curr.format('HH:mm')
                    : viewMode === 'day'
                        ? curr.format('DD MMM')
                        : `Sem ${curr.week()}`,
                dateLabel: curr.format('DD MMM'),
                isSpecial
            });

            // Step based on view mode
            if (viewMode === 'hour') {
                curr.add(1, 'hour');
            } else if (viewMode === 'day') {
                curr.add(1, 'day');
            } else {
                curr.add(1, 'week');
            }
        }
        return columns;
    }, [timeWindow.start, timeWindow.end, viewMode, zoomLevel, UNIT_WIDTH]);

    // Date navigation functions
    const navigateDate = (direction: 'prev' | 'next' | 'today') => {
        if (viewMode === 'hour') {
            // Hour view: navigate by day
            if (direction === 'today') {
                setSelectedDate(moment().startOf('day'));
                // Scroll to current time after state update
                setTimeout(() => scrollToNow(), 100);
            } else {
                const shift = direction === 'prev' ? -1 : 1;
                setSelectedDate(prev => moment(prev).add(shift, 'day'));
            }
        } else {
            // Day/Week view: navigate by range (Standardized to Week/Month)
            if (direction === 'today') {
                if (viewMode === 'day') {
                    // Reset to current Week
                    setDateRangeStart(moment().startOf('isoWeek'));
                    setDateRangeEnd(moment().endOf('isoWeek'));
                } else {
                    // Reset to current Month
                    setDateRangeStart(moment().startOf('month'));
                    setDateRangeEnd(moment().endOf('month'));
                }
                // Scroll to current time after state update
                setTimeout(() => scrollToNow(), 100);
            } else {
                const shiftDir = direction === 'prev' ? -1 : 1;

                if (viewMode === 'day') {
                    // Navigate strictly by WEEK
                    setDateRangeStart(prev => moment(prev).add(shiftDir, 'weeks').startOf('isoWeek'));
                    setDateRangeEnd(prev => moment(prev).add(shiftDir, 'weeks').endOf('isoWeek'));
                } else {
                    // Navigate strictly by MONTH
                    setDateRangeStart(prev => moment(prev).add(shiftDir, 'months').startOf('month'));
                    setDateRangeEnd(prev => moment(prev).add(shiftDir, 'months').endOf('month'));
                }
            }
        }
    };

    // Close Context Menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Scroll to current time position
    const scrollToNow = () => {
        if (!scrollContainerRef.current) return;

        const now = moment();
        const nowX = timeToX(now);
        const containerWidth = scrollContainerRef.current.clientWidth;

        // Center "now" in the viewport (approximately 1/3 from left)
        const scrollX = Math.max(0, nowX - containerWidth / 3);

        scrollContainerRef.current.scrollTo({
            left: scrollX,
            behavior: 'smooth'
        });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden select-none bg-background relative">
            {/* Gantt Header Bar */}
            <div className="flex-none h-10 border-b border-border bg-muted/30 flex items-center px-4 z-[50] gap-2">
                {/* Start Controls (View Mode Buttons) */}
                {startControls}

                {/* Date Navigation - right of view buttons */}
                {!hideDateNavigation && (
                    <>
                        <div className="w-px h-6 bg-border" />
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigateDate('prev')}
                                className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Anterior"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => navigateDate('today')}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1"
                            >
                                <Calendar className="w-3 h-3" />
                                Hoy
                            </button>
                            <button
                                onClick={() => navigateDate('next')}
                                className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Siguiente"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Date Inputs - compact styled */}
                        <div className="w-px h-6 bg-border" />
                        <div className="flex items-center gap-1.5">
                            {viewMode === 'hour' ? (
                                <input
                                    type="date"
                                    value={selectedDate.format('YYYY-MM-DD')}
                                    onChange={(e) => setSelectedDate(moment(e.target.value))}
                                    className="px-2 py-0.5 text-[10px] rounded-md border border-border/60 bg-background hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all outline-none cursor-pointer font-medium"
                                />
                            ) : (
                                <>
                                    <input
                                        type="date"
                                        value={dateRangeStart.format('YYYY-MM-DD')}
                                        onChange={(e) => setDateRangeStart(moment(e.target.value))}
                                        className="px-2 py-0.5 text-[10px] rounded-md border border-border/60 bg-background hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all outline-none cursor-pointer font-medium"
                                    />
                                    <span className="text-[10px] text-muted-foreground font-bold">→</span>
                                    <input
                                        type="date"
                                        value={dateRangeEnd.format('YYYY-MM-DD')}
                                        onChange={(e) => setDateRangeEnd(moment(e.target.value))}
                                        className="px-2 py-0.5 text-[10px] rounded-md border border-border/60 bg-background hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all outline-none cursor-pointer font-medium"
                                    />
                                </>
                            )}
                        </div>
                    </>
                )}

                {!hideDateNavigation && !startControls && (
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-3 py-1 rounded-md">
                            {selectedDate.format('DD MMMM YYYY')}
                        </span>
                    </div>
                )}

                {/* Spacer to push remaining items right */}
                <div className="flex-1" />

                {/* End Controls (Search, Filters, Settings) */}
                {endControls}

                {/* Zoom Controls */}
                {endControls && <div className="w-px h-6 bg-border" />}
                <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg border border-border/50">
                    <button
                        onClick={() => setZoomLevel(prev => Math.max(viewMode === 'week' ? 0.8 : 0.5, prev - 0.25))}
                        className="p-1 rounded-md hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Reducir Zoom"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <div
                        className="w-14 px-1 flex justify-center cursor-pointer select-none"
                        title="Doble click para restablecer (100%)"
                        onDoubleClick={() => setZoomLevel(1)}
                    >
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                    </div>
                    <button
                        onClick={() => setZoomLevel(prev => Math.min(viewMode === 'week' ? 10 : 3, prev + 0.25))}
                        className="p-1 rounded-md hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Aumentar Zoom"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Fullscreen Button - far right */}
                {onToggleFullscreen && (
                    <>
                        <div className="w-px h-6 bg-border" />
                        <button
                            id="planning-fullscreen"
                            onClick={onToggleFullscreen}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-primary transition-all"
                            title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-3.5 h-3.5" />
                            ) : (
                                <Maximize2 className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </>
                )}
            </div>

            <div className="flex-1 flex relative overflow-hidden">
                {/* Fixed Machine Sidebar */}
                <div className="w-[200px] border-r border-border bg-background dark:bg-[#0a0a0a] flex flex-col z-[40] shadow-2xl transition-colors flex-shrink-0">
                    {/* Sidebar Header */}
                    <div className="h-[50px] border-b border-border bg-muted/30 flex items-center px-4 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 flex-shrink-0">
                        Máquinas
                    </div>
                    {/* Machine List - scrolls with Y */}
                    <div
                        className="flex-1 overflow-hidden"
                    >
                        <div
                            className="flex flex-col"
                            style={{ transform: `translateY(${-scrollPos.y}px)` }}
                        >
                            {filteredMachines.map((m, i) => {
                                // Get Pre-calculated Utilization
                                const utilization = machineUtilizations.get(m) || 0;

                                let badgeColor = "bg-muted text-muted-foreground";
                                if (utilization > 85) badgeColor = "bg-green-500/20 text-green-600";
                                else if (utilization > 50) badgeColor = "bg-blue-500/20 text-blue-600";
                                else if (utilization > 0) badgeColor = "bg-gray-500/20 text-gray-600";

                                return (
                                    <div
                                        key={i}
                                        className={`border-b border-border/10 px-4 flex items-center justify-between text-[11px] font-black uppercase tracking-tight text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0 ${i % 2 === 1 ? "bg-foreground/[0.03]" : ""}`}
                                        style={{ height: getMachineHeight(m) }}
                                    >
                                        <span className="truncate mr-2" title={m}>{m}</span>
                                        {utilization > 0 && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${badgeColor}`}>
                                                {utilization}%
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Header + Grid) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Time Header - Fixed at top, scrolls with X */}
                    <div className="h-[50px] border-b border-border bg-background/90 backdrop-blur-md flex-shrink-0 overflow-hidden relative">
                        <div
                            className="absolute top-0 left-0 h-full"
                            style={{
                                width: totalWidth,
                                transform: `translateX(${-scrollPos.x}px)`
                            }}
                        >
                            {timeColumns.map((col, i) => (
                                <div
                                    key={i}
                                    className={`flex flex-col justify-center items-center border-r border-border/30 text-[9px] font-black h-full transition-colors ${col.isSpecial ? "bg-primary/10 text-primary border-primary/20" : "text-foreground/40"}`}
                                    style={{
                                        width: UNIT_WIDTH,
                                        position: 'absolute',
                                        left: col.x,
                                        top: 0
                                    }}
                                >
                                    {viewMode === 'hour' && <div className="text-[7px] text-foreground/30 uppercase">{col.dateLabel}</div>}
                                    <div className={`text-[10px] ${col.isSpecial ? "text-primary font-black" : ""}`}>{col.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SVG Content Area - Scrolls both X and Y */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto relative bg-background/5 dark:bg-[#050505]"
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
                        <svg
                            width={totalWidth}
                            height={totalHeight}
                            style={{ display: 'block' }}
                        >
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

                            {/* Tasks */}

                            {/* Dependency Lines (Behind tasks) */}
                            {/* Dependency Lines (Behind tasks) */}
                            {showDependencies && dependencyLines}

                            {filteredTasks.map((task) => {
                                const machine = task.machine || "Sin Máquina";
                                const machineY = machineYOffsets.get(machine) || 0;
                                const lane = taskLanes.get(task.id) || 0;

                                const x = timeToX(task.planned_date!);
                                const width = Math.max(timeToX(task.planned_end!) - x, 0);

                                // Fixed bar height, positioned by lane within dynamic row
                                const y = machineY + ROW_PADDING + (lane * (BAR_HEIGHT + BAR_GAP));
                                const height = BAR_HEIGHT;

                                const isDragging = draggingTask?.id === task.id;
                                const isResizing = resizingTask?.id === task.id;
                                const activeTask = isDragging || isResizing;
                                const isFinishedOrRunning = !!task.check_in || !!task.check_out || moment(task.planned_date).isBefore(currentTime);
                                const isLocked = !task.isDraft && (task.locked === true || (task.locked !== false && isFinishedOrRunning));


                                const isCascadeGhost = draggingTask?.cascadeIds?.includes(task.id);

                                const color = getProductionTaskColor(task);

                                return (
                                    <motion.g
                                        key={task.id}
                                        id={task.id}
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: isCascadeGhost ? 1.0 : activeTask ? 0.9 : 1,
                                            cursor: isLocked ? "not-allowed" : isDragging ? "grabbing" : "grab"
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
                                                let mode: 'above' | 'below' = 'below';

                                                const spaceBelow = window.innerHeight - e.clientY;

                                                // Check right edge
                                                if (x + TOOLTIP_WIDTH + 20 > window.innerWidth) {
                                                    x = e.clientX - TOOLTIP_WIDTH - 15;
                                                }

                                                // Check bottom edge - Switch to ABOVE mode
                                                if (spaceBelow < TOOLTIP_THRESHOLD) {
                                                    mode = 'above';
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
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            rx={6}
                                            fill={color}
                                            className={`shadow-xl transition-all duration-300 ${isLocked ? 'opacity-75' : (task as any).isDraft ? 'opacity-70' : 'hover:opacity-100 opacity-90'}`}
                                            style={{
                                                filter: activeTask
                                                    ? `drop-shadow(0 8px 15px ${color})`
                                                    : "drop-shadow(0 4px 6px rgba(0,0,0,0.15))",
                                                stroke: isLocked ? color : isCascadeGhost ? '#fff' : activeTask ? "white" : ((task as any).isDraft ? "white" : "rgba(255,255,255,0.2)"),
                                                strokeWidth: isLocked ? 2.5 : isCascadeGhost ? 2 : activeTask ? 2 : ((task as any).isDraft ? 2 : 1),
                                                strokeDasharray: isCascadeGhost ? '4 2' : (task as any).isDraft ? "4 2" : "none"
                                            }}
                                        />
                                        {/* Interaction Shield (Underneath Resize Handle) */}
                                        <rect
                                            x={x} y={y} width={width} height={height}
                                            fill="rgba(0,0,0,0)" // Explicit transparent fill to capture events
                                            className={isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
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
                                                        start: moment(task.planned_date).format("YYYY-MM-DDTHH:mm"),
                                                        end: moment(task.planned_end).format("YYYY-MM-DDTHH:mm"),
                                                        operator: task.operator || "",
                                                        orderId: task.order_id || "",
                                                        activeOrder: task.production_orders
                                                    });
                                                }
                                            }}
                                        />

                                        <foreignObject x={x} y={y} width={width > 12 ? width - 12 : width} height={height} className="pointer-events-none">
                                            <div
                                                className="h-full flex flex-col justify-center text-white px-2 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {isLocked && <Lock className="w-2.5 h-2.5 flex-shrink-0" />}
                                                    <div className="text-[10px] font-black truncate uppercase leading-none drop-shadow-sm">
                                                        {task.production_orders?.part_code || "S/N"}
                                                    </div>
                                                </div>

                                                {width > 100 && (
                                                    <div className="text-[8px] font-bold opacity-90 mt-1 whitespace-nowrap bg-black/10 px-1 py-0.5 rounded-sm self-start">
                                                        {moment(task.planned_date).format("HH:mm")} - {moment(task.planned_end).format("HH:mm")}
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
                                                className="cursor-ew-resize hover:fill-white/20 transition-colors"
                                                onMouseDown={(e) => onResizeStart(e, task, 'left')}
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
                                                className="cursor-ew-resize hover:fill-white/20 transition-colors"
                                                onMouseDown={(e) => onResizeStart(e, task, 'right')}
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
                        className="fixed z-[100] pointer-events-none"
                        style={{
                            left: tooltipPos.x,
                            top: tooltipPos.mode === 'below' ? tooltipPos.y : undefined,
                            bottom: tooltipPos.mode === 'above' ? tooltipPos.y : undefined
                        }}
                    >
                        <div className="bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-3 min-w-[240px] max-w-[320px]">
                            {/* Image */}
                            {hoveredTask.production_orders?.image && (
                                <div className="w-full h-40 rounded-md overflow-hidden mb-3 bg-muted">
                                    <img
                                        src={hoveredTask.production_orders.image}
                                        alt={hoveredTask.production_orders?.part_name || "Pieza"}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getProductionTaskColor(hoveredTask) }}
                                />
                                <div className="text-xs font-black uppercase text-foreground truncate">
                                    {hoveredTask.production_orders?.part_code || "S/N"}
                                </div>
                            </div>
                            <div className="text-[10px] text-foreground/70 mb-3 line-clamp-2">
                                {hoveredTask.production_orders?.part_name || "Sin nombre"}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <div>
                                    <div className="text-foreground/40 uppercase tracking-wider">Máquina</div>
                                    <div className="text-foreground font-semibold">{hoveredTask.machine || "Sin asignar"}</div>
                                </div>
                                <div>
                                    <div className="text-foreground/40 uppercase tracking-wider">Operador</div>
                                    <div className="text-foreground font-semibold">{hoveredTask.operator || "Sin asignar"}</div>
                                </div>
                                <div>
                                    <div className="text-foreground/40 uppercase tracking-wider">Inicio</div>
                                    <div className="text-foreground font-semibold">{moment(hoveredTask.planned_date).format("DD/MM HH:mm")}</div>
                                </div>
                                <div>
                                    <div className="text-foreground/40 uppercase tracking-wider">Fin</div>
                                    <div className="text-foreground font-semibold">{moment(hoveredTask.planned_end).format("DD/MM HH:mm")}</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Context Menu Portal */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-popover border border-border shadow-md rounded-md py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1.5 text-xs font-semibold border-b border-border/50 text-foreground mb-1">
                        Acciones
                    </div>
                    <button
                        onClick={() => {
                            const task = contextMenu.task;
                            setModalData({
                                id: task.id,
                                machine: task.machine || "Sin Máquina",
                                start: moment(task.planned_date).format("YYYY-MM-DDTHH:mm"),
                                end: moment(task.planned_end).format("YYYY-MM-DDTHH:mm"),
                                operator: task.operator || "",
                                orderId: task.order_id || "",
                                activeOrder: task.production_orders
                            });
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-foreground transition-colors flex items-center gap-2"
                    >
                        <span>Ver Detalles</span>
                    </button>
                    {onToggleLock && !contextMenu.task.isDraft && (
                        <button
                            onClick={() => {
                                const now = currentTime || moment();
                                const isFinishedOrRunning = !!contextMenu.task.check_in || !!contextMenu.task.check_out || moment(contextMenu.task.planned_date).isBefore(now);
                                const currentIsLocked = contextMenu.task.locked === true || (contextMenu.task.locked !== false && isFinishedOrRunning);
                                onToggleLock(contextMenu.task.id, !currentIsLocked);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-foreground transition-colors flex items-center gap-2"
                        >
                            {(contextMenu.task.locked === true || (contextMenu.task.locked !== false && (!!contextMenu.task.check_in || !!contextMenu.task.check_out || moment(contextMenu.task.planned_date).isBefore(currentTime || moment())))) ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            <span>{(contextMenu.task.locked === true || (contextMenu.task.locked !== false && (!!contextMenu.task.check_in || !!contextMenu.task.check_out || moment(contextMenu.task.planned_date).isBefore(currentTime || moment())))) ? 'Desbloquear' : 'Bloquear'}</span>
                        </button>
                    )}
                </div>
            )}

        </div>
    );
}
